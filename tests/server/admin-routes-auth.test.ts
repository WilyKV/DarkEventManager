/**
 * Tests TDD — Red Phase
 *
 * SEC-AUTH Vague 2.5 — Fichier 1 : admin-routes-auth.test.ts
 *
 * Vérifie que les routes destructrices et sensibles sont protégées par
 * l'authentification et les contrôles de rôle. Ces tests échouent sur le
 * code actuel (aucune protection en place) et passeront une fois les
 * middlewares requireAuth / requireRole ajoutés aux routes concernées.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { USER_ROLES, type UserRole } from "@shared/schema";

// ---------------------------------------------------------------------------
// Mock complet de storage — aucun accès DB dans ces tests
// ---------------------------------------------------------------------------

vi.mock("../../server/storage", () => ({
  storage: {
    // Data management
    resetData: vi.fn().mockResolvedValue(undefined),
    // Participants
    getParticipants: vi.fn().mockResolvedValue([]),
    getParticipant: vi.fn().mockResolvedValue({
      id: 1,
      firstName: "Alice",
      lastName: "Zombie",
      secretCode: "12345",
      type: "zombie",
    }),
    createParticipant: vi.fn().mockResolvedValue({ id: 2 }),
    generateSecretCode: vi.fn().mockResolvedValue("99999"),
    // Time slots
    getTimeSlots: vi.fn().mockResolvedValue([]),
    createTimeSlot: vi.fn().mockResolvedValue({ id: 1 }),
    // Squads
    getSquads: vi.fn().mockResolvedValue([]),
    getSquadsWithParticipants: vi.fn().mockResolvedValue([]),
    // Shop / Meal
    getShopItems: vi.fn().mockResolvedValue([]),
    getMealItems: vi.fn().mockResolvedValue([]),
    // Audit
    createAuditLog: vi.fn().mockResolvedValue({ id: 1 }),
    // Purchases
    getPurchases: vi.fn().mockResolvedValue([]),
    getMealPurchases: vi.fn().mockResolvedValue([]),
    // Discounts
    getGlobalDiscounts: vi.fn().mockResolvedValue(undefined),
    getGlobalMealDiscounts: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock multer pour les routes upload (import-all, participants/import)
vi.mock("multer", () => {
  const multerMock = () => ({
    single: () => (req: Request, _res: Response, next: NextFunction) => {
      // Simule un fichier uploadé minimal pour que la route ne retourne pas 400
      (req as any).file = {
        buffer: Buffer.from(""),
        originalname: "test.xlsx",
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      next();
    },
  });
  multerMock.memoryStorage = () => ({});
  return { default: multerMock };
});

// Mock xlsx pour éviter les erreurs de parsing sur le buffer vide
vi.mock("xlsx", () => ({
  default: {
    read: vi.fn().mockReturnValue({ SheetNames: [], Sheets: {} }),
    utils: {
      book_new: vi.fn().mockReturnValue({}),
      json_to_sheet: vi.fn().mockReturnValue({}),
      book_append_sheet: vi.fn(),
      sheet_to_json: vi.fn().mockReturnValue([]),
    },
    write: vi.fn().mockReturnValue(Buffer.from("")),
  },
}));

// Mock pako (utilisé dans registerRoutes)
vi.mock("pako", () => ({ default: { inflate: vi.fn(), deflate: vi.fn() } }));

// Mock event-ingest-routes pour éviter les dépendances supplémentaires
vi.mock("../../server/event-ingest-routes", () => ({
  registerEventIngestRoutes: vi.fn(),
}));

// Mock sync-middleware — on ne teste pas le sync ici
vi.mock("../../server/sync-middleware", () => ({
  checkSyncPermissions: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Mock pdf-service
vi.mock("../../server/pdf-service", () => ({
  generateParticipantPDF: vi.fn().mockResolvedValue(Buffer.from("")),
}));

// ---------------------------------------------------------------------------
// Helper : construit une mini-app Express avec session injectée
// ---------------------------------------------------------------------------

type SessionUser = {
  id: number;
  username: string;
  roles: UserRole[];
};

async function buildApp(sessionUser: SessionUser | undefined): Promise<Express> {
  const { registerRoutes } = await import("../../server/routes");

  const app = express();
  app.use(express.json());

  // Middleware de session factice
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (sessionUser !== undefined) {
      (req as any).session = {
        user: {
          id: sessionUser.id,
          username: sessionUser.username,
          // Les routes lisent req.session.user.roles comme tableau parsé
          // (voir requireRole dans auth-routes.ts)
          roles: sessionUser.roles,
        },
      };
    } else {
      (req as any).session = {};
    }
    next();
  });

  await registerRoutes(app);
  return app;
}

// Utilisateurs de test réutilisables
const adminUser: SessionUser = { id: 1, username: "admin", roles: [USER_ROLES.ADMIN] };
const staffZombieUser: SessionUser = { id: 2, username: "staff_z", roles: [USER_ROLES.STAFF_ZOMBIE] };
const staffSurvivantUser: SessionUser = { id: 3, username: "staff_s", roles: [USER_ROLES.STAFF_SURVIVANT] };
const staffRepasUser: SessionUser = { id: 4, username: "staff_r", roles: [USER_ROLES.STAFF_REPAS] };
const staffBoutiqueUser: SessionUser = { id: 5, username: "staff_b", roles: [USER_ROLES.STAFF_BOUTIQUE] };

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("admin-routes-auth — protection des routes sensibles", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // POST /api/data/reset — route destructrice critique
  // =========================================================================

  describe("POST /api/data/reset", () => {

    it("doit retourner 401 quand aucune session n'est présente", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app)
        .post("/api/data/reset")
        .send({ module: "participants" });

      // Assert
      expect(response.status).toBe(401);
    });

    it("doit retourner 403 quand le rôle est staff_zombie (non admin)", async () => {
      // Arrange
      const app = await buildApp(staffZombieUser);

      // Act
      const response = await request(app)
        .post("/api/data/reset")
        .send({ module: "participants" });

      // Assert
      expect(response.status).toBe(403);
    });

    it("doit retourner 403 quand le rôle est staff_survivant (non admin)", async () => {
      // Arrange
      const app = await buildApp(staffSurvivantUser);

      // Act
      const response = await request(app)
        .post("/api/data/reset")
        .send({ module: "participants" });

      // Assert
      expect(response.status).toBe(403);
    });

    it("doit retourner 200 et exécuter le reset quand le rôle est admin", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      // Act
      const response = await request(app)
        .post("/api/data/reset")
        .send({ module: "participants" });

      // Assert
      expect(response.status).toBe(200);
      expect(storage.resetData).toHaveBeenCalledWith("participants", undefined);
    });

    it("doit appeler resetData avec le type quand fourni (session admin)", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      // Act
      await request(app)
        .post("/api/data/reset")
        .send({ module: "participants", type: "zombie" });

      // Assert
      expect(storage.resetData).toHaveBeenCalledWith("participants", "zombie");
    });

  });

  // =========================================================================
  // POST /api/data/import-all — import massif (destructeur potentiel)
  // =========================================================================

  describe("POST /api/data/import-all", () => {

    it("doit retourner 401 quand aucune session n'est présente", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app)
        .post("/api/data/import-all")
        .attach("file", Buffer.from(""), "data.xlsx");

      // Assert
      expect(response.status).toBe(401);
    });

    it("doit retourner 403 quand le rôle est staff_repas (non admin)", async () => {
      // Arrange
      const app = await buildApp(staffRepasUser);

      // Act
      const response = await request(app)
        .post("/api/data/import-all")
        .attach("file", Buffer.from(""), "data.xlsx");

      // Assert
      expect(response.status).toBe(403);
    });

    it("doit retourner 403 quand le rôle est staff_boutique (non admin)", async () => {
      // Arrange
      const app = await buildApp(staffBoutiqueUser);

      // Act
      const response = await request(app)
        .post("/api/data/import-all")
        .attach("file", Buffer.from(""), "data.xlsx");

      // Assert
      expect(response.status).toBe(403);
    });

    it("doit retourner 200 quand le rôle est admin", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const response = await request(app)
        .post("/api/data/import-all")
        .attach("file", Buffer.from(""), "data.xlsx");

      // Assert
      expect(response.status).toBe(200);
    });

  });

  // =========================================================================
  // POST /api/participants/import — import en masse de participants
  // =========================================================================

  describe("POST /api/participants/import", () => {

    it("doit retourner 401 quand aucune session n'est présente", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app)
        .post("/api/participants/import")
        .field("type", "zombie")
        .attach("file", Buffer.from(""), "participants.xlsx");

      // Assert
      expect(response.status).toBe(401);
    });

    it("doit retourner 200 quand le rôle est admin", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const response = await request(app)
        .post("/api/participants/import")
        .field("type", "zombie")
        .attach("file", Buffer.from(""), "participants.xlsx");

      // Assert — le code retourné doit être 200 (pas 401/403)
      expect(response.status).toBe(200);
    });

  });

  // =========================================================================
  // GET /api/export/participants — export module (staff autorisé)
  // =========================================================================

  describe("GET /api/export/participants", () => {

    it("doit retourner 401 quand aucune session n'est présente", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app).get("/api/export/participants");

      // Assert
      expect(response.status).toBe(401);
    });

    it.each([
      ["staff_zombie", staffZombieUser],
      ["staff_survivant", staffSurvivantUser],
      ["staff_repas", staffRepasUser],
      ["staff_boutique", staffBoutiqueUser],
      ["admin", adminUser],
    ] as const)(
      "doit autoriser l'export participants pour le rôle %s",
      async (_label, user) => {
        // Arrange
        const app = await buildApp(user);

        // Act
        const response = await request(app).get("/api/export/participants");

        // Assert — les rôles staff doivent accéder à l'export de leur module
        expect(response.status).toBe(200);
      }
    );

  });

  // =========================================================================
  // GET /api/data/export-all — export TOUT (admin seulement)
  // =========================================================================

  describe("GET /api/data/export-all", () => {

    it("doit retourner 401 quand aucune session n'est présente", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app).get("/api/data/export-all");

      // Assert
      expect(response.status).toBe(401);
    });

    it.each([
      ["staff_zombie", staffZombieUser],
      ["staff_survivant", staffSurvivantUser],
      ["staff_repas", staffRepasUser],
      ["staff_boutique", staffBoutiqueUser],
    ] as const)(
      "doit retourner 403 pour le rôle %s (export-all réservé admin)",
      async (_label, user) => {
        // Arrange
        const app = await buildApp(user);

        // Act
        const response = await request(app).get("/api/data/export-all");

        // Assert
        expect(response.status).toBe(403);
      }
    );

    it("doit retourner 200 quand le rôle est admin", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const response = await request(app).get("/api/data/export-all");

      // Assert
      expect(response.status).toBe(200);
    });

  });

  // =========================================================================
  // GET /api/qr/generate/:participantId — génération QR (staff autorisé)
  // =========================================================================

  describe("GET /api/qr/generate/:participantId", () => {

    it("doit retourner 401 quand aucune session n'est présente", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app).get("/api/qr/generate/1");

      // Assert
      expect(response.status).toBe(401);
    });

    it.each([
      ["staff_zombie", staffZombieUser],
      ["staff_survivant", staffSurvivantUser],
      ["staff_repas", staffRepasUser],
      ["staff_boutique", staffBoutiqueUser],
      ["admin", adminUser],
    ] as const)(
      "doit autoriser la génération QR pour le rôle %s",
      async (_label, user) => {
        // Arrange
        const app = await buildApp(user);

        // Act
        const response = await request(app).get("/api/qr/generate/1");

        // Assert — 200 ou 404 sont acceptables (participant mocké peut ne pas être trouvé),
        // mais PAS 401 ni 403
        expect(response.status).not.toBe(401);
        expect(response.status).not.toBe(403);
      }
    );

  });

});
