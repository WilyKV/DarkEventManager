/**
 * Participants Routes Module
 *
 * Handles all participant-related API endpoints including:
 * - CRUD operations for participants
 * - Batch updates and imports
 * - Secret code regeneration
 * - Squad history tracking
 */

import type { Express } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { storage } from '../storage';
import { createParticipantSchema } from '@shared/schema';
import { createAuditLog } from '../utils/audit';
import { logger } from '../utils/logger';

const upload = multer({ storage: multer.memoryStorage() });

export function registerParticipantRoutes(app: Express) {
  // Get all participants (with optional type filter via query string)
  app.get('/api/participants', async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const participants = await storage.getParticipants(type);
      res.json(participants);
    } catch (error: any) {
      logger.error('Error fetching participants', { error: error.message });
      res.status(500).json({ message: 'Error fetching participants' });
    }
  });

  // Get participants count
  app.get('/api/participants/count', async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      res.json(participants.length);
    } catch (error: any) {
      logger.error('Error counting participants', { error: error.message });
      res.status(500).json({ message: 'Error counting participants' });
    }
  });

  // Get single participant by ID
  app.get('/api/participants/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid participant ID' });
      }
      const participant = await storage.getParticipant(id);
      if (!participant) {
        return res.status(404).json({ message: 'Participant not found' });
      }
      res.json(participant);
    } catch (error: any) {
      logger.error('Error fetching participant', { error: error.message, participantId: req.params.id });
      res.status(500).json({ message: 'Error fetching participant' });
    }
  });

  // Create new participant
  app.post('/api/participants', async (req, res) => {
    try {
      const validationResult = createParticipantSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: 'Invalid participant data',
          errors: validationResult.error.errors,
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
        hasFreemeal: type === 'zombie',
        secretCode,
      };

      const participant = await storage.createParticipant(participantData);

      // Log audit trail
      await createAuditLog('CREATE', 'participants', participant.id, req, participant);

      logger.info('Participant created', {
        participantId: participant.id,
        type: participant.type,
        userId: (req as any).session?.user?.id,
      });

      res.status(201).json(participant);
    } catch (error: any) {
      logger.error('Create participant error', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error creating participant' });
    }
  });

  // Update participant
  app.patch('/api/participants/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentParticipant = await storage.getParticipant(id);

      if (!currentParticipant) {
        return res.status(404).json({ message: 'Participant not found' });
      }

      // Convert timestamp strings to Date objects if present
      if (req.body.arrivedAt && typeof req.body.arrivedAt === 'string') {
        req.body.arrivedAt = new Date(req.body.arrivedAt);
      }
      if (req.body.returnedAt && typeof req.body.returnedAt === 'string') {
        req.body.returnedAt = new Date(req.body.returnedAt);
      }

      // Check if squad is changing (before update)
      const squadChanging =
        req.body.squadId !== undefined && req.body.squadId !== currentParticipant.squadId;
      const previousSquadId = currentParticipant.squadId;
      const newSquadId = req.body.squadId;

      // Update participant first
      const participant = await storage.updateParticipant(id, req.body);

      // Log audit trail with changes
      await createAuditLog('UPDATE', 'participants', id, req, participant, {
        before: currentParticipant,
        after: participant,
      });

      // Log squad changes only after successful update
      if (squadChanging) {
        await storage.createSquadAuditLog({
          participantId: id,
          previousSquadId: previousSquadId ?? null,
          newSquadId: newSquadId,
        });

        logger.info('Participant squad changed', {
          participantId: id,
          previousSquadId,
          newSquadId,
        });
      }

      res.json(participant);
    } catch (error: any) {
      logger.error('Update participant error', {
        error: error.message,
        stack: error.stack,
        participantId: req.params.id,
      });
      res.status(500).json({
        message: 'Error updating participant',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Regenerate secret code for a participant
  app.post('/api/participants/regenerate-code', async (req, res) => {
    try {
      const { participantId } = req.body;

      if (!participantId) {
        return res.status(400).json({ message: 'Participant ID is required' });
      }

      const participant = await storage.getParticipant(participantId);
      if (!participant) {
        return res.status(404).json({ message: 'Participant not found' });
      }

      // Generate new secret code
      const secretCode = await storage.generateSecretCode();

      // Update participant with new code
      const updated = await storage.updateParticipant(participantId, { secretCode });

      logger.info('Secret code regenerated', {
        participantId,
        userId: (req as any).session?.user?.id,
      });

      res.json({ success: true, secretCode: updated.secretCode });
    } catch (error: any) {
      logger.error('Regenerate code error', {
        error: error.message,
        participantId: req.body.participantId,
      });
      res.status(500).json({ message: 'Error regenerating code' });
    }
  });

  // Batch update participants
  app.post('/api/participants/batch-update', async (req, res) => {
    try {
      const updates = req.body.updates as Array<{ id: number; data: any }>;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: 'Updates array is required and must not be empty' });
      }

      // Process each update: validate and convert timestamps
      for (const update of updates) {
        const currentParticipant = await storage.getParticipant(update.id);
        if (!currentParticipant) {
          return res.status(404).json({ message: `Participant ${update.id} not found` });
        }

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

      logger.info('Batch update completed', {
        count: results.length,
        userId: (req as any).session?.user?.id,
      });

      res.json({ success: true, updated: results.length, participants: results });
    } catch (error: any) {
      logger.error('Batch update error', { error: error.message, stack: error.stack });
      res.status(500).json({
        message: 'Error updating participants',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Import participants from Excel
  app.post('/api/participants/import', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const type = req.body.type as 'zombie' | 'survivant';
      if (!type) {
        return res.status(400).json({ message: 'Type is required' });
      }

      // Parse Excel file
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json<any>(sheet, {
        header: ['firstName', 'lastName', 'timeSlotName'],
      });

      let count = 0;

      for (const row of data.slice(1)) {
        // Skip header row
        // Convert to string and check if valid
        const firstName = String(row.firstName || '').trim();
        const lastName = String(row.lastName || '').trim();

        if (!firstName || !lastName) continue;

        // Find or create time slot
        let timeSlotId: number | null = null;
        if (row.timeSlotName) {
          const timeSlotName = String(row.timeSlotName).trim();
          const existingSlots = await storage.getTimeSlots(type);
          let timeSlot = existingSlots.find((slot) => slot.name === timeSlotName);

          if (!timeSlot) {
            // Create default time slot with placeholder times
            timeSlot = await storage.createTimeSlot({
              name: timeSlotName,
              type,
              mealTime: 'À définir',
              briefingTime: 'À définir',
              gameTime: 'À définir',
              exitTime: 'À définir',
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
          hasFreemeal: type === 'zombie', // Zombies get free meal
          secretCode,
        });

        count++;
      }

      logger.info('Participants imported from Excel', {
        count,
        type,
        userId: (req as any).session?.user?.id,
      });

      res.json({ message: 'Import successful', count });
    } catch (error: any) {
      logger.error('Import error', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error importing participants' });
    }
  });

  // Get squad audit logs for a participant
  app.get('/api/participants/:id/squad-history', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const auditLogs = await storage.getSquadAuditLogs(id);
      res.json(auditLogs);
    } catch (error: any) {
      logger.error('Error fetching squad history', {
        error: error.message,
        participantId: req.params.id,
      });
      res.status(500).json({ message: 'Error fetching squad history' });
    }
  });
}
