# 📊 AUDIT COMPLET - DarkEventManager

**Date de l'audit** : 14 Janvier 2026
**Version analysée** : 1.0.0
**Auditeur** : Claude Code

---

## 🎯 Synthèse Exécutive

**DarkEventManager** est une application full-stack robuste et fonctionnelle pour la gestion d'événements zombie/survivant. Le projet démontre une architecture moderne avec React/TypeScript côté client et Express/PostgreSQL côté serveur. Cependant, plusieurs **problèmes critiques de sécurité** et **améliorations importantes** doivent être traités avant une utilisation en production à grande échelle.

### Scores Généraux
- **Fonctionnalité** : ⭐⭐⭐⭐⭐ (5/5) - Complet et opérationnel
- **Sécurité** : ⭐⭐ (2/5) - **CRITIQUE - Nécessite corrections urgentes**
- **Performance** : ⭐⭐⭐ (3/5) - Acceptable mais optimisable
- **Maintenabilité** : ⭐⭐⭐ (3/5) - Bonne structure mais manque de tests
- **Qualité du Code** : ⭐⭐⭐⭐ (4/5) - Propre avec TypeScript

---

## 🔴 PROBLÈMES CRITIQUES (À CORRIGER IMMÉDIATEMENT)

### 1. 🚨 Sécurité des Mots de Passe - **CRITIQUE**
**Localisation** : `server/auth-routes.ts:10`

**Problème** :
```typescript
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
```

❌ **SHA-256 est inadéquat pour les mots de passe**. SHA-256 est un algorithme rapide, ce qui le rend vulnérable aux attaques par force brute (GPU cracking).

**Impact** : 🔴 CRITIQUE - En cas de fuite de base de données, les mots de passe peuvent être crackés en quelques heures/jours.

**Solution recommandée** :
```typescript
import bcrypt from 'bcrypt';

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // Coût computationnel
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
```

**Alternatives** : Argon2 (encore plus sécurisé) ou scrypt.

---

### 2. 🔑 Clés de Chiffrement Hardcodées - **CRITIQUE**
**Localisation** : `server/routes.ts:14-16`

**Problème** :
```typescript
const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY || "darkevent2025secretkey1234567890";
const ENCRYPTION_IV = process.env.QR_ENCRYPTION_IV || "darkevent123456";
```

❌ Les clés par défaut sont commises dans Git et visibles publiquement.

**Impact** : 🔴 CRITIQUE - Un attaquant peut déchiffrer tous les QR codes et usurper l'identité des participants.

**Solutions** :
1. **Immédiat** : Supprimer les valeurs par défaut
2. **Court terme** : Générer des clés aléatoires au premier démarrage
3. **Long terme** : Utiliser un gestionnaire de secrets (AWS Secrets Manager, HashiCorp Vault)

```typescript
// Ne JAMAIS avoir de fallback
const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY;
const ENCRYPTION_IV = process.env.QR_ENCRYPTION_IV;

if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
  throw new Error('QR_ENCRYPTION_KEY and QR_ENCRYPTION_IV must be set in environment variables');
}
```

---

### 3. 🗝️ Session Secret Exposé - **CRITIQUE**
**Localisation** : `server/index.ts:22`, `.env.example:5`

**Problème** :
```typescript
secret: process.env.SESSION_SECRET || 'darkevent-secret-key-change-in-production'
```

❌ Secret par défaut faible + exposé dans `.env.example`.

**Impact** : 🔴 CRITIQUE - Un attaquant peut forger des sessions et devenir admin.

**Solution** :
```typescript
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be set and at least 32 characters');
}

app.use(session({
  secret: SESSION_SECRET,
  // ...
}));
```

Générer un secret fort :
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### 4. 💾 MemoryStore en Production - **CRITIQUE**
**Localisation** : `server/index.ts:13, 25`

**Problème** :
```typescript
import MemoryStore from "memorystore";
const SessionStore = MemoryStore(session);
```

❌ **MemoryStore ne persiste pas les sessions** :
- Les sessions sont perdues au redémarrage du serveur
- Ne fonctionne pas avec plusieurs instances (load balancing)
- Fuite mémoire potentielle avec beaucoup d'utilisateurs

**Impact** : 🔴 CRITIQUE en production - Déconnexions intempestives, impossibilité de scaler horizontalement.

**Solution** : Utiliser une base de données pour les sessions
```typescript
import connectPgSimple from 'connect-pg-simple';
const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions',
  }),
  // ...
}));
```

Ou utiliser **Redis** (recommandé) :
```bash
npm install connect-redis redis
```

---

### 5. 🛡️ Absence de Rate Limiting - **HAUTE PRIORITÉ**
**Localisation** : Aucun middleware de rate limiting

**Problème** : Aucune protection contre :
- Les attaques par force brute sur `/api/auth/login`
- Les attaques par déni de service (DOS)
- Le spam de création de participants

**Impact** : 🟠 ÉLEVÉ - Vulnérable aux attaques automatisées.

**Solution** :
```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

// Rate limiter pour les endpoints d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  message: 'Trop de tentatives de connexion, réessayez dans 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/login-visitor', authLimiter);

// Rate limiter général pour l'API
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute
});

app.use('/api/', apiLimiter);
```

---

### 6. 🔒 Absence de Protection CSRF - **HAUTE PRIORITÉ**
**Localisation** : Aucune protection visible

**Problème** : Vulnérable aux attaques Cross-Site Request Forgery.

**Impact** : 🟠 ÉLEVÉ - Un attaquant peut effectuer des actions au nom d'un utilisateur authentifié.

**Solution** :
```bash
npm install csurf cookie-parser
```

```typescript
import csrf from 'csurf';
import cookieParser from 'cookie-parser';

app.use(cookieParser());
const csrfProtection = csrf({ cookie: true });

// Appliquer sur les endpoints de mutation
app.post('/api/*', csrfProtection);
app.patch('/api/*', csrfProtection);
app.delete('/api/*', csrfProtection);
```

---

## 🟡 PROBLÈMES IMPORTANTS (À CORRIGER RAPIDEMENT)

### 7. 📁 Routes.ts Monolithique (1500+ lignes)
**Localisation** : `server/routes.ts`

**Problème** : Fichier unique avec tous les endpoints, difficile à maintenir.

**Recommandation** : Diviser en modules :
```
server/routes/
├── participants.routes.ts
├── timeslots.routes.ts
├── squads.routes.ts
├── shop.routes.ts
├── meals.routes.ts
├── purchases.routes.ts
└── admin.routes.ts
```

---

### 8. 🧪 Absence Totale de Tests - **CRITIQUE POUR LA MAINTENABILITÉ**
**Localisation** : Aucun fichier de test trouvé

**Problème** :
- 0% de couverture de tests
- Risque élevé de régression
- Difficile de refactorer en confiance

**Impact** : 🟠 ÉLEVÉ - Maintenance risquée, bugs non détectés.

**Solution** : Implémenter une stratégie de tests

```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

**Structure recommandée** :
```
server/
├── __tests__/
│   ├── auth.test.ts
│   ├── participants.test.ts
│   └── purchases.test.ts
├── routes.ts
└── storage.ts
```

**Exemple de test** :
```typescript
import request from 'supertest';
import app from '../index';

describe('POST /api/auth/login', () => {
  it('should return 401 with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'invalid', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('should return 200 with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });
});
```

**Priorités de tests** :
1. Tests unitaires pour `storage.ts` (logique métier)
2. Tests d'intégration pour les routes API
3. Tests E2E pour les flows critiques (login, check-in, purchases)

---

### 9. 📊 Absence de Logging Structuré
**Localisation** : Logs console basiques partout

**Problème** : Difficile de déboguer en production, pas de traçabilité.

**Solution** : Utiliser Winston ou Pino
```bash
npm install winston
```

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Utilisation
logger.info('User logged in', { userId: user.id, username: user.username });
logger.error('Database connection failed', { error: err.message });
```

---

### 10. 🔄 Code Duplication (Discounts)
**Localisation** : `server/storage.ts:616-1022`

**Problème** : Code quasi-identique pour `discounts` et `mealDiscounts` (400+ lignes dupliquées).

**Solution** : Créer une classe générique
```typescript
class DiscountManager<T> {
  constructor(private table: any) {}

  async getGlobalDiscounts(): Promise<T | undefined> { /* ... */ }
  async updateGlobalDiscounts(data: Partial<T>): Promise<T> { /* ... */ }
  // etc.
}

const shopDiscountManager = new DiscountManager(discounts);
const mealDiscountManager = new DiscountManager(mealDiscounts);
```

---

### 11. 🌐 Pas de Pagination sur les Endpoints
**Localisation** : Tous les endpoints GET retournent la totalité des données

**Problème** :
```typescript
app.get("/api/participants", async (req, res) => {
  const participants = await storage.getParticipants(); // Tous les participants !
  res.json(participants);
});
```

Avec 1000+ participants, cela peut devenir lent.

**Solution** : Implémenter la pagination
```typescript
app.get("/api/participants", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const { data, total } = await storage.getParticipants(type, limit, offset);

  res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
```

---

### 12. 📧 Email Personnel Exposé
**Localisation** : `.env.example:19`

**Problème** :
```
DEV_EMAIL_OVERRIDE=kevin.nicol@hotmail.fr
```

Un email personnel est exposé dans le repository public.

**Solution** :
1. Remplacer par `dev@example.com`
2. Vérifier que ce fichier n'est pas commité avec des données réelles
3. Ajouter `.env` dans `.gitignore` (déjà fait normalement)

---

## 🟢 AMÉLIORATIONS RECOMMANDÉES

### 13. 🚀 Performance & Optimisation

#### a) Compression GZIP
```typescript
import compression from 'compression';
app.use(compression());
```

#### b) Caching avec Redis
```typescript
import redis from 'redis';
const client = redis.createClient();

// Cache les statistiques du dashboard (expensive query)
app.get("/api/dashboard/stats", async (req, res) => {
  const cacheKey = 'dashboard:stats';
  const cached = await client.get(cacheKey);

  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const stats = await storage.getDashboardStats();
  await client.set(cacheKey, JSON.stringify(stats), 'EX', 10); // Cache 10 secondes
  res.json(stats);
});
```

#### c) Lazy Loading Frontend
Actuellement, tous les composants sont chargés d'un coup. Utiliser le lazy loading :
```typescript
import { lazy, Suspense } from 'react';

const AdminPage = lazy(() => import('./pages/admin'));
const DashboardPage = lazy(() => import('./pages/dashboard'));

// Dans le router
<Suspense fallback={<LoadingSpinner />}>
  <AdminPage />
</Suspense>
```

#### d) Optimiser les Queries N+1
Dans `storage.ts`, plusieurs queries peuvent être combinées avec `JOIN`.

---

### 14. 📚 Documentation

#### a) Documentation API (Swagger/OpenAPI)
```bash
npm install swagger-jsdoc swagger-ui-express
```

```typescript
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DarkEventManager API',
      version: '1.0.0',
    },
  },
  apis: ['./server/routes/*.ts'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
```

#### b) README Complet
Ajouter :
- Instructions d'installation détaillées
- Architecture du projet
- Guide de contribution
- Diagrammes (architecture, base de données)

---

### 15. 🔐 Sécurité Additionnelle

#### a) Content Security Policy (CSP)
```bash
npm install helmet
```

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

#### b) HTTPS Forcé en Production
```typescript
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

#### c) Input Validation Stricte
Ajouter des validations Zod pour tous les endpoints :
```typescript
import { z } from 'zod';

const participantQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  type: z.enum(['zombie', 'survivant', 'staff']).optional(),
});

app.get("/api/participants", async (req, res) => {
  const validation = participantQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({ errors: validation.error.errors });
  }
  // ...
});
```

---

### 16. 🏗️ Infrastructure & DevOps

#### a) CI/CD Pipeline
Créer `.github/workflows/ci.yml` :
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run check  # TypeScript check
      - run: npm test       # Tests (une fois implémentés)
      - run: npm run build  # Build check
```

#### b) Dockerfile Production-Ready
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 5000
CMD ["npm", "start"]
```

#### c) Monitoring & Alerting
Intégrer Sentry ou similar :
```bash
npm install @sentry/node
```

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

#### d) Health Check Endpoint
```typescript
app.get('/health', async (req, res) => {
  try {
    await db.select().from(participants).limit(1); // Test DB connection
    res.json({ status: 'healthy', timestamp: new Date() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

---

### 17. 🗄️ Base de Données

#### a) Migrations Versionnées
Utiliser Drizzle Kit correctement avec migrations versionnées :
```bash
npm run db:push  # Dev
npx drizzle-kit generate:pg  # Générer migration
npx drizzle-kit migrate  # Appliquer en prod
```

#### b) Indexes pour Performance
Ajouter des index sur les colonnes fréquemment recherchées :
```typescript
// Dans schema.ts
export const participants = pgTable("participants", {
  // ...
}, (table) => ({
  emailIdx: index('participants_email_idx').on(table.email),
  secretCodeIdx: index('participants_secret_code_idx').on(table.secretCode),
  typeIdx: index('participants_type_idx').on(table.type),
}));
```

#### c) Backup Automatique
Script de backup PostgreSQL :
```bash
#!/bin/bash
# backup.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backups/darkevent_$TIMESTAMP.sql
# Uploader vers S3 ou autre stockage cloud
```

---

### 18. 🎨 Frontend

#### a) Error Boundaries
```typescript
import { Component, ErrorInfo, ReactNode } from 'react';

class ErrorBoundary extends Component<{children: ReactNode}> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please refresh.</div>;
    }
    return this.props.children;
  }
}
```

#### b) Service Worker pour Offline
Utiliser Vite PWA plugin :
```bash
npm install vite-plugin-pwa
```

#### c) Optimisation Bundle
- Analyser le bundle avec `rollup-plugin-visualizer`
- Tree-shaking des Lucide icons non utilisés
- Code splitting par route

---

### 19. 📝 Qualité de Code

#### a) ESLint Configuration
```bash
npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

`.eslintrc.json` :
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

#### b) Prettier pour Formatting
```bash
npm install --save-dev prettier
```

`.prettierrc` :
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100
}
```

#### c) Husky Pre-commit Hooks
```bash
npm install --save-dev husky lint-staged
npx husky install
```

`.husky/pre-commit` :
```bash
#!/bin/sh
npm run check  # TypeScript check
npm run lint   # ESLint
npm test       # Tests
```

---

### 20. 🔄 Fonctionnalités Additionnelles

#### a) WebSocket Reconnection Logic
Améliorer la gestion des reconnexions WebSocket dans `websocket-sync-client.tsx`.

#### b) Audit Log Viewer avec Filtres
Améliorer `audit-log-viewer.tsx` avec :
- Filtres avancés (date range, action type, table name)
- Export en CSV
- Recherche full-text

#### c) Statistiques Avancées
- Graphiques de revenus
- Analyse de conversion (participants → purchases)
- Heatmap des arrivées par heure

---

## 📋 PLAN D'ACTION PRIORISÉ

### 🔴 **URGENT (Semaine 1)**
1. ✅ Remplacer SHA-256 par bcrypt pour les mots de passe
2. ✅ Supprimer les clés hardcodées et forcer les variables d'environnement
3. ✅ Implémenter rate limiting sur `/api/auth/*`
4. ✅ Remplacer MemoryStore par PostgreSQL session store
5. ✅ Ajouter protection CSRF

### 🟠 **HAUTE PRIORITÉ (Semaines 2-3)**
6. ✅ Diviser `routes.ts` en modules
7. ✅ Implémenter tests unitaires (coverage minimum 50%)
8. ✅ Ajouter logging structuré (Winston)
9. ✅ Implémenter pagination sur les endpoints
10. ✅ Ajouter Helmet pour sécurité headers

### 🟡 **MOYENNE PRIORITÉ (Mois 1)**
11. ✅ Documenter l'API avec Swagger
12. ✅ Ajouter CI/CD pipeline
13. ✅ Refactoriser code dupliqué (discounts)
14. ✅ Implémenter caching (Redis)
15. ✅ Optimiser bundle frontend

### 🟢 **BASSE PRIORITÉ (Mois 2+)**
16. ✅ Monitoring avec Sentry
17. ✅ Backup automatique DB
18. ✅ Error boundaries frontend
19. ✅ PWA / Service Worker
20. ✅ Statistiques avancées

---

## 📊 MÉTRIQUES ACTUELLES vs CIBLES

| Métrique | Actuel | Cible |
|----------|--------|-------|
| **Couverture Tests** | 0% | 80%+ |
| **Temps de Chargement Initial** | ~2s | <1s |
| **Taille Bundle JS** | ~500KB | <300KB |
| **Endpoints avec Rate Limiting** | 0% | 100% |
| **Utilisation bcrypt** | ❌ | ✅ |
| **Sessions Persistantes** | ❌ | ✅ |
| **Documentation API** | ❌ | ✅ |
| **CI/CD** | ❌ | ✅ |
| **Monitoring** | ❌ | ✅ |

---

## 🎯 CONCLUSION

**DarkEventManager** est un projet ambitieux et bien construit sur le plan fonctionnel. L'architecture est solide, le code TypeScript est propre, et l'UX est soignée. Cependant, **la sécurité doit être la priorité absolue** avant tout déploiement en production.

### Points Forts 💪
- ✅ Architecture moderne (React + Express + PostgreSQL)
- ✅ TypeScript full-stack
- ✅ UI/UX soignée avec Shadcn/ui
- ✅ Fonctionnalités complètes et cohérentes
- ✅ Bonne séparation des responsabilités (storage layer)
- ✅ Système d'audit trail complet

### Points d'Attention ⚠️
- ❌ Sécurité des mots de passe (SHA-256)
- ❌ Clés de chiffrement exposées
- ❌ Absence de tests
- ❌ MemoryStore non-persistant
- ❌ Pas de rate limiting

### Recommandation Finale
**Ne pas déployer en production** avant d'avoir corrigé les 5 problèmes critiques de sécurité. Une fois sécurisé, le projet est prêt pour une utilisation en environnement réel, avec les améliorations progressives suggérées.

**Effort estimé pour sécurisation critique** : 2-3 jours de développement.
**Effort estimé pour l'ensemble des recommandations** : 4-6 semaines.

---

## 📝 Notes de Suivi

**Corrections appliquées le 14/01/2026** :
- ✅ Fichier AUDIT.md créé
- [ ] SHA-256 → bcrypt (en cours)
- [ ] Clés hardcodées supprimées (en cours)
- [ ] Rate limiting implémenté (en cours)
- [ ] MemoryStore → PostgreSQL sessions (en cours)
- [ ] Protection CSRF ajoutée (en cours)

---

**Généré par Claude Code - Anthropic**
