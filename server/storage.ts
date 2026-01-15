// Storage implementation - updated to use DatabaseStorage from javascript_database blueprint
import {
  participants,
  timeSlots,
  squads,
  shopItems,
  mealItems,
  squadAuditLog,
  appConfig,
  discounts,
  purchases,
  mealPurchases,
  mealDiscounts,
  auditLogs,
  users,
  // BLE tables
  beacons,
  scanners,
  beaconAssignments,
  scannerAssignments,
  hits,
  bleSyncSessions,
  gameSessions,
  zones,
  type Participant,
  type InsertParticipant,
  type ParticipantWithRelations,
  type TimeSlot,
  type InsertTimeSlot,
  type Squad,
  type InsertSquad,
  type SquadWithRelations,
  type ShopItem,
  type InsertShopItem,
  type MealItem,
  type InsertMealItem,
  type SquadAuditLog,
  type InsertSquadAuditLog,
  type SquadAuditLogWithRelations,
  type AppConfig,
  type InsertAppConfig,
  type Discount,
  type InsertDiscount,
  type Purchase,
  type InsertPurchase,
  type PurchaseWithRelations,
  type MealPurchase,
  type InsertMealPurchase,
  type MealPurchaseWithRelations,
  type MealDiscount,
  type InsertMealDiscount,
  type AuditLog,
  type InsertAuditLog,
  type AuditLogWithUser,
  // BLE types
  type Beacon,
  type NewBeacon,
  type Scanner,
  type NewScanner,
  type BeaconAssignment,
  type NewBeaconAssignment,
  type ScannerAssignment,
  type NewScannerAssignment,
  type Hit,
  type NewHit,
  type BleSyncSession,
  type NewBleSyncSession,
  type GameSession,
  type NewGameSession,
  type Zone,
  type NewZone,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, desc } from "drizzle-orm";

export interface DashboardStats {
  participants: {
    total: number;
    zombies: number;
    survivors: number;
    arrived: number;
    pending: number;
    arrivalRate: number;
  };
  squads: {
    name: string;
    type: string;
    currentMembers: number;
    maxMembers: number;
  }[];
  checklist: {
    totalCompleted: number;
    totalParticipants: number;
    completionRate: number;
  };
  stock: {
    shopItems: { name: string; stock: number; category: string }[];
    mealItems: { name: string; stock: number; category: string }[];
  };
}

export interface IStorage {
  // Participants
  getParticipants(type?: string): Promise<ParticipantWithRelations[]>;
  getParticipant(id: number): Promise<ParticipantWithRelations | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: number, participant: Partial<InsertParticipant>): Promise<Participant>;
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
  updateSquad(id: number, squad: Partial<InsertSquad>): Promise<Squad>;
  deleteSquad(id: number): Promise<void>;

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

  // Dashboard Stats
  getDashboardStats(): Promise<DashboardStats>;

  // Squad Audit Log
  createSquadAuditLog(log: InsertSquadAuditLog): Promise<SquadAuditLog>;
  getSquadAuditLogs(participantId: number): Promise<SquadAuditLogWithRelations[]>;

  // Discounts
  getGlobalDiscounts(): Promise<Discount | undefined>;
  updateGlobalDiscounts(data: Partial<InsertDiscount>): Promise<Discount>;
  getSquadDiscount(squadId: number): Promise<number | undefined>;
  setSquadDiscount(squadId: number, discount: number): Promise<Discount>;
  getParticipantDiscount(participantId: number): Promise<number | null | undefined>;
  setParticipantDiscount(participantId: number, discount: number | null): Promise<Discount>;
  calculateDiscount(participantId: number): Promise<number>;

  // Purchases
  getPurchases(participantId?: number): Promise<PurchaseWithRelations[]>;
  getPurchase(id: number): Promise<PurchaseWithRelations | undefined>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  updatePurchase(id: number, purchase: Partial<InsertPurchase>): Promise<Purchase>;
  deletePurchase(id: number): Promise<void>;

  // Meal Purchases
  getMealPurchases(participantId?: number): Promise<MealPurchaseWithRelations[]>;
  getMealPurchase(id: number): Promise<MealPurchaseWithRelations | undefined>;
  createMealPurchase(purchase: InsertMealPurchase): Promise<MealPurchase>;
  updateMealPurchase(id: number, purchase: Partial<InsertMealPurchase>): Promise<MealPurchase>;
  deleteMealPurchase(id: number): Promise<void>;

  // Meal Discounts
  getGlobalMealDiscounts(): Promise<MealDiscount | undefined>;
  updateGlobalMealDiscounts(data: Partial<InsertMealDiscount>): Promise<MealDiscount>;
  getSquadMealDiscount(squadId: number): Promise<number | undefined>;
  setSquadMealDiscount(squadId: number, discount: number): Promise<MealDiscount>;
  getParticipantMealDiscount(participantId: number): Promise<number | null | undefined>;
  setParticipantMealDiscount(participantId: number, discount: number | null): Promise<MealDiscount>;
  calculateMealDiscount(participantId: number): Promise<number>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { tableName?: string; action?: string; userId?: number; limit?: number }): Promise<AuditLogWithUser[]>;

  // Data Management
  resetData(module: string, type?: string): Promise<void>;

  // ===== BLE (Bluetooth Low Energy) Methods =====

  // Beacons
  getBeacons(status?: string): Promise<Beacon[]>;
  getBeacon(id: number): Promise<Beacon | undefined>;
  getBeaconByHardwareId(hardwareId: string): Promise<Beacon | undefined>;
  createBeacon(beacon: NewBeacon): Promise<Beacon>;
  updateBeacon(id: number, beacon: Partial<NewBeacon>): Promise<Beacon>;
  deleteBeacon(id: number): Promise<void>;

  // Scanners
  getScanners(status?: string): Promise<Scanner[]>;
  getScanner(id: number): Promise<Scanner | undefined>;
  getScannerByHardwareId(hardwareId: string): Promise<Scanner | undefined>;
  createScanner(scanner: NewScanner): Promise<Scanner>;
  updateScanner(id: number, scanner: Partial<NewScanner>): Promise<Scanner>;
  deleteScanner(id: number): Promise<void>;

  // Beacon Assignments
  getBeaconAssignments(filters?: { participantId?: number; beaconId?: number; status?: string }): Promise<BeaconAssignment[]>;
  getBeaconAssignment(id: number): Promise<BeaconAssignment | undefined>;
  assignBeaconToParticipant(participantId: number, beaconId: number, sessionId?: string, assignedBy?: number): Promise<BeaconAssignment>;
  returnBeacon(assignmentId: number, returnedBy?: number): Promise<BeaconAssignment>;

  // Scanner Assignments
  getScannerAssignments(filters?: { participantId?: number; scannerId?: number; status?: string }): Promise<ScannerAssignment[]>;
  getScannerAssignment(id: number): Promise<ScannerAssignment | undefined>;
  assignScannerToParticipant(participantId: number, scannerId: number, sessionId?: string, assignedBy?: number): Promise<ScannerAssignment>;
  returnScanner(assignmentId: number, returnedBy?: number): Promise<ScannerAssignment>;

  // Hits
  getHits(filters?: { beaconId?: number; scannerId?: number; sessionId?: string; validated?: boolean }): Promise<Hit[]>;
  getHit(id: number): Promise<Hit | undefined>;
  createHit(hit: NewHit): Promise<Hit>;
  syncHits(hits: NewHit[], scannerId: number): Promise<{ synced: number; rejected: number; syncSessionId: number }>;
  validateHit(hit: NewHit): Promise<{ valid: boolean; score: number; flags: any[] }>;

  // BLE Sync Sessions
  getBleSyncSessions(scannerId?: number): Promise<BleSyncSession[]>;
  getBleSyncSession(id: number): Promise<BleSyncSession | undefined>;
  createBleSyncSession(session: NewBleSyncSession): Promise<BleSyncSession>;
  updateBleSyncSession(id: number, session: Partial<NewBleSyncSession>): Promise<BleSyncSession>;

  // Game Sessions
  getGameSessions(status?: string): Promise<GameSession[]>;
  getGameSession(id: number): Promise<GameSession | undefined>;
  getGameSessionBySessionId(sessionId: string): Promise<GameSession | undefined>;
  createGameSession(session: NewGameSession): Promise<GameSession>;
  updateGameSession(id: number, session: Partial<NewGameSession>): Promise<GameSession>;
  calculateGameStats(sessionId: string): Promise<any>;

  // Zones
  getZones(status?: string): Promise<Zone[]>;
  getZone(id: number): Promise<Zone | undefined>;
  createZone(zone: NewZone): Promise<Zone>;
  updateZone(id: number, zone: Partial<NewZone>): Promise<Zone>;
  deleteZone(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Participants
  async getParticipants(type?: string): Promise<ParticipantWithRelations[]> {
    const query = type 
      ? db.query.participants.findMany({
          where: eq(participants.type, type),
          with: { timeSlot: true, squad: true },
        })
      : db.query.participants.findMany({
          with: { timeSlot: true, squad: true },
        });
    return await query;
  }

  async getParticipant(id: number): Promise<ParticipantWithRelations | undefined> {
    return await db.query.participants.findFirst({
      where: eq(participants.id, id),
      with: { timeSlot: true, squad: true },
    });
  }

  async createParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const [participant] = await db
      .insert(participants)
      .values(insertParticipant)
      .returning();
    return participant;
  }

  async updateParticipant(id: number, data: Partial<InsertParticipant>): Promise<Participant> {
    const [participant] = await db
      .update(participants)
      .set(data)
      .where(eq(participants.id, id))
      .returning();
    return participant;
  }

  async batchUpdateParticipants(updates: Array<{ id: number; data: Partial<InsertParticipant> }>): Promise<Participant[]> {
    return await db.transaction(async (tx) => {
      const results: Participant[] = [];
      
      for (const { id, data } of updates) {
        // Get current participant to check for squad changes
        const currentParticipant = await tx.query.participants.findFirst({
          where: eq(participants.id, id),
        });

        if (!currentParticipant) {
          throw new Error(`Participant ${id} not found`);
        }

        // Update participant
        const [updated] = await tx
          .update(participants)
          .set(data)
          .where(eq(participants.id, id))
          .returning();
        
        results.push(updated);

        // Log squad changes if squad was modified
        const squadChanging = data.squadId !== undefined && data.squadId !== currentParticipant.squadId;
        if (squadChanging) {
          await tx.insert(squadAuditLog).values({
            participantId: id,
            previousSquadId: currentParticipant.squadId ?? null,
            newSquadId: data.squadId ?? null,
          });
        }
      }
      
      return results;
    });
  }

  async generateSecretCode(): Promise<string> {
    // Generate unique 5-digit secret code
    let secretCode: string;
    let exists = true;

    while (exists) {
      secretCode = Math.floor(10000 + Math.random() * 90000).toString();
      const [existing] = await db
        .select()
        .from(participants)
        .where(eq(participants.secretCode, secretCode))
        .limit(1);
      exists = !!existing;
    }
    
    return secretCode!;
  }

  // Time Slots
  async getTimeSlots(type?: string): Promise<TimeSlot[]> {
    if (type) {
      return await db.select().from(timeSlots).where(eq(timeSlots.type, type));
    }
    return await db.select().from(timeSlots);
  }

  async getTimeSlot(id: number): Promise<TimeSlot | undefined> {
    const [timeSlot] = await db.select().from(timeSlots).where(eq(timeSlots.id, id));
    return timeSlot;
  }

  async createTimeSlot(insertTimeSlot: InsertTimeSlot): Promise<TimeSlot> {
    const [timeSlot] = await db
      .insert(timeSlots)
      .values(insertTimeSlot)
      .returning();
    return timeSlot;
  }

  // Squads
  async getSquads(type?: string): Promise<Squad[]> {
    if (type) {
      return await db.select().from(squads).where(eq(squads.type, type));
    }
    return await db.select().from(squads);
  }

  async getSquad(id: number): Promise<Squad | undefined> {
    const [squad] = await db.select().from(squads).where(eq(squads.id, id));
    return squad;
  }

  async getSquadsWithParticipants(type?: string, timeSlotId?: number): Promise<SquadWithRelations[]> {
    let conditions = [];
    if (type) {
      conditions.push(eq(squads.type, type));
    }
    if (timeSlotId) {
      conditions.push(eq(squads.timeSlotId, timeSlotId));
    }

    const query = conditions.length > 0
      ? db.query.squads.findMany({
          where: and(...conditions),
          with: { 
            participants: true,
            timeSlot: true,
          },
        })
      : db.query.squads.findMany({
          with: { 
            participants: true,
            timeSlot: true,
          },
        });
    
    return await query;
  }

  async createSquad(insertSquad: InsertSquad): Promise<Squad> {
    const [squad] = await db
      .insert(squads)
      .values(insertSquad)
      .returning();
    return squad;
  }

  async updateSquad(id: number, data: Partial<InsertSquad>): Promise<Squad> {
    const [squad] = await db
      .update(squads)
      .set(data)
      .where(eq(squads.id, id))
      .returning();
    return squad;
  }

  async deleteSquad(id: number): Promise<void> {
    // First, remove audit log entries referencing this squad
    await db
      .delete(squadAuditLog)
      .where(eq(squadAuditLog.previousSquadId, id));
    await db
      .delete(squadAuditLog)
      .where(eq(squadAuditLog.newSquadId, id));

    // Then, set squadId to null for all participants in this squad
    await db
      .update(participants)
      .set({ squadId: null })
      .where(eq(participants.squadId, id));

    // Finally delete the squad
    await db.delete(squads).where(eq(squads.id, id));
  }

  async updateTimeSlot(id: number, data: Partial<InsertTimeSlot>): Promise<TimeSlot> {
    const [timeSlot] = await db
      .update(timeSlots)
      .set(data)
      .where(eq(timeSlots.id, id))
      .returning();
    return timeSlot;
  }

  async deleteTimeSlot(id: number): Promise<void> {
    // First, set timeSlotId to null for all participants in this timeslot
    await db
      .update(participants)
      .set({ timeSlotId: null })
      .where(eq(participants.timeSlotId, id));

    // Delete all squads in this timeslot
    await db.delete(squads).where(eq(squads.timeSlotId, id));

    // Then delete the timeslot
    await db.delete(timeSlots).where(eq(timeSlots.id, id));
  }

  // Shop Items
  async getShopItems(): Promise<ShopItem[]> {
    return await db.select().from(shopItems);
  }

  async getShopItem(id: number): Promise<ShopItem | undefined> {
    const [item] = await db.select().from(shopItems).where(eq(shopItems.id, id));
    return item;
  }

  async createShopItem(insertItem: InsertShopItem): Promise<ShopItem> {
    const [item] = await db
      .insert(shopItems)
      .values(insertItem)
      .returning();
    return item;
  }

  async updateShopItem(id: number, data: Partial<InsertShopItem>): Promise<ShopItem> {
    const [item] = await db
      .update(shopItems)
      .set(data)
      .where(eq(shopItems.id, id))
      .returning();
    return item;
  }

  async deleteShopItem(id: number): Promise<void> {
    await db.delete(shopItems).where(eq(shopItems.id, id));
  }

  // Meal Items
  async getMealItems(): Promise<MealItem[]> {
    return await db.select().from(mealItems);
  }

  async getMealItem(id: number): Promise<MealItem | undefined> {
    const [item] = await db.select().from(mealItems).where(eq(mealItems.id, id));
    return item;
  }

  async createMealItem(insertItem: InsertMealItem): Promise<MealItem> {
    const [item] = await db
      .insert(mealItems)
      .values(insertItem)
      .returning();
    return item;
  }

  async updateMealItem(id: number, data: Partial<InsertMealItem>): Promise<MealItem> {
    const [item] = await db
      .update(mealItems)
      .set(data)
      .where(eq(mealItems.id, id))
      .returning();
    return item;
  }

  async deleteMealItem(id: number): Promise<void> {
    await db.delete(mealItems).where(eq(mealItems.id, id));
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const allParticipants = await this.getParticipants();
    const allSquads = await db.select().from(squads);
    const allShopItems = await this.getShopItems();
    const allMealItems = await this.getMealItems();

    const zombieCount = allParticipants.filter(p => p.type === "zombie").length;
    const survivorCount = allParticipants.filter(p => p.type === "survivant").length;
    const arrivedCount = allParticipants.filter(p => p.arrived).length;
    
    const completedChecklist = allParticipants.filter(p => p.checklistCompleted).length;

    const squadStats = allSquads.map(squad => ({
      name: squad.name,
      type: squad.type,
      currentMembers: allParticipants.filter(p => p.squadId === squad.id).length,
      maxMembers: squad.maxMembers ?? 0,
    }));

    return {
      participants: {
        total: allParticipants.length,
        zombies: zombieCount,
        survivors: survivorCount,
        arrived: arrivedCount,
        pending: allParticipants.length - arrivedCount,
        arrivalRate: allParticipants.length > 0 
          ? Math.round((arrivedCount / allParticipants.length) * 100) 
          : 0,
      },
      squads: squadStats,
      checklist: {
        totalCompleted: completedChecklist,
        totalParticipants: allParticipants.length,
        completionRate: allParticipants.length > 0 
          ? Math.round((completedChecklist / allParticipants.length) * 100) 
          : 0,
      },
      stock: {
        shopItems: allShopItems.map(item => ({
          name: item.name,
          stock: item.stock,
          category: item.category ?? "",
        })),
        mealItems: allMealItems.map(item => ({
          name: item.name,
          stock: item.stock,
          category: item.category ?? "",
        })),
      },
    };
  }

  // Squad Audit Log
  async createSquadAuditLog(log: InsertSquadAuditLog): Promise<SquadAuditLog> {
    const [auditLog] = await db
      .insert(squadAuditLog)
      .values(log)
      .returning();
    return auditLog;
  }

  async getSquadAuditLogs(participantId: number): Promise<SquadAuditLogWithRelations[]> {
    return await db.query.squadAuditLog.findMany({
      where: eq(squadAuditLog.participantId, participantId),
      with: {
        previousSquad: true,
        newSquad: true,
      },
      orderBy: (squadAuditLog, { desc }) => [desc(squadAuditLog.changedAt)],
    });
  }

  // Data Management
  async resetData(module: string, type?: string): Promise<void> {
    switch (module) {
      case "participants":
        if (type) {
          await db.delete(participants).where(eq(participants.type, type));
        } else {
          await db.delete(participants);
        }
        break;

      case "timeslots":
        if (type) {
          await db.delete(timeSlots).where(eq(timeSlots.type, type));
        } else {
          await db.delete(timeSlots);
        }
        break;

      case "squads":
        // First, remove squad assignments from participants
        if (type) {
          const squadsToDelete = await db.select().from(squads).where(eq(squads.type, type));
          const squadIds = squadsToDelete.map(s => s.id);
          for (const id of squadIds) {
            await db.update(participants).set({ squadId: null }).where(eq(participants.squadId, id));
          }
          await db.delete(squads).where(eq(squads.type, type));
        } else {
          await db.update(participants).set({ squadId: null });
          await db.delete(squads);
        }
        break;

      case "shop":
        await db.delete(shopItems);
        break;

      case "meals":
        await db.delete(mealItems);
        break;

      case "all":
        // Reset all data in proper order to respect foreign keys
        await db.update(participants).set({ squadId: null, timeSlotId: null });
        await db.delete(squadAuditLog);
        await db.delete(squads);
        await db.delete(participants);
        await db.delete(timeSlots);
        await db.delete(shopItems);
        await db.delete(mealItems);
        break;

      default:
        throw new Error(`Unknown module: ${module}`);
    }
  }

  // ===== SYNC CONFIGURATION =====

  async getSyncConfig(): Promise<AppConfig> {
    const config = await db.select().from(appConfig).limit(1);

    if (config.length === 0) {
      // Initialize default config if not exists
      const defaultConfig: InsertAppConfig = {
        isOnlineMode: true,
        masterDeviceId: null,
        masterDeviceName: null,
        lastSyncAt: null,
      };
      const [newConfig] = await db.insert(appConfig).values(defaultConfig).returning();
      return newConfig;
    }

    return config[0];
  }

  async updateSyncConfig(update: Partial<InsertAppConfig>): Promise<AppConfig> {
    const currentConfig = await this.getSyncConfig();

    const [updatedConfig] = await db
      .update(appConfig)
      .set({
        ...update,
        updatedAt: new Date(),
      })
      .where(eq(appConfig.id, currentConfig.id))
      .returning();

    return updatedConfig;
  }

  async updateLastSyncAt(): Promise<void> {
    const currentConfig = await this.getSyncConfig();

    await db
      .update(appConfig)
      .set({
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appConfig.id, currentConfig.id));
  }

  // ===== DISCOUNTS =====

  // Get global discounts (type-based)
  async getGlobalDiscounts(): Promise<Discount | undefined> {
    const [discount] = await db
      .select()
      .from(discounts)
      .where(
        and(
          isNull(discounts.squadId),
          isNull(discounts.participantId)
        )
      )
      .limit(1);
    return discount;
  }

  // Update or create global discounts (type-based: zombie, survivant, staff)
  async updateGlobalDiscounts(data: Partial<InsertDiscount>): Promise<Discount> {
    const existing = await this.getGlobalDiscounts();

    if (existing) {
      const [updated] = await db
        .update(discounts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(discounts.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(discounts)
        .values({
          zombieDiscount: data.zombieDiscount ?? 0,
          survivantDiscount: data.survivantDiscount ?? 0,
          staffDiscount: data.staffDiscount ?? 0,
        })
        .returning();
      return created;
    }
  }

  // Get discount for a specific squad
  async getSquadDiscount(squadId: number): Promise<number | undefined> {
    const [discount] = await db
      .select()
      .from(discounts)
      .where(eq(discounts.squadId, squadId))
      .limit(1);
    return discount?.squadDiscount ?? undefined;
  }

  // Set discount for a specific squad
  async setSquadDiscount(squadId: number, discount: number): Promise<Discount> {
    const existing = await db
      .select()
      .from(discounts)
      .where(eq(discounts.squadId, squadId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(discounts)
        .set({ squadDiscount: discount, updatedAt: new Date() })
        .where(eq(discounts.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(discounts)
        .values({ squadId, squadDiscount: discount })
        .returning();
      return created;
    }
  }

  // Get discount for a specific participant (returns null if set to use type/squad)
  async getParticipantDiscount(participantId: number): Promise<number | null | undefined> {
    const [discount] = await db
      .select()
      .from(discounts)
      .where(eq(discounts.participantId, participantId))
      .limit(1);

    if (!discount) return undefined;
    return discount.participantDiscount;
  }

  // Set discount for a specific participant (null means use type/squad discount)
  async setParticipantDiscount(participantId: number, discount: number | null): Promise<Discount> {
    const existing = await db
      .select()
      .from(discounts)
      .where(eq(discounts.participantId, participantId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(discounts)
        .set({ participantDiscount: discount, updatedAt: new Date() })
        .where(eq(discounts.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(discounts)
        .values({ participantId, participantDiscount: discount })
        .returning();
      return created;
    }
  }

  // Calculate discount for a participant based on priority rules
  async calculateDiscount(participantId: number): Promise<number> {
    const participant = await this.getParticipant(participantId);
    if (!participant) return 0;

    // Priority 1: Check participant-specific discount
    const participantDiscount = await this.getParticipantDiscount(participantId);
    if (participantDiscount !== undefined && participantDiscount !== null) {
      return participantDiscount;
    }

    // Priority 2: Get type discount and squad discount, use highest
    const globalDiscounts = await this.getGlobalDiscounts();
    let typeDiscount = 0;

    if (globalDiscounts) {
      switch (participant.type) {
        case "zombie":
          typeDiscount = globalDiscounts.zombieDiscount ?? 0;
          break;
        case "survivant":
          typeDiscount = globalDiscounts.survivantDiscount ?? 0;
          break;
        case "staff":
          typeDiscount = globalDiscounts.staffDiscount ?? 0;
          break;
      }
    }

    // Check squad discount if participant has a squad
    let squadDiscount = 0;
    if (participant.squadId) {
      squadDiscount = await this.getSquadDiscount(participant.squadId) ?? 0;
    }

    // Return the highest between type and squad discount
    return Math.max(typeDiscount, squadDiscount);
  }

  // ===== PURCHASES =====

  async getPurchases(participantId?: number): Promise<PurchaseWithRelations[]> {
    if (participantId) {
      return await db.query.purchases.findMany({
        where: eq(purchases.participantId, participantId),
        with: {
          participant: true,
          shopItem: true,
        },
        orderBy: (purchases, { desc }) => [desc(purchases.purchasedAt)],
      });
    }

    return await db.query.purchases.findMany({
      with: {
        participant: true,
        shopItem: true,
      },
      orderBy: (purchases, { desc }) => [desc(purchases.purchasedAt)],
    });
  }

  async getPurchase(id: number): Promise<PurchaseWithRelations | undefined> {
    return await db.query.purchases.findFirst({
      where: eq(purchases.id, id),
      with: {
        participant: true,
        shopItem: true,
      },
    });
  }

  async createPurchase(insertPurchase: InsertPurchase): Promise<Purchase> {
    const [purchase] = await db
      .insert(purchases)
      .values(insertPurchase)
      .returning();
    return purchase;
  }

  async updatePurchase(id: number, data: Partial<InsertPurchase>): Promise<Purchase> {
    const [purchase] = await db
      .update(purchases)
      .set(data)
      .where(eq(purchases.id, id))
      .returning();
    return purchase;
  }

  async deletePurchase(id: number): Promise<void> {
    await db.delete(purchases).where(eq(purchases.id, id));
  }

  // ===== MEAL PURCHASES =====

  async getMealPurchases(participantId?: number): Promise<MealPurchaseWithRelations[]> {
    if (participantId) {
      return await db.query.mealPurchases.findMany({
        where: eq(mealPurchases.participantId, participantId),
        with: {
          participant: true,
          mealItem: true,
        },
        orderBy: (mealPurchases, { desc }) => [desc(mealPurchases.purchasedAt)],
      });
    }

    return await db.query.mealPurchases.findMany({
      with: {
        participant: true,
        mealItem: true,
      },
      orderBy: (mealPurchases, { desc }) => [desc(mealPurchases.purchasedAt)],
    });
  }

  async getMealPurchase(id: number): Promise<MealPurchaseWithRelations | undefined> {
    return await db.query.mealPurchases.findFirst({
      where: eq(mealPurchases.id, id),
      with: {
        participant: true,
        mealItem: true,
      },
    });
  }

  async createMealPurchase(insertMealPurchase: InsertMealPurchase): Promise<MealPurchase> {
    const [mealPurchase] = await db
      .insert(mealPurchases)
      .values(insertMealPurchase)
      .returning();
    return mealPurchase;
  }

  async updateMealPurchase(id: number, data: Partial<InsertMealPurchase>): Promise<MealPurchase> {
    const [mealPurchase] = await db
      .update(mealPurchases)
      .set(data)
      .where(eq(mealPurchases.id, id))
      .returning();
    return mealPurchase;
  }

  async deleteMealPurchase(id: number): Promise<void> {
    await db.delete(mealPurchases).where(eq(mealPurchases.id, id));
  }

  // ===== MEAL DISCOUNTS =====

  // Get global meal discounts (type-based)
  async getGlobalMealDiscounts(): Promise<MealDiscount | undefined> {
    const [discount] = await db
      .select()
      .from(mealDiscounts)
      .where(
        and(
          isNull(mealDiscounts.squadId),
          isNull(mealDiscounts.participantId)
        )
      )
      .limit(1);
    return discount;
  }

  // Update or create global meal discounts (type-based: zombie, survivant, staff)
  async updateGlobalMealDiscounts(data: Partial<InsertMealDiscount>): Promise<MealDiscount> {
    const existing = await this.getGlobalMealDiscounts();

    if (existing) {
      const [updated] = await db
        .update(mealDiscounts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(mealDiscounts.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(mealDiscounts)
        .values({
          zombieDiscount: data.zombieDiscount ?? 0,
          survivantDiscount: data.survivantDiscount ?? 0,
          staffDiscount: data.staffDiscount ?? 0,
        })
        .returning();
      return created;
    }
  }

  // Get meal discount for a specific squad
  async getSquadMealDiscount(squadId: number): Promise<number | undefined> {
    const [discount] = await db
      .select()
      .from(mealDiscounts)
      .where(eq(mealDiscounts.squadId, squadId))
      .limit(1);
    return discount?.squadDiscount ?? undefined;
  }

  // Set meal discount for a specific squad
  async setSquadMealDiscount(squadId: number, discount: number): Promise<MealDiscount> {
    const existing = await db
      .select()
      .from(mealDiscounts)
      .where(eq(mealDiscounts.squadId, squadId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(mealDiscounts)
        .set({ squadDiscount: discount, updatedAt: new Date() })
        .where(eq(mealDiscounts.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(mealDiscounts)
        .values({ squadId, squadDiscount: discount })
        .returning();
      return created;
    }
  }

  // Get meal discount for a specific participant (returns null if set to use type/squad)
  async getParticipantMealDiscount(participantId: number): Promise<number | null | undefined> {
    const [discount] = await db
      .select()
      .from(mealDiscounts)
      .where(eq(mealDiscounts.participantId, participantId))
      .limit(1);

    if (!discount) return undefined;
    return discount.participantDiscount;
  }

  // Set meal discount for a specific participant (null means use type/squad discount)
  async setParticipantMealDiscount(participantId: number, discount: number | null): Promise<MealDiscount> {
    const existing = await db
      .select()
      .from(mealDiscounts)
      .where(eq(mealDiscounts.participantId, participantId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(mealDiscounts)
        .set({ participantDiscount: discount, updatedAt: new Date() })
        .where(eq(mealDiscounts.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(mealDiscounts)
        .values({ participantId, participantDiscount: discount })
        .returning();
      return created;
    }
  }

  // Calculate meal discount for a participant based on priority rules
  async calculateMealDiscount(participantId: number): Promise<number> {
    const participant = await this.getParticipant(participantId);
    if (!participant) return 0;

    // Priority 1: Check participant-specific discount
    const participantDiscount = await this.getParticipantMealDiscount(participantId);
    if (participantDiscount !== undefined && participantDiscount !== null) {
      return participantDiscount;
    }

    // Priority 2: Get type discount and squad discount, use highest
    const globalDiscounts = await this.getGlobalMealDiscounts();
    let typeDiscount = 0;

    if (globalDiscounts) {
      switch (participant.type) {
        case "zombie":
          typeDiscount = globalDiscounts.zombieDiscount ?? 0;
          break;
        case "survivant":
          typeDiscount = globalDiscounts.survivantDiscount ?? 0;
          break;
        case "staff":
          typeDiscount = globalDiscounts.staffDiscount ?? 0;
          break;
      }
    }

    // Check squad discount if participant has a squad
    let squadDiscount = 0;
    if (participant.squadId) {
      squadDiscount = await this.getSquadMealDiscount(participant.squadId) ?? 0;
    }

    // Return the highest between type and squad discount
    return Math.max(typeDiscount, squadDiscount);
  }

  // ===== AUDIT LOGS =====

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db.insert(auditLogs).values(log).returning();
    return auditLog;
  }

  async getAuditLogs(filters?: {
    tableName?: string;
    action?: string;
    userId?: number;
    limit?: number
  }): Promise<AuditLogWithUser[]> {
    let query = db
      .select()
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.timestamp))
      .$dynamic();

    if (filters?.tableName) {
      query = query.where(eq(auditLogs.tableName, filters.tableName));
    }
    if (filters?.action) {
      query = query.where(eq(auditLogs.action, filters.action));
    }
    if (filters?.userId) {
      query = query.where(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const results = await query;

    return results.map(row => ({
      ...row.audit_logs,
      user: row.users || undefined,
    }));
  }

  // ===== BLE (BLUETOOTH LOW ENERGY) METHODS =====

  // ===== BEACONS =====

  async getBeacons(status?: string): Promise<Beacon[]> {
    if (status) {
      return await db.select().from(beacons).where(eq(beacons.status, status));
    }
    return await db.select().from(beacons);
  }

  async getBeacon(id: number): Promise<Beacon | undefined> {
    const [beacon] = await db.select().from(beacons).where(eq(beacons.id, id)).limit(1);
    return beacon;
  }

  async getBeaconByHardwareId(hardwareId: string): Promise<Beacon | undefined> {
    const [beacon] = await db
      .select()
      .from(beacons)
      .where(eq(beacons.hardwareId, hardwareId))
      .limit(1);
    return beacon;
  }

  async createBeacon(beacon: NewBeacon): Promise<Beacon> {
    const [created] = await db.insert(beacons).values(beacon).returning();
    return created;
  }

  async updateBeacon(id: number, beacon: Partial<NewBeacon>): Promise<Beacon> {
    const [updated] = await db
      .update(beacons)
      .set({ ...beacon, updatedAt: new Date() })
      .where(eq(beacons.id, id))
      .returning();
    return updated;
  }

  async deleteBeacon(id: number): Promise<void> {
    await db.delete(beacons).where(eq(beacons.id, id));
  }

  // ===== SCANNERS =====

  async getScanners(status?: string): Promise<Scanner[]> {
    if (status) {
      return await db.select().from(scanners).where(eq(scanners.status, status));
    }
    return await db.select().from(scanners);
  }

  async getScanner(id: number): Promise<Scanner | undefined> {
    const [scanner] = await db.select().from(scanners).where(eq(scanners.id, id)).limit(1);
    return scanner;
  }

  async getScannerByHardwareId(hardwareId: string): Promise<Scanner | undefined> {
    const [scanner] = await db
      .select()
      .from(scanners)
      .where(eq(scanners.hardwareId, hardwareId))
      .limit(1);
    return scanner;
  }

  async createScanner(scanner: NewScanner): Promise<Scanner> {
    const [created] = await db.insert(scanners).values(scanner).returning();
    return created;
  }

  async updateScanner(id: number, scanner: Partial<NewScanner>): Promise<Scanner> {
    const [updated] = await db
      .update(scanners)
      .set({ ...scanner, updatedAt: new Date() })
      .where(eq(scanners.id, id))
      .returning();
    return updated;
  }

  async deleteScanner(id: number): Promise<void> {
    await db.delete(scanners).where(eq(scanners.id, id));
  }

  // ===== BEACON ASSIGNMENTS =====

  async getBeaconAssignments(filters?: {
    participantId?: number;
    beaconId?: number;
    status?: string;
  }): Promise<BeaconAssignment[]> {
    let query = db.select().from(beaconAssignments).$dynamic();

    if (filters?.participantId) {
      query = query.where(eq(beaconAssignments.participantId, filters.participantId));
    }
    if (filters?.beaconId) {
      query = query.where(eq(beaconAssignments.beaconId, filters.beaconId));
    }
    if (filters?.status) {
      query = query.where(eq(beaconAssignments.status, filters.status));
    }

    return await query;
  }

  async getBeaconAssignment(id: number): Promise<BeaconAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(beaconAssignments)
      .where(eq(beaconAssignments.id, id))
      .limit(1);
    return assignment;
  }

  async assignBeaconToParticipant(
    participantId: number,
    beaconId: number,
    sessionId?: string,
    assignedBy?: number
  ): Promise<BeaconAssignment> {
    // Update beacon status to 'assigned'
    await this.updateBeacon(beaconId, { status: 'assigned' });

    // Create assignment record
    const [assignment] = await db
      .insert(beaconAssignments)
      .values({
        participantId,
        beaconId,
        sessionId: sessionId || null,
        assignedBy: assignedBy || null,
        status: 'active',
      })
      .returning();

    return assignment;
  }

  async returnBeacon(assignmentId: number, returnedBy?: number): Promise<BeaconAssignment> {
    const assignment = await this.getBeaconAssignment(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Update beacon status to 'available'
    await this.updateBeacon(assignment.beaconId, { status: 'available' });

    // Update assignment record
    const [updated] = await db
      .update(beaconAssignments)
      .set({
        returnedAt: new Date(),
        returnedBy: returnedBy || null,
        status: 'returned',
      })
      .where(eq(beaconAssignments.id, assignmentId))
      .returning();

    return updated;
  }

  // ===== SCANNER ASSIGNMENTS =====

  async getScannerAssignments(filters?: {
    participantId?: number;
    scannerId?: number;
    status?: string;
  }): Promise<ScannerAssignment[]> {
    let query = db.select().from(scannerAssignments).$dynamic();

    if (filters?.participantId) {
      query = query.where(eq(scannerAssignments.participantId, filters.participantId));
    }
    if (filters?.scannerId) {
      query = query.where(eq(scannerAssignments.scannerId, filters.scannerId));
    }
    if (filters?.status) {
      query = query.where(eq(scannerAssignments.status, filters.status));
    }

    return await query;
  }

  async getScannerAssignment(id: number): Promise<ScannerAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(scannerAssignments)
      .where(eq(scannerAssignments.id, id))
      .limit(1);
    return assignment;
  }

  async assignScannerToParticipant(
    participantId: number,
    scannerId: number,
    sessionId?: string,
    assignedBy?: number
  ): Promise<ScannerAssignment> {
    // Update scanner status to 'assigned'
    await this.updateScanner(scannerId, { status: 'assigned' });

    // Create assignment record
    const [assignment] = await db
      .insert(scannerAssignments)
      .values({
        participantId,
        scannerId,
        sessionId: sessionId || null,
        assignedBy: assignedBy || null,
        status: 'active',
      })
      .returning();

    return assignment;
  }

  async returnScanner(assignmentId: number, returnedBy?: number): Promise<ScannerAssignment> {
    const assignment = await this.getScannerAssignment(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Update scanner status to 'available'
    await this.updateScanner(assignment.scannerId, { status: 'available' });

    // Update assignment record
    const [updated] = await db
      .update(scannerAssignments)
      .set({
        returnedAt: new Date(),
        returnedBy: returnedBy || null,
        status: 'returned',
      })
      .where(eq(scannerAssignments.id, assignmentId))
      .returning();

    return updated;
  }

  // ===== HITS =====

  async getHits(filters?: {
    beaconId?: number;
    scannerId?: number;
    sessionId?: string;
    validated?: boolean;
  }): Promise<Hit[]> {
    let query = db.select().from(hits).orderBy(desc(hits.hitTimestamp)).$dynamic();

    if (filters?.beaconId) {
      query = query.where(eq(hits.beaconId, filters.beaconId));
    }
    if (filters?.scannerId) {
      query = query.where(eq(hits.scannerId, filters.scannerId));
    }
    if (filters?.sessionId) {
      query = query.where(eq(hits.sessionId, filters.sessionId));
    }
    if (filters?.validated !== undefined) {
      query = query.where(eq(hits.validated, filters.validated));
    }

    return await query;
  }

  async getHit(id: number): Promise<Hit | undefined> {
    const [hit] = await db.select().from(hits).where(eq(hits.id, id)).limit(1);
    return hit;
  }

  async createHit(hit: NewHit): Promise<Hit> {
    const [created] = await db.insert(hits).values(hit).returning();
    return created;
  }

  async syncHits(
    hitsData: NewHit[],
    scannerId: number
  ): Promise<{ synced: number; rejected: number; syncSessionId: number }> {
    // Create sync session
    const [syncSession] = await db
      .insert(bleSyncSessions)
      .values({
        scannerId,
        sessionType: 'esp32_to_tablet',
        hitsReceived: hitsData.length,
        status: 'in_progress',
      })
      .returning();

    let synced = 0;
    let rejected = 0;

    // Process each hit
    for (const hitData of hitsData) {
      try {
        // Validate hit
        const validation = await this.validateHit(hitData);

        // Create hit record
        await this.createHit({
          ...hitData,
          syncSessionId: syncSession.id,
          validated: validation.valid,
          validationScore: validation.score,
          validationFlags: validation.flags,
        });

        if (validation.valid) {
          synced++;
        } else {
          rejected++;
        }
      } catch (error) {
        rejected++;
      }
    }

    // Update sync session
    await db
      .update(bleSyncSessions)
      .set({
        completedAt: new Date(),
        status: 'completed',
        hitsValidated: synced,
        hitsRejected: rejected,
      })
      .where(eq(bleSyncSessions.id, syncSession.id));

    return { synced, rejected, syncSessionId: syncSession.id };
  }

  async validateHit(hit: NewHit): Promise<{ valid: boolean; score: number; flags: any[] }> {
    const flags: any[] = [];
    let score = 100;

    // Validation 1: Check if RSSI is reasonable (not too weak, not too strong)
    if (hit.rssi < -80) {
      flags.push({ type: 'weak_signal', message: 'Signal too weak', rssi: hit.rssi });
      score -= 20;
    }
    if (hit.rssi > -30) {
      flags.push({ type: 'strong_signal', message: 'Signal unusually strong', rssi: hit.rssi });
      score -= 10;
    }

    // Validation 2: Check proximity duration if provided
    if (hit.proximityDuration !== null && hit.proximityDuration !== undefined) {
      if (hit.proximityDuration < 2000) {
        // Less than 2 seconds
        flags.push({
          type: 'short_duration',
          message: 'Proximity duration too short',
          duration: hit.proximityDuration,
        });
        score -= 30;
      }
    }

    // Validation 3: Check if hit timestamp is reasonable (not in future, not too old)
    const now = new Date();
    const hitTime = new Date(hit.hitTimestamp);
    const timeDiff = now.getTime() - hitTime.getTime();

    if (timeDiff < 0) {
      flags.push({ type: 'future_timestamp', message: 'Hit timestamp is in the future' });
      score -= 50;
    }
    if (timeDiff > 24 * 60 * 60 * 1000) {
      // More than 24 hours old
      flags.push({ type: 'old_timestamp', message: 'Hit timestamp is more than 24 hours old' });
      score -= 20;
    }

    // Validation 4: Check for duplicate hits (same beacon + scanner within 30 seconds)
    if (hit.beaconId && hit.scannerId) {
      const recentHits = await db
        .select()
        .from(hits)
        .where(
          and(
            eq(hits.beaconId, hit.beaconId),
            eq(hits.scannerId, hit.scannerId)
          )
        )
        .orderBy(desc(hits.hitTimestamp))
        .limit(5);

      for (const recentHit of recentHits) {
        const timeDiffMs = Math.abs(
          new Date(hit.hitTimestamp).getTime() - new Date(recentHit.hitTimestamp).getTime()
        );
        if (timeDiffMs < 30000) {
          // Within 30 seconds
          flags.push({
            type: 'potential_duplicate',
            message: 'Similar hit found within 30 seconds',
            timeDiff: timeDiffMs,
          });
          score -= 40;
        }
      }
    }

    const valid = score >= 50; // Consider valid if score is 50 or above

    return { valid, score, flags };
  }

  // ===== BLE SYNC SESSIONS =====

  async getBleSyncSessions(scannerId?: number): Promise<BleSyncSession[]> {
    if (scannerId) {
      return await db
        .select()
        .from(bleSyncSessions)
        .where(eq(bleSyncSessions.scannerId, scannerId))
        .orderBy(desc(bleSyncSessions.startedAt));
    }
    return await db.select().from(bleSyncSessions).orderBy(desc(bleSyncSessions.startedAt));
  }

  async getBleSyncSession(id: number): Promise<BleSyncSession | undefined> {
    const [session] = await db
      .select()
      .from(bleSyncSessions)
      .where(eq(bleSyncSessions.id, id))
      .limit(1);
    return session;
  }

  async createBleSyncSession(session: NewBleSyncSession): Promise<BleSyncSession> {
    const [created] = await db.insert(bleSyncSessions).values(session).returning();
    return created;
  }

  async updateBleSyncSession(
    id: number,
    session: Partial<NewBleSyncSession>
  ): Promise<BleSyncSession> {
    const [updated] = await db
      .update(bleSyncSessions)
      .set(session)
      .where(eq(bleSyncSessions.id, id))
      .returning();
    return updated;
  }

  // ===== GAME SESSIONS =====

  async getGameSessions(status?: string): Promise<GameSession[]> {
    if (status) {
      return await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.status, status))
        .orderBy(desc(gameSessions.startTime));
    }
    return await db.select().from(gameSessions).orderBy(desc(gameSessions.startTime));
  }

  async getGameSession(id: number): Promise<GameSession | undefined> {
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.id, id))
      .limit(1);
    return session;
  }

  async getGameSessionBySessionId(sessionId: string): Promise<GameSession | undefined> {
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.sessionId, sessionId))
      .limit(1);
    return session;
  }

  async createGameSession(session: NewGameSession): Promise<GameSession> {
    const [created] = await db.insert(gameSessions).values(session).returning();
    return created;
  }

  async updateGameSession(id: number, session: Partial<NewGameSession>): Promise<GameSession> {
    const [updated] = await db
      .update(gameSessions)
      .set({ ...session, updatedAt: new Date() })
      .where(eq(gameSessions.id, id))
      .returning();
    return updated;
  }

  async calculateGameStats(sessionId: string): Promise<any> {
    // Get all hits for this session
    const sessionHits = await this.getHits({ sessionId, validated: true });

    // Calculate statistics
    const totalHits = sessionHits.length;
    const uniqueZombies = new Set(sessionHits.map((h) => h.zombieId)).size;
    const uniqueSurvivors = new Set(sessionHits.map((h) => h.survivorId)).size;

    // Calculate average RSSI
    const avgRssi =
      sessionHits.reduce((sum, hit) => sum + (hit.rssi || 0), 0) / (totalHits || 1);

    // Calculate hits per zombie
    const zombieHits: Record<number, number> = {};
    sessionHits.forEach((hit) => {
      if (hit.zombieId) {
        zombieHits[hit.zombieId] = (zombieHits[hit.zombieId] || 0) + 1;
      }
    });

    const topZombies = Object.entries(zombieHits)
      .map(([id, count]) => ({ zombieId: parseInt(id), hitCount: count }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10);

    return {
      totalHits,
      uniqueZombies,
      uniqueSurvivors,
      avgRssi,
      topZombies,
      sessionId,
    };
  }

  // ===== ZONES =====

  async getZones(status?: string): Promise<Zone[]> {
    if (status) {
      return await db.select().from(zones).where(eq(zones.status, status));
    }
    return await db.select().from(zones);
  }

  async getZone(id: number): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(eq(zones.id, id)).limit(1);
    return zone;
  }

  async createZone(zone: NewZone): Promise<Zone> {
    const [created] = await db.insert(zones).values(zone).returning();
    return created;
  }

  async updateZone(id: number, zone: Partial<NewZone>): Promise<Zone> {
    const [updated] = await db.update(zones).set(zone).where(eq(zones.id, id)).returning();
    return updated;
  }

  async deleteZone(id: number): Promise<void> {
    await db.delete(zones).where(eq(zones.id, id));
  }
}

export const storage = new DatabaseStorage();
