import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import crypto from "crypto";

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
 * Generate a secure WebSocket authentication token
 * Token format: {deviceId}.{timestamp}.{signature}
 */
export function generateWebSocketToken(deviceId: string, secret: string): string {
  const timestamp = Date.now().toString();
  const data = `${deviceId}.${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');

  return `${data}.${signature}`;
}

/**
 * Verify WebSocket authentication token
 * Returns deviceId if valid, null otherwise
 */
export function verifyWebSocketToken(token: string, secret: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [deviceId, timestamp, signature] = parts;

    // Verify token is not too old (15 minutes)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 15 * 60 * 1000) {
      console.log('Token expired');
      return null;
    }

    // Verify signature
    const data = `${deviceId}.${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.log('Invalid signature');
      return null;
    }

    return deviceId;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Get or create WebSocket secret key
 * This should be stored securely, for now we use environment variable
 */
export function getWebSocketSecret(): string {
  // Use environment variable or generate a random secret
  return process.env.WEBSOCKET_SECRET || crypto.randomBytes(32).toString('hex');
}
