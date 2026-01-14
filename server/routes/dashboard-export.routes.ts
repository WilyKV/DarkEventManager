/**
 * Dashboard and Export Routes Module
 *
 * Handles:
 * - Dashboard statistics
 * - Excel export for participants, time slots, squads
 * - Complete data export
 */

import type { Express } from 'express';
import xlsx from 'xlsx';
import { storage } from '../storage';
import { logger } from '../utils/logger';

export function registerDashboardExportRoutes(app: Express) {
  // ===== DASHBOARD STATS =====

  // Get dashboard statistics
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();

      logger.info('Dashboard stats retrieved', {
        userId: (req as any).session?.user?.id,
      });

      res.json(stats);
    } catch (error: any) {
      logger.error('Error fetching dashboard stats', { error: error.message });
      res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
  });

  // ===== EXPORT REPORTS =====

  // Export participants to Excel
  app.get('/api/export/participants', async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const timeSlotId = req.query.timeSlotId ? parseInt(req.query.timeSlotId as string) : undefined;
      const squadId = req.query.squadId ? parseInt(req.query.squadId as string) : undefined;
      const filterLabel = req.query.filterLabel as string | undefined;

      let participants = await storage.getParticipants(type);

      if (timeSlotId) {
        participants = participants.filter((p) => p.timeSlotId === timeSlotId);
      }

      if (squadId) {
        participants = participants.filter((p) => p.squadId === squadId);
      }

      const exportData = participants.map((p) => ({
        Prénom: p.firstName,
        Nom: p.lastName,
        Type: p.type,
        Créneau: p.timeSlot?.name || 'Non assigné',
        Squad: p.squad ? `Squad ${p.squad.number}` : 'Non assigné',
        Arrivé: p.arrived ? 'Oui' : 'Non',
        'Code Secret': p.secretCode || 'Non assigné',
        Checklist: p.checklistCompleted ? 'Complète' : 'Incomplète',
        'Repas gratuit': p.hasFreemeal ? 'Oui' : 'Non',
        'Repas réclamé': p.freeMealClaimed ? 'Oui' : 'Non',
      }));

      const ws = xlsx.utils.json_to_sheet(exportData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Participants');

      const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const sanitizeFilename = (str: string): string => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);
      };

      const date = new Date().toISOString().split('T')[0];
      const baseFilename = type || 'participants';
      const filterPart = filterLabel ? `_${sanitizeFilename(filterLabel)}` : '_tous';
      const filename = `${baseFilename}${filterPart}_${date}.xlsx`;

      logger.info('Participants exported to Excel', {
        count: participants.length,
        type,
        filename,
        userId: (req as any).session?.user?.id,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error: any) {
      logger.error('Error exporting participants', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error exporting participants' });
    }
  });

  // Export time slots to Excel
  app.get('/api/export/time-slots', async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const timeSlots = await storage.getTimeSlots(type);

      const exportData = timeSlots.map((ts) => ({
        Nom: ts.name,
        Type: ts.type,
        'Heure Briefing': ts.briefingTime,
        'Heure Jeu': ts.gameTime,
      }));

      const ws = xlsx.utils.json_to_sheet(exportData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Creneaux');

      const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const date = new Date().toISOString().split('T')[0];
      const baseFilename = type || 'creneaux';
      const filename = `${baseFilename}_creneaux_${date}.xlsx`;

      logger.info('Time slots exported to Excel', {
        count: timeSlots.length,
        type,
        filename,
        userId: (req as any).session?.user?.id,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error: any) {
      logger.error('Error exporting time slots', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error exporting time slots' });
    }
  });

  // Export squads to Excel
  app.get('/api/export/squads', async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const squads = await storage.getSquadsWithParticipants(type);

      const exportData = squads.map((squad) => ({
        Numéro: squad.number,
        Type: squad.type,
        'Nombre de participants': squad.participants?.length || 0,
      }));

      const ws = xlsx.utils.json_to_sheet(exportData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Squads');

      const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const date = new Date().toISOString().split('T')[0];
      const baseFilename = type || 'squads';
      const filename = `${baseFilename}_squads_${date}.xlsx`;

      logger.info('Squads exported to Excel', {
        count: squads.length,
        type,
        filename,
        userId: (req as any).session?.user?.id,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error: any) {
      logger.error('Error exporting squads', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error exporting squads' });
    }
  });

  // Export ALL data (participants + time slots + squads) to Excel
  app.get('/api/export/all-data', async (req, res) => {
    try {
      const type = req.query.type as string | undefined;

      // Get all data
      const participants = await storage.getParticipants(type);
      const timeSlots = await storage.getTimeSlots(type);
      const squads = await storage.getSquadsWithParticipants(type);

      // Prepare participants data
      const participantsData = participants.map((p) => ({
        Prénom: p.firstName,
        Nom: p.lastName,
        Type: p.type,
        Créneau: p.timeSlot?.name || 'Non assigné',
        Squad: p.squad ? `Squad ${p.squad.number}` : 'Non assigné',
        Arrivé: p.arrived ? 'Oui' : 'Non',
        'Code Secret': p.secretCode || 'Non assigné',
        Checklist: p.checklistCompleted ? 'Complète' : 'Incomplète',
        'Repas gratuit': p.hasFreemeal ? 'Oui' : 'Non',
        'Repas réclamé': p.freeMealClaimed ? 'Oui' : 'Non',
      }));

      // Prepare time slots data
      const timeSlotsData = timeSlots.map((ts) => ({
        Nom: ts.name,
        Type: ts.type,
        'Heure Briefing': ts.briefingTime,
        'Heure Jeu': ts.gameTime,
      }));

      // Prepare squads data
      const squadsData = squads.map((squad) => ({
        Numéro: squad.number,
        Type: squad.type,
        'Nombre de participants': squad.participants?.length || 0,
      }));

      // Create workbook with multiple sheets
      const wb = xlsx.utils.book_new();

      const wsParticipants = xlsx.utils.json_to_sheet(participantsData);
      xlsx.utils.book_append_sheet(wb, wsParticipants, 'Participants');

      const wsTimeSlots = xlsx.utils.json_to_sheet(timeSlotsData);
      xlsx.utils.book_append_sheet(wb, wsTimeSlots, 'Creneaux');

      if (type !== 'staff') {
        const wsSquads = xlsx.utils.json_to_sheet(squadsData);
        xlsx.utils.book_append_sheet(wb, wsSquads, 'Squads');
      }

      const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const date = new Date().toISOString().split('T')[0];
      const baseFilename = type || 'toutes_donnees';
      const filename = `${baseFilename}_complet_${date}.xlsx`;

      logger.info('All data exported to Excel', {
        participantCount: participants.length,
        timeSlotCount: timeSlots.length,
        squadCount: squads.length,
        type,
        filename,
        userId: (req as any).session?.user?.id,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error: any) {
      logger.error('Error exporting all data', { error: error.message, stack: error.stack });
      res.status(500).json({ message: 'Error exporting all data' });
    }
  });
}
