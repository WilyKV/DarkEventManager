import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { USER_ROLES, type UserRole } from "@shared/schema";
import { childLogger } from "./logger";

const syncLogger = childLogger('sync');

// Helper défensif : accepte string[] en mémoire OU string JSON-encodée (session legacy)
function parseRoles(rawRoles: unknown): UserRole[] {
  const ALL_ROLES = new Set<string>(Object.values(USER_ROLES));
  let arr: unknown[] = [];
  if (Array.isArray(rawRoles)) {
    arr = rawRoles;
  } else if (typeof rawRoles === 'string') {
    try {
      const parsed = JSON.parse(rawRoles);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      return [];
    }
  }
  return arr.filter((r): r is UserRole => typeof r === 'string' && ALL_ROLES.has(r));
}

// Helper pour filtrer les données selon le rôle de l'utilisateur
function filterDataByRole(user: any, data: any) {
  const roles = parseRoles(user?.roles);

  if (roles.includes(USER_ROLES.ADMIN)) {
    return data;
  }

  const filtered: any = {};

  if (roles.includes(USER_ROLES.STAFF_ZOMBIE) || roles.includes(USER_ROLES.STAFF_SURVIVANT)) {
    // Staff zombie/survivant : check-in/check-out (participants)
    filtered.participants = data.participants || [];
  } else if (roles.includes(USER_ROLES.STAFF_BOUTIQUE)) {
    filtered.shopItems = data.shopItems || [];
    filtered.purchases = data.purchases || [];
  } else if (roles.includes(USER_ROLES.STAFF_REPAS)) {
    filtered.mealItems = data.mealItems || [];
    filtered.mealPurchases = data.mealPurchases || [];
  }

  return filtered;
}

export function registerSyncPushPullRoutes(app: Express) {
  // POST /api/sync/push - Envoyer les données locales vers le serveur maître
  app.post("/api/sync/push", async (req: Request, res: Response) => {
    try {
      const user = (req as any).session?.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const roles = parseRoles(user?.roles);
      if (roles.length === 0) {
        return res.status(403).json({ message: "Accès refusé : aucun rôle valide" });
      }

      const allData: any = {};

      if (roles.includes(USER_ROLES.ADMIN)) {
        allData.participants = await storage.getParticipants();
        allData.timeSlots = await storage.getTimeSlots();
        allData.squads = await storage.getSquads();
        allData.shopItems = await storage.getShopItems();
        allData.mealItems = await storage.getMealItems();
        const allParticipants = await storage.getParticipants();
        allData.purchases = [];
        allData.mealPurchases = [];
        for (const p of allParticipants) {
          const purchases = await storage.getPurchases(p.id);
          const mealPurchases = await storage.getMealPurchases(p.id);
          allData.purchases.push(...purchases);
          allData.mealPurchases.push(...mealPurchases);
        }
      } else if (roles.includes(USER_ROLES.STAFF_ZOMBIE) || roles.includes(USER_ROLES.STAFF_SURVIVANT)) {
        // Staff zombie/survivant : participants (check-in/out)
        allData.participants = await storage.getParticipants();
      } else if (roles.includes(USER_ROLES.STAFF_BOUTIQUE)) {
        allData.shopItems = await storage.getShopItems();
        const allParticipants = await storage.getParticipants();
        allData.purchases = [];
        for (const p of allParticipants) {
          const purchases = await storage.getPurchases(p.id);
          allData.purchases.push(...purchases);
        }
      } else if (roles.includes(USER_ROLES.STAFF_REPAS)) {
        allData.mealItems = await storage.getMealItems();
        const allParticipants = await storage.getParticipants();
        allData.mealPurchases = [];
        for (const p of allParticipants) {
          const mealPurchases = await storage.getMealPurchases(p.id);
          allData.mealPurchases.push(...mealPurchases);
        }
      }

      const count = Object.values(allData).reduce((sum: number, arr: any) =>
        sum + (Array.isArray(arr) ? arr.length : 0), 0
      );

      res.json({
        success: true,
        count,
        message: `${count} élément(s) envoyé(s) avec succès`
      });
    } catch (error) {
      syncLogger.error({ err: error }, 'Erreur Push');
      res.status(500).json({ message: "Erreur lors de l'envoi des données" });
    }
  });

  // POST /api/sync/pull - Récupérer les données depuis le serveur maître
  app.post("/api/sync/pull", async (req: Request, res: Response) => {
    try {
      const user = (req as any).session?.user;
      if (!user) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const roles = parseRoles(user?.roles);
      if (roles.length === 0) {
        return res.status(403).json({ message: "Accès refusé : aucun rôle valide" });
      }

      const pulledData: any = {};
      let count = 0;

      if (roles.includes(USER_ROLES.ADMIN)) {
        pulledData.participants = await storage.getParticipants();
        pulledData.timeSlots = await storage.getTimeSlots();
        pulledData.squads = await storage.getSquads();
        pulledData.shopItems = await storage.getShopItems();
        pulledData.mealItems = await storage.getMealItems();
        count = Object.values(pulledData).reduce((sum: number, arr: any) =>
          sum + (Array.isArray(arr) ? arr.length : 0), 0
        );
      } else if (roles.includes(USER_ROLES.STAFF_ZOMBIE) || roles.includes(USER_ROLES.STAFF_SURVIVANT)) {
        pulledData.participants = await storage.getParticipants();
        count = pulledData.participants?.length || 0;
      } else if (roles.includes(USER_ROLES.STAFF_BOUTIQUE)) {
        pulledData.shopItems = await storage.getShopItems();
        count = pulledData.shopItems?.length || 0;
      } else if (roles.includes(USER_ROLES.STAFF_REPAS)) {
        pulledData.mealItems = await storage.getMealItems();
        count = pulledData.mealItems?.length || 0;
      }

      res.json({
        success: true,
        count,
        message: `${count} élément(s) récupéré(s) avec succès`,
        data: pulledData
      });
    } catch (error) {
      syncLogger.error({ err: error }, 'Erreur Pull');
      res.status(500).json({ message: "Erreur lors de la récupération des données" });
    }
  });
}
