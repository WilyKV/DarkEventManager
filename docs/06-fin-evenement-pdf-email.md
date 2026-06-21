# Pipeline fin d'événement : Génération PDF et envoi emails

## Vue d'ensemble

À la clôture de l'événement, l'application génère un **récapitulatif personnalisé en PDF** pour chaque participant et l'envoie par email.

**Pipeline** :
1. Admin clique "Fin d'événement"
2. Serveur itère tous participants avec email
3. Pour chaque participant :
   - Générer PDF (badge, achats, repas, totaux)
   - Envoyer email via Outlook SMTP
   - Stream progress via Server-Sent Events
4. Admin voit barre de progression en temps réel

## Endpoint

```
POST /api/admin/end-event
Content-Type: application/json
Authorization: Bearer (ou session staff avec rôle 'admin')
```

**Sécurité** : Protégé par middleware `requireRole('admin')`

**Réponse** : Server-Sent Events (SSE)

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"total": 123, "processed": 0, "succeeded": 0, "failed": 0, "status": "processing"}

data: {"total": 123, "processed": 1, "succeeded": 1, "failed": 0, "currentParticipant": "Alice Martin", "status": "processing"}

data: {"total": 123, "processed": 2, "succeeded": 1, "failed": 1, "currentParticipant": "Bob Dupont", "status": "processing", "error": "Email invalide"}

data: {"total": 123, "processed": 123, "succeeded": 120, "failed": 3, "status": "completed"}
```

## Génération PDF

### Service : `server/pdf-service.ts`

```typescript
async function generateParticipantPDF(input: {
  participant: Participant,
  purchases: Purchase[],
  mealPurchases: MealPurchase[]
}): Promise<Buffer>
```

### Contenu PDF

Le PDF contient :

1. **En-tête** : Logo, nom événement ("Zomb'in The Dark")
2. **Badge participant** : QR code + code secret 5 chiffres
3. **Informations** : Nom, type (zombie/survivant/staff), équipe, créneau
4. **Récapitulatif achats** :
   ```
   BOUTIQUE
   ────────────────────────
   Bière artisanale × 1       5,00 €
   Merch zombie × 2          20,00 €
   ────────────────────────
   Total boutique            25,00 €
   ```
5. **Récapitulatif repas** :
   ```
   REPAS
   ────────────────────────
   Saucisse grillée × 1      5,00 € (gratuit zombie)
   Salade × 1                3,00 €
   ────────────────────────
   Total repas               3,00 €
   ```
6. **Totaux** :
   ```
   Montant dû                28,00 €
   Payé                      28,00 €
   Solde                      0,00 €
   ```

### Technologie : pdfkit

```bash
npm ls pdfkit
pdfkit@0.15.0
```

**Exemple de génération simplifiée** :

```typescript
import PDFDocument from 'pdfkit';

const doc = new PDFDocument({ size: 'A4' });

// Header
doc.fontSize(24).text("Zomb'in The Dark", 50, 50);
doc.fontSize(12).text("Récapitulatif de participation", 50, 80);

// Participant info
doc.fontSize(14).text(`${participant.firstName} ${participant.lastName}`, 50, 120);
doc.fontSize(10).text(`Type: ${participant.type}`, 50, 140);

// QR Code (si disponible)
// doc.image(qrCodeBuffer, 400, 50, { width: 100 });

// Purchases
doc.fontSize(12).text('ACHATS BOUTIQUE', 50, 200);
purchases.forEach((purchase, i) => {
  doc.fontSize(10).text(
    `${purchase.itemName} × ${purchase.quantity} = ${purchase.totalPrice} €`,
    60,
    220 + (i * 15)
  );
});

// Meals
doc.fontSize(12).text('REPAS', 50, 300);
mealPurchases.forEach((meal, i) => {
  doc.fontSize(10).text(
    `${meal.itemName} × ${meal.quantity} = ${meal.totalPrice} €`,
    60,
    320 + (i * 15)
  );
});

// Total
const total = calculateTotal(purchases, mealPurchases);
doc.fontSize(14).text(`Total: ${total} €`, 50, 400);

// Stream to buffer
const buffer = await new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);
  doc.end();
});

return buffer;
```

### Chiffrement du nom de fichier

Pour éviter de révéler les noms de participants en URL :

```typescript
// server/pdf-service.ts
function encryptPDFFilename(participantId: number, secretCode: string): string {
  const plain = `${participantId}_${secretCode}.pdf`;
  const encrypted = aes256cbc.encrypt(plain, process.env.QR_ENCRYPTION_KEY);
  return `${encrypted}.pdf`;
}
```

**Fichier envoyé** : `a7f8e2d9c1b4e6...pdf` (inintelligible)

## Envoi email

### Service : `server/email-service.ts`

```typescript
async function sendEmail(options: {
  to: string,
  subject: string,
  html: string,
  attachments: Array<{
    filename: string,
    content: Buffer,
    contentType: string
  }>
}): Promise<boolean>
```

### Configuration SMTP

Via `.env` :

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-app-password

EMAIL_FROM=your-email@outlook.com
EMAIL_FROM_NAME=Zomb'in The Dark
```

**Nodemailer** :

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',  // false=STARTTLS, true=SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const mailOptions = {
  from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
  to: participant.email,
  subject: "Récapitulatif de votre participation - Zomb'in The Dark",
  html: createEndEventEmailTemplate(participant.firstName),
  attachments: [{
    filename: encryptedFilename,
    content: pdfBuffer,
    contentType: 'application/pdf',
  }],
};

const info = await transporter.sendMail(mailOptions);
return !!info.messageId;  // true si succès
```

### Template email HTML

```typescript
function createEndEventEmailTemplate(firstName: string): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; background: #000; color: #fff;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <h1 style="text-align: center; color: #ff4444;">
            Zomb'in The Dark — Merci!
          </h1>
          
          <p>Bienvenue ${firstName},</p>
          
          <p>Nous avons le plaisir de vous envoyer votre récapitulatif de participation à Zomb'in The Dark!</p>
          
          <p>En pièce jointe, vous trouverez un PDF contenant :</p>
          <ul>
            <li>Votre badge et code secret</li>
            <li>Détail de vos achats à la boutique</li>
            <li>Détail de vos repas</li>
            <li>Montant total dû</li>
          </ul>
          
          <p>
            <strong>Un grand merci</strong> de votre participation! Rejoignez-nous lors du prochain événement.
          </p>
          
          <hr style="border: 1px solid #ff4444; margin: 20px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            Zomb'in The Dark — Événement immersif en caverne
          </p>
          
        </div>
      </body>
    </html>
  `;
}
```

## Mode développement : Email redirect

En développement, **tous les emails** sont redirigés vers une seule adresse :

```env
NODE_ENV=development
DEV_EMAIL_OVERRIDE=kevin.nicol@hotmail.fr
```

**Comportement** (cf. `email-service.ts`) :

```typescript
if (process.env.NODE_ENV === 'development' && process.env.DEV_EMAIL_OVERRIDE) {
  mailOptions.to = process.env.DEV_EMAIL_OVERRIDE;
  mailOptions.subject = `[TO: ${originalTo}] ${originalSubject}`;
  // Destinataire original dans le sujet
}
```

**Résultat** : Email arrive en dev mail, sujet = `[TO: alice@example.com] Récapitulatif...`

Permet de tester le template + attachments sans spammer les vrais participants.

## Flow complet end-event

```
Admin                    Server                      SMTP (Outlook)      Database
 │                       │                           │                    │
 ├─ POST /api/admin/end-event (admin role) ──────────>│                    │
 │                       │                           │                    │
 │                       ├─ SELECT participants ─────────────────────────>│
 │                       │  WHERE email IS NOT NULL                       │
 │                       │<─ [Alice, Bob, Charlie, ...]  ──────────────────┤
 │                       │                           │                    │
 │<─ SSE: total=123 ──────┤                           │                    │
 │  processed=0           │                           │                    │
 │                       │                           │                    │
 │                       ├─ Iteration 1: Alice       │                    │
 │                       │  ├─ SELECT purchases ──────────────────────────>│
 │                       │  │ SELECT meal_purchases  │                    │
 │                       │  │<─ [achat1, achat2] ────────────────────────┤
 │                       │  │                        │                    │
 │                       │  ├─ generatePDF()         │                    │
 │                       │  │ (pdfkit buffer)        │                    │
 │                       │  │                        │                    │
 │                       │  ├─ sendEmail() ────────────────────────────>│
 │                       │  │  (SMTP connect)        │                    │
 │                       │  │<─ Message queued ──────────────────────────┤
 │                       │  │  (or error)            │                    │
 │<─ SSE: processed=1 ────┤                           │                    │
 │  succeeded=1           │                           │                    │
 │                       │                           │                    │
 │                       ├─ Iteration 2: Bob         │                    │
 │                       │  ...                      │                    │
 │                       │                           │                    │
 │ [... repeat for 121 more ...]                      │                    │
 │                       │                           │                    │
 │<─ SSE: processed=123 ──┤                           │                    │
 │  succeeded=120         │  (Admin voit 100%)       │                    │
 │  failed=3              │                           │                    │
 │  status=completed      │                           │                    │
 │                       │                           │                    │
```

## Gestion des erreurs

### Emails invalides

Si `participant.email` est null ou vide :

```typescript
const participantsWithEmail = allParticipants.filter(
  p => p.email && p.email.trim() !== ''
);
```

Participants sans email = **non traités** (pas compté dans `total`).

### Erreurs SMTP

Si connexion SMTP échoue ou email rebounce :

```typescript
try {
  const emailSent = await sendEmail({ ... });
  if (emailSent) {
    succeeded++;
  } else {
    failed++;
  }
} catch (error) {
  endEventLogger.error({ err: error }, 'Email send failed');
  failed++;
}
```

Error enregistré en log (accessible via `make logs`), comptage en `failed`.

Admin voit le nombre d'échecs dans la barre de progression et peut investiguer logs.

### Retry réseau

Si le client-side SSE connection se ferme prématurément :

- **Pas de retry côté server** : stream termina
- Admin doit re-cliquer "Fin d'événement" (traite les déjà-envoyés via idempotence du client EventID)

Pour future iteration : implémenter state machine (pending/processing/done) pour true resume.

## Performance et throttling

```typescript
// Petit délai entre emails pour éviter overload SMTP
await new Promise(resolve => setTimeout(resolve, 500));  // 0.5s par email
```

**Calcul** : 500 participants = ~250s = 4min (acceptable pour événement terminé).

**Optimisation possible** : Paralléliser (cautiously) avec Promise.all() + maxConcurrency.

---

**Voir aussi** :
- [03-authentification-roles.md](./03-authentification-roles.md) — Rôle admin
- [08-securite.md](./08-securite.md) — Sécurité emails et SMTP
