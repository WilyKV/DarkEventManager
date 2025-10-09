import type { Express } from "express";
import { requireRole } from "./auth-routes";
import { storage } from "./storage";
import { generateParticipantPDF, encryptPDFFilename } from "./pdf-service";
import { sendEmail, createEndEventEmailTemplate } from "./email-service";

export function setupEndEventRoute(app: Express) {
  // End event endpoint - Send summary PDFs to all participants
  app.post("/api/admin/end-event", requireRole('admin'), async (req, res) => {
    try {
      // Set headers for Server-Sent Events (SSE)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Get all participants with email
      const allParticipants = await storage.getParticipants();
      const participantsWithEmail = allParticipants.filter(p => p.email && p.email.trim() !== '');

      const total = participantsWithEmail.length;
      let processed = 0;
      let succeeded = 0;
      let failed = 0;

      // Send initial progress
      res.write(`data: ${JSON.stringify({
        total,
        processed,
        succeeded,
        failed,
        status: 'processing'
      })}\n\n`);

      // Process each participant
      for (const participant of participantsWithEmail) {
        try {
          // Get participant's purchases
          const purchases = await storage.getPurchases(participant.id);
          const mealPurchases = await storage.getMealPurchases(participant.id);

          // Generate PDF
          const pdfBuffer = await generateParticipantPDF({
            participant,
            purchases,
            mealPurchases,
          });

          // Create filename (using participant info for security)
          const filename = encryptPDFFilename(participant.id, participant.secretCode || '00000');

          // Create email HTML
          const emailHtml = createEndEventEmailTemplate(`${participant.firstName} ${participant.lastName}`);

          // Send email with PDF attachment
          const emailSent = await sendEmail({
            to: participant.email!,
            subject: "Récapitulatif de votre participation - Zomb'in The Dark",
            html: emailHtml,
            attachments: [{
              filename,
              content: pdfBuffer,
              contentType: 'application/pdf',
            }],
          });

          if (emailSent) {
            succeeded++;
          } else {
            failed++;
          }
          
          processed++;

          // Send progress update
          res.write(`data: ${JSON.stringify({
            total,
            processed,
            succeeded,
            failed,
            currentParticipant: `${participant.firstName} ${participant.lastName}`,
            status: 'processing'
          })}\n\n`);

          // Small delay to avoid overwhelming the SMTP server
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Failed to process participant ${participant.id}:`, error);
          failed++;
          processed++;

          // Send progress update
          res.write(`data: ${JSON.stringify({
            total,
            processed,
            succeeded,
            failed,
            currentParticipant: `${participant.firstName} ${participant.lastName}`,
            status: 'processing'
          })}\n\n`);
        }
      }

      // Send final status
      res.write(`data: ${JSON.stringify({
        total,
        processed,
        succeeded,
        failed,
        status: 'completed'
      })}\n\n`);

      res.end();

    } catch (error) {
      console.error('End event error:', error);
      
      // Send error status
      res.write(`data: ${JSON.stringify({
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        status: 'error'
      })}\n\n`);
      
      res.end();
    }
  });
}
