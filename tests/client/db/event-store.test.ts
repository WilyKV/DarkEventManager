/**
 * TDD Red Phase — event-store (IndexedDB via Dexie)
 *
 * Prerequisites (to be installed by developer/test-verifier):
 *   npm install dexie
 *   npm install --save-dev fake-indexeddb
 *
 * The polyfill below replaces the native IndexedDB API with a fully in-memory
 * implementation so Dexie works under jsdom (which ships without IndexedDB).
 * Option (a) chosen: import scoped to this file — does not pollute other tests.
 */
import "fake-indexeddb/auto";

// @ts-expect-error US-1 - event-store not yet implemented by developer
import {
  db,
  appendEvent,
  getUnsyncedEvents,
  markEventsSynced,
  getEventsByAggregate,
  getNextLamportTs,
  clearAllEvents,
// @ts-expect-error US-1 - AppEvent type not yet exported
} from "@/db/event-store";

import { beforeEach, describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid input for appendEvent (omits createdAt and syncedAt). */
function buildEventInput(overrides: Partial<{
  eventUuid: string;
  aggregateId: string;
  aggregateType: "participant" | "purchase" | "meal_purchase" | "squad";
  eventType: string;
  payload: Record<string, unknown>;
  clientEventId: string;
  deviceId: string;
  lamportTs: number;
  wallClockTs: number;
  schemaVersion: number;
  correlationId?: string;
}> = {}) {
  return {
    eventUuid: "550e8400-e29b-41d4-a716-446655440000",
    aggregateId: "participant-42",
    aggregateType: "participant" as const,
    eventType: "ParticipantCheckedIn",
    payload: { checkedInBy: "device-a" },
    clientEventId: "client-uuid-001",
    deviceId: "device-a",
    lamportTs: 1,
    wallClockTs: 1_700_000_000_000,
    schemaVersion: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup: wipe the store before each test for full isolation
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await clearAllEvents();
});

// ---------------------------------------------------------------------------
// appendEvent
// ---------------------------------------------------------------------------

describe("event-store — appendEvent", () => {
  it("should store an event and make it retrievable via getEventsByAggregate", async () => {
    // Arrange
    const input = buildEventInput();

    // Act
    await appendEvent(input);
    const events = await getEventsByAggregate("participant-42");

    // Assert
    expect(events).toHaveLength(1);
    expect(events[0].eventUuid).toBe(input.eventUuid);
    expect(events[0].aggregateId).toBe("participant-42");
    expect(events[0].eventType).toBe("ParticipantCheckedIn");
  });

  it("should be idempotent: appending the same eventUuid twice stores only one record", async () => {
    // Arrange
    const input = buildEventInput();

    // Act
    const first = await appendEvent(input);
    const second = await appendEvent(input); // duplicate uuid
    const events = await getEventsByAggregate("participant-42");

    // Assert
    expect(events).toHaveLength(1);
    expect(first.eventUuid).toBe(second.eventUuid);
    expect(first.createdAt).toBe(second.createdAt); // returns the already-stored record
  });

  it("should automatically set createdAt on the stored event", async () => {
    // Arrange
    const before = Date.now();
    const input = buildEventInput();

    // Act
    const stored = await appendEvent(input);
    const after = Date.now();

    // Assert
    expect(stored.createdAt).toBeGreaterThanOrEqual(before);
    expect(stored.createdAt).toBeLessThanOrEqual(after);
  });

  it("should set syncedAt to null on the stored event", async () => {
    // Arrange
    const input = buildEventInput();

    // Act
    const stored = await appendEvent(input);

    // Assert
    expect(stored.syncedAt).toBeNull();
  });

  it("should produce strictly increasing lamportTs across consecutive appends", async () => {
    // Arrange — two events for different aggregates
    const inputA = buildEventInput({
      eventUuid: "uuid-a",
      aggregateId: "participant-1",
    });
    const inputB = buildEventInput({
      eventUuid: "uuid-b",
      aggregateId: "participant-2",
    });

    // Act
    const storedA = await appendEvent(inputA);
    const storedB = await appendEvent(inputB);

    // Assert — each call to appendEvent uses getNextLamportTs internally,
    // so the second stored lamportTs must be strictly greater.
    expect(storedB.lamportTs).toBeGreaterThan(storedA.lamportTs);
  });
});

// ---------------------------------------------------------------------------
// getUnsyncedEvents
// ---------------------------------------------------------------------------

describe("event-store — getUnsyncedEvents", () => {
  it("should return only events where syncedAt is null", async () => {
    // Arrange
    await appendEvent(buildEventInput({ eventUuid: "uuid-1", lamportTs: 1 }));
    await appendEvent(buildEventInput({ eventUuid: "uuid-2", aggregateId: "participant-99", lamportTs: 2 }));
    await markEventsSynced(["uuid-1"]);

    // Act
    const unsynced = await getUnsyncedEvents();

    // Assert
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0].eventUuid).toBe("uuid-2");
  });

  it("should order unsynced events by lamportTs ASC then wallClockTs ASC as tie-break", async () => {
    // Arrange — inject three events with explicit lamportTs / wallClockTs
    // to control ordering independently from insertion order.
    await appendEvent(buildEventInput({ eventUuid: "uuid-high", lamportTs: 10, wallClockTs: 1000 }));
    await appendEvent(buildEventInput({ eventUuid: "uuid-low",  lamportTs: 1,  wallClockTs: 9000 }));
    await appendEvent(buildEventInput({
      eventUuid: "uuid-mid-late",
      aggregateId: "participant-2",
      lamportTs: 5,
      wallClockTs: 2000,
    }));
    await appendEvent(buildEventInput({
      eventUuid: "uuid-mid-early",
      aggregateId: "participant-3",
      lamportTs: 5,
      wallClockTs: 1000, // same lamportTs as uuid-mid-late → earlier wallClockTs wins
    }));

    // Act
    const unsynced = await getUnsyncedEvents();

    // Assert
    expect(unsynced.map((e: { eventUuid: string }) => e.eventUuid)).toEqual([
      "uuid-low",
      "uuid-mid-early",
      "uuid-mid-late",
      "uuid-high",
    ]);
  });

  it("should respect the limit parameter", async () => {
    // Arrange — 5 unsynced events
    for (let i = 1; i <= 5; i++) {
      await appendEvent(buildEventInput({ eventUuid: `uuid-${i}`, lamportTs: i }));
    }

    // Act
    const limited = await getUnsyncedEvents(2);

    // Assert
    expect(limited).toHaveLength(2);
  });

  it("should return an empty array when all events are already synced", async () => {
    // Arrange
    await appendEvent(buildEventInput({ eventUuid: "uuid-synced" }));
    await markEventsSynced(["uuid-synced"]);

    // Act
    const unsynced = await getUnsyncedEvents();

    // Assert
    expect(unsynced).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// markEventsSynced
// ---------------------------------------------------------------------------

describe("event-store — markEventsSynced", () => {
  it("should set syncedAt on listed events using the provided timestamp", async () => {
    // Arrange
    const syncTs = 1_700_100_000_000;
    await appendEvent(buildEventInput({ eventUuid: "uuid-a" }));

    // Act
    await markEventsSynced(["uuid-a"], syncTs);
    const events = await getEventsByAggregate("participant-42");

    // Assert
    expect(events[0].syncedAt).toBe(syncTs);
  });

  it("should set syncedAt to approximately Date.now() when no timestamp is provided", async () => {
    // Arrange
    const before = Date.now();
    await appendEvent(buildEventInput({ eventUuid: "uuid-b" }));

    // Act
    await markEventsSynced(["uuid-b"]);
    const after = Date.now();
    const events = await getEventsByAggregate("participant-42");

    // Assert
    expect(events[0].syncedAt).toBeGreaterThanOrEqual(before);
    expect(events[0].syncedAt).toBeLessThanOrEqual(after);
  });

  it("should leave unlisted events with syncedAt === null", async () => {
    // Arrange
    await appendEvent(buildEventInput({ eventUuid: "uuid-target" }));
    await appendEvent(buildEventInput({
      eventUuid: "uuid-bystander",
      aggregateId: "participant-99",
    }));

    // Act
    await markEventsSynced(["uuid-target"]);
    const bystanders = await getEventsByAggregate("participant-99");

    // Assert
    expect(bystanders[0].syncedAt).toBeNull();
  });

  it("should be idempotent: marking an already-synced event does not throw", async () => {
    // Arrange
    const syncTs = 1_700_200_000_000;
    await appendEvent(buildEventInput({ eventUuid: "uuid-c" }));
    await markEventsSynced(["uuid-c"], syncTs);

    // Act & Assert — second call must not throw
    await expect(markEventsSynced(["uuid-c"], syncTs + 1_000)).resolves.not.toThrow();
  });

  it("should silently ignore unknown UUIDs without throwing", async () => {
    // Act & Assert — no events stored, but no error expected
    await expect(
      markEventsSynced(["non-existent-uuid-xyz"])
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getEventsByAggregate
// ---------------------------------------------------------------------------

describe("event-store — getEventsByAggregate", () => {
  it("should return all events belonging to the given aggregateId", async () => {
    // Arrange
    await appendEvent(buildEventInput({ eventUuid: "uuid-p42-a", aggregateId: "participant-42", lamportTs: 1 }));
    await appendEvent(buildEventInput({ eventUuid: "uuid-p42-b", aggregateId: "participant-42", lamportTs: 2 }));
    await appendEvent(buildEventInput({ eventUuid: "uuid-p99",   aggregateId: "participant-99", lamportTs: 3 }));

    // Act
    const events = await getEventsByAggregate("participant-42");

    // Assert
    expect(events).toHaveLength(2);
    expect(events.every((e: { aggregateId: string }) => e.aggregateId === "participant-42")).toBe(true);
  });

  it("should order events by lamportTs ASC", async () => {
    // Arrange — insert in reverse lamport order
    await appendEvent(buildEventInput({ eventUuid: "uuid-ts3", aggregateId: "participant-42", lamportTs: 3 }));
    await appendEvent(buildEventInput({ eventUuid: "uuid-ts1", aggregateId: "participant-42", lamportTs: 1 }));
    await appendEvent(buildEventInput({ eventUuid: "uuid-ts2", aggregateId: "participant-42", lamportTs: 2 }));

    // Act
    const events = await getEventsByAggregate("participant-42");

    // Assert
    expect(events.map((e: { lamportTs: number }) => e.lamportTs)).toEqual([1, 2, 3]);
  });

  it("should return an empty array for an unknown aggregateId", async () => {
    // Act
    const events = await getEventsByAggregate("participant-does-not-exist");

    // Assert
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getNextLamportTs
// ---------------------------------------------------------------------------

describe("event-store — getNextLamportTs", () => {
  it("should return 1 on the very first call (empty store)", async () => {
    // Act
    const ts = await getNextLamportTs();

    // Assert
    expect(ts).toBe(1);
  });

  it("should return strictly incrementing values on successive calls", async () => {
    // Act
    const ts1 = await getNextLamportTs();
    const ts2 = await getNextLamportTs();
    const ts3 = await getNextLamportTs();

    // Assert
    expect(ts2).toBeGreaterThan(ts1);
    expect(ts3).toBeGreaterThan(ts2);
  });

  it("should persist the counter across db.close() and db.open() calls", async () => {
    // Arrange — advance the counter a few times
    await getNextLamportTs(); // 1
    await getNextLamportTs(); // 2
    const before = await getNextLamportTs(); // 3

    // Act — simulate a re-open cycle
    await db.close();
    await db.open();

    const after = await getNextLamportTs();

    // Assert — counter must resume after the highest persisted value
    expect(after).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// clearAllEvents
// ---------------------------------------------------------------------------

describe("event-store — clearAllEvents", () => {
  it("should empty the events table completely", async () => {
    // Arrange
    await appendEvent(buildEventInput({ eventUuid: "uuid-x", aggregateId: "participant-42" }));
    await appendEvent(buildEventInput({ eventUuid: "uuid-y", aggregateId: "participant-99" }));

    // Act
    await clearAllEvents();
    const eventsP42 = await getEventsByAggregate("participant-42");
    const eventsP99 = await getEventsByAggregate("participant-99");

    // Assert
    expect(eventsP42).toHaveLength(0);
    expect(eventsP99).toHaveLength(0);
  });

  it("should reset the Lamport counter so the next getNextLamportTs returns 1", async () => {
    // Arrange — advance counter
    await getNextLamportTs();
    await getNextLamportTs();

    // Act
    await clearAllEvents();
    const ts = await getNextLamportTs();

    // Assert — convention: reset brings counter back to 1
    expect(ts).toBe(1);
  });
});
