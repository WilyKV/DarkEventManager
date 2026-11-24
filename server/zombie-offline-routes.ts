import { defaultWelcomeChecklist, mergeWelcomeChecks } from "@shared/welcome-checklist";
import { defaultMakeupArtists } from "@shared/makeup";
import { createHash } from "node:crypto";
import type { Express } from "express";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { appConfig, auditLogs, participants, squads, timeSlots, squadAuditLog, type Participant } from "@shared/schema";
import {
  offlineCheckInApi, offlineNewPlayerSchema, offlineUpdateSchema, type OfflineParticipant, type OfflineCheckIn,
  type OfflineSnapshot, type OfflineSyncResult, type OfflinePlayerReceipt,
} from "@shared/zombie-offline";
import { checkInChecklistComplete, checkInProfiles, checkInRoles, isCheckInType, type ChecklistItem, type CheckInType } from "@shared/check-in";
import { db } from "./db";
import { allowedCheckInTypes } from "./check-in-routes";
import { hasSessionRole, requireRole } from "./auth-middleware";
import { checkSyncPermissions } from "./sync-middleware";
import { childLogger } from "./logger";
import { storage } from "./storage";

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
    checklist.mealTicketGiven, checklist.waterBottleGiven, checklist.makeupWaitExplained, checklist.mapGiven,
    ...(state.welcomeChecks && Object.keys(state.welcomeChecks).length ? [Object.entries(state.welcomeChecks).sort()] : [])]);
}

export function offlinePlayerIdentity(p: Pick<Participant, "id" | "createdAt" | "firstName" | "lastName" | "type">) {
  return hash([p.id, p.createdAt, p.firstName, p.lastName, p.type]);
}

function offlineRevision(identity: string, player: Participant, state: OfflineCheckIn) {
  return hash([identity, player.timeSlotId, player.returned, stateHash(state)]);
}

function offlineParticipant(p: Participant, type: CheckInType): OfflineParticipant {
  const identity = offlinePlayerIdentity(p);
  const state: OfflineCheckIn = {
    arrived: Boolean(p.arrived),
    arrivedAt: p.arrived ? p.arrivedAt?.toISOString() ?? null : null,
    squadId: p.squadId,
    ...(type === "zombie" && p.welcomeChecks && Object.keys(p.welcomeChecks).length ? { welcomeChecks: p.welcomeChecks } : {}),
    checklist: {
      squadExplained: Boolean(p.squadExplained),
      briefingExplained: Boolean(p.briefingExplained),
      mealTicketGiven: Boolean(p.mealTicketGiven),
      waterBottleGiven: Boolean(p.waterBottleGiven),
      makeupWaitExplained: Boolean(p.makeupWaitExplained),
      mapGiven: Boolean(p.mapGiven),
    },
  };
  const revision = offlineRevision(identity, p, state);
  return { id: p.id, type, identity, revision, firstName: p.firstName, lastName: p.lastName,
    timeSlotId: p.timeSlotId, returned: Boolean(p.returned), state };
}

export function registerOfflineCheckInRoutes(app: Express): void {
  registerOfflineProfileRoutes(app, offlineCheckInApi);
  registerOfflineProfileRoutes(app, "/api/zombie-offline", ["zombie"]);
  registerOfflineRosterWrites(app);
}

function registerOfflineProfileRoutes(app: Express, path: string, legacyTypes?: CheckInType[]) {
  const allow = requireRole(...(legacyTypes ? ["admin", "staff_zombie"] : checkInRoles));
  app.get(path, allow, async (req, res) => {
    const profileTypes = legacyTypes ?? allowedCheckInTypes(req.session.user!.roles);
    try {
      const snapshot: OfflineSnapshot = await db.transaction(async tx => {
        const [config] = await tx.select({ day: appConfig.eventDay, makeupArtists: appConfig.makeupArtists, welcomeChecklist: appConfig.welcomeChecklist }).from(appConfig).orderBy(appConfig.id).limit(1);
        const rows = await tx.select().from(participants)
          .where(and(inArray(participants.type, profileTypes), isNull(participants.deletedAt)));
        const teams = await tx.select({ id: squads.id, number: squads.number, timeSlotId: squads.timeSlotId,
          maxMembers: squads.maxMembers, briefing: squads.briefing, type: squads.type })
          .from(squads).where(inArray(squads.type, profileTypes));
        return {
          ownerId: req.session.user!.id,
          canDeleteParticipants: !legacyTypes && hasSessionRole(req.session.user!.roles, ["admin"]),
          profileTypes,
          eventDay: config?.day ?? null,
          ...(profileTypes.includes("zombie") && config?.welcomeChecklist ? { welcomeChecklist: config.welcomeChecklist } : {}),
          makeupArtists: config?.makeupArtists ?? defaultMakeupArtists,
          participants: rows.flatMap(row => isCheckInType(row.type) ? [offlineParticipant(row, row.type)] : []),
          timeSlots: (await tx.select({ id: timeSlots.id, name: timeSlots.name, type: timeSlots.type,
            briefingTime: timeSlots.briefingTime, gameTime: timeSlots.gameTime, mealTime: timeSlots.mealTime,
            exitTime: timeSlots.exitTime, welcomeNotes: timeSlots.welcomeNotes })
            .from(timeSlots).where(inArray(timeSlots.type, profileTypes)))
            .filter((slot): slot is typeof slot & { type: CheckInType } => isCheckInType(slot.type)),
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
        const [config] = profileTypes.includes("zombie")
          ? await tx.select({ welcomeChecklist: appConfig.welcomeChecklist }).from(appConfig).orderBy(appConfig.id).limit(1) : [];
        const settings = config?.welcomeChecklist ?? defaultWelcomeChecklist;
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
          // Old offline copies used the creation date when a legacy arrival had no timestamp.
          const previousFallback = row.arrived && !row.arrivedAt ? (row.createdAt ?? new Date(0)).toISOString() : null;
          const matchesLegacyRevision = previousFallback !== null &&
            update.revision === offlineRevision(current.identity, row, { ...current.state, arrivedAt: previousFallback });
          const state = matchesLegacyRevision && update.state.arrivedAt === previousFallback
            ? { ...update.state, arrivedAt: null } : update.state;
          if (stateHash(current.state) === stateHash(state)) {
            results.push({ id: update.id, revision: current.revision });
            continue;
          }
          if (current.revision !== update.revision && !matchesLegacyRevision) {
            results.push({ id: update.id, error: "La fiche a changé sur le serveur depuis la préparation." });
            continue;
          }
          const { arrived, arrivedAt, squadId, checklist } = state;
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
          if (arrived && !row.arrived && !arrivedAt) {
            results.push({ id: update.id, error: "L’heure de la nouvelle arrivée est manquante." });
            continue;
          }
          const arrivalDate = arrivedAt ? new Date(arrivedAt) : null;
          if (arrivalDate && arrivalDate.getTime() > Date.now() + 10 * 60_000) {
            results.push({ id: update.id, error: "L’heure d’arrivée est dans le futur. Vérifiez l’heure de l’appareil." });
            continue;
          }
          const welcomeChecks = type === "zombie" && state.welcomeChecks
            ? mergeWelcomeChecks(row.welcomeChecks, state.welcomeChecks, settings) : row.welcomeChecks;
          const [saved] = await tx.update(participants).set({
            arrived, arrivedAt: arrivalDate, squadId, ...checklist,
            ...(welcomeChecks && { welcomeChecks }),
            ...(type !== "staff" && { checklistCompleted: checkInChecklistComplete(type, { squadId, checklist, welcomeChecks: welcomeChecks ?? undefined }, settings) }),
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

const rosterWritePath = `${offlineCheckInApi}/participants`;
const ownerIdSchema = z.number().int().positive();
const offlineCreateSchema = z.object({
  ownerId: ownerIdSchema,
  requestId: z.uuid(),
  player: offlineNewPlayerSchema,
}).strict();
const offlineArchiveSchema = z.object({
  ownerId: ownerIdSchema,
  identity: z.string().length(64),
  revision: z.string().length(64),
}).strict();

function registerOfflineRosterWrites(app: Express) {
  app.post(rosterWritePath, requireRole(...checkInRoles), checkSyncPermissions, async (req, res) => {
    const parsed = offlineCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "La fiche à créer est invalide." });
    const operator = req.session.user!;
    const { ownerId, requestId, player } = parsed.data;
    if (ownerId !== operator.id || !allowedCheckInTypes(operator.roles).includes(player.type)) {
      return res.status(403).json({ message: "Ce compte ne peut pas créer cette fiche d’accueil." });
    }

    const marker = JSON.stringify({ offlineCheckIn: requestId });
    const fingerprint = hash([player.firstName, player.lastName, player.type, player.timeSlotId]);
    try {
      const receipt = await db.transaction(async tx => {
        // The creation and its receipt commit together. A retry receives the original revision.
        await tx.execute(sql`LOCK TABLE participants IN SHARE ROW EXCLUSIVE MODE`);
        const [prior] = await tx.select({ recordData: auditLogs.recordData }).from(auditLogs)
          .where(and(eq(auditLogs.userId, ownerId), eq(auditLogs.tableName, "participants"),
            eq(auditLogs.action, "CREATE"), eq(auditLogs.changes, marker))).limit(1);
        if (prior?.recordData) {
          const saved = JSON.parse(prior.recordData) as { fingerprint: string; receipt: OfflinePlayerReceipt };
          return saved.fingerprint === fingerprint ? saved.receipt : null;
        }
        if (player.timeSlotId !== null) {
          const [slot] = await tx.select({ id: timeSlots.id }).from(timeSlots)
            .where(and(eq(timeSlots.id, player.timeSlotId), eq(timeSlots.type, player.type))).for("share");
          if (!slot) return null;
        }
        const [saved] = await tx.insert(participants).values({
          ...player, hasFreemeal: player.type === "zombie", secretCode: await storage.generateSecretCode(tx),
        }).returning();
        const { id, identity, revision } = offlineParticipant(saved, player.type);
        const result = { id, identity, revision };
        await tx.insert(auditLogs).values({
          userId: ownerId, username: operator.username, action: "CREATE", tableName: "participants",
          recordId: id, changes: marker, recordData: JSON.stringify({ fingerprint, receipt: result }),
        });
        return result;
      });
      if (!receipt) return res.status(409).json({ message: "Le créneau n’est plus disponible pour ce profil ou la fiche locale a changé après son premier envoi." });
      res.status(201).json(receipt);
    } catch (error) {
      logger.error({ err: error }, "Impossible de créer la fiche hors ligne");
      res.status(500).json({ message: "Création interrompue. La fiche reste sur cet appareil." });
    }
  });

  app.delete(`${rosterWritePath}/:id`, requireRole("admin"), checkSyncPermissions, async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    const parsed = offlineArchiveSchema.safeParse(req.body);
    if (!id.success || !parsed.success) return res.status(400).json({ message: "La fiche à supprimer est invalide." });
    const operator = req.session.user!;
    if (parsed.data.ownerId !== operator.id) {
      return res.status(403).json({ message: "Reconnectez-vous avec le compte qui a préparé la liste." });
    }
    try {
      const archived = await db.transaction(async tx => {
        await tx.execute(sql`LOCK TABLE participants IN SHARE ROW EXCLUSIVE MODE`);
        const [row] = await tx.select().from(participants).where(eq(participants.id, id.data));
        if (!row || !isCheckInType(row.type)) return false;
        const current = offlineParticipant(row, row.type);
        if (current.identity !== parsed.data.identity) return false;
        if (row.deletedAt) return true;
        if (current.revision !== parsed.data.revision) return false;
        if (!await storage.archiveParticipant(row.id, tx)) return false;
        await tx.insert(auditLogs).values({
          userId: operator.id, username: operator.username, action: "DELETE", tableName: "participants", recordId: row.id,
        });
        return true;
      });
      if (!archived) return res.status(409).json({ message: "La fiche a changé depuis la préparation. Annulez la suppression locale et reprenez la fiche du serveur." });
      res.sendStatus(204);
    } catch (error) {
      logger.error({ err: error }, "Impossible de supprimer la fiche hors ligne");
      res.status(500).json({ message: "Suppression interrompue. Elle reste en attente sur cet appareil." });
    }
  });
}
