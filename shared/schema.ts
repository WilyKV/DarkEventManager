import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json, jsonb, bigint, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Time Slots Table
export const timeSlots = pgTable("time_slots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'zombie', 'survivant' or 'staff'
  mealTime: text("meal_time").notNull(),
  briefingTime: text("briefing_time").notNull(),
  gameTime: text("game_time").notNull(),
  exitTime: text("exit_time").notNull(),
});

// Squads Table
export const squads = pgTable("squads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  number: integer("number").notNull(), // 1-8, can repeat across different timeslots
  type: text("type").notNull(), // 'zombie', 'survivant' or 'staff'
  timeSlotId: integer("time_slot_id").notNull().references(() => timeSlots.id),
  maxMembers: integer("max_members").default(8),
  briefing: text("briefing"),
});

// Participants Table
export const participants = pgTable("participants", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  type: text("type").notNull(), // 'zombie', 'survivant' or 'staff'
  timeSlotId: integer("time_slot_id").references(() => timeSlots.id),
  squadId: integer("squad_id").references(() => squads.id),
  arrived: boolean("arrived").default(false),
  arrivedAt: timestamp("arrived_at"),
  returned: boolean("returned").default(false),
  returnedAt: timestamp("returned_at"),
  secretCode: text("secret_code"), // 5-digit unique secret code for badge recovery
  mealTicketGiven: boolean("meal_ticket_given").default(false),
  waterBottleGiven: boolean("water_bottle_given").default(false),
  squadExplained: boolean("squad_explained").default(false),
  briefingExplained: boolean("briefing_explained").default(false),
  makeupWaitExplained: boolean("makeup_wait_explained").default(false),
  mapGiven: boolean("map_given").default(false),
  checklistCompleted: boolean("checklist_completed").default(false),
  hasFreemeal: boolean("has_free_meal").default(false), // Zombies get 1 free meal
  freeMealClaimed: boolean("free_meal_claimed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Shop Items Table (Products)
export const shopItems = pgTable("shop_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  icon: text("icon"), // Lucide icon name (e.g., "Beer", "Utensils", "ShoppingBag")
  stock: integer("stock").notNull().default(0),
  price: text("price").notNull(), // Base price (full price)
  category: text("category"),
});

// Discounts Table
export const discounts = pgTable("discounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  // Type-based discounts
  zombieDiscount: integer("zombie_discount").default(0), // Percentage 0-100
  survivantDiscount: integer("survivant_discount").default(0), // Percentage 0-100
  staffDiscount: integer("staff_discount").default(0), // Percentage 0-100
  // Squad-based discounts (referenced by squad ID)
  squadId: integer("squad_id").references(() => squads.id),
  squadDiscount: integer("squad_discount"), // Percentage 0-100
  // Participant-specific discount (referenced by participant ID)
  participantId: integer("participant_id").references(() => participants.id).unique(),
  participantDiscount: integer("participant_discount"), // Percentage 0-100, null means use type/squad discount
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchases Table
export const purchases = pgTable("purchases", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  participantId: integer("participant_id").notNull().references(() => participants.id),
  shopItemId: integer("shop_item_id").notNull().references(() => shopItems.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: text("unit_price").notNull(), // Price at time of purchase (after discount)
  originalPrice: text("original_price").notNull(), // Original price before discount
  discountApplied: integer("discount_applied").default(0), // Percentage discount applied
  totalPrice: text("total_price").notNull(), // unit_price * quantity
  isPaid: boolean("is_paid").default(false),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  clientEventId: text("client_event_id"), // UUID v4 from client for idempotency (nullable for retro-compat)
});

// Meal Items Table
export const mealItems = pgTable("meal_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  icon: text("icon"), // Lucide icon name
  stock: integer("stock").notNull().default(0),
  price: text("price").notNull(),
  category: text("category"),
});

// Meal Purchases Table
export const mealPurchases = pgTable("meal_purchases", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  participantId: integer("participant_id").notNull().references(() => participants.id),
  mealItemId: integer("meal_item_id").notNull().references(() => mealItems.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: text("unit_price").notNull(), // Price at time of purchase (after discount)
  originalPrice: text("original_price").notNull(), // Original price before discount
  discountApplied: integer("discount_applied").default(0), // Percentage discount applied
  totalPrice: text("total_price").notNull(), // unit_price * quantity
  isPaid: boolean("is_paid").default(false),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

// Meal Discounts Table (separate from shop discounts)
export const mealDiscounts = pgTable("meal_discounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  // Type-based discounts
  zombieDiscount: integer("zombie_discount").default(0), // Percentage 0-100
  survivantDiscount: integer("survivant_discount").default(0), // Percentage 0-100
  staffDiscount: integer("staff_discount").default(0), // Percentage 0-100
  // Squad-based discounts (referenced by squad ID)
  squadId: integer("squad_id").references(() => squads.id),
  squadDiscount: integer("squad_discount"), // Percentage 0-100
  // Participant-specific discount (referenced by participant ID)
  participantId: integer("participant_id").references(() => participants.id).unique(),
  participantDiscount: integer("participant_discount"), // Percentage 0-100, null means use type/squad discount
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Squad Audit Log Table
export const squadAuditLog = pgTable("squad_audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  participantId: integer("participant_id").notNull().references(() => participants.id),
  previousSquadId: integer("previous_squad_id").references(() => squads.id),
  newSquadId: integer("new_squad_id").references(() => squads.id),
  changedAt: timestamp("changed_at").defaultNow(),
});

// App Configuration Table - For sync mode management
export const appConfig = pgTable("app_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  isOnlineMode: boolean("is_online_mode").default(true).notNull(),
  masterDeviceId: text("master_device_id"), // UUID of the master device
  masterDeviceName: text("master_device_name"), // Friendly name of the master device
  lastSyncAt: timestamp("last_sync_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
  serverLamportTs: integer("server_lamport_ts").notNull().default(0),
});

// Server Events Table - For event sourcing / bulk-ingest
export const serverEvents = pgTable("server_events", {
  eventUuid:     text("event_uuid").primaryKey(),
  aggregateId:   text("aggregate_id").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  eventType:     text("event_type").notNull(),
  payload:       jsonb("payload").notNull(),
  clientEventId: text("client_event_id"),
  deviceId:      text("device_id").notNull(),
  lamportTs:     integer("lamport_ts").notNull(),
  wallClockTs:   bigint("wall_clock_ts", { mode: "number" }).notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  correlationId: text("correlation_id"),
  receivedAt:    timestamp("received_at").defaultNow().notNull(),
}, (table) => ({
  aggregateLamportIdx: index("server_events_aggregate_lamport_idx").on(table.aggregateId, table.lamportTs),
  clientEventIdIdx:    index("server_events_client_event_id_idx").on(table.clientEventId),
}));

// Users Table - For authentication
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roles: text("roles").notNull().default('[]'), // JSON array: ['admin', 'staff_zombie', 'staff_survivant', 'staff_repas', 'staff_boutique']
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// Audit Logs Table - For tracking all CREATE/UPDATE/DELETE operations
export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id), // User who performed the action
  username: text("username"), // Username at time of action (denormalized for history)
  action: text("action").notNull(), // 'CREATE', 'UPDATE', 'DELETE'
  tableName: text("table_name").notNull(), // Table affected
  recordId: integer("record_id"), // ID of the record affected (if applicable)
  recordData: text("record_data"), // JSON snapshot of the record
  changes: text("changes"), // JSON with before/after values for UPDATE
  ipAddress: text("ip_address"), // IP address of the user
  userAgent: text("user_agent"), // User agent for context
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Sessions Table - For connect-pg-simple persistent session store
export const sessions = pgTable(
  "sessions",
  {
    sid:    text("sid").primaryKey(),
    sess:   json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
  },
  (table) => [
    index("sessions_expire_idx").on(table.expire),
  ],
);

// Relations
export const timeSlotsRelations = relations(timeSlots, ({ many }) => ({
  participants: many(participants),
  squads: many(squads),
}));

export const squadsRelations = relations(squads, ({ one, many }) => ({
  participants: many(participants),
  timeSlot: one(timeSlots, {
    fields: [squads.timeSlotId],
    references: [timeSlots.id],
  }),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  timeSlot: one(timeSlots, {
    fields: [participants.timeSlotId],
    references: [timeSlots.id],
  }),
  squad: one(squads, {
    fields: [participants.squadId],
    references: [squads.id],
  }),
  auditLogs: many(squadAuditLog),
}));

export const squadAuditLogRelations = relations(squadAuditLog, ({ one }) => ({
  participant: one(participants, {
    fields: [squadAuditLog.participantId],
    references: [participants.id],
  }),
  previousSquad: one(squads, {
    fields: [squadAuditLog.previousSquadId],
    references: [squads.id],
  }),
  newSquad: one(squads, {
    fields: [squadAuditLog.newSquadId],
    references: [squads.id],
  }),
}));

export const shopItemsRelations = relations(shopItems, ({ many }) => ({
  purchases: many(purchases),
}));

export const discountsRelations = relations(discounts, ({ one }) => ({
  squad: one(squads, {
    fields: [discounts.squadId],
    references: [squads.id],
  }),
  participant: one(participants, {
    fields: [discounts.participantId],
    references: [participants.id],
  }),
}));

export const purchasesRelations = relations(purchases, ({ one }) => ({
  participant: one(participants, {
    fields: [purchases.participantId],
    references: [participants.id],
  }),
  shopItem: one(shopItems, {
    fields: [purchases.shopItemId],
    references: [shopItems.id],
  }),
}));

export const mealItemsRelations = relations(mealItems, ({ many }) => ({
  purchases: many(mealPurchases),
}));

export const mealPurchasesRelations = relations(mealPurchases, ({ one }) => ({
  participant: one(participants, {
    fields: [mealPurchases.participantId],
    references: [participants.id],
  }),
  mealItem: one(mealItems, {
    fields: [mealPurchases.mealItemId],
    references: [mealItems.id],
  }),
}));

export const mealDiscountsRelations = relations(mealDiscounts, ({ one }) => ({
  squad: one(squads, {
    fields: [mealDiscounts.squadId],
    references: [squads.id],
  }),
  participant: one(participants, {
    fields: [mealDiscounts.participantId],
    references: [participants.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Insert Schemas
export const insertServerEventSchema = createInsertSchema(serverEvents);
export const insertTimeSlotSchema = createInsertSchema(timeSlots).omit({ id: true });
export const insertSquadSchema = createInsertSchema(squads).omit({ id: true });
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true, createdAt: true, arrivedAt: true, returnedAt: true });
export const insertShopItemSchema = createInsertSchema(shopItems).omit({ id: true });
export const insertMealItemSchema = createInsertSchema(mealItems).omit({ id: true });
export const insertSquadAuditLogSchema = createInsertSchema(squadAuditLog).omit({ id: true, changedAt: true });
export const insertAppConfigSchema = createInsertSchema(appConfig).omit({ id: true, updatedAt: true });
export const insertDiscountSchema = createInsertSchema(discounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseSchema = createInsertSchema(purchases, {
  clientEventId: z.string().uuid().nullish(),
}).omit({ id: true, purchasedAt: true });
export const insertMealPurchaseSchema = createInsertSchema(mealPurchases).omit({ id: true, purchasedAt: true });
export const insertMealDiscountSchema = createInsertSchema(mealDiscounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });

// Manual participant creation schema (for user-submitted data)
export const createParticipantSchema = z.object({
  firstName: z.string().min(1, "Le prénom est obligatoire").trim(),
  lastName: z.string().min(1, "Le nom est obligatoire").trim(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  type: z.enum(["zombie", "survivant", "staff"]),
  timeSlotId: z.number().int().positive().optional().nullable(),
});

// Types
export type TimeSlot = typeof timeSlots.$inferSelect;
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;

export type Squad = typeof squads.$inferSelect;
export type InsertSquad = z.infer<typeof insertSquadSchema>;

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export type ShopItem = typeof shopItems.$inferSelect;
export type InsertShopItem = z.infer<typeof insertShopItemSchema>;

export type MealItem = typeof mealItems.$inferSelect;
export type InsertMealItem = z.infer<typeof insertMealItemSchema>;

export type SquadAuditLog = typeof squadAuditLog.$inferSelect;
export type InsertSquadAuditLog = z.infer<typeof insertSquadAuditLogSchema>;

export type AppConfig = typeof appConfig.$inferSelect;
export type InsertAppConfig = z.infer<typeof insertAppConfigSchema>;

// User roles definition
export const USER_ROLES = {
  ADMIN: 'admin',
  STAFF_ZOMBIE: 'staff_zombie',
  STAFF_SURVIVANT: 'staff_survivant',
  STAFF_REPAS: 'staff_repas',
  STAFF_BOUTIQUE: 'staff_boutique',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// User schemas
export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères"),
  passwordHash: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  roles: z.string().default('[]'),
}).omit({ id: true, createdAt: true, lastLoginAt: true });

export const loginSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export const visitorLoginSchema = z.object({
  secretCode: z.string().min(5, "Le code doit contenir 5 caractères").max(5, "Le code doit contenir 5 caractères"),
  firstLetterLastName: z.string().length(1, "Une seule lettre requise").regex(/^[A-Za-z]$/, "Doit être une lettre"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Extended User type with parsed roles
export type UserWithRoles = User & {
  rolesList: UserRole[];
};

// Combined type for participant with relations
export type ParticipantWithRelations = Participant & {
  timeSlot?: TimeSlot | null;
  squad?: Squad | null;
};

export type SquadWithRelations = Squad & {
  participants?: Participant[];
  timeSlot?: TimeSlot | null;
};

export type SquadAuditLogWithRelations = SquadAuditLog & {
  previousSquad?: Squad | null;
  newSquad?: Squad | null;
};

export type Discount = typeof discounts.$inferSelect;
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;

export type PurchaseWithRelations = Purchase & {
  participant?: Participant | null;
  shopItem?: ShopItem | null;
};

export type MealPurchase = typeof mealPurchases.$inferSelect;
export type InsertMealPurchase = z.infer<typeof insertMealPurchaseSchema>;

export type MealPurchaseWithRelations = MealPurchase & {
  participant?: Participant | null;
  mealItem?: MealItem | null;
};

export type MealDiscount = typeof mealDiscounts.$inferSelect;
export type InsertMealDiscount = z.infer<typeof insertMealDiscountSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type AuditLogWithUser = AuditLog & {
  user?: User | null;
};

export type ServerEvent = typeof serverEvents.$inferSelect;
export type InsertServerEvent = z.infer<typeof insertServerEventSchema>;
