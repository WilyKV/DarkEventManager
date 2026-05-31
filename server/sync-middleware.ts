import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { signDeviceToken, verifyDeviceToken } from "./ws-token";

/**
 * Middleware to check if the current device can perform write operations
 * In offline mode, only the master device can write to the database
 */
export async function checkSyncPermissions(req: Request, res: Response, next: NextFunction) {
  // Only check for mutations (POST, PUT, PATCH, DELETE)
  const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (!mutationMethods.includes(req.method)) {
    // Allow all GET requests
    return next();
  }

  // Exclude sync configuration and WebSocket token endpoints from this check
  const excludedPaths = ['/api/sync/config', '/api/sync/ws-token', '/api/sync/check-master'];
  if (excludedPaths.some(path => req.path === path)) {
    return next();
  }

  try {
    const { storage } = await import("./storage");
    const config = await storage.getSyncConfig();

    // In online mode, everyone can sync
    if (config.isOnlineMode) {
      return next();
    }

    // In offline mode, check if this is the master device
    const deviceId = req.headers['x-device-id'] as string;

    if (!deviceId) {
      return res.status(403).json({
        message: "Mode hors ligne : ID d'appareil requis",
        isOnlineMode: false,
        requiresMaster: true,
      });
    }

    if (config.masterDeviceId !== deviceId) {
      return res.status(403).json({
        message: "Mode hors ligne : Seul l'appareil maître peut effectuer des modifications",
        isOnlineMode: false,
        masterDeviceName: config.masterDeviceName,
        isMaster: false,
      });
    }

    // This is the master device, allow the operation
    next();
  } catch (error) {
    console.error('Error checking sync permissions:', error);
    // In case of error, DENY the operation in offline mode (fail-secure)
    return res.status(500).json({
      message: "Erreur lors de la vérification des permissions",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * Helper middleware to add device ID from localStorage to request headers
 * This should be used on the client side via an interceptor
 */
export function addDeviceIdHeader(deviceId: string) {
  return {
    'X-Device-ID': deviceId,
  };
}

/**
 * Generate a secure WebSocket authentication token.
 * Délègue à signDeviceToken (server/ws-token.ts).
 */
export function generateWebSocketToken(deviceId: string, secret: string): string {
  return signDeviceToken(deviceId, secret);
}

/**
 * Verify WebSocket authentication token.
 * Délègue à verifyDeviceToken (server/ws-token.ts).
 * Returns deviceId if valid, null otherwise.
 */
export function verifyWebSocketToken(token: string, secret: string): string | null {
  const result = verifyDeviceToken(token, secret);
  return result.valid && result.deviceId ? result.deviceId : null;
}

/**
 * Module-scope cache for the WebSocket secret.
 * Initialized on first call to getWebSocketSecret() and reused for the lifetime of the process.
 */
let _cachedSecret: string | null = null;

/**
 * Get or create WebSocket secret key.
 * Memoized: the value is computed once and reused on subsequent calls.
 */
export function getWebSocketSecret(): string {
  if (!_cachedSecret) {
    _cachedSecret = process.env.WEBSOCKET_SECRET || crypto.randomBytes(32).toString('hex');
  }
  return _cachedSecret;
}
