import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { and, count, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { appConfig, auditLogs, discounts, mealDiscounts, mealItems, mealPurchases, participantCards, participants, purchases, serverEvents, sessions, squadAuditLog, squads, timeSlots } from "@shared/schema";
import { cardPrintLayouts, cardSurnamePrefixes, cardsPath, photoMaxBytes, souvenirErasureRequestsPath, souvenirExpiry, souvenirSettingsPath, type PrintableCard, type SouvenirAttendance, type SouvenirHighlights, type SouvenirSettings, type SouvenirSummary } from "@shared/participant-card";
import { freeMealPath, staffCardPath, tokenFromCardQr, type StaffCardScan } from "@shared/card-scan";
import { checkInRoles } from "@shared/check-in";
import { db } from "./db";
import { storage } from "./storage";
import { hasSessionRole, requireRole } from "./auth-middleware";
import { allowedCheckInTypes } from "./check-in-routes";
import { checkSyncPermissions } from "./sync-middleware";
import { printModes, renderParticipantCards } from "./participant-card-pdf";
import { offlinePlayerIdentity } from "./zombie-offline-routes";

const tokenPattern = /^[A-Za-z0-9_-]{27}$/;
const codeCharacters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateCardCode() {
  return Array.from({ length: 10 }, () => codeCharacters[randomInt(codeCharacters.length)]).join("");
}

function codeProof(card: Pick<typeof participantCards.$inferSelect, "token" | "code">) {
  return createHash("sha256").update(JSON.stringify([card.token, card.code])).digest("hex");
}

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
    arrivedAt: participants.arrivedAt, briefingTime: timeSlots.briefingTime, gameStart: timeSlots.gameTime, gameEnd: timeSlots.exitTime, squadSize: squadCounts.total,
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
      code: generateCardCode(),
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

function staffCardDetails(player: Pick<typeof participants.$inferSelect,
  "id" | "type" | "firstName" | "lastName" | "freeMealClaimed" | "arrived" | "arrivedAt" | "returned" | "returnedAt">,
  roles: unknown): StaffCardScan {
  const { id, type, firstName, lastName, freeMealClaimed } = player;
  return {
    participant: { id, type, firstName, lastName, freeMealClaimed },
    presence: player.returned || player.returnedAt ? "departed" : player.arrived || player.arrivedAt ? "present" : "expected",
    canManagePresence: hasSessionRole(roles, ["admin"]) ||
      ((type === "zombie" || type === "survivant") && hasSessionRole(roles, [`staff_${type}`])),
    canServeMeals: hasSessionRole(roles, ["admin", "staff_repas"]),
    canSell: hasSessionRole(roles, ["admin", "staff_boutique"]),
  };
}

async function activeCardParticipant(token: string) {
  const card = await getCard(token);
  if (!card || (card.expiresAt && card.expiresAt <= new Date())) return undefined;
  const participant = await storage.getParticipant(card.participantId);
  return participant && identityOf(participant) === card.identity ? participant : undefined;
}

export async function participantFromCardQR(payload: string, roles: unknown) {
  const token = tokenFromCardQr(payload);
  const participant = token && await activeCardParticipant(token);
  if (!participant) return undefined;
  const scan = staffCardDetails(participant, roles);
  return scan.canManagePresence || scan.canServeMeals || scan.canSell ? scan.participant : undefined;
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

  const scanStaff = requireRole(...checkInRoles, "staff_repas", "staff_boutique");

  app.get(`${staffCardPath}/:token`, scanStaff, async (req, res) => {
    const player = await activeCardParticipant(req.params.token);
    if (!player) return res.sendStatus(404);
    const scan = staffCardDetails(player, req.session.user!.roles);
    if (!scan.canManagePresence && !scan.canServeMeals && !scan.canSell) return res.sendStatus(403);
    return res.json(scan);
  });

  app.post(`${staffCardPath}/:token/presence`, requireRole(...checkInRoles), checkSyncPermissions, async (req, res) => {
    const action = z.enum(["arrive", "depart"]).safeParse(req.body?.action);
    if (!action.success) return res.status(400).json({ message: "Action d’accueil invalide." });
    const card = await getCard(req.params.token);
    if (!card || (card.expiresAt && card.expiresAt <= new Date())) return res.sendStatus(404);
    const roles = req.session.user!.roles;
    const result = await db.transaction(async tx => {
      const [player] = await tx.select().from(participants)
        .where(and(eq(participants.id, card.participantId), isNull(participants.deletedAt))).for("update");
      if (!player || identityOf(player) !== card.identity) return { status: 404 };
      const scan = staffCardDetails(player, roles);
      if (!scan.canManagePresence) return { status: 403 };
      const arrival = action.data === "arrive";
      if (scan.presence !== (arrival ? "expected" : "present")) {
        return { status: 409, body: { message: "La présence a déjà changé. Vérifiez le nouvel état." } };
      }
      const now = new Date();
      const [saved] = await tx.update(participants)
        .set(arrival ? { arrived: true, arrivedAt: now } : { returned: true, returnedAt: now })
        .where(eq(participants.id, player.id)).returning();
      return { status: 200, body: staffCardDetails(saved, roles) };
    });
    return result.body ? res.status(result.status).json(result.body) : res.sendStatus(result.status);
  });

  app.post(`${freeMealPath}/:id`, requireRole("admin", "staff_repas"), checkSyncPermissions, async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    const meal = z.object({ itemIds: z.array(z.number().int().positive()).min(1).max(2), cardChecked: z.literal(true) }).strict().safeParse(req.body);
    if (!id.success || !meal.success) return res.status(400).json({ message: "Vérifiez la carte physique et la sélection du repas." });
    const result = await db.transaction(async tx => {
      const [player] = await tx.select().from(participants)
        .where(and(eq(participants.id, id.data), isNull(participants.deletedAt))).for("update");
      if (!player || player.type !== "zombie") return { status: 404, message: "Participant introuvable ou sans repas offert." };
      if (player.freeMealClaimed) return { status: 409, message: "Le repas offert a déjà été servi." };
      const items = await tx.select().from(mealItems).where(inArray(mealItems.id, meal.data.itemIds))
        .orderBy(mealItems.id).for("update");
      if (items.length !== meal.data.itemIds.length || new Set(items.map(item => item.category)).size !== items.length ||
          items.some(item => item.stock < 1 || (item.category !== "Plats" && item.category !== "Boissons"))) {
        return { status: 409, message: "Vérifiez les articles et le stock du repas." };
      }
      for (const item of items) {
        await tx.update(mealItems).set({ stock: item.stock - 1 }).where(eq(mealItems.id, item.id));
      }
      await tx.insert(mealPurchases).values(items.map(item => ({
        participantId: player.id, mealItemId: item.id, quantity: 1, unitPrice: "0",
        originalPrice: item.price, discountApplied: 0, totalPrice: "0", isPaid: true,
      })));
      await tx.update(participants).set({ freeMealClaimed: true, hasFreemeal: true }).where(eq(participants.id, player.id));
      return { status: 204 };
    });
    return result.message ? res.status(result.status).json({ message: result.message }) : res.sendStatus(result.status);
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
      return ordered.map(({ id, firstName, type, squad, briefingTime }, index): PrintableCard => {
        const { token, code } = records[index];
        return { id, token, code, firstName, surnamePrefix: prefixes.get(id) ?? "", type, squad, briefingTime };
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

  app.post(`${cardsPath}/admin/:id/regenerate-code`, requireRole("admin"), checkSyncPermissions, async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.sendStatus(404);
    const config = await storage.getSyncConfig();
    const result = await db.transaction(async tx => {
      await lockedConfig(tx, config.id);
      const [player] = await cardPlayers(tx, [id.data]);
      if (!player) return { status: 404 };
      const [card] = await tx.select({ id: participantCards.id, code: participantCards.code, expiresAt: participantCards.expiresAt })
        .from(participantCards).where(eq(participantCards.identity, identityOf(player))).for("update");
      if (!card) return { status: 404 };
      if (card.expiresAt && card.expiresAt <= new Date()) return { status: 410 };
      let code = generateCardCode();
      while (code === card.code) code = generateCardCode();
      await tx.update(participantCards).set({ code }).where(eq(participantCards.id, card.id));
      return { status: 200, code };
    });
    return result.code ? res.json({ code: result.code }) : res.sendStatus(result.status);
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
    req.session.souvenirCodeProof = codeProof(card);
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
    if (req.session.souvenirCodeProof !== codeProof(card)) return res.sendStatus(401);
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
    res.json({ ...summary, expiresAt: card.expiresAt?.toISOString() ?? null, photoAvailable: Boolean(card.photo), erasureRequestedAt: card.erasureRequestedAt?.toISOString() ?? null });
  });

  app.delete(`${cardsPath}/view/:token/photo`, async (req, res) => {
    if (req.session.souvenirToken !== req.params.token) return res.sendStatus(401);
    const card = await getCard(req.params.token);
    if (!card || req.session.souvenirCodeProof !== codeProof(card)) return res.sendStatus(401);
    const [updated] = await db.update(participantCards).set({ photo: null, photoRemovedAt: new Date() })
      .where(and(eq(participantCards.id, card.id), eq(participantCards.code, card.code),
        or(isNull(participantCards.expiresAt), sql`${participantCards.expiresAt} > now()`)))
      .returning({ id: participantCards.id });
    return res.sendStatus(updated ? 204 : 410);
  });

  app.delete(`${cardsPath}/view/:token`, (req, res) => {
    if (req.session.souvenirToken !== req.params.token) return res.sendStatus(401);
    return res.status(405).json({ message: "Rechargez la page pour envoyer une demande d’effacement à l’administrateur." });
  });

  app.post(`${cardsPath}/view/:token/erasure-request`, async (req, res) => {
    if (req.session.souvenirToken !== req.params.token) return res.sendStatus(401);
    const card = await getCard(req.params.token);
    if (!card || req.session.souvenirCodeProof !== codeProof(card)) return res.sendStatus(401);
    const [request] = await db.update(participantCards).set({
      erasureRequestedAt: sql`coalesce(${participantCards.erasureRequestedAt}, now())`,
    }).where(and(eq(participantCards.id, card.id), eq(participantCards.code, card.code), sql`${participantCards.expiresAt} > now()`))
      .returning({ requestedAt: participantCards.erasureRequestedAt });
    if (!request?.requestedAt) return res.status(409).json({ message: "La demande est disponible après la clôture et avant l’expiration de l’espace." });
    return res.json({ requestedAt: request.requestedAt.toISOString() });
  });

  app.get(souvenirErasureRequestsPath, requireRole("admin"), async (_req, res) => {
    const pending = await db.select({ id: participantCards.id, summary: participantCards.summary,
      requestedAt: participantCards.erasureRequestedAt })
      .from(participantCards).where(isNotNull(participantCards.erasureRequestedAt)).orderBy(participantCards.erasureRequestedAt);
    return res.json(pending.map(({ id, summary, requestedAt }) => ({
      id, firstName: summary.firstName, lastName: summary.lastName, requestedAt: requestedAt!.toISOString(),
    })));
  });

  app.delete(`${souvenirErasureRequestsPath}/:id`, requireRole("admin"), checkSyncPermissions, async (req, res) => {
    const cardId = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!cardId.success) return res.sendStatus(404);
    const { id } = await storage.getSyncConfig();
    const deleted = await db.transaction(async tx => {
      await lockedConfig(tx, id);
      const [card] = await tx.select({ id: participantCards.id, token: participantCards.token,
        identity: participantCards.identity, participantId: participantCards.participantId })
        .from(participantCards).where(and(eq(participantCards.id, cardId.data), isNotNull(participantCards.erasureRequestedAt))).for("update");
      if (!card) return false;
      await eraseParticipantCard(tx, card);
      return true;
    });
    return res.sendStatus(deleted ? 204 : 404);
  });

  app.delete(`${cardsPath}/open/:token`, (req, res) => {
    if (req.session.souvenirToken === req.params.token) {
      delete req.session.souvenirToken;
      delete req.session.souvenirCodeProof;
      delete req.session.souvenirRemembered;
    }
    res.sendStatus(204);
  });
}
