import { createHash } from "node:crypto";
import type { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { cardsPath } from "@shared/participant-card";
import { eventReviewsPath, playerProfilePath, profileClaimInput, profileKey, reviewInput } from "@shared/souvenir-engagement";
import { eventReviews, participantCards, playerProfiles } from "@shared/schema";
import { requireRole } from "./auth-middleware";
import { db } from "./db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Card = typeof participantCards.$inferSelect;

export function souvenirCodeProof(card: Pick<Card, "token" | "code">) {
  return digest(JSON.stringify([card.token, card.code]));
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const activeSince = sql<Date>`now() - interval '1 year'`;
const activeKey = (key: string) => and(eq(playerProfiles.keyHash, digest(key)), gt(playerProfiles.lastActivityAt, activeSince));

async function eligibleCard(tx: Transaction, req: Request) {
  const token = req.params.token;
  if (typeof token !== "string" || req.session.souvenirToken !== token) return;
  const [card] = await tx.select().from(participantCards)
    .where(and(eq(participantCards.token, token), gt(participantCards.expiresAt, sql`now()`))).for("update");
  if (card && req.session.souvenirCodeProof === souvenirCodeProof(card)) return card;
}

function profileView(row: typeof playerProfiles.$inferSelect) {
  const { firstName, lastName, email, eventKeys, lastActivityAt } = row;
  return { firstName, lastName, email, visits: eventKeys.length, lastActivityAt: lastActivityAt.toISOString() };
}

export async function purgeInactivePlayerProfiles() {
  await db.delete(playerProfiles).where(sql`${playerProfiles.lastActivityAt} <= ${activeSince}`);
}

export function registerSouvenirEngagementRoutes(app: Express) {
  const limit = rateLimit({ windowMs: 60_000, limit: 25, standardHeaders: "draft-7", legacyHeaders: false });
  app.get(eventReviewsPath, requireRole("admin"), async (_req, res) => {
    const rows = await db.select({
      id: eventReviews.id, halfStars: eventReviews.halfStars, comment: eventReviews.comment, updatedAt: eventReviews.updatedAt,
      eventDay: sql<string | null>`${participantCards.summary}->>'eventDay'`,
    }).from(eventReviews).innerJoin(participantCards, eq(eventReviews.cardId, participantCards.id))
      .where(gt(participantCards.expiresAt, sql`now()`)).orderBy(desc(eventReviews.updatedAt));
    res.set("Cache-Control", "private, no-store").json(rows);
  });

  app.get(`${cardsPath}/view/:token/review`, async (req, res) => {
    if (req.session.souvenirToken !== req.params.token) return res.sendStatus(401);
    const result = await db.transaction(async tx => {
      const card = await eligibleCard(tx, req);
      if (!card) return undefined;
      const [review] = await tx.select({ halfStars: eventReviews.halfStars, comment: eventReviews.comment })
        .from(eventReviews).where(eq(eventReviews.cardId, card.id));
      return { review: review ?? null, profileLinked: card.playerProfileId !== null };
    });
    if (!result) return res.sendStatus(401);
    return res.set("Cache-Control", "private, no-store").json(result);
  });

  app.put(`${cardsPath}/view/:token/review`, limit, async (req, res) => {
    if (req.session.souvenirToken !== req.params.token) return res.sendStatus(401);
    const form = reviewInput.safeParse(req.body);
    if (!form.success) return res.status(400).json({ message: "Choisissez une note de 1 à 5 étoiles." });
    const saved = await db.transaction(async tx => {
      const card = await eligibleCard(tx, req);
      if (!card) return false;
      await tx.insert(eventReviews).values({ cardId: card.id, ...form.data })
        .onConflictDoUpdate({ target: eventReviews.cardId, set: { ...form.data, updatedAt: new Date() } });
      return true;
    });
    return res.sendStatus(saved ? 204 : 401);
  });

  app.post(`${cardsPath}/view/:token/profile`, limit, async (req, res) => {
    if (req.session.souvenirToken !== req.params.token) return res.sendStatus(401);
    const form = profileClaimInput.safeParse(req.body);
    if (!form.success) return res.status(400).json({ message: "Clé ou adresse e-mail invalide." });
    const result = await db.transaction(async tx => {
      const card = await eligibleCard(tx, req);
      if (!card?.expiresAt || !card.summary.arrivedAt) return { status: 403 as const };
      const keyHash = digest(form.data.key);
      const [profile] = await tx.select().from(playerProfiles).where(activeKey(form.data.key)).for("update");
      if (card.playerProfileId !== null && profile?.id !== card.playerProfileId) return { status: 409 as const };
      if (!profile && form.data.action === "link") return { status: 404 as const };

      const eventKey = digest(card.expiresAt.toISOString());
      const eventKeys = Array.from(new Set([...(profile?.eventKeys ?? []), eventKey]));
      const lastActivityAt = new Date();
      const [saved] = profile
        ? await tx.update(playerProfiles).set({ eventKeys, lastActivityAt }).where(eq(playerProfiles.id, profile.id)).returning()
        : await tx.insert(playerProfiles).values({
          keyHash, eventKeys, lastActivityAt, firstName: card.summary.firstName, lastName: card.summary.lastName,
          email: form.data.action === "create" ? form.data.email : null,
        }).onConflictDoNothing().returning();
      if (!saved) return { status: 409 as const };
      await tx.update(participantCards).set({ playerProfileId: saved.id }).where(eq(participantCards.id, card.id));
      return { status: 200 as const, profile: profileView(saved) };
    });
    if (result.status !== 200) return res.status(result.status).json({
      message: result.status === 403 ? "L’événement doit être clôturé et l’arrivée enregistrée pour ajouter cette participation."
        : result.status === 404 ? "Clé invalide ou profil expiré." : "Cette participation est déjà rattachée à un profil.",
    });
    return res.set("Cache-Control", "private, no-store").json(result.profile);
  });

  const keyInput = z.object({ key: profileKey }).strict();
  app.post(`${playerProfilePath}/open`, limit, async (req, res) => {
    const form = keyInput.safeParse(req.body);
    if (!form.success) return res.sendStatus(401);
    const [profile] = await db.update(playerProfiles).set({ lastActivityAt: new Date() })
      .where(activeKey(form.data.key)).returning();
    if (!profile) return res.sendStatus(401);
    return res.set("Cache-Control", "private, no-store").json(profileView(profile));
  });

  app.post(`${playerProfilePath}/delete`, limit, async (req, res) => {
    const form = keyInput.safeParse(req.body);
    if (!form.success) return res.sendStatus(401);
    const [profile] = await db.delete(playerProfiles).where(activeKey(form.data.key)).returning({ id: playerProfiles.id });
    return res.sendStatus(profile ? 204 : 401);
  });
}
