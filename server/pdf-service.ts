import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import QRCode from 'qrcode';
import type { ParticipantWithRelations, PurchaseWithRelations, MealPurchaseWithRelations } from '@shared/schema';

interface PDFGenerationData {
  participant: ParticipantWithRelations;
  purchases: PurchaseWithRelations[];
  mealPurchases: MealPurchaseWithRelations[];
}

export async function generateParticipantPDF(data: PDFGenerationData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks: Buffer[] = [];

      // Collecter les chunks du PDF
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { participant, purchases, mealPurchases } = data;

      // Filtrer les achats invalides (sans item valide uniquement)
      const validPurchases = purchases.filter(p => p.shopItem && p.shopItem.name);
      const validMealPurchases = mealPurchases.filter(p => p.mealItem && p.mealItem.name);

      // Générer le QR code pour le badge participant
      const qrData = JSON.stringify({
        id: participant.id,
        code: participant.secretCode,
        type: participant.type,
        firstName: participant.firstName,
        lastName: participant.lastName
      });
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        width: 180,
        margin: 1
      });

      // ===== FOND DÉGRADÉ VIOLET/NOIR (comme la page login) =====
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      // Fond dégradé en 3 sections (simuler gradient: from-gray-900 via-purple-900 to-gray-900)
      const gradientSteps = 50;
      const stepHeight = pageHeight / gradientSteps;

      for (let i = 0; i < gradientSteps; i++) {
        const ratio = i / gradientSteps;
        let r, g, b;

        if (ratio < 0.33) {
          // from-gray-900 (17, 24, 39) to via-purple-900 (88, 28, 135)
          const localRatio = ratio / 0.33;
          r = 17 + (88 - 17) * localRatio;
          g = 24 + (28 - 24) * localRatio;
          b = 39 + (135 - 39) * localRatio;
        } else if (ratio < 0.66) {
          // via-purple-900 (88, 28, 135) to via-purple-900 (stay)
          r = 88;
          g = 28;
          b = 135;
        } else {
          // via-purple-900 (88, 28, 135) to to-gray-900 (17, 24, 39)
          const localRatio = (ratio - 0.66) / 0.34;
          r = 88 + (17 - 88) * localRatio;
          g = 28 + (24 - 28) * localRatio;
          b = 135 + (39 - 135) * localRatio;
        }

        doc.rect(0, i * stepHeight, pageWidth, stepHeight)
           .fillColor(`rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`)
           .fill();
      }

      // ===== EN-TÊTE STYLÉ =====
      doc.fontSize(32)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text("Zomb'in The Dark", 50, 60, { align: 'center' })
         .moveDown(0.3);

      doc.fontSize(18)
         .fillColor('#a78bfa')
         .font('Helvetica')
         .text('RECAPITULATIF PARTICIPANT', { align: 'center' })
         .moveDown(0.5);

      // Ligne de séparation
      doc.moveTo(80, 150)
         .lineTo(pageWidth - 80, 150)
         .strokeColor('#a78bfa')
         .lineWidth(2)
         .stroke();

      let currentY = 180;

      // ===== CARTE PARTICIPANT =====
      const cardX = 60;
      const cardWidth = pageWidth - 120;
      const cardY = currentY;
      const cardHeight = 200;

      // Fond de carte semi-transparent
      doc.rect(cardX, cardY, cardWidth, cardHeight)
         .fillColor('#1f2937')
         .fillOpacity(0.8)
         .fill();

      doc.fillOpacity(1); // Reset opacity

      // Badge du type de participant
      const typeColors: { [key: string]: string } = {
        'zombie': '#dc2626',
        'survivant': '#2563eb',
        'staff': '#16a34a'
      };
      const typeColor = typeColors[participant.type] || '#6b7280';

      doc.roundedRect(cardX + 20, cardY + 20, 100, 30, 5)
         .fillColor(typeColor)
         .fill();

      doc.fontSize(14)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text(participant.type.toUpperCase(), cardX + 30, cardY + 28, { width: 80, align: 'center' });

      // ===== BADGE MINIATURE COMPLET À DROITE DE LA CARTE =====
      const badgeWidth = 150;
      const badgeHeight = 220;
      const badgeX = cardX + cardWidth - badgeWidth - 15;
      const badgeY = cardY + 15;

      // Couleur du badge selon le type
      const badgeBgColor = participant.type === 'zombie' 
        ? '#7f1d1d' 
        : participant.type === 'staff' 
        ? '#166534' 
        : '#1e3a8a';
      
      const badgeBorderColor = participant.type === 'zombie'
        ? '#dc2626'
        : participant.type === 'staff'
        ? '#22c55e'
        : '#3b82f6';

      // Fond du badge avec bordure arrondie
      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 8)
         .fillColor(badgeBgColor)
         .fill();

      doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 8)
         .strokeColor(badgeBorderColor)
         .lineWidth(2)
         .stroke();

      let badgeCurrentY = badgeY + 10;

      // Titre "ZOMBINTHEDARK"
      doc.fontSize(10)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text('ZOMBINTHEDARK', badgeX, badgeCurrentY, { 
           width: badgeWidth, 
           align: 'center' 
         });

      badgeCurrentY += 15;

      // Type de participant
      const typeBadgeColor = participant.type === 'zombie'
        ? '#dc2626'
        : participant.type === 'staff'
        ? '#22c55e'
        : '#3b82f6';

      doc.roundedRect(badgeX + 30, badgeCurrentY, badgeWidth - 60, 15, 5)
         .fillColor(typeBadgeColor)
         .fill();

      doc.fontSize(8)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text(
           participant.type === 'zombie' ? 'ZOMBIE' : 
           participant.type === 'staff' ? 'STAFF' : 'SURVIVANT',
           badgeX + 30,
           badgeCurrentY + 4,
           { width: badgeWidth - 60, align: 'center' }
         );

      badgeCurrentY += 22;

      // Nom du participant
      doc.fontSize(11)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text(`${participant.firstName}`, badgeX + 5, badgeCurrentY, { 
           width: badgeWidth - 10, 
           align: 'center' 
         });

      badgeCurrentY += 12;

      doc.fontSize(11)
         .text(`${participant.lastName}`, badgeX + 5, badgeCurrentY, { 
        width: badgeWidth - 10, 
        align: 'center' 
      });

      badgeCurrentY += 18;

      // Squad et créneau côte à côte (si disponibles)
      if (participant.type !== 'staff' && participant.squad) {
        doc.fontSize(6)
           .fillColor('#d1d5db')
           .font('Helvetica')
           .text('SQUAD', badgeX + 10, badgeCurrentY, { width: 60, align: 'center' });
        
        doc.fontSize(9)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(`#${participant.squad.number}`, badgeX + 10, badgeCurrentY + 8, { 
             width: 60, 
             align: 'center' 
           });
      }

      if (participant.timeSlot) {
        const timeSlotX = participant.type !== 'staff' && participant.squad ? badgeX + 75 : badgeX + 10;
        const timeSlotWidth = participant.type !== 'staff' && participant.squad ? 65 : badgeWidth - 20;
        
        doc.fontSize(6)
           .fillColor('#d1d5db')
           .font('Helvetica')
           .text('CRENEAU', timeSlotX, badgeCurrentY, { width: timeSlotWidth, align: 'center' });
        
        doc.fontSize(7)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(participant.timeSlot.name || '', timeSlotX, badgeCurrentY + 8, { 
             width: timeSlotWidth, 
             align: 'center' 
           });
        
        doc.fontSize(5)
           .fillColor('#d1d5db')
           .font('Helvetica')
           .text(
             `Briefing: ${participant.timeSlot.briefingTime || ''}`, 
             timeSlotX, 
             badgeCurrentY + 17, 
             { width: timeSlotWidth, align: 'center' }
           );
        
        doc.text(
          `Jeu: ${participant.timeSlot.gameTime || ''}`, 
          timeSlotX, 
          badgeCurrentY + 22, 
          { width: timeSlotWidth, align: 'center' }
        );
      }

      badgeCurrentY += 35;

      // QR Code au centre
      const qrSize = 70;
      const qrX = badgeX + (badgeWidth - qrSize) / 2;
      
      // Fond blanc pour le QR code
      doc.rect(qrX - 2, badgeCurrentY - 2, qrSize + 4, qrSize + 4)
         .fillColor('#ffffff')
         .fill();

      // Convertir le Data URL en buffer et l'insérer
      const qrBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
      doc.image(qrBuffer, qrX, badgeCurrentY, {
        width: qrSize,
        height: qrSize
      });

      badgeCurrentY += qrSize + 8;

      // Checkboxes Repas et Goodies
      const checkboxY = badgeCurrentY;
      const checkboxSize = 8;
      const checkboxSpacing = (badgeWidth - 20) / 2;

      // Repas
      doc.rect(badgeX + 10, checkboxY, checkboxSize, checkboxSize)
         .strokeColor('#ffffff')
         .lineWidth(1.5)
         .stroke();
      
      doc.fontSize(7)
         .fillColor('#ffffff')
         .font('Helvetica')
         .text('Repas', badgeX + 10 + checkboxSize + 3, checkboxY + 1, { width: 40 });

      // Goodies
      doc.rect(badgeX + 10 + checkboxSpacing, checkboxY, checkboxSize, checkboxSize)
         .strokeColor('#ffffff')
         .lineWidth(1.5)
         .stroke();
      
      doc.text('Goodies', badgeX + 10 + checkboxSpacing + checkboxSize + 3, checkboxY + 1, { width: 40 });

      // Informations du participant (à gauche)
      currentY = cardY + 60;
      doc.fontSize(22)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text(`${participant.firstName} ${participant.lastName}`, cardX + 20, currentY, { width: cardWidth - badgeWidth - 50 });

      currentY += 35;
      doc.fontSize(14)
         .fillColor('#d1d5db')
         .font('Helvetica');

      if (participant.email) {
        doc.text(`Email: ${participant.email}`, cardX + 20, currentY);
        currentY += 25;
      }

      doc.fontSize(18)
         .fillColor('#a78bfa')
         .font('Helvetica-Bold')
         .text(`Code: ${participant.secretCode || 'N/A'}`, cardX + 20, currentY);

      currentY += 30;
      doc.fontSize(12)
         .fillColor('#d1d5db')
         .font('Helvetica');

      if (participant.timeSlot) {
        doc.text(`Creneau: ${participant.timeSlot.name || 'N/A'}`, cardX + 20, currentY);
        currentY += 18;
        const briefingTime = participant.timeSlot.briefingTime || 'N/A';
        const gameTime = participant.timeSlot.gameTime || 'N/A';
        doc.fillColor('#9ca3af')
           .text(`   Briefing: ${briefingTime} | Jeu: ${gameTime}`, cardX + 20, currentY);
        currentY += 20;
      }

      if (participant.squad) {
        doc.fillColor('#d1d5db')
           .text(`Squad: #${participant.squad.number}`, cardX + 20, currentY);
      }

      currentY = cardY + cardHeight + 40;

      // ===== SECTION ACHATS BOUTIQUE =====
      doc.fontSize(18)
         .fillColor('#60a5fa')
         .font('Helvetica-Bold')
         .text('HISTORIQUE BOUTIQUE', 70, currentY);

      currentY += 35;

      if (validPurchases && validPurchases.length > 0) {
        let totalBoutique = 0;

        validPurchases.forEach((purchase, index) => {
          // Fond alterné pour chaque ligne
          if (index % 2 === 0) {
            doc.rect(60, currentY - 5, cardWidth, 35)
               .fillColor('#1f2937')
               .fillOpacity(0.5)
               .fill();
            doc.fillOpacity(1);
          }

          const itemName = purchase.shopItem?.name || 'Article inconnu';
          const purchasePrice = parseFloat(purchase.unitPrice || '0');
          const purchaseQuantity = purchase.quantity || 0;
          
          doc.fontSize(12)
             .fillColor('#ffffff')
             .font('Helvetica')
             .text(itemName, 80, currentY, { width: 250 });

          doc.fillColor('#a78bfa')
             .text(`${purchasePrice.toFixed(2)}EUR x${purchaseQuantity}`, 350, currentY);

          const purchasedAt = purchase.purchasedAt ? new Date(purchase.purchasedAt) : null;
          const dateStr = purchasedAt && !isNaN(purchasedAt.getTime()) 
            ? purchasedAt.toLocaleString('fr-FR')
            : 'Date inconnue';
          
          doc.fillColor('#9ca3af')
             .fontSize(9)
             .text(dateStr, 450, currentY + 2);

          currentY += 35;
          totalBoutique += purchasePrice * purchaseQuantity;
        });

        // Total boutique
        doc.rect(60, currentY - 5, cardWidth, 35)
           .fillColor('#1e40af')
           .fillOpacity(0.7)
           .fill();
        doc.fillOpacity(1);

        doc.fontSize(14)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(`Total Boutique:`, 80, currentY + 8);

        doc.fillColor('#60a5fa')
           .text(`${totalBoutique.toFixed(2)}EUR`, 450, currentY + 8);

        currentY += 45;
      } else {
        doc.fontSize(11)
           .fillColor('#9ca3af')
           .font('Helvetica')
           .text('Aucun achat effectue', 80, currentY);
        currentY += 40;
      }

      // ===== SECTION ACHATS REPAS =====
      doc.fontSize(18)
         .fillColor('#fb923c')
         .font('Helvetica-Bold')
         .text('HISTORIQUE REPAS', 70, currentY);

      currentY += 35;

      if (validMealPurchases && validMealPurchases.length > 0) {
        let totalRepas = 0;

        validMealPurchases.forEach((purchase, index) => {
          // Fond alterné pour chaque ligne
          if (index % 2 === 0) {
            doc.rect(60, currentY - 5, cardWidth, 35)
               .fillColor('#1f2937')
               .fillOpacity(0.5)
               .fill();
            doc.fillOpacity(1);
          }

          const itemName = purchase.mealItem?.name || 'Repas inconnu';
          const purchasePrice = parseFloat(purchase.unitPrice || '0');
          const purchaseQuantity = purchase.quantity || 0;

          doc.fontSize(12)
             .fillColor('#ffffff')
             .font('Helvetica')
             .text(itemName, 80, currentY, { width: 250 });

          doc.fillColor('#fb923c')
             .text(`${purchasePrice.toFixed(2)}EUR x${purchaseQuantity}`, 350, currentY);

          const purchasedAt = purchase.purchasedAt ? new Date(purchase.purchasedAt) : null;
          const dateStr = purchasedAt && !isNaN(purchasedAt.getTime()) 
            ? purchasedAt.toLocaleString('fr-FR')
            : 'Date inconnue';

          doc.fillColor('#9ca3af')
             .fontSize(9)
             .text(dateStr, 450, currentY + 2);

          currentY += 35;
          totalRepas += purchasePrice * purchaseQuantity;
        });

        // Total repas
        doc.rect(60, currentY - 5, cardWidth, 35)
           .fillColor('#c2410c')
           .fillOpacity(0.7)
           .fill();
        doc.fillOpacity(1);

        doc.fontSize(14)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text(`Total Repas:`, 80, currentY + 8);

        doc.fillColor('#fb923c')
           .text(`${totalRepas.toFixed(2)}EUR`, 450, currentY + 8);

        currentY += 45;
      } else {
        doc.fontSize(11)
           .fillColor('#9ca3af')
           .font('Helvetica')
           .text('Aucun achat effectue', 80, currentY);
        currentY += 40;
      }

      // ===== PIED DE PAGE =====
      const footerY = pageHeight - 80;
      
      doc.moveTo(80, footerY - 20)
         .lineTo(pageWidth - 80, footerY - 20)
         .strokeColor('#a78bfa')
         .lineWidth(1)
         .stroke();

      doc.fontSize(12)
         .fillColor('#d1d5db')
         .font('Helvetica')
         .text('Merci pour votre participation !', 0, footerY, { align: 'center', width: pageWidth });

      doc.fontSize(10)
         .fillColor('#a78bfa')
         .text('https://zombinthedark.fr', 0, footerY + 20, { 
           align: 'center', 
           width: pageWidth,
           link: 'https://zombinthedark.fr' 
         });

      const now = new Date();
      const generationDate = !isNaN(now.getTime()) 
        ? now.toLocaleString('fr-FR') 
        : 'Date inconnue';

      doc.fontSize(8)
         .fillColor('#6b7280')
         .text(`Document genere le ${generationDate}`, 0, footerY + 40, { 
           align: 'center',
           width: pageWidth
         });

      // Finaliser le PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

// Fonction pour "chiffrer" le PDF (ajout d'un mot de passe basé sur le code participant)
// Note: PDFKit ne supporte pas le chiffrement natif, donc on utilise crypto pour le nom
export function encryptPDFFilename(participantId: number, secretCode: string): string {
  // Créer un hash du code secret pour le nom de fichier
  const hash = crypto.createHash('md5').update(secretCode + participantId.toString()).digest('hex').substring(0, 8);
  return `participant_${participantId}_${hash}.pdf`;
}

// Alternative: Chiffrement simple du buffer PDF avec AES
export function encryptPDFBuffer(pdfBuffer: Buffer, secretCode: string): Buffer {
  try {
    // Utiliser le code secret comme clé (le hasher pour avoir une taille fixe)
    const key = crypto.createHash('sha256').update(secretCode).digest();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(pdfBuffer), cipher.final()]);
    
    // Retourner IV + données chiffrées
    return Buffer.concat([iv, encrypted]);
  } catch (error) {
    console.error('[PDF] Erreur lors du chiffrement:', error);
    // En cas d'erreur, retourner le PDF non chiffré
    return pdfBuffer;
  }
}

// Note: Pour déchiffrer, le participant devra utiliser son code secret
// Cette fonction est fournie à titre informatif (côté client éventuel)
export function decryptPDFBuffer(encryptedBuffer: Buffer, secretCode: string): Buffer {
  try {
    const key = crypto.createHash('sha256').update(secretCode).digest();
    const iv = encryptedBuffer.slice(0, 16);
    const encrypted = encryptedBuffer.slice(16);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    return decrypted;
  } catch (error) {
    console.error('[PDF] Erreur lors du déchiffrement:', error);
    throw new Error('Impossible de déchiffrer le PDF. Code secret incorrect.');
  }
}
