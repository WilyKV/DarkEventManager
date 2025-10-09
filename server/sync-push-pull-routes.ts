import type { Express, Request, Response } from "express";
import { storage } from "./storage";

// Helper pour filtrer les données selon le rôle de l'utilisateur
function filterDataByRole(user: any, data: any) {
  const role = user?.role;

  if (role === 'admin') {
    // Admin a accès à tout
    return data;
  }

  // Filtrer selon le rôle
  const filtered: any = {};

  if (role === 'zombie' || role === 'survivant') {
    // Zombie/Survivant : seulement leurs propres achats
    filtered.purchases = data.purchases?.filter((p: any) => p.participantId === user.participantId) || [];
    filtered.mealPurchases = data.mealPurchases?.filter((p: any) => p.participantId === user.participantId) || [];
  } else if (role === 'staff') {
    // Staff : check-in/check-out (participants avec arrivedAt/returnedAt)
    filtered.participants = data.participants || [];
  } else if (role === 'boutique') {
    // Boutique : produits et achats boutique
    filtered.shopItems = data.shopItems || [];
    filtered.purchases = data.purchases || [];
  } else if (role === 'repas') {
    // Repas : produits repas et achats repas
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

      // Récupérer les données locales selon le rôle
      const allData: any = {};

      if (user.role === 'admin') {
        // Admin : tout
        allData.participants = await storage.getParticipants();
        allData.timeSlots = await storage.getTimeSlots();
        allData.squads = await storage.getSquads();
        allData.shopItems = await storage.getShopItems();
        allData.mealItems = await storage.getMealItems();
        // Récupérer tous les achats (pas de méthode getAll, donc on récupère par participant)
        const allParticipants = await storage.getParticipants();
        allData.purchases = [];
        allData.mealPurchases = [];
        for (const p of allParticipants) {
          const purchases = await storage.getPurchases(p.id);
          const mealPurchases = await storage.getMealPurchases(p.id);
          allData.purchases.push(...purchases);
          allData.mealPurchases.push(...mealPurchases);
        }
      } else if (user.role === 'zombie' || user.role === 'survivant') {
        // Leurs achats seulement
        if (user.participantId) {
          allData.purchases = await storage.getPurchases(user.participantId);
          allData.mealPurchases = await storage.getMealPurchases(user.participantId);
        }
      } else if (user.role === 'staff') {
        // Participants (check-in/out)
        allData.participants = await storage.getParticipants();
      } else if (user.role === 'boutique') {
        // Produits et achats boutique
        allData.shopItems = await storage.getShopItems();
        const allParticipants = await storage.getParticipants();
        allData.purchases = [];
        for (const p of allParticipants) {
          const purchases = await storage.getPurchases(p.id);
          allData.purchases.push(...purchases);
        }
      } else if (user.role === 'repas') {
        // Produits et achats repas
        allData.mealItems = await storage.getMealItems();
        const allParticipants = await storage.getParticipants();
        allData.mealPurchases = [];
        for (const p of allParticipants) {
          const mealPurchases = await storage.getMealPurchases(p.id);
          allData.mealPurchases.push(...mealPurchases);
        }
      }

      // TODO: Dans une vraie implémentation, envoyer vers le serveur maître
      // Pour l'instant, on simule juste le succès
      const count = Object.values(allData).reduce((sum: number, arr: any) => 
        sum + (Array.isArray(arr) ? arr.length : 0), 0
      );

      res.json({ 
        success: true, 
        count,
        message: `${count} élément(s) envoyé(s) avec succès`
      });
    } catch (error) {
      console.error("Erreur Push:", error);
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

      // TODO: Dans une vraie implémentation, récupérer depuis le serveur maître
      // Pour l'instant, on simule avec les données locales déjà présentes
      
      const pulledData: any = {};
      let count = 0;

      if (user.role === 'admin') {
        // Admin : tout
        pulledData.participants = await storage.getParticipants();
        pulledData.timeSlots = await storage.getTimeSlots();
        pulledData.squads = await storage.getSquads();
        pulledData.shopItems = await storage.getShopItems();
        pulledData.mealItems = await storage.getMealItems();
        count = Object.values(pulledData).reduce((sum: number, arr: any) => 
          sum + (Array.isArray(arr) ? arr.length : 0), 0
        );
      } else if (user.role === 'zombie' || user.role === 'survivant') {
        // Leurs achats seulement
        if (user.participantId) {
          pulledData.purchases = await storage.getPurchases(user.participantId);
          pulledData.mealPurchases = await storage.getMealPurchases(user.participantId);
          count = (pulledData.purchases?.length || 0) + (pulledData.mealPurchases?.length || 0);
        }
      } else if (user.role === 'staff') {
        // Participants
        pulledData.participants = await storage.getParticipants();
        count = pulledData.participants?.length || 0;
      } else if (user.role === 'boutique') {
        // Produits boutique
        pulledData.shopItems = await storage.getShopItems();
        count = pulledData.shopItems?.length || 0;
      } else if (user.role === 'repas') {
        // Produits repas
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
      console.error("Erreur Pull:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des données" });
    }
  });
}
