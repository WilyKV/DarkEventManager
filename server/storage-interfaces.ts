/**
 * Segregated storage interfaces (Interface Segregation Principle — MOD-1).
 *
 * IStorage = agrégat des 7 sous-interfaces.
 * Les consommateurs qui n'ont besoin que d'un sous-domaine peuvent dépendre
 * de la sous-interface la plus étroite plutôt que du monolithe IStorage.
 */

import type {
  Participant,
  InsertParticipant,
  ParticipantWithRelations,
  TimeSlot,
  InsertTimeSlot,
  Squad,
  InsertSquad,
  CreateSquadBatch,
  SquadWithRelations,
  ShopItem,
  InsertShopItem,
  MealItem,
  InsertMealItem,
  SquadAuditLog,
  InsertSquadAuditLog,
  SquadAuditLogWithRelations,
  Discount,
  InsertDiscount,
  Purchase,
  InsertPurchase,
  PurchaseWithRelations,
  MealPurchase,
  InsertMealPurchase,
  MealPurchaseWithRelations,
  MealDiscount,
  InsertMealDiscount,
  AuditLog,
  InsertAuditLog,
  AuditLogWithUser,
  InsertServerEvent,
} from "@shared/schema";
import type { DashboardStats } from "@shared/dashboard";
export type { DashboardStats } from "@shared/dashboard";

// ---------------------------------------------------------------------------
// Sous-interfaces
// ---------------------------------------------------------------------------

export interface IParticipantStorage {
  // Participants
  getParticipants(type?: string): Promise<ParticipantWithRelations[]>;
  getParticipant(id: number): Promise<ParticipantWithRelations | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: number, participant: Partial<InsertParticipant>): Promise<Participant | undefined>;
  archiveParticipant(id: number): Promise<boolean>;
  batchUpdateParticipants(updates: Array<{ id: number; data: Partial<InsertParticipant> }>): Promise<Participant[]>;
  generateSecretCode(): Promise<string>;

  // Time Slots
  getTimeSlots(type?: string): Promise<TimeSlot[]>;
  getTimeSlot(id: number): Promise<TimeSlot | undefined>;
  createTimeSlot(timeSlot: InsertTimeSlot): Promise<TimeSlot>;
  updateTimeSlot(id: number, timeSlot: Partial<InsertTimeSlot>): Promise<TimeSlot>;
  deleteTimeSlot(id: number): Promise<void>;

  // Squads
  getSquads(type?: string): Promise<Squad[]>;
  getSquad(id: number): Promise<Squad | undefined>;
  getSquadsWithParticipants(type?: string, timeSlotId?: number): Promise<SquadWithRelations[]>;
  createSquad(squad: InsertSquad): Promise<Squad>;
  createSquadBatch(batch: CreateSquadBatch): Promise<boolean>;
  updateSquad(id: number, squad: Partial<InsertSquad>): Promise<Squad>;
  deleteSquad(id: number): Promise<void>;

  // Dashboard Stats
  getDashboardStats(startedAt?: Date): Promise<DashboardStats>;

  // Squad Audit Log
  createSquadAuditLog(log: InsertSquadAuditLog): Promise<SquadAuditLog>;
  getSquadAuditLogs(participantId: number): Promise<SquadAuditLogWithRelations[]>;
}

export interface IInventoryStorage {
  // Shop Items
  getShopItems(): Promise<ShopItem[]>;
  getShopItem(id: number): Promise<ShopItem | undefined>;
  createShopItem(item: InsertShopItem): Promise<ShopItem>;
  updateShopItem(id: number, item: Partial<InsertShopItem>): Promise<ShopItem>;
  deleteShopItem(id: number): Promise<void>;

  // Meal Items
  getMealItems(): Promise<MealItem[]>;
  getMealItem(id: number): Promise<MealItem | undefined>;
  createMealItem(item: InsertMealItem): Promise<MealItem>;
  updateMealItem(id: number, item: Partial<InsertMealItem>): Promise<MealItem>;
  deleteMealItem(id: number): Promise<void>;
}

export interface IPurchaseStorage {
  // Purchases
  getPurchases(participantId?: number): Promise<PurchaseWithRelations[]>;
  getPurchase(id: number): Promise<PurchaseWithRelations | undefined>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase & { idempotent?: boolean }>;
  updatePurchase(id: number, purchase: Partial<InsertPurchase>): Promise<Purchase>;
  deletePurchase(id: number): Promise<void>;

  // Meal Purchases
  getMealPurchases(participantId?: number): Promise<MealPurchaseWithRelations[]>;
  getMealPurchase(id: number): Promise<MealPurchaseWithRelations | undefined>;
  createMealPurchase(purchase: InsertMealPurchase): Promise<MealPurchase>;
  updateMealPurchase(id: number, purchase: Partial<InsertMealPurchase>): Promise<MealPurchase>;
  deleteMealPurchase(id: number): Promise<void>;
}

export interface IDiscountStorage {
  // Discounts
  getGlobalDiscounts(): Promise<Discount | undefined>;
  updateGlobalDiscounts(data: Partial<InsertDiscount>): Promise<Discount>;
  getSquadDiscount(squadId: number): Promise<number | undefined>;
  setSquadDiscount(squadId: number, discount: number): Promise<Discount>;
  getParticipantDiscount(participantId: number): Promise<number | null | undefined>;
  setParticipantDiscount(participantId: number, discount: number | null): Promise<Discount>;
  calculateDiscount(participantId: number): Promise<number>;

  // Meal Discounts
  getGlobalMealDiscounts(): Promise<MealDiscount | undefined>;
  updateGlobalMealDiscounts(data: Partial<InsertMealDiscount>): Promise<MealDiscount>;
  getSquadMealDiscount(squadId: number): Promise<number | undefined>;
  setSquadMealDiscount(squadId: number, discount: number): Promise<MealDiscount>;
  getParticipantMealDiscount(participantId: number): Promise<number | null | undefined>;
  setParticipantMealDiscount(participantId: number, discount: number | null): Promise<MealDiscount>;
  calculateMealDiscount(participantId: number): Promise<number>;
}

export interface IAuditStorage {
  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { tableName?: string; action?: string; userId?: number; limit?: number }): Promise<AuditLogWithUser[]>;
}

export interface ISyncStorage {
  // Data Management
  resetData(module: string, type?: string): Promise<void>;
}

export interface IEventStorage {
  // Event Ingest
  appendEvents(events: InsertServerEvent[]): Promise<{ inserted: number; duplicates: number }>;
  getServerLamportTs(): Promise<number>;
  bumpServerLamportTs(min: number): Promise<number>;
  /** Transaction atomique : insert + bump Lamport en une seule opération DB. */
  ingestEvents(events: InsertServerEvent[], minLamport: number): Promise<{ inserted: number; duplicates: number; serverLamportTs: number }>;
}

// ---------------------------------------------------------------------------
// Type agrégé — rétro-compatible avec l'interface IStorage existante
// ---------------------------------------------------------------------------

export type IStorage =
  IParticipantStorage &
  IInventoryStorage &
  IPurchaseStorage &
  IDiscountStorage &
  IAuditStorage &
  ISyncStorage &
  IEventStorage;
