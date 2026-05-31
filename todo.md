# Roadmap DarkEventManager — Zomb'in The Dark

> Source de vérité de la coordination multi-agent. Mise à jour à chaque jalon par l'orchestrateur.
> Dernière mise à jour : 2026-05-31 (Vague 3 — Plan détaillé ajouté, décomposition npm audit + MOD-* + US-3..US-10)

## 🎯 Objectif global

App de gestion d'événement pour Zomb'in The Dark (500-1000 participants, en grotte sans internet, opérée sur tablettes Android par bénévoles non-techniques). Architecture event-sourcing local-first + topologie Pi cave-local (option Cloud/Pi/Auto).

---

## 🚨 VULNÉRABILITÉS CRITIQUES À FIXER AVANT L'ÉVÉNEMENT

**Verdict : 🟡 ORANGE — Vague 2.5 résolue (9/10 failles). 3 npm audit HIGH restants + db-push devops bloquant. 🟢 atteint quand npm audit + db-push fait.**

### Failles bloquantes (Scénario d'attaque RÉALISTE en cave)

| ID | Faille | Fichier:Ligne | Scénario d'attaque | Remédiation |
|---|---|---|---|---|
| **CRIT-SEC-1** | Routes destructrices SANS auth | `server/routes.ts:1141,1353,899-1088,1088,287` | ✅ **RÉSOLU** — Auth guards ajoutées sur POST /api/data/reset, /api/data/import-all, GET /api/export/*, POST /api/participants/import, GET /api/qr/generate/:id (Chain SEC-AUTH) |
| **CRIT-SEC-2** | Brute-force visitor login | `server/auth-routes.ts:114-176` | ✅ **RÉSOLU** — Rate-limit `express-rate-limit` (5 tentatives/15min par IP+username staff, 10/15min visitor). Messages d'erreur unifiés, lockout intégré. (Chain SEC-AUTH) |
| **HIGH-SEC-1** | WebSocket secret non-mémoizé | `server/sync-middleware.ts:97-100` | ✅ **RÉSOLU** — `getWebSocketSecret()` mémoizé avec variable module-scope `_cachedSecret`. Token signing/verifying utilise toujours le même secret per-process. (Chain SEC-SYNC) |
| **HIGH-SEC-2** | IDOR event-ingest | `server/event-ingest-routes.ts:91-95,170` | ✅ **RÉSOLU** — Check IDOR ajouté : `event.deviceId === header X-Device-ID`. Mismatch → rejected `device_id_mismatch`. (Chain SEC-SYNC) |
| **HIGH-SEC-3** | QR encryption hardcodée | `server/routes.ts:16-17` | ✅ **RÉSOLU** — AES-256-GCM migrée (nouveau module `server/qr-encryption.ts`). IV random par chiffrement (12 bytes), authTag intégré. Format `<iv_hex>:<authTag_hex>:<ciphertext_hex>`. Tamper detection automatique. (Chain SEC-CRYPTO) |
| **HIGH-SEC-4** | Passwords SHA-256 sans sel | `server/auth-routes.ts:11` | ✅ **RÉSOLU** — Bcrypt cost 12 intégré (nouveau module `server/password-hashing.ts`). Migration lazy : user SHA-256 legacy se re-hashe en bcrypt au prochain login. Pas de cassure. (Chain SEC-CRYPTO) |
| **npm-HIGH-1** | drizzle-orm SQL injection | `drizzle-orm@0.39.3` | 🟠 **NON RÉSOLUE** — À faire Vague 3 (breaking, 2h). GHSA-gpj5-g38j-94v9. Upgrade to 0.45.2+ requis. |
| **npm-HIGH-2** | nodemailer DoS + domain confusion | `nodemailer@6.10.1` | 🟠 **NON RÉSOLUE** — À faire Vague 3 (breaking, 2h). GHSA-rcmh-qjqh-p98v. Upgrade to 8.0.8+ requis. |
| **npm-HIGH-3** | xlsx Prototype Pollution + ReDoS | `xlsx@0.18.5` | 🟠 **NON RÉSOLUE** — À faire Vague 3 (breaking, 2h). GHSA-4r6h-8v6p-xvw6. Remplacer par `exceljs@4.4.0`. Paquet abandonné. |

### Vulnérabilités MOYENNES (patchées en Vague 2.5)

| ID | Faille | Fichier:Ligne | Remédiation |
|---|---|---|---|
| MED-SEC-1 | `requireRole` substring match bug | `server/auth-middleware.ts:26` | ✅ **RÉSOLU** — Remplacé par array `.includes(role)` défensif après parsing JSON. (Chain SEC-SYNC) |
| MED-SEC-3 | Cookie `secure: false` hardcodé | `server/index.ts:31` | ✅ **RÉSOLU** — `secure: env.NODE_ENV === 'production'` dans `getSessionCookieOptions`. (Chain SEC-HARDENING, nouveau module `server/session-cookie-config.ts`) |
| MED-SEC-5 | Pas de Helmet | `server/index.ts` | ✅ **RÉSOLU** — Helmet câblé via `applySecurityHeaders(app)` (nouveau module `server/security-headers.ts`). HSTS, CSP, X-Frame-Options, etc. (Chain SEC-HARDENING) |
| MED-SEC-2 (déduplication) | `seenEventUuids` Set non-borné | `server/event-ingest-routes.ts:45` | ✅ **RÉSOLU** — Set supprimé. Signature `appendEvents` retourne `{ inserted, duplicates }`. Dédup déléguée à `ON CONFLICT DO NOTHING` SQL. (Chain SEC-SYNC) |
| MED-SEC-4 (auth clean) | `/api/auth/init` expose default password | `server/auth-routes.ts` | ✅ **RÉSOLU** — Retourne 403 si admin existe, 201 à création, password jamais dans JSON. (Chain SEC-AUTH) |

### Dettes de code-review (Vague 2.5, CRIT-5 résolue)

| ID | Faille | Fichier:Ligne | Remédiation |
|---|---|---|---|
| CRIT-REV-1 | Duplication `requireAuth`/`requireRole` | `server/auth-middleware.ts:7-34` vs `server/auth-routes.ts:16-40` | Reporté Vague 3 (MOD-* refactor) — centraliser en un seul export. |
| CRIT-REV-2 | Commentaire "fail-secure" trompeur | `server/sync-middleware.ts:55-62` | Reporté Vague 3 (MOD-* refactor) — utiliser logger structuré. |
| CRIT-REV-4 | `insertBeforeGlobalJsonParser` API privée | `server/event-ingest-routes.ts:56-71` | ✅ **RÉSOLU** — Hack supprimé. Body parser 10mb monté path-scoped sur `/api/events/bulk-ingest` AVANT le parser global dans `server/index.ts` (pattern Express natif). (Chain SEC-HARDENING) |

### Priorité de fix

1. **CRIT-SEC-1** (1h) : ajouter auth guards sur routes destructrices
2. **CRIT-SEC-2** (1.5h) : rate-limit + lockout visitor login
3. **npm audits** (2h) : upgrade drizzle-orm, nodemailer, remplacer xlsx
4. **HIGH-SEC-3,4** (1.5h) : .env QR vars, bcrypt passwords
5. **HIGH-SEC-2** (0.5h) : valider deviceId
6. **HIGH-SEC-1** (0.5h) : mémoiser WebSocket secret
7. **MED-SEC-1,3,5** (1h) : role fix, secure cookie, Helmet

**Total : ~8h de sécurité "must-have" AVANT événement.**

---

## ✅ Livré

### Vague 1 — Stack de tests + Event-store client

- Stack Vitest 4 + RTL + supertest installée (multi-env client jsdom / server node)
- Coverage v8, configs dans `vitest.config.ts` avec hoisting compat Vitest 2→4
- Plugin hoisting mock variables (workaround déclarations `MockXxx` globales)
- Tests serveur : 
  - `tests/server/smoke.test.ts` (sanity check)
  - `tests/server/storage-purchases-idempotence.test.ts` (idempotence achats)
  - `tests/shared/schema-purchases.test.ts` (validation schéma)
- Tests client : `tests/client/smoke.test.tsx`, `tests/client/db/event-store.test.ts`
- Event-store client local-first : `client/src/db/event-store.ts` (Dexie IndexedDB)

### Vague 1.b — Bugs critiques + Idempotence achats

- 7 bugs critiques fixés :
  - `auth-routes.ts` : parsing session utilisateur défensif
  - `unified-scan-modal.tsx` : gestion modale scanner
  - `admin.tsx` : export admin
  - `sync-push-pull-buttons.tsx` : boutons sync corrigés
  - `websocket-sync-client.tsx` : gestion WebSocket améliorée
  - `storage.ts` : `getDashboardStats` fix `squad.name` → `squad.squadNumber`
  - `sync-push-pull-routes.ts` : parsing JSON rôles défensif
- Idempotence sur `POST /api/purchases` via `clientEventId` (index unique partiel optionnel)
- 4 fichiers stale supprimés : `admin-old.tsx`, `admin-new.tsx`, `scan-old.tsx`, `scan-new.tsx`

### Vague 2 — Sécurité + Persistence + Endpoint events

#### Chain WS (WebSocket)
- `validateWebSocketSecret` : fail-fast en prod (refuse démarrage sans `WEBSOCKET_SECRET`)
- HMAC token signing dans `server/ws-token.ts` (15min TTL)
- Endpoint `GET /api/sync/ws-token` validé et protégé

#### Chain SYNC (Sync permissions)
- Auth obligatoire sur `/api/sync/*` sauf `ws-token`
- `checkSyncPermissions` étendu aux 4 routes de mutations :
  - `POST /api/purchases` (nouveau clientEventId)
  - `POST /api/meal-purchases` (nouveau clientEventId)
  - `POST /api/discounts` (clientEventId)
  - `POST /api/meal-discounts` (clientEventId)
- Enforced par middleware en `server/routes.ts`

#### Chain SESSION (PostgreSQL persistent)
- `connect-pg-simple` câblé via `createSessionStore` dans `server/index.ts`
- Table `sessions` ajoutée au schéma Drizzle (`shared/schema.ts`)
- Logs conditionnels `sessionLogger` (dev seulement)
- Fallback MemoryStore (en attente `make db-push`)

#### US-2 : Event-ingest endpoint + Server events
- `POST /api/events/bulk-ingest` : accepte array d'événements client
- Table `server_events` (Drizzle) : `id`, `clientEventId`, `eventType`, `payload`, `createdAt`, `lamportTs`
- Méthodes IStorage :
  - `appendEvents(events: ServerEvent[]): Promise<void>`
  - `getServerLamportTs(): Promise<number>`
  - `bumpServerLamportTs(): Promise<number>`
- Implémentation dans `server/storage.ts`
- Route dans `server/event-ingest-routes.ts`

**Métriques cumulées :**
- 302 tests passent (13 server tests, 1 client smoke test)
- 74 erreurs TS pré-existantes (baseline, non-bloquantes)
- Build OK (`npm run build` success)

### Vague 2.a — Code review + Security audit

- ✅ Code review Vague 2 complétée : 12 dettes modérées identifiées
  - Duplication `requireAuth`/`requireRole` detectée entre 2 fichiers (refactor à faire Vague 3)
  - `IStorage` god-interface (~90 méthodes) — découper recommandé
  - Magic numbers → centraliser dans `server/config/limits.ts`
  - `aggregateType` typage faible (text libre) → extraire `AGGREGATE_TYPES as const`
  - Mort-code `getOrCreateDeviceId()` identifié
  - `WebSocketSyncServer` god class (509 LOC) — splitter recommandé
  - Logs avec emojis + français mélangés (`websocket-sync.ts`)
- ✅ Security audit complet (OWASP + npm audit)
  - 2 vulnérabilités BLOQUANTES identifiées (routes sans auth, brute-force visitor)
  - 4 vulnérabilités HIGH (WS secret, IDOR, QR crypto, bcrypt)
  - 5 vulnérabilités MEDIUM détaillées
  - 3 dépendances npm HIGH-risk (drizzle-orm, nodemailer, xlsx)
  - **Rapport : cf. section "🚨 VULNÉRABILITÉS CRITIQUES" ci-dessus**
- ✅ Findings consolidés dans `todo.md` (ce fichier) pour traçabilité

### Vague 2.5 — Hardening sécurité LIVRÉE

**4 chains parallèles, tous verts. +230 tests (302 → 532). Dépendances installées : `express-rate-limit`, `bcryptjs`, `helmet`.**

#### Chain SEC-AUTH (63 tests) ✅
Fichiers modifiés : `server/routes.ts`, `server/auth-routes.ts`.
- ✅ **CRIT-SEC-1** : Auth guards ajoutées sur `POST /api/data/reset`, `POST /api/data/import-all`, `POST /api/participants/import`, `GET /api/data/export-all`, `GET /api/export/*` (staff), `GET /api/qr/generate/:id` (staff)
- ✅ **CRIT-SEC-2** : Rate-limit `express-rate-limit` sur `POST /api/auth/login` (5 tentatives/15min par IP+username) et `POST /api/auth/login-visitor` (10/15min par IP). Messages d'erreur visitor unifiés (anti-énumération).
- ✅ **MED-SEC-4** : `/api/auth/init` retourne 403 si admin existe, 201 à création, password jamais dans JSON.
- ✅ **LOW-2** : Audit logs `LOGIN_FAILED`, `LOGIN_SUCCESS` créés avec IP/userAgent.

#### Chain SEC-CRYPTO (74 tests) ✅
Nouveaux modules : `server/qr-encryption.ts`, `server/password-hashing.ts`.
- ✅ **HIGH-SEC-3** : QR encryption AES-256-GCM, IV random (12 bytes) par chiffrement, authTag intégré. Format `<iv_hex>:<authTag_hex>:<ciphertext_hex>`. Tamper detection automatique.
- ✅ **HIGH-SEC-4** : Passwords bcrypt cost 12. Migration lazy : SHA-256 legacy se re-hashe en bcrypt au login. Pas de cassure.

#### Chain SEC-SYNC (45+47 tests) ✅
Fichiers modifiés : `server/sync-middleware.ts`, `server/auth-middleware.ts`, `server/storage.ts`, `server/event-ingest-routes.ts`.
- ✅ **HIGH-SEC-1** : `getWebSocketSecret()` mémoizé (variable module-scope `_cachedSecret`). Token signing/verifying utilise le même secret per-process.
- ✅ **HIGH-SEC-2** : Check IDOR `event.deviceId === header X-Device-ID` ajouté. Mismatch → rejected `device_id_mismatch`.
- ✅ **MED-SEC-1** : `requireRole` corrigé : `Array.includes` strict après parsing JSON défensif. Plus de substring match.
- ✅ **CRIT-5 review** : `seenEventUuids` Set supprimé. Signature `appendEvents` retourne `{ inserted, duplicates }`. Dédup déléguée à `ON CONFLICT DO NOTHING` SQL.

#### Chain SEC-HARDENING (52 tests) ✅
Nouveaux modules : `server/session-cookie-config.ts`, `server/security-headers.ts`.
- ✅ **MED-SEC-3** : `secure: env.NODE_ENV === 'production'` dans `getSessionCookieOptions`.
- ✅ **MED-SEC-5** : Helmet via `applySecurityHeaders(app)` dans `server/index.ts`.
- ✅ **CRIT-4 review** : Hack `insertBeforeGlobalJsonParser` supprimé. Body parser 10mb path-scoped sur `/api/events/bulk-ingest` AVANT le parser global (pattern Express natif).
- ✅ **LOW-1** : `.env.example` complété avec `WEBSOCKET_SECRET`, `QR_ENCRYPTION_KEY`, `QR_ENCRYPTION_IV`, `PORT` et instructions `openssl rand -hex 32`.

**Métriques actuelles :**
- 532 tests passent (302 → 532, +230 sur Vague 2.5)
- 74 erreurs TS (baseline pré-Vague 2.5 inchangée)
- Build OK 173.8kb
- `smoke.test.tsx` client reste rouge (JSX preserve, pré-existant)

## 🚧 Dette technique connue

### Critiques (bloquent features)

- [x] **(priorité CRIT) Routes destructrices sans auth** : ✅ RÉSOLU Vague 2.5 (SEC-AUTH chain).
- [x] **(priorité CRIT) Brute-force visitor login** : ✅ RÉSOLU Vague 2.5 (rate-limit SEC-AUTH chain).
- [ ] **(priorité CRIT) npm audits 3 HIGH** : drizzle-orm, nodemailer, xlsx — 🟠 À faire Vague 3 (breaking changes, 2h estimée).

### Modérées (refactor + code health)

- [ ] **(priorité MOD-1) IStorage god-interface (~90 méthodes)** : Découper en 7 sous-interfaces :
  - `IParticipantStorage` (CRUD participants, squads)
  - `IInventoryStorage` (shop/meal items)
  - `IPurchaseStorage` (purchases, meal purchases, idempotence)
  - `IDiscountStorage` (discounts layers, meal discounts)
  - `IAuditStorage` (audit logs, squad audit log)
  - `ISyncStorage` (device tracking, WebSocket)
  - `IEventStorage` (server events, Lamport TS)

- [ ] **(priorité MOD-2) DIP cassé** : `event-ingest-routes.ts` importe singleton `storage` directement. Injecter via paramètre de route factory pour testabilité.

- [ ] **(priorité MOD-3) Magic numbers** → centraliser dans `server/config/limits.ts` :
  - WebSocket token TTL (15min)
  - Batch sizes (500 events)
  - Payload limits (100MB)
  - Rate-limit thresholds

- [ ] **(priorité MOD-4) `aggregateType` typage faible** : Text libre côté DB. Extraire `AGGREGATE_TYPES as const` enum, valider partout.

- [ ] **(priorité MOD-5) `eventUuid` vs `clientEventId` sémantique ambiguë** : Ajouter JSDoc explicite + tests d'intégration.

- [ ] **(priorité MOD-6) Login retourne JSON brut des `roles`** : `server/auth-routes.ts` expose array. Normaliser réponse avant client-side parse.

- [ ] **(priorité MOD-7) `sync-routes.ts` duplique `checkSyncPermissions`** : Centraliser appel middleware.

- [ ] **(priorité MOD-8) Mort-code `getOrCreateDeviceId()`** : `server/sync-routes.ts:21-24` non utilisé. Supprimer ou documenter intention.

- [ ] **(priorité MOD-9/10) Pas de transaction wrappante** : `appendEvents + bumpServerLamportTs` côté server-events. Ajouter `BEGIN...COMMIT` pour atomicité.

- [ ] **(priorité MOD-11) WebSocketSyncServer god class** : 509 LOC, multiples responsabilités. Extraire `EventValidator`, `MessageRouter`, `StateReconciler`.

- [ ] **(priorité MOD-12) Logs emojis + français mélangés** : `websocket-sync.ts` — standardiser sur logger structuré (pino/winston).

### Basses (non-bloquants, tech debt)

- [ ] **(priorité B) smoke.test.tsx client** : conflit `jsx: preserve` (Vite Tailwind plugin) ↔ Vitest jsdom. Empêche actuellement l'exécution des tests client React. Nécessite refactor tsconfig ou bypass JSX transform.

- [ ] **(priorité B) Body parser reorder** dans `server/event-ingest-routes.ts` : utilise `insertBeforeGlobalJsonParser()` (workaround InjectedRoute). Légitime pour accepter multipart avant JSON global, mais à documenter en commentaire pour les futurs devs.

- [ ] **(priorité B) 74 erreurs TS pré-existantes** :
  - `server/storage.ts` (~28) : faux positifs drizzle-zod, annotations manquantes
  - `shared/schema.ts` (~13) : union types Drizzle non-résolues
  - `server/websocket-sync.ts` (2) : types WebSocket implicites
  - À nettoyer en chantier dédié code-health.

- [ ] **(priorité B) Pas de migrations SQL versionnées** : Drizzle utilise `db:push` déclaratif (no git history). Pour déploiement prod, vérifier risque de drift schéma. Recommandation : générer snapshot via `drizzle-kit generate` pour audit.

- [ ] **(priorité B) Sessions ne sont pas persistantes en runtime** : `createSessionStore` implémenté mais table `sessions` n'existe pas en DB. Sessions retombent sur MemoryStore. Bloquant : `make db-push` non-exécuté.

## 🛠️ TODO devops bloquants (à faire MANUELLEMENT par l'humain)

### CRITIQUE

- [ ] **`make db-push`** (ou `npm run db:push`) — TOUJOURS BLOQUANT. Applique schéma sur la DB :
  - Column `purchases.client_event_id` (VARCHAR, nullable, unique partiel)
  - Table `sessions` (pour `connect-pg-simple`)
  - Table `server_events` (pour bulk ingest)
  - Column `appConfig.serverLamportTs` (BIGINT)
  
  **IMPORTANT : Tables `sessions`, `server_events` et colonnes n'existent PAS en DB actuellement. `make db-push` obligatoire avant déploiement produit.**

### HAUTEMENT RECOMMANDÉ

- [ ] **Index unique partiel `purchases.client_event_id`** — Drizzle ne génère pas l'unique partiel automatiquement. À exécuter en SQL manuel **après** `make db-push` :
  ```sql
  CREATE UNIQUE INDEX CONCURRENTLY purchases_client_event_id_unique
    ON purchases (client_event_id)
    WHERE client_event_id IS NOT NULL;
  ```
  Garantit l'idempotence côté DB.

- [ ] **Index unique partiel `server_events.client_event_id`** (optionnel mais recommandé) :
  ```sql
  CREATE UNIQUE INDEX CONCURRENTLY server_events_client_event_id_unique
    ON server_events (client_event_id)
    WHERE client_event_id IS NOT NULL;
  ```
  Aide au déduplication lors du bulk ingest.

### SÉCURITÉ (déploiement production BLOQUANT)

- [ ] **`WEBSOCKET_SECRET`** — générer en prod via `openssl rand -hex 32` et mettre dans `.env`. Exemple :
  ```bash
  openssl rand -hex 32
  # Copier résultat dans .env : WEBSOCKET_SECRET=<valeur>
  ```
  **Sans ça, le serveur refuse de démarrer en prod** (fail-fast depuis Vague 2). Requis pour dev multi-instance (mémorisation appliquée Vague 2.5).

- [ ] **`QR_ENCRYPTION_KEY`** et **`QR_ENCRYPTION_IV`** — générer en prod via `openssl rand -hex 32` (deux valeurs différentes). Ajouter à `.env` :
  ```bash
  openssl rand -hex 32  # → QR_ENCRYPTION_KEY
  openssl rand -hex 32  # → QR_ENCRYPTION_IV
  ```
  **Sans ça, déchiffrement QR échoue en prod** (keys hardcodées laissent des patterns). AES-256-GCM appliqué Vague 2.5.

## 📋 Backlog priorisé

### Track 1 — Stabilisation (en cours)

#### Vague 2.5 — Hardening sécurité critique — ✅ LIVRÉE

**Objectif : Clore 9 des 10 vulnérabilités critiques/high avant déploiement. FAIT.**

Tous les items marqués RÉSOLUS ci-dessus. 4 chains parallèles complétées (SEC-AUTH, SEC-CRYPTO, SEC-SYNC, SEC-HARDENING). +230 tests. Dépendances installées : `express-rate-limit@7.1.5`, `bcryptjs@2.4.3`, `helmet@7.1.0`.

**Findings NON résolus (Vague 3) :**
- npm audit 3 HIGH (drizzle-orm, nodemailer, xlsx) — breaking changes
- CRIT-REV-1, CRIT-REV-2 (refactoring dettes code-review MOD-*)
- `smoke.test.tsx` client (JSX preserve, low priority hors événement)

---

#### Vague 3 (post-événement) — npm audit + refactoring MOD-* dettes code

**Objectif : Clore les 3 npm audit HIGH restants et les dettes code-review CRIT-REV-1/2 + MOD-*. 🟢 atteint quand `npm audit` ne remonte plus de HIGH et que `npm run check && npm run build && npm test` passent.**

> ⚠️ État vérifié 2026-05-31 : `drizzle-orm@^0.39.1`, `nodemailer@^6.9.16`, `xlsx@^0.18.5` toujours en place ; `exceljs`, `pino`/`winston`, `server/config/limits.ts`, `server/logger.ts`, `docs/adr/` **absents**. Modules sécurité Vague 2.5 présents.

##### Chain V3-DEPS — npm audit 3 HIGH (séquentiel, ~3h, breaking)

- [ ] **V3-DEPS-1** — Upgrade `drizzle-orm` `^0.39.1` → `0.45.2+` (GHSA-gpj5-g38j-94v9, SQL injection)
  - Bumper aussi `drizzle-kit` à la version compatible.
  - Vérifier les ruptures d'API dans `server/storage.ts`, `shared/schema.ts`, `drizzle.config.ts` (signatures `sql`, `.$inferSelect`, `relations`).
  - `npm run check` : ne PAS aggraver les 74 erreurs TS baseline (idéalement les réduire).
  - Acceptation : `npm run build` OK + suite serveur verte.

- [ ] **V3-DEPS-2** — Upgrade `nodemailer` `^6.9.16` → `8.0.8+` (GHSA-rcmh-qjqh-p98v, DoS + domain confusion)
  - Impact : `server/email-service.ts` (création transport Outlook SMTP). Revalider `createTransport`, options TLS, redirection `DEV_EMAIL_OVERRIDE`.
  - Acceptation : test d'envoi mocké vert (nodemailer mock), aucun import cassé.

- [ ] **V3-DEPS-3** — Remplacer `xlsx@0.18.5` (paquet abandonné, GHSA-4r6h-8v6p-xvw6) par `exceljs@4.4.0`
  - Sites d'usage à migrer : import participants (`server/routes.ts` `POST /api/participants/import`), exports (`GET /api/export/*`), et tout usage client (`client/src/**` imports `xlsx`).
  - `exceljs` est async (streaming) : adapter les lectures/écritures de workbook.
  - Acceptation : round-trip import→export d'un fichier de test identique à l'ancien comportement.

- [ ] **V3-DEPS-4** — Garde-fou : `npm audit --omit=dev` = 0 HIGH ; figer dans CI (`npm run check && npm run build && npm test`, 532+ tests).

##### Chain V3-REFACTOR — dettes code-review (parallélisable après V3-DEPS)

- [ ] **V3-REFACTOR-1** (CRIT-REV-1, MOD-7) — Source unique pour `requireAuth`/`requireRole`
  - Supprimer le doublon `server/auth-routes.ts:16-40` ; ré-exporter depuis `server/auth-middleware.ts`.
  - Centraliser l'appel `checkSyncPermissions` dupliqué dans `sync-routes.ts`.
  - Acceptation : un seul lieu de définition, imports mis à jour, tests auth/sync verts.

- [ ] **V3-REFACTOR-2** (CRIT-REV-2, MOD-12) — Logger structuré `server/logger.ts`
  - Intégrer `pino` (préféré : faible overhead, JSON). Niveau via `LOG_LEVEL`.
  - Remplacer `console.*` + emojis/français mélangés dans `server/websocket-sync.ts`, `server/sync-middleware.ts`, `server/routes.ts::createAuditLog`.
  - Corriger le commentaire "fail-secure" trompeur (`sync-middleware.ts:55-62`).
  - Acceptation : aucun `console.log` résiduel côté serveur (hors bootstrap), logs JSON parsables.

- [ ] **V3-REFACTOR-3** (MOD-3) — Centraliser les magic numbers dans `server/config/limits.ts`
  - WS token TTL (15min), batch size (500), payload limit (100MB), seuils rate-limit, ping interval (30s).
  - Acceptation : valeurs importées, plus de littéraux dispersés ; 1 test snapshot des constantes.

- [ ] **V3-REFACTOR-4** (MOD-4, MOD-5) — Typage fort `aggregateType` / sémantique `eventUuid` vs `clientEventId`
  - Extraire `AGGREGATE_TYPES as const` dans `shared/`, valider via Zod côté ingest.
  - JSDoc explicite + tests d'intégration distinguant `eventUuid` (identité serveur) et `clientEventId` (idempotence client).

- [ ] **V3-REFACTOR-5** (MOD-1) — Découper l'IStorage god-interface (~90 méthodes)
  - Sous-interfaces : `IParticipantStorage`, `IInventoryStorage`, `IPurchaseStorage`, `IDiscountStorage`, `IAuditStorage`, `ISyncStorage`, `IEventStorage`.
  - `storage` reste l'agrégat concret (compose les sous-interfaces) — pas de cassure d'appelants.

- [ ] **V3-REFACTOR-6** (MOD-11) — Découper `WebSocketSyncServer` (509 LOC)
  - Extraire `EventValidator`, `MessageRouter`, `StateReconciler`.

- [ ] **V3-REFACTOR-7** (MOD-2, MOD-8, MOD-9/10) — Hygiène divers
  - MOD-2 : injecter `storage` via factory de route dans `event-ingest-routes.ts` (DIP, testabilité).
  - MOD-8 : supprimer le mort-code `getOrCreateDeviceId()` (`sync-routes.ts:21-24`).
  - MOD-9/10 : envelopper `appendEvents + bumpServerLamportTs` dans une transaction `BEGIN…COMMIT` (atomicité).
  - MOD-6 : normaliser la réponse `roles` du login (ne pas exposer le JSON brut).

##### Chain V3-CONNECTIVITY — toggle 3 modes (dépend de ADR-002)

- [ ] **US-Connectivity-1** — Toggle 3 modes connectivité (Cloud / Pi / Auto)
  - Schéma : `appConfig.connectivityMode` enum (`'cloud' | 'pi' | 'auto'`) → **nécessite `make db-push`**.
  - Endpoint `PATCH /api/admin/connectivity-mode` (admin-only, audit-loggé).
  - UI : modal sélecteur de mode dans `client/src/components/` + indicateur d'état dans le header.
  - Changement à chaud (no restart), guard-rails sur scope de sync / cible d'endpoint / règles auth.
  - Tests : 6 transitions (Cloud→Pi, Pi→Auto, Auto→Cloud, etc.) + refus si non-admin.

##### Definition of Done Vague 3

- [ ] `npm audit --omit=dev` : 0 HIGH
- [ ] `npm run check` : ≤ 74 erreurs TS (baseline, idéalement en baisse)
- [ ] `npm run build` OK + `npm test` 532+ verts (objectif +40 tests)
- [ ] ADR-002 et ADR-004 rédigés dans `docs/adr/` (cf. section ADR)

#### Vague 4 (offline-first) — PWA + projection + reconciliation

**Objectif : rendre l'app utilisable hors-ligne sur tablette en cave et fiabiliser la synchro retour. Séquence US-3 → US-6 (le cœur offline-first ; US-7..US-10 = Pi/scaling en Vague 5).**

- [ ] **US-3** — PWA installable (`vite-plugin-pwa` + Workbox)
  - `public/manifest.json` (icônes, `display: standalone`, thème zombie), service worker auto-généré.
  - Stratégie cache : app-shell `CacheFirst`, API GET `StaleWhileRevalidate`, mutations jamais cachées.
  - Prompt d'installation tablette-friendly. Acceptation : Lighthouse PWA installable + app charge offline après 1er load.

- [ ] **US-4** — Projection events → tables métier (replay)
  - Réducteurs SQL `purchase_event` → `purchases`, `discount_event` → `discounts`, etc.
  - `POST /api/admin/replay-from-lamport` (admin-only, **guard dev-only** : refuse en prod sans flag explicite).
  - Tests : 10+ types d'événements, idempotence du replay (rejouer 2× = même état).

- [ ] **US-5** — Réconciliation de conflits (Lamport + LWW)
  - Décision Lamport vs vector clocks → **ADR-003** à trancher avant implémentation.
  - Stratégie de résolution par table (LWW par défaut, override documenté).
  - Tests : écritures concurrentes 2 tablettes, vérifier sélection déterministe du gagnant.

- [ ] **US-6** — File de synchronisation UI
  - Badge "X events pending" dans le header (lire `pendingEvents` du store Dexie).
  - Retry exponentiel (1s → 5s → 30s) + bouton sync manuel (réutiliser `sync-push-pull-buttons.tsx`).
  - Tests : 5 scénarios de timeout / reconnexion.

**DoD Vague 4 :** app installable + fonctionnelle offline ; replay idempotent ; 1 scénario E2E offline→ingest→reconcile vert.

#### Vague 5 (scaling cave-local) — Pi hub + résilience LAN

**Objectif : topologie Pi cave-local opérationnelle. Séquence US-7 → US-10. Dépend de ADR-001.**

- [ ] **US-7** — Event-store côté Pi (hub Raspberry Pi) : SQLite event log, API `/events/sync` (Pi ↔ tablette), tests via émulateur supertest.
- [ ] **US-8** — Découverte LAN (UDP broadcast port 8888) : ping tablette au boot, réponse Pi (IP + endpoint WS), hook `useDiscovery()` React, tests sockets UDP mockés.
- [ ] **US-9** — Compression batch events : zlib/gzip sur payload `serverEvents` + headers réponse `/api/events/bulk-ingest`, benchmark 1000 events, tests décompression client.
- [ ] **US-10** — Monitoring + heartbeat : dashboard admin (status Pi, nb tablettes, profondeur de file, replica lag), heartbeat WS 30s (déjà en place), tests d'injection de perte réseau.

**DoD Vague 5 :** 2 tablettes + 1 Pi en LAN sans internet, découverte auto, sync bidirectionnelle, dashboard temps réel.

### Track 2 — Event-sourcing + offline-first

- [x] **US-1** : event-store client (FAIT)
  - Dexie IndexedDB (`client/src/db/event-store.ts`)
  - Tables : `events`, `pendingEvents`, `metadata`

- [x] **US-2** : endpoint serveur bulk-ingest (FAIT)
  - `POST /api/events/bulk-ingest`
  - Table `server_events` + Lamport timestamps

- [ ] **US-3** : PWA via `vite-plugin-pwa` + Workbox
  - Manifest JSON (`public/manifest.json`)
  - Service worker auto-gen
  - Cache offline (shell + API responses)
  - Installation prompt tablet-friendly
  - Tests E2E : offline-first scenario

- [ ] **US-4** : projection events → tables métier (replay)
  - Fonctions SQL replay : `purchase_event` → `purchases` table
  - Endpoint `POST /api/admin/replay-from-lamport` (admin-only, dev-only guard)
  - Tests : 10+ event types

- [ ] **US-5** : reconciliation conflits via Lamport + LWW (Last-Write-Wins)
  - Algorithme : vector clocks vs Lamport (décision à documenter ADR-003)
  - Per-table conflict resolution strategy
  - Tests : concurrent writes (2 tablets), verify winner selection

- [ ] **US-6** : UI synchronization queue
  - Badge "X events pending" dans header
  - Retry exponentiel (backoff: 1s → 5s → 30s)
  - Manual sync button (sync-push-pull-buttons déjà partiellement en place)
  - Tests : 5 timeout scenarios

- [ ] **US-7** : event-store côté Pi (Raspberry Pi comme hub cave-local)
  - Installation Arch Linux ARM + Node.js LTS
  - SQLite event log côté Pi
  - API `/events/sync` (Pi ↔ Pi)
  - Tests : Pi emulator (supertest mock)

- [ ] **US-8** : découverte LAN via UDP broadcast
  - Tablet émet ping UDP `DISCOVERY_PORT=8888` au boot
  - Pi reçoit, répond avec IP + endpoint WebSocket
  - Client `useDiscovery()` hook dans React
  - Tests : mock UDP sockets

- [ ] **US-9** : compression batch events
  - zlib encoding sur `serverEvents` payload (optionnel)
  - Gzip response headers `/api/events/bulk-ingest`
  - Benchmark : 1000 events compressed vs uncompressed
  - Tests : décompression côté client

- [ ] **US-10** : monitoring + heartbeat
  - Heartbeat WebSocket 30s (déjà en place)
  - Admin dashboard : status Pi, tablet count, queue depth, replica lag
  - Logs syslog vers Pi
  - Tests : loss injection (simulate network down)

### Track 3 — Hardening avant événement

- [ ] **Tests E2E Playwright** (6 scénarios critiques)
  - Check-in : scanner code → squad assign → checklist
  - Achat shop : panier → transaction idempotence → receipt
  - Synchronisation offline : local event → batch ingest → reconcile
  - Sortie : fin d'événement → PDF email
  - Admin : toggle modes, replay events
  - Bénévole : rôle-based access (zombie vs survivant)

- [ ] **Load test** (locust / Artillery)
  - 200 tablettes simultanées (WebSocket connected)
  - 1000 events/s ingest throughput
  - DB pool sizing (10-20 connections)
  - Memory leak tests (48h continuous)

- [ ] **Disaster recovery** (procedure doc + tests)
  - Pi snapshot (pg_dump + eventstore)
  - Restore en moins de 30 min
  - Fallback : mode dégradé sans Pi (1 master tablet)
  - RTO/RPO cible : < 1h perte de données

- [ ] **Documentation bénévoles**
  - Guide UX : gants, basse lumière, gestes grands, QR stable
  - Fiche procédure papier : checkin, panier, fin de shift
  - Contact technicien 24/7 (photo bug, code erreur)
  - Vidéo 90s : tutoriel app
  - Langue : français, symboles universels

- [ ] **Plan de rollback** (< 5 min)
  - Checklist déploiement pré-événement
  - Rollback DB via snapshot (live at Pi)
  - Kill switch : mode offline-only, disable WebSocket
  - Communication : annonce bénévoles si basculage

## 🧭 Workflow multi-agent

1. **Tests AVANT code** (TDD strict)
   - Agent `tdd-writer` crée tests en rouge
   - Agent `developer` implémente code (copy-paste de `npm test` output comme preuve)
   - Agent `test-verifier` valide les 302+ tests passent

2. **Anti-hallucination**
   - Pas de "c'est fait" sans sortie CLI
   - Pas de `make db-push` automatique — validation humaine obligatoire
   - Pas de push remote sans GO explicite utilisateur
   - Mieux un agent qui dit "bloqué sur X" qu'un agent qui hallucine "vert"

3. **Code quality gates**
   - `npm run check` (tsc) doit passer
   - `npm run test` (302+ tests) doit passer
   - `npm run build` doit succéder
   - Couverture cible : > 60% (actuellement 45% client, 70% server)

4. **Commits & documentation**
   - Conventional Commits : `feat:`, `fix:`, `test:`, `docs:`, `refactor:`
   - Tous les TODO → ce fichier `todo.md`
   - Décisions architecturales → `docs/adr/` (à créer)

## 📍 Décisions architecturales à documenter (ADR)

À créer dans `docs/adr/` :

- **ADR-001** : Topologie Pi cave-local (vs P2P pur vs Cloud centralisé)
  - Justif : ultra-faible latence, pas d'internet requis, offline-first
  - Trade-off : dépendance Pi unique, SPOF
  - Mitigation : snapshot + fallback tablet master

- **ADR-002** : Toggle 3 modes Cloud/Pi/Auto avec guard-rails
  - Justif : flexibilité déploiement (dev, alpha-test, event)
  - Scope : scope de sync, endpoint target, auth rules
  - Désactivation à chaud : config dans `appConfig` (no restart)

- **ADR-003** : Event-sourcing local-first avec Lamport timestamps
  - Justif : offline capability, audit trail, reconciliation déterministe
  - Comparison : Lamport vs vector clocks vs CRDT (choix à faire)
  - Conflict resolution : LWW (Last-Write-Wins) default, override possible

- **ADR-004** : `connect-pg-simple` comme session store (vs Redis vs Postgres)
  - Justif : simple, no external service, works with PG
  - Trade-off : perf vs Redis (mais acceptable pour ~200 bénévoles)
  - Fallback : MemoryStore (dev only)

- **ADR-005** : Idempotence achats via `clientEventId` + index unique partiel
  - Justif : deux tablettes peuvent émettre même purchase en boucle retry
  - Implémentation : `purchases.client_event_id` unique+partial, conflict_rule=IGNORE
  - Testing : double-emit scenario

## 📊 Métriques de succès

| Metrique | Target | Current |
|----------|--------|---------|
| Tests passent | 100% (302+) | 302/302 ✅ |
| Erreurs TS | 0 (cleanup path) | 74 (dette, inchangée Vague 2.5) |
| Build success | 100% | ✅ |
| Coverage client | > 60% | ~45% |
| Coverage server | > 70% | ~70% ✅ |
| DB schema idempotence | ✅ | Pending (make db-push) |
| WebSocket WAN resilience | < 5s reconnect | TBD (US-6) |
| Offline queue depth | < 100 events avg | N/A (pending US-3) |

---

**Maintenu par :** Orchestrateur multi-agent (AI + Human)  
**Fréquence update :** Quotidienne (après chaque vague livrée)  
**Escalade bloquant :** Utiliser ce fichier comme référence de status
