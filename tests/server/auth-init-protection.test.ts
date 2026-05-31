/**
 * Tests TDD — Red Phase
 *
 * SEC-AUTH Vague 2.5 — Fichier 3 : auth-init-protection.test.ts
 *
 * Vérifie que POST /api/auth/init est correctement protégé :
 * 1. Retourne 403 (et non 400) quand un admin existe déjà
 * 2. Crée un admin quand la table est vide → 201
 * 3. N'expose JAMAIS defaultPassword dans la réponse JSON
 * 4. Accepte un mot de passe fourni dans le body
 * 5. Génère un mot de passe aléatoire si aucun n'est fourni,
 *    et le logue côté serveur (console.log ou logger)
 *
 * Ces tests échouent sur le code actuel (retourne 400 au lieu de 403,
 * expose defaultPassword, ne supporte pas de mot de passe fourni) et
 * passeront une fois les corrections appliquées.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock de la DB — contrôlé test par test
// ---------------------------------------------------------------------------

const mockDbSelectLimit = vi.fn();
const mockDbInsertReturning = vi.fn();

vi.mock("../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: mockDbSelectLimit,
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: mockDbInsertReturning,
  },
}));

// Mock session-logger
vi.mock("../../server/session-logger", () => ({
  sessionLogger: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper : construit une mini-app avec uniquement les routes auth
// ---------------------------------------------------------------------------

async function buildAuthApp(): Promise<Express> {
  const { registerAuthRoutes } = await import("../../server/auth-routes");

  const app = express();
  app.use(express.json());

  // Session factice minimale
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      regenerate: (cb: (err: any) => void) => cb(null),
      save: (cb: (err: any) => void) => cb(null),
    };
    next();
  });

  registerAuthRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("POST /api/auth/init — protection et sécurité", () => {

  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildAuthApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Cas 1 : un admin existe déjà → route fermée
  // =========================================================================

  it("doit retourner 403 quand un admin existe déjà dans la table users", async () => {
    // Arrange — la DB retourne un utilisateur existant
    mockDbSelectLimit.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]' },
    ]);

    // Act
    const response = await request(app).post("/api/auth/init").send({});

    // Assert
    expect(response.status).toBe(403);
  });

  it("doit retourner un message explicatif quand la route est fermée (admin existe)", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]' },
    ]);

    // Act
    const response = await request(app).post("/api/auth/init").send({});

    // Assert — message non vide
    expect(response.status).toBe(403);
    expect(response.body.message).toBeDefined();
    expect(typeof response.body.message).toBe("string");
    expect(response.body.message.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // Cas 2 : table vide → création de l'admin → 201
  // =========================================================================

  it("doit retourner 201 quand la table users est vide", async () => {
    // Arrange — aucun utilisateur existant, insertion réussie
    mockDbSelectLimit.mockResolvedValue([]);
    mockDbInsertReturning.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]', createdAt: new Date() },
    ]);

    // Act
    const response = await request(app).post("/api/auth/init").send({});

    // Assert
    expect(response.status).toBe(201);
  });

  // =========================================================================
  // Cas 3 : defaultPassword NE DOIT PAS apparaître dans la réponse
  // =========================================================================

  it("ne doit PAS retourner defaultPassword dans la réponse JSON", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);
    mockDbInsertReturning.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]', createdAt: new Date() },
    ]);

    // Act
    const response = await request(app).post("/api/auth/init").send({});

    // Assert — le champ defaultPassword ne doit JAMAIS être présent
    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("defaultPassword");
    // Vérification supplémentaire : pas de mot de passe en clair dans la réponse
    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toMatch(/admin123/i);
  });

  it("ne doit pas exposer le hash du mot de passe dans la réponse JSON", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);
    mockDbInsertReturning.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]', createdAt: new Date() },
    ]);

    // Act
    const response = await request(app).post("/api/auth/init").send({});

    // Assert — pas de passwordHash dans la réponse
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  // =========================================================================
  // Cas 4 : mot de passe fourni dans le body → utilisé tel quel
  // =========================================================================

  it("doit utiliser le mot de passe fourni dans le body s'il est présent", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);
    const { db } = await import("../../server/db");
    const mockValues = vi.fn().mockReturnThis();
    (db.insert as any).mockReturnValue({ values: mockValues, returning: mockDbInsertReturning });
    mockDbInsertReturning.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]', createdAt: new Date() },
    ]);

    // Act
    await request(app).post("/api/auth/init").send({ password: "MonSuperMotDePasse!" });

    // Assert — les values passées à l'insert doivent contenir un passwordHash
    // (non l'autre hash du mot de passe par défaut "admin123")
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "admin",
        passwordHash: expect.any(String),
      })
    );

    // Le hash utilisé ne doit PAS correspondre à SHA-256("admin123")
    const callArg = mockValues.mock.calls[0][0];
    const sha256Admin123 = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";
    expect(callArg.passwordHash).not.toBe(sha256Admin123);
  });

  // =========================================================================
  // Cas 5 : pas de mot de passe → génération aléatoire loggée côté serveur
  // =========================================================================

  it("doit générer un mot de passe aléatoire si aucun n'est fourni dans le body", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);
    const { db } = await import("../../server/db");
    const mockValues = vi.fn().mockReturnThis();
    (db.insert as any).mockReturnValue({ values: mockValues, returning: mockDbInsertReturning });
    mockDbInsertReturning.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]', createdAt: new Date() },
    ]);

    // Act — aucun champ password dans le body
    const response = await request(app).post("/api/auth/init").send({});

    // Assert — réponse valide
    expect(response.status).toBe(201);

    // Le hash utilisé ne doit PAS être celui de "admin123" (le mot de passe hard-codé actuel)
    const sha256Admin123 = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";
    if (mockValues.mock.calls.length > 0) {
      const callArg = mockValues.mock.calls[0][0];
      expect(callArg.passwordHash).not.toBe(sha256Admin123);
    }
  });

  it("doit loguer le mot de passe généré côté serveur (console.log ou logger)", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);
    mockDbInsertReturning.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]', createdAt: new Date() },
    ]);
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Act — aucun mot de passe fourni : le serveur doit le loguer
    await request(app).post("/api/auth/init").send({});

    // Assert — console.log appelé au moins une fois (le mot de passe doit être visible
    // dans les logs serveur pour que l'admin puisse récupérer l'accès)
    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  // =========================================================================
  // Cas 6 : vérification que l'endpoint crée bien l'utilisateur admin
  // =========================================================================

  it("doit insérer un utilisateur avec le rôle admin quand la table est vide", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);
    const { db } = await import("../../server/db");
    const mockValues = vi.fn().mockReturnThis();
    (db.insert as any).mockReturnValue({ values: mockValues, returning: mockDbInsertReturning });
    mockDbInsertReturning.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]', createdAt: new Date() },
    ]);

    // Act
    await request(app).post("/api/auth/init").send({});

    // Assert — l'insertion doit inclure le rôle admin
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: expect.stringContaining("admin"),
      })
    );
  });

  it("doit retourner le username dans la réponse (sans credential sensible)", async () => {
    // Arrange
    mockDbSelectLimit.mockResolvedValue([]);
    mockDbInsertReturning.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]', createdAt: new Date() },
    ]);

    // Act
    const response = await request(app).post("/api/auth/init").send({});

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.username).toBe("admin");
    expect(response.body).not.toHaveProperty("defaultPassword");
    expect(response.body).not.toHaveProperty("passwordHash");
  });

});
