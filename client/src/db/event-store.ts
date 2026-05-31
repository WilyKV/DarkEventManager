import Dexie, { type Table } from "dexie";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppEvent {
  eventUuid: string;
  aggregateId: string;
  aggregateType: "participant" | "purchase" | "meal_purchase" | "squad";
  eventType: string;
  payload: Record<string, unknown>;
  clientEventId: string;
  deviceId: string;
  lamportTs: number;
  wallClockTs: number;
  createdAt: number;
  syncedAt: number | null;
  schemaVersion: number;
  correlationId?: string;
}

interface MetaEntry {
  key: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Database definition
// ---------------------------------------------------------------------------

class EventDatabase extends Dexie {
  events!: Table<AppEvent, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super("darkeventmanager-events");
    this.version(1).stores({
      events: "eventUuid, aggregateId, syncedAt, lamportTs, [aggregateId+lamportTs]",
      meta: "key",
    });
  }
}

export const db = new EventDatabase();

// ---------------------------------------------------------------------------
// Lamport counter (persisted in meta table)
// ---------------------------------------------------------------------------

const META_KEY = "lamport_counter";

export async function getNextLamportTs(): Promise<number> {
  return db.transaction("rw", db.meta, async () => {
    const entry = await db.meta.get(META_KEY);
    const next = entry ? entry.value + 1 : 1;
    await db.meta.put({ key: META_KEY, value: next });
    return next;
  });
}

// ---------------------------------------------------------------------------
// appendEvent
// ---------------------------------------------------------------------------

export async function appendEvent(
  event: Omit<AppEvent, "createdAt" | "syncedAt">
): Promise<AppEvent> {
  const existing = await db.events.get(event.eventUuid);
  if (existing) {
    return existing;
  }

  const autoLamportTs = await getNextLamportTs();
  const effectiveLamportTs = Math.max(event.lamportTs, autoLamportTs);
  const stored: AppEvent = {
    ...event,
    lamportTs: event.lamportTs,
    createdAt: Date.now(),
    syncedAt: null,
  };

  await db.events.add(stored);
  return { ...stored, lamportTs: effectiveLamportTs };
}

// ---------------------------------------------------------------------------
// getUnsyncedEvents
// ---------------------------------------------------------------------------

export async function getUnsyncedEvents(limit?: number): Promise<AppEvent[]> {
  const results = await db.events
    .filter((event) => event.syncedAt === null)
    .toArray();

  results.sort((a, b) => {
    if (a.lamportTs !== b.lamportTs) return a.lamportTs - b.lamportTs;
    return a.wallClockTs - b.wallClockTs;
  });

  if (limit !== undefined) {
    return results.slice(0, limit);
  }
  return results;
}

// ---------------------------------------------------------------------------
// markEventsSynced
// ---------------------------------------------------------------------------

export async function markEventsSynced(
  eventUuids: string[],
  syncedAt?: number
): Promise<void> {
  const ts = syncedAt ?? Date.now();
  await db.transaction("rw", db.events, async () => {
    for (const uuid of eventUuids) {
      await db.events.where("eventUuid").equals(uuid).modify({ syncedAt: ts });
    }
  });
}

// ---------------------------------------------------------------------------
// getEventsByAggregate
// ---------------------------------------------------------------------------

export async function getEventsByAggregate(
  aggregateId: string
): Promise<AppEvent[]> {
  return db.events
    .where("[aggregateId+lamportTs]")
    .between([aggregateId, Dexie.minKey], [aggregateId, Dexie.maxKey])
    .toArray();
}

// ---------------------------------------------------------------------------
// clearAllEvents
// ---------------------------------------------------------------------------

export async function clearAllEvents(): Promise<void> {
  await db.transaction("rw", db.events, db.meta, async () => {
    await db.events.clear();
    await db.meta.put({ key: META_KEY, value: 0 });
  });
}
