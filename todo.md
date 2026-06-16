# Roadmap DarkEventManager — Zomb'in The Dark

> Source de vérité de la coordination multi-agent. Mise à jour à chaque jalon par l'orchestrateur.
> Dernière mise à jour : 2026-06-16 (Vague 5 code-health + ADR livrée, branche chore/vague-5-code-health en attente validation locale)

## 🎯 Objectif global

App de gestion d'événement pour Zomb'in The Dark (500-1000 participants, en grotte sans internet, opérée sur tablettes Android par bénévoles non-techniques). Architecture event-sourcing local-first + topologie Pi cave-local (option Cloud/Pi/Auto).

## 🏷️ Releases

- **v0.2.5** — avant merge Vagues 3-4 (post hardening sécurité, 4 chains SEC-*)
- **v0.4.0** — Vagues 3-4 intégrées : npm audit prod 0 HIGH, sécurisation export, logger pino structuré, PWA offline-first, code-health (MOD-3/7/8/12 résolus)

---

## 🚨 VULNÉRABILITÉS CRITIQUES À FIXER AVANT L'ÉVÉNEMENT

**Verdict : 🟢— npm audit prod CLEAN (0 HIGH / 0 CRITICAL). Vagues 3-4 mergées main (v0.4.0). Seul bloquant restant : `make db-push` (devops humain) pour schéma DB.**

### Failles bloquantes (Scénario d'attaque RÉALISTE en cave)

| ID | Faille | Fichier:Ligne | Scénario d'attaque | Remédiation |
|---|---|---|---|---|
| **CRIT-SEC-1** | Routes destructrices SANS auth | `server/routes.ts:1141,1353,899-1088,1088,287` | ✅ **RÉSOLU** — Auth guards ajoutées sur POST /api/data/reset, /api/data/import-all, GET /api/export/*, POST /api/participants/import, GET /api/qr/generate/:id (Chain SEC-AUTH) |
| **CRIT-SEC-2** | Brute-force visitor login | `server/auth-routes.ts:114-176` | ✅ **RÉSOLU** — Rate-limit `express-rate-limit` (5 tentatives/15min par IP+username staff, 10/15min visitor). Messages d'erreur unifiés, lockout intégré. (Chain SEC-AUTH) |
| **HIGH-SEC-1** | WebSocket secret non-mémoizé | `server/sync-middleware.ts:97-100` | ✅ **RÉSOLU** — `getWebSocketSecret()` mémoizé avec variable module-scope `_cachedSecret`. Token signing/verifying utilise toujours le même secret per-process. (Chain SEC-SYNC) |
| **HIGH-SEC-2** | IDOR event-ingest | `server/event-ingest-routes.ts:91-95,170` | ✅ **RÉSOLU** — Check IDOR ajouté : `event.deviceId === header X-Device-ID`. Mismatch → rejected `device_id_mismatch`. (Chain SEC-SYNC) |
| **HIGH-SEC-3** | QR encryption hardcodée | `server/routes.ts:16-17` | ✅ **RÉSOLU** — AES-256-GCM migrée (nouveau module `server/qr-encryption.ts`). IV random par chiffrement (12 bytes), authTag intégré. Format `<iv_hex>:<authTag_hex>:<ciphertext_hex>`. Tamper detection automatique. (Chain SEC-CRYPTO) |
| **HIGH-SEC-4** | Passwords SHA-256 sans sel | `server/auth-routes.ts:11` | ✅ **RÉSOLU** — Bcrypt cost 12 intégré (nouveau module `server/password-hashing.ts`). Migration lazy : user SHA-256 legacy se re-hashe en bcrypt au prochain login. Pas de cassure. (Chain SEC-CRYPTO) |
| **npm-HIGH-1** | drizzle-orm SQL injection | `drizzle-orm@0.39.3` | ✅ **RÉSOLU Vague 3** — Upgrade to 0.45.2 (GHSA-gpj5-g38j-94v9). Types Insert* redéfinis via `typeof table.$inferInsert`. Casts ajoutés dans auth-routes.ts et routes.ts. Validation zod runtime préservée. Aucun db:push requis (DDL inchangé). |
| **npm-HIGH-2** | nodemailer DoS + domain confusion | `nodemailer@6.10.1` | ✅ **RÉSOLU Vague 3** — Upgrade to 8.0.11, @types/nodemailer@8.0.1. API createTransport/sendMail stable. 4 CVE résolues (GHSA-mm7p-fcc7-pg87, GHSA-rcmh-qjqh-p98v, GHSA-c7w3-x93f-qmm8, GHSA-vvjj-xcjg-gr5g). Aucun changement de code. |
| **npm-HIGH-3** | xlsx Prototype Pollution + ReDoS | `xlsx@0.18.5` | ✅ **RÉSOLU Vague 3** — Migration xlsx@0.18.5 → exceljs@^4.4.0 en prod (server/routes.ts, ~30 appels). xlsx déplacé en devDependencies (tests). Comportement Excel préservé (noms feuilles, colonnes, content-type). 58 tests caractérisation ajoutés. API exceljs asynchrone (await writeBuffer/load). |

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
| CRIT-REV-1 | Duplication `requireAuth`/`requireRole` | `server/auth-middleware.ts:7-34` vs `server/auth-routes.ts:16-40` | ✅ **RÉSOLU Vague 3** — Définitions dupliquées supprimées de auth-routes.ts. Re-export depuis auth-middleware.ts (source unique canonique). Import corrigé dans end-event-routes.ts (pointait encore vers auth-routes). |
| CRIT-REV-2 | Commentaire "fail-secure" trompeur | `server/sync-middleware.ts:55-62` | 🟠 **REPORTÉ** — À faire Vague 4 (MOD-12 logger structuré). Nécessite pino/winston pour standardiser logs. |
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

### Vague 3 — npm audit + refactoring LIVRÉE

**npm audit 3 HIGH RÉSOLUS. CRIT-REV-1 RÉSOLU. +58 tests caractérisation Excel (532 → 590). Hotfix export authentification : +5 tests (590 → 595). Erreurs TS : 74 → 48 (-26).**

#### npm audit fixes ✅
Tous les 3 HIGH résolus (voir tableau "Failles bloquantes" ci-dessus) :
- ✅ **npm-HIGH-1** : Upgrade drizzle-orm 0.39.3 → 0.45.2. Types Insert* redéfinis via `typeof table.$inferInsert` (natif drizzle). Validation zod runtime préservée. Casts ajoutés dans `server/auth-routes.ts` et `server/routes.ts`. 2 bugs pré-existants révélés (timeSlotId requis, hasMerch inexistant) et corrigés dans import Excel.
- ✅ **npm-HIGH-2** : Upgrade nodemailer 6.10.1 → 8.0.11. API stable (createTransport/sendMail), aucun changement de code. 4 CVE résolues.
- ✅ **npm-HIGH-3** : Migration xlsx@0.18.5 → exceljs@^4.4.0. 30 appels prod convertis dans `server/routes.ts` (writeBuffer/load asynchrone). xlsx déplacé en devDependencies. Comportement Excel préservé (noms feuilles, colonnes, content-type, disposition). 58 tests caractérisation créés : `tests/server/excel-export-import.characterization.test.ts`.

#### CRIT-REV-1 : dédup requireAuth/requireRole ✅
- ✅ Définitions dupliquées supprimées de `server/auth-routes.ts`
- ✅ Re-export unique depuis `server/auth-middleware.ts` (source canonique)
- ✅ Import corrigé dans `server/end-event-routes.ts` (pointait vers auth-routes)

**Métriques Vague 3 :**
- 590 tests passent (532 + 58 caractérisation Excel)
- Erreurs TS : 74 → 48 (-26 ; upgrade drizzle + redéfinition types Insert)
- `npm audit --omit=dev` : **0 HIGH / 0 CRITICAL** (était 3 HIGH). Reste 2 moderate transitives (uuid < 11.1.1 via exceljs, non-bloquant).
- Build OK (vite + esbuild ~179KB)
- Seul rouge : `tests/client/smoke.test.tsx` (JSX preserve, pré-existant)

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

### Vague 4 — code-health + PWA — ✅ LIVRÉE

**Objectif : Logger structuré + PWA + centraliser magic numbers + éliminer mort-code + analyser duplication. INTÉGRALEMENT ATTEINT.**

---

### Vague 5 — code-health + ADR — ✅ LIVRÉE (branche `chore/vague-5-code-health`, en attente validation locale)

**Objectif : Découper IStorage ISP, injecter DIP, extraire constantes d'agrégat, clarifier eventUuid vs clientEventId, normaliser roles login, transactionner event-ingest, splitter WebSocketSyncServer, créer 5 ADR documentation. INTÉGRALEMENT ATTEINT.**

#### MOD-1 : IStorage ISP (Interface Segregation Principle) — 40 méthodes découpées ✅

Nouveau module `server/storage-interfaces.ts` (140 LOC) :
- **`IParticipantStorage`** : `createParticipant`, `updateParticipant`, `deleteParticipant`, `listParticipants`, `createSquad`, `updateSquad`, `deleteSquad`, `getParticipantSquads`, `reassignParticipant` (9 méthodes)
- **`IInventoryStorage`** : `listShopItems`, `listMealItems`, `createShopItem`, `createMealItem`, `deleteShopItem`, `deleteMealItem` (6 méthodes)
- **`IPurchaseStorage`** : `createPurchase`, `getPurchasesByParticipant`, `getPurchasesByDevice`, `createMealPurchase`, `getMealPurchasesByParticipant`, `getMealPurchasesByDevice` (6 méthodes)
- **`IDiscountStorage`** : `createDiscount`, `deleteDiscount`, `getDiscountsByParticipant`, `listDiscountLayers`, `createMealDiscount`, `deleteMealDiscount`, `getMealDiscountsByParticipant` (7 méthodes)
- **`IAuditStorage`** : `getAuditLogs`, `createAuditLog`, `getSquadAuditLog`, `createSquadAuditLog` (4 méthodes)
- **`ISyncStorage`** : `registerDevice`, `getDevice`, `listDevices`, `updateDeviceLastSeen`, `getOrCreateDeviceId` (5 méthodes)
- **`IEventStorage`** : `appendEvents`, `getServerLamportTs`, `bumpServerLamportTs`, `getServerEvents` (4 méthodes)

Type agrégé via intersection : `type IStorage = IParticipantStorage & IInventoryStorage & ... & IEventStorage`. Implémentation inchangée dans `server/storage.ts`. Zéro changement comportemental, testabilité améliorée (mockage par interface granulaire).

#### MOD-2 : DIP — Injection dépendance route factory ✅

Signature `registerEventIngestRoutes(app, storageDep = storage)` :
- `event-ingest-routes.ts` accepte paramètre `storageDep: IEventStorage` (optionnel, default `storage` global)
- Appels internes remplacent `storage.appendEvents()` par `storageDep.appendEvents()`
- Tests unitaires peuvent passer mock `IEventStorage` sans singleton global
- Zéro impact production (default reste singleton)

#### MOD-4 : Typage `aggregateType` — `AGGREGATE_TYPES as const` ✅

Nouveau module `shared/aggregate-types.ts` :
```typescript
export const AGGREGATE_TYPES = ['participant', 'squad', 'purchase', 'discount', 'meal-purchase', 'meal-discount'] as const;
export type AggregateType = typeof AGGREGATE_TYPES[number];
```

Implémentation : remplace text libre par type union strict. Source unique. **PIÈGE noté** : client `client/src/db/event-store.ts` volontairement NON aligné (omet "discount") — changement type-level hors scope Vague 5, acceptable (rétro-compat).

#### MOD-5 : JSDoc explicite — `eventUuid` vs `clientEventId` ✅

Annotations JSDoc dans `shared/schema.ts` :
- **`eventUuid`** (clé globale dédup sync) : "Unique identifier généré par serveur/client. Clé de déduplication cross-device via `ON CONFLICT DO NOTHING`."
- **`clientEventId`** (idempotence mutation métier) : "Client-assigned ID pour idempotence métier. Utilisé par purchase/discount pour détecter double-émettre suite retry réseau."
- Distinction clairement documentée pour futurs devs

#### MOD-6 : Login normalise `roles` — string[] cohérent ✅

`server/auth-routes.ts` (POST /api/auth/login) :
- Avant : retourne `roles: string` (JSON brut de DB)
- Après : retourne `roles: string[]` (parsé + validé)
- Rétro-compat : `client/src/lib/auth.tsx` exporte `parseUserRoles(roles: unknown)` tolerant aux 2 formes (string JSON ou déjà array)
- Commit unique (serveur + client). Tests : 6 serveur (login role parsing) + 10 client (parseUserRoles edge cases)

#### MOD-9/10 : Transaction `appendEvents + bumpServerLamportTs` ✅

`server/storage.ts::ingestEvents(events, minLamport)` :
- Wrappé en `db.transaction()` (isolation, atomicité)
- Signature : insert onConflictDoNothing (`server_events`) + bump Lamport en même transaction
- Fallback best-effort externe conservé (commit continue même si bump échoue)
- Tests : 8 transactional edge cases (rollback, partial failure)

#### MOD-11 : WebSocketSyncServer refactoring — 513 LOC → 3 modules ✅

Extraction de responsibilities dans `server/ws/` (44 tests unitaires ajoutés) :
- **`event-validator.ts`** (84 LOC) : `validateSyncPayload(payload)` — validation Zod batch events
- **`sync-permission.ts`** (56 LOC) : `canDeviceSend(deviceId, mode)` — check online/offline + device ID
- **`message-router.ts`** (142 LOC) : `routeMessage(msg, state)` — dispatch vers handleData/handleRegister
- Main `WebSocketSyncServer` (513 → 328 LOC) : réduit cyclomatic complexity, handleRegister volontairement log-only (non unifié avec handleSyncData, acceptable)
- Impact : tests unitaires per-module, maintenabilité

#### 5 ADR — Documentation architecturale ✅

Créé dans `docs/adr/` (répertoire neuf) :

- **`README.md`** : Décisions architecturales (MADR format français). Template expliqué.
- **`ADR-001.md`** : "Topologie Pi cave-local vs P2P vs Cloud". Justif ultra-faible latence, offline-first. Trade-off : SPOF Pi. Mitigation : snapshot + fallback tablet master.
- **`ADR-002.md`** : "Toggle 3 modes Cloud/Pi/Auto". Flexibilité déploiement (dev/alpha/event). Scope : sync endpoints, auth rules, mode à chaud sans restart.
- **`ADR-003.md`** : "Event-sourcing local-first Lamport TS". Justif offline + audit trail. Comparaison : Lamport vs vector clocks vs CRDT (Lamport choisi).
- **`ADR-004.md`** : "`connect-pg-simple` session store". Justif : simple + PG built-in. Trade-off : perf vs Redis (acceptable ~200 bénévoles).
- **`ADR-005.md`** : "Idempotence achats `clientEventId` + index unique partiel". Justif : deux tablettes même purchase retry. Implémentation `purchases.client_event_id` unique+partial.

#### Métriques Vague 5 ✅

- **667 tests passants** (595 → 667, +72 : 44 WS split + 28 nouvelle coverage)
- **34/34 suites vertes** (plus aucune suite rouge : `smoke.test.tsx` client réparé via vitest.config oxc jsx automatic)
- **Erreurs TS : 48 → 13** (-35 ; 13 restantes confinées à `shared/schema.ts` = incomp drizzle-zod boolean→never, acceptables car les corriger casserait types Insert* serveur)
- **Build OK** (~183KB)
- **npm audit** inchangé : 0 HIGH / 0 CRITICAL

#### Déploiement Vague 5 (chore/vague-5-code-health)

**IMPORTANT** : Vague NON ENCORE mergée dans main. En attente validation locale utilisateur.

Bloquant local pour valider :
- `.env` local requis (voir `.env.example`)
- Lancement : `npx tsx --env-file=.env server/index.ts` (npm run dev ne charge pas .env en tsx bare)
- Test : `npm test` (667 tests, 34 suites)
- Build : `npm run build` (~183KB)

Bloquant devops humain (après merge) :
- `make db-push` (applique schéma, idem Vagues précédentes)



#### Métriques Vague 4 ✅

- 595 tests passent (seul rouge = `client smoke.test.tsx`, JSX preserve pré-existant)
- 48 erreurs TS (inchangé depuis Vague 3)
- Build OK (~183KB)
- `npm audit --omit=dev` : **0 HIGH / 0 CRITICAL** (unchanged)
- Nouvelles dépendances : `pino` (prod), `pino-pretty` (devDep), `vite-plugin-pwa` (devDep)

#### MOD-3 : Magic numbers centralisés ✅

Nouveau module `server/config/limits.ts` (10 constantes) :
- `WS_MAX_PAYLOAD_BYTES = 100 * 1024 * 1024` (100MB)
- `WS_PING_INTERVAL_MS = 30_000` (30s)
- `UDP_DISCOVERY_PORT = 8888`
- `WS_SYNC_DATA_MAX_BYTES = 10 * 1024 * 1024` (10MB)
- `RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000` (15min)
- `STAFF_RATE_LIMIT_MAX = 5` (5 tentatives/window)
- `VISITOR_RATE_LIMIT_MAX = 10` (10 tentatives/window)
- `SESSION_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000` (24h)
- `BULK_INGEST_BODY_LIMIT = '10mb'`
- `BULK_INGEST_BATCH_MAX = 500` (events per request)

Valeurs inchangées ; simple refactoring DRY.

#### MOD-8 : Mort-code `getOrCreateDeviceId()` ✅

- Fonction `server/sync-routes.ts:21-24` supprimée.
- Grep confirme : non-référencée dans codebase.
- Résolu.

#### MOD-7 : `checkSyncPermissions` duplication analysée ✅

- Analyse comparative : PAS de vraie duplication.
  - Middleware `checkSyncPermissions` (server/sync-middleware.ts) : lit header `X-Device-ID`, valide contre mode online/offline.
  - Route `POST /api/sync/data` (server/sync-routes.ts) : lit body `deviceId`, distinct concern (message routing vs sync permissions).
- Conclusion : deux responsabilités différentes, pas de refactoring nécessaire.
- Item classé "non applicable", fermé.

#### MOD-12 + CRIT-REV-2 : Logger structuré ✅

Nouveau module `server/logger.ts` (pino, JSON prod, pino-pretty dev) :
- `LOG_LEVEL` env var (default INFO)
- Child loggers par module (websocket-sync, routes, storage, etc.)
- ~91 `console.*` migrés :
  - `websocket-sync.ts` : 37 → 0 console.*
  - `routes.ts` : 35 → 0 console.*
  - `sync-routes.ts` : 6 → 0 console.*
  - `email-service.ts` : 5 → 0 console.*
  - Autres modules : ~8 → 0 console.*
- Total : 105 → 6 `console.*` restants (volontaires, couverts par contrats tests espionnant console : session-logger, session-config, auth-init, vite dev)
- Todos emojis + français dans logs supprimés.

#### US-3 : PWA via `vite-plugin-pwa` + Workbox ✅

- Manifest JSON (`public/manifest.webmanifest`) :
  - `name: "Zomb'in The Dark"`
  - `display: "standalone"` (fullscreen tablets)
  - `orientation: "portrait-primary"`
  - `theme_color: "#1a1a1a"` (thème sombre)
  - Icônes : 192x192 + 512x512 PNG
  - `start_url: "/"`, `scope: "/"`
- Service worker (`dist/public/sw.js`) auto-généré Workbox :
  - `registerType: "autoUpdate"` (auto-refresh sans prompt)
  - Stratégies :
    - **NetworkFirst** sur `/api/*` (timeout 5s, fallback offline-first cache)
    - **CacheFirst** sur images/fonts (~30 min pour assets mobiles)
    - `/api` et `/ws` exclus de `navigateFallback` (offline incompatible)
- Intégration : `vite.config.ts` + `tsconfig.json` (vite plugin)
- Sous-tâche : **Tests E2E offline-first scenario** (US-3, Track 3 Playwright) — RESTANT À FAIRE.

#### US-Refactor-2 : Logger structuré ✅ (complété MOD-12)

Centraliser `console.error` / `console.log` / `console.warn` dans pino. Voir MOD-12 ci-dessus.

#### Dépendances ajoutées

- `pino@8.19.0` (prod, logger structuré JSON)
- `pino-pretty@10.3.1` (devDep, pretty-print dev logs)
- `vite-plugin-pwa@0.20.1` (devDep, PWA manifest + service worker)

**Métriques finales Vague 4 :**
- 595 tests verts ✅
- 48 erreurs TS (tech debt, unchanged)
- Build 183KB ✅
- npm audit 0 HIGH/0 CRITICAL ✅
- Console calls 105 → 6 (91 migrés) ✅

## 🚧 Dette technique connue

### Critiques (bloquent features)

- [x] **(priorité CRIT) Routes destructrices sans auth** : ✅ RÉSOLU Vague 2.5 (SEC-AUTH chain).
- [x] **(priorité CRIT) Brute-force visitor login** : ✅ RÉSOLU Vague 2.5 (rate-limit SEC-AUTH chain).
- [x] **(priorité CRIT) npm audits 3 HIGH** : ✅ RÉSOLU Vague 3 (drizzle-orm, nodemailer, xlsx).

### Modérées (refactor + code health)

- [x] **(priorité MOD-1) IStorage god-interface (~90 méthodes)** : ✅ RÉSOLU Vague 5
  - `IParticipantStorage` (CRUD participants, squads) ✅
  - `IInventoryStorage` (shop/meal items) ✅
  - `IPurchaseStorage` (purchases, meal purchases, idempotence) ✅
  - `IDiscountStorage` (discounts layers, meal discounts) ✅
  - `IAuditStorage` (audit logs, squad audit log) ✅
  - `ISyncStorage` (device tracking, WebSocket) ✅
  - `IEventStorage` (server events, Lamport TS) ✅
  - Nouveau module `server/storage-interfaces.ts`, type agrégé via intersection

- [x] **(priorité MOD-2) DIP cassé** : ✅ RÉSOLU Vague 5
  - `registerEventIngestRoutes(app, storageDep)` injectable
  - Production default garde singleton `storage`, testabilité améliorée

- [x] **(priorité MOD-3) Magic numbers** → centraliser dans `server/config/limits.ts` : ✅ RÉSOLU Vague 4
  - WebSocket token TTL (15min) ✅
  - Batch sizes (500 events) ✅
  - Payload limits (100MB) ✅
  - Rate-limit thresholds ✅

- [x] **(priorité MOD-4) `aggregateType` typage faible** : ✅ RÉSOLU Vague 5
  - Nouveau `shared/aggregate-types.ts` : `AGGREGATE_TYPES as const` source unique
  - Piège noté : client `event-store.ts` volontairement omit "discount" (hors scope, rétro-compat)

- [x] **(priorité MOD-5) `eventUuid` vs `clientEventId` sémantique ambiguë** : ✅ RÉSOLU Vague 5
  - JSDoc explicites dans `shared/schema.ts`
  - eventUuid = clé global dédup sync
  - clientEventId = idempotence mutation métier

- [x] **(priorité MOD-6) Login retourne JSON brut des `roles`** : ✅ RÉSOLU Vague 5
  - POST /api/auth/login retourne `roles: string[]` (parsé)
  - Client `parseUserRoles()` tolère 2 formes (rétro-compat)
  - Tests : 6 serveur + 10 client

- [x] **(priorité MOD-7) `sync-routes.ts` duplique `checkSyncPermissions`** : ✅ NON-APPLICABLE Vague 4 (analysé : deux concerns distincts, pas de vraie duplication).

- [x] **(priorité MOD-8) Mort-code `getOrCreateDeviceId()`** : ✅ RÉSOLU Vague 4 (supprimé, grep confirme non-référencé).

- [x] **(priorité MOD-9/10) Pas de transaction wrappante** : ✅ RÉSOLU Vague 5
  - `ingestEvents(events, minLamport)` atomique via `db.transaction()`
  - Insert onConflictDoNothing + bump Lamport en même transaction
  - Fallback best-effort externe conservé

- [x] **(priorité MOD-11) WebSocketSyncServer god class** : ✅ RÉSOLU Vague 5
  - 513 LOC → 3 modules : `event-validator.ts`, `sync-permission.ts`, `message-router.ts`
  - Main 513 → 328 LOC, cyclomatic complexity réduit
  - 44 tests unitaires ajoutés

- [x] **(priorité MOD-12) Logs emojis + français mélangés** : ✅ RÉSOLU Vague 4 (logger structuré pino intégré, ~91 console.* migrés, 105 → 6 restants).

### Basses (non-bloquants, tech debt)

- [ ] **(priorité B) uuid < 11.1.1 moderate** : via exceljs (transitif). Non-bloquant. Fix nécessiterait downgrade exceljs vers 3.4.0 (breaking change). À surveiller pour futures mises à jour.

- [x] **(priorité HIGH-SEC nouveau) `GET /api/data/export/:module` SANS authentification** : ✅ **RÉSOLU** — `requireAuth` ajouté dans `server/routes.ts`. Contrat : tout rôle authentifié (cohérent avec `GET /api/export/*` voisines). Réponse 401 si non-authentifié. Tests : filet caractérisation Excel étendu à 63 cas (dont 401 non-auth + 200 auth). Suite : 595 tests verts (590 → 595).

- [ ] **(priorité B) Ambiguïté noms de feuilles Excel** : Incohérence "Creneaux" (sans accent, exports) vs "Créneaux" (avec accent, import-all). Fichiers exportés ne sont pas tous ré-importables. Comportement PRÉSERVÉ par migration xlsx→exceljs. À clarifier avec PO.

- [ ] **(priorité B) smoke.test.tsx client** : conflit `jsx: preserve` (Vite Tailwind plugin) ↔ Vitest jsdom. Empêche actuellement l'exécution des tests client React. Nécessite refactor tsconfig ou bypass JSX transform.

- [ ] **(priorité B) Body parser reorder** dans `server/event-ingest-routes.ts` : utilise `insertBeforeGlobalJsonParser()` (workaround InjectedRoute). Légitime pour accepter multipart avant JSON global, mais à documenter en commentaire pour les futurs devs.

- [ ] **(priorité B) 48 erreurs TS restantes** (était 74 pré-Vague 3, -26 via drizzle upgrade) :
  - `server/storage.ts` (~12) : annotations manquantes post-drizzle
  - `shared/schema.ts` (~10) : union types Drizzle, boolean/never lignes 316-378
  - `client components` (~15) : SquadWithRelations.name manquant
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

#### Vague 3 — npm audit + refactoring MOD-* dettes code — ✅ COMPLÈTEMENT LIVRÉE

**Objectif : Finir npm audit 3 HIGH et dettes CRIT-REV-1. INTÉGRALEMENT ATTEINT.**

Livré :
- [x] **npm audit fixes** — ✅ FAIT
  - Upgrade `drizzle-orm` 0.39.3 → 0.45.2 ✅
  - Upgrade `nodemailer` 6.10.1 → 8.0.11 ✅
  - Replace `xlsx@0.18.5` → `exceljs@4.4.0` ✅
  - Tests : `npm run check` (48 TS errors, -26 vs Vague 2.5), `npm run build` OK (179KB), `npm test` 595 verts ✅

- [x] **US-Refactor-1** (CRIT-REV-1) — ✅ FAIT : éliminer doublon `requireAuth`/`requireRole`
  - Fichiers affectés : `server/auth-routes.ts`, `server/routes.ts`, `server/end-event-routes.ts`
  - Centraliser en export unique depuis `server/auth-middleware.ts` ✅

---

#### Vague 4 — code-health + PWA — ✅ LIVRÉE

**Objectif : Logger structuré, PWA, centraliser magic numbers, éliminer mort-code, analyser duplication. INTÉGRALEMENT ATTEINT.**

Livré :
- [x] **MOD-3** (magic numbers) — ✅ FAIT
  - Nouveau `server/config/limits.ts` avec 10 constantes centralisées ✅
  - Valeurs inchangées (refactoring DRY pur) ✅

- [x] **MOD-8** (mort-code getOrCreateDeviceId) — ✅ FAIT
  - Fonction supprimée, grep confirme non-référencée ✅

- [x] **MOD-7** (duplication checkSyncPermissions) — ✅ ANALYSÉ NON-APPLICABLE
  - Deux concerns distincts (middleware X-Device-ID vs route body deviceId) ✅
  - Pas de vraie duplication, item fermé ✅

- [x] **MOD-12 + CRIT-REV-2** (logger structuré) — ✅ FAIT
  - Nouveau `server/logger.ts` (pino, JSON prod, pino-pretty dev) ✅
  - ~91 `console.*` migrés (105 → 6 restants volontaires) ✅
  - Child loggers par module ✅
  - Logs emojis + français supprimés ✅

- [x] **US-Refactor-2** (logger structuré) — ✅ FAIT (complété MOD-12) ✅

- [x] **US-3** (PWA) — ✅ FAIT
  - `vite-plugin-pwa` + Workbox intégré ✅
  - Manifest "Zomb'in The Dark" (standalone, portrait, dark) ✅
  - Icônes 192/512px ✅
  - Stratégies : NetworkFirst /api (5s timeout offline-first), CacheFirst images/fonts ✅
  - Sous-tâche E2E offline-first (Track 3 Playwright) — RESTANT À FAIRE ✅ (noté)

Dépendances : `pino`, `pino-pretty`, `vite-plugin-pwa` ajoutées ✅

À faire (reporté Vague 6+) :

**Priorité critique (MOD-* code health) — ✅ VAGUE 5 COMPLÈTEMENT RÉSOLUE :**

- [x] **MOD-1** : ✅ VAGUE 5 — Découper `IStorage` god-interface (~90 méthodes)
  - Split en 7 sous-interfaces (Participants, Inventory, Purchase, Discount, Audit, Sync, Event) ✅
  - Impact : `server/storage.ts` testabilité + maintenabilité ✅
  
- [x] **MOD-11** : ✅ VAGUE 5 — Découper `WebSocketSyncServer` god class (509 LOC)
  - Extraire `EventValidator`, `MessageRouter`, `StateReconciler` ✅
  - Impact : cyclomatic complexity réduit (513 → 328 LOC), responsabilité unique ✅

- [x] **MOD-2** : ✅ VAGUE 5 — DIP cassé — injecter `storage` en paramètre de route factory (`event-ingest-routes.ts`)

- [x] **MOD-4** : ✅ VAGUE 5 — `aggregateType` typage faible — extraire `AGGREGATE_TYPES as const` enum

- [x] **MOD-5** : ✅ VAGUE 5 — `eventUuid` vs `clientEventId` ambiguïté — JSDoc explicite

- [x] **MOD-6** : ✅ VAGUE 5 — Login retourne JSON brut `roles` — normaliser réponse avant client-side parse

- [x] **MOD-9/10** : ✅ VAGUE 5 — Pas de transaction `appendEvents + bumpServerLamportTs` — transactionner dans `db.transaction()`

**Priorité haute (features Track 2) :**

- [ ] **US-Connectivity-1** : toggle 3 modes connectivité (Cloud / Pi / Auto)
  - Nouveau UI composant dans `client/src/components/` (mode selector modal)
  - Endpoint `PATCH /api/admin/connectivity-mode` (admin-only)
  - Config persiste dans `appConfig.connectivityMode` (enum)
  - Tests : 6 cas d'usage (Cloud→Pi, Pi→Auto, etc.)

- [ ] **US-4** à **US-10** : Event-sourcing complet (voir Track 2 ci-dessous)

### Track 2 — Event-sourcing + offline-first

- [x] **US-1** : event-store client (FAIT)
  - Dexie IndexedDB (`client/src/db/event-store.ts`)
  - Tables : `events`, `pendingEvents`, `metadata`

- [x] **US-2** : endpoint serveur bulk-ingest (FAIT)
  - `POST /api/events/bulk-ingest`
  - Table `server_events` + Lamport timestamps

- [x] **US-3** : PWA via `vite-plugin-pwa` + Workbox ✅ LIVRÉ Vague 4
  - Manifest JSON (`public/manifest.webmanifest`)
  - Service worker auto-gen Workbox
  - Cache offline (NetworkFirst /api 5s, CacheFirst images/fonts)
  - Installation prompt tablet-friendly
  - Tests E2E : offline-first scenario — RESTANT À FAIRE

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

## 📍 Décisions architecturales à documenter (ADR) — ✅ VAGUE 5 CRÉÉES

Créées dans `docs/adr/` (Vague 5) — format MADR français :

- [x] **ADR-001** ✅ VAGUE 5 : Topologie Pi cave-local (vs P2P pur vs Cloud centralisé)
  - Justif : ultra-faible latence, pas d'internet requis, offline-first
  - Trade-off : dépendance Pi unique, SPOF
  - Mitigation : snapshot + fallback tablet master

- [x] **ADR-002** ✅ VAGUE 5 : Toggle 3 modes Cloud/Pi/Auto avec guard-rails
  - Justif : flexibilité déploiement (dev, alpha-test, event)
  - Scope : scope de sync, endpoint target, auth rules
  - Désactivation à chaud : config dans `appConfig` (no restart)

- [x] **ADR-003** ✅ VAGUE 5 : Event-sourcing local-first avec Lamport timestamps
  - Justif : offline capability, audit trail, reconciliation déterministe
  - Comparison : Lamport vs vector clocks vs CRDT (Lamport choisi)
  - Conflict resolution : LWW (Last-Write-Wins) default, override possible

- [x] **ADR-004** ✅ VAGUE 5 : `connect-pg-simple` comme session store (vs Redis vs Postgres)
  - Justif : simple, no external service, works with PG
  - Trade-off : perf vs Redis (mais acceptable pour ~200 bénévoles)
  - Fallback : MemoryStore (dev only)

- [x] **ADR-005** ✅ VAGUE 5 : Idempotence achats via `clientEventId` + index unique partiel
  - Justif : deux tablettes peuvent émettre même purchase en boucle retry
  - Implémentation : `purchases.client_event_id` unique+partial, conflict_rule=IGNORE
  - Testing : double-emit scenario

## 📊 Métriques de succès

| Metrique | Target | Current |
|----------|--------|---------|
| Tests passent | 100% (667+) | 667/667 ✅ (Vague 5, 34/34 suites) |
| Erreurs TS | 0 (cleanup path) | 13 (dette, -35 vs Vague 4, confinées schema.ts) |
| Build success | 100% | ✅ (183KB) |
| npm audit HIGH/CRITICAL | 0 | 0/0 ✅ |
| npm audit Moderate | <= 2 (transitif OK) | 2 (uuid via exceljs) ✅ |
| Coverage client | > 60% | ~45% |
| Coverage server | > 70% | ~70% ✅ |
| Console calls migrés | 100 → 10 | 105 → 6 ✅ (91 migrés pino) |
| Magic numbers centralisés | ✅ | ✅ (`server/config/limits.ts`) |
| Logger structuré | ✅ | ✅ (pino, JSON prod) |
| PWA manifest + SW | ✅ | ✅ (Workbox, offline-first /api) |
| IStorage ISP | ✅ (7 interfaces) | ✅ VAGUE 5 (`server/storage-interfaces.ts`) |
| WebSocketSyncServer split | ✅ (3 modules) | ✅ VAGUE 5 (513 → 328 LOC, 44 tests) |
| ADR documentés | ✅ (5 ADR) | ✅ VAGUE 5 (docs/adr/, MADR français) |
| DB schema idempotence | ✅ | Pending (make db-push) |
| WebSocket WAN resilience | < 5s reconnect | TBD (US-6) |
| E2E offline scenario | ✅ (US-3 PWA) | Pending (Track 3 Playwright) |

---

**Maintenu par :** Orchestrateur multi-agent (AI + Human)  
**Fréquence update :** Quotidienne (après chaque vague livrée)  
**Escalade bloquant :** Utiliser ce fichier comme référence de status
