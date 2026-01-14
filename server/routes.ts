import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { checkSyncPermissions } from "./sync-middleware";
import multer from "multer";
import xlsx from "xlsx";
import crypto from "crypto";
import pako from "pako";
import { insertParticipantSchema, insertTimeSlotSchema, insertSquadSchema, insertShopItemSchema, insertMealItemSchema, createParticipantSchema } from "@shared/schema";
import { generateParticipantPDF } from "./pdf-service";

const upload = multer({ storage: multer.memoryStorage() });

// Encryption key and IV for QR codes - MUST be set in environment variables
const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY;
const ENCRYPTION_IV = process.env.QR_ENCRYPTION_IV;

// Validate encryption keys are present
if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
  throw new Error(
    '🚨 CRITICAL: QR_ENCRYPTION_KEY and QR_ENCRYPTION_IV must be set in environment variables.\n' +
    'Generate them with:\n' +
    '  QR_ENCRYPTION_KEY=$(node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")\n' +
    '  QR_ENCRYPTION_IV=$(node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))")'
  );
}

// Validate key lengths
if (ENCRYPTION_KEY.length < 32) {
  throw new Error('QR_ENCRYPTION_KEY must be at least 32 characters');
}
if (ENCRYPTION_IV.length < 16) {
  throw new Error('QR_ENCRYPTION_IV must be at least 16 characters');
}

function encryptQRData(participantId: number, secretCode: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = Buffer.from(ENCRYPTION_IV.padEnd(16, '0').slice(0, 16));
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  const data = JSON.stringify({ id: participantId, code: secretCode });
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return encrypted;
}

function decryptQRData(encryptedData: string): { id: number; code: string } | null {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const iv = Buffer.from(ENCRYPTION_IV.padEnd(16, '0').slice(0, 16));
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    return null;
  }
}

// Utility function to create audit logs
async function createAuditLog(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  tableName: string,
  recordId: number | null,
  req: any,
  recordData?: any,
  changes?: any
) {
  try {
    const user = (req as any).session?.user;
    
    await storage.createAuditLog({
      userId: user?.id || null,
      username: user?.username || 'anonymous',
      action,
      tableName,
      recordId,
      recordData: recordData ? JSON.stringify(recordData) : null,
      changes: changes ? JSON.stringify(changes) : null,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.get('user-agent') || null,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Ne pas bloquer l'opération si le logging échoue
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Apply sync permissions middleware to main API routes (not sync routes)
  app.use('/api/participants', checkSyncPermissions);
  app.use('/api/time-slots', checkSyncPermissions);
  app.use('/api/squads', checkSyncPermissions);
  app.use('/api/shop-items', checkSyncPermissions);
  app.use('/api/meal-items', checkSyncPermissions);
  app.use('/api/dashboard', checkSyncPermissions);

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

  // Get participants count
  app.get("/api/participants/count", async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      res.json(participants.length);
    } catch (error) {
      res.status(500).json({ message: "Error counting participants" });
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

      const { firstName, lastName, email, type, timeSlotId } = validationResult.data;

      // Generate secret code immediately on creation
      const secretCode = await storage.generateSecretCode();

      // Set hasFreemeal based on type
      const participantData = {
        firstName,
        lastName,
        email: email || null,
        type,
        timeSlotId: timeSlotId ?? null,
        hasFreemeal: type === "zombie",
        secretCode,
      };

      const participant = await storage.createParticipant(participantData);
      
      // Log audit trail
      await createAuditLog('CREATE', 'participants', participant.id, req, participant);
      
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
      
      // Secret code should already exist from creation
      
      // Convert timestamp strings to Date objects if present
      if (req.body.arrivedAt && typeof req.body.arrivedAt === 'string') {
        req.body.arrivedAt = new Date(req.body.arrivedAt);
      }
      if (req.body.returnedAt && typeof req.body.returnedAt === 'string') {
        req.body.returnedAt = new Date(req.body.returnedAt);
      }
      
      // Check if squad is changing (before update)
      const squadChanging = req.body.squadId !== undefined && req.body.squadId !== currentParticipant.squadId;
      const previousSquadId = currentParticipant.squadId;
      const newSquadId = req.body.squadId;
      
      // Update participant first
      const participant = await storage.updateParticipant(id, req.body);
      
      // Log audit trail with changes
      await createAuditLog('UPDATE', 'participants', id, req, participant, {
        before: currentParticipant,
        after: participant
      });
      
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
      console.error("Update participant error:", error);
      res.status(500).json({ message: "Error updating participant", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Regenerate secret code for a participant
  app.post("/api/participants/regenerate-code", async (req, res) => {
    try {
      const { participantId } = req.body;

      if (!participantId) {
        return res.status(400).json({ message: "Participant ID is required" });
      }

      const participant = await storage.getParticipant(participantId);
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      // Generate new secret code
      const secretCode = await storage.generateSecretCode();

      // Update participant with new code
      const updated = await storage.updateParticipant(participantId, { secretCode });

      res.json({ success: true, secretCode: updated.secretCode });
    } catch (error) {
      console.error("Regenerate code error:", error);
      res.status(500).json({ message: "Error regenerating code" });
    }
  });

  // Batch update participants
  app.post("/api/participants/batch-update", async (req, res) => {
    try {
      const updates = req.body.updates as Array<{ id: number; data: any }>;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: "Updates array is required and must not be empty" });
      }

      // Process each update: generate locker numbers and convert timestamps
      for (const update of updates) {
        const currentParticipant = await storage.getParticipant(update.id);
        if (!currentParticipant) {
          return res.status(404).json({ message: `Participant ${update.id} not found` });
        }

        // Secret code should already exist from creation

        // Convert timestamp strings to Date objects if present
        if (update.data.arrivedAt && typeof update.data.arrivedAt === 'string') {
          update.data.arrivedAt = new Date(update.data.arrivedAt);
        }
        if (update.data.returnedAt && typeof update.data.returnedAt === 'string') {
          update.data.returnedAt = new Date(update.data.returnedAt);
        }
      }

      // Execute batch update in transaction
      const results = await storage.batchUpdateParticipants(updates);
      
      res.json({ success: true, updated: results.length, participants: results });
    } catch (error) {
      console.error("Batch update error:", error);
      res.status(500).json({ message: "Error updating participants", error: error instanceof Error ? error.message : String(error) });
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
        // Convert to string and check if valid
        const firstName = String(row.firstName || "").trim();
        const lastName = String(row.lastName || "").trim();
        
        if (!firstName || !lastName) continue;

        // Find or create time slot
        let timeSlotId: number | null = null;
        if (row.timeSlotName) {
          const timeSlotName = String(row.timeSlotName).trim();
          const existingSlots = await storage.getTimeSlots(type);
          let timeSlot = existingSlots.find(slot => slot.name === timeSlotName);
          
          if (!timeSlot) {
            // Create default time slot with placeholder times
            timeSlot = await storage.createTimeSlot({
              name: timeSlotName,
              type,
              mealTime: "À définir",
              briefingTime: "À définir",
              gameTime: "À définir",
              exitTime: "À définir",
            });
          }
          
          timeSlotId = timeSlot.id;
        }

        // Generate secret code for each participant
        const secretCode = await storage.generateSecretCode();

        // Create participant
        await storage.createParticipant({
          firstName,
          lastName,
          type,
          timeSlotId,
          hasFreemeal: type === "zombie", // Zombies get free meal
          secretCode,
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

  app.patch("/api/time-slots/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const timeSlot = await storage.updateTimeSlot(id, req.body);
      res.json(timeSlot);
    } catch (error) {
      res.status(500).json({ message: "Error updating time slot" });
    }
  });

  app.delete("/api/time-slots/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTimeSlot(id);
      res.json({ message: "Time slot deleted" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting time slot" });
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

  app.get("/api/squads/with-participants", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const timeSlotId = req.query.timeSlotId ? parseInt(req.query.timeSlotId as string) : undefined;
      const squads = await storage.getSquadsWithParticipants(type, timeSlotId);
      res.json(squads);
    } catch (error) {
      res.status(500).json({ message: "Error fetching squads with participants" });
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

  app.patch("/api/squads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const squad = await storage.updateSquad(id, req.body);
      res.json(squad);
    } catch (error) {
      res.status(500).json({ message: "Error updating squad" });
    }
  });

  app.delete("/api/squads/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSquad(id);
      res.json({ message: "Squad deleted" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting squad" });
    }
  });

  // ===== DISCOUNTS =====

  // Get global discounts (type-based)
  app.get("/api/discounts/global", async (req, res) => {
    try {
      const discounts = await storage.getGlobalDiscounts();
      res.json(discounts || { zombieDiscount: 0, survivantDiscount: 0, staffDiscount: 0 });
    } catch (error) {
      res.status(500).json({ message: "Error fetching global discounts" });
    }
  });

  // Update global discounts
  app.put("/api/discounts/global", async (req, res) => {
    try {
      const { zombieDiscount, survivantDiscount, staffDiscount } = req.body;
      const updated = await storage.updateGlobalDiscounts({
        zombieDiscount,
        survivantDiscount,
        staffDiscount,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Error updating global discounts" });
    }
  });

  // Get discount for a specific squad
  app.get("/api/discounts/squad/:squadId", async (req, res) => {
    try {
      const squadId = parseInt(req.params.squadId);
      const discount = await storage.getSquadDiscount(squadId);
      res.json({ discount: discount ?? 0 });
    } catch (error) {
      res.status(500).json({ message: "Error fetching squad discount" });
    }
  });

  // Set discount for a specific squad
  app.put("/api/discounts/squad/:squadId", async (req, res) => {
    try {
      const squadId = parseInt(req.params.squadId);
      const { discount } = req.body;
      const updated = await storage.setSquadDiscount(squadId, discount);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Error setting squad discount" });
    }
  });

  // Get discount for a specific participant
  app.get("/api/discounts/participant/:participantId", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      const discount = await storage.getParticipantDiscount(participantId);
      res.json({ discount });
    } catch (error) {
      res.status(500).json({ message: "Error fetching participant discount" });
    }
  });

  // Set discount for a specific participant
  app.put("/api/discounts/participant/:participantId", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      const { discount } = req.body;
      const updated = await storage.setParticipantDiscount(participantId, discount);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Error setting participant discount" });
    }
  });

  // Calculate discount for a participant
  app.get("/api/discounts/calculate/:participantId", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      const discount = await storage.calculateDiscount(participantId);
      res.json({ discount });
    } catch (error) {
      res.status(500).json({ message: "Error calculating discount" });
    }
  });

  // ===== PURCHASES =====

  // Get all purchases or purchases for a specific participant
  app.get("/api/purchases", async (req, res) => {
    try {
      const participantId = req.query.participantId
        ? parseInt(req.query.participantId as string)
        : undefined;
      const purchases = await storage.getPurchases(participantId);
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ message: "Error fetching purchases" });
    }
  });

  // Get single purchase
  app.get("/api/purchases/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const purchase = await storage.getPurchase(id);
      if (!purchase) {
        return res.status(404).json({ message: "Purchase not found" });
      }
      res.json(purchase);
    } catch (error) {
      res.status(500).json({ message: "Error fetching purchase" });
    }
  });

  // Create purchase
  app.post("/api/purchases", async (req, res) => {
    try {
      const purchase = await storage.createPurchase(req.body);
      res.status(201).json(purchase);
    } catch (error) {
      res.status(500).json({ message: "Error creating purchase" });
    }
  });

  // Update purchase (e.g., mark as paid)
  app.patch("/api/purchases/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const purchase = await storage.updatePurchase(id, req.body);
      res.json(purchase);
    } catch (error) {
      res.status(500).json({ message: "Error updating purchase" });
    }
  });

  // Delete purchase
  app.delete("/api/purchases/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePurchase(id);
      res.json({ message: "Purchase deleted" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting purchase" });
    }
  });

  // Batch mark purchases as paid
  app.post("/api/purchases/batch-pay", async (req, res) => {
    try {
      const { purchaseIds } = req.body;
      if (!Array.isArray(purchaseIds)) {
        return res.status(400).json({ message: "purchaseIds must be an array" });
      }

      const updated = [];
      for (const id of purchaseIds) {
        const purchase = await storage.updatePurchase(id, { isPaid: true });
        updated.push(purchase);
      }

      res.json({ message: "Purchases marked as paid", updated });
    } catch (error) {
      res.status(500).json({ message: "Error marking purchases as paid" });
    }
  });

  // ===== MEAL PURCHASES =====

  // Get all meal purchases or meal purchases for a specific participant
  app.get("/api/meal-purchases", async (req, res) => {
    try {
      const participantId = req.query.participantId
        ? parseInt(req.query.participantId as string)
        : undefined;
      const mealPurchases = await storage.getMealPurchases(participantId);
      res.json(mealPurchases);
    } catch (error) {
      res.status(500).json({ message: "Error fetching meal purchases" });
    }
  });

  // Get single meal purchase
  app.get("/api/meal-purchases/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const mealPurchase = await storage.getMealPurchase(id);
      if (!mealPurchase) {
        return res.status(404).json({ message: "Meal purchase not found" });
      }
      res.json(mealPurchase);
    } catch (error) {
      res.status(500).json({ message: "Error fetching meal purchase" });
    }
  });

  // Create meal purchase
  app.post("/api/meal-purchases", async (req, res) => {
    try {
      const mealPurchase = await storage.createMealPurchase(req.body);
      res.status(201).json(mealPurchase);
    } catch (error) {
      res.status(500).json({ message: "Error creating meal purchase" });
    }
  });

  // Update meal purchase (e.g., mark as paid)
  app.patch("/api/meal-purchases/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const mealPurchase = await storage.updateMealPurchase(id, req.body);
      res.json(mealPurchase);
    } catch (error) {
      res.status(500).json({ message: "Error updating meal purchase" });
    }
  });

  // Delete meal purchase
  app.delete("/api/meal-purchases/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMealPurchase(id);
      res.json({ message: "Meal purchase deleted" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting meal purchase" });
    }
  });

  // Batch mark meal purchases as paid
  app.post("/api/meal-purchases/batch-pay", async (req, res) => {
    try {
      const { purchaseIds } = req.body;
      if (!Array.isArray(purchaseIds)) {
        return res.status(400).json({ message: "purchaseIds must be an array" });
      }

      const updated = [];
      for (const id of purchaseIds) {
        const mealPurchase = await storage.updateMealPurchase(id, { isPaid: true });
        updated.push(mealPurchase);
      }

      res.json({ message: "Meal purchases marked as paid", updated });
    } catch (error) {
      res.status(500).json({ message: "Error marking meal purchases as paid" });
    }
  });

  // ===== MEAL DISCOUNTS =====

  // Get global meal discounts (type-based)
  app.get("/api/meal-discounts/global", async (req, res) => {
    try {
      const discounts = await storage.getGlobalMealDiscounts();
      res.json(discounts || {});
    } catch (error) {
      res.status(500).json({ message: "Error fetching global meal discounts" });
    }
  });

  // Update global meal discounts
  app.put("/api/meal-discounts/global", async (req, res) => {
    try {
      const discounts = await storage.updateGlobalMealDiscounts(req.body);
      res.json(discounts);
    } catch (error) {
      res.status(500).json({ message: "Error updating global meal discounts" });
    }
  });

  // Get squad meal discount
  app.get("/api/meal-discounts/squad/:squadId", async (req, res) => {
    try {
      const squadId = parseInt(req.params.squadId);
      const discount = await storage.getSquadMealDiscount(squadId);
      res.json({ discount: discount ?? 0 });
    } catch (error) {
      res.status(500).json({ message: "Error fetching squad meal discount" });
    }
  });

  // Update squad meal discount
  app.put("/api/meal-discounts/squad/:squadId", async (req, res) => {
    try {
      const squadId = parseInt(req.params.squadId);
      const { discount } = req.body;
      const updated = await storage.setSquadMealDiscount(squadId, discount);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Error updating squad meal discount" });
    }
  });

  // Get participant meal discount
  app.get("/api/meal-discounts/participant/:participantId", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      const discount = await storage.getParticipantMealDiscount(participantId);
      res.json({ discount: discount ?? null });
    } catch (error) {
      res.status(500).json({ message: "Error fetching participant meal discount" });
    }
  });

  // Update participant meal discount
  app.put("/api/meal-discounts/participant/:participantId", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      const { discount } = req.body;
      const updated = await storage.setParticipantMealDiscount(participantId, discount);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Error updating participant meal discount" });
    }
  });

  // Calculate meal discount for participant
  app.get("/api/meal-discounts/calculate/:participantId", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      const discount = await storage.calculateMealDiscount(participantId);
      res.json({ discount });
    } catch (error) {
      res.status(500).json({ message: "Error calculating meal discount" });
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
      if (error instanceof Error) {
        console.error("Shop item validation error:", error.message);
        res.status(400).json({ message: "Invalid shop item data", error: error.message });
      } else {
        res.status(400).json({ message: "Invalid shop item data" });
      }
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
      if (error instanceof Error) {
        console.error("Meal item validation error:", error.message);
        res.status(400).json({ message: "Invalid meal item data", error: error.message });
      } else {
        res.status(400).json({ message: "Invalid meal item data" });
      }
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
        "Squad": p.squad ? `Squad ${p.squad.number}` : "Non assigné",
        "Arrivé": p.arrived ? "Oui" : "Non",
        "Code Secret": p.secretCode || "Non assigné",
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

  // Export time slots to Excel
  app.get("/api/export/time-slots", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const timeSlots = await storage.getTimeSlots(type);

      const exportData = timeSlots.map(ts => ({
        "Nom": ts.name,
        "Type": ts.type,
        "Heure Briefing": ts.briefingTime,
        "Heure Jeu": ts.gameTime,
      }));

      const ws = xlsx.utils.json_to_sheet(exportData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Creneaux");

      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const date = new Date().toISOString().split('T')[0];
      const baseFilename = type || "creneaux";
      const filename = `${baseFilename}_creneaux_${date}.xlsx`;
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: "Error exporting time slots" });
    }
  });

  // Export squads to Excel
  app.get("/api/export/squads", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const squads = await storage.getSquadsWithParticipants(type);

      const exportData = squads.map(squad => ({
        "Numéro": squad.number,
        "Type": squad.type,
        "Nombre de participants": squad.participants?.length || 0,
      }));

      const ws = xlsx.utils.json_to_sheet(exportData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Squads");

      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const date = new Date().toISOString().split('T')[0];
      const baseFilename = type || "squads";
      const filename = `${baseFilename}_squads_${date}.xlsx`;
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: "Error exporting squads" });
    }
  });

  // Export ALL data (participants + time slots + squads) to Excel
  app.get("/api/export/all-data", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      
      // Get all data
      const participants = await storage.getParticipants(type);
      const timeSlots = await storage.getTimeSlots(type);
      const squads = await storage.getSquadsWithParticipants(type);

      // Prepare participants data
      const participantsData = participants.map(p => ({
        "Prénom": p.firstName,
        "Nom": p.lastName,
        "Type": p.type,
        "Créneau": p.timeSlot?.name || "Non assigné",
        "Squad": p.squad ? `Squad ${p.squad.number}` : "Non assigné",
        "Arrivé": p.arrived ? "Oui" : "Non",
        "Code Secret": p.secretCode || "Non assigné",
        "Checklist": p.checklistCompleted ? "Oui" : "Non",
        "Repas gratuit": p.hasFreemeal ? "Oui" : "Non",
        "Repas réclamé": p.freeMealClaimed ? "Oui" : "Non",
      }));

      // Prepare time slots data
      const timeSlotsData = timeSlots.map(ts => ({
        "Nom": ts.name,
        "Type": ts.type,
        "Heure Briefing": ts.briefingTime,
        "Heure Jeu": ts.gameTime,
      }));

      // Prepare squads data
      const squadsData = squads.map(squad => ({
        "Numéro": squad.number,
        "Type": squad.type,
        "Nombre de participants": squad.participants?.length || 0,
      }));

      // Create workbook with multiple sheets
      const wb = xlsx.utils.book_new();
      
      const wsParticipants = xlsx.utils.json_to_sheet(participantsData);
      xlsx.utils.book_append_sheet(wb, wsParticipants, "Participants");
      
      const wsTimeSlots = xlsx.utils.json_to_sheet(timeSlotsData);
      xlsx.utils.book_append_sheet(wb, wsTimeSlots, "Creneaux");
      
      if (type !== 'staff') {
        const wsSquads = xlsx.utils.json_to_sheet(squadsData);
        xlsx.utils.book_append_sheet(wb, wsSquads, "Squads");
      }

      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      const date = new Date().toISOString().split('T')[0];
      const baseFilename = type || "toutes_donnees";
      const filename = `${baseFilename}_complet_${date}.xlsx`;
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: "Error exporting all data" });
    }
  });

  // ===== QR CODE GENERATION & SCANNING =====
  app.get("/api/qr/generate/:participantId", async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      const participant = await storage.getParticipant(participantId);

      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      if (!participant.secretCode) {
        return res.status(400).json({ message: "Participant does not have a secret code" });
      }

      const encryptedData = encryptQRData(participant.id, participant.secretCode);
      res.json({ qrData: encryptedData });
    } catch (error) {
      res.status(500).json({ message: "Error generating QR code" });
    }
  });

  app.post("/api/qr/scan", async (req, res) => {
    try {
      const { qrData } = req.body;

      if (!qrData) {
        return res.status(400).json({ message: "QR data is required" });
      }

      const decryptedData = decryptQRData(qrData);

      if (!decryptedData) {
        return res.status(400).json({ message: "Invalid QR code" });
      }

      const participant = await storage.getParticipant(decryptedData.id);

      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      if (participant.secretCode !== decryptedData.code) {
        return res.status(400).json({ message: "Invalid secret code" });
      }

      res.json({ participant });
    } catch (error) {
      res.status(500).json({ message: "Error scanning QR code" });
    }
  });

  // ===== DATA MANAGEMENT (RESET, EXPORT, IMPORT) =====

  // Reset data by type
  app.post("/api/data/reset", async (req, res) => {
    try {
      const { module, type } = req.body;

      if (!module) {
        return res.status(400).json({ message: "Module is required" });
      }

      await storage.resetData(module, type);

      res.json({ message: `${module} data reset successfully`, module, type });
    } catch (error) {
      console.error("Reset error:", error);
      res.status(500).json({ message: "Error resetting data" });
    }
  });

  // Export all data as Excel
  app.get("/api/data/export-all", async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      const timeSlots = await storage.getTimeSlots();
      const squads = await storage.getSquads();
      const shopItems = await storage.getShopItems();
      const mealItems = await storage.getMealItems();

      const wb = xlsx.utils.book_new();

      // Participants sheet
      const participantsData = participants.map(p => ({
        "ID": p.id,
        "Prénom": p.firstName,
        "Nom": p.lastName,
        "Email": p.email || "",
        "Type": p.type,
        "Créneau": p.timeSlot?.name || "",
        "Squad": p.squad ? `Squad ${p.squad.number}` : "",
        "Code Secret": p.secretCode || "",
        "Arrivé": p.arrived ? "Oui" : "Non",
        "Heure arrivée": p.arrivedAt ? new Date(p.arrivedAt).toLocaleString() : "",
        "Retourné": p.returned ? "Oui" : "Non",
        "Heure retour": p.returnedAt ? new Date(p.returnedAt).toLocaleString() : "",
        "Checklist": p.checklistCompleted ? "Oui" : "Non",
        "Repas gratuit": p.hasFreemeal ? "Oui" : "Non",
        "Repas réclamé": p.freeMealClaimed ? "Oui" : "Non",
      }));
      const wsParticipants = xlsx.utils.json_to_sheet(participantsData);
      xlsx.utils.book_append_sheet(wb, wsParticipants, "Participants");

      // Time slots sheet
      const timeSlotsData = timeSlots.map(ts => ({
        "ID": ts.id,
        "Nom": ts.name,
        "Type": ts.type,
        "Heure repas": ts.mealTime,
        "Heure briefing": ts.briefingTime,
        "Heure jeu": ts.gameTime,
        "Heure sortie": ts.exitTime,
      }));
      const wsTimeSlots = xlsx.utils.json_to_sheet(timeSlotsData);
      xlsx.utils.book_append_sheet(wb, wsTimeSlots, "Créneaux");

      // Squads sheet
      const squadsData = squads.map(s => ({
        "ID": s.id,
        "Numéro": s.number,
        "Type": s.type,
        "Créneau ID": s.timeSlotId || "",
        "Max membres": s.maxMembers,
      }));
      const wsSquads = xlsx.utils.json_to_sheet(squadsData);
      xlsx.utils.book_append_sheet(wb, wsSquads, "Squads");

      // Shop items sheet
      const shopData = shopItems.map(i => ({
        "ID": i.id,
        "Nom": i.name,
        "Catégorie": i.category,
        "Prix": i.price,
        "Stock": i.stock,
      }));
      const wsShop = xlsx.utils.json_to_sheet(shopData);
      xlsx.utils.book_append_sheet(wb, wsShop, "Boutique");

      // Meal items sheet
      const mealData = mealItems.map(i => ({
        "ID": i.id,
        "Nom": i.name,
        "Catégorie": i.category,
        "Prix": i.price,
        "Stock": i.stock,
      }));
      const wsMeal = xlsx.utils.json_to_sheet(mealData);
      xlsx.utils.book_append_sheet(wb, wsMeal, "Repas");

      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
      const date = new Date().toISOString().split('T')[0];
      const filename = `darkevent_export_complet_${date}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      console.error("Export all error:", error);
      res.status(500).json({ message: "Error exporting all data" });
    }
  });

  // Export data by module
  app.get("/api/data/export/:module", async (req, res) => {
    try {
      const module = req.params.module;
      const type = req.query.type as string | undefined;

      let data: any[] = [];
      let sheetName = "";
      let filename = "";

      switch (module) {
        case "participants":
          data = await storage.getParticipants(type);
          data = data.map(p => ({
            "ID": p.id,
            "Prénom": p.firstName,
            "Nom": p.lastName,
            "Email": p.email || "",
            "Type": p.type,
            "Créneau": p.timeSlot?.name || "",
            "Squad": p.squad ? `Squad ${p.squad.number}` : "",
            "Code Secret": p.secretCode || "",
            "Arrivé": p.arrived ? "Oui" : "Non",
            "Checklist": p.checklistCompleted ? "Oui" : "Non",
            "Repas gratuit": p.hasFreemeal ? "Oui" : "Non",
          }));
          sheetName = "Participants";
          filename = type ? `${type}s_${new Date().toISOString().split('T')[0]}.xlsx` : `participants_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;

        case "timeslots":
          data = await storage.getTimeSlots(type);
          data = data.map(ts => ({
            "ID": ts.id,
            "Nom": ts.name,
            "Type": ts.type,
            "Heure repas": ts.mealTime,
            "Heure briefing": ts.briefingTime,
            "Heure jeu": ts.gameTime,
            "Heure sortie": ts.exitTime,
          }));
          sheetName = "Créneaux";
          filename = `creneaux_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;

        case "squads":
          data = await storage.getSquads(type);
          data = data.map(s => ({
            "ID": s.id,
            "Numéro": s.number,
            "Type": s.type,
            "Créneau ID": s.timeSlotId || "",
            "Max membres": s.maxMembers,
          }));
          sheetName = "Squads";
          filename = `squads_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;

        case "shop":
          data = await storage.getShopItems();
          data = data.map(i => ({
            "ID": i.id,
            "Nom": i.name,
            "Catégorie": i.category,
            "Prix": i.price,
            "Stock": i.stock,
          }));
          sheetName = "Boutique";
          filename = `boutique_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;

        case "meals":
          data = await storage.getMealItems();
          data = data.map(i => ({
            "ID": i.id,
            "Nom": i.name,
            "Catégorie": i.category,
            "Prix": i.price,
            "Stock": i.stock,
          }));
          sheetName = "Repas";
          filename = `repas_${new Date().toISOString().split('T')[0]}.xlsx`;
          break;

        default:
          return res.status(400).json({ message: "Invalid module" });
      }

      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, sheetName);

      const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      console.error("Export module error:", error);
      res.status(500).json({ message: "Error exporting module data" });
    }
  });

  // Import all data from Excel
  app.post("/api/data/import-all", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const stats = { imported: 0, errors: 0 };

      // Map to track time slots by name for reference
      const timeSlotMap = new Map<string, number>();

      // Import time slots first (needed for participants)
      if (workbook.SheetNames.includes("Créneaux")) {
        const sheet = workbook.Sheets["Créneaux"];
        const data = xlsx.utils.sheet_to_json<any>(sheet);
        
        for (const row of data) {
          try {
            const name = String(row.name || "").trim();
            const type = String(row.type || "").trim() as "zombie" | "survivant";
            
            if (!name || !type) continue;
            
            const timeSlot = await storage.createTimeSlot({
              name,
              type,
              mealTime: String(row.mealTime || "À définir").trim(),
              briefingTime: String(row.briefingTime || "À définir").trim(),
              gameTime: String(row.gameTime || "À définir").trim(),
              exitTime: String(row.exitTime || "À définir").trim(),
            });
            timeSlotMap.set(`${name}-${type}`, timeSlot.id);
            stats.imported++;
          } catch (error) {
            console.error("Error importing time slot:", error);
            stats.errors++;
          }
        }
      }

      // Map to track squads by number and type for reference
      const squadMap = new Map<string, number>();

      // Import squads (needed for participants)
      if (workbook.SheetNames.includes("Squads")) {
        const sheet = workbook.Sheets["Squads"];
        const data = xlsx.utils.sheet_to_json<any>(sheet);
        
        for (const row of data) {
          try {
            const type = String(row.type || "").trim() as "zombie" | "survivant";
            
            if (row.number === undefined || row.number === null || row.number === "" || !type) continue;
            
            const squad = await storage.createSquad({
              number: Number(row.number),
              type,
              maxMembers: row.maxMembers ? Number(row.maxMembers) : 10,
            });
            squadMap.set(`${row.number}-${type}`, squad.id);
            stats.imported++;
          } catch (error) {
            console.error("Error importing squad:", error);
            stats.errors++;
          }
        }
      }

      // Import participants
      if (workbook.SheetNames.includes("Participants")) {
        const sheet = workbook.Sheets["Participants"];
        const data = xlsx.utils.sheet_to_json<any>(sheet);
        
        for (const row of data) {
          try {
            // Convert to string and check if valid
            const firstName = String(row.firstName || "").trim();
            const lastName = String(row.lastName || "").trim();
            const type = String(row.type || "").trim() as "zombie" | "survivant";
            
            if (!firstName || !lastName || !type) continue;
            
            // Find time slot ID if time slot name provided
            let timeSlotId: number | null = null;
            if (row.timeSlotName) {
              const timeSlotName = String(row.timeSlotName).trim();
              timeSlotId = timeSlotMap.get(`${timeSlotName}-${type}`) || null;
            }

            // Find squad ID if squad number provided
            let squadId: number | null = null;
            if (row.squadNumber !== undefined && row.squadNumber !== null && row.squadNumber !== "") {
              squadId = squadMap.get(`${row.squadNumber}-${type}`) || null;
            }

            // Generate secret code
            const secretCode = await storage.generateSecretCode();

            await storage.createParticipant({
              firstName,
              lastName,
              type,
              timeSlotId,
              squadId,
              hasFreemeal: row.hasFreemeal === true || row.hasFreemeal === "true" || type === "zombie",
              hasMerch: row.hasMerch === true || row.hasMerch === "true",
              hasArrived: row.hasArrived === true || row.hasArrived === "true",
              secretCode,
            });
            stats.imported++;
          } catch (error) {
            console.error("Error importing participant:", error);
            stats.errors++;
          }
        }
      }

      res.json({ message: "Import completed", stats });
    } catch (error) {
      console.error("Import all error:", error);
      res.status(500).json({ message: "Error importing data" });
    }
  });

  // Generate QR code for data sharing
  app.post("/api/data/qr-share", async (req, res) => {
    try {
      const { module, type } = req.body;

      let data: any = {};

      switch (module) {
        case "participants":
          data.participants = await storage.getParticipants(type);
          break;
        case "timeslots":
          data.timeSlots = await storage.getTimeSlots(type);
          break;
        case "squads":
          data.squads = await storage.getSquads(type);
          break;
        case "all":
          data.participants = await storage.getParticipants(type);
          data.timeSlots = await storage.getTimeSlots(type);
          data.squads = await storage.getSquads(type);
          data.shopItems = await storage.getShopItems();
          data.mealItems = await storage.getMealItems();
          break;
      }

      // Compress and encode data for QR using pako
      const jsonData = JSON.stringify(data);
      const compressed = pako.gzip(jsonData);
      const encoded = Buffer.from(compressed).toString('base64');

      res.json({ qrData: encoded, size: encoded.length, originalSize: jsonData.length });
    } catch (error) {
      console.error("QR share error:", error);
      res.status(500).json({ message: "Error generating QR share data" });
    }
  });

  // Import data from QR code
  app.post("/api/data/qr-import", async (req, res) => {
    try {
      const { qrData } = req.body;

      if (!qrData) {
        return res.status(400).json({ message: "QR data is required" });
      }

      console.log("QR Import - Data length:", qrData.length);

      let data: any;

      // Try to detect format: new minimal format (JSON with "t" field) or old compressed format
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.t) {
          // New minimal format detected
          console.log("QR Import - Minimal format detected, type:", parsed.t);
          
          // Convert minimal format to standard format
          if (parsed.t === "T") {
            // TimeSlots
            data = {
              timeSlots: parsed.d.map((ts: any) => ({
                name: ts.n,
                type: ts.ty,
                briefingTime: ts.b,
                gameTime: ts.g
              }))
            };
          } else if (parsed.t === "S") {
            // Squads
            data = {
              squads: parsed.d.map((sq: any) => ({
                number: sq.n,
                type: sq.ty,
                timeSlotId: sq.ts
              }))
            };
          } else if (parsed.t === "P") {
            // Participants
            data = {
              participants: parsed.d.map((p: any) => ({
                firstName: p.fn,
                lastName: p.ln,
                email: p.e || undefined,
                phone: p.ph || undefined,
                type: parsed.ty,
                squadId: p.sq || undefined,
                checkedIn: false
              }))
            };
          } else {
            throw new Error("Unknown minimal format type: " + parsed.t);
          }
          console.log("QR Import - Converted data structure:", Object.keys(data));
        } else {
          throw new Error("Not minimal format");
        }
      } catch (parseError) {
        // Old compressed format
        console.log("QR Import - Compressed format detected");
        const decoded = Buffer.from(qrData, 'base64');
        console.log("QR Import - Decoded size:", decoded.length);
        
        const decompressed = pako.ungzip(decoded, { to: 'string' });
        console.log("QR Import - Decompressed size:", decompressed.length);
        
        data = JSON.parse(decompressed);
        console.log("QR Import - Data structure:", Object.keys(data));
      }

      const stats = { imported: 0, errors: 0 };

      // Map old IDs to new IDs
      const timeSlotIdMap = new Map<number, number>();
      const squadIdMap = new Map<number, number>();

      // Step 1: Import time slots first and create ID mapping
      if (data.timeSlots && Array.isArray(data.timeSlots)) {
        console.log(`QR Import - Processing ${data.timeSlots.length} time slots`);
        
        // Get existing time slots to check for duplicates
        const existingTimeSlots = await storage.getTimeSlots();
        
        for (const timeSlot of data.timeSlots) {
          try {
            const oldId = timeSlot.id;
            const { id, ...timeSlotData } = timeSlot;
            
            // Check if time slot already exists (by name and type)
            const duplicate = existingTimeSlots.find(
              existing => existing.name === timeSlotData.name && 
                         existing.type === timeSlotData.type &&
                         existing.briefingTime === timeSlotData.briefingTime &&
                         existing.gameTime === timeSlotData.gameTime
            );
            
            if (duplicate) {
              console.log(`Time slot "${timeSlotData.name}" already exists, using existing ID ${duplicate.id}`);
              timeSlotIdMap.set(oldId, duplicate.id);
              stats.imported++;
            } else {
              const newTimeSlot = await storage.createTimeSlot(timeSlotData);
              timeSlotIdMap.set(oldId, newTimeSlot.id);
              stats.imported++;
              console.log(`Created time slot ${oldId} -> ${newTimeSlot.id}`);
            }
          } catch (error) {
            stats.errors++;
            console.error("Error importing time slot:", error);
          }
        }
      }

      // Step 2: Import squads with updated timeSlotId references
      if (data.squads && Array.isArray(data.squads)) {
        console.log(`QR Import - Processing ${data.squads.length} squads`);
        
        // Get existing squads to check for duplicates
        const existingSquads = await storage.getSquads();
        
        for (const squad of data.squads) {
          try {
            const oldId = squad.id;
            const oldTimeSlotId = squad.timeSlotId;
            const { id, timeSlotId, ...squadData } = squad;
            
            // Map old timeSlotId to new one
            const newTimeSlotId = timeSlotIdMap.get(oldTimeSlotId);
            if (!newTimeSlotId && oldTimeSlotId) {
              console.warn(`Warning: Squad ${oldId} references non-existent timeSlot ${oldTimeSlotId}, skipping timeSlotId`);
            }
            
            // Check if squad already exists (by number, type, and timeSlotId)
            const duplicate = existingSquads.find(
              existing => existing.number === squadData.number && 
                         existing.type === squadData.type &&
                         existing.timeSlotId === newTimeSlotId
            );
            
            if (duplicate) {
              console.log(`Squad ${squadData.number} (${squadData.type}) already exists, using existing ID ${duplicate.id}`);
              squadIdMap.set(oldId, duplicate.id);
              stats.imported++;
            } else {
              const newSquad = await storage.createSquad({
                ...squadData,
                timeSlotId: newTimeSlotId || null
              });
              squadIdMap.set(oldId, newSquad.id);
              stats.imported++;
              console.log(`Created squad ${oldId} -> ${newSquad.id} (timeSlot: ${oldTimeSlotId} -> ${newTimeSlotId})`);
            }
          } catch (error) {
            stats.errors++;
            console.error("Error importing squad:", error);
          }
        }
      }

      // Step 3: Import participants with updated timeSlotId and squadId references
      if (data.participants && Array.isArray(data.participants)) {
        console.log(`QR Import - Processing ${data.participants.length} participants`);
        for (const participant of data.participants) {
          try {
            const oldTimeSlotId = participant.timeSlotId;
            const oldSquadId = participant.squadId;
            const { id, timeSlotId, squadId, ...participantData } = participant;
            
            // Map old IDs to new ones
            const newTimeSlotId = oldTimeSlotId ? timeSlotIdMap.get(oldTimeSlotId) : null;
            const newSquadId = oldSquadId ? squadIdMap.get(oldSquadId) : null;
            
            if (oldTimeSlotId && !newTimeSlotId) {
              console.warn(`Warning: Participant ${participant.firstName} references non-existent timeSlot ${oldTimeSlotId}`);
            }
            if (oldSquadId && !newSquadId) {
              console.warn(`Warning: Participant ${participant.firstName} references non-existent squad ${oldSquadId}`);
            }
            
            await storage.createParticipant({
              ...participantData,
              timeSlotId: newTimeSlotId || null,
              squadId: newSquadId || null
            });
            stats.imported++;
          } catch (error) {
            stats.errors++;
            console.error("Error importing participant:", error);
          }
        }
      }

      // Import shop items if present
      if (data.shopItems && Array.isArray(data.shopItems)) {
        console.log(`QR Import - Processing ${data.shopItems.length} shop items`);
        for (const item of data.shopItems) {
          try {
            // Remove id to let the database generate a new one
            const { id, ...itemData } = item;
            await storage.createShopItem(itemData);
            stats.imported++;
          } catch (error) {
            stats.errors++;
            console.error("Error importing shop item:", error);
          }
        }
      }

      // Import meal items if present
      if (data.mealItems && Array.isArray(data.mealItems)) {
        console.log(`QR Import - Processing ${data.mealItems.length} meal items`);
        for (const item of data.mealItems) {
          try {
            // Remove id to let the database generate a new one
            const { id, ...itemData } = item;
            await storage.createMealItem(itemData);
            stats.imported++;
          } catch (error) {
            stats.errors++;
            console.error("Error importing meal item:", error);
          }
        }
      }

      console.log("QR Import - Stats:", stats);
      res.json({ message: "QR import completed", stats });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("QR import error:", error);
      res.status(500).json({ message: "Error importing QR data", error: errorMessage });
    }
  });

  // Endpoint pour générer le PDF d'un participant (accessible par le visiteur)
  app.get("/api/participants/:id/pdf", async (req, res) => {
    try {
      const participantId = parseInt(req.params.id);
      
      if (isNaN(participantId)) {
        return res.status(400).json({ message: "ID participant invalide" });
      }

      // Récupérer le participant avec toutes les relations
      const participant = await storage.getParticipant(participantId);
      if (!participant) {
        return res.status(404).json({ message: "Participant non trouvé" });
      }

      // Récupérer les achats boutique
      const purchases = await storage.getPurchases(participantId);
      
      // Récupérer les achats repas
      const mealPurchases = await storage.getMealPurchases(participantId);

      // Générer le PDF
      const pdfBuffer = await generateParticipantPDF({
        participant,
        purchases,
        mealPurchases,
      });

      // Envoyer le PDF en tant que téléchargement
      const filename = `Recap_${participant.firstName}_${participant.lastName}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating participant PDF:", error);
      res.status(500).json({ message: "Erreur lors de la génération du PDF" });
    }
  });

  // ===== AUDIT LOGS =====

  // Get audit logs with optional filters
  app.get("/api/audit-logs", async (req, res) => {
    try {
      const filters = {
        tableName: req.query.tableName as string | undefined,
        action: req.query.action as string | undefined,
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      };

      const logs = await storage.getAuditLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
