// Storage implementation - updated to use DatabaseStorage from javascript_database blueprint
import {
  participants,
  timeSlots,
  squads,
  shopItems,
  mealItems,
  squadAuditLog,
  appConfig,
  serverEvents,
  discounts,
  purchases,
  mealPurchases,
  mealDiscounts,
  auditLogs,
  users,
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
  type InsertServerEvent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, desc, isNotNull, sql } from "drizzle-orm";
import type { IStorage, DashboardStats } from "./storage-interfaces";
export type { IStorage, DashboardStats } from "./storage-interfaces";

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
      name: `Squad ${squad.number}`,
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

  async createPurchase(insertPurchase: InsertPurchase): Promise<Purchase & { idempotent?: boolean }> {
    const { clientEventId } = insertPurchase;
    if (clientEventId != null) {
      const [existing] = await db
        .select()
        .from(purchases)
        .where(eq(purchases.clientEventId, clientEventId))
        .limit(1);
      if (existing) {
        return { ...existing, idempotent: true };
      }
    }
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

  // ===== EVENT INGEST =====

  async appendEvents(events: InsertServerEvent[]): Promise<{ inserted: number; duplicates: number }> {
    if (events.length === 0) return { inserted: 0, duplicates: 0 };
    const inserted = await db
      .insert(serverEvents)
      .values(events)
      .onConflictDoNothing({ target: serverEvents.eventUuid })
      .returning({ eventUuid: serverEvents.eventUuid });
    return { inserted: inserted.length, duplicates: events.length - inserted.length };
  }

  async getServerLamportTs(): Promise<number> {
    const config = await this.getSyncConfig();
    return config.serverLamportTs ?? 0;
  }

  async bumpServerLamportTs(min: number): Promise<number> {
    const config = await this.getSyncConfig();
    const [updated] = await db
      .update(appConfig)
      .set({ serverLamportTs: sql`GREATEST(server_lamport_ts, ${min}) + 1` })
      .where(eq(appConfig.id, config.id))
      .returning();
    return updated.serverLamportTs ?? min + 1;
  }

  async ingestEvents(
    events: InsertServerEvent[],
    minLamport: number,
  ): Promise<{ inserted: number; duplicates: number; serverLamportTs: number }> {
    const config = await this.getSyncConfig();

    return await db.transaction(async (tx) => {
      let insertedCount = 0;
      let duplicatesCount = 0;

      if (events.length > 0) {
        const rows = await tx
          .insert(serverEvents)
          .values(events)
          .onConflictDoNothing({ target: serverEvents.eventUuid })
          .returning({ eventUuid: serverEvents.eventUuid });
        insertedCount = rows.length;
        duplicatesCount = events.length - rows.length;
      }

      const [updated] = await tx
        .update(appConfig)
        .set({ serverLamportTs: sql`GREATEST(server_lamport_ts, ${minLamport}) + 1` })
        .where(eq(appConfig.id, config.id))
        .returning();

      const serverLamportTs = updated.serverLamportTs ?? minLamport + 1;

      return { inserted: insertedCount, duplicates: duplicatesCount, serverLamportTs };
    });
  }
}

export const storage = new DatabaseStorage();
