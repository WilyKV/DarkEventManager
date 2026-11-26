import { getTableColumns, getTableName, sql } from "drizzle-orm";
import { z } from "zod";
import {
  appConfig, auditLogs, demoRecords, eventReviews, discounts, mealDiscounts, mealItems, mealPurchases,
  participantCards, participants, playerProfiles, purchases, serverEvents, sessions, shopItems, squadAuditLog, squads, staffCompensations, timeSlots, users,
} from "@shared/schema";
import type { EventBackupSummary } from "@shared/event-backup";
import { db } from "./db";
import { hasSessionRole } from "./auth-middleware";
import { isBcryptHash, isLegacyHash } from "./password-hashing";

// Order the tables so referenced rows are restored before their dependents.
const identityTables = [
  users, appConfig, timeSlots, squads, participants, staffCompensations, shopItems, mealItems,
  discounts, mealDiscounts, purchases, mealPurchases, squadAuditLog, auditLogs, demoRecords, playerProfiles, participantCards, eventReviews,
];
const backupTables = [...identityTables, serverEvents];
const eventTables = [
  serverEvents, purchases, mealPurchases, discounts, mealDiscounts, squadAuditLog,
  staffCompensations, participants, squads, timeSlots, shopItems, mealItems,
];
const backupSchema = z.object({
  version: z.literal(1),
  createdAt: z.iso.datetime(),
  tables: z.record(z.string(), z.object({
    rows: z.string(),
    count: z.number().int().nonnegative(),
    nextId: z.int32().positive().optional(),
  }).strict()),
}).strict();

export type EventBackup = z.infer<typeof backupSchema>;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class InvalidEventBackup extends Error {}

async function readNextId(tx: Transaction, tableName: string) {
  const { rows: [sequence] } = await tx.execute<{ schemaname: string; sequencename: string }>(sql`
    SELECT schemaname, sequencename
    FROM pg_catalog.pg_sequences
    WHERE to_regclass(format('%I.%I', schemaname, sequencename)) = pg_get_serial_sequence(${tableName}, 'id')::regclass
  `);
  if (!sequence) throw new Error("Séquence d’identifiants introuvable.");
  const name = sql`${sql.identifier(sequence.schemaname)}.${sql.identifier(sequence.sequencename)}`;
  const { rows: [row] } = await tx.execute<{ next_id: number }>(sql`
    SELECT (last_value + CASE WHEN is_called THEN 1 ELSE 0 END)::integer AS next_id FROM ${name}
  `);
  return row.next_id;
}

export async function readEventBackup(): Promise<EventBackup> {
  return db.transaction(async tx => {
    const tables: EventBackup["tables"] = {};
    for (const table of backupTables) {
      const name = getTableName(table);
      const key = sql.identifier(table === serverEvents ? "event_uuid" : "id");
      const { rows: [data] } = await tx.execute<{ rows: string; count: number }>(sql`
        SELECT COALESCE(jsonb_agg(backup_row ORDER BY ${key}), '[]'::jsonb)::text AS rows,
          count(*)::integer AS count
        FROM ${table} AS backup_row
      `);
      tables[name] = data;
      if (table !== serverEvents) tables[name].nextId = await readNextId(tx, name);
    }
    return { version: 1, createdAt: new Date().toISOString(), tables };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export function inspectEventBackup(payload: unknown): { backup: EventBackup; summary: EventBackupSummary } {
  const parsed = backupSchema.safeParse(payload);
  if (!parsed.success || Object.keys(parsed.data.tables).some(name => !backupTables.some(table => getTableName(table) === name))) {
    throw new InvalidEventBackup("Ce fichier ne correspond pas à une sauvegarde complète compatible.");
  }
  const backup = parsed.data;
  backup.tables[getTableName(participantCards)] ??= { rows: "[]", count: 0, nextId: 1 };
  backup.tables[getTableName(staffCompensations)] ??= { rows: "[]", count: 0, nextId: 1 };
  for (const table of [playerProfiles, eventReviews]) {
    backup.tables[getTableName(table)] ??= { rows: "[]", count: 0, nextId: 1 };
  }
  const records = new Map<string, Record<string, unknown>[]>();
  for (const table of backupTables) {
    const name = getTableName(table);
    const data = backup.tables[name];
    if (!data || (table !== serverEvents && data.nextId === undefined)) {
      throw new InvalidEventBackup("La sauvegarde est incomplète.");
    }
    const columns = Object.values(getTableColumns(table)).map(column => column.name);
    const rows: unknown = JSON.parse(data.rows);
    if ((table === appConfig || table === participantCards || table === participants || table === timeSlots) && Array.isArray(rows)) {
      for (const row of rows) {
        if (row && typeof row === "object") {
          const optionalColumns = table === appConfig ? ["event_closed_at", "souvenir_settings", "makeup_artists", "welcome_checklist"]
            : table === participants ? ["welcome_checks", "staff_specialization"] : table === timeSlots ? ["staff_assignment"] : ["photo_removed_at", "erasure_requested_at", "player_profile_id"];
          for (const column of optionalColumns) if (!Object.hasOwn(row, column)) row[column] = null;
        }
      }
      data.rows = JSON.stringify(rows);
    }
    if (!Array.isArray(rows) || rows.length !== data.count || rows.some(row =>
      !row || typeof row !== "object" || Object.keys(row).length !== columns.length ||
      columns.some(column => !Object.hasOwn(row, column))
    )) {
      throw new InvalidEventBackup("La sauvegarde contient des données incompatibles.");
    }
    records.set(name, rows);
  }
  if (!records.get(getTableName(users))?.some(user =>
    hasSessionRole(user.roles, ["admin"]) && typeof user.password_hash === "string" &&
    (isBcryptHash(user.password_hash) || isLegacyHash(user.password_hash))
  )) {
    throw new InvalidEventBackup("La sauvegarde doit contenir un compte administrateur utilisable.");
  }
  const eventDay = records.get(getTableName(appConfig))?.[0]?.event_day;
  return { backup, summary: {
    createdAt: backup.createdAt,
    eventDay: typeof eventDay === "string" ? eventDay : null,
    participants: backup.tables[getTableName(participants)].count,
    squads: backup.tables[getTableName(squads)].count,
    timeSlots: backup.tables[getTableName(timeSlots)].count,
    users: backup.tables[getTableName(users)].count,
  } };
}

export async function restoreEventBackup(backup: EventBackup): Promise<void> {
  await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
    // PostgreSQL rolls back the replacement and the sequence changes together.
    await tx.execute(sql`TRUNCATE TABLE ${sql.join([...backupTables, sessions], sql`, `)} CONTINUE IDENTITY`);
    for (const table of backupTables) {
      const { rows } = backup.tables[getTableName(table)];
      await tx.execute(sql`
        INSERT INTO ${table} OVERRIDING SYSTEM VALUE
        SELECT * FROM jsonb_populate_recordset(NULL::${table}, ${rows}::jsonb)
      `);
    }
    for (const table of identityTables) {
      const name = getTableName(table);
      const { rows: [row] } = await tx.execute<{ last_id: number }>(sql`SELECT COALESCE(max(id), 0) AS last_id FROM ${table}`);
      const nextId = Math.max(row.last_id + 1, backup.tables[name].nextId ?? 1, await readNextId(tx, name));
      // PostgreSQL's ALTER TABLE grammar requires an integer literal here.
      if (!Number.isSafeInteger(nextId) || nextId < 1 || nextId > 2_147_483_647) {
        throw new InvalidEventBackup("La sauvegarde contient des identifiants incompatibles.");
      }
      await tx.execute(sql`ALTER TABLE ${table} ALTER COLUMN id RESTART WITH ${sql.raw(String(nextId))}`);
    }
  });
}

export async function resetEventData(): Promise<void> {
  await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
    // Keep login accounts and their demo markers. Foreign keys remove the markers for deleted event records.
    await tx.execute(sql`LOCK TABLE ${sql.join([...eventTables, appConfig], sql`, `)} IN EXCLUSIVE MODE`);
    for (const table of eventTables) await tx.delete(table);
    await tx.update(appConfig).set({
      eventDay: null, eventClosedAt: null, souvenirSettings: null, makeupArtists: null, welcomeChecklist: null, analyticsStartedAt: null, serverLamportTs: 0, lastSyncAt: null, updatedAt: new Date(),
    });
  });
}
