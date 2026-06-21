# Sécurité : Protéger les données et opérations

## Vue d'ensemble des couches de sécurité

DarkEventManager implémente la sécurité à plusieurs niveaux :

| Couche | Mécanisme | Impact |
|--------|-----------|--------|
| **Transport** | HTTPS (prod) + Helmet headers | Confidentialité réseau |
| **Authentification** | Bcrypt + sessions + rate-limiting | Authentification staff/visiteur |
| **Autorisation** | Rôles + middlewares | Contrôle d'accès par fonction |
| **Chiffrement** | AES-256-GCM pour QR/secrets | Confidentialité sensibles |
| **Audit** | Logging complet mutations | Traçabilité + conformité |
| **Sync** | HMAC WebSocket + Device ID | Validation origine des mutations |

## 1. Authentification : Bcrypt et passwords

### Hachage des mots de passe

**Technologie** : `bcryptjs` (v3.0.3)

```typescript
// server/password-hashing.ts
import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);  // Coût computationnel = 10
  return await bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith('$2');  // SHA-256 ne commence pas par $2
}
```

**Coût** : 10 = ~100-150ms par tentative (acceptable pour login, fort contre brute-force)

### Lazy migration SHA-256 → Bcrypt

Ancien code utilisait SHA-256. Migration en arrière-plan :

```typescript
// server/auth-routes.ts
if (isLegacyHash(user.passwordHash)) {
  const newHash = await hashPassword(body.password);  // Hash en bcrypt
  await db.update(users).set({ passwordHash: newHash }).where(...);
  sessionLogger(req, `Upgraded password for ${user.username} to bcrypt`);
}
```

**Avantage** : Zéro downtime, upgrade silencieux à chaque login.

## 2. Rate-limiting : Protéger contre brute-force

### Middleware : express-rate-limit

#### Staff login (plus strict)

```typescript
const staffLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 tentatives max
  standardHeaders: true,
  keyGenerator: (req) => `${resolveIp(req)}:${req.body?.username}`,
  message: { message: 'Trop de tentatives, réessayez plus tard.' }
});

app.post('/api/auth/login', staffLoginLimiter, async (req, res) => { ... });
```

**Résultat** : 5 fails en 15min → bloqué 15min supplémentaires

#### Visitor login (moins strict, plus d'utilisateurs)

```typescript
const visitorLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 tentatives max
  standardHeaders: true,
  keyGenerator: (req) => resolveIp(req),  // Par IP seulement
  message: { message: 'Trop de tentatives, réessayez plus tard.' }
});

app.post('/api/auth/visitor-login', visitorLoginLimiter, async (req, res) => { ... });
```

**Rationale** : Visiteurs nombreux (même IP possible), mais 10 tries = ~100k codes testés (acceptable).

## 3. Sessions et cookies

### Cookie configuration

```typescript
// server/session-cookie-config.ts
cookie: {
  path: '/',
  httpOnly: true,              // XSS protection (JS ne peut lire)
  sameSite: 'lax',            // CSRF protection
  secure: isProduction(),      // HTTPS seulement en prod
  maxAge: 24 * 60 * 60 * 1000, // 24 heures
}
```

| Option | Valeur | Raison |
|--------|--------|--------|
| **httpOnly** | true | Prévient XSS (JS ne peut voler cookie) |
| **sameSite** | lax | CSRF : cookie envoyé seulement si navigation depuis même site |
| **secure** | true (prod) | HTTPS seulement (prévent man-in-middle) |
| **maxAge** | 24h | Expiration session |

### Session store

**Default** : memorystore (en RAM, perdu au redémarrage)

```typescript
// server/session-config.ts
export function createSessionStore(env: NodeJS.ProcessEnv, pool: Pool) {
  if (env.USE_PG_SESSIONS === 'true') {
    return new (require('connect-pg-simple')(session))({ pool });
  }
  return new require('memorystore')(session)();
}
```

Pour **production multi-instance**, utiliser `connect-pg-simple` (ADR-004) :

```bash
USE_PG_SESSIONS=true npm start
```

Sessions persistées en table `session` PostgreSQL.

## 4. Autorisation : Rôles et middlewares

### Rôles disponibles

Enum de 5 rôles (normalisé Vague 5 en JSONB array) :

```typescript
type UserRole =
  | 'admin'                // Fin d'événement, config
  | 'staff_zombie'         // Gestion participants zombies
  | 'staff_survivant'      // Gestion participants survivants
  | 'staff_repas'          // Gestion tous repas
  | 'staff_boutique';      // Gestion stock boutique
```

### Middleware requireRole

```typescript
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    const userRoles = Array.isArray(req.session.user.roles)
      ? req.session.user.roles
      : JSON.parse(req.session.user.roles || '[]');

    if (!roles.some(r => userRoles.includes(r))) {
      return res.status(403).json({
        message: `Accès refusé. Rôles requis: ${roles.join(', ')}`,
        requiredRoles: roles,
        userRoles
      });
    }

    next();
  };
}
```

**Usage** :

```typescript
// Admin seulement
app.post('/api/admin/end-event',
  requireRole('admin'),
  endEventHandler
);

// Repas OU Boutique
app.put('/api/purchases/:id',
  requireRole('staff_repas', 'staff_boutique'),
  purchaseHandler
);
```

## 5. Chiffrement : QR codes et secrets

### AES-256-GCM pour QR tokens

```typescript
// server/qr-encryption.ts
import crypto from 'crypto';

export function encryptQRToken(data: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    iv
  );

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  // Format: IV + AuthTag + Ciphertext
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decryptQRToken(encrypted: string, key: string): string | null {
  try {
    const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key, 'hex'),
      Buffer.from(ivHex, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return null;
  }
}
```

**Paramètres** :
- **Cipher** : AES-256-GCM (authenticated encryption)
- **Key** : 256 bits (32 bytes hex = 64 chars)
- **IV** : Random per message (embedded)
- **AuthTag** : AEAD authentication (détecte tampering)

### Secrets de synchronisation

```typescript
// server/sync-middleware.ts
export function getWebSocketSecret(): string {
  if (!_cachedSecret) {
    _cachedSecret = process.env.WEBSOCKET_SECRET || crypto.randomBytes(32).toString('hex');
  }
  return _cachedSecret;
}
```

**Warning** : Si WEBSOCKET_SECRET vide, secret généré aléatoirement. **Multi-instance break** : chaque instance a un secret différent.

**Fix** : Définir toujours en .env avant prod.

## 6. Audit Logging : Traçabilité complète

### Table audit_logs

Chaque mutation enregistre :

```sql
INSERT INTO audit_logs (
  action,        -- 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN_FAILED'
  table_name,    -- e.g., 'purchases'
  record_id,     -- ID enregistrement modifié
  user_id,       -- ID staff/visiteur
  username,      -- e.g., 'admin'
  snapshot,      -- État avant/après (JSON)
  diff,          -- Champs modifiés ({ field: { old: x, new: y } })
  ip_address,    -- IP client
  user_agent,    -- User-Agent header
  created_at     -- Timestamp
);
```

**Implémentation** :

```typescript
// server/routes.ts
async function createAuditLog(data: InsertAuditLog) {
  try {
    await storage.createAuditLog(data);
  } catch (error) {
    // Silently swallow: audit failure ne doit pas crash app
    logger.error({ err: error }, 'Audit log insert failed');
  }
}
```

### Table squad_audit_log

Historique précis des reassignments :

```sql
INSERT INTO squad_audit_log (
  participant_id,
  old_squad_id,    -- NULL si nouveau
  new_squad_id,    -- NULL si suppression
  reason,          -- e.g., "Transfert demande staff"
  changed_by,      -- Username
  changed_at       -- Timestamp
);
```

### Requêtes audit

**Voir tous les logins échoués** :

```sql
SELECT * FROM audit_logs
WHERE action = 'LOGIN_FAILED'
ORDER BY created_at DESC
LIMIT 50;
```

**Voir modifications participant** :

```sql
SELECT * FROM audit_logs
WHERE table_name = 'participants'
  AND record_id = 42
ORDER BY created_at DESC;
```

**Voir tous les achats d'un participant** :

```sql
SELECT * FROM audit_logs
WHERE table_name = 'purchases'
  AND payload->>'participantId' = '42'
ORDER BY created_at DESC;
```

## 7. Sécurité transport : HTTPS et Helmet

### Helmet : Headers de sécurité (Prod uniquement)

```typescript
// server/security-headers.ts
import helmet from 'helmet';

export function applySecurityHeaders(app: Express) {
  if (process.env.NODE_ENV === 'production') {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],  // React dev tools
          styleSrc: ["'self'", "'unsafe-inline'"],   // Inline Tailwind
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],     // WebSocket
        },
      },
      frameguard: { action: 'deny' },                // Clickjacking
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));
  }
}
```

**Headers appliqués** :
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (en HTTPS)
- `Content-Security-Policy` (custom)

### HTTPS en production

**Sur Raspberry Pi** : Utiliser reverse proxy (nginx) + Let's Encrypt :

```nginx
server {
  listen 443 ssl http2;
  server_name pi.local;

  ssl_certificate     /etc/letsencrypt/live/pi.local/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/pi.local/privkey.pem;

  location / {
    proxy_pass http://localhost:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }

  location /ws {
    proxy_pass http://localhost:5000/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## 8. Sécurité WebSocket : HMAC signing

### Token JWT signé

```typescript
// server/ws-token.ts
export function signDeviceToken(deviceId: string, secret: string): string {
  const payload = {
    deviceId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,  // 15 min
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64');

  return `${encoded}.${hmac}`;
}

export function verifyDeviceToken(token: string, secret: string): { valid: boolean; deviceId?: string } {
  try {
    const [encoded, signature] = token.split('.');
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(encoded)
      .digest('base64');

    if (hmac !== signature) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString());

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };  // Expiré
    }

    return { valid: true, deviceId: payload.deviceId };
  } catch {
    return { valid: false };
  }
}
```

**Signature** : HMAC-SHA256 (impossible de forger sans secret)

**TTL** : 15 minutes (balance sécurité / usabilité)

### WebSocket authentication flow

```
Client                     Server
  │                        │
  ├─ GET /api/sync/ws-token ──>
  │                        │
  │  (header: auth)        ├─ Verify session
  │                        ├─ Generate JWT HMAC
  │<─ { token: "..." } ──────
  │  (15 min TTL)          │
  │                        │
  ├─ WebSocket.connect ────>
  │ ws://pi/ws             │
  │                        │
  ├─ Message: register ────>
  │  { type: "register",   │
  │    token: "...",       │
  │    deviceId: "..." }   │
  │                        ├─ verifyDeviceToken()
  │                        ├─ Check expiration
  │                        ├─ Check signature
  │                        │
  │<─ OK authenticated ──────
  │  (client added to list)│
  │                        │
```

## 9. Checklist sécurité pré-événement

- [ ] `SESSION_SECRET` changé (ne pas utiliser default)
- [ ] `WEBSOCKET_SECRET` généré (`openssl rand -hex 32`)
- [ ] `QR_ENCRYPTION_KEY` généré
- [ ] SMTP credentials correctes (pas mot de passe réel Outlook)
- [ ] Admin password changé (> 12 chars, complexe)
- [ ] HTTPS activé sur proxy
- [ ] Rate-limiting vérifié en logs
- [ ] Audit logs stockés + accessible
- [ ] Backups chiffrés si stockés cloud
- [ ] Test login échoué → rate limit appliqué
- [ ] Test sync offline → authentification vérifie Device-ID

## 10. Historique sécurité (Vagues antérieures)

| Vague | Improvement | Impact |
|-------|-------------|--------|
| Vague 1 | Setup initial | Sessions en mémoire |
| Vague 2 | Password hashing SHA-256 | Weak, malléable |
| Vague 3 | Bcrypt upgrade | Strong, côté client continue SHA-256 |
| Vague 4 | Rate-limiting | Brute-force prevention |
| Vague 5 | Lazy migration SHA→Bcrypt, Roles JSONB normalization | Zero-downtime upgrade |

Cf. `todo.md` pour évolutions futures (2FA, session persistence, etc.).

---

**Voir aussi** :
- [03-authentification-roles.md](./03-authentification-roles.md) — Détails auth/rôles
- [04-synchronisation.md](./04-synchronisation.md) — WebSocket HMAC
- [05-sauvegardes-restauration.md](./05-sauvegardes-restauration.md) — Chiffrement backups
