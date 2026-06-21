/**
 * Tests de non-régression — bug fix
 *
 * POST /api/sync/config doit accepter null pour masterDeviceId / masterDeviceName
 * afin de permettre le retour en mode en ligne (effacement de l'appareil maître).
 *
 * Régression : le schéma Zod z.string().optional() rejetait null → 400.
 * Correctif  : z.string().nullable().optional() accepte string | null | undefined.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { USER_ROLES } from "@shared/schema";

// ---------------------------------------------------------------------------
// Mock storage — pas de DB dans ces tests
// ---------------------------------------------------------------------------

const mockUpdateSyncConfig = vi.fn();
const mockGetSyncConfig = vi.fn();

vi.mock("../../server/storage", () => ({
  storage: {
    getSyncConfig: mockGetSyncConfig,
    updateSyncConfig: mockUpdateSyncConfig,
    updateLastSyncAt: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../server/sync-middleware", () => ({
  generateWebSocketToken: vi.fn().mockReturnValue("mock.token.signature"),
  getWebSocketSecret: vi.fn().mockReturnValue("mock-secret"),
  checkSyncPermissions: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// ---------------------------------------------------------------------------
// Helper — construit une mini-app avec session admin injectée
// ---------------------------------------------------------------------------

async function buildAdminApp(): Promise<Express> {
  const { registerSyncRoutes } = await import("../../server/sync-routes");

  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      user: {
        id: 1,
        username: "admin",
        roles: JSON.stringify([USER_ROLES.ADMIN]),
      },
    };
    next();
  });

  registerSyncRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("POST /api/sync/config — null pour masterDeviceId/masterDeviceName", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 when switching to online mode with null masterDeviceId and masterDeviceName", async () => {
    // Arrange — mock retourne la config avec master effacé
    mockUpdateSyncConfig.mockResolvedValue({
      id: 1,
      isOnlineMode: true,
      masterDeviceId: null,
      masterDeviceName: null,
      lastSyncAt: null,
    });
    const app = await buildAdminApp();

    // Act — corps envoyé par le client lors du retour en ligne
    const response = await request(app)
      .post("/api/sync/config")
      .send({ isOnlineMode: true, masterDeviceId: null, masterDeviceName: null });

    // Assert — schéma Zod accepte null, pas de 400
    expect(response.status).toBe(200);
    expect(response.body.masterDeviceId).toBeNull();
    expect(response.body.isOnlineMode).toBe(true);
  });

  it("should call storage.updateSyncConfig with null values when switching to online mode", async () => {
    // Arrange
    mockUpdateSyncConfig.mockResolvedValue({
      id: 1,
      isOnlineMode: true,
      masterDeviceId: null,
      masterDeviceName: null,
      lastSyncAt: null,
    });
    const app = await buildAdminApp();

    // Act
    await request(app)
      .post("/api/sync/config")
      .send({ isOnlineMode: true, masterDeviceId: null, masterDeviceName: null });

    // Assert — le storage reçoit bien null (pas undefined ni "null")
    expect(mockUpdateSyncConfig).toHaveBeenCalledWith({
      isOnlineMode: true,
      masterDeviceId: null,
      masterDeviceName: null,
    });
  });

  it("should return 200 and set master device when switching to offline mode with string values", async () => {
    // Arrange
    const masterDeviceId = "550e8400-e29b-41d4-a716-446655440000";
    const masterDeviceName = "Tablette 1";
    mockUpdateSyncConfig.mockResolvedValue({
      id: 1,
      isOnlineMode: false,
      masterDeviceId,
      masterDeviceName,
      lastSyncAt: null,
    });
    const app = await buildAdminApp();

    // Act
    const response = await request(app)
      .post("/api/sync/config")
      .send({ isOnlineMode: false, masterDeviceId, masterDeviceName });

    // Assert — comportement inchangé quand un string valide est fourni
    expect(response.status).toBe(200);
    expect(response.body.masterDeviceId).toBe(masterDeviceId);
    expect(response.body.masterDeviceName).toBe(masterDeviceName);
    expect(response.body.isOnlineMode).toBe(false);
  });

  it("should return 403 when user does not have admin role", async () => {
    // Arrange — on reconstruit l'app avec un rôle non-admin
    const { registerSyncRoutes } = await import("../../server/sync-routes");
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = {
        user: {
          id: 2,
          username: "staff",
          roles: JSON.stringify([USER_ROLES.STAFF_ZOMBIE]),
        },
      };
      next();
    });
    registerSyncRoutes(app);

    // Act
    const response = await request(app)
      .post("/api/sync/config")
      .send({ isOnlineMode: true, masterDeviceId: null, masterDeviceName: null });

    // Assert
    expect(response.status).toBe(403);
  });

});
