/**
 * Tests TDD — Red Phase
 *
 * US-2 : Endpoint d'ingestion d'events côté serveur.
 * POST /api/events/bulk-ingest
 *
 * Le fichier server/event-ingest-routes.ts n'existe pas encore.
 * Ces tests échoueront jusqu'à ce que le developer implémente l'endpoint.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Types (miroir de la spec — à partager via shared/ une fois le code produit)
// ---------------------------------------------------------------------------

interface AppEvent {
  eventUuid: string;
  aggregateId: string;
  aggregateType: "participant" | "purchase" | "meal_purchase" | "squad" | "discount";
  eventType: string;
  payload: Record<string, unknown>;
  clientEventId: string;
  deviceId: string;
  lamportTs: number;
  wallClockTs: number;
  schemaVersion: number;
  correlationId?: string;
}

interface BulkIngestResponse {
  ingested: number;
  duplicates: number;
  rejected: Array<{ eventUuid: string; reason: string }>;
  serverLamportTs: number;
}

// ---------------------------------------------------------------------------
// Mock storage
// Le developer devra ajouter ces méthodes à IStorage / storage.ts
// ---------------------------------------------------------------------------

const mockAppendEvents = vi.fn().mockResolvedValue(undefined);
const mockGetServerLamportTs = vi.fn().mockResolvedValue(0);
const mockBumpServerLamportTs = vi.fn().mockImplementation(async (min: number) => min + 1);

vi.mock("../../server/storage", () => ({
  storage: {
    appendEvents: mockAppendEvents,
    getServerLamportTs: mockGetServerLamportTs,
    bumpServerLamportTs: mockBumpServerLamportTs,
  },
}));

// ---------------------------------------------------------------------------
// Constantes partagées entre fixtures
// ---------------------------------------------------------------------------

/** DeviceId par défaut utilisé par buildValidEvent() et buildApp() pour éviter
 * tout mismatch IDOR involontaire dans les tests des sections 1-7. */
const TEST_DEVICE_ID = "device-test-001";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construit un AppEvent valide avec des valeurs par défaut surchargeable. */
function buildValidEvent(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    eventUuid: crypto.randomUUID(),
    aggregateId: crypto.randomUUID(),
    aggregateType: "participant",
    eventType: "participant.checked_in",
    payload: { participantId: 42 },
    clientEventId: crypto.randomUUID(),
    deviceId: TEST_DEVICE_ID,
    lamportTs: 1,
    wallClockTs: Date.now(),
    schemaVersion: 1,
    ...overrides,
  };
}

/**
 * Construit une mini-app Express qui :
 * 1. Injecte un utilisateur fictif via un middleware de session factice
 * 2. Monte les routes d'ingestion d'events
 *
 * @param authenticated - true = session staff valide, false = pas de session
 * @param deviceId - valeur du header X-Device-ID (undefined = header absent)
 */
async function buildApp(
  authenticated: boolean,
  deviceId?: string
): Promise<Express> {
  // Import dynamique pour que le mock vi.mock() soit résolu avant
  const { registerEventIngestRoutes } = await import("../../server/event-ingest-routes");

  const app = express();
  // Limite augmentée à 10MB pour permettre l'envoi de 500+ events en test
  app.use(express.json({ limit: "10mb" }));

  // Middleware de session factice
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (authenticated) {
      (req as any).session = {
        user: {
          id: 1,
          username: "staff_test",
          roles: JSON.stringify(["staff_zombie"]),
        },
      };
    } else {
      (req as any).session = {};
    }
    next();
  });

  // Middleware pour injecter X-Device-ID si fourni
  if (deviceId !== undefined) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.headers["x-device-id"] = deviceId;
      next();
    });
  }

  registerEventIngestRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("POST /api/events/bulk-ingest", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : compteur serveur à 0
    mockGetServerLamportTs.mockResolvedValue(0);
    mockBumpServerLamportTs.mockImplementation(async (min: number) => min + 1);
    mockAppendEvents.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // 1. Auth / Headers
  // -------------------------------------------------------------------------

  describe("authentification et headers obligatoires", () => {

    it("should return 401 when no session is present", async () => {
      // Arrange
      const app = await buildApp(false);

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .set("X-Device-ID", "device-001")
        .send({ events: [] });

      // Assert
      expect(response.status).toBe(401);
    });

    it("should return 400 with clear message when X-Device-ID header is missing", async () => {
      // Arrange — app sans injection du header X-Device-ID
      const app = await buildApp(true, undefined);

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [] });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/X-Device-ID/i);
    });

    it("should return 200 when authenticated staff with valid X-Device-ID header", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [] });

      // Assert
      expect(response.status).toBe(200);
    });

  });

  // -------------------------------------------------------------------------
  // 2. Validation Zod du body et des events
  // -------------------------------------------------------------------------

  describe("validation du body et des events", () => {

    it("should return 400 when body is empty object", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({});

      // Assert
      expect(response.status).toBe(400);
    });

    it("should return 400 when events field is a string instead of array", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: "pas un array" });

      // Assert
      expect(response.status).toBe(400);
    });

    it("should return 413 when more than 500 events are sent", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const events = Array.from({ length: 501 }, () => buildValidEvent());

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events });

      // Assert
      expect(response.status).toBe(413);
    });

    it("should accept exactly 500 events (limit boundary)", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const events = Array.from({ length: 500 }, () => buildValidEvent());

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events });

      // Assert
      expect(response.status).toBe(200);
    });

    it("should add event to rejected with reason missing_event_uuid when eventUuid is absent", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const invalidEvent = buildValidEvent() as any;
      delete invalidEvent.eventUuid;

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [invalidEvent] });

      // Assert — pas de 400 global, réponse 200 avec rejected
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0].reason).toBe("missing_event_uuid");
    });

    it("should add event to rejected with reason invalid_lamport_ts when lamportTs is negative", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const invalidEvent = buildValidEvent({ lamportTs: -1 });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [invalidEvent] });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0].eventUuid).toBe(invalidEvent.eventUuid);
      expect(body.rejected[0].reason).toBe("invalid_lamport_ts");
    });

    it("should add event to rejected with reason unknown_aggregate_type when aggregateType is unknown", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const invalidEvent = buildValidEvent({ aggregateType: "unknown" as any });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [invalidEvent] });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0].eventUuid).toBe(invalidEvent.eventUuid);
      expect(body.rejected[0].reason).toBe("unknown_aggregate_type");
    });

    it.each([
      ["participant", "participant.checked_in"],
      ["purchase", "purchase.created"],
      ["meal_purchase", "meal_purchase.created"],
      ["squad", "squad.updated"],
      ["discount", "discount.applied"],
    ] as Array<[AppEvent["aggregateType"], string]>)(
      "should accept valid aggregateType %s",
      async (aggregateType, eventType) => {
        // Arrange
        const app = await buildApp(true, TEST_DEVICE_ID);
        const event = buildValidEvent({ aggregateType, eventType });

        // Act
        const response = await request(app)
          .post("/api/events/bulk-ingest")
          .send({ events: [event] });

        // Assert
        expect(response.status).toBe(200);
        const body: BulkIngestResponse = response.body;
        expect(body.rejected.map((r) => r.eventUuid)).not.toContain(event.eventUuid);
      }
    );

    it("should return ingested 0 and rejected 0 when events array is empty", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [] });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.ingested).toBe(0);
      expect(body.duplicates).toBe(0);
      expect(body.rejected).toHaveLength(0);
    });

  });

  // -------------------------------------------------------------------------
  // 3. Idempotence (déduplication sur eventUuid)
  // -------------------------------------------------------------------------

  describe("idempotence et déduplication", () => {

    it("should return ingested 3 and duplicates 0 when sending 3 new events", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const events = [buildValidEvent(), buildValidEvent(), buildValidEvent()];

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.ingested).toBe(3);
      expect(body.duplicates).toBe(0);
      expect(body.rejected).toHaveLength(0);
    });

    it("should return ingested 0 and duplicates 3 when re-sending the exact same batch", async () => {
      // Arrange — on simule que ces events sont déjà en base
      // Le mock appendEvents ne persiste rien, on doit simuler le retour
      // du check de déduplication. Par convention, si appendEvents reçoit
      // des events déjà connus, le router doit les compter comme duplicates.
      // On simule via mockGetServerLamportTs qui retourne une valeur > 0,
      // mais la vraie simulation nécessite un état interne du mock.
      // Le developer devra implémenter un Set<eventUuid> dans l'endpoint.
      // Pour ce test, on envoie deux fois le même batch sur la même instance.
      const app = await buildApp(true, TEST_DEVICE_ID);
      const events = [buildValidEvent(), buildValidEvent(), buildValidEvent()];

      // Premier envoi
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events });

      // Act — deuxième envoi du même batch
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.ingested).toBe(0);
      expect(body.duplicates).toBe(3);
    });

    it("should return ingested 2 and duplicates 1 when mixing new and already-seen events", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const existingEvent = buildValidEvent();
      const newEvents = [buildValidEvent(), buildValidEvent()];

      // Premier envoi pour enregistrer existingEvent
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [existingEvent] });

      // Act — batch mixte : 2 nouveaux + 1 déjà vu
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [...newEvents, existingEvent] });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.ingested).toBe(2);
      expect(body.duplicates).toBe(1);
    });

    it("should use eventUuid as dedup key regardless of other fields changing", async () => {
      // Arrange — même UUID, payload différent
      const app = await buildApp(true, TEST_DEVICE_ID);
      const uuid = crypto.randomUUID();
      const originalEvent = buildValidEvent({ eventUuid: uuid, payload: { v: 1 } });
      const modifiedEvent = buildValidEvent({ eventUuid: uuid, payload: { v: 2 } });

      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [originalEvent] });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [modifiedEvent] });

      // Assert — l'UUID existant est reconnu comme duplicate même si le payload a changé
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.duplicates).toBe(1);
      expect(body.ingested).toBe(0);
    });

  });

  // -------------------------------------------------------------------------
  // 4. Persistence via IStorage mock
  // -------------------------------------------------------------------------

  describe("persistence via storage.appendEvents", () => {

    it("should call storage.appendEvents with only the new events (not duplicates)", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const existingEvent = buildValidEvent();
      const newEvent = buildValidEvent();

      // Premier envoi pour enregistrer existingEvent
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [existingEvent] });

      vi.clearAllMocks();
      mockGetServerLamportTs.mockResolvedValue(1);
      mockBumpServerLamportTs.mockResolvedValue(2);

      // Act — batch mixte
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [existingEvent, newEvent] });

      // Assert — appendEvents appelé une seule fois avec uniquement le nouvel event
      expect(mockAppendEvents).toHaveBeenCalledTimes(1);
      const calledWith: AppEvent[] = mockAppendEvents.mock.calls[0][0];
      expect(calledWith).toHaveLength(1);
      expect(calledWith[0].eventUuid).toBe(newEvent.eventUuid);
    });

    it("should NOT call storage.appendEvents when all events are duplicates", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const event = buildValidEvent();

      // Premier envoi
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      vi.clearAllMocks();

      // Act — renvoi du même event
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert — pas d'appel à appendEvents pour un batch 100% dupliqué
      expect(mockAppendEvents).not.toHaveBeenCalled();
    });

    it("should NOT call storage.appendEvents when all events are rejected", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const invalidEvent = buildValidEvent({ lamportTs: -1 });

      // Act
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [invalidEvent] });

      // Assert
      expect(mockAppendEvents).not.toHaveBeenCalled();
    });

    it("should call storage.appendEvents with events containing the deviceId from header", async () => {
      // Arrange
      const app = await buildApp(true, "device-tablet-42");
      const event = buildValidEvent({ deviceId: "device-tablet-42" });

      // Act
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert — l'event transmis à storage conserve son deviceId
      expect(mockAppendEvents).toHaveBeenCalledTimes(1);
      const calledWith: AppEvent[] = mockAppendEvents.mock.calls[0][0];
      expect(calledWith[0].deviceId).toBe("device-tablet-42");
    });

  });

  // -------------------------------------------------------------------------
  // 5. Compteur Lamport serveur
  // -------------------------------------------------------------------------

  describe("serverLamportTs dans la réponse", () => {

    it("should include serverLamportTs in every 200 response", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [] });

      // Assert
      expect(response.status).toBe(200);
      expect(typeof response.body.serverLamportTs).toBe("number");
    });

    it("should return serverLamportTs = serverCounter + 1 when max(received lamportTs) < serverCounter", async () => {
      // Arrange — server est à 10, client envoie lamportTs=5
      mockGetServerLamportTs.mockResolvedValue(10);
      mockBumpServerLamportTs.mockResolvedValue(11); // max(10, 5) + 1 = 11
      const app = await buildApp(true, TEST_DEVICE_ID);
      const event = buildValidEvent({ lamportTs: 5 });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.serverLamportTs).toBe(11);
      // bumpServerLamportTs doit être appelé avec min >= 10
      expect(mockBumpServerLamportTs).toHaveBeenCalledWith(expect.any(Number));
      const bumped: number = mockBumpServerLamportTs.mock.calls[0][0];
      expect(bumped).toBeGreaterThanOrEqual(10);
    });

    it("should return serverLamportTs = max(received lamportTs) + 1 when max(received lamportTs) > serverCounter", async () => {
      // Arrange — server est à 10, client envoie lamportTs=20
      mockGetServerLamportTs.mockResolvedValue(10);
      mockBumpServerLamportTs.mockResolvedValue(21); // max(10, 20) + 1 = 21
      const app = await buildApp(true, TEST_DEVICE_ID);
      const event = buildValidEvent({ lamportTs: 20 });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.serverLamportTs).toBe(21);
      // bumpServerLamportTs doit être appelé avec min = 20 (le max reçu)
      expect(mockBumpServerLamportTs).toHaveBeenCalledWith(20);
    });

    it("should compute serverLamportTs from max lamportTs across all valid events in batch", async () => {
      // Arrange — batch de 3 events avec lamportTs 5, 15, 10
      mockGetServerLamportTs.mockResolvedValue(0);
      mockBumpServerLamportTs.mockResolvedValue(16); // max(0, 15) + 1 = 16
      const app = await buildApp(true, TEST_DEVICE_ID);
      const events = [
        buildValidEvent({ lamportTs: 5 }),
        buildValidEvent({ lamportTs: 15 }),
        buildValidEvent({ lamportTs: 10 }),
      ];

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events });

      // Assert
      expect(response.body.serverLamportTs).toBe(16);
      // Le max doit être 15
      expect(mockBumpServerLamportTs).toHaveBeenCalledWith(15);
    });

    it("should still return a valid serverLamportTs even when all events are rejected", async () => {
      // Arrange
      mockGetServerLamportTs.mockResolvedValue(5);
      mockBumpServerLamportTs.mockResolvedValue(6);
      const app = await buildApp(true, TEST_DEVICE_ID);
      const invalidEvent = buildValidEvent({ lamportTs: -1 });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [invalidEvent] });

      // Assert — même si tous les events sont rejetés, serverLamportTs est bien retourné
      expect(response.status).toBe(200);
      expect(typeof response.body.serverLamportTs).toBe("number");
      expect(response.body.serverLamportTs).toBeGreaterThan(0);
    });

  });

  // -------------------------------------------------------------------------
  // 6. Echec partiel (best-effort, pas de transaction atomique)
  // -------------------------------------------------------------------------

  describe("echec partiel lors de la persistence", () => {

    it("should add event to rejected with reason persistence_error when storage.appendEvents throws for that event", async () => {
      // Arrange — appendEvents rejette pour le premier event uniquement
      // Le developer doit implémenter un mode best-effort event-par-event
      // ou grouper les erreurs individuelles. On suppose l'appel par batch
      // avec détection de l'event fautif.
      const app = await buildApp(true, TEST_DEVICE_ID);
      const failingEvent = buildValidEvent();
      const successEvent = buildValidEvent();

      // On fait échouer appendEvents uniquement quand l'event fautif est dans la liste
      mockAppendEvents.mockImplementation(async (events: AppEvent[]) => {
        const hasFailingEvent = events.some((e) => e.eventUuid === failingEvent.eventUuid);
        if (hasFailingEvent) {
          throw new Error("DB error simulée");
        }
      });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [failingEvent, successEvent] });

      // Assert — réponse partielle, pas de 500
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;

      // Au moins l'event fautif doit être dans rejected
      const rejectedUuids = body.rejected.map((r) => r.eventUuid);
      expect(rejectedUuids).toContain(failingEvent.eventUuid);
      const failingRejection = body.rejected.find((r) => r.eventUuid === failingEvent.eventUuid);
      expect(failingRejection?.reason).toBe("persistence_error");
    });

    it("should not fail globally (no 500) when storage.appendEvents throws", async () => {
      // Arrange
      mockAppendEvents.mockRejectedValue(new Error("DB indisponible"));
      const app = await buildApp(true, TEST_DEVICE_ID);
      const event = buildValidEvent();

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert — pas de 500, réponse best-effort
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0].reason).toBe("persistence_error");
    });

    it("should still ingest valid events when only some fail to persist", async () => {
      // Arrange — on simule un append qui échoue pour le 1er event seulement
      // En pratique, le developer doit appeler appendEvents event-par-event
      // ou attraper les erreurs individuellement.
      const app = await buildApp(true, TEST_DEVICE_ID);
      const failingEvent = buildValidEvent();
      const successEvent1 = buildValidEvent();
      const successEvent2 = buildValidEvent();

      let callCount = 0;
      mockAppendEvents.mockImplementation(async (events: AppEvent[]) => {
        callCount++;
        // Échoue seulement pour les batches contenant l'event fautif
        if (events.some((e) => e.eventUuid === failingEvent.eventUuid)) {
          throw new Error("Erreur partielle");
        }
      });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [failingEvent, successEvent1, successEvent2] });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      // Les events valides doivent être ingested, le fautif rejected
      expect(body.ingested).toBeGreaterThanOrEqual(2);
      expect(body.rejected.some((r) => r.eventUuid === failingEvent.eventUuid)).toBe(true);
    });

  });

  // -------------------------------------------------------------------------
  // 7. Structure de la réponse 200
  // -------------------------------------------------------------------------

  describe("structure de la réponse 200", () => {

    it("should return a response with ingested, duplicates, rejected and serverLamportTs fields", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [buildValidEvent()] });

      // Assert
      expect(response.status).toBe(200);
      const body = response.body;
      expect(body).toHaveProperty("ingested");
      expect(body).toHaveProperty("duplicates");
      expect(body).toHaveProperty("rejected");
      expect(body).toHaveProperty("serverLamportTs");
      expect(typeof body.ingested).toBe("number");
      expect(typeof body.duplicates).toBe("number");
      expect(Array.isArray(body.rejected)).toBe(true);
      expect(typeof body.serverLamportTs).toBe("number");
    });

    it("should return rejected entries with eventUuid and reason fields", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const invalidEvent = buildValidEvent({ lamportTs: -1 });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [invalidEvent] });

      // Assert
      const rejected = response.body.rejected as Array<{ eventUuid: string; reason: string }>;
      expect(rejected[0]).toHaveProperty("eventUuid");
      expect(rejected[0]).toHaveProperty("reason");
      expect(typeof rejected[0].eventUuid).toBe("string");
      expect(typeof rejected[0].reason).toBe("string");
    });

    it("should include eventUuid in rejected even for events without uuid (fallback identifier)", async () => {
      // Arrange
      const app = await buildApp(true, TEST_DEVICE_ID);
      const eventWithoutUuid = buildValidEvent() as any;
      delete eventWithoutUuid.eventUuid;

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [eventWithoutUuid] });

      // Assert — le champ eventUuid dans rejected doit exister même si absent
      // (le developer peut utiliser "unknown" ou un identifiant de fallback)
      const rejected = response.body.rejected as Array<{ eventUuid: string; reason: string }>;
      expect(rejected[0]).toHaveProperty("eventUuid");
    });

  });

  // -------------------------------------------------------------------------
  // 8. Protection IDOR — deviceId du body doit correspondre au header X-Device-ID
  // -------------------------------------------------------------------------
  //
  // HIGH-2 : server/event-ingest-routes.ts:91-95,170
  // Actuellement, event.deviceId (champ dans le body) n'est jamais comparé
  // au header X-Device-ID. Un attaquant peut envoyer des events avec le deviceId
  // d'un autre appareil en falsifiant le champ du body.
  //
  // Solution attendue : avant la persistence, vérifier que event.deviceId === headerDeviceId
  // (string equality exacte, case-sensitive).
  // Les events dont le deviceId ne correspond pas au header sont ajoutés à `rejected`
  // avec reason = "device_id_mismatch". Les autres events du batch sont traités normalement
  // (best-effort partiel, pas de rejet global).
  // -------------------------------------------------------------------------

  describe("protection IDOR — deviceId body vs header X-Device-ID", () => {

    beforeEach(() => {
      // Les tests IDOR s'appuient sur le nouveau contrat appendEvents { inserted, duplicates }.
      // On configure le mock pour retourner le nouveau format ; le developer devra migrer
      // l'implémentation pour que les tests passent.
      mockAppendEvents.mockResolvedValue({ inserted: 1, duplicates: 0 });
    });

    it("should ingest event when event.deviceId matches the X-Device-ID header exactly", async () => {
      // Arrange
      const app = await buildApp(true, "device-A");
      const event = buildValidEvent({ deviceId: "device-A" });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.ingested).toBe(1);
      expect(body.rejected.map((r) => r.eventUuid)).not.toContain(event.eventUuid);
    });

    it("should reject event with device_id_mismatch when event.deviceId differs from header", async () => {
      // Arrange — header indique device-A, event prétend venir de device-B (IDOR)
      const app = await buildApp(true, "device-A");
      const event = buildValidEvent({ deviceId: "device-B" });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      const rejection = body.rejected.find((r) => r.eventUuid === event.eventUuid);
      expect(rejection).toBeDefined();
      expect(rejection?.reason).toBe("device_id_mismatch");
      expect(body.ingested).toBe(0);
    });

    it("should ingest 2 matching events and reject 1 mismatched event in a mixed batch", async () => {
      // Arrange
      mockAppendEvents.mockResolvedValue({ inserted: 2, duplicates: 0 });
      const app = await buildApp(true, "device-A");
      const validEvent1 = buildValidEvent({ deviceId: "device-A" });
      const validEvent2 = buildValidEvent({ deviceId: "device-A" });
      const mismatchEvent = buildValidEvent({ deviceId: "device-B" });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [validEvent1, mismatchEvent, validEvent2] });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      expect(body.ingested).toBe(2);
      expect(body.rejected).toHaveLength(1);
      expect(body.rejected[0].eventUuid).toBe(mismatchEvent.eventUuid);
      expect(body.rejected[0].reason).toBe("device_id_mismatch");
    });

    it("should treat deviceId comparison as case-sensitive (Device-A vs device-A is a mismatch)", async () => {
      // Arrange — la comparaison est case-sensitive : "Device-A" !== "device-A"
      const app = await buildApp(true, "device-A");
      const event = buildValidEvent({ deviceId: "Device-A" });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      const rejection = body.rejected.find((r) => r.eventUuid === event.eventUuid);
      expect(rejection).toBeDefined();
      expect(rejection?.reason).toBe("device_id_mismatch");
    });

    it("should reject event when header has trailing space (strict comparison, no trim)", async () => {
      // Arrange — header = "device-A " (espace final), event.deviceId = "device-A"
      // Décision : comparaison STRICTE sans trim.
      // Rationale : le header avec espace est probablement une erreur de configuration
      // ou une tentative de bypass ; ne pas normaliser silencieusement est plus sécurisé.
      const app = await buildApp(true, "device-A ");
      const event = buildValidEvent({ deviceId: "device-A" });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert — strict : "device-A " !== "device-A" → mismatch
      expect(response.status).toBe(200);
      const body: BulkIngestResponse = response.body;
      const rejection = body.rejected.find((r) => r.eventUuid === event.eventUuid);
      expect(rejection).toBeDefined();
      expect(rejection?.reason).toBe("device_id_mismatch");
    });

    it("should not call storage.appendEvents for a mismatched event", async () => {
      // Arrange
      const app = await buildApp(true, "device-A");
      const mismatchEvent = buildValidEvent({ deviceId: "evil-device" });

      vi.clearAllMocks();

      // Act
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [mismatchEvent] });

      // Assert — appendEvents ne doit pas être appelé pour un event IDOR
      expect(mockAppendEvents).not.toHaveBeenCalled();
    });

    it("should call storage.appendEvents only with events whose deviceId matches the header", async () => {
      // Arrange
      const app = await buildApp(true, "device-A");
      const legitimateEvent = buildValidEvent({ deviceId: "device-A" });
      const spoofedEvent = buildValidEvent({ deviceId: "device-B" });

      vi.clearAllMocks();

      // Act
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [legitimateEvent, spoofedEvent] });

      // Assert — seul l'event légitime est transmis à storage
      const allCallArgs: AppEvent[][] = mockAppendEvents.mock.calls.map((c) => c[0]);
      const allPassedUuids = allCallArgs.flat().map((e: AppEvent) => e.eventUuid);
      expect(allPassedUuids).toContain(legitimateEvent.eventUuid);
      expect(allPassedUuids).not.toContain(spoofedEvent.eventUuid);
    });

  });

  // -------------------------------------------------------------------------
  // 9. Contrat appendEvents retourne { inserted, duplicates }
  // -------------------------------------------------------------------------
  //
  // CRIT-5 : seenEventUuids Set non borné dans event-ingest-routes.ts:45
  // Ce Set grossit indéfiniment avec la durée de vie du process (memory leak).
  //
  // Solution attendue : déléguer la déduplication entièrement à storage.appendEvents
  // qui utilise ON CONFLICT DO NOTHING et retourne { inserted: number, duplicates: number }.
  // Le Set seenEventUuids est supprimé.
  //
  // Nouveau contrat de IStorage.appendEvents :
  //   appendEvents(events: InsertServerEvent[]): Promise<{ inserted: number; duplicates: number }>
  //   (au lieu de Promise<void>)
  //
  // La réponse de l'endpoint doit utiliser ces valeurs.
  // -------------------------------------------------------------------------

  describe("appendEvents retourne { inserted, duplicates } — nouveau contrat IStorage", () => {

    beforeEach(() => {
      vi.clearAllMocks();
      mockGetServerLamportTs.mockResolvedValue(0);
      mockBumpServerLamportTs.mockImplementation(async (min: number) => min + 1);
    });

    it("should use inserted count from appendEvents return value in the response", async () => {
      // Arrange — mock retourne le nouveau contrat { inserted, duplicates }
      mockAppendEvents.mockResolvedValue({ inserted: 2, duplicates: 0 });
      const app = await buildApp(true, "device-A");
      const events = [
        buildValidEvent({ deviceId: "device-A" }),
        buildValidEvent({ deviceId: "device-A" }),
      ];

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events });

      // Assert — ingested doit venir de la valeur retournée par appendEvents
      expect(response.status).toBe(200);
      expect(response.body.ingested).toBe(2);
    });

    it("should use duplicates count from appendEvents return value in the response", async () => {
      // Arrange — ON CONFLICT DO NOTHING : 1 inséré, 2 doublons (déjà en base)
      mockAppendEvents.mockResolvedValue({ inserted: 1, duplicates: 2 });
      const app = await buildApp(true, "device-A");
      const events = [
        buildValidEvent({ deviceId: "device-A" }),
        buildValidEvent({ deviceId: "device-A" }),
        buildValidEvent({ deviceId: "device-A" }),
      ];

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.ingested).toBe(1);
      expect(response.body.duplicates).toBe(2);
    });

    it("should call storage.appendEvents with all valid non-IDOR events in a single batch call", async () => {
      // Arrange — avec le nouveau contrat, appendEvents est appelé une seule fois
      // avec TOUS les events valides (plus de boucle event-par-event)
      mockAppendEvents.mockResolvedValue({ inserted: 3, duplicates: 0 });
      const app = await buildApp(true, "device-A");
      const events = [
        buildValidEvent({ deviceId: "device-A" }),
        buildValidEvent({ deviceId: "device-A" }),
        buildValidEvent({ deviceId: "device-A" }),
      ];

      vi.clearAllMocks();
      mockAppendEvents.mockResolvedValue({ inserted: 3, duplicates: 0 });
      mockGetServerLamportTs.mockResolvedValue(0);
      mockBumpServerLamportTs.mockImplementation(async (min: number) => min + 1);

      // Act
      await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events });

      // Assert — un seul appel groupé (batch), pas d'appel event-par-event
      expect(mockAppendEvents).toHaveBeenCalledTimes(1);
      const calledWith = mockAppendEvents.mock.calls[0][0] as AppEvent[];
      expect(calledWith).toHaveLength(3);
    });

    it("should report persistence_error when appendEvents throws (best-effort)", async () => {
      // Arrange — la DB est indisponible
      mockAppendEvents.mockRejectedValue(new Error("DB error"));
      const app = await buildApp(true, "device-A");
      const event = buildValidEvent({ deviceId: "device-A" });

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [event] });

      // Assert — pas de 500, best-effort
      expect(response.status).toBe(200);
      const rejection = response.body.rejected.find(
        (r: { eventUuid: string; reason: string }) => r.eventUuid === event.eventUuid
      );
      expect(rejection?.reason).toBe("persistence_error");
    });

    it("should return ingested 0 and duplicates 0 when events array is empty (no appendEvents call)", async () => {
      // Arrange
      const app = await buildApp(true, "device-A");

      vi.clearAllMocks();
      mockGetServerLamportTs.mockResolvedValue(0);
      mockBumpServerLamportTs.mockImplementation(async (min: number) => min + 1);

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .send({ events: [] });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.ingested).toBe(0);
      expect(response.body.duplicates).toBe(0);
      expect(mockAppendEvents).not.toHaveBeenCalled();
    });

  });

});
