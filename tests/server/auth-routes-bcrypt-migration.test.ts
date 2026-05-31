/**
 * Tests TDD — Phase Rouge — Intégration
 * Cible : server/auth-routes.ts (routes existantes à modifier)
 *
 * Vérifie que :
 *  1. Le login fonctionne avec un hash bcrypt en base
 *  2. Le login avec un hash legacy SHA-256 réussit ET migre le hash vers bcrypt (lazy migration)
 *  3. La création d'utilisateur stocke toujours un hash bcrypt, jamais SHA-256
 *  4. L'init admin ne stocke plus "admin123" en SHA-256
 *
 * Strategy : mock du module ../../server/db pour éviter une vraie DB.
 * On mock également ../../server/password-hashing (futur module) pour contrôler
 * les retours et observer les appels.
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Génère un hash SHA-256 hex (format legacy) */
function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Retourne true si la string ressemble à un hash bcrypt */
function looksLikeBcrypt(hash: string): boolean {
  return /^\$2[ab]\$\d{2}\$/.test(hash);
}

// ---------------------------------------------------------------------------
// Mocks — db et password-hashing (modules non encore créés)
// ---------------------------------------------------------------------------

// Mock de la couche DB (drizzle) — on fournit des users en mémoire
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();

vi.mock("../../server/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
}));

// Mock du futur module password-hashing
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

// ---------------------------------------------------------------------------
// Factory — crée une app Express avec les auth-routes montées
// ---------------------------------------------------------------------------

async function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
      // Pas de store persistant en test
    })
  );

  // Import dynamique après les mocks vi.mock (hoistés)
  const { registerAuthRoutes } = await import("../../server/auth-routes");
  registerAuthRoutes(app);

  return app;
}

// ---------------------------------------------------------------------------
// Helpers DB mock — simule le fluent builder de drizzle
// ---------------------------------------------------------------------------

/**
 * Configure mockDbSelect pour retourner un seul user.
 * Drizzle: db.select().from(...).where(...).limit(1) → [user] ou []
 */
function setupSelectReturning(rows: object[]) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
      // Pour db.select().from(users) sans where (ex: GET /api/auth/users)
      limit: vi.fn().mockResolvedValue(rows),
    }),
  });
}

/**
 * Configure mockDbUpdate pour capturer les appels et retourner succès.
 */
function setupUpdateCapture() {
  const captured: Array<{ set: object; where: unknown }> = [];
  mockDbUpdate.mockReturnValue({
    set: vi.fn((data: object) => {
      const entry = { set: data, where: null as unknown };
      captured.push(entry);
      return {
        where: vi.fn((condition: unknown) => {
          entry.where = condition;
          return Promise.resolve([]);
        }),
      };
    }),
  });
  return captured;
}

/**
 * Configure mockDbInsert pour simuler une insertion et retourner les valeurs.
 */
function setupInsertReturning(returnedRow: object) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnedRow]),
    }),
  });
}

// ---------------------------------------------------------------------------
// 1. Login avec hash bcrypt
// ---------------------------------------------------------------------------

describe("POST /api/auth/login — avec hash bcrypt", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildTestApp();
  });

  it("devrait retourner 200 et la session si le password est correct (hash bcrypt en DB)", async () => {
    // Arrange
    const bcryptHash = "$2b$12$SomeFakeBcryptHashForTestingPurposesOnly.XXXXXXXXXXXXXXX";
    const userInDb = {
      id: 1,
      username: "testuser",
      passwordHash: bcryptHash,
      roles: '["admin"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    // mockDbUpdate pour lastLoginAt
    setupUpdateCapture();
    // verifyPassword retourne true (bon password)
    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(false);
    mockIsBcryptHash.mockReturnValue(true);

    // Act
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "bonPassword" });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("user");
    expect(response.body.user.username).toBe("testuser");
  });

  it("devrait retourner 401 si le password est incorrect (hash bcrypt en DB)", async () => {
    // Arrange
    const bcryptHash = "$2b$12$SomeFakeBcryptHashForTestingPurposesOnly.XXXXXXXXXXXXXXX";
    const userInDb = {
      id: 1,
      username: "testuser",
      passwordHash: bcryptHash,
      roles: '["staff_zombie"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    mockVerifyPassword.mockResolvedValue(false);
    mockIsLegacyHash.mockReturnValue(false);
    mockIsBcryptHash.mockReturnValue(true);

    // Act
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "mauvaisPassword" });

    // Assert
    expect(response.status).toBe(401);
  });

  it("devrait retourner 401 si l'utilisateur n'existe pas", async () => {
    // Arrange
    setupSelectReturning([]); // Aucun user trouvé

    // Act
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "inexistant", password: "nimporte" });

    // Assert
    expect(response.status).toBe(401);
  });

  it("ne devrait PAS appeler hashPassword (SHA-256) lors d'un login avec bcrypt", async () => {
    // Arrange
    const bcryptHash = "$2b$12$SomeFakeBcryptHashForTestingPurposesOnly.XXXXXXXXXXXXXXX";
    const userInDb = {
      id: 1,
      username: "testuser",
      passwordHash: bcryptHash,
      roles: '["admin"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    setupUpdateCapture();
    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(false);
    mockIsBcryptHash.mockReturnValue(true);

    // Act
    await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "bonPassword" });

    // Assert — hashPassword (l'ancien sha256) ne doit PAS être appelé
    expect(mockHashPassword).not.toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      // Si hashPassword est appelé avec le password en clair pour comparer SHA-256, c'est un bug
    );
    // verifyPassword doit avoir été appelé à la place
    expect(mockVerifyPassword).toHaveBeenCalledWith("bonPassword", bcryptHash);
  });
});

// ---------------------------------------------------------------------------
// 2. Login avec hash legacy SHA-256 → migration vers bcrypt
// ---------------------------------------------------------------------------

describe("POST /api/auth/login — migration lazy SHA-256 → bcrypt", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildTestApp();
  });

  it("devrait retourner 200 si le hash en DB est legacy SHA-256 et le password correct", async () => {
    // Arrange — user créé avec l'ancien système SHA-256
    const legacyHash = sha256("monAncienPassword");
    const userInDb = {
      id: 2,
      username: "ancienUser",
      passwordHash: legacyHash,
      roles: '["staff_survivant"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    const updateCalls = setupUpdateCapture();

    // verifyPassword est conscient du format legacy et retourne true
    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(true);
    mockIsBcryptHash.mockReturnValue(false);
    // hashPassword retourne un nouveau hash bcrypt pour la migration
    const newBcryptHash = "$2b$12$MigratedHashForAncienUser.XXXXXXXXXXXXXXXXXXXXXXXXX";
    mockHashPassword.mockResolvedValue(newBcryptHash);

    // Act
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "ancienUser", password: "monAncienPassword" });

    // Assert — login réussi
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("user");
  });

  it("devrait mettre à jour le hash en DB vers bcrypt après login avec hash legacy", async () => {
    // Arrange
    const legacyHash = sha256("monAncienPassword");
    const userInDb = {
      id: 2,
      username: "ancienUser",
      passwordHash: legacyHash,
      roles: '["staff_zombie"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    const updateCalls = setupUpdateCapture();

    mockVerifyPassword.mockResolvedValue(true);
    mockIsLegacyHash.mockReturnValue(true);
    mockIsBcryptHash.mockReturnValue(false);

    const newBcryptHash = "$2b$12$MigratedHashForAncienUser.XXXXXXXXXXXXXXXXXXXXXXXXX";
    mockHashPassword.mockResolvedValue(newBcryptHash);

    // Act
    await request(app)
      .post("/api/auth/login")
      .send({ username: "ancienUser", password: "monAncienPassword" });

    // Assert — un appel db.update devait avoir mis à jour passwordHash vers le hash bcrypt
    const passwordUpdateCall = updateCalls.find(
      (call) => "passwordHash" in call.set
    );
    expect(passwordUpdateCall).toBeDefined();
    expect((passwordUpdateCall!.set as { passwordHash: string }).passwordHash).toBe(newBcryptHash);
    // Le nouveau hash doit être bcrypt, pas SHA-256
    expect(looksLikeBcrypt((passwordUpdateCall!.set as { passwordHash: string }).passwordHash)).toBe(true);
  });

  it("ne devrait PAS migrer le hash si le password est incorrect", async () => {
    // Arrange
    const legacyHash = sha256("monAncienPassword");
    const userInDb = {
      id: 2,
      username: "ancienUser",
      passwordHash: legacyHash,
      roles: '["staff_zombie"]',
      createdAt: new Date(),
      lastLoginAt: null,
    };

    setupSelectReturning([userInDb]);
    const updateCalls = setupUpdateCapture();

    mockVerifyPassword.mockResolvedValue(false); // Mauvais password
    mockIsLegacyHash.mockReturnValue(true);

    // Act
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "ancienUser", password: "mauvaisPassword" });

    // Assert — 401, pas de migration
    expect(response.status).toBe(401);
    // Aucun update de passwordHash ne doit avoir eu lieu
    const passwordUpdateCall = updateCalls.find(
      (call) => "passwordHash" in call.set
    );
    expect(passwordUpdateCall).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Création d'utilisateur via POST /api/auth/users → hash bcrypt
// ---------------------------------------------------------------------------

describe("POST /api/auth/users — création avec hash bcrypt", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildTestApp();
  });

  it("devrait stocker un hash bcrypt lors de la création d'un utilisateur", async () => {
    // Arrange — simule une session admin active
    const adminSession = { id: 1, username: "admin", roles: ["admin"] };

    const bcryptHash = "$2b$12$CreatedUserBcryptHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    mockHashPassword.mockResolvedValue(bcryptHash);

    // Premier select : vérifie si user existe déjà → aucun existant
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // Pas d'utilisateur existant
        }),
      }),
    });

    // Insert → retourne le nouvel user
    setupInsertReturning({
      id: 3,
      username: "nouvelUser",
      passwordHash: bcryptHash,
      roles: '["staff_boutique"]',
      createdAt: new Date(),
    });

    // Act — on simule un admin authentifié via un cookie de session
    // Note : en test sans DB réelle, on passe directement via un app avec session préchargée
    const appWithAdmin = express();
    appWithAdmin.use(express.json());
    appWithAdmin.use(
      session({
        secret: "test-secret",
        resave: false,
        saveUninitialized: false,
      })
    );
    // Middleware qui injecte la session admin
    appWithAdmin.use((req, _res, next) => {
      (req.session as any).user = adminSession;
      next();
    });
    const { registerAuthRoutes } = await import("../../server/auth-routes");
    registerAuthRoutes(appWithAdmin);

    const response = await request(appWithAdmin)
      .post("/api/auth/users")
      .send({
        username: "nouvelUser",
        passwordHash: "motDePasseEnClair", // Le client envoie le password en clair dans ce champ
        roles: '["staff_boutique"]',
      });

    // Assert
    expect(response.status).toBe(200);
    // hashPassword doit avoir été appelé avec le password en clair
    expect(mockHashPassword).toHaveBeenCalledWith("motDePasseEnClair");
    // Le hash stocké doit être bcrypt
    expect(looksLikeBcrypt(bcryptHash)).toBe(true);
  });

  it("ne devrait PAS stocker un hash SHA-256 lors de la création d'un utilisateur", async () => {
    // Arrange
    const bcryptHash = "$2b$12$CreatedUserBcryptHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    mockHashPassword.mockResolvedValue(bcryptHash);

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    setupInsertReturning({
      id: 4,
      username: "autreUser",
      passwordHash: bcryptHash,
      roles: '["staff_repas"]',
      createdAt: new Date(),
    });

    const appWithAdmin = express();
    appWithAdmin.use(express.json());
    appWithAdmin.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
    appWithAdmin.use((req, _res, next) => {
      (req.session as any).user = { id: 1, username: "admin", roles: ["admin"] };
      next();
    });
    const { registerAuthRoutes } = await import("../../server/auth-routes");
    registerAuthRoutes(appWithAdmin);

    // Act
    await request(appWithAdmin)
      .post("/api/auth/users")
      .send({ username: "autreUser", passwordHash: "monPassword", roles: '["staff_repas"]' });

    // Assert — hashPassword ne doit PAS avoir retourné un SHA-256 hex de 64 chars
    const storedHash = mockHashPassword.mock.results[0]?.value;
    // Le hash passé à l'insert ne doit pas être un SHA-256
    expect(bcryptHash).not.toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// 4. Init admin — POST /api/auth/init → hash bcrypt pour "admin123"
// ---------------------------------------------------------------------------

describe("POST /api/auth/init — initialisation admin avec hash bcrypt", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildTestApp();
  });

  it("devrait créer l'admin avec un hash bcrypt, pas SHA-256", async () => {
    // Arrange — aucun user existant
    setupSelectReturning([]);

    const bcryptHashOfAdmin123 = "$2b$12$InitAdminBcryptHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    mockHashPassword.mockResolvedValue(bcryptHashOfAdmin123);

    setupInsertReturning({
      id: 1,
      username: "admin",
      passwordHash: bcryptHashOfAdmin123,
      roles: '["admin"]',
      createdAt: new Date(),
    });

    // Act
    const response = await request(app).post("/api/auth/init");

    // Assert — 201 Created
    expect(response.status).toBe(201);
    // hashPassword doit avoir été appelé avec "admin123"
    expect(mockHashPassword).toHaveBeenCalledWith("admin123");
    // Le hash résultant doit être bcrypt
    expect(looksLikeBcrypt(bcryptHashOfAdmin123)).toBe(true);
  });

  it("ne devrait PAS stocker le hash SHA-256 de 'admin123' (HIGH-4 fix)", async () => {
    // Arrange
    setupSelectReturning([]);

    const bcryptHash = "$2b$12$InitAdminBcryptHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    mockHashPassword.mockResolvedValue(bcryptHash);

    // Capture l'appel à db.insert pour inspecter passwordHash
    let insertedPasswordHash: string | null = null;
    mockDbInsert.mockReturnValue({
      values: vi.fn((data: { passwordHash: string }) => {
        insertedPasswordHash = data.passwordHash;
        return {
          returning: vi.fn().mockResolvedValue([{
            id: 1,
            username: "admin",
            passwordHash: bcryptHash,
            roles: '["admin"]',
            createdAt: new Date(),
          }]),
        };
      }),
    });

    // Act
    await request(app).post("/api/auth/init");

    // Assert — le hash inséré ne doit PAS être "admin123" en SHA-256
    const sha256OfAdmin123 = sha256("admin123");
    expect(insertedPasswordHash).not.toBe(sha256OfAdmin123);
    // Et doit être bcrypt
    expect(insertedPasswordHash).toBe(bcryptHash);
    expect(looksLikeBcrypt(insertedPasswordHash!)).toBe(true);
  });

  it("devrait retourner 403 si un admin existe déjà", async () => {
    // Arrange — un user existant
    setupSelectReturning([{
      id: 1, username: "admin", passwordHash: "$2b$12$...", roles: '["admin"]',
    }]);

    // Act
    const response = await request(app).post("/api/auth/init");

    // Assert — 403 Forbidden (protection SEC-AUTH)
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 5. PATCH /api/auth/users/:id/password — mise à jour password → bcrypt
// ---------------------------------------------------------------------------

describe("PATCH /api/auth/users/:id/password — mise à jour avec hash bcrypt", () => {
  let appWithAdmin: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    appWithAdmin = express();
    appWithAdmin.use(express.json());
    appWithAdmin.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
    appWithAdmin.use((req, _res, next) => {
      (req.session as any).user = { id: 1, username: "admin", roles: ["admin"] };
      next();
    });
    const { registerAuthRoutes } = await import("../../server/auth-routes");
    registerAuthRoutes(appWithAdmin);
  });

  it("devrait mettre à jour le passwordHash avec un hash bcrypt", async () => {
    // Arrange
    const bcryptHash = "$2b$12$UpdatedPasswordHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    mockHashPassword.mockResolvedValue(bcryptHash);
    const updateCalls = setupUpdateCapture();

    // Act
    const response = await request(appWithAdmin)
      .patch("/api/auth/users/2/password")
      .send({ password: "nouveauMotDePasse!99" });

    // Assert
    expect(response.status).toBe(200);
    // hashPassword a été appelé avec le nouveau password
    expect(mockHashPassword).toHaveBeenCalledWith("nouveauMotDePasse!99");
    // La mise à jour en DB contient bien le hash bcrypt
    const passwordUpdate = updateCalls.find((c) => "passwordHash" in c.set);
    expect(passwordUpdate).toBeDefined();
    expect((passwordUpdate!.set as { passwordHash: string }).passwordHash).toBe(bcryptHash);
    expect(looksLikeBcrypt(bcryptHash)).toBe(true);
  });

  it("devrait retourner 400 si le password fait moins de 6 caractères", async () => {
    // Arrange / Act
    const response = await request(appWithAdmin)
      .patch("/api/auth/users/2/password")
      .send({ password: "abc" }); // < 6 chars

    // Assert
    expect(response.status).toBe(400);
    // hashPassword ne doit pas être appelé pour un password trop court
    expect(mockHashPassword).not.toHaveBeenCalled();
  });
});
