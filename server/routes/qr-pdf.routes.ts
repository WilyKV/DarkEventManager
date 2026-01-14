/**
 * QR Code and PDF Routes Module
 *
 * Handles:
 * - QR code generation and scanning for participants
 * - PDF receipt generation for participants
 */

import type { Express } from 'express';
import { storage } from '../storage';
import { encryptQRData, decryptQRData } from '../utils/encryption';
import { generateParticipantPDF } from '../pdf-service';
import { logger } from '../utils/logger';

export function registerQrPdfRoutes(app: Express) {
  // ===== QR CODE GENERATION & SCANNING =====

  // Generate QR code for a participant
  app.get('/api/qr/generate/:participantId', async (req, res) => {
    try {
      const participantId = parseInt(req.params.participantId);
      const participant = await storage.getParticipant(participantId);

      if (!participant) {
        return res.status(404).json({ message: 'Participant not found' });
      }

      if (!participant.secretCode) {
        return res.status(400).json({ message: 'Participant does not have a secret code' });
      }

      const encryptedData = encryptQRData(participant.id, participant.secretCode);

      logger.info('QR code generated', {
        participantId: participant.id,
        userId: (req as any).session?.user?.id,
      });

      res.json({ qrData: encryptedData });
    } catch (error: any) {
      logger.error('Error generating QR code', {
        error: error.message,
        participantId: req.params.participantId,
      });
      res.status(500).json({ message: 'Error generating QR code' });
    }
  });

  // Scan QR code and retrieve participant
  app.post('/api/qr/scan', async (req, res) => {
    try {
      const { qrData } = req.body;

      if (!qrData) {
        return res.status(400).json({ message: 'QR data is required' });
      }

      const decryptedData = decryptQRData(qrData);

      if (!decryptedData) {
        logger.warn('Invalid QR code scanned', { ip: req.ip });
        return res.status(400).json({ message: 'Invalid QR code' });
      }

      const participant = await storage.getParticipant(decryptedData.id);

      if (!participant) {
        return res.status(404).json({ message: 'Participant not found' });
      }

      if (participant.secretCode !== decryptedData.code) {
        logger.warn('Invalid secret code in QR', {
          participantId: decryptedData.id,
          ip: req.ip,
        });
        return res.status(400).json({ message: 'Invalid secret code' });
      }

      logger.info('QR code scanned successfully', {
        participantId: participant.id,
        userId: (req as any).session?.user?.id,
      });

      res.json({ participant });
    } catch (error: any) {
      logger.error('Error scanning QR code', { error: error.message });
      res.status(500).json({ message: 'Error scanning QR code' });
    }
  });

  // ===== PDF GENERATION =====

  // Generate PDF receipt for a participant
  app.get('/api/participants/:id/pdf', async (req, res) => {
    try {
      const participantId = parseInt(req.params.id);

      if (isNaN(participantId)) {
        return res.status(400).json({ message: 'ID participant invalide' });
      }

      // Récupérer le participant avec toutes les relations
      const participant = await storage.getParticipant(participantId);
      if (!participant) {
        return res.status(404).json({ message: 'Participant non trouvé' });
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

      logger.info('PDF generated for participant', {
        participantId,
        purchaseCount: purchases.length,
        mealPurchaseCount: mealPurchases.length,
        userId: (req as any).session?.user?.id,
      });

      // Envoyer le PDF en tant que téléchargement
      const filename = `Recap_${participant.firstName}_${participant.lastName}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      logger.error('Error generating participant PDF', {
        error: error.message,
        stack: error.stack,
        participantId: req.params.id,
      });
      res.status(500).json({ message: 'Erreur lors de la génération du PDF' });
    }
  });
}
