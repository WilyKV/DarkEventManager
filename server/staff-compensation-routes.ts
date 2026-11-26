import type { Express } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { participants, staffCompensations } from "@shared/schema";
import { staffCompensationPath, staffCompensationSchema } from "@shared/staff-compensation";
import { requireRole } from "./auth-middleware";
import { checkSyncPermissions } from "./sync-middleware";
import { db } from "./db";

export function registerStaffCompensationRoutes(app: Express) {
  const admin = requireRole("admin");
  app.get(staffCompensationPath, admin, async (_req, res) => {
    const rows = await db.select({
      participantId: staffCompensations.participantId,
      volunteer: staffCompensations.volunteer,
      rateCents: staffCompensations.rateCents,
    }).from(staffCompensations).innerJoin(participants, eq(staffCompensations.participantId, participants.id))
      .where(and(eq(participants.type, "staff"), isNull(participants.deletedAt)));
    res.json(rows);
  });

  app.patch(`${staffCompensationPath}/:id`, admin, checkSyncPermissions, async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    const details = staffCompensationSchema.safeParse(req.body);
    if (!id.success || !details.success) return res.status(400).json({ message: "Tarification staff invalide." });

    const saved = await db.transaction(async tx => {
      const [person] = await tx.select({ id: participants.id }).from(participants)
        .where(and(eq(participants.id, id.data), eq(participants.type, "staff"), isNull(participants.deletedAt))).for("update");
      if (!person) return false;

      const { volunteer, rateCents } = details.data;
      if (volunteer === null) await tx.delete(staffCompensations).where(eq(staffCompensations.participantId, person.id));
      else await tx.insert(staffCompensations).values({ participantId: person.id, volunteer, rateCents })
        .onConflictDoUpdate({ target: staffCompensations.participantId, set: { volunteer, rateCents } });
      return true;
    });
    return saved ? res.sendStatus(204) : res.status(404).json({ message: "Membre du staff introuvable." });
  });
}
