/**
 * Tests DIP — MOD-2
 *
 * Vérifie que registerEventIngestRoutes utilise le storageDep injecté
 * et non le singleton global storage.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import type { IEventStorage } from "../../server/storage-interfaces";
import type { InsertServerEvent } from "@shared/schema";

// Mock du module storage pour éviter l'initialisation de la connexion DB
// (DATABASE_URL non disponible en test unitaire).
// Le storageDep injecté dans chaque test remplace complètement le singleton.
vi.mock("../../server/storage", () => ({
  storage: {
    ingestEvents: vi.fn(),
    getServerLamportTs: vi.fn(),
    appendEvents: vi.fn(),
    bumpServerLamportTs: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helper — construit une mini-app avec le stub injecté
// ---------------------------------------------------------------------------

async function buildAppWithStub(
  storageDep: Pick<IEventStorage, "ingestEvents" | "getServerLamportTs" | "appendEvents" | "bumpServerLamportTs">,
): Promise<Express> {
  const { registerEventIngestRoutes } = await import("../../server/event-ingest-routes");

  const app = express();
  app.use(express.json());

  // Session staff fictive
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      user: { id: 1, username: "staff_test", roles: JSON.stringify(["staff_zombie"]) },
    };
    next();
  });

  // Inject header X-Device-ID
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.headers["x-device-id"] = "device-stub-001";
    next();
  });

  registerEventIngestRoutes(app, storageDep);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerEventIngestRoutes — DIP injection du storageDep", () => {

  it("should use the injected storageDep.ingestEvents instead of the global storage singleton", async () => {
    // Arrange — stub qui capture les appels
    const stubIngestEvents = vi.fn().mockResolvedValue({
      inserted: 1,
      duplicates: 0,
      serverLamportTs: 42,
    });
    const stubGetServerLamportTs = vi.fn().mockResolvedValue(0);
    const stubAppendEvents = vi.fn().mockResolvedValue({ inserted: 1, duplicates: 0 });
    const stubBumpServerLamportTs = vi.fn().mockResolvedValue(1);

    const storageDep: Pick<IEventStorage, "ingestEvents" | "getServerLamportTs" | "appendEvents" | "bumpServerLamportTs"> = {
      ingestEvents: stubIngestEvents,
      getServerLamportTs: stubGetServerLamportTs,
      appendEvents: stubAppendEvents,
      bumpServerLamportTs: stubBumpServerLamportTs,
    };

    const app = await buildAppWithStub(storageDep);

    const event = {
      eventUuid: crypto.randomUUID(),
      aggregateId: crypto.randomUUID(),
      aggregateType: "participant" as const,
      eventType: "participant.checked_in",
      payload: { participantId: 1 },
      clientEventId: crypto.randomUUID(),
      deviceId: "device-stub-001",
      lamportTs: 5,
      wallClockTs: Date.now(),
      schemaVersion: 1,
    };

    // Act
    const response = await request(app)
      .post("/api/events/bulk-ingest")
      .send({ events: [event] });

    // Assert — le stub injecté est utilisé, pas le singleton global
    expect(response.status).toBe(200);
    expect(stubIngestEvents).toHaveBeenCalledTimes(1);
    // La réponse utilise le serverLamportTs retourné par le stub
    expect(response.body.serverLamportTs).toBe(42);
  });

  it("should pass the correct events to storageDep.ingestEvents", async () => {
    // Arrange
    const capturedArgs: { events: InsertServerEvent[]; minLamport: number }[] = [];
    const storageDep: Pick<IEventStorage, "ingestEvents" | "getServerLamportTs" | "appendEvents" | "bumpServerLamportTs"> = {
      ingestEvents: vi.fn().mockImplementation(
        async (events: InsertServerEvent[], minLamport: number) => {
          capturedArgs.push({ events, minLamport });
          return { inserted: events.length, duplicates: 0, serverLamportTs: minLamport + 1 };
        }
      ),
      getServerLamportTs: vi.fn().mockResolvedValue(0),
      appendEvents: vi.fn().mockResolvedValue({ inserted: 0, duplicates: 0 }),
      bumpServerLamportTs: vi.fn().mockResolvedValue(1),
    };

    const app = await buildAppWithStub(storageDep);

    const uuid = crypto.randomUUID();
    const event = {
      eventUuid: uuid,
      aggregateId: "agg-001",
      aggregateType: "purchase" as const,
      eventType: "purchase.created",
      payload: { amount: 99 },
      clientEventId: crypto.randomUUID(),
      deviceId: "device-stub-001",
      lamportTs: 7,
      wallClockTs: Date.now(),
      schemaVersion: 1,
    };

    // Act
    await request(app)
      .post("/api/events/bulk-ingest")
      .send({ events: [event] });

    // Assert — ingestEvents reçoit l'event avec l'uuid correct et minLamport = 7
    expect(capturedArgs).toHaveLength(1);
    expect(capturedArgs[0].events[0].eventUuid).toBe(uuid);
    expect(capturedArgs[0].minLamport).toBe(7);
  });

  it("should fallback to storageDep.appendEvents when storageDep.ingestEvents throws", async () => {
    // Arrange — ingestEvents échoue, appendEvents réussit
    const stubAppendEvents = vi.fn().mockResolvedValue({ inserted: 1, duplicates: 0 });
    const storageDep: Pick<IEventStorage, "ingestEvents" | "getServerLamportTs" | "appendEvents" | "bumpServerLamportTs"> = {
      ingestEvents: vi.fn().mockRejectedValue(new Error("Transaction échouée")),
      getServerLamportTs: vi.fn().mockResolvedValue(0),
      appendEvents: stubAppendEvents,
      bumpServerLamportTs: vi.fn().mockResolvedValue(1),
    };

    const app = await buildAppWithStub(storageDep);

    const event = {
      eventUuid: crypto.randomUUID(),
      aggregateId: "agg-002",
      aggregateType: "squad" as const,
      eventType: "squad.updated",
      payload: {},
      clientEventId: crypto.randomUUID(),
      deviceId: "device-stub-001",
      lamportTs: 3,
      wallClockTs: Date.now(),
      schemaVersion: 1,
    };

    // Act
    const response = await request(app)
      .post("/api/events/bulk-ingest")
      .send({ events: [event] });

    // Assert — fallback déclenché, pas de 500
    expect(response.status).toBe(200);
    expect(stubAppendEvents).toHaveBeenCalledTimes(1);
  });

});
