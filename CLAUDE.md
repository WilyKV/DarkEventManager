# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**DarkEventManager** (package `rest-express`) — Zomb'in The Dark, an event management app for a zombie-themed gathering. Monorepo with React + Express + Drizzle, deployed on single port (5000). Supports offline-mode device sync via WebSocket and HMAC tokens.

## Common Commands

**Make targets (preferred — runs inside Docker Compose via `.docker/docker-compose.yml`):**
- `make up` / `make down` / `make restart` / `make logs` — manage containers
- `make build` — rebuild Docker images with `--no-cache`
- `make start` — full reset: `down` + `build` + `up` + `db-push`
- `make install` — `npm install` inside app container
- `make npm-install PACKAGES="<pkg>"` and `make npm-install-dev PACKAGES="<pkg>"` — install npm packages via Docker (avoids Windows/WSL UNC issues)
- `make db-push` — apply Drizzle schema to DB
- `make exec` — open shell in app container
- `make clean` — `down` + remove volumes (destroys DB)

**npm scripts (`package.json`):**
- `npm run dev` — `NODE_ENV=development tsx server/index.ts` (Express + Vite middleware, port 5000)
- `npm run build` — `vite build` client → `dist/public`, then `esbuild` server → `dist/index.js`
- `npm start` — production: `node dist/index.js`
- `npm run check` — `tsc` (typecheck only, `noEmit`)
- `npm run db:push` — `drizzle-kit push` (declarative schema push; no migration files)
- `npm run migrate:roles` — one-off `tsx server/migrations/migrate-roles.ts` (legacy string roles → JSONB array)

**Ports:** App: `http://localhost:5000` (API + SPA). Postgres: host `5434` → container `5432`.

**Testing (Vitest + RTL + supertest) :**
- `npm test` / `npm run test:watch` / `npm run test:coverage` — lancer les tests (Vitest)
- `npm run test:ui` — interface graphique Vitest dans le navigateur
- Via Docker : `docker-compose -f .docker/docker-compose.yml exec app npm test`
- `tests/client/` → jsdom (React Testing Library), `tests/server/` → Node (supertest)
- Couverture générée dans `coverage/` (exclu du dépôt).

## Architecture

**Monorepo (3 TS roots, type-checked together via `tsconfig.json`):**
- `client/` — React 18 SPA, Vite root, builds to `dist/public`
- `server/` — Express + WebSocket, ESM, run via `tsx`
- `shared/` — Drizzle schema, Zod schemas, shared TS types (single source of truth)

**Path aliases:**
- `@/*` → `client/src/*` (tsconfig + vite)
- `@shared/*` → `shared/*` (tsconfig + vite)
- `@assets/*` → `attached_assets/*` (Vite only)

**Single-server model** (`server/index.ts`):
- One Express app on port 5000 serves JSON API + SPA.
- Dev: Vite middleware mounted. Prod: `serveStatic` serves `dist/public`.
- WebSocket server (`server/websocket-sync.ts`) at `/ws`, maxPayload 100MB, ping every 30s.
- Route registration order (in `server/index.ts`): auth → sync routes → sync push/pull → end-event → main routes (Vite middleware must be last).

**Database — Drizzle ORM + `node-postgres`:**
- All tables in `shared/schema.ts` (one file): `timeSlots`, `squads`, `participants`, `shopItems`, `mealItems`, `purchases`, `mealPurchases`, `discounts`, `mealDiscounts`, `squadAuditLog`, `appConfig`, `users`, `auditLogs`.
- Schema applied via `drizzle-kit push` (declarative, no SQL migrations committed).
- `server/storage.ts` is the single repository layer (~1000 LOC) — wrap all DB calls through `storage` instead of calling `db` directly.

**Domain:**
- Participants have type: `"zombie" | "survivant" | "staff"` (discriminator for squads, discounts, meals, UI routing).
- Layered discounts: participant > squad > type. Separate tables for shop (`discounts`) and meals (`mealDiscounts`).
- Each participant has a 5-digit `secretCode` for visitor portal.

**Auth & Sessions** (`server/auth-routes.ts`):
- `express-session` + `memorystore` (in-memory; restarting logs everyone out).
- Cookie: `darkevent.sid` (HTTPOnly, SameSite=Lax, 24h max age).
- Two tracks:
  1. **Staff login:** username + password (SHA-256), stores `req.session.user`.
  2. **Visitor login:** 5-digit `secretCode` + first letter of `lastName` (case-insensitive), stores `req.session.visitor`.
- Roles (JSON-encoded array in `users.roles`): `admin`, `staff_zombie`, `staff_survivant`, `staff_repas`, `staff_boutique`.
- Middleware: `requireAuth`, `requireRole(...roles)` in `server/auth-routes.ts`.
- Client: `client/src/lib/auth.tsx` provides `AuthProvider`, `useAuth()`, `RequireAuth`, `RequireVisitor`.

**Online/Offline Sync:**
- `appConfig.isOnlineMode` toggles mode. Online: anyone mutates. Offline: only `appConfig.masterDeviceId` can issue mutations.
- Enforced by `server/sync-middleware.ts::checkSyncPermissions` — rejects POST/PUT/PATCH/DELETE without matching `X-Device-ID` header.
- Middleware wired per-resource in `server/routes.ts`.
- **WebSocket:** path `/ws`, HMAC-signed tokens via `/api/sync/ws-token` (15min TTL). UDP broadcast on port `8888` for LAN device discovery.
- Client sync: `client/src/components/websocket-sync-client.tsx`, `sync-mode-manager.tsx`, `sync-button.tsx`, `sync-push-pull-buttons.tsx`, `data-sync-qr.tsx`.

**Audit Logging:**
- `server/routes.ts::createAuditLog()` records CREATE/UPDATE/DELETE into `audit_logs` (snapshot, diff, user, IP, user-agent). Failures silently swallowed.
- `squadAuditLog` tracks squad reassignments per participant.

**End-of-Event Pipeline** (`server/end-event-routes.ts` + `pdf-service.ts` + `email-service.ts`):
- `POST /api/admin/end-event` (admin-only) generates per-participant PDF (badge, purchases, meals) with `pdfkit`, emails via `nodemailer` (Outlook SMTP).
- Streams progress over Server-Sent Events.
- Dev: `NODE_ENV=development` redirects all email to `DEV_EMAIL_OVERRIDE`. Original recipient in subject prefix.

**Frontend:**
- Routing: `wouter` (lightweight, `client/src/App.tsx`). `/login` and `/visitor` unwrapped; `/admin`, `/users` require roles.
- Data: `@tanstack/react-query` (query client in `client/src/lib/queryClient.ts`).
- UI: shadcn/ui (new-york style, `client/src/components/ui/`) over Radix + Tailwind. Dark/zombie theme.
- Forms: `react-hook-form` + `@hookform/resolvers` + Zod (re-use `shared/schema.ts`).
- Excel/QR: `xlsx`, `qrcode` + `qrcode.react`, scanning via `client/src/components/qr-scanner.tsx` & `unified-scan-modal.tsx`.
- Legacy variants: `admin-old.tsx` / `admin-new.tsx`, `scan-old.tsx` / `scan-new.tsx` are stale.

## Environment Variables

From `.env.example`:
- `NODE_ENV` (development enables Vite + email redirection)
- `DATABASE_URL` (required; validated at boot)
- `SESSION_SECRET` (insecure default; override in prod)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_FROM_NAME` (Outlook SMTP)
- `DEV_EMAIL_OVERRIDE` (dev-only email redirect)
- `WEBSOCKET_SECRET` (HMAC key; random per-process if unset, breaks multi-instance)
- `QR_ENCRYPTION_KEY`, `QR_ENCRYPTION_IV` (AES-256-CBC; default hardcoded — override in prod)
- `PORT` (defaults 5000)

## Gotchas

- `users.roles` is a JSON-encoded **string** in the schema (not Postgres JSONB), though `migrate-roles.ts` adds it as JSONB at SQL level. Client parses via `JSON.parse`.
- Sessions are in-memory — restarts log everyone out. No Redis or connect-pg-simple wired despite being in dependencies.
- Global error handler in `server/index.ts` re-throws after sending response — intentional but means errors surface in logs.
- `drizzle-kit push` is the only way schema changes hit the DB — no migration history.
- Repo supports Replit plugins (`@replit/vite-plugin-cartographer`, etc.) — no-ops outside Replit.
- French is the default UI/error language.
