/**
 * Tests TDD — Red Phase
 *
 * A.4 — Étendre checkSyncPermissions
 *
 * Le middleware checkSyncPermissions est déjà câblé sur :
 *   /api/participants, /api/time-slots, /api/squads,
 *   /api/shop-items, /api/meal-items, /api/dashboard
 *
 * Il N'EST PAS encore câblé sur :
 *   /api/purchases, /api/meal-purchases,
 *   /api/discounts, /api/meal-discounts
 *
 * Ces tests couvrent :
 *   - Mode online  → toutes les mutations passent sans X-Device-ID
 *   - Mode offline, device non-master → 403 avec message clair
 *   - Mode offline, device master → mutations acceptées
 *   - GET → toujours autorisé (pas de mutation)
 *   - Routes manquantes : purchases, meal-purchases, discounts, meal-discounts
 *   - Routes déjà protégées : participants, batch-checkin (batch-update)
 *
 * La plupart des tests sur les routes NON encore câblées échouent en Red Phase
 * car le middleware n'est pas appliqué : ces routes renvoient 200/201 au lieu de 403.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Configuration du mock storage
// ---------------------------------------------------------------------------

const mockConfig = {
  id: 1,
  isOnlineMode: true,          // modifiable dans les tests via mockResolvedValueOnce
  masterDeviceId: "master-device-uuid-001",
  masterDeviceName: "PC Maître",
  lastSyncAt: null,
};

vi.mock("../../server/storage", () => ({
  storage: {
    getSyncConfig: vi.fn(),
    // Participants
    getParticipants: vi.fn().mockResolvedValue([]),
    getParticipant: vi.fn().mockResolvedValue({ id: 1, firstName: "Test", lastName: "User", type: "zombie", secretCode: "12345" }),
    createParticipant: vi.fn().mockResolvedValue({ id: 2 }),
    updateParticipant: vi.fn().mockResolvedValue({ id: 1 }),
    batchUpdateParticipants: vi.fn().mockResolvedValue([]),
    generateSecretCode: vi.fn().mockResolvedValue("99999"),
    createSquadAuditLog: vi.fn().mockResolvedValue({}),
    // Purchases
    getPurchases: vi.fn().mockResolvedValue([]),
    getPurchase: vi.fn().mockResolvedValue({ id: 1 }),
    createPurchase: vi.fn().mockResolvedValue({ id: 2, idempotent: false }),
    updatePurchase: vi.fn().mockResolvedValue({ id: 1 }),
    deletePurchase: vi.fn().mockResolvedValue(undefined),
    // Meal purchases
    getMealPurchases: vi.fn().mockResolvedValue([]),
    getMealPurchase: vi.fn().mockResolvedValue({ id: 1 }),
    createMealPurchase: vi.fn().mockResolvedValue({ id: 2 }),
    updateMealPurchase: vi.fn().mockResolvedValue({ id: 1 }),
    deleteMealPurchase: vi.fn().mockResolvedValue(undefined),
    // Discounts
    getGlobalDiscounts: vi.fn().mockResolvedValue({ zombieDiscount: 0, survivantDiscount: 0, staffDiscount: 0 }),
    updateGlobalDiscounts: vi.fn().mockResolvedValue({}),
    getSquadDiscount: vi.fn().mockResolvedValue(0),
    setSquadDiscount: vi.fn().mockResolvedValue({}),
    getParticipantDiscount: vi.fn().mockResolvedValue(0),
    setParticipantDiscount: vi.fn().mockResolvedValue({}),
    calculateDiscount: vi.fn().mockResolvedValue(0),
    // Meal discounts
    getGlobalMealDiscounts: vi.fn().mockResolvedValue({}),
    updateGlobalMealDiscounts: vi.fn().mockResolvedValue({}),
    getSquadMealDiscount: vi.fn().mockResolvedValue(0),
    setSquadMealDiscount: vi.fn().mockResolvedValue({}),
    getParticipantMealDiscount: vi.fn().mockResolvedValue(null),
    setParticipantMealDiscount: vi.fn().mockResolvedValue({}),
    calculateMealDiscount: vi.fn().mockResolvedValue(0),
    // Audit
    createAuditLog: vi.fn().mockResolvedValue({}),
    // Time slots & squads (pour éviter les erreurs de routes non testées)
    getTimeSlots: vi.fn().mockResolvedValue([]),
    createTimeSlot: vi.fn().mockResolvedValue({ id: 1 }),
    updateTimeSlot: vi.fn().mockResolvedValue({ id: 1 }),
    deleteTimeSlot: vi.fn().mockResolvedValue(undefined),
    getSquads: vi.fn().mockResolvedValue([]),
    getSquadsWithParticipants: vi.fn().mockResolvedValue([]),
    createSquad: vi.fn().mockResolvedValue({ id: 1 }),
    updateSquad: vi.fn().mockResolvedValue({ id: 1 }),
    deleteSquad: vi.fn().mockResolvedValue(undefined),
    // Shop / meal items
    getShopItems: vi.fn().mockResolvedValue([]),
    getMealItems: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({}),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MASTER_DEVICE_ID = "master-device-uuid-001";
const OTHER_DEVICE_ID = "other-device-uuid-002";

/**
 * Construit l'app Express complète (registerRoutes) avec une session admin
 * et un mode de sync paramétrable.
 */
async function buildApp(options: {
  isOnlineMode: boolean;
  deviceIdHeader?: string;     // valeur du header X-Device-ID sur la requête
}): Promise<Express> {
  const { storage } = await import("../../server/storage");
  const { registerRoutes } = await import("../../server/routes");

  // Configurer getSyncConfig selon le mode demandé
  (storage.getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...mockConfig,
    isOnlineMode: options.isOnlineMode,
  });

  const app = express();
  app.use(express.json());

  // Session admin factice — tous les tests A.4 sont centrés sur le mode sync,
  // pas sur les rôles (les routes de production n'ont pas encore requireAuth)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      user: { id: 1, username: "admin", roles: JSON.stringify(["admin"]) },
    };
    // Ajouter le header X-Device-ID si fourni
    if (options.deviceIdHeader) {
      req.headers["x-device-id"] = options.deviceIdHeader;
    }
    next();
  });

  await registerRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("checkSyncPermissions — comportement selon le mode de sync", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Mode ONLINE — toutes les mutations passent sans X-Device-ID
  // =========================================================================

  describe("mode isOnlineMode: true", () => {

    it("should allow POST /api/participants without X-Device-ID", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: true });

      // Act
      const response = await request(app)
        .post("/api/participants")
        .send({ firstName: "Jean", lastName: "Dupont", type: "zombie" });

      // Assert — 201 car la route crée le participant
      expect(response.status).toBe(201);
    });

    it("should allow PATCH /api/participants/:id without X-Device-ID", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: true });

      // Act
      const response = await request(app)
        .patch("/api/participants/1")
        .send({ arrived: true });

      // Assert
      expect(response.status).toBe(200);
    });

    it("should allow POST /api/purchases without X-Device-ID (route à protéger)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: true });

      // Act — corps minimal valide selon insertPurchaseSchema
      const response = await request(app)
        .post("/api/purchases")
        .send({
          participantId: 1,
          shopItemId: 1,
          quantity: 1,
          unitPrice: "5.00",
          originalPrice: "5.00",
          totalPrice: "5.00",
        });

      // Assert — 200 ou 201, pas 403
      expect([200, 201]).toContain(response.status);
    });

    it("should allow POST /api/meal-purchases without X-Device-ID (route à protéger)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: true });

      // Act
      const response = await request(app)
        .post("/api/meal-purchases")
        .send({ participantId: 1, mealItemId: 1, quantity: 1, unitPrice: "3.00", originalPrice: "3.00", totalPrice: "3.00" });

      // Assert — pas 403
      expect(response.status).not.toBe(403);
    });

    it("should allow PUT /api/discounts/global without X-Device-ID (route à protéger)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: true });

      // Act
      const response = await request(app)
        .put("/api/discounts/global")
        .send({ zombieDiscount: 10, survivantDiscount: 5, staffDiscount: 0 });

      // Assert — pas 403
      expect(response.status).not.toBe(403);
    });

    it("should allow PUT /api/meal-discounts/global without X-Device-ID (route à protéger)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: true });

      // Act
      const response = await request(app)
        .put("/api/meal-discounts/global")
        .send({ zombieDiscount: 10 });

      // Assert — pas 403
      expect(response.status).not.toBe(403);
    });

    it("should allow GET requests on any route without X-Device-ID", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: true });

      // Act
      const response = await request(app).get("/api/participants");

      // Assert
      expect(response.status).toBe(200);
    });

  });

  // =========================================================================
  // Mode OFFLINE, device NON-master — mutations rejetées avec 403
  // =========================================================================

  describe("mode isOnlineMode: false, device non-master", () => {

    // --- Routes déjà protégées (câblées sur checkSyncPermissions) ---

    it("should return 403 for POST /api/participants with wrong device ID (déjà protégée)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .post("/api/participants")
        .send({ firstName: "Jean", lastName: "Dupont", type: "zombie" });

      // Assert
      expect(response.status).toBe(403);
    });

    it("should return 403 for POST /api/participants with no X-Device-ID (déjà protégée)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false });

      // Act
      const response = await request(app)
        .post("/api/participants")
        .send({ firstName: "Jean", lastName: "Dupont", type: "zombie" });

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/hors ligne|offline|device/i);
    });

    it("should return 403 for PATCH /api/participants/:id with wrong device (déjà protégée)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .patch("/api/participants/1")
        .send({ arrived: true });

      // Assert
      expect(response.status).toBe(403);
    });

    it("should return 403 for POST /api/participants/batch-update with wrong device (déjà protégée)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .post("/api/participants/batch-update")
        .send({ updates: [{ id: 1, data: { arrived: true } }] });

      // Assert
      expect(response.status).toBe(403);
    });

    // --- Routes à protéger (ÉCHOUE en Red Phase — renvoie 200/201 au lieu de 403) ---

    it("should return 403 for POST /api/purchases with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .post("/api/purchases")
        .send({
          participantId: 1,
          shopItemId: 1,
          quantity: 1,
          unitPrice: "5.00",
          originalPrice: "5.00",
          totalPrice: "5.00",
        });

      // Assert — ÉCHOUE en Red Phase : route non câblée sur checkSyncPermissions
      expect(response.status).toBe(403);
    });

    it("should return 403 for PATCH /api/purchases/:id with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .patch("/api/purchases/1")
        .send({ isPaid: true });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for DELETE /api/purchases/:id with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app).delete("/api/purchases/1");

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for POST /api/meal-purchases with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .post("/api/meal-purchases")
        .send({ participantId: 1, mealItemId: 1, quantity: 1, unitPrice: "3.00", originalPrice: "3.00", totalPrice: "3.00" });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for PATCH /api/meal-purchases/:id with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .patch("/api/meal-purchases/1")
        .send({ isPaid: true });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for DELETE /api/meal-purchases/:id with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app).delete("/api/meal-purchases/1");

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for PUT /api/discounts/global with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .put("/api/discounts/global")
        .send({ zombieDiscount: 10, survivantDiscount: 5, staffDiscount: 0 });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for PUT /api/discounts/squad/:squadId with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .put("/api/discounts/squad/1")
        .send({ discount: 15 });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for PUT /api/discounts/participant/:participantId with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .put("/api/discounts/participant/1")
        .send({ discount: 20 });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for PUT /api/meal-discounts/global with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .put("/api/meal-discounts/global")
        .send({ zombieDiscount: 10 });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for PUT /api/meal-discounts/squad/:squadId with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .put("/api/meal-discounts/squad/1")
        .send({ discount: 5 });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    it("should return 403 for PUT /api/meal-discounts/participant/:participantId with wrong device (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .put("/api/meal-discounts/participant/1")
        .send({ discount: 10 });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(403);
    });

    // --- GET → toujours autorisé même en mode offline ---

    it("should allow GET /api/purchases regardless of device in offline mode", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app).get("/api/purchases");

      // Assert — les GET ne sont jamais bloqués
      expect(response.status).toBe(200);
    });

    it("should allow GET /api/meal-purchases regardless of device in offline mode", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false });

      // Act
      const response = await request(app).get("/api/meal-purchases");

      // Assert
      expect(response.status).toBe(200);
    });

    it("should allow GET /api/discounts/global regardless of device in offline mode", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false });

      // Act
      const response = await request(app).get("/api/discounts/global");

      // Assert
      expect(response.status).toBe(200);
    });

    it("should allow GET /api/meal-discounts/global regardless of device in offline mode", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false });

      // Act
      const response = await request(app).get("/api/meal-discounts/global");

      // Assert
      expect(response.status).toBe(200);
    });

    it("should include a clear error message when rejecting a non-master device", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .post("/api/participants")
        .send({ firstName: "Jean", lastName: "Dupont", type: "zombie" });

      // Assert — le message doit mentionner le mode hors ligne (déjà implémenté dans middleware)
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("message");
      expect(response.body.isOnlineMode).toBe(false);
    });

    it("should include isMaster: false in response body when device is not master", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: OTHER_DEVICE_ID });

      // Act
      const response = await request(app)
        .post("/api/participants")
        .send({ firstName: "Jean", lastName: "Dupont", type: "zombie" });

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.isMaster).toBe(false);
    });

  });

  // =========================================================================
  // Mode OFFLINE, device MASTER — mutations acceptées
  // =========================================================================

  describe("mode isOnlineMode: false, device master", () => {

    it("should allow POST /api/participants with master device ID (déjà protégée)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: MASTER_DEVICE_ID });

      // Act
      const response = await request(app)
        .post("/api/participants")
        .send({ firstName: "Jean", lastName: "Dupont", type: "zombie" });

      // Assert — le device maître peut créer
      expect(response.status).toBe(201);
    });

    it("should allow PATCH /api/participants/:id with master device ID (déjà protégée)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: MASTER_DEVICE_ID });

      // Act
      const response = await request(app)
        .patch("/api/participants/1")
        .send({ arrived: true });

      // Assert
      expect(response.status).toBe(200);
    });

    it("should allow POST /api/purchases with master device ID (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: MASTER_DEVICE_ID });

      // Act
      const response = await request(app)
        .post("/api/purchases")
        .send({
          participantId: 1,
          shopItemId: 1,
          quantity: 1,
          unitPrice: "5.00",
          originalPrice: "5.00",
          totalPrice: "5.00",
        });

      // Assert — ÉCHOUE en Red Phase : le middleware n'est pas câblé sur /api/purchases
      // Une fois câblé, le device master doit avoir 200 ou 201
      expect([200, 201]).toContain(response.status);
    });

    it("should allow POST /api/meal-purchases with master device ID (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: MASTER_DEVICE_ID });

      // Act
      const response = await request(app)
        .post("/api/meal-purchases")
        .send({ participantId: 1, mealItemId: 1, quantity: 1, unitPrice: "3.00", originalPrice: "3.00", totalPrice: "3.00" });

      // Assert — ÉCHOUE en Red Phase
      expect([200, 201]).toContain(response.status);
    });

    it("should allow PUT /api/discounts/global with master device ID (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: MASTER_DEVICE_ID });

      // Act
      const response = await request(app)
        .put("/api/discounts/global")
        .send({ zombieDiscount: 10, survivantDiscount: 5, staffDiscount: 0 });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(200);
    });

    it("should allow PUT /api/meal-discounts/global with master device ID (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: MASTER_DEVICE_ID });

      // Act
      const response = await request(app)
        .put("/api/meal-discounts/global")
        .send({ zombieDiscount: 10 });

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(200);
    });

    it("should allow DELETE /api/purchases/:id with master device ID (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: MASTER_DEVICE_ID });

      // Act
      const response = await request(app).delete("/api/purchases/1");

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(200);
    });

    it("should allow DELETE /api/meal-purchases/:id with master device ID (ROUTE À PROTÉGER)", async () => {
      // Arrange
      const app = await buildApp({ isOnlineMode: false, deviceIdHeader: MASTER_DEVICE_ID });

      // Act
      const response = await request(app).delete("/api/meal-purchases/1");

      // Assert — ÉCHOUE en Red Phase
      expect(response.status).toBe(200);
    });

  });

  // =========================================================================
  // Paramétrage it.each sur les routes à protéger
  // =========================================================================

  describe("routes à protéger — paramétrage it.each", () => {

    /**
     * Routes de mutation NON câblées sur checkSyncPermissions.
     * En mode offline avec un device non-master, toutes doivent renvoyer 403.
     * En Red Phase, elles renvoient 200/201/204 — c'est le défaut à corriger.
     */
    const mutationRoutesToProtect = [
      { method: "post",   path: "/api/purchases",          body: { participantId: 1, shopItemId: 1, quantity: 1, unitPrice: "5.00", originalPrice: "5.00", totalPrice: "5.00" } },
      { method: "patch",  path: "/api/purchases/1",        body: { isPaid: true } },
      { method: "delete", path: "/api/purchases/1",        body: {} },
      { method: "post",   path: "/api/meal-purchases",     body: { participantId: 1, mealItemId: 1, quantity: 1, unitPrice: "3.00", originalPrice: "3.00", totalPrice: "3.00" } },
      { method: "patch",  path: "/api/meal-purchases/1",   body: { isPaid: true } },
      { method: "delete", path: "/api/meal-purchases/1",   body: {} },
      { method: "put",    path: "/api/discounts/global",   body: { zombieDiscount: 0, survivantDiscount: 0, staffDiscount: 0 } },
      { method: "put",    path: "/api/discounts/squad/1",  body: { discount: 10 } },
      { method: "put",    path: "/api/discounts/participant/1", body: { discount: 5 } },
      { method: "put",    path: "/api/meal-discounts/global",   body: { zombieDiscount: 0 } },
      { method: "put",    path: "/api/meal-discounts/squad/1",  body: { discount: 10 } },
      { method: "put",    path: "/api/meal-discounts/participant/1", body: { discount: 5 } },
    ] as const;

    it.each(mutationRoutesToProtect)(
      "should return 403 in offline mode for non-master device: $method $path",
      async ({ method, path, body }) => {
        // Arrange
        const { storage } = await import("../../server/storage");
        (storage.getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
          ...mockConfig,
          isOnlineMode: false,
        });

        const { registerRoutes } = await import("../../server/routes");
        const app = express();
        app.use(express.json());
        app.use((req: Request, _res: Response, next: NextFunction) => {
          (req as any).session = { user: { id: 1, username: "admin", roles: JSON.stringify(["admin"]) } };
          req.headers["x-device-id"] = OTHER_DEVICE_ID;
          next();
        });
        await registerRoutes(app);

        // Act
        const req = request(app)[method](path);
        const response = await req.send(body);

        // Assert — ÉCHOUE en Red Phase pour les routes non câblées
        expect(response.status).toBe(403);
      }
    );

    /**
     * Les mêmes routes en mode ONLINE doivent passer sans 403.
     */
    it.each(mutationRoutesToProtect)(
      "should NOT return 403 in online mode: $method $path",
      async ({ method, path, body }) => {
        // Arrange
        const { storage } = await import("../../server/storage");
        (storage.getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
          ...mockConfig,
          isOnlineMode: true,
        });

        const { registerRoutes } = await import("../../server/routes");
        const app = express();
        app.use(express.json());
        app.use((req: Request, _res: Response, next: NextFunction) => {
          (req as any).session = { user: { id: 1, username: "admin", roles: JSON.stringify(["admin"]) } };
          // Pas de header X-Device-ID intentionnellement
          next();
        });
        await registerRoutes(app);

        // Act
        const req = request(app)[method](path);
        const response = await req.send(body);

        // Assert — peu importe le code de retour, il ne doit pas être 403
        expect(response.status).not.toBe(403);
      }
    );

    /**
     * En mode offline avec le device MASTER, les mutations doivent passer.
     */
    it.each(mutationRoutesToProtect)(
      "should NOT return 403 for master device in offline mode: $method $path",
      async ({ method, path, body }) => {
        // Arrange
        const { storage } = await import("../../server/storage");
        (storage.getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
          ...mockConfig,
          isOnlineMode: false,
        });

        const { registerRoutes } = await import("../../server/routes");
        const app = express();
        app.use(express.json());
        app.use((req: Request, _res: Response, next: NextFunction) => {
          (req as any).session = { user: { id: 1, username: "admin", roles: JSON.stringify(["admin"]) } };
          req.headers["x-device-id"] = MASTER_DEVICE_ID;
          next();
        });
        await registerRoutes(app);

        // Act
        const req = request(app)[method](path);
        const response = await req.send(body);

        // Assert — ÉCHOUE en Red Phase pour les routes non câblées
        expect(response.status).not.toBe(403);
      }
    );

  });

});
