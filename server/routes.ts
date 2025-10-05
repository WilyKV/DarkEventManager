import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import xlsx from "xlsx";
import { insertParticipantSchema, insertTimeSlotSchema, insertSquadSchema, insertShopItemSchema, insertMealItemSchema, createParticipantSchema } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Initialize default squads if none exist
  const initializeSquads = async () => {
    const zombieSquads = await storage.getSquads("zombie");
    const survivantSquads = await storage.getSquads("survivant");
    
    if (zombieSquads.length === 0) {
      const zombieSquadNames = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
      for (const name of zombieSquadNames) {
        await storage.createSquad({ name: `Squad ${name}`, type: "zombie", maxMembers: 10 });
      }
    }
    
    if (survivantSquads.length === 0) {
      const survivantSquadNames = ["Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6", "Team 7", "Team 8"];
      for (const name of survivantSquadNames) {
        await storage.createSquad({ name, type: "survivant", maxMembers: 8 });
      }
    }
  };
  
  await initializeSquads();
  
  // ===== PARTICIPANTS =====
  
  // Get all participants (with optional type filter via query string)
  app.get("/api/participants", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const participants = await storage.getParticipants(type);
      res.json(participants);
    } catch (error) {
      res.status(500).json({ message: "Error fetching participants" });
    }
  });

  // Get single participant by ID
  app.get("/api/participants/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid participant ID" });
      }
      const participant = await storage.getParticipant(id);
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.json(participant);
    } catch (error) {
      res.status(500).json({ message: "Error fetching participant" });
    }
  });

  // Create new participant
  app.post("/api/participants", async (req, res) => {
    try {
      const validationResult = createParticipantSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid participant data", 
          errors: validationResult.error.errors 
        });
      }

      const { firstName, lastName, type, timeSlotId } = validationResult.data;

      // Set hasFreemeal based on type
      const participantData = {
        firstName,
        lastName,
        type,
        timeSlotId: timeSlotId ?? null,
        hasFreemeal: type === "zombie",
      };

      const participant = await storage.createParticipant(participantData);
      res.status(201).json(participant);
    } catch (error) {
      console.error("Create participant error:", error);
      res.status(500).json({ message: "Error creating participant" });
    }
  });

  // Update participant
  app.patch("/api/participants/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentParticipant = await storage.getParticipant(id);
      
      if (!currentParticipant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      
      // Auto-generate locker number if arrived and no locker number exists
      if (req.body.arrived && !req.body.lockerNumber) {
        if (!currentParticipant?.lockerNumber) {
          req.body.lockerNumber = await storage.generateLockerNumber();
        }
      }
      
      // Check if squad is changing (before update)
      const squadChanging = req.body.squadId !== undefined && req.body.squadId !== currentParticipant.squadId;
      const previousSquadId = currentParticipant.squadId;
      const newSquadId = req.body.squadId;
      
      // Update participant first
      const participant = await storage.updateParticipant(id, req.body);
      
      // Log squad changes only after successful update
      if (squadChanging) {
        await storage.createSquadAuditLog({
          participantId: id,
          previousSquadId: previousSquadId ?? null,
          newSquadId: newSquadId,
        });
      }
      
      res.json(participant);
    } catch (error) {
      res.status(500).json({ message: "Error updating participant" });
    }
  });

  // Import participants from Excel
  app.post("/api/participants/import", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const type = req.body.type as "zombie" | "survivant";
      if (!type) {
        return res.status(400).json({ message: "Type is required" });
      }

      // Parse Excel file
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json<any>(sheet, { header: ["firstName", "lastName", "timeSlotName"] });

      let count = 0;

      for (const row of data.slice(1)) { // Skip header row
        if (!row.firstName || !row.lastName) continue;

        // Find or create time slot
        let timeSlotId: number | null = null;
        if (row.timeSlotName) {
          const existingSlots = await storage.getTimeSlots(type);
          let timeSlot = existingSlots.find(slot => slot.name === row.timeSlotName);
          
          if (!timeSlot) {
            // Create default time slot with placeholder times
            timeSlot = await storage.createTimeSlot({
              name: row.timeSlotName,
              type,
              mealTime: "À définir",
              briefingTime: "À définir",
              gameTime: "À définir",
              exitTime: "À définir",
            });
          }
          
          timeSlotId = timeSlot.id;
        }

        // Create participant
        await storage.createParticipant({
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          type,
          timeSlotId,
          hasFreemeal: type === "zombie", // Zombies get free meal
        });

        count++;
      }

      res.json({ message: "Import successful", count });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Error importing participants" });
    }
  });

  // Get squad audit logs for a participant
  app.get("/api/participants/:id/squad-history", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const auditLogs = await storage.getSquadAuditLogs(id);
      res.json(auditLogs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching squad history" });
    }
  });

  // ===== TIME SLOTS =====
  
  app.get("/api/time-slots", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const timeSlots = await storage.getTimeSlots(type);
      res.json(timeSlots);
    } catch (error) {
      res.status(500).json({ message: "Error fetching time slots" });
    }
  });

  app.post("/api/time-slots", async (req, res) => {
    try {
      const data = insertTimeSlotSchema.parse(req.body);
      const timeSlot = await storage.createTimeSlot(data);
      res.json(timeSlot);
    } catch (error) {
      res.status(400).json({ message: "Invalid time slot data" });
    }
  });

  // ===== SQUADS =====
  
  app.get("/api/squads", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const squads = await storage.getSquads(type);
      res.json(squads);
    } catch (error) {
      res.status(500).json({ message: "Error fetching squads" });
    }
  });

  app.post("/api/squads", async (req, res) => {
    try {
      const data = insertSquadSchema.parse(req.body);
      const squad = await storage.createSquad(data);
      res.json(squad);
    } catch (error) {
      res.status(400).json({ message: "Invalid squad data" });
    }
  });

  // ===== SHOP ITEMS =====
  
  app.get("/api/shop-items", async (req, res) => {
    try {
      const items = await storage.getShopItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Error fetching shop items" });
    }
  });

  app.post("/api/shop-items", async (req, res) => {
    try {
      const data = insertShopItemSchema.parse(req.body);
      const item = await storage.createShopItem(data);
      res.json(item);
    } catch (error) {
      res.status(400).json({ message: "Invalid shop item data" });
    }
  });

  app.patch("/api/shop-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateShopItem(id, req.body);
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Error updating shop item" });
    }
  });

  app.delete("/api/shop-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteShopItem(id);
      res.json({ message: "Item deleted" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting shop item" });
    }
  });

  // ===== MEAL ITEMS =====
  
  app.get("/api/meal-items", async (req, res) => {
    try {
      const items = await storage.getMealItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Error fetching meal items" });
    }
  });

  app.post("/api/meal-items", async (req, res) => {
    try {
      const data = insertMealItemSchema.parse(req.body);
      const item = await storage.createMealItem(data);
      res.json(item);
    } catch (error) {
      res.status(400).json({ message: "Invalid meal item data" });
    }
  });

  app.patch("/api/meal-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateMealItem(id, req.body);
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Error updating meal item" });
    }
  });

  app.delete("/api/meal-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMealItem(id);
      res.json({ message: "Item deleted" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting meal item" });
    }
  });

  // ===== DASHBOARD STATS =====
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching dashboard stats" });
    }
  });

  // ===== EXPORT REPORTS =====
  app.get("/api/export/participants", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const timeSlotId = req.query.timeSlotId ? parseInt(req.query.timeSlotId as string) : undefined;
      const squadId = req.query.squadId ? parseInt(req.query.squadId as string) : undefined;
      const filterLabel = req.query.filterLabel as string | undefined;

      let participants = await storage.getParticipants(type);

      if (timeSlotId) {
        participants = participants.filter(p => p.timeSlotId === timeSlotId);
      }

      if (squadId) {
        participants = participants.filter(p => p.squadId === squadId);
      }

      const exportData = participants.map(p => ({
        "Prénom": p.firstName,
        "Nom": p.lastName,
        "Type": p.type,
        "Créneau": p.timeSlot?.name || "Non assigné",
        "Squad": p.squad?.name || "Non assigné",
        "Arrivé": p.arrived ? "Oui" : "Non",
        "Casier": p.lockerNumber || "Non assigné",
        "Checklist": p.checklistCompleted ? "Complète" : "Incomplète",
        "Repas gratuit": p.hasFreemeal ? "Oui" : "Non",
        "Repas réclamé": p.freeMealClaimed ? "Oui" : "Non",
      }));

      const ws = xlsx.utils.json_to_sheet(exportData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Participants");

      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const sanitizeFilename = (str: string): string => {
        return str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 50);
      };

      const date = new Date().toISOString().split('T')[0];
      const baseFilename = type || "participants";
      const filterPart = filterLabel 
        ? `_${sanitizeFilename(filterLabel)}`
        : "_tous";
      const filename = `${baseFilename}${filterPart}_${date}.xlsx`;
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: "Error exporting participants" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
