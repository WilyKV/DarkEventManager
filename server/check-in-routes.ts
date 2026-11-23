import { createHash } from "node:crypto";
import type { Express } from "express";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  checkInChecklistComplete, checkInDetailsSchema, checkInPath, checkInProfiles, checkInRoles,
  checkInRosterPath, checkInTypes, isCheckInType, type CheckInDetails, type CheckInPlayer, type CheckInType,
} from "@shared/check-in";
import { appConfig, participants, squads, timeSlots, squadAuditLog, type Participant } from "@shared/schema";
import { db } from "./db";
import { hasSessionRole, requireRole } from "./auth-middleware";
import { checkSyncPermissions } from "./sync-middleware";

const formSchema = checkInDetailsSchema.extend({ revision: z.string().length(64), allowOverCapacity: z.boolean().optional() });

export function allowedCheckInTypes(roles: unknown): CheckInType[] {
  if (hasSessionRole(roles, ["admin"])) return [...checkInTypes];
  return checkInTypes.filter(type => type !== "staff" && hasSessionRole(roles, [`staff_${type}`]));
}

function asCheckInPlayer(row: Participant, type: CheckInType): CheckInPlayer {
  const details: CheckInDetails = { squadId: row.squadId, checklist: {} };
  for (const item of checkInProfiles[type].checklist) details.checklist[item] = Boolean(row[item]);
  const revision = createHash("sha256").update(JSON.stringify([
    row.id, row.createdAt, row.firstName, row.lastName, row.timeSlotId, type,
    row.arrived, row.arrivedAt, row.returned, details,
  ])).digest("hex");
  return {
    id: row.id, type, timeSlotId: row.timeSlotId, firstName: row.firstName, lastName: row.lastName,
    arrived: Boolean(row.arrived), returned: Boolean(row.returned), details, revision,
  };
}

export function registerCheckInRoutes(app: Express) {
  const allowCheckIn = requireRole(...checkInRoles);

  app.get(checkInRosterPath, allowCheckIn, async (req, res) => {
    const types = allowedCheckInTypes(req.session?.user?.roles);
    const roster = await db.transaction(async tx => {
      const [config] = await tx.select({ eventDay: appConfig.eventDay }).from(appConfig).orderBy(appConfig.id).limit(1);
      const players = (await tx.select().from(participants).where(and(inArray(participants.type, types), isNull(participants.deletedAt))))
        .flatMap(row => isCheckInType(row.type) ? [asCheckInPlayer(row, row.type)] : []);
      const slots = await tx.select({ id: timeSlots.id, name: timeSlots.name, type: timeSlots.type,
        briefingTime: timeSlots.briefingTime, gameTime: timeSlots.gameTime, mealTime: timeSlots.mealTime, exitTime: timeSlots.exitTime,
        welcomeNotes: timeSlots.welcomeNotes })
        .from(timeSlots).where(inArray(timeSlots.type, types));
      const teams = await tx.select({ id: squads.id, number: squads.number, type: squads.type,
        timeSlotId: squads.timeSlotId, maxMembers: squads.maxMembers, briefing: squads.briefing, members: count(participants.id) })
        .from(squads).leftJoin(participants, eq(participants.squadId, squads.id))
        .where(inArray(squads.type, types)).groupBy(squads.id);
      return { eventDay: config?.eventDay ?? null, players, slots, teams };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.json(roster);
  });

  app.post(`${checkInPath}/:id`, allowCheckIn, checkSyncPermissions, async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    const form = formSchema.safeParse(req.body);
    if (!id.success || !form.success) return res.status(400).json({ message: "Fiche d’accueil invalide." });
    const { revision, checklist, squadId, allowOverCapacity } = form.data;
    const types = allowedCheckInTypes(req.session?.user?.roles);

    const result = await db.transaction(async tx => {
      // Match the offline sync lock order so that only one writer can claim a team's last place.
      await tx.execute(sql`LOCK TABLE participants IN SHARE ROW EXCLUSIVE MODE`);
      await tx.execute(sql`LOCK TABLE squads IN SHARE MODE`);
      const [row] = await tx.select().from(participants).where(eq(participants.id, id.data));
      if (!row || row.deletedAt || !isCheckInType(row.type) || !types.includes(row.type)) {
        return { status: 404, body: { message: "Participant introuvable dans vos listes." } };
      }
      if (row.returned) return { status: 409, body: { message: "Cette personne est déjà sortie." } };

      const type = row.type;
      const current = asCheckInPlayer(row, type);
      const details = { squadId: type === "staff" ? row.squadId : squadId, checklist: { ...current.details.checklist } };
      for (const item of checkInProfiles[type].checklist) {
        if (checklist[item] !== undefined) details.checklist[item] = checklist[item];
      }
      const sameDetails = details.squadId === row.squadId &&
        checkInProfiles[type].checklist.every(item => details.checklist[item] === current.details.checklist[item]);
      if (revision !== current.revision) {
        if (current.arrived && sameDetails) return { status: 200, body: current };
        return { status: 409, body: { message: "La fiche a été modifiée. Rechargez-la avant de continuer." } };
      }

      const changedTeam = details.squadId !== row.squadId;
      if (changedTeam && details.squadId !== null) {
        const [team] = await tx.select().from(squads).where(eq(squads.id, details.squadId));
        if (!team || team.type !== type || team.timeSlotId !== row.timeSlotId) {
          return { status: 409, body: { message: "Cette équipe ne correspond plus au créneau. Rechargez la fiche." } };
        }
        const [{ members }] = await tx.select({ members: count() }).from(participants).where(eq(participants.squadId, team.id));
        if (!allowOverCapacity && team.maxMembers !== null && members >= team.maxMembers) {
          return { status: 409, body: { message: "Cette équipe est complète. Choisissez une autre équipe." } };
        }
      }

      const [saved] = await tx.update(participants).set({
        arrived: true, arrivedAt: row.arrivedAt ?? new Date(), squadId: details.squadId,
        ...details.checklist, ...(type !== "staff" && { checklistCompleted: checkInChecklistComplete(type, details) }),
      }).where(eq(participants.id, row.id)).returning();
      if (changedTeam) await tx.insert(squadAuditLog).values({
        participantId: row.id, previousSquadId: row.squadId, newSquadId: details.squadId,
      });
      return { status: 200, body: asCheckInPlayer(saved, type) };
    });

    res.status(result.status).json(result.body);
  });
}
