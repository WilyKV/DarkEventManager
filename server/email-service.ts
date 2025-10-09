import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Configuration du transporteur SMTP
export function createEmailTransporter(): Transporter {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-mail.outlook.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log(`[Email] Transporter créé en mode ${isDevelopment ? 'DÉVELOPPEMENT' : 'PRODUCTION'}`);
  if (isDevelopment) {
    console.log(`[Email] Tous les emails seront redirigés vers: ${process.env.DEV_EMAIL_OVERRIDE}`);
  }

  return transporter;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const transporter = createEmailTransporter();
    const isDevelopment = process.env.NODE_ENV === 'development';

    // En développement, rediriger tous les emails vers DEV_EMAIL_OVERRIDE
    const actualTo = isDevelopment 
      ? process.env.DEV_EMAIL_OVERRIDE || options.to
      : options.to;

    // En développement, ajouter l'email original dans le sujet
    const actualSubject = isDevelopment
      ? `[DEV - Original: ${options.to}] ${options.subject}`
      : options.subject;

    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || "Zomb'in The Dark",
        address: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
      },
      to: actualTo,
      subject: actualSubject,
      html: options.html,
      attachments: options.attachments || [],
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`[Email] Email envoyé avec succès à ${actualTo}`);
    console.log(`[Email] Message ID: ${info.messageId}`);
    
    return true;
  } catch (error) {
    console.error('[Email] Erreur lors de l\'envoi de l\'email:', error);
    return false;
  }
}

// Template HTML pour l'email de fin d'événement
export function createEndEventEmailTemplate(participantName: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Récapitulatif - Zomb'in The Dark</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header img {
          max-width: 300px;
          height: auto;
        }
        h1 {
          color: #dc2626;
          text-align: center;
          margin-top: 20px;
        }
        .content {
          margin: 20px 0;
        }
        .highlight {
          background-color: #fef3c7;
          padding: 15px;
          border-left: 4px solid #f59e0b;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
        .cta-button {
          display: inline-block;
          background-color: #dc2626;
          color: #ffffff;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://zombinthedark.fr/wp-content/uploads/2020/11/Logo_ZITD_plat_blanc-1-300x105.png" 
               alt="Zomb'in The Dark Logo" 
               style="max-width: 300px;">
        </div>
        
        <h1>Merci pour votre participation !</h1>
        
        <div class="content">
          <p>Bonjour <strong>${participantName}</strong>,</p>
          
          <p>
            Merci d'avoir participé à notre événement <strong>Zomb'in The Dark</strong> ! 
            Nous espérons que vous avez passé un moment inoubliable.
          </p>
          
          <div class="highlight">
            <strong>📄 Votre récapitulatif personnalisé</strong><br>
            Vous trouverez en pièce jointe un PDF contenant :
            <ul>
              <li>Votre badge participant</li>
              <li>Vos informations</li>
              <li>L'historique de vos achats boutique</li>
              <li>L'historique de vos achats repas</li>
            </ul>
            <em>Note : Le PDF est protégé pour garantir la confidentialité de vos données.</em>
          </div>
          
          <p>
            N'hésitez pas à nous suivre sur nos réseaux sociaux pour ne rien manquer 
            de nos prochains événements !
          </p>
          
          <div style="text-align: center;">
            <a href="https://zombinthedark.fr" class="cta-button">
              Visitez notre site web
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p>
            <strong>Zomb'in The Dark</strong><br>
            Événement Zombie/Survivant<br>
            <a href="https://zombinthedark.fr" style="color: #dc2626;">zombinthedark.fr</a>
          </p>
          <p style="font-size: 10px; color: #9ca3af; margin-top: 15px;">
            Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
