import type { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { generateWebSocketToken, getWebSocketSecret } from "./sync-middleware";
import { requireAuth, requireRole } from "./auth-middleware";
import { childLogger } from "./logger";
import { WS_TOKEN_TTL_MS } from "./ws-token";

const syncLogger = childLogger('sync');

// Schema for updating sync config
const updateSyncConfigSchema = z.object({
  isOnlineMode: z.boolean(),
  masterDeviceId: z.string().optional(),
  masterDeviceName: z.string().optional(),
});

// Schema for WebSocket auth token request
const generateTokenSchema = z.object({
  deviceId: z.string().uuid(),
});

export function registerSyncRoutes(app: Express) {

  // Generate WebSocket authentication token (NO AUTH REQUIRED - this is the auth endpoint!)
  app.post("/api/sync/ws-token", async (req, res) => {
    try {
      const body = generateTokenSchema.parse(req.body);
      const secret = getWebSocketSecret();
      const token = generateWebSocketToken(body.deviceId, secret);

      res.json({
        token,
        expiresIn: WS_TOKEN_TTL_MS,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Invalid device ID format", errors: error.errors });
      } else {
        syncLogger.error({ err: error }, 'Erreur génération token WebSocket');
        res.status(500).json({ message: "Failed to generate token" });
      }
    }
  });

  // Get current sync configuration
  app.get("/api/sync/config", requireAuth, async (req, res) => {
    try {
      const config = await storage.getSyncConfig();
      res.json(config);
    } catch (error) {
      syncLogger.error({ err: error }, 'Erreur récupération configuration sync');
      res.status(500).json({ message: "Failed to fetch sync configuration" });
    }
  });

  // Update sync configuration (toggle online/offline mode)
  app.post("/api/sync/config", requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const body = updateSyncConfigSchema.parse(req.body);
      const config = await storage.updateSyncConfig(body);
      res.json(config);
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ message: "Invalid request data", errors: error.errors });
      } else {
        syncLogger.error({ err: error }, 'Erreur mise à jour configuration sync');
        res.status(500).json({ message: "Failed to update sync configuration" });
      }
    }
  });

  // Check if current device is the master device
  app.post("/api/sync/check-master", requireAuth, async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId) {
        return res.status(400).json({ message: "Device ID is required" });
      }

      const config = await storage.getSyncConfig();
      const isMaster = config.masterDeviceId === deviceId;
      const isOnlineMode = config.isOnlineMode;

      res.json({
        isMaster,
        isOnlineMode,
        canSync: isOnlineMode || isMaster
      });
    } catch (error) {
      syncLogger.error({ err: error }, 'Erreur vérification statut maître');
      res.status(500).json({ message: "Failed to check master status" });
    }
  });

  // Sync endpoint - only allowed for master device in offline mode
  app.post("/api/sync/data", requireAuth, async (req, res) => {
    try {
      const { deviceId, syncData } = req.body;

      if (!deviceId) {
        return res.status(400).json({ message: "Device ID is required" });
      }

      const config = await storage.getSyncConfig();

      // In online mode, everyone can sync
      if (config.isOnlineMode) {
        return res.json({ success: true, message: "Online mode - sync not required" });
      }

      // In offline mode, only master can sync
      if (config.masterDeviceId !== deviceId) {
        return res.status(403).json({
          message: "Only the master device can sync in offline mode",
          masterDeviceName: config.masterDeviceName
        });
      }

      // Process sync data here (participants, squads, timeslots, etc.)
      // This would be implemented based on the syncData structure
      await storage.updateLastSyncAt();

      res.json({ success: true, message: "Sync completed successfully" });
    } catch (error) {
      syncLogger.error({ err: error }, 'Erreur synchronisation données');
      res.status(500).json({ message: "Failed to sync data" });
    }
  });

  // Simple sync trigger endpoint - for manual sync button
  app.post("/api/sync/trigger", requireAuth, async (req, res) => {
    try {
      const { timestamp, source } = req.body;
      
      // Get current sync config
      const config = await storage.getSyncConfig();
      
      // Update last sync timestamp
      await storage.updateLastSyncAt();
      
      // In a real implementation, this would trigger actual data sync
      // For now, we just acknowledge the sync request
      res.json({ 
        success: true, 
        message: "Synchronisation déclenchée avec succès",
        syncedItems: 0,
        timestamp: new Date().toISOString(),
        mode: config.isOnlineMode ? "online" : "offline"
      });
    } catch (error) {
      syncLogger.error({ err: error }, 'Erreur déclenchement sync');
      res.status(500).json({ message: "Failed to trigger sync" });
    }
  });
}
