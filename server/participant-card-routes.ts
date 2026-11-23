import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { and, count, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { appConfig, auditLogs, discounts, mealDiscounts, mealPurchases, participantCards, participants, purchases, serverEvents, sessions, squadAuditLog, squads, timeSlots } from "@shared/schema";
import { cardPrintLayouts, cardSurnamePrefixes, cardsPath, photoMaxBytes, souvenirExpiry, souvenirSettingsPath, type PrintableCard, type SouvenirAttendance, type SouvenirHighlights, type SouvenirSettings, type SouvenirSummary } from "@shared/participant-card";
import { checkInRoles } from "@shared/check-in";
import { db } from "./db";
import { storage } from "./storage";
import { requireRole } from "./auth-middleware";
import { allowedCheckInTypes } from "./check-in-routes";
import { checkSyncPermissions } from "./sync-middleware";
import { printModes, renderParticipantCards } from "./participant-card-pdf";
import { offlinePlayerIdentity } from "./zombie-offline-routes";

const tokenPattern = /^[A-Za-z0-9_-]{27}$/;
const codeCharacters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const issueSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
  pdf: z.enum(printModes).optional(),
  layout: z.enum(cardPrintLayouts).optional(),
  origin: z.url().max(240).refine(url => {
    const parsed = new URL(url);
    return parsed.origin === url && ["https:", "http:"].includes(parsed.protocol);
  }).optional(),
}).strict();
const photoSchema = z.object({
  photo: z.string().max(Math.ceil(photoMaxBytes / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/).nullable(),
  ownerId: z.number().int().positive().optional(),
  identity: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const emptySettings: SouvenirSettings = { zombies: null, survivors: null, photoUrl: null };
const souvenirSettingsSchema = z.object({
  zombies: z.int32().nonnegative().nullable(),
  survivors: z.int32().nonnegative().nullable(),
  photoUrl: z.string().trim().max(2048).pipe(z.url({ protocol: /^https?$/ })).refine(value => {
    const url = new URL(value);
    return !url.username && !url.password;
  }).nullable(),
}).strict();

async function countAttendance(tx: Transaction): Promise<SouvenirAttendance> {
  const counts = await tx.select({ type: participants.type, total: count() }).from(participants)
    .where(and(isNull(participants.deletedAt), inArray(participants.type, ["zombie", "survivant"]),
      or(eq(participants.arrived, true), isNotNull(participants.arrivedAt))))
    .groupBy(participants.type);
  return {
    zombies: counts.find(row => row.type === "zombie")?.total ?? 0,
    survivors: counts.find(row => row.type === "survivant")?.total ?? 0,
  };
}

async function eventHighlights(tx: Transaction, config: typeof appConfig.$inferSelect): Promise<SouvenirHighlights> {
  const settings = config.souvenirSettings ?? emptySettings;
  const automatic = config.souvenirSettings?.closedCounts ?? await countAttendance(tx);
  return { zombies: settings.zombies ?? automatic.zombies,
    survivors: settings.survivors ?? automatic.survivors, photoUrl: settings.photoUrl };
}

async function cardPlayers(tx: Transaction, ids?: number[]) {
  const squadCounts = tx.select({ squadId: participants.squadId, total: count().as("total") })
    .from(participants).where(isNull(participants.deletedAt)).groupBy(participants.squadId).as("souvenir_squad_counts");
  return tx.select({
    id: participants.id, createdAt: participants.createdAt, firstName: participants.firstName,
    lastName: participants.lastName, type: participants.type, wave: timeSlots.name, squad: squads.number, squadBriefing: squads.briefing,
    arrivedAt: participants.arrivedAt, gameStart: timeSlots.gameTime, gameEnd: timeSlots.exitTime, squadSize: squadCounts.total,
  }).from(participants).leftJoin(timeSlots, eq(timeSlots.id, participants.timeSlotId))
    .leftJoin(squads, eq(squads.id, participants.squadId))
    .leftJoin(squadCounts, eq(squadCounts.squadId, squads.id))
    .where(and(isNull(participants.deletedAt), ids && inArray(participants.id, ids)));
}

type CardPlayer = Awaited<ReturnType<typeof cardPlayers>>[number];

function identityOf(player: Pick<CardPlayer, "id" | "createdAt">) {
  return createHash("sha256").update(JSON.stringify([player.id, player.createdAt])).digest("hex");
}

function recap(player: CardPlayer, eventDay: string | null): SouvenirSummary {
  const { firstName, lastName, type, wave, squad, squadBriefing, squadSize, arrivedAt, gameStart, gameEnd } = player;
  return { firstName, lastName, type, wave, squad, squadBriefing, squadSize, gameStart, gameEnd, arrivedAt: arrivedAt?.toISOString() ?? null, eventDay };
}

async function lockedConfig(tx: Transaction, id: number) {
  const [config] = await tx.select().from(appConfig).where(eq(appConfig.id, id)).for("update");
  if (!config) throw new Error("Configuration introuvable");
  return config;
}

async function issueCards(tx: Transaction, players: CardPlayer[], config: typeof appConfig.$inferSelect) {
  const keys = players.map(identityOf);
  const rows = await tx.select({ identity: participantCards.identity, id: participantCards.id, token: participantCards.token,
    code: participantCards.code, expiresAt: participantCards.expiresAt })
    .from(participantCards).where(inArray(participantCards.identity, keys));
  const byIdentity = new Map(rows.map(card => [card.identity, card]));
  const expiresAt = config.eventClosedAt ? souvenirExpiry(config.eventClosedAt) : null;
  const highlights = expiresAt && players.some(player => !byIdentity.has(identityOf(player)))
    ? await eventHighlights(tx, config) : undefined;
  const missing = players.flatMap(player => {
    const identity = identityOf(player);
    if (byIdentity.has(identity)) return [];
    return [{
      identity, participantId: player.id, summary: { ...recap(player, config.eventDay), highlights },
      token: randomBytes(20).toString("base64url"),
      code: Array.from({ length: 10 }, () => codeCharacters[randomInt(codeCharacters.length)]).join(""),
      expiresAt,
    }];
  });
  if (missing.length) {
    const issued = await tx.insert(participantCards).values(missing).returning({
      identity: participantCards.identity, id: participantCards.id, token: participantCards.token,
      code: participantCards.code, expiresAt: participantCards.expiresAt,
    });
    for (const card of issued) byIdentity.set(card.identity, card);
  }
  return players.map(player => byIdentity.get(identityOf(player))!);
}

export async function closeParticipantCards() {
  const { id } = await storage.getSyncConfig();
  await db.transaction(async tx => {
    const config = await lockedConfig(tx, id);
    if (config.eventClosedAt) return;
    const closedAt = new Date();
    const expiresAt = souvenirExpiry(closedAt);
    const closedCounts = await countAttendance(tx);
    const souvenirSettings = { ...(config.souvenirSettings ?? emptySettings), closedCounts };
    const highlights = await eventHighlights(tx, { ...config, souvenirSettings });
    const roster = await cardPlayers(tx);
    const issued = await tx.select({ id: participantCards.id, identity: participantCards.identity })
      .from(participantCards).where(isNull(participantCards.expiresAt));
    const byIdentity = new Map(roster.map(player => [identityOf(player), player]));
    for (const card of issued) {
      const player = byIdentity.get(card.identity);
      if (player) await tx.update(participantCards).set({ expiresAt, summary: { ...recap(player, config.eventDay), highlights } })
        .where(eq(participantCards.id, card.id));
    }
    await tx.update(appConfig).set({ eventClosedAt: closedAt, souvenirSettings }).where(eq(appConfig.id, id));
  });
}

async function completeArchivedSummary(card: typeof participantCards.$inferSelect, currentConfig?: typeof appConfig.$inferSelect) {
  const summary = card.summary;
  if (summary.highlights && summary.gameStart !== undefined && summary.gameEnd !== undefined) return summary;
  const config = currentConfig ?? await storage.getSyncConfig();
  if (!card.expiresAt || !config.eventClosedAt ||
      card.expiresAt.getTime() !== souvenirExpiry(config.eventClosedAt).getTime()) return summary;
  return db.transaction(async tx => {
    const [player] = await cardPlayers(tx, [card.participantId]);
    const schedule = player && identityOf(player) === card.identity && player.wave === summary.wave
      ? { gameStart: summary.gameStart ?? player.gameStart, gameEnd: summary.gameEnd ?? player.gameEnd }
      : {};
    return { ...summary, ...schedule, highlights: summary.highlights ?? await eventHighlights(tx, config) };
  });
}

async function getCard(token: string) {
  if (!tokenPattern.test(token)) return undefined;
  const [card] = await db.select().from(participantCards).where(eq(participantCards.token, token));
  return card;
}

export async function participantFromCardQR(payload: string) {
  let path: string;
  try { path = new URL(payload).pathname; } catch { return undefined; }
  const match = /^\/souvenir\/([A-Za-z0-9_-]{27})\/?$/.exec(path);
  if (!match) return undefined;
  const card = await getCard(match[1]);
  if (!card || (card.expiresAt && card.expiresAt <= new Date())) return undefined;
  const participant = await storage.getParticipant(card.participantId);
  return participant && identityOf(participant) === card.identity ? participant : undefined;
}

async function eraseParticipantCard(tx: Transaction, card: Pick<typeof participantCards.$inferSelect, "id" | "token" | "identity" | "participantId">) {
  const id = card.participantId;
  const [person] = await tx.select({ id: participants.id, createdAt: participants.createdAt })
    .from(participants).where(eq(participants.id, id)).for("update");
  if (person && identityOf(person) === card.identity) {
    await tx.delete(serverEvents).where(or(
      and(eq(serverEvents.aggregateType, "participant"), eq(serverEvents.aggregateId, String(id))),
      sql`${serverEvents.payload}->>'participantId' = ${String(id)}`,
      sql`${serverEvents.payload}->'data'->>'participantId' = ${String(id)}`,
    ));
    await tx.delete(auditLogs).where(and(eq(auditLogs.tableName, "participants"), eq(auditLogs.recordId, id)));
    await tx.delete(squadAuditLog).where(eq(squadAuditLog.participantId, id));
    await tx.delete(discounts).where(eq(discounts.participantId, id));
    await tx.delete(mealDiscounts).where(eq(mealDiscounts.participantId, id));
    await tx.delete(purchases).where(eq(purchases.participantId, id));
    await tx.delete(mealPurchases).where(eq(mealPurchases.participantId, id));
    await tx.delete(sessions).where(or(
      sql`${sessions.sess}->'visitor'->>'participantId' = ${String(id)}`,
      sql`${sessions.sess}->>'souvenirToken' = ${card.token}`,
    ));
    await tx.delete(participants).where(eq(participants.id, id));
  } else {
    await tx.delete(sessions).where(sql`${sessions.sess}->>'souvenirToken' = ${card.token}`);
  }
  await tx.delete(participantCards).where(eq(participantCards.id, card.id));
}

export async function purgeExpiredParticipantCards() {
  const { id } = await storage.getSyncConfig();
  const expired = sql`${participantCards.expiresAt} <= now()`;
  let removed: number;
  do {
    removed = await db.transaction(async tx => {
      await lockedConfig(tx, id);
      const batch = await tx.select({ id: participantCards.id, token: participantCards.token,
        identity: participantCards.identity, participantId: participantCards.participantId })
        .from(participantCards).where(expired).limit(100).for("update");
      for (const card of batch) await eraseParticipantCard(tx, card);
      return batch.length;
    });
  } while (removed === 100);
}

export function registerParticipantCardRoutes(app: Express) {
  const staff = requireRole(...checkInRoles);
  const unlockLimit = rateLimit({
    windowMs: 15 * 60_000, limit: 12, standardHeaders: true, legacyHeaders: false,
    skipSuccessfulRequests: true, message: { message: "Trop de tentatives. Réessayez dans quelques minutes." },
  });
  app.use(cardsPath, (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });

  app.get(souvenirSettingsPath, requireRole("admin"), async (_req, res) => {
    const config = await storage.getSyncConfig();
    const { closedCounts, ...settings } = config.souvenirSettings ?? { ...emptySettings, closedCounts: undefined };
    const automatic = closedCounts ?? await db.transaction(countAttendance);
    res.json({ ...settings, automatic });
  });

  app.patch(souvenirSettingsPath, requireRole("admin"), checkSyncPermissions, async (req, res) => {
    const parsed = souvenirSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Saisissez des effectifs entiers positifs ou nuls et un lien HTTP(S) valide." });
    const { id } = await storage.getSyncConfig();
    const saved = await db.transaction(async tx => {
      const config = await lockedConfig(tx, id);
      const automatic = config.souvenirSettings?.closedCounts ?? await countAttendance(tx);
      const souvenirSettings = { ...parsed.data, ...(config.eventClosedAt && { closedCounts: automatic }) };
      await tx.update(appConfig).set({ souvenirSettings }).where(eq(appConfig.id, id));
      if (config.eventClosedAt) {
        const highlights = await eventHighlights(tx, { ...config, souvenirSettings });
        await tx.update(participantCards).set({
          summary: sql`${participantCards.summary} || ${JSON.stringify({ highlights })}::jsonb`,
        }).where(eq(participantCards.expiresAt, souvenirExpiry(config.eventClosedAt)));
      }
      return { ...parsed.data, automatic };
    });
    res.json(saved);
  });

  app.get(`${cardsPath}/template`, staff, async (req, res) => {
    const layout = z.enum(cardPrintLayouts).safeParse(req.query.layout ?? "card");
    if (!layout.success) return res.status(400).json({ message: "Format de carte invalide." });
    const pdf = await renderParticipantCards([], "https://example.invalid", "complete", layout.data);
    res.attachment(layout.data === "a4" ? "modele-cartes-a4.pdf" : "modele-carte-85x55.pdf").type("application/pdf").send(pdf);
  });

  app.post(`${cardsPath}/print`, staff, async (req, res) => {
    const form = issueSchema.safeParse(req.body);
    if (!form.success || (form.data.pdf && !form.data.origin)) return res.status(400).json({ message: "Sélection de cartes invalide." });
    const allowed = allowedCheckInTypes(req.session.user!.roles);
    const ids = Array.from(new Set(form.data.ids));
    const { id } = await storage.getSyncConfig();
    const cards = await db.transaction(async tx => {
      const config = await lockedConfig(tx, id);
      const roster = await cardPlayers(tx, ids);
      if (roster.length !== ids.length || roster.some(player => !allowed.some(type => type === player.type))) return null;
      const byId = new Map(roster.map(player => [player.id, player]));
      const ordered = ids.map(participantId => byId.get(participantId)!);
      const names = await tx.select({ id: participants.id, firstName: participants.firstName, lastName: participants.lastName })
        .from(participants).where(isNull(participants.deletedAt));
      const prefixes = cardSurnamePrefixes(names);
      const records = await issueCards(tx, ordered, config);
      return ordered.map(({ id, firstName, type }, index): PrintableCard => {
        const { token, code } = records[index];
        return { id, token, code, firstName, surnamePrefix: prefixes.get(id) ?? "", type };
      });
    });
    if (!cards) return res.status(404).json({ message: "Une fiche est introuvable dans vos listes." });
    if (form.data.pdf && form.data.origin) {
      const pdf = await renderParticipantCards(cards, form.data.origin, form.data.pdf, form.data.layout);
      return res.attachment(`cartes-${form.data.pdf}-${form.data.layout === "a4" ? "a4" : "85x55"}.pdf`).type("application/pdf").send(pdf);
    }
    res.json(cards);
  });

  app.patch(`${cardsPath}/:id/photo`, staff, checkSyncPermissions, async (req, res) => {
    const id = Number(req.params.id);
    const form = photoSchema.safeParse(req.body);
    if (!Number.isSafeInteger(id) || id <= 0 || !form.success) return res.status(400).json({ message: "Photo invalide." });
    const { photo, ownerId, identity } = form.data;
    if ((ownerId !== undefined || identity !== undefined) && (ownerId !== req.session.user!.id || !identity)) {
      return res.status(403).json({ message: "Reconnectez-vous avec le compte qui a préparé la liste." });
    }
    if (photo !== null) {
      const raw = Buffer.from(photo, "base64");
      if (raw.length > photoMaxBytes || raw.length < 4 || raw[0] !== 255 || raw[1] !== 216 ||
        raw[raw.length - 2] !== 255 || raw[raw.length - 1] !== 217 || raw.toString("base64") !== photo) {
        return res.status(400).json({ message: "Fichier JPEG invalide." });
      }
    }
    const allowed = allowedCheckInTypes(req.session.user!.roles);
    const { id: configId } = await storage.getSyncConfig();
    const status = await db.transaction(async tx => {
      const config = await lockedConfig(tx, configId);
      const [player] = await cardPlayers(tx, [id]);
      if (!player || !allowed.some(type => type === player.type)) return 404;
      if (identity && identity !== offlinePlayerIdentity(player)) return 409;
      const [card] = await issueCards(tx, [player], config);
      if (card.expiresAt && card.expiresAt <= new Date()) return 410;
      const [updated] = await tx.update(participantCards).set(photo === null ? { photo: null, photoRemovedAt: new Date() } : { photo }).where(and(
        eq(participantCards.id, card.id),
        photo !== null ? isNull(participantCards.photoRemovedAt) : undefined,
      )).returning({ id: participantCards.id });
      return updated ? 204 : 422;
    });
    if (status === 409) return res.status(status).json({ message: "La fiche a changé. Vérifiez l’identité avant d’envoyer la photo." });
    if (status === 422) return res.status(status).json({ message: "Le participant a demandé le retrait de sa photo." });
    res.sendStatus(status);
  });

  app.post(`${cardsPath}/open/:token`, unlockLimit, async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code.replace(/[\s-]/g, "").toUpperCase() : "";
    const card = await getCard(req.params.token);
    if (!card || !/^[A-Z2-9]{10}$/.test(code) || !timingSafeEqual(Buffer.from(code), Buffer.from(card.code))) {
      return res.status(401).json({ message: "Code d’accès ou carte incorrect." });
    }
    if (card.expiresAt && card.expiresAt <= new Date()) return res.status(410).json({ message: "Cet espace souvenir a expiré." });
    // Create a fresh visitor session. A signed-in volunteer keeps their staff session.
    if (!req.session.user) await new Promise<void>((resolve, reject) =>
      req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.souvenirToken = card.token;
    req.session.souvenirRemembered = req.body?.remember === true;
    if (req.session.souvenirRemembered && !req.session.user) {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      req.session.cookie.maxAge = card.expiresAt ? Math.min(thirtyDays, card.expiresAt.getTime() - Date.now()) : thirtyDays;
    }
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    res.sendStatus(204);
  });

  app.get([`${cardsPath}/admin/:id`, `${cardsPath}/admin/:id/photo`], requireRole("admin"), async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.sendStatus(404);
    const [player] = await db.transaction(tx => cardPlayers(tx, [id.data]));
    if (!player) return res.sendStatus(404);
    const [card] = await db.select().from(participantCards).where(eq(participantCards.identity, identityOf(player)));
    const config = await storage.getSyncConfig();
    const expiresAt = card?.expiresAt ?? (config.eventClosedAt ? souvenirExpiry(config.eventClosedAt) : null);
    if (expiresAt && expiresAt <= new Date()) return res.status(410).json({ message: "Cet espace souvenir a expiré." });
    if (req.path.endsWith("/photo")) {
      if (!card?.photo) return res.sendStatus(404);
      return res.type("image/jpeg").send(Buffer.from(card.photo, "base64"));
    }
    const summary = card?.expiresAt ? await completeArchivedSummary(card, config) : recap(player, config.eventDay);
    const highlights = summary.highlights ?? (!card?.expiresAt ? await db.transaction(tx => eventHighlights(tx, config)) : undefined);
    return res.json({ ...summary, highlights, expiresAt: expiresAt?.toISOString() ?? null, photoAvailable: Boolean(card?.photo) });
  });

  app.get([`${cardsPath}/view/:token`, `${cardsPath}/view/:token/photo`], async (req, res) => {
    if (!req.session.souvenirToken || req.session.souvenirToken !== req.params.token ||
        (req.query.resume === "1" && !req.session.souvenirRemembered)) return res.sendStatus(401);
    const card = await getCard(req.params.token);
    if (!card || (card.expiresAt && card.expiresAt <= new Date())) {
      return res.status(410).json({ message: "Cet espace souvenir a expiré." });
    }
    if (req.path.endsWith("/photo")) {
      if (!card.photo) return res.sendStatus(404);
      return res.type("image/jpeg").send(Buffer.from(card.photo, "base64"));
    }
    let summary;
    if (card.expiresAt) {
      summary = await completeArchivedSummary(card);
    } else {
      const [player] = await db.transaction(tx => cardPlayers(tx, [card.participantId]));
      if (!player || identityOf(player) !== card.identity) return res.sendStatus(404);
      const config = await storage.getSyncConfig();
      summary = { ...recap(player, config.eventDay), highlights: await db.transaction(tx => eventHighlights(tx, config)) };
    }
    res.json({ ...summary, expiresAt: card.expiresAt?.toISOString() ?? null, photoAvailable: Boolean(card.photo) });
  });

  app.delete(`${cardsPath}/view/:token/photo`, async (req, res) => {
    if (req.session.souvenirToken !== req.params.token) return res.sendStatus(401);
    const [updated] = await db.update(participantCards).set({ photo: null, photoRemovedAt: new Date() })
      .where(and(eq(participantCards.token, req.params.token),
        or(isNull(participantCards.expiresAt), sql`${participantCards.expiresAt} > now()`)))
      .returning({ id: participantCards.id });
    return res.sendStatus(updated ? 204 : 410);
  });

  app.delete(`${cardsPath}/view/:token`, async (req, res) => {
    if (req.session.souvenirToken !== req.params.token) return res.sendStatus(401);
    const { id } = await storage.getSyncConfig();
    const status = await db.transaction(async tx => {
      await lockedConfig(tx, id);
      const [card] = await tx.select({ id: participantCards.id, token: participantCards.token,
        identity: participantCards.identity, participantId: participantCards.participantId, expiresAt: participantCards.expiresAt })
        .from(participantCards).where(eq(participantCards.token, req.params.token)).for("update");
      if (!card) return 404;
      if (!card.expiresAt) return 409;
      await eraseParticipantCard(tx, card);
      return 204;
    });
    if (status === 409) return res.status(409).json({ message: "La suppression complète est disponible après la clôture de l’événement." });
    if (status === 204) {
      delete req.session.souvenirToken;
      delete req.session.souvenirRemembered;
      delete req.session.visitor;
    }
    return res.sendStatus(status);
  });

  app.delete(`${cardsPath}/open/:token`, (req, res) => {
    if (req.session.souvenirToken === req.params.token) {
      delete req.session.souvenirToken;
      delete req.session.souvenirRemembered;
    }
    res.sendStatus(204);
  });
}
