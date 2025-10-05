// Storage implementation - updated to use DatabaseStorage from javascript_database blueprint
import { 
  participants, 
  timeSlots, 
  squads, 
  shopItems, 
  mealItems,
  type Participant, 
  type InsertParticipant,
  type ParticipantWithRelations,
  type TimeSlot,
  type InsertTimeSlot,
  type Squad,
  type InsertSquad,
  type ShopItem,
  type InsertShopItem,
  type MealItem,
  type InsertMealItem,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Participants
  getParticipants(type?: string): Promise<ParticipantWithRelations[]>;
  getParticipant(id: number): Promise<ParticipantWithRelations | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: number, participant: Partial<InsertParticipant>): Promise<Participant>;
  generateLockerNumber(): Promise<string>;
  
  // Time Slots
  getTimeSlots(type?: string): Promise<TimeSlot[]>;
  getTimeSlot(id: number): Promise<TimeSlot | undefined>;
  createTimeSlot(timeSlot: InsertTimeSlot): Promise<TimeSlot>;
  
  // Squads
  getSquads(type?: string): Promise<Squad[]>;
  getSquad(id: number): Promise<Squad | undefined>;
  createSquad(squad: InsertSquad): Promise<Squad>;
  
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

  async generateLockerNumber(): Promise<string> {
    // Generate unique 4-digit locker number
    let lockerNumber: string;
    let exists = true;
    
    while (exists) {
      lockerNumber = Math.floor(1000 + Math.random() * 9000).toString();
      const [existing] = await db
        .select()
        .from(participants)
        .where(eq(participants.lockerNumber, lockerNumber))
        .limit(1);
      exists = !!existing;
    }
    
    return lockerNumber!;
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

  async createSquad(insertSquad: InsertSquad): Promise<Squad> {
    const [squad] = await db
      .insert(squads)
      .values(insertSquad)
      .returning();
    return squad;
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
}

export const storage = new DatabaseStorage();
