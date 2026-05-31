/**
 * Tests TDD — Red Phase
 *
 * Bug A.1 : sync-push-pull-routes.ts filtre sur user.role (singulier) avec les
 * anciens noms de rôles ('zombie', 'survivant', 'staff', 'boutique', 'repas').
 * Le format actuel utilise user.roles (pluriel, JSON-array) et les valeurs
 * définies dans USER_ROLES ('admin', 'staff_zombie', 'staff_survivant',
 * 'staff_repas', 'staff_boutique').
 *
 * Conséquence : aucun rôle valide n'est reconnu, les endpoints push/pull
 * renvoient un objet vide (count: 0) au lieu de traiter la requête.
 *
 * Ces tests échoueront sur le code buggé actuel et passeront une fois le bug
 * corrigé.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { USER_ROLES, type UserRole } from "@shared/schema";

// ---------------------------------------------------------------------------
// Mock de storage — on ne touche pas la DB dans ces tests
// ---------------------------------------------------------------------------

vi.mock("../../server/storage", () => ({
  storage: {
    getParticipants: vi.fn().mockResolvedValue([{ id: 1 }]),
    getTimeSlots: vi.fn().mockResolvedValue([{ id: 1 }]),
    getSquads: vi.fn().mockResolvedValue([{ id: 1 }]),
    getShopItems: vi.fn().mockResolvedValue([{ id: 1 }]),
    getMealItems: vi.fn().mockResolvedValue([{ id: 1 }]),
    getPurchases: vi.fn().mockResolvedValue([{ id: 1 }]),
    getMealPurchases: vi.fn().mockResolvedValue([{ id: 1 }]),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit une mini-app Express qui :
 * 1. Injecte un utilisateur fictif dans req.session via un middleware factice
 * 2. Monte les routes sync push/pull
 *
 * @param roles - tableau de rôles à placer dans req.session.user.roles
 *                (undefined = pas de session, simule un appel non authentifié)
 */
async function buildApp(roles: UserRole[] | undefined): Promise<Express> {
  const { registerSyncPushPullRoutes } = await import("../../server/sync-push-pull-routes");

  const app = express();
  app.use(express.json());

  // Middleware de session factice
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (roles !== undefined) {
      (req as any).session = {
        user: {
          id: 1,
          username: "testuser",
          roles: JSON.stringify(roles),
        },
      };
    } else {
      // Pas de session — simule une requête non authentifiée
      (req as any).session = {};
    }
    next();
  });

  registerSyncPushPullRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("sync-push-pull routes — role gating", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // POST /api/sync/push
  // -------------------------------------------------------------------------

  describe("POST /api/sync/push", () => {

    it("should return 401 when no session is present", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app).post("/api/sync/push").send({});

      // Assert
      expect(response.status).toBe(401);
    });

    it("should return 403 when user has no valid role", async () => {
      // Arrange — rôle fictif inconnu, jamais dans USER_ROLES
      const app = await buildApp([] as any);

      // Act
      const response = await request(app).post("/api/sync/push").send({});

      // Assert
      expect(response.status).toBe(403);
    });

    it("should return 200 and non-zero count when user has role admin", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.ADMIN]);

      // Act
      const response = await request(app).post("/api/sync/push").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Avec le rôle admin, au moins un élément doit être renvoyé (storage mocké
      // retourne 1 élément par collection). Un count de 0 trahit le bug.
      expect(response.body.count).toBeGreaterThan(0);
    });

    it("should return 200 and non-zero count when user has role staff_zombie", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_ZOMBIE]);

      // Act
      const response = await request(app).post("/api/sync/push").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it("should return 200 and non-zero count when user has role staff_survivant", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_SURVIVANT]);

      // Act
      const response = await request(app).post("/api/sync/push").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it("should return 200 and non-zero count when user has role staff_repas", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_REPAS]);

      // Act
      const response = await request(app).post("/api/sync/push").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it("should return 200 and non-zero count when user has role staff_boutique", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_BOUTIQUE]);

      // Act
      const response = await request(app).post("/api/sync/push").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    // Verrou anti-régression : tous les rôles du schéma doivent être reconnus
    it.each(Object.values(USER_ROLES))(
      "should return 200 for every role defined in USER_ROLES: %s",
      async (role) => {
        // Arrange
        const app = await buildApp([role]);

        // Act
        const response = await request(app).post("/api/sync/push").send({});

        // Assert — 200 prouve que le rôle est reconnu et traité
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.count).toBeGreaterThan(0);
      }
    );

  });

  // -------------------------------------------------------------------------
  // POST /api/sync/pull
  // -------------------------------------------------------------------------

  describe("POST /api/sync/pull", () => {

    it("should return 401 when no session is present", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app).post("/api/sync/pull").send({});

      // Assert
      expect(response.status).toBe(401);
    });

    it("should return 403 when user has no valid role", async () => {
      // Arrange — tableau vide = aucun rôle reconnu
      const app = await buildApp([] as any);

      // Act
      const response = await request(app).post("/api/sync/pull").send({});

      // Assert
      expect(response.status).toBe(403);
    });

    it("should return 200 and non-zero count when user has role admin", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.ADMIN]);

      // Act
      const response = await request(app).post("/api/sync/pull").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it("should return 200 and non-zero count when user has role staff_zombie", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_ZOMBIE]);

      // Act
      const response = await request(app).post("/api/sync/pull").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it("should return 200 and non-zero count when user has role staff_survivant", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_SURVIVANT]);

      // Act
      const response = await request(app).post("/api/sync/pull").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it("should return 200 and non-zero count when user has role staff_repas", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_REPAS]);

      // Act
      const response = await request(app).post("/api/sync/pull").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it("should return 200 and non-zero count when user has role staff_boutique", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_BOUTIQUE]);

      // Act
      const response = await request(app).post("/api/sync/pull").send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    // Verrou anti-régression : tous les rôles du schéma doivent être reconnus
    it.each(Object.values(USER_ROLES))(
      "should return 200 for every role defined in USER_ROLES: %s",
      async (role) => {
        // Arrange
        const app = await buildApp([role]);

        // Act
        const response = await request(app).post("/api/sync/pull").send({});

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.count).toBeGreaterThan(0);
      }
    );

  });

});
