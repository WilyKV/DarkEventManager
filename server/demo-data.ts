import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  auditLogs, demoRecords, discounts, mealDiscounts, mealItems, mealPurchases, participants,
  purchases, shopItems, squadAuditLog, squads, timeSlots, users, USER_ROLES,
} from "@shared/schema";
import type { DemoDataStatus } from "@shared/demo-data";
import { db } from "./db";
import { storage } from "./storage";

const groups = [
  { type: "zombie", label: "Zombie", names: [["Alice", "Ronce"], ["Bastien", "Nocturne"], ["Chloé", "Brume"], ["Dorian", "Silex"]] },
  { type: "survivant", label: "Survivant", names: [["Emma", "Flamme"], ["Félix", "Lune"], ["Garance", "Phare"], ["Hugo", "Boussole"]] },
  { type: "staff", label: "Staff", names: [["Inès", "Balise"], ["Jules", "Relais"], ["Kenza", "Lanterne"], ["Léo", "Guetteur"]] },
];

const catalog = {
  shop: [
    { name: "Démo · Gourde", category: "Accessoires", stock: 15, price: "5.00", icon: "Droplets" },
    { name: "Démo · Jus de pomme", category: "Boissons", stock: 24, price: "2.00", icon: "GlassWater" },
    { name: "Démo · Écusson", category: "Accessoires", stock: 0, price: "3.50", icon: "Shield" },
  ],
  meals: [
    { name: "Démo · Velouté", category: "Entrée", stock: 16, price: "4.00", icon: "Soup" },
    { name: "Démo · Chili végétarien", category: "Plat", stock: 30, price: "8.00", icon: "Utensils" },
    { name: "Démo · Tarte", category: "Dessert", stock: 0, price: "3.00", icon: "CakeSlice" },
  ],
};

const demoAccounts = [
  { username: "demo.accueil.zombie", role: USER_ROLES.STAFF_ZOMBIE },
  { username: "demo.accueil.survivant", role: USER_ROLES.STAFF_SURVIVANT },
  { username: "demo.boutique", role: USER_ROLES.STAFF_BOUTIQUE },
  { username: "demo.repas", role: USER_ROLES.STAFF_REPAS },
];

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DemoRecord = typeof demoRecords.$inferSelect;
type Reference = Exclude<keyof DemoRecord, "id">;

function ids(records: DemoRecord[], field: Reference): number[] {
  return records.flatMap(row => row[field] ?? []);
}

function summarize(records: DemoRecord[]): DemoDataStatus {
  return { loaded: records.length > 0, participants: ids(records, "participantId").length };
}

async function lockDemoData(tx: Transaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('darkevent.demo-data'))`);
}

export async function getDemoDataStatus(): Promise<DemoDataStatus> {
  return summarize(await db.select().from(demoRecords));
}

export async function loadDemoData(): Promise<DemoDataStatus> {
  return db.transaction(async tx => {
    await lockDemoData(tx);
    const existing = await tx.select().from(demoRecords);
    if (existing.length) return summarize(existing);

    const markers: Array<typeof demoRecords.$inferInsert> = [];
    const shop = await tx.insert(shopItems).values(catalog.shop).returning({ id: shopItems.id });
    const meals = await tx.insert(mealItems).values(catalog.meals).returning({ id: mealItems.id });
    markers.push(...shop.map(({ id }) => ({ shopItemId: id })), ...meals.map(({ id }) => ({ mealItemId: id })));

    for (const { type, label, names } of groups) {
      const slots = await tx.insert(timeSlots).values([
        { name: `Démo · ${label} 18 h`, type, mealTime: "17:30", briefingTime: "18:00", gameTime: "18:30", exitTime: "19:45" },
        { name: `Démo · ${label} 20 h`, type, mealTime: "19:30", briefingTime: "20:00", gameTime: "20:30", exitTime: "21:45" },
      ]).returning({ id: timeSlots.id });
      markers.push(...slots.map(({ id }) => ({ timeSlotId: id })));

      const teams = await tx.insert(squads).values(slots.map(({ id }, index) => ({
        number: 91 + index, type, timeSlotId: id, maxMembers: 6, briefing: "Équipe de démonstration.",
      }))).returning({ id: squads.id });
      markers.push(...teams.map(({ id }) => ({ squadId: id })));

      const players: number[] = [];
      for (let index = 0; index < names.length; index++) {
        const [firstName, lastName] = names[index];
        const team = index < 2 ? 0 : 1;
        const arrived = index > 0;
        const complete = index >= 2;
        const returned = index === 3;
        const [player] = await tx.insert(participants).values({
          firstName: `Démo ${firstName}`, lastName, type, timeSlotId: slots[team].id,
          squadId: arrived ? teams[team].id : null,
          secretCode: await storage.generateSecretCode(tx),
          arrived, arrivedAt: arrived ? new Date("2025-10-31T17:45:00Z") : null,
          returned, returnedAt: returned ? new Date("2025-10-31T21:45:00Z") : null,
          waterBottleGiven: arrived, squadExplained: arrived, briefingExplained: complete,
          mealTicketGiven: complete, makeupWaitExplained: complete, mapGiven: returned,
          checklistCompleted: complete, hasFreemeal: type === "zombie", freeMealClaimed: type === "zombie" && complete,
        }).returning({ id: participants.id });
        players.push(player.id);
        markers.push({ participantId: player.id });
        if (arrived) await tx.insert(squadAuditLog).values({ participantId: player.id, newSquadId: teams[team].id });
      }

      await tx.insert(discounts).values([
        { squadId: teams[0].id, squadDiscount: 10 },
        { participantId: players[2], participantDiscount: 20 },
      ]);
      await tx.insert(mealDiscounts).values([
        { squadId: teams[0].id, squadDiscount: 10 },
        { participantId: players[2], participantDiscount: 25 },
      ]);
      await tx.insert(purchases).values([
        { participantId: players[1], shopItemId: shop[0].id, quantity: 1, originalPrice: "5.00", unitPrice: "4.50", discountApplied: 10, totalPrice: "4.50", isPaid: false },
        { participantId: players[2], shopItemId: shop[1].id, quantity: 2, originalPrice: "2.00", unitPrice: "1.60", discountApplied: 20, totalPrice: "3.20", isPaid: true },
      ]);
      await tx.insert(mealPurchases).values([
        { participantId: players[1], mealItemId: meals[0].id, quantity: 1, originalPrice: "4.00", unitPrice: "3.60", discountApplied: 10, totalPrice: "3.60", isPaid: false },
        { participantId: players[2], mealItemId: meals[1].id, quantity: 1, originalPrice: "8.00", unitPrice: "6.00", discountApplied: 25, totalPrice: "6.00", isPaid: true },
      ]);
      const history = await tx.insert(auditLogs).values([
        { username: "Démonstration", tableName: "participants", recordId: players[0], action: "CREATE" },
        { username: "Démonstration", tableName: "participants", recordId: players[2], action: "UPDATE" },
      ]).returning({ id: auditLogs.id });
      markers.push(...history.map(({ id }) => ({ auditLogId: id })));
    }

    const accounts = await tx.insert(users).values(demoAccounts.map(({ username, role }) => ({
      username, roles: JSON.stringify([role]), passwordHash: "demo-account-disabled",
    }))).onConflictDoNothing({ target: users.username }).returning({ id: users.id });
    markers.push(...accounts.map(({ id }) => ({ userId: id })));

    const saved = await tx.insert(demoRecords).values(markers).returning();
    return summarize(saved);
  });
}

export async function removeDemoData(): Promise<DemoDataStatus> {
  return db.transaction(async tx => {
    await lockDemoData(tx);
    const markers = await tx.select().from(demoRecords);
    if (!markers.length) return summarize(markers);

    const playerIds = ids(markers, "participantId");
    const teamIds = ids(markers, "squadId");
    const shopIds = ids(markers, "shopItemId");
    const mealIds = ids(markers, "mealItemId");
    const userIds = ids(markers, "userId");

    // Only remove relationships wholly inside the demo. A mixed relationship retains its FK,
    // so PostgreSQL aborts the transaction instead of changing an operational record.
    await tx.delete(purchases).where(and(inArray(purchases.participantId, playerIds), inArray(purchases.shopItemId, shopIds)));
    await tx.delete(mealPurchases).where(and(inArray(mealPurchases.participantId, playerIds), inArray(mealPurchases.mealItemId, mealIds)));
    for (const table of [discounts, mealDiscounts]) {
      await tx.delete(table).where(and(
        or(inArray(table.squadId, teamIds), inArray(table.participantId, playerIds)),
        or(isNull(table.squadId), inArray(table.squadId, teamIds)),
        or(isNull(table.participantId), inArray(table.participantId, playerIds)),
      ));
    }
    await tx.delete(squadAuditLog).where(and(
      inArray(squadAuditLog.participantId, playerIds),
      or(isNull(squadAuditLog.previousSquadId), inArray(squadAuditLog.previousSquadId, teamIds)),
      or(isNull(squadAuditLog.newSquadId), inArray(squadAuditLog.newSquadId, teamIds)),
    ));
    await tx.delete(auditLogs).where(or(
      inArray(auditLogs.id, ids(markers, "auditLogId")),
      and(eq(auditLogs.tableName, "participants"), inArray(auditLogs.recordId, playerIds)),
      and(eq(auditLogs.tableName, "users"), inArray(auditLogs.recordId, userIds)),
    ));

    await tx.delete(participants).where(inArray(participants.id, playerIds));
    await tx.delete(shopItems).where(inArray(shopItems.id, shopIds));
    await tx.delete(mealItems).where(inArray(mealItems.id, mealIds));
    await tx.delete(squads).where(inArray(squads.id, teamIds));
    await tx.delete(timeSlots).where(inArray(timeSlots.id, ids(markers, "timeSlotId")));
    await tx.delete(users).where(inArray(users.id, userIds));
    return { loaded: false, participants: 0 };
  });
}
