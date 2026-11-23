import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { appConfig, participantCards, participants, squads, timeSlots } from "@shared/schema";
import { cardSurnamePrefixes, cardsPath, photoMaxBytes, souvenirExpiry, type PrintableCard, type SouvenirSummary } from "@shared/participant-card";
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

async function cardPlayers(tx: Transaction, ids?: number[]) {
  return tx.select({
    id: participants.id, createdAt: participants.createdAt, firstName: participants.firstName,
    lastName: participants.lastName, type: participants.type, wave: timeSlots.name, squad: squads.number, squadBriefing: squads.briefing,
  }).from(participants).leftJoin(timeSlots, eq(timeSlots.id, participants.timeSlotId))
    .leftJoin(squads, eq(squads.id, participants.squadId))
    .where(and(isNull(participants.deletedAt), ids && inArray(participants.id, ids)));
}

type CardPlayer = Awaited<ReturnType<typeof cardPlayers>>[number];

function identityOf(player: Pick<CardPlayer, "id" | "createdAt">) {
  return createHash("sha256").update(JSON.stringify([player.id, player.createdAt])).digest("hex");
}

function recap(player: CardPlayer, eventDay: string | null): SouvenirSummary {
  const { firstName, lastName, type, wave, squad, squadBriefing } = player;
  return { firstName, lastName, type, wave, squad, squadBriefing, eventDay };
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
  const missing = players.flatMap(player => {
    const identity = identityOf(player);
    if (byIdentity.has(identity)) return [];
    return [{
      identity, participantId: player.id, summary: recap(player, config.eventDay),
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
    const roster = await cardPlayers(tx);
    const issued = await tx.select({ id: participantCards.id, identity: participantCards.identity })
      .from(participantCards).where(isNull(participantCards.expiresAt));
    const byIdentity = new Map(roster.map(player => [identityOf(player), player]));
    for (const card of issued) {
      const player = byIdentity.get(card.identity);
      if (player) await tx.update(participantCards).set({ expiresAt, summary: recap(player, config.eventDay) })
        .where(eq(participantCards.id, card.id));
    }
    await tx.update(appConfig).set({ eventClosedAt: closedAt }).where(eq(appConfig.id, id));
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

  app.get(`${cardsPath}/template`, staff, async (_req, res) => {
    const pdf = await renderParticipantCards([], "https://example.invalid", "complete");
    res.attachment("modele-carte-85x55.pdf").type("application/pdf").send(pdf);
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
      const pdf = await renderParticipantCards(cards, form.data.origin, form.data.pdf);
      return res.attachment(`cartes-${form.data.pdf}-85x55.pdf`).type("application/pdf").send(pdf);
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
      await tx.update(participantCards).set({ photo }).where(eq(participantCards.id, card.id));
      return 204;
    });
    if (status === 409) return res.status(status).json({ message: "La fiche a changé. Vérifiez l’identité avant d’envoyer la photo." });
    res.sendStatus(status);
  });

  app.post(`${cardsPath}/open/:token`, unlockLimit, async (req, res) => {
    const code = typeof req.body?.code === "string" ? req.body.code.replace(/[ -]/g, "").toUpperCase() : "";
    const card = await getCard(req.params.token);
    if (!card || !/^[A-Z2-9]{10}$/.test(code) || !timingSafeEqual(Buffer.from(code), Buffer.from(card.code))) {
      return res.status(401).json({ message: "Code d’accès ou carte incorrect." });
    }
    if (card.expiresAt && card.expiresAt <= new Date()) return res.status(410).json({ message: "Cet espace souvenir a expiré." });
    // Create a fresh visitor session. A signed-in volunteer keeps their staff session.
    if (!req.session.user) await new Promise<void>((resolve, reject) =>
      req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.souvenirToken = card.token;
    await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    res.sendStatus(204);
  });

  app.get([`${cardsPath}/view/:token`, `${cardsPath}/view/:token/photo`], async (req, res) => {
    if (!req.session.souvenirToken || req.session.souvenirToken !== req.params.token) return res.sendStatus(401);
    const card = await getCard(req.params.token);
    if (!card || (card.expiresAt && card.expiresAt <= new Date())) {
      return res.status(410).json({ message: "Cet espace souvenir a expiré." });
    }
    let summary = card.summary;
    if (!card.expiresAt) {
      const [player] = await db.transaction(tx => cardPlayers(tx, [card.participantId]));
      if (!player || identityOf(player) !== card.identity) return res.sendStatus(404);
      const config = await storage.getSyncConfig();
      summary = recap(player, config.eventDay);
    }
    if (req.path.endsWith("/photo")) {
      if (!card.photo) return res.sendStatus(404);
      return res.type("image/jpeg").send(Buffer.from(card.photo, "base64"));
    }
    res.json({ ...summary, expiresAt: card.expiresAt?.toISOString() ?? null, photoAvailable: Boolean(card.photo) });
  });

  app.delete(`${cardsPath}/open/:token`, (req, res) => {
    if (req.session.souvenirToken === req.params.token) delete req.session.souvenirToken;
    res.sendStatus(204);
  });
}
