/**
 * Tests TDD — Red Phase
 *
 * SEC-AUTH Vague 2.5 — Fichier 2 : rate-limit-login.test.ts
 *
 * Vérifie que les endpoints de login sont protégés contre le brute-force :
 * - POST /api/auth/login-visitor : 10 tentatives/15 min par IP → 429
 * - POST /api/auth/login          : 5 tentatives/15 min par IP+username → 429
 * - Pas d'énumération : les deux cas d'erreur visitor retournent le MÊME corps
 *
 * Ces tests échouent sur le code actuel (aucun rate-limiting) et passeront
 * une fois express-rate-limit (ou équivalent) configuré sur ces routes.
 *
 * Dépendance à installer : express-rate-limit
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock de la DB — on ne touche pas Postgres dans ces tests
// ---------------------------------------------------------------------------

vi.mock("../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]), // par défaut : aucun utilisateur/participant trouvé
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

// Mock session-logger pour éviter les appels console parasites
vi.mock("../../server/session-logger", () => ({
  sessionLogger: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper : construit une mini-app Express qui monte UNIQUEMENT les routes auth
// On isole le test de tous les autres middlewares/routes
// ---------------------------------------------------------------------------

async function buildAuthApp(): Promise<Express> {
  const { registerAuthRoutes } = await import("../../server/auth-routes");

  const app = express();
  app.use(express.json());

  // Middleware de session factice (login-visitor utilise req.session.regenerate + save)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      regenerate: (cb: (err: any) => void) => cb(null),
      save: (cb: (err: any) => void) => cb(null),
      destroy: (cb: (err: any) => void) => cb(null),
    };
    next();
  });

  registerAuthRoutes(app);
  return app;
}

/**
 * Effectue `count` requêtes POST successives vers `endpoint` avec `body`.
 * Retourne le tableau des statuts HTTP obtenus.
 */
async function repeatPost(
  app: Express,
  endpoint: string,
  body: Record<string, string>,
  count: number,
  ip = "10.0.0.1",
): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app)
      .post(endpoint)
      .set("X-Forwarded-For", ip)
      .send(body);
    statuses.push(res.status);
  }
  return statuses;
}

// ---------------------------------------------------------------------------
// Suite : visitor login brute-force
// ---------------------------------------------------------------------------

describe("rate-limit — POST /api/auth/login-visitor", () => {

  let app: Express;

  beforeEach(async () => {
    vi.useFakeTimers();
    app = await buildAuthApp();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("doit retourner 401 pour les 10 premières tentatives échouées", async () => {
    // Arrange — DB retourne aucun participant (code invalide)
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([]);

    // Act
    const statuses = await repeatPost(
      app,
      "/api/auth/login-visitor",
      { secretCode: "00000", firstLetterLastName: "X" },
      10,
      "10.0.0.1",
    );

    // Assert — les 10 premières doivent être des 401 (ou 400 pour Zod), jamais 429
    const tooManyRequests = statuses.filter(s => s === 429);
    expect(tooManyRequests).toHaveLength(0);
  });

  it("doit retourner 429 à la 11e tentative échouée depuis la même IP", async () => {
    // Arrange
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([]);

    // Act — 10 tentatives échouées
    await repeatPost(
      app,
      "/api/auth/login-visitor",
      { secretCode: "00000", firstLetterLastName: "X" },
      10,
      "10.0.0.1",
    );

    // 11e tentative
    const response = await request(app)
      .post("/api/auth/login-visitor")
      .set("X-Forwarded-For", "10.0.0.1")
      .send({ secretCode: "00000", firstLetterLastName: "X" });

    // Assert
    expect(response.status).toBe(429);
  });

  it("doit inclure un message explicite dans la réponse 429", async () => {
    // Arrange
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([]);

    // Act — déclenche le rate-limit
    await repeatPost(
      app,
      "/api/auth/login-visitor",
      { secretCode: "00000", firstLetterLastName: "X" },
      10,
      "10.0.0.2",
    );

    const response = await request(app)
      .post("/api/auth/login-visitor")
      .set("X-Forwarded-For", "10.0.0.2")
      .send({ secretCode: "00000", firstLetterLastName: "X" });

    // Assert — la réponse doit contenir un message (pas un corps vide)
    expect(response.status).toBe(429);
    expect(response.body).toBeDefined();
    // Le message doit mentionner "trop" ou "rate" ou "réessayez" etc.
    const bodyStr = JSON.stringify(response.body).toLowerCase();
    const hasRelevantMessage =
      bodyStr.includes("trop") ||
      bodyStr.includes("rate") ||
      bodyStr.includes("essai") ||
      bodyStr.includes("limit") ||
      bodyStr.includes("bloqué");
    expect(hasRelevantMessage).toBe(true);
  });

  it("ne doit pas bloquer une IP différente quand une autre IP est rate-limitée", async () => {
    // Arrange
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([]);

    // Act — IP A dépasse la limite
    await repeatPost(
      app,
      "/api/auth/login-visitor",
      { secretCode: "00000", firstLetterLastName: "X" },
      11,
      "192.168.1.1",
    );

    // IP B — première tentative seulement
    const responseIpB = await request(app)
      .post("/api/auth/login-visitor")
      .set("X-Forwarded-For", "192.168.1.2")
      .send({ secretCode: "00000", firstLetterLastName: "X" });

    // Assert — IP B ne doit pas être bloquée (401 = credential error, pas 429)
    expect(responseIpB.status).not.toBe(429);
  });

  it("doit réinitialiser le compteur après la fenêtre de 15 minutes", async () => {
    // Arrange
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([]);
    const IP = "10.1.1.1";

    // Act — déclenche le rate-limit
    await repeatPost(
      app,
      "/api/auth/login-visitor",
      { secretCode: "00000", firstLetterLastName: "X" },
      11,
      IP,
    );

    // Avance le temps de 16 minutes
    vi.advanceTimersByTime(16 * 60 * 1000);

    // Après reset de la fenêtre, une nouvelle tentative ne doit plus retourner 429
    const response = await request(app)
      .post("/api/auth/login-visitor")
      .set("X-Forwarded-For", IP)
      .send({ secretCode: "00000", firstLetterLastName: "X" });

    // Assert — doit être 401 (erreur credential) et non 429
    expect(response.status).not.toBe(429);
  });

  // -------------------------------------------------------------------------
  // Anti-énumération : les deux scénarios d'échec doivent retourner
  // le MÊME corps de réponse pour ne pas révéler si le code existe
  // -------------------------------------------------------------------------

  it("doit retourner le même corps pour 'code inexistant' et 'initiale incorrecte'", async () => {
    // Arrange
    const { db } = await import("../../server/db");

    // Scénario 1 : code invalide (aucun participant trouvé)
    (db.limit as any).mockResolvedValue([]);
    const responseCodeInvalide = await request(app)
      .post("/api/auth/login-visitor")
      .send({ secretCode: "00000", firstLetterLastName: "Z" });

    // Scénario 2 : code valide mais initiale incorrecte
    (db.limit as any).mockResolvedValue([
      {
        id: 1,
        secretCode: "11111",
        firstName: "Alice",
        lastName: "Dupont",
        type: "zombie",
      },
    ]);
    const responseInitialeInvalide = await request(app)
      .post("/api/auth/login-visitor")
      .send({ secretCode: "11111", firstLetterLastName: "X" }); // X != D

    // Assert — même statut HTTP
    expect(responseCodeInvalide.status).toBe(401);
    expect(responseInitialeInvalide.status).toBe(401);

    // Assert — même corps JSON (anti-énumération)
    // Le message doit être IDENTIQUE pour ne pas révéler si le code existe
    expect(responseCodeInvalide.body.message).toBe(responseInitialeInvalide.body.message);
  });

  it("doit retourner 200 quand le code et l'initiale sont corrects (non bloqué)", async () => {
    // Arrange
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([
      {
        id: 1,
        secretCode: "12345",
        firstName: "Bob",
        lastName: "Martin",
        type: "survivant",
      },
    ]);

    // Act
    const response = await request(app)
      .post("/api/auth/login-visitor")
      .send({ secretCode: "12345", firstLetterLastName: "M" });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.participant).toBeDefined();
  });

});

// ---------------------------------------------------------------------------
// Suite : staff login brute-force
// ---------------------------------------------------------------------------

describe("rate-limit — POST /api/auth/login", () => {

  let app: Express;

  beforeEach(async () => {
    vi.useFakeTimers();
    app = await buildAuthApp();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("doit retourner 401 pour les 5 premières tentatives échouées", async () => {
    // Arrange — aucun utilisateur trouvé
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([]);

    // Act
    const statuses = await repeatPost(
      app,
      "/api/auth/login",
      { username: "admin", password: "mauvais" },
      5,
      "10.0.0.10",
    );

    // Assert — pas de 429 dans les 5 premières
    expect(statuses.filter(s => s === 429)).toHaveLength(0);
  });

  it("doit retourner 429 à la 6e tentative échouée (même IP + même username)", async () => {
    // Arrange
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([]);

    // Act — 5 tentatives échouées
    await repeatPost(
      app,
      "/api/auth/login",
      { username: "admin", password: "mauvais" },
      5,
      "10.0.0.10",
    );

    // 6e tentative
    const response = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.0.10")
      .send({ username: "admin", password: "mauvais" });

    // Assert
    expect(response.status).toBe(429);
  });

  it("ne doit pas bloquer une IP différente qui tente le même username", async () => {
    // Arrange
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([]);

    // Act — IP A dépasse la limite
    await repeatPost(
      app,
      "/api/auth/login",
      { username: "admin", password: "mauvais" },
      6,
      "10.0.0.20",
    );

    // IP B, même username, première tentative
    const responseIpB = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.0.21")
      .send({ username: "admin", password: "mauvais" });

    // Assert — IP B non bloquée
    expect(responseIpB.status).not.toBe(429);
  });

  it("doit réinitialiser le compteur staff après la fenêtre de 15 minutes", async () => {
    // Arrange
    const { db } = await import("../../server/db");
    (db.limit as any).mockResolvedValue([]);
    const IP = "10.2.2.2";

    // Act — déclenche le rate-limit
    await repeatPost(
      app,
      "/api/auth/login",
      { username: "admin", password: "mauvais" },
      6,
      IP,
    );

    // Avance de 16 minutes
    vi.advanceTimersByTime(16 * 60 * 1000);

    const response = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", IP)
      .send({ username: "admin", password: "mauvais" });

    // Assert — plus de 429 après reset
    expect(response.status).not.toBe(429);
  });

});
