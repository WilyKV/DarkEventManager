/**
 * Tests TDD — Red Phase
 *
 * SEC-AUTH Vague 2.5 — Fichier 4 : audit-login-failures.test.ts
 *
 * Vérifie que les événements d'authentification sont tracés dans audit_logs :
 * - Échec staff login  → LOGIN_FAILED, tableName='users', username + IP
 * - Échec visitor login → LOGIN_FAILED, tableName='participants', secretCode prefix (3 chars)
 * - Succès login (staff ou visitor) → LOGIN_SUCCESS avec IP + identité
 *
 * Ces tests échouent sur le code actuel (aucun appel à createAuditLog dans
 * auth-routes.ts) et passeront une fois le logging ajouté.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock storage — on contrôle createAuditLog
// ---------------------------------------------------------------------------

const mockCreateAuditLog = vi.fn().mockResolvedValue({ id: 1 });

vi.mock("../../server/storage", () => ({
  storage: {
    createAuditLog: mockCreateAuditLog,
  },
}));

// ---------------------------------------------------------------------------
// Mock de la DB — contrôlé test par test
// ---------------------------------------------------------------------------

const mockDbSelectLimit = vi.fn();
const mockDbUpdateSet = vi.fn();
const mockDbUpdateWhere = vi.fn();

vi.mock("../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: mockDbSelectLimit,
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnValue({
      where: mockDbUpdateWhere,
    }),
  },
}));

// Mock session-logger
vi.mock("../../server/session-logger", () => ({
  sessionLogger: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildAuthApp(): Promise<Express> {
  const { registerAuthRoutes } = await import("../../server/auth-routes");

  const app = express();
  app.use(express.json());

  // Session factice — supporte regenerate + save
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

/** Retourne le premier appel à createAuditLog correspondant à une action donnée */
function findAuditCall(action: string) {
  return mockCreateAuditLog.mock.calls.find(
    (call: any[]) => call[0]?.action === action
  )?.[0];
}

// ---------------------------------------------------------------------------
// Suite : audit des échecs de login staff
// ---------------------------------------------------------------------------

describe("audit-login-failures — POST /api/auth/login (staff)", () => {

  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildAuthApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("doit créer une entrée audit LOGIN_FAILED quand le mot de passe est incorrect", async () => {
    // Arrange — utilisateur trouvé mais hash incorrect
    mockDbSelectLimit.mockResolvedValue([
      {
        id: 1,
        username: "admin",
        passwordHash: "mauvais_hash",
        roles: '["admin"]',
        lastLoginAt: null,
      },
    ]);

    // Act
    await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.0.1")
      .send({ username: "admin", password: "mauvais_mdp" });

    // Assert — createAuditLog doit avoir été appelé avec LOGIN_FAILED
    expect(mockCreateAuditLog).toHaveBeenCalled();
    const auditCall = findAuditCall("LOGIN_FAILED");
    expect(auditCall).toBeDefined();
    expect(auditCall.action).toBe("LOGIN_FAILED");
    expect(auditCall.tableName).toBe("users");
  });

  it("doit inclure le username dans l'entrée audit LOGIN_FAILED (staff)", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([
      {
        id: 1,
        username: "alice",
        passwordHash: "wrong_hash",
        roles: '["staff_zombie"]',
        lastLoginAt: null,
      },
    ]);

    // Act
    await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.0.5")
      .send({ username: "alice", password: "mauvais" });

    // Assert
    const auditCall = findAuditCall("LOGIN_FAILED");
    expect(auditCall).toBeDefined();
    // Le username doit figurer dans l'entrée (username ou recordData)
    const hasUsername =
      auditCall.username === "alice" ||
      (typeof auditCall.recordData === "string" && auditCall.recordData.includes("alice")) ||
      (typeof auditCall.changes === "string" && auditCall.changes.includes("alice"));
    expect(hasUsername).toBe(true);
  });

  it("doit inclure l'adresse IP dans l'entrée audit LOGIN_FAILED (staff)", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);

    // Act
    await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "172.16.0.42")
      .send({ username: "inconnu", password: "mauvais" });

    // Assert
    const auditCall = findAuditCall("LOGIN_FAILED");
    expect(auditCall).toBeDefined();
    expect(auditCall.ipAddress).toBeDefined();
    // L'IP doit être renseignée (non null, non undefined, non vide)
    expect(auditCall.ipAddress).not.toBeNull();
    expect(String(auditCall.ipAddress).length).toBeGreaterThan(0);
  });

  it("doit créer une entrée audit LOGIN_FAILED quand le username n'existe pas", async () => {
    // Arrange — aucun utilisateur trouvé
    mockDbSelectLimit.mockResolvedValue([]);

    // Act
    await request(app)
      .post("/api/auth/login")
      .send({ username: "inconnu", password: "mauvais" });

    // Assert
    expect(mockCreateAuditLog).toHaveBeenCalled();
    const auditCall = findAuditCall("LOGIN_FAILED");
    expect(auditCall).toBeDefined();
    expect(auditCall.tableName).toBe("users");
  });

  it("doit créer une entrée audit LOGIN_SUCCESS lors d'un login staff réussi", async () => {
    // Arrange — utilisateur avec hash correct de "bon_mdp"
    // SHA-256("bon_mdp") calculé via crypto (on ne peut pas l'importer ici directement,
    // donc on mocke le résultat)
    const correctHash = require("crypto")
      .createHash("sha256")
      .update("bon_mdp")
      .digest("hex");

    mockDbSelectLimit.mockResolvedValue([
      {
        id: 1,
        username: "admin",
        passwordHash: correctHash,
        roles: '["admin"]',
        lastLoginAt: null,
      },
    ]);
    mockDbUpdateWhere.mockResolvedValue([{ id: 1 }]);

    // Act
    await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "10.0.0.7")
      .send({ username: "admin", password: "bon_mdp" });

    // Assert
    expect(mockCreateAuditLog).toHaveBeenCalled();
    const successCall = findAuditCall("LOGIN_SUCCESS");
    expect(successCall).toBeDefined();
    expect(successCall.tableName).toBe("users");
    expect(successCall.ipAddress).toBeDefined();
  });

});

// ---------------------------------------------------------------------------
// Suite : audit des échecs de login visitor
// ---------------------------------------------------------------------------

describe("audit-login-failures — POST /api/auth/login-visitor (visitor)", () => {

  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildAuthApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("doit créer une entrée audit LOGIN_FAILED quand le code secret est invalide", async () => {
    // Arrange — aucun participant trouvé pour ce code
    mockDbSelectLimit.mockResolvedValue([]);

    // Act
    await request(app)
      .post("/api/auth/login-visitor")
      .set("X-Forwarded-For", "10.0.0.2")
      .send({ secretCode: "00000", firstLetterLastName: "X" });

    // Assert
    expect(mockCreateAuditLog).toHaveBeenCalled();
    const auditCall = findAuditCall("LOGIN_FAILED");
    expect(auditCall).toBeDefined();
    expect(auditCall.tableName).toBe("participants");
  });

  it("doit inclure les 3 premiers caractères du secretCode dans l'audit (pas le code complet)", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);

    // Act
    await request(app)
      .post("/api/auth/login-visitor")
      .set("X-Forwarded-For", "10.0.0.3")
      .send({ secretCode: "98765", firstLetterLastName: "A" });

    // Assert — le recordData ou changes doit contenir "987" (3 premiers chars)
    // mais PAS "98765" (code complet) pour limiter l'exposition en cas de fuite de log
    const auditCall = findAuditCall("LOGIN_FAILED");
    expect(auditCall).toBeDefined();

    const serialized = JSON.stringify(auditCall);
    // Le préfixe doit être présent
    expect(serialized).toContain("987");
    // Le code complet ne doit PAS figurer dans les champs loggés exposés
    // (sauf éventuellement dans un champ masqué explicite)
    const fullCodeInNonSensitiveFields =
      (typeof auditCall.recordData === "string" && auditCall.recordData.includes("98765")) ||
      (typeof auditCall.changes === "string" && auditCall.changes.includes("98765")) ||
      (typeof auditCall.username === "string" && auditCall.username.includes("98765"));
    expect(fullCodeInNonSensitiveFields).toBe(false);
  });

  it("doit inclure l'IP dans l'entrée audit LOGIN_FAILED visitor", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);

    // Act
    await request(app)
      .post("/api/auth/login-visitor")
      .set("X-Forwarded-For", "192.168.100.50")
      .send({ secretCode: "11111", firstLetterLastName: "Z" });

    // Assert
    const auditCall = findAuditCall("LOGIN_FAILED");
    expect(auditCall).toBeDefined();
    expect(auditCall.ipAddress).toBeDefined();
    expect(auditCall.ipAddress).not.toBeNull();
    expect(String(auditCall.ipAddress).length).toBeGreaterThan(0);
  });

  it("doit créer une entrée audit LOGIN_FAILED quand l'initiale du nom est incorrecte", async () => {
    // Arrange — participant trouvé, mais initiale incorrecte
    mockDbSelectLimit.mockResolvedValue([
      {
        id: 1,
        secretCode: "22222",
        firstName: "Claire",
        lastName: "Dupont",
        type: "zombie",
      },
    ]);

    // Act — envoie "X" au lieu de "D"
    await request(app)
      .post("/api/auth/login-visitor")
      .send({ secretCode: "22222", firstLetterLastName: "X" });

    // Assert — LOGIN_FAILED doit être tracé même dans ce cas
    expect(mockCreateAuditLog).toHaveBeenCalled();
    const auditCall = findAuditCall("LOGIN_FAILED");
    expect(auditCall).toBeDefined();
    expect(auditCall.tableName).toBe("participants");
  });

  it("doit créer une entrée audit LOGIN_SUCCESS lors d'un login visitor réussi", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([
      {
        id: 42,
        secretCode: "33333",
        firstName: "Eve",
        lastName: "Martin",
        type: "survivant",
      },
    ]);

    // Act — initiale correcte "M"
    await request(app)
      .post("/api/auth/login-visitor")
      .set("X-Forwarded-For", "10.5.5.5")
      .send({ secretCode: "33333", firstLetterLastName: "M" });

    // Assert
    expect(mockCreateAuditLog).toHaveBeenCalled();
    const successCall = findAuditCall("LOGIN_SUCCESS");
    expect(successCall).toBeDefined();
    expect(successCall.tableName).toBe("participants");
    expect(successCall.recordId).toBe(42);
    expect(successCall.ipAddress).toBeDefined();
  });

  it("doit tracer l'action LOGIN_SUCCESS avec l'ID participant dans recordId", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([
      {
        id: 77,
        secretCode: "44444",
        firstName: "Frank",
        lastName: "Zombie",
        type: "zombie",
      },
    ]);

    // Act
    await request(app)
      .post("/api/auth/login-visitor")
      .send({ secretCode: "44444", firstLetterLastName: "Z" });

    // Assert
    const successCall = findAuditCall("LOGIN_SUCCESS");
    expect(successCall).toBeDefined();
    expect(successCall.recordId).toBe(77);
  });

});

// ---------------------------------------------------------------------------
// Suite : non-régression — le logging ne bloque pas l'opération principale
// ---------------------------------------------------------------------------

describe("audit-login-failures — non-régression : échec de logging silencieux", () => {

  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildAuthApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("doit retourner 401 même si createAuditLog lève une exception", async () => {
    // Arrange — le logging échoue
    mockCreateAuditLog.mockRejectedValue(new Error("DB error dans audit"));
    mockDbSelectLimit.mockResolvedValue([]);

    // Act
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "mauvais" });

    // Assert — l'endpoint doit fonctionner normalement malgré l'échec du log
    // (erreur silencieuse, comme createAuditLog dans routes.ts)
    expect(response.status).toBe(401);
  });

  it("doit retourner 401 visitor même si createAuditLog lève une exception", async () => {
    // Arrange
    mockCreateAuditLog.mockRejectedValue(new Error("Audit DB down"));
    mockDbSelectLimit.mockResolvedValue([]);

    // Act
    const response = await request(app)
      .post("/api/auth/login-visitor")
      .send({ secretCode: "00000", firstLetterLastName: "X" });

    // Assert
    expect(response.status).toBe(401);
  });

});
