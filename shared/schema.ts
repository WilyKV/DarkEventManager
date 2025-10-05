import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Time Slots Table
export const timeSlots = pgTable("time_slots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'zombie' or 'survivant'
  mealTime: text("meal_time").notNull(),
  briefingTime: text("briefing_time").notNull(),
  gameTime: text("game_time").notNull(),
  exitTime: text("exit_time").notNull(),
});

// Squads Table
export const squads = pgTable("squads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'zombie' or 'survivant'
  maxMembers: integer("max_members").default(10),
});

// Participants Table
export const participants = pgTable("participants", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  type: text("type").notNull(), // 'zombie' or 'survivant'
  timeSlotId: integer("time_slot_id").references(() => timeSlots.id),
  squadId: integer("squad_id").references(() => squads.id),
  arrived: boolean("arrived").default(false),
  arrivedAt: timestamp("arrived_at"),
  returned: boolean("returned").default(false),
  returnedAt: timestamp("returned_at"),
  lockerNumber: text("locker_number"), // 4-digit unique number
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

// Shop Items Table
export const shopItems = pgTable("shop_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  stock: integer("stock").notNull().default(0),
  price: text("price"),
  category: text("category"),
});

// Meal Items Table
export const mealItems = pgTable("meal_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  stock: integer("stock").notNull().default(0),
  price: text("price"),
  category: text("category"),
});

// Squad Audit Log Table
export const squadAuditLog = pgTable("squad_audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  participantId: integer("participant_id").notNull().references(() => participants.id),
  previousSquadId: integer("previous_squad_id").references(() => squads.id),
  newSquadId: integer("new_squad_id").references(() => squads.id),
  changedAt: timestamp("changed_at").defaultNow(),
});

// Relations
export const timeSlotsRelations = relations(timeSlots, ({ many }) => ({
  participants: many(participants),
}));

export const squadsRelations = relations(squads, ({ many }) => ({
  participants: many(participants),
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

// Insert Schemas
export const insertTimeSlotSchema = createInsertSchema(timeSlots).omit({ id: true });
export const insertSquadSchema = createInsertSchema(squads).omit({ id: true });
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true, createdAt: true, arrivedAt: true, returnedAt: true });
export const insertShopItemSchema = createInsertSchema(shopItems).omit({ id: true });
export const insertMealItemSchema = createInsertSchema(mealItems).omit({ id: true });
export const insertSquadAuditLogSchema = createInsertSchema(squadAuditLog).omit({ id: true, changedAt: true });

// Manual participant creation schema (for user-submitted data)
export const createParticipantSchema = z.object({
  firstName: z.string().min(1, "Le prénom est obligatoire").trim(),
  lastName: z.string().min(1, "Le nom est obligatoire").trim(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  type: z.enum(["zombie", "survivant"]),
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

// Combined type for participant with relations
export type ParticipantWithRelations = Participant & {
  timeSlot?: TimeSlot | null;
  squad?: Squad | null;
};

export type SquadAuditLogWithRelations = SquadAuditLog & {
  previousSquad?: Squad | null;
  newSquad?: Squad | null;
};
