/**
 * BLE (Bluetooth Low Energy) Schema
 *
 * Database schema for the proximity detection system using:
 * - BLE beacons (survivant bracelets)
 * - ESP32 scanners (zombie bracelets with vibration)
 * - Hit tracking and validation
 * - Offline sync management
 */

import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { participants } from './schema';

/**
 * BEACONS TABLE
 * Physical BLE beacon hardware worn by survivants
 */
export const beacons = pgTable('beacons', {
  id: serial('id').primaryKey(),
  hardwareId: text('hardware_id').notNull().unique(), // UUID BLE (e.g., "A7C34E12-8F9A-01BC-D3E5-F67890ABCDEF:1:100")
  uuid: text('uuid'), // iBeacon UUID
  major: integer('major'), // iBeacon Major
  minor: integer('minor'), // iBeacon Minor
  name: text('name'), // Friendly name (e.g., "Beacon-001")
  status: text('status').notNull().default('available'), // available, assigned, in_use, lost, damaged
  batteryLevel: integer('battery_level'), // 0-100%
  lastSeenAt: timestamp('last_seen_at'), // Last time beacon was detected
  notes: text('notes'), // Staff notes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * SCANNERS TABLE
 * ESP32 scanner hardware worn by zombies
 */
export const scanners = pgTable('scanners', {
  id: serial('id').primaryKey(),
  hardwareId: text('hardware_id').notNull().unique(), // MAC address or unique device ID
  macAddress: text('mac_address'), // Bluetooth MAC address
  name: text('name'), // Friendly name (e.g., "Scanner-001")
  status: text('status').notNull().default('available'), // available, assigned, in_use, lost, damaged
  batteryLevel: integer('battery_level'), // 0-100%
  firmwareVersion: text('firmware_version'), // ESP32 firmware version
  lastSyncAt: timestamp('last_sync_at'), // Last time data was synced
  hitCount: integer('hit_count').default(0), // Total hits stored on device
  notes: text('notes'), // Staff notes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * BEACON ASSIGNMENTS TABLE
 * Track which beacon is assigned to which participant
 */
export const beaconAssignments = pgTable('beacon_assignments', {
  id: serial('id').primaryKey(),
  participantId: integer('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  beaconId: integer('beacon_id').notNull().references(() => beacons.id, { onDelete: 'cascade' }),
  sessionId: text('session_id'), // Game session identifier
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  assignedBy: integer('assigned_by'), // Staff user ID who assigned
  returnedAt: timestamp('returned_at'), // When beacon was returned
  returnedBy: integer('returned_by'), // Staff user ID who processed return
  status: text('status').notNull().default('active'), // active, returned, lost
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * SCANNER ASSIGNMENTS TABLE
 * Track which scanner is assigned to which zombie participant
 */
export const scannerAssignments = pgTable('scanner_assignments', {
  id: serial('id').primaryKey(),
  participantId: integer('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  scannerId: integer('scanner_id').notNull().references(() => scanners.id, { onDelete: 'cascade' }),
  squadId: integer('squad_id'), // Optional: assign to entire squad
  sessionId: text('session_id'), // Game session identifier
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  assignedBy: integer('assigned_by'), // Staff user ID who assigned
  returnedAt: timestamp('returned_at'), // When scanner was returned
  returnedBy: integer('returned_by'), // Staff user ID who processed return
  status: text('status').notNull().default('active'), // active, returned, lost
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * HITS TABLE
 * Touch events between zombies (scanners) and survivants (beacons)
 */
export const hits = pgTable('hits', {
  id: serial('id').primaryKey(),
  beaconId: integer('beacon_id').notNull().references(() => beacons.id),
  scannerId: integer('scanner_id').notNull().references(() => scanners.id),
  survivorId: integer('survivor_id').references(() => participants.id), // Survivant participant
  zombieId: integer('zombie_id').references(() => participants.id), // Zombie participant
  sessionId: text('session_id'), // Game session identifier

  // Hit metadata
  hitTimestamp: timestamp('hit_timestamp').notNull(), // When hit occurred (ESP32 time)
  rssi: integer('rssi').notNull(), // Signal strength at hit moment
  proximityDuration: integer('proximity_duration'), // How long in proximity (ms)

  // Sync metadata
  syncedAt: timestamp('synced_at').defaultNow(), // When hit was synced to backend
  syncSessionId: integer('sync_session_id'), // Reference to sync session

  // Validation
  validated: boolean('validated').default(true), // Whether hit passed validation
  validationScore: integer('validation_score'), // 0-100 confidence score
  validationFlags: jsonb('validation_flags'), // Any validation warnings/flags

  // Additional data
  rawData: jsonb('raw_data'), // Raw ESP32 data for debugging
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * BLE SYNC SESSIONS TABLE
 * Track synchronization sessions between ESP32 devices and backend
 */
export const bleSyncSessions = pgTable('ble_sync_sessions', {
  id: serial('id').primaryKey(),
  scannerId: integer('scanner_id').references(() => scanners.id),
  sessionType: text('session_type').notNull(), // 'esp32_to_tablet', 'tablet_to_backend', 'mesh_sync'

  // Sync metadata
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  status: text('status').notNull().default('in_progress'), // in_progress, completed, failed, partial

  // Sync stats
  hitsReceived: integer('hits_received').default(0),
  hitsValidated: integer('hits_validated').default(0),
  hitsRejected: integer('hits_rejected').default(0),

  // Error tracking
  errors: jsonb('errors'), // Any errors during sync

  // Metadata
  syncedBy: integer('synced_by'), // Staff user ID
  deviceInfo: jsonb('device_info'), // Device information
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * GAME SESSIONS TABLE
 * Track game sessions with statistics
 */
export const gameSessions = pgTable('game_sessions', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(), // Unique session identifier
  name: text('name'), // Session name (e.g., "Soirée Vendredi 20h")
  type: text('type'), // zombie, survivant, mixed

  // Session timing
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // Duration in minutes

  // Participant counts
  totalSurvivants: integer('total_survivants').default(0),
  totalZombies: integer('total_zombies').default(0),

  // Hardware counts
  beaconsAssigned: integer('beacons_assigned').default(0),
  scannersAssigned: integer('scanners_assigned').default(0),

  // Game statistics
  totalHits: integer('total_hits').default(0),
  validatedHits: integer('validated_hits').default(0),
  rejectedHits: integer('rejected_hits').default(0),

  // Status
  status: text('status').notNull().default('scheduled'), // scheduled, in_progress, completed, cancelled

  // Metadata
  notes: text('notes'),
  config: jsonb('config'), // Session configuration
  stats: jsonb('stats'), // Detailed statistics

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * ZONES TABLE (Optional)
 * Define zones in the game area for analytics
 */
export const zones = pgTable('zones', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // Zone name (e.g., "Entrance Cave", "Main Hall")
  description: text('description'),
  type: text('type'), // safe_zone, danger_zone, neutral
  coordinates: jsonb('coordinates'), // Geographic/map coordinates if available
  capacity: integer('capacity'), // Maximum participants
  status: text('status').default('active'), // active, inactive
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * RELATIONS
 */

// Beacons relations
export const beaconsRelations = relations(beacons, ({ many }) => ({
  assignments: many(beaconAssignments),
  hits: many(hits),
}));

// Scanners relations
export const scannersRelations = relations(scanners, ({ many }) => ({
  assignments: many(scannerAssignments),
  hits: many(hits),
  syncSessions: many(bleSyncSessions),
}));

// Beacon assignments relations
export const beaconAssignmentsRelations = relations(beaconAssignments, ({ one }) => ({
  participant: one(participants, {
    fields: [beaconAssignments.participantId],
    references: [participants.id],
  }),
  beacon: one(beacons, {
    fields: [beaconAssignments.beaconId],
    references: [beacons.id],
  }),
}));

// Scanner assignments relations
export const scannerAssignmentsRelations = relations(scannerAssignments, ({ one }) => ({
  participant: one(participants, {
    fields: [scannerAssignments.participantId],
    references: [participants.id],
  }),
  scanner: one(scanners, {
    fields: [scannerAssignments.scannerId],
    references: [scanners.id],
  }),
}));

// Hits relations
export const hitsRelations = relations(hits, ({ one }) => ({
  beacon: one(beacons, {
    fields: [hits.beaconId],
    references: [beacons.id],
  }),
  scanner: one(scanners, {
    fields: [hits.scannerId],
    references: [scanners.id],
  }),
  survivor: one(participants, {
    fields: [hits.survivorId],
    references: [participants.id],
  }),
  zombie: one(participants, {
    fields: [hits.zombieId],
    references: [participants.id],
  }),
}));

// BLE sync sessions relations
export const bleSyncSessionsRelations = relations(bleSyncSessions, ({ one }) => ({
  scanner: one(scanners, {
    fields: [bleSyncSessions.scannerId],
    references: [scanners.id],
  }),
}));

/**
 * TYPE EXPORTS
 */
export type Beacon = typeof beacons.$inferSelect;
export type NewBeacon = typeof beacons.$inferInsert;

export type Scanner = typeof scanners.$inferSelect;
export type NewScanner = typeof scanners.$inferInsert;

export type BeaconAssignment = typeof beaconAssignments.$inferSelect;
export type NewBeaconAssignment = typeof beaconAssignments.$inferInsert;

export type ScannerAssignment = typeof scannerAssignments.$inferSelect;
export type NewScannerAssignment = typeof scannerAssignments.$inferInsert;

export type Hit = typeof hits.$inferSelect;
export type NewHit = typeof hits.$inferInsert;

export type BleSyncSession = typeof bleSyncSessions.$inferSelect;
export type NewBleSyncSession = typeof bleSyncSessions.$inferInsert;

export type GameSession = typeof gameSessions.$inferSelect;
export type NewGameSession = typeof gameSessions.$inferInsert;

export type Zone = typeof zones.$inferSelect;
export type NewZone = typeof zones.$inferInsert;
