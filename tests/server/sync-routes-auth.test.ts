import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { USER_ROLES, type UserRole } from "@shared/schema";

// ---------------------------------------------------------------------------
// Mock de storage — pas de DB dans ces tests
// ---------------------------------------------------------------------------

vi.mock("../../server/storage", () => ({
  storage: {
    getSyncConfig: vi.fn().mockResolvedValue({
      id: 1,
      isOnlineMode: true,
      masterDeviceId: "device-master-uuid",
      masterDeviceName: "PC Staff",
      lastSyncAt: null,
    }),
    updateSyncConfig: vi.fn().mockResolvedValue({
      id: 1,
      isOnlineMode: false,
      masterDeviceId: "device-master-uuid",
      masterDeviceName: "PC Staff",
      lastSyncAt: null,
    }),
    updateLastSyncAt: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock du module sync-middleware pour éviter le vrai HMAC
vi.mock("../../server/sync-middleware", () => ({
  generateWebSocketToken: vi.fn().mockReturnValue("mock.token.signature"),
  getWebSocketSecret: vi.fn().mockReturnValue("mock-secret"),
  checkSyncPermissions: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// ---------------------------------------------------------------------------
// Helper — construit une mini-app avec session factice
// ---------------------------------------------------------------------------

/**
 * @param roles  - tableau de rôles UserRole dans req.session.user
 *                 undefined = pas de session (non authentifié)
 */
async function buildApp(roles: UserRole[] | undefined): Promise<Express> {
  const { registerSyncRoutes } = await import("../../server/sync-routes");

  const app = express();
  app.use(express.json());

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
      (req as any).session = {};
    }
    next();
  });

  registerSyncRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("sync-routes — protection par authentification", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("jetons WebSocket", () => {
    const deviceId = "550e8400-e29b-41d4-a716-446655440000";

    it("refuse les jetons sans session staff", async () => {
      const app = await buildApp(undefined);
      await request(app).get("/api/sync/live-token").expect(401);
      await request(app).post("/api/sync/ws-token").send({ deviceId }).expect(401);
    });

    it("délivre un jeton de direct à une session staff, sans mise en cache", async () => {
      const app = await buildApp([USER_ROLES.STAFF_ZOMBIE]);
      const response = await request(app).get("/api/sync/live-token").expect(200).expect("Cache-Control", "no-store");
      expect(response.body.id).toMatch(/^watch:/);
      expect(response.body.token).toBe("mock.token.signature");
    });

    it("accepte un UUID valide pour le protocole historique après authentification", async () => {
      const app = await buildApp([USER_ROLES.ADMIN]);
      const response = await request(app).post("/api/sync/ws-token").send({ deviceId }).expect(200);
      expect(response.body.token).toBe("mock.token.signature");
      expect(response.body.expiresIn).toBeGreaterThan(0);
    });

    it("rejette un identifiant d’appareil invalide", async () => {
      const app = await buildApp([USER_ROLES.ADMIN]);
      await request(app).post("/api/sync/ws-token").send({ deviceId: "pas-un-uuid" }).expect(400);
    });
  });

  // =========================================================================
  // GET /api/sync/config — doit exiger une session authentifiée
  // =========================================================================

  describe("GET /api/sync/config (doit exiger auth)", () => {

    it("should return 401 when no session is present", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app).get("/api/sync/config");

      expect(response.status).toBe(401);
    });

    it("should return 200 when user has role staff_zombie", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_ZOMBIE]);

      // Act
      const response = await request(app).get("/api/sync/config");

      // Assert
      expect(response.status).toBe(200);
    });

    it.each(Object.values(USER_ROLES))(
      "should return 200 for authenticated user with role %s",
      async (role) => {
        // Arrange
        const app = await buildApp([role]);

        // Act
        const response = await request(app).get("/api/sync/config");

        // Assert
        expect(response.status).toBe(200);
      }
    );

  });

  // =========================================================================
  // POST /api/sync/config — doit exiger le rôle admin
  // =========================================================================

  describe("POST /api/sync/config (doit exiger le rôle admin)", () => {

    const validBody = { isOnlineMode: false, masterDeviceId: "550e8400-e29b-41d4-a716-446655440000" };

    it("should return 401 when no session is present", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app)
        .post("/api/sync/config")
        .send(validBody);

      expect(response.status).toBe(401);
    });

    it("should return 403 when user has role staff_zombie (non-admin)", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_ZOMBIE]);

      // Act
      const response = await request(app)
        .post("/api/sync/config")
        .send(validBody);

      expect(response.status).toBe(403);
    });

    it("should return 403 when user has role staff_survivant (non-admin)", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_SURVIVANT]);

      // Act
      const response = await request(app)
        .post("/api/sync/config")
        .send(validBody);

      expect(response.status).toBe(403);
    });

    it("should return 403 when user has role staff_repas (non-admin)", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_REPAS]);

      // Act
      const response = await request(app)
        .post("/api/sync/config")
        .send(validBody);

      expect(response.status).toBe(403);
    });

    it("should return 403 when user has role staff_boutique (non-admin)", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_BOUTIQUE]);

      // Act
      const response = await request(app)
        .post("/api/sync/config")
        .send(validBody);

      expect(response.status).toBe(403);
    });

    it("should return 200 when user has role admin", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.ADMIN]);

      // Act
      const response = await request(app)
        .post("/api/sync/config")
        .send(validBody);

      // Assert
      expect(response.status).toBe(200);
    });

    // Verrou anti-régression : seul admin est accepté
    it.each(
      Object.values(USER_ROLES).filter((r) => r !== USER_ROLES.ADMIN)
    )(
      "should return 403 for non-admin role: %s",
      async (role) => {
        // Arrange
        const app = await buildApp([role]);

        // Act
        const response = await request(app)
          .post("/api/sync/config")
          .send(validBody);

        expect(response.status).toBe(403);
      }
    );

  });

  // =========================================================================
  // POST /api/sync/check-master — doit exiger une session authentifiée
  // =========================================================================

  describe("POST /api/sync/check-master (doit exiger auth)", () => {

    it("should return 401 when no session is present", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app)
        .post("/api/sync/check-master")
        .send({ deviceId: "device-123" });

      expect(response.status).toBe(401);
    });

    it("should return 200 when user is authenticated with role staff_zombie", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_ZOMBIE]);

      // Act
      const response = await request(app)
        .post("/api/sync/check-master")
        .send({ deviceId: "device-123" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("isMaster");
      expect(response.body).toHaveProperty("isOnlineMode");
    });

    it.each(Object.values(USER_ROLES))(
      "should return 200 for authenticated user with role %s",
      async (role) => {
        // Arrange
        const app = await buildApp([role]);

        // Act
        const response = await request(app)
          .post("/api/sync/check-master")
          .send({ deviceId: "device-test" });

        // Assert
        expect(response.status).toBe(200);
      }
    );

  });

  // =========================================================================
  // POST /api/sync/data — doit exiger une session authentifiée
  // =========================================================================

  describe("POST /api/sync/data (doit exiger auth)", () => {

    it("should return 401 when no session is present", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app)
        .post("/api/sync/data")
        .send({ deviceId: "device-123", syncData: {} });

      expect(response.status).toBe(401);
    });

    it("should return 200 in online mode when user is authenticated", async () => {
      // Arrange — getSyncConfig mocké retourne isOnlineMode: true
      const app = await buildApp([USER_ROLES.STAFF_ZOMBIE]);

      // Act
      const response = await request(app)
        .post("/api/sync/data")
        .send({ deviceId: "device-123", syncData: {} });

      // Assert
      expect(response.status).toBe(200);
    });

    it.each(Object.values(USER_ROLES))(
      "should return 200 for authenticated user with role %s (online mode)",
      async (role) => {
        // Arrange
        const app = await buildApp([role]);

        // Act
        const response = await request(app)
          .post("/api/sync/data")
          .send({ deviceId: "device-test", syncData: {} });

        // Assert
        expect(response.status).toBe(200);
      }
    );

  });

  // =========================================================================
  // POST /api/sync/trigger — doit exiger une session authentifiée
  // =========================================================================

  describe("POST /api/sync/trigger (doit exiger auth)", () => {

    it("should return 401 when no session is present", async () => {
      // Arrange
      const app = await buildApp(undefined);

      // Act
      const response = await request(app)
        .post("/api/sync/trigger")
        .send({ timestamp: Date.now(), source: "manual" });

      expect(response.status).toBe(401);
    });

    it("should return 200 when user is authenticated with role admin", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.ADMIN]);

      // Act
      const response = await request(app)
        .post("/api/sync/trigger")
        .send({ timestamp: Date.now(), source: "manual" });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 200 when user is authenticated with role staff_zombie", async () => {
      // Arrange
      const app = await buildApp([USER_ROLES.STAFF_ZOMBIE]);

      // Act
      const response = await request(app)
        .post("/api/sync/trigger")
        .send({ timestamp: Date.now(), source: "manual" });

      // Assert
      expect(response.status).toBe(200);
    });

    it.each(Object.values(USER_ROLES))(
      "should return 200 for authenticated user with role %s",
      async (role) => {
        // Arrange
        const app = await buildApp([role]);

        // Act
        const response = await request(app)
          .post("/api/sync/trigger")
          .send({ timestamp: Date.now(), source: "test" });

        // Assert
        expect(response.status).toBe(200);
      }
    );

  });

});
