/**
 * Types agrégats supportés par le système d'ingestion d'events.
 *
 * Source de vérité unique : importée par server/event-ingest-routes.ts.
 *
 * Note : client/src/db/event-store.ts définit son propre sous-ensemble
 * (union TypeScript inline sans "discount") — volontairement omis côté client.
 * TODO: aligner event-store.ts sur AGGREGATE_TYPES si le type "discount"
 * est un jour supporté côté client.
 */

export const AGGREGATE_TYPES = [
  "participant",
  "purchase",
  "meal_purchase",
  "squad",
  "discount",
] as const;

export type AggregateType = typeof AGGREGATE_TYPES[number];
