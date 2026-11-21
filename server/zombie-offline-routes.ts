import { createHash } from "node:crypto";
import type { Express } from "express";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { appConfig, participants, squads, timeSlots, squadAuditLog, type Participant } from "@shared/schema";
import {
  offlineCheckInApi, offlineUpdateSchema, type OfflineParticipant, type OfflineCheckIn,
  type OfflineSnapshot, type OfflineSyncResult,
} from "@shared/zombie-offline";
import { checkInChecklistComplete, checkInProfiles, checkInRoles, isCheckInType, type ChecklistItem, type CheckInType } from "@shared/check-in";
import { db } from "./db";
import { allowedCheckInTypes } from "./check-in-routes";
import { requireRole } from "./auth-middleware";
import { checkSyncPermissions } from "./sync-middleware";
import { childLogger } from "./logger";

const logger = childLogger("offline-check-in");
const syncSchema = z.object({
  ownerId: z.number().int().positive(),
  updates: z.array(offlineUpdateSchema).min(1).max(50),
}).strict().refine(({ updates }) => new Set(updates.map(update => update.id)).size === updates.length);

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stateHash(state: OfflineCheckIn): string {
  const { arrived, arrivedAt, squadId, checklist } = state;
  return hash([arrived, arrivedAt, squadId, checklist.squadExplained, checklist.briefingExplained,
    checklist.mealTicketGiven, checklist.waterBottleGiven, checklist.makeupWaitExplained, checklist.mapGiven]);
}

function offlineParticipant(p: Participant, type: CheckInType): OfflineParticipant {
  const identity = hash([p.id, p.createdAt, p.firstName, p.lastName, p.type]);
  const state: OfflineCheckIn = {
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
  return { id: p.id, type, identity, revision, firstName: p.firstName, lastName: p.lastName,
    timeSlotId: p.timeSlotId, returned: Boolean(p.returned), state };
}

export function registerOfflineCheckInRoutes(app: Express): void {
  registerOfflineProfileRoutes(app, offlineCheckInApi);
  registerOfflineProfileRoutes(app, "/api/zombie-offline", ["zombie"]);
}

function registerOfflineProfileRoutes(app: Express, path: string, legacyTypes?: CheckInType[]) {
  const allow = requireRole(...(legacyTypes ? ["admin", "staff_zombie"] : checkInRoles));
  app.get(path, allow, async (req, res) => {
    const profileTypes = legacyTypes ?? allowedCheckInTypes(req.session.user!.roles);
    try {
      const snapshot: OfflineSnapshot = await db.transaction(async tx => {
        const [config] = await tx.select({ day: appConfig.eventDay }).from(appConfig).orderBy(appConfig.id).limit(1);
        const rows = await tx.select().from(participants)
          .where(and(inArray(participants.type, profileTypes), isNull(participants.deletedAt)));
        const teams = await tx.select({ id: squads.id, number: squads.number, timeSlotId: squads.timeSlotId,
          maxMembers: squads.maxMembers, briefing: squads.briefing, type: squads.type })
          .from(squads).where(inArray(squads.type, profileTypes));
        return {
          ownerId: req.session.user!.id,
          profileTypes,
          eventDay: config?.day ?? null,
          participants: rows.flatMap(row => isCheckInType(row.type) ? [offlineParticipant(row, row.type)] : []),
          timeSlots: await tx.select({ id: timeSlots.id, name: timeSlots.name,
            briefingTime: timeSlots.briefingTime, gameTime: timeSlots.gameTime, mealTime: timeSlots.mealTime,
            exitTime: timeSlots.exitTime, welcomeNotes: timeSlots.welcomeNotes })
            .from(timeSlots).where(inArray(timeSlots.type, profileTypes)),
          squads: teams.filter((team): team is typeof team & { type: CheckInType } => isCheckInType(team.type)),
        };
      }, { isolationLevel: "repeatable read", accessMode: "read only" });
      res.set("Cache-Control", "no-store").json(snapshot);
    } catch (error) {
      logger.error({ err: error }, "Impossible de préparer l’accueil hors ligne");
      res.status(500).json({ message: "Impossible de préparer la liste d’accueil." });
    }
  });

  app.post(`${path}/sync`, allow, checkSyncPermissions, async (req, res) => {
    const profileTypes = legacyTypes ?? allowedCheckInTypes(req.session.user!.roles);
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
        const rows = await tx.select().from(participants).where(isNull(participants.deletedAt));
        const byId = new Map(rows.map(row => [row.id, row]));
        const teamById = new Map((await tx.select().from(squads).where(inArray(squads.type, profileTypes))).map(team => [team.id, team]));
        const teamCounts = new Map<number, number>();
        for (const { squadId } of rows) {
          if (squadId != null) teamCounts.set(squadId, (teamCounts.get(squadId) ?? 0) + 1);
        }
        const results: OfflineSyncResult[] = [];
        for (const update of batch.data.updates) {
          const row = byId.get(update.id);
          if (!row || !isCheckInType(row.type) || !profileTypes.includes(row.type)) {
            results.push({ id: update.id, error: "Cette fiche n’est plus disponible dans vos listes." });
            continue;
          }
          const type = row.type;
          const current = offlineParticipant(row, type);
          if (current.identity !== update.identity || current.returned) {
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
          const allowedFields: readonly ChecklistItem[] = checkInProfiles[type].checklist;
          if ((type === "staff" && squadId !== row.squadId) ||
              Object.keys(checklist).some(key => {
                const field = key as keyof typeof checklist;
                return !allowedFields.includes(field) && checklist[field] !== current.state.checklist[field];
              })) {
            results.push({ id: update.id, error: "Cette modification ne correspond pas au profil du participant." });
            continue;
          }
          const team = squadId == null ? undefined : teamById.get(squadId);
          if (squadId !== row.squadId && squadId != null) {
            if (!team || team.type !== type || team.timeSlotId !== row.timeSlotId) {
              results.push({ id: update.id, error: "Cette équipe ne correspond plus au profil ou au créneau." });
              continue;
            }
            const overflowConfirmed = !legacyTypes && update.allowOverCapacity === true;
            if (!overflowConfirmed && team.maxMembers != null && (teamCounts.get(squadId) ?? 0) >= team.maxMembers) {
              results.push({ id: update.id, error: "Cette équipe est pleine. Reprenez la fiche du serveur pour revoir l’affectation." });
              continue;
            }
          }
          const arrivalDate = arrivedAt ? new Date(arrivedAt) : null;
          if (arrivalDate && arrivalDate.getTime() > Date.now() + 10 * 60_000) {
            results.push({ id: update.id, error: "L’heure d’arrivée est dans le futur. Vérifiez l’heure de l’appareil." });
            continue;
          }
          const [saved] = await tx.update(participants).set({
            arrived, arrivedAt: arrivalDate, squadId, ...checklist,
            ...(type !== "staff" && { checklistCompleted: checkInChecklistComplete(type, { squadId, checklist }) }),
          }).where(eq(participants.id, row.id)).returning();
          if (squadId !== row.squadId) {
            await tx.insert(squadAuditLog).values({ participantId: row.id, previousSquadId: row.squadId, newSquadId: squadId });
            if (row.squadId != null) teamCounts.set(row.squadId, (teamCounts.get(row.squadId) ?? 1) - 1);
            if (squadId != null) teamCounts.set(squadId, (teamCounts.get(squadId) ?? 0) + 1);
          }
          results.push({ id: update.id, revision: offlineParticipant(saved, type).revision });
        }
        return results;
      });
      res.json({ results });
    } catch (error) {
      logger.error({ err: error }, "Impossible de synchroniser l’accueil hors ligne");
      res.status(500).json({ message: "Synchronisation interrompue. Vos modifications restent sur l’appareil." });
    }
  });
}
