/**
 * BLE (Bluetooth Low Energy) Routes Module
 *
 * Handles all BLE-related API endpoints including:
 * - Beacon management (CRUD)
 * - Scanner management (CRUD)
 * - Beacon/Scanner assignments
 * - Hit synchronization and validation
 * - Game session management
 * - Sync session tracking
 * - Zone management
 */

import type { Express } from 'express';
import { storage } from '../storage';
import { logger } from '../utils/logger';
import { createAuditLog } from '../utils/audit';

export function registerBleRoutes(app: Express) {
  // ===== BEACONS =====

  // Get all beacons (with optional status filter)
  app.get('/api/ble/beacons', async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const beacons = await storage.getBeacons(status);

      logger.info('Beacons retrieved', {
        count: beacons.length,
        status,
        userId: (req as any).session?.user?.id,
      });

      res.json(beacons);
    } catch (error: any) {
      logger.error('Error fetching beacons', { error: error.message });
      res.status(500).json({ message: 'Error fetching beacons' });
    }
  });

  // Get single beacon by ID
  app.get('/api/ble/beacons/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid beacon ID' });
      }

      const beacon = await storage.getBeacon(id);
      if (!beacon) {
        return res.status(404).json({ message: 'Beacon not found' });
      }

      res.json(beacon);
    } catch (error: any) {
      logger.error('Error fetching beacon', { error: error.message, beaconId: req.params.id });
      res.status(500).json({ message: 'Error fetching beacon' });
    }
  });

  // Create new beacon
  app.post('/api/ble/beacons', async (req, res) => {
    try {
      const beacon = await storage.createBeacon(req.body);

      await createAuditLog('CREATE', 'beacons', beacon.id, req, beacon);

      logger.info('Beacon created', {
        beaconId: beacon.id,
        hardwareId: beacon.hardwareId,
        userId: (req as any).session?.user?.id,
      });

      res.status(201).json(beacon);
    } catch (error: any) {
      logger.error('Error creating beacon', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error creating beacon' });
    }
  });

  // Update beacon
  app.patch('/api/ble/beacons/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentBeacon = await storage.getBeacon(id);

      if (!currentBeacon) {
        return res.status(404).json({ message: 'Beacon not found' });
      }

      const beacon = await storage.updateBeacon(id, req.body);

      await createAuditLog('UPDATE', 'beacons', id, req, beacon, {
        before: currentBeacon,
        after: beacon,
      });

      logger.info('Beacon updated', { beaconId: id, userId: (req as any).session?.user?.id });

      res.json(beacon);
    } catch (error: any) {
      logger.error('Error updating beacon', { error: error.message, beaconId: req.params.id });
      res.status(500).json({ message: 'Error updating beacon' });
    }
  });

  // Delete beacon
  app.delete('/api/ble/beacons/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const beacon = await storage.getBeacon(id);

      if (!beacon) {
        return res.status(404).json({ message: 'Beacon not found' });
      }

      await storage.deleteBeacon(id);

      await createAuditLog('DELETE', 'beacons', id, req, beacon);

      logger.info('Beacon deleted', { beaconId: id, userId: (req as any).session?.user?.id });

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error deleting beacon', { error: error.message, beaconId: req.params.id });
      res.status(500).json({ message: 'Error deleting beacon' });
    }
  });

  // ===== SCANNERS =====

  // Get all scanners (with optional status filter)
  app.get('/api/ble/scanners', async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const scanners = await storage.getScanners(status);

      logger.info('Scanners retrieved', {
        count: scanners.length,
        status,
        userId: (req as any).session?.user?.id,
      });

      res.json(scanners);
    } catch (error: any) {
      logger.error('Error fetching scanners', { error: error.message });
      res.status(500).json({ message: 'Error fetching scanners' });
    }
  });

  // Get single scanner by ID
  app.get('/api/ble/scanners/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid scanner ID' });
      }

      const scanner = await storage.getScanner(id);
      if (!scanner) {
        return res.status(404).json({ message: 'Scanner not found' });
      }

      res.json(scanner);
    } catch (error: any) {
      logger.error('Error fetching scanner', { error: error.message, scannerId: req.params.id });
      res.status(500).json({ message: 'Error fetching scanner' });
    }
  });

  // Create new scanner
  app.post('/api/ble/scanners', async (req, res) => {
    try {
      const scanner = await storage.createScanner(req.body);

      await createAuditLog('CREATE', 'scanners', scanner.id, req, scanner);

      logger.info('Scanner created', {
        scannerId: scanner.id,
        hardwareId: scanner.hardwareId,
        userId: (req as any).session?.user?.id,
      });

      res.status(201).json(scanner);
    } catch (error: any) {
      logger.error('Error creating scanner', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error creating scanner' });
    }
  });

  // Update scanner
  app.patch('/api/ble/scanners/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentScanner = await storage.getScanner(id);

      if (!currentScanner) {
        return res.status(404).json({ message: 'Scanner not found' });
      }

      const scanner = await storage.updateScanner(id, req.body);

      await createAuditLog('UPDATE', 'scanners', id, req, scanner, {
        before: currentScanner,
        after: scanner,
      });

      logger.info('Scanner updated', { scannerId: id, userId: (req as any).session?.user?.id });

      res.json(scanner);
    } catch (error: any) {
      logger.error('Error updating scanner', { error: error.message, scannerId: req.params.id });
      res.status(500).json({ message: 'Error updating scanner' });
    }
  });

  // Delete scanner
  app.delete('/api/ble/scanners/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const scanner = await storage.getScanner(id);

      if (!scanner) {
        return res.status(404).json({ message: 'Scanner not found' });
      }

      await storage.deleteScanner(id);

      await createAuditLog('DELETE', 'scanners', id, req, scanner);

      logger.info('Scanner deleted', { scannerId: id, userId: (req as any).session?.user?.id });

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error deleting scanner', { error: error.message, scannerId: req.params.id });
      res.status(500).json({ message: 'Error deleting scanner' });
    }
  });

  // ===== BEACON ASSIGNMENTS =====

  // Get beacon assignments (with filters)
  app.get('/api/ble/beacon-assignments', async (req, res) => {
    try {
      const filters = {
        participantId: req.query.participantId ? parseInt(req.query.participantId as string) : undefined,
        beaconId: req.query.beaconId ? parseInt(req.query.beaconId as string) : undefined,
        status: req.query.status as string | undefined,
      };

      const assignments = await storage.getBeaconAssignments(filters);

      logger.info('Beacon assignments retrieved', {
        count: assignments.length,
        filters,
        userId: (req as any).session?.user?.id,
      });

      res.json(assignments);
    } catch (error: any) {
      logger.error('Error fetching beacon assignments', { error: error.message });
      res.status(500).json({ message: 'Error fetching beacon assignments' });
    }
  });

  // Assign beacon to participant
  app.post('/api/ble/beacon-assignments', async (req, res) => {
    try {
      const { participantId, beaconId, sessionId } = req.body;

      if (!participantId || !beaconId) {
        return res.status(400).json({ message: 'participantId and beaconId are required' });
      }

      const assignedBy = (req as any).session?.user?.id;

      const assignment = await storage.assignBeaconToParticipant(
        participantId,
        beaconId,
        sessionId,
        assignedBy
      );

      await createAuditLog('CREATE', 'beacon_assignments', assignment.id, req, assignment);

      logger.info('Beacon assigned to participant', {
        assignmentId: assignment.id,
        participantId,
        beaconId,
        userId: assignedBy,
      });

      res.status(201).json(assignment);
    } catch (error: any) {
      logger.error('Error assigning beacon', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error assigning beacon' });
    }
  });

  // Return beacon (mark assignment as returned)
  app.post('/api/ble/beacon-assignments/:id/return', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const returnedBy = (req as any).session?.user?.id;

      const assignment = await storage.returnBeacon(id, returnedBy);

      await createAuditLog('UPDATE', 'beacon_assignments', id, req, assignment);

      logger.info('Beacon returned', {
        assignmentId: id,
        beaconId: assignment.beaconId,
        userId: returnedBy,
      });

      res.json(assignment);
    } catch (error: any) {
      logger.error('Error returning beacon', {
        error: error.message,
        assignmentId: req.params.id,
      });
      res.status(500).json({ message: 'Error returning beacon' });
    }
  });

  // ===== SCANNER ASSIGNMENTS =====

  // Get scanner assignments (with filters)
  app.get('/api/ble/scanner-assignments', async (req, res) => {
    try {
      const filters = {
        participantId: req.query.participantId ? parseInt(req.query.participantId as string) : undefined,
        scannerId: req.query.scannerId ? parseInt(req.query.scannerId as string) : undefined,
        status: req.query.status as string | undefined,
      };

      const assignments = await storage.getScannerAssignments(filters);

      logger.info('Scanner assignments retrieved', {
        count: assignments.length,
        filters,
        userId: (req as any).session?.user?.id,
      });

      res.json(assignments);
    } catch (error: any) {
      logger.error('Error fetching scanner assignments', { error: error.message });
      res.status(500).json({ message: 'Error fetching scanner assignments' });
    }
  });

  // Assign scanner to participant
  app.post('/api/ble/scanner-assignments', async (req, res) => {
    try {
      const { participantId, scannerId, sessionId } = req.body;

      if (!participantId || !scannerId) {
        return res.status(400).json({ message: 'participantId and scannerId are required' });
      }

      const assignedBy = (req as any).session?.user?.id;

      const assignment = await storage.assignScannerToParticipant(
        participantId,
        scannerId,
        sessionId,
        assignedBy
      );

      await createAuditLog('CREATE', 'scanner_assignments', assignment.id, req, assignment);

      logger.info('Scanner assigned to participant', {
        assignmentId: assignment.id,
        participantId,
        scannerId,
        userId: assignedBy,
      });

      res.status(201).json(assignment);
    } catch (error: any) {
      logger.error('Error assigning scanner', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error assigning scanner' });
    }
  });

  // Return scanner (mark assignment as returned)
  app.post('/api/ble/scanner-assignments/:id/return', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const returnedBy = (req as any).session?.user?.id;

      const assignment = await storage.returnScanner(id, returnedBy);

      await createAuditLog('UPDATE', 'scanner_assignments', id, req, assignment);

      logger.info('Scanner returned', {
        assignmentId: id,
        scannerId: assignment.scannerId,
        userId: returnedBy,
      });

      res.json(assignment);
    } catch (error: any) {
      logger.error('Error returning scanner', {
        error: error.message,
        assignmentId: req.params.id,
      });
      res.status(500).json({ message: 'Error returning scanner' });
    }
  });

  // ===== HITS =====

  // Get hits (with filters)
  app.get('/api/ble/hits', async (req, res) => {
    try {
      const filters = {
        beaconId: req.query.beaconId ? parseInt(req.query.beaconId as string) : undefined,
        scannerId: req.query.scannerId ? parseInt(req.query.scannerId as string) : undefined,
        sessionId: req.query.sessionId as string | undefined,
        validated: req.query.validated === 'true' ? true : req.query.validated === 'false' ? false : undefined,
      };

      const hits = await storage.getHits(filters);

      logger.info('Hits retrieved', {
        count: hits.length,
        filters,
        userId: (req as any).session?.user?.id,
      });

      res.json(hits);
    } catch (error: any) {
      logger.error('Error fetching hits', { error: error.message });
      res.status(500).json({ message: 'Error fetching hits' });
    }
  });

  // Sync hits from ESP32 scanner
  app.post('/api/ble/hits/sync', async (req, res) => {
    try {
      const { scannerId, hits } = req.body;

      if (!scannerId || !Array.isArray(hits)) {
        return res.status(400).json({ message: 'scannerId and hits array are required' });
      }

      const result = await storage.syncHits(hits, scannerId);

      logger.info('Hits synced from scanner', {
        scannerId,
        hitsReceived: hits.length,
        synced: result.synced,
        rejected: result.rejected,
        syncSessionId: result.syncSessionId,
        userId: (req as any).session?.user?.id,
      });

      res.json(result);
    } catch (error: any) {
      logger.error('Error syncing hits', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error syncing hits' });
    }
  });

  // ===== GAME SESSIONS =====

  // Get all game sessions
  app.get('/api/ble/game-sessions', async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const sessions = await storage.getGameSessions(status);

      logger.info('Game sessions retrieved', {
        count: sessions.length,
        status,
        userId: (req as any).session?.user?.id,
      });

      res.json(sessions);
    } catch (error: any) {
      logger.error('Error fetching game sessions', { error: error.message });
      res.status(500).json({ message: 'Error fetching game sessions' });
    }
  });

  // Get single game session
  app.get('/api/ble/game-sessions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid session ID' });
      }

      const session = await storage.getGameSession(id);
      if (!session) {
        return res.status(404).json({ message: 'Game session not found' });
      }

      res.json(session);
    } catch (error: any) {
      logger.error('Error fetching game session', { error: error.message, sessionId: req.params.id });
      res.status(500).json({ message: 'Error fetching game session' });
    }
  });

  // Create new game session
  app.post('/api/ble/game-sessions', async (req, res) => {
    try {
      const session = await storage.createGameSession(req.body);

      await createAuditLog('CREATE', 'game_sessions', session.id, req, session);

      logger.info('Game session created', {
        sessionId: session.id,
        gameSessionId: session.sessionId,
        userId: (req as any).session?.user?.id,
      });

      res.status(201).json(session);
    } catch (error: any) {
      logger.error('Error creating game session', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error creating game session' });
    }
  });

  // Update game session
  app.patch('/api/ble/game-sessions/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentSession = await storage.getGameSession(id);

      if (!currentSession) {
        return res.status(404).json({ message: 'Game session not found' });
      }

      const session = await storage.updateGameSession(id, req.body);

      await createAuditLog('UPDATE', 'game_sessions', id, req, session, {
        before: currentSession,
        after: session,
      });

      logger.info('Game session updated', { sessionId: id, userId: (req as any).session?.user?.id });

      res.json(session);
    } catch (error: any) {
      logger.error('Error updating game session', { error: error.message, sessionId: req.params.id });
      res.status(500).json({ message: 'Error updating game session' });
    }
  });

  // Get game session statistics
  app.get('/api/ble/game-sessions/:sessionId/stats', async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const stats = await storage.calculateGameStats(sessionId);

      logger.info('Game session stats calculated', {
        sessionId,
        userId: (req as any).session?.user?.id,
      });

      res.json(stats);
    } catch (error: any) {
      logger.error('Error calculating game stats', {
        error: error.message,
        sessionId: req.params.sessionId,
      });
      res.status(500).json({ message: 'Error calculating game stats' });
    }
  });

  // ===== SYNC SESSIONS =====

  // Get BLE sync sessions
  app.get('/api/ble/sync-sessions', async (req, res) => {
    try {
      const scannerId = req.query.scannerId ? parseInt(req.query.scannerId as string) : undefined;
      const sessions = await storage.getBleSyncSessions(scannerId);

      logger.info('BLE sync sessions retrieved', {
        count: sessions.length,
        scannerId,
        userId: (req as any).session?.user?.id,
      });

      res.json(sessions);
    } catch (error: any) {
      logger.error('Error fetching sync sessions', { error: error.message });
      res.status(500).json({ message: 'Error fetching sync sessions' });
    }
  });

  // ===== ZONES =====

  // Get all zones
  app.get('/api/ble/zones', async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const zones = await storage.getZones(status);

      logger.info('Zones retrieved', {
        count: zones.length,
        status,
        userId: (req as any).session?.user?.id,
      });

      res.json(zones);
    } catch (error: any) {
      logger.error('Error fetching zones', { error: error.message });
      res.status(500).json({ message: 'Error fetching zones' });
    }
  });

  // Create new zone
  app.post('/api/ble/zones', async (req, res) => {
    try {
      const zone = await storage.createZone(req.body);

      await createAuditLog('CREATE', 'zones', zone.id, req, zone);

      logger.info('Zone created', {
        zoneId: zone.id,
        name: zone.name,
        userId: (req as any).session?.user?.id,
      });

      res.status(201).json(zone);
    } catch (error: any) {
      logger.error('Error creating zone', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error creating zone' });
    }
  });

  // Update zone
  app.patch('/api/ble/zones/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentZone = await storage.getZone(id);

      if (!currentZone) {
        return res.status(404).json({ message: 'Zone not found' });
      }

      const zone = await storage.updateZone(id, req.body);

      await createAuditLog('UPDATE', 'zones', id, req, zone, {
        before: currentZone,
        after: zone,
      });

      logger.info('Zone updated', { zoneId: id, userId: (req as any).session?.user?.id });

      res.json(zone);
    } catch (error: any) {
      logger.error('Error updating zone', { error: error.message, zoneId: req.params.id });
      res.status(500).json({ message: 'Error updating zone' });
    }
  });

  // Delete zone
  app.delete('/api/ble/zones/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const zone = await storage.getZone(id);

      if (!zone) {
        return res.status(404).json({ message: 'Zone not found' });
      }

      await storage.deleteZone(id);

      await createAuditLog('DELETE', 'zones', id, req, zone);

      logger.info('Zone deleted', { zoneId: id, userId: (req as any).session?.user?.id });

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Error deleting zone', { error: error.message, zoneId: req.params.id });
      res.status(500).json({ message: 'Error deleting zone' });
    }
  });
}
