# Vue d'ensemble du projet

## Contexte métier

### L'événement Zomb'in The Dark

Zomb'in The Dark est un **rassemblement immersif de 500 à 1000 participants** organisé dans une **grotte naturelle souterraine sans accès Internet**. L'événement dure quelques heures et met en scène :

- **Zombies** (~40%) : participants maquillés, objectif prédateur
- **Survivants** (~40%) : participants civils, objectif d'échapper/défendre
- **Staff** (~20%) : bénévoles, organisateurs, game masters

Pendant l'événement, il faut gérer en **temps réel et sans dépendance Internet** :
- L'arrivée et l'enregistrement des participants
- La formation et modification des **équipes (squads)**
- Les **achats à la boutique** (boissons, nourriture, merchandise)
- Les **repas** et tickets gratuits
- Les **codes secrets** (5 chiffres par participant)
- La traçabilité (qui est arrivé, qui est parti)

### Contraintes de l'environnement

| Contrainte | Impact |
|-----------|--------|
| **Pas d'Internet** | Application doit fonctionner 100% hors-ligne |
| **Réseau WiFi local** | Latence < 100ms acceptable, mais WiFi peut être instable |
| **Bénévoles non-IT** | Interface simple, pas de jargon technique |
| **Centaines de mutations/minute** | Scans QR, achats, modifications — nécessite architecture distribuée |
| **Durée finie (3-5h)** | Pas besoin de persistance infinie, mais réconciliation post-événement importante |
| **Batterie limitée** | Tablettes et serveur doivent fonctionner sur batterie externe |

## Architecture générale

### Modèle centralisé avec fallback offline

DarkEventManager adopte une **architecture centralisée avec fallback offline-first** :

```
┌─────────────────────────────────────────────────────────┐
│            GROTTE / ENVIRONNEMENT SOUTERRAIN             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌───────────────────────────┐                          │
│  │  Raspberry Pi (Serveur)    │                          │
│  │  ─────────────────────────│                          │
│  │  • Express API            │                          │
│  │  • WebSocket /ws          │                          │
│  │  • PostgreSQL (Data)      │                          │
│  │  • Audit logs             │                          │
│  └───────────────────────────┘                          │
│           ▲      ▲      ▲                                │
│           │      │      │                                │
│    ┌──────┴──────┴──────┴──────┐                         │
│    │    WiFi Local (5GHz)      │                         │
│    └──────────────────────────┘                          │
│      ▲           ▲        ▲       ▲                       │
│      │           │        │       │                       │
│  ┌─────────┐ ┌──────┐ ┌──────┐ ┌──────┐               │
│  │ Tablette│ │Tablet│ │Tablet│ │Tablet│               │
│  │   A     │ │  B   │ │  C   │ │  D   │  (PWA)        │
│  │ Master  │ │      │ │      │ │      │                │
│  └─────────┘ └──────┘ └──────┘ └──────┘               │
│                                                           │
│  Chaque tablette : IndexedDB (event-store local)        │
│                   Service Worker (mode offline)         │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Principes** :
1. **Mode online** (normal) : Pi accepte les mutations de n'importe quelle tablette
2. **Mode offline** : Seule la "master device" peut écrire ; autres tablettes lisent
3. **Fallback** : Si Pi tombe, master device continue et réconcilie post-événement
4. **Event-sourcing** : Chaque mutation est un événement immuable, stocké localement puis poussé au serveur

## Stack technique

### Frontend (Client)

| Composant | Rôle |
|-----------|------|
| **React 18** | Framework UI, state management via Context + React Query |
| **Vite** | Bundler ultra-rapide, remplace Webpack |
| **TypeScript** | Typage statique de bout en bout |
| **shadcn/ui** | Composants UI (Radix + Tailwind) : dark/zombie theme |
| **Wouter** | Routeur léger (alternative Next.js) |
| **React Query** | Cache serveur, requêtes HTTP, polling |
| **React Hook Form + Zod** | Gestion de formulaires + validation |
| **Dexie.js** | IndexedDB wrapper pour event-store local |
| **PWA (vite-plugin-pwa)** | Service Worker, manifest, cache strategies |

### Backend (Serveur)

| Composant | Rôle |
|-----------|------|
| **Express** | Framework web HTTP/REST |
| **Node.js** | Runtime JavaScript côté serveur |
| **WebSocket (ws)** | Connexion persistante pour sync temps réel |
| **PostgreSQL** | Base de données relationnelle |
| **Drizzle ORM** | QueryBuilder typé (alternative Prisma) |
| **pdfkit** | Génération de PDF pour fin d'événement |
| **nodemailer** | Envoi d'emails (Outlook SMTP) |
| **express-session** | Sessions utilisateur (default: memorystore) |
| **Helmet** | En-têtes de sécurité (HTTPS, CSP) |

### Base de données

**PostgreSQL** hébergée dans le conteneur `darkevent_db` :

```
Host: localhost:5434 (sur machine hôte)
Container: 5432 (interne)
Credentials: darkevent / darkevent
Database: darkevent
```

**10 tables principales** (cf. [02-domaine-metier.md](./02-domaine-metier.md)) :

- `participants` — Zombies, survivants, staff avec arrivée/départ
- `time_slots` — Créneaux horaires (repas, briefing, jeu, sortie)
- `squads` — Équipes numériques et leurs compositions
- `shop_items` — Produits de la boutique
- `purchases` — Achats individuels (idempotence via `clientEventId`)
- `meal_items` — Articles de repas
- `meal_purchases` — Tickets repas
- `discounts` — Réductions en couches (type > squad > participant)
- `meal_discounts` — Réductions spécifiques aux repas
- `audit_logs` / `squad_audit_log` — Traçabilité des modifications

### Monorepo TypeScript

```
darkeventmanager/
├── client/src/           # React SPA
│   ├── components/       # UI, forms, modals
│   ├── lib/              # Helpers (auth, query client, etc.)
│   ├── db/               # Event-store IndexedDB
│   └── App.tsx           # Routeur Wouter
├── server/               # Express backend
│   ├── routes.ts         # Routes CRUD principales
│   ├── sync-routes.ts    # Routes sync (push/pull)
│   ├── storage.ts        # Repository pattern (~1000 LOC)
│   ├── websocket-sync.ts # WebSocket server
│   └── auth-routes.ts    # Authentification + sessions
├── shared/               # Schéma, types, validations
│   └── schema.ts         # Drizzle schema + Zod schemas
└── tests/                # Vitest + RTL + supertest
```

**Path aliases** :
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

### Un port unique

L'application tourne sur **un seul port : 5000** :

```
http://localhost:5000
├── /api/auth/        → Routes authentification
├── /api/participants → Routes CRUD participants
├── /api/purchases    → Routes achats
├── /api/admin/       → Routes admin (fin d'événement)
├── /api/sync/        → Routes synchronisation
├── /ws               → WebSocket endpoint
└── /                 → Serve la SPA React (Vite ou dist/public)
```

**En développement** : Vite middleware monté à `/` sert le frontend avec HMR (hot reload)

**En production** : Static files servis depuis `dist/public`

## Flow de synchronisation

### Scénario typique : Scan QR et achat

```
Tablette A                    Raspberry Pi                   PostgreSQL
│                             │                              │
├─ Scan QR participant X ─────>│                             │
│  (mode: online)             │─ Valider achat ──────────────>│
│                             │  (INSERT purchases)          │
│                             │<── OK (id=123) ──────────────┤
│                             │                              │
│<── SSE ou HTTP 200 + achat ──┤                             │
│   { id: 123, ... }          │                              │
│                             │─ Broadcast WebSocket ───────>│
│                             │  (tous les clients reçoivent)│
│                             │                              │
├─ Maj état local (IndexedDB)─┤                             │
│  (event-store)              │                              │
│                             │                              │
├─ Afficher item acheté ──────┤                             │
│   (UI React)                │                              │
│                             │                              │
```

### Mode offline (tablette master)

```
Tablette A (Master)           IndexedDB (local)              Pi (offline)
│                             │                              │
├─ Scan QR participant Y ─────>│ Append event ─┐            │
│  (mode: offline)            │  (client-side)│            │
│<── Réponse immédiate ───────┤  (no network) │            │
│                             │               │            │
├─ Continuer opération        │               │            │
│                             │               │            │
│ (WiFi revient)              │<──────────────┘            │
│                             │                              │
├─ Push events au Pi ─────────────────────────────────────>│
│  (POST /api/events/        │                              │
│   bulk-ingest)             │                              │
│                             │                              │
│                             │<── 200 OK (réconciliés) ────┤
│                             │  (Lamport timestamps)       │
│                             │                              │
```

## Sécurité et audit

- **Authentification** : Username/password (bcrypt) ou code secret 5 chiffres
- **Sessions** : Cookie `darkevent.sid` (HTTPOnly, SameSite=Lax, 24h)
- **Rôles** : Array JSON `[admin, staff_zombie, staff_repas, ...]` (normalisé en Vague 5)
- **Audit logs** : Chaque INSERT/UPDATE/DELETE enregistré avec user, IP, user-agent, snapshot/diff
- **Rate-limiting** : 10 tentatives/15min pour visiteurs, 5 pour staff
- **HMAC WebSocket** : Tokens signés avec secret WEBSOCKET_SECRET (15min TTL)

## Déploiement

**Conteneurisation** : Docker Compose
```bash
docker-compose -f .docker/docker-compose.yml up
```

**Volumes** :
- `postgres_data` — Données PostgreSQL (persistantes)
- `uploads/` — PDFs générés et fichiers temporaires

**Build** :
```bash
npm run build  # Vite (client) → dist/public + esbuild (server) → dist/index.js
npm start      # Production: node dist/index.js
```

---

**Voir aussi** :
- [02-domaine-metier.md](./02-domaine-metier.md) — Modèle de données détaillé
- [03-authentification-roles.md](./03-authentification-roles.md) — Auth et rôles
- [04-synchronisation.md](./04-synchronisation.md) — Event-sourcing et WebSocket
- [07-installation-exploitation.md](./07-installation-exploitation.md) — Lancer le projet
