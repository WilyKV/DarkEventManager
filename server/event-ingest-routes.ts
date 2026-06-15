import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import type { IEventStorage } from "./storage-interfaces";
import type { InsertServerEvent } from "@shared/schema";
import { requireAuth } from "./auth-middleware";
import { BULK_INGEST_BATCH_MAX } from "./config/limits";
import { AGGREGATE_TYPES } from "@shared/aggregate-types";

// ---------------------------------------------------------------------------
// Types & Validation
// ---------------------------------------------------------------------------

const appEventSchema = z.object({
  eventUuid:     z.string().uuid(),
  aggregateId:   z.string(),
  aggregateType: z.enum(AGGREGATE_TYPES),
  eventType:     z.string(),
  payload:       z.record(z.unknown()),
  clientEventId: z.string(),
  deviceId:      z.string(),
  lamportTs:     z.number().int().min(0),
  wallClockTs:   z.number(),
  schemaVersion: z.number().int(),
  correlationId: z.string().optional(),
});

type AppEvent = z.infer<typeof appEventSchema>;

const bulkIngestBodySchema = z.object({
  events: z.array(z.unknown()),
});

// ---------------------------------------------------------------------------
// In-memory dedup set (module-level — persists for the lifetime of the process)
// Enables idempotent re-ingestion within a single server instance.
// ---------------------------------------------------------------------------

const seenEventUuids = new Set<string>();

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerEventIngestRoutes(
  app: Express,
  storageDep: Pick<IEventStorage, "ingestEvents" | "getServerLamportTs" | "appendEvents" | "bumpServerLamportTs"> = storage,
): void {

  app.post(
    "/api/events/bulk-ingest",
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      // 1. Header X-Device-ID requis
      const deviceId = req.headers["x-device-id"];
      if (!deviceId) {
        res.status(400).json({ message: "Header X-Device-ID requis" });
        return;
      }

      // 2. Validation du body (structure de base)
      const bodyResult = bulkIngestBodySchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({ message: "Body invalide", errors: bodyResult.error.errors });
        return;
      }

      const rawEvents = bodyResult.data.events;

      // 3. Taille max 500
      if (rawEvents.length > BULK_INGEST_BATCH_MAX) {
        res.status(413).json({ message: "Trop d'events : max 500 par batch" });
        return;
      }

      // 4. Validation par event
      const rejected: Array<{ eventUuid: string; reason: string }> = [];
      const validNewEvents: AppEvent[] = [];
      let duplicateCount = 0;

      for (const raw of rawEvents) {
        // Vérifier presence d'eventUuid avant validation Zod complète
        if (
          typeof raw !== "object" ||
          raw === null ||
          !("eventUuid" in raw) ||
          typeof (raw as Record<string, unknown>).eventUuid !== "string"
        ) {
          rejected.push({ eventUuid: "unknown", reason: "missing_event_uuid" });
          continue;
        }

        const uuid = (raw as Record<string, unknown>).eventUuid as string;

        // Validation Zod complète
        const parsed = appEventSchema.safeParse(raw);
        if (!parsed.success) {
          const errors = parsed.error.errors;
          const hasLamportError = errors.some((e) => e.path.includes("lamportTs"));
          const hasAggregateTypeError = errors.some((e) =>
            e.path.includes("aggregateType")
          );

          let reason = "invalid_event";
          if (hasLamportError) reason = "invalid_lamport_ts";
          else if (hasAggregateTypeError) reason = "unknown_aggregate_type";

          rejected.push({ eventUuid: uuid, reason });
          continue;
        }

        const event = parsed.data;

        // Check IDOR : le deviceId du body doit correspondre exactement au header
        // Comparaison stricte, case-sensitive, sans trim.
        const headerDeviceId = Array.isArray(deviceId) ? deviceId[0] : deviceId;
        if (event.deviceId !== headerDeviceId) {
          rejected.push({ eventUuid: event.eventUuid, reason: "device_id_mismatch" });
          continue;
        }

        // Déduplication en mémoire
        if (seenEventUuids.has(event.eventUuid)) {
          duplicateCount++;
          continue;
        }

        validNewEvents.push(event);
      }

      // 5 + 6. Persistence atomique (insert + bump Lamport) via ingestEvents
      let ingestedCount = 0;
      const allValidLamportTs = validNewEvents.map((e) => e.lamportTs);
      const minLamport =
        allValidLamportTs.length > 0 ? Math.max(...allValidLamportTs) : 0;

      let serverLamportTs: number;

      if (validNewEvents.length > 0) {
        const records: InsertServerEvent[] = validNewEvents.map((event) => ({
          eventUuid:     event.eventUuid,
          aggregateId:   event.aggregateId,
          aggregateType: event.aggregateType,
          eventType:     event.eventType,
          payload:       event.payload,
          clientEventId: event.clientEventId,
          deviceId:      event.deviceId,
          lamportTs:     event.lamportTs,
          wallClockTs:   event.wallClockTs,
          schemaVersion: event.schemaVersion,
          correlationId: event.correlationId ?? null,
        }));

        try {
          // Transaction atomique : insert ON CONFLICT DO NOTHING + bump Lamport
          const result = await storageDep.ingestEvents(records, minLamport);
          for (const event of validNewEvents) {
            seenEventUuids.add(event.eventUuid);
          }
          ingestedCount = result.inserted;
          duplicateCount += result.duplicates;
          serverLamportTs = result.serverLamportTs;
        } catch {
          // Fallback best-effort : persistence event par event si la transaction échoue
          for (const event of validNewEvents) {
            const record: InsertServerEvent = {
              eventUuid:     event.eventUuid,
              aggregateId:   event.aggregateId,
              aggregateType: event.aggregateType,
              eventType:     event.eventType,
              payload:       event.payload,
              clientEventId: event.clientEventId,
              deviceId:      event.deviceId,
              lamportTs:     event.lamportTs,
              wallClockTs:   event.wallClockTs,
              schemaVersion: event.schemaVersion,
              correlationId: event.correlationId ?? null,
            };
            try {
              await storageDep.appendEvents([record]);
              seenEventUuids.add(event.eventUuid);
              ingestedCount++;
            } catch {
              rejected.push({ eventUuid: event.eventUuid, reason: "persistence_error" });
            }
          }
          // Bump Lamport en best-effort également
          const currentServerTs = await storageDep.getServerLamportTs();
          const maxLamport = Math.max(currentServerTs, minLamport);
          serverLamportTs = await storageDep.bumpServerLamportTs(maxLamport);
        }
      } else {
        // Aucun événement valide : bump Lamport seul
        const currentServerTs = await storageDep.getServerLamportTs();
        serverLamportTs = await storageDep.bumpServerLamportTs(currentServerTs);
      }

      res.status(200).json({
        ingested: ingestedCount,
        duplicates: duplicateCount,
        rejected,
        serverLamportTs,
      });
    }
  );
}
