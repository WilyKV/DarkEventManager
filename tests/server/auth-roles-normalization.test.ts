/**
 * Tests TDD — Phase Rouge — MOD-6 : Normalisation des `roles` dans les réponses d'auth
 *
 * CONTRAT CIBLE (pas encore implémenté) :
 *   - POST /api/auth/login doit renvoyer `user.roles` en `string[]` (tableau JS),
 *     PAS la string JSON brute stockée en DB (ex: `'["admin","staff_zombie"]'`).
 *   - GET /api/auth/session doit renvoyer `user.roles` en `string[]`, cohérent
 *     avec le login.
 *
 * SITUATION ACTUELLE (bug que ces tests capturent) :
 *   Dans server/auth-routes.ts, la réponse JSON du login fait :
 *     res.json({ user: { id: user.id, username: user.username, roles: user.roles } })
 *   où `user.roles` est la string brute issue de la DB (`'["admin"]'`).
 *   La session, elle, stocke bien un `string[]` parsé (ligne 108), mais
 *   la réponse HTTP renvoie la string non parsée — incohérence.
 *
 * POURQUOI CES TESTS ÉCHOUENT EN L'ÉTAT :
 *   - `Array.isArray(res.body.user.roles)` → false  (c'est une string)
 *   - `res.body.user.roles` deep-equals `["admin","staff_zombie"]` → false
 *   - La session renvoie `string[]` (parsé) mais le login renvoie string brute
 *
 * CORRECTION ATTENDUE (implémentée par le developer en phase verte) :
 *   Remplacer dans la réponse du login :
 *     roles: user.roles          // string brute
 *   par :
 *     roles: parsedRoles         // string[] déjà calculé ligne 104
 *
 * Strategy : même mock DB/password-hashing que auth-routes-bcrypt-migration.test.ts.
 * On utilise supertest + express-session en mémoire, sans vraie base.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";

// ---------------------------------------------------------------------------
// Mocks — db et password-hashing (identiques au fichier bcrypt-migration)
// ---------------------------------------------------------------------------

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();

vi.mock("../../server/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
}));

const mockHashPassword = vi.fn();
const mockVerifyPassword = vi.fn();
const mockIsLegacyHash = vi.fn();
const mockIsBcryptHash = vi.fn();

vi.mock("../../server/password-hashing", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
  isLegacyHash: mockIsLegacyHash,
  isBcryptHash: mockIsBcryptHash,
}));

// Mock storage pour éviter l'appel audit log
vi.mock("../../server/storage", () => ({
  storage: {
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Helpers DB — fluent builder drizzle simulé
// ---------------------------------------------------------------------------

function setupSelectReturning(rows: object[]) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
      limit: vi.fn().mockResolvedValue(rows),
    }),
  });
}

function setupUpdateCapture() {
  const captured: Array<{ set: object }> = [];
  mockDbUpdate.mockReturnValue({
    set: vi.fn((data: object) => {
      const entry = { set: data };
      captured.push(entry);
      return {
        where: vi.fn(() => Promise.resolve([])),
      };
    }),
  });
  return captured;
}

// ---------------------------------------------------------------------------
// Factory — Express app avec auth-routes montées
// ---------------------------------------------------------------------------

async function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret-mod6",
      resave: false,
      saveUninitialized: false,
    })
  );
  const { registerAuthRoutes } = await import("../../server/auth-routes");
  registerAuthRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// 1. POST /api/auth/login — roles doit être un tableau JS, pas une string JSON
// ---------------------------------------------------------------------------

describe("POST /api/auth/login — normalisation des roles (MOD-6)", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildTestApp();
  });

  it("should return roles as string[] when DB stores roles as JSON string", async () => {
    // Arrange
    const userInDb = {
      id: 1,
      username: "alice",
      passwordHash: "$2b$12$FakeBcryptHashForAliceXXXXXXXXXXXXXXXXXXXXXXXXXX",
      roles: '["admin","staff_zombie"]', // string JSON brute en DB
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    setupUpdateCapture();
    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(false);

    // Act
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice", password: "bonPassword" });

    // Assert — contrat cible MOD-6
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("user");

    // ÉCHOUE AUJOURD'HUI : roles est la string brute '["admin","staff_zombie"]'
    expect(Array.isArray(res.body.user.roles)).toBe(true);
  });

  it("should return roles deep-equal to parsed array, not raw JSON string", async () => {
    // Arrange
    const userInDb = {
      id: 1,
      username: "alice",
      passwordHash: "$2b$12$FakeBcryptHashForAliceXXXXXXXXXXXXXXXXXXXXXXXXXX",
      roles: '["admin","staff_zombie"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    setupUpdateCapture();
    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(false);

    // Act
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice", password: "bonPassword" });

    // Assert
    expect(res.status).toBe(200);

    // ÉCHOUE AUJOURD'HUI : res.body.user.roles === '["admin","staff_zombie"]' (string)
    expect(res.body.user.roles).toEqual(["admin", "staff_zombie"]);
  });

  it("should NOT return roles as a JSON string (typeof !== string)", async () => {
    // Arrange
    const userInDb = {
      id: 2,
      username: "bob",
      passwordHash: "$2b$12$FakeBcryptHashForBobXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      roles: '["staff_repas"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    setupUpdateCapture();
    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(false);

    // Act
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "bob", password: "bonPassword" });

    // Assert
    expect(res.status).toBe(200);

    // ÉCHOUE AUJOURD'HUI : typeof res.body.user.roles === 'string'
    expect(typeof res.body.user.roles).not.toBe("string");
  });

  it("should return an empty array when roles is empty JSON string '[]'", async () => {
    // Arrange
    const userInDb = {
      id: 3,
      username: "charlie",
      passwordHash: "$2b$12$FakeBcryptHashForCharlieXXXXXXXXXXXXXXXXXXXXXXXX",
      roles: "[]", // roles vide
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    setupUpdateCapture();
    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(false);

    // Act
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "charlie", password: "bonPassword" });

    // Assert
    expect(res.status).toBe(200);

    // ÉCHOUE AUJOURD'HUI : res.body.user.roles === '[]' (string), pas []
    expect(res.body.user.roles).toEqual([]);
    expect(Array.isArray(res.body.user.roles)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. GET /api/auth/session — roles doit aussi être un string[] cohérent
// ---------------------------------------------------------------------------

describe("GET /api/auth/session — roles normalisés cohérents avec login (MOD-6)", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildTestApp();
  });

  /**
   * Ce test fait un login puis lit la session sur le même agent HTTP (cookie).
   * Le login stocke parsedRoles (string[]) dans req.session.user.
   * GET /api/auth/session renvoie req.session.user directement → roles est string[].
   * Ce test PASSE aujourd'hui pour la session mais est couplé au login.
   * Il est ici pour verrouiller la cohérence : si quelqu'un change la session
   * pour y stocker la string brute, ce test cassera.
   */
  it("should return roles as string[] from session after successful login", async () => {
    // Arrange
    const userInDb = {
      id: 1,
      username: "alice",
      passwordHash: "$2b$12$FakeBcryptHashForAliceXXXXXXXXXXXXXXXXXXXXXXXXXX",
      roles: '["admin","staff_zombie"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    setupUpdateCapture();
    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(false);

    // Act — login pour obtenir le cookie de session
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice", password: "bonPassword" });

    expect(loginRes.status).toBe(200);

    // Récupérer le cookie de session
    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    // Act — GET /api/auth/session avec le cookie
    const sessionRes = await request(app)
      .get("/api/auth/session")
      .set("Cookie", Array.isArray(cookies) ? cookies.join("; ") : cookies);

    // Assert — la session renvoie roles en string[]
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body).toHaveProperty("user");

    // Ce test PASSE aujourd'hui (session stocke déjà string[])
    // mais vérifie la cohérence post-MOD-6
    expect(Array.isArray(sessionRes.body.user.roles)).toBe(true);
    expect(sessionRes.body.user.roles).toEqual(["admin", "staff_zombie"]);
  });

  it("should return roles as string[] and login response roles must match session roles", async () => {
    // Arrange
    const userInDb = {
      id: 1,
      username: "alice",
      passwordHash: "$2b$12$FakeBcryptHashForAliceXXXXXXXXXXXXXXXXXXXXXXXXXX",
      roles: '["admin","staff_zombie"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    setupUpdateCapture();
    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(false);

    // Act — login
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice", password: "bonPassword" });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"];

    // Act — session
    const sessionRes = await request(app)
      .get("/api/auth/session")
      .set("Cookie", Array.isArray(cookies) ? cookies.join("; ") : cookies);

    expect(sessionRes.status).toBe(200);

    // Assert — ÉCHOUE AUJOURD'HUI car loginRes.body.user.roles est string
    // et sessionRes.body.user.roles est string[] → ils diffèrent
    expect(loginRes.body.user.roles).toEqual(sessionRes.body.user.roles);
    expect(Array.isArray(loginRes.body.user.roles)).toBe(true);
    expect(Array.isArray(sessionRes.body.user.roles)).toBe(true);
  });
});
