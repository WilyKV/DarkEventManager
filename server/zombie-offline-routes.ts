import { createHash } from "node:crypto";
import type { Express } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { participants, squads, timeSlots, squadAuditLog, type Participant } from "@shared/schema";
import {
  checklistComplete, zombieUpdateSchema, type OfflineZombie, type ZombieCheckIn,
  type ZombieSnapshot, type ZombieSyncResult,
} from "@shared/zombie-offline";
import { db } from "./db";
import { requireRole } from "./auth-middleware";
import { checkSyncPermissions } from "./sync-middleware";
import { childLogger } from "./logger";

const logger = childLogger("zombie-offline");
const allowZombieStaff = requireRole("admin", "staff_zombie");
const syncSchema = z.object({
  ownerId: z.number().int().positive(),
  updates: z.array(zombieUpdateSchema).min(1).max(50),
}).strict().refine(({ updates }) => new Set(updates.map(update => update.id)).size === updates.length);

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stateHash(state: ZombieCheckIn): string {
  const { arrived, arrivedAt, squadId, checklist } = state;
  return hash([arrived, arrivedAt, squadId, checklist.squadExplained, checklist.briefingExplained,
    checklist.mealTicketGiven, checklist.waterBottleGiven, checklist.makeupWaitExplained, checklist.mapGiven]);
}

function offlineParticipant(p: Participant): OfflineZombie {
  const identity = hash([p.id, p.createdAt, p.firstName, p.lastName, p.type]);
  const state: ZombieCheckIn = {
    arrived: Boolean(p.arrived),
    arrivedAt: p.arrived ? (p.arrivedAt ?? p.createdAt ?? new Date(0)).toISOString() : null,
    squadId: p.squadId,
    checklist: {
      squadExplained: Boolean(p.squadExplained),
      briefingExplained: Boolean(p.briefingExplained),
      mealTicketGiven: Boolean(p.mealTicketGiven),
      waterBottleGiven: Boolean(p.waterBottleGiven),
      makeupWaitExplained: Boolean(p.makeupWaitExplained),
      mapGiven: Boolean(p.mapGiven),
    },
  };
  const revision = hash([identity, p.timeSlotId, p.returned, stateHash(state)]);
  return { id: p.id, identity, revision, firstName: p.firstName, lastName: p.lastName,
    timeSlotId: p.timeSlotId, returned: Boolean(p.returned), state };
}

export function registerZombieOfflineRoutes(app: Express): void {
  app.use("/api/zombie-offline", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/api/zombie-offline", allowZombieStaff, async (req, res) => {
    try {
      const snapshot: ZombieSnapshot = await db.transaction(async tx => ({
        ownerId: req.session.user!.id,
        participants: (await tx.select().from(participants).where(eq(participants.type, "zombie"))).map(offlineParticipant),
        timeSlots: await tx.select({ id: timeSlots.id, name: timeSlots.name,
          briefingTime: timeSlots.briefingTime, gameTime: timeSlots.gameTime, mealTime: timeSlots.mealTime, exitTime: timeSlots.exitTime,
          welcomeNotes: timeSlots.welcomeNotes })
          .from(timeSlots).where(eq(timeSlots.type, "zombie")),
        squads: await tx.select({ id: squads.id, number: squads.number, timeSlotId: squads.timeSlotId,
          maxMembers: squads.maxMembers, briefing: squads.briefing })
          .from(squads).where(eq(squads.type, "zombie")),
      }), { isolationLevel: "repeatable read", accessMode: "read only" });
      res.json(snapshot);
    } catch (error) {
      logger.error({ err: error }, "Impossible de préparer la liste zombie");
      res.status(500).json({ message: "Impossible de préparer la liste zombie." });
    }
  });

  app.post("/api/zombie-offline/sync", allowZombieStaff, checkSyncPermissions, async (req, res) => {
    const batch = syncSchema.safeParse(req.body);
    if (!batch.success) return res.status(400).json({ message: "Modifications d’accueil invalides." });
    if (batch.data.ownerId !== req.session.user!.id) {
      return res.status(403).json({ message: "Reconnectez-vous avec le compte qui a préparé la liste." });
    }
    try {
      const results = await db.transaction(async tx => {
        // Serialize assignments with the other participant writers while checking capacity.
        await tx.execute(sql`LOCK TABLE participants IN SHARE ROW EXCLUSIVE MODE`);
        await tx.execute(sql`LOCK TABLE squads IN SHARE MODE`);
        const rows = await tx.select().from(participants);
        const byId = new Map(rows.filter(row => row.type === "zombie").map(row => [row.id, row]));
        const teamById = new Map((await tx.select().from(squads).where(eq(squads.type, "zombie"))).map(team => [team.id, team]));
        const teamCounts = new Map<number, number>();
        for (const { squadId } of rows) {
          if (squadId != null) teamCounts.set(squadId, (teamCounts.get(squadId) ?? 0) + 1);
        }
        const results: ZombieSyncResult[] = [];
        for (const update of batch.data.updates) {
          const row = byId.get(update.id);
          const current = row && offlineParticipant(row);
          if (!row || !current || current.identity !== update.identity || current.returned) {
            results.push({ id: update.id, error: "Ce joueur a changé, a été retiré ou est déjà sorti." });
            continue;
          }
          if (stateHash(current.state) === stateHash(update.state)) {
            results.push({ id: update.id, revision: current.revision });
            continue;
          }
          if (current.revision !== update.revision) {
            results.push({ id: update.id, error: "La fiche a changé sur le serveur depuis la préparation." });
            continue;
          }
          const { arrived, arrivedAt, squadId, checklist } = update.state;
          const team = squadId == null ? undefined : teamById.get(squadId);
          if (squadId !== row.squadId && squadId != null && (!team || team.timeSlotId !== row.timeSlotId ||
            (team.maxMembers != null && (teamCounts.get(squadId) ?? 0) >= team.maxMembers))) {
            results.push({ id: update.id, error: "Cette équipe est pleine ou ne correspond plus au créneau." });
            continue;
          }
          const arrivalDate = arrivedAt ? new Date(arrivedAt) : null;
          if (arrivalDate && arrivalDate.getTime() > Date.now() + 10 * 60_000) {
            results.push({ id: update.id, error: "L’heure d’arrivée est dans le futur. Vérifiez l’heure de l’appareil." });
            continue;
          }
          const [saved] = await tx.update(participants).set({
            arrived, arrivedAt: arrivalDate, squadId, ...checklist,
            checklistCompleted: checklistComplete(checklist),
          }).where(and(eq(participants.id, row.id), eq(participants.type, "zombie"))).returning();
          if (squadId !== row.squadId) {
            await tx.insert(squadAuditLog).values({ participantId: row.id, previousSquadId: row.squadId, newSquadId: squadId });
            if (row.squadId != null) teamCounts.set(row.squadId, (teamCounts.get(row.squadId) ?? 1) - 1);
            if (squadId != null) teamCounts.set(squadId, (teamCounts.get(squadId) ?? 0) + 1);
          }
          results.push({ id: update.id, revision: offlineParticipant(saved).revision });
        }
        return results;
      });
      res.json({ results });
    } catch (error) {
      logger.error({ err: error }, "Impossible de synchroniser la liste zombie");
      res.status(500).json({ message: "Synchronisation interrompue. Vos modifications restent sur l’appareil." });
    }
  });
}
