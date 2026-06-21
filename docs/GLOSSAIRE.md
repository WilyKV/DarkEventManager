# Glossaire : Termes et concepts clés

## Architecture et infrastructure

### Pi (Raspberry Pi)
Serveur central hébergé en caverne, source de vérité unique pour les données. Exécute Express + PostgreSQL + WebSocket. Accessible via `http://pi.local:5000`.

### Tablette
Appareil Android/iPad utilisé par bénévoles pour scanner QR, effectuer achats, gérer équipes. Exécute PWA React + IndexedDB local.

### Master device
Tablette élue capable d'opérer en mode offline-first si Pi est indisponible. Seul appareil autorisé à écrire en mode offline.

### Event-sourcing
Architecture où chaque mutation est enregistrée comme un événement immuable avant d'être appliquée au state. Permet replay/audit/reconciliation.

### Lamport timestamp
Entier incrémenté pour garantir l'ordre causal des événements dans un système distribué sans horloge synchronisée. Formule: `max(clientLamport, serverLamport) + 1`.

### WebSocket
Connexion persistante bidirectionnelle entre Pi et tablettes pour synchroniser mutations temps réel. Chemin: `/ws`, authentification: HMAC token 15min TTL.

### PWA (Progressive Web App)
Application web fonctionnant offline via Service Worker + IndexedDB. Cache strategies: NetworkFirst pour API, CacheFirst pour assets.

### IndexedDB
Browser-side database (Dexie wrapper) où chaque tablette stocke event-store local et données cachées. Capacité ~50MB.

## Modes de synchronisation

### Mode online
Tous les appareils connectés au Pi peuvent écrire à la DB. Latence < 100ms LAN. Mode normal, préféré.

### Mode offline
Seul le master device peut écrire ; autres tablettes sont en lecture seule (cache service worker). Basculement auto si Pi ne répond pas > 30s.

### Bulk ingest
Endpoint `POST /api/events/bulk-ingest` : tablette master envoie tous les events offline au Pi pour réconciliation atomique quand connexion revient.

## Authentification et sécurité

### Secret code
Code 5 chiffres unique par participant (ex: `04729`) permettant accès au portail visiteur sans enregistrement.

### Bcrypt
Algorithme de hachage de mot de passe avec salt adaptif (coût=10 ≈ 100-150ms par tentative). Protège contre rainbow tables et brute-force.

### Session
Contexte utilisateur (staff ou visiteur) stocké en mémoire (defaut) ou PostgreSQL. Cookie `darkevent.sid` HTTPOnly + SameSite.

### Rôle
Autorisation staff (admin, staff_zombie, staff_survivant, staff_repas, staff_boutique). Array JSON stocké en JSONB PostgreSQL.

### Rate-limiting
Limite nombre tentatives login (5 staff/15min, 10 visiteur/15min) pour prévenir brute-force.

### HMAC
Signature cryptographique symmétrique (clé partagée WEBSOCKET_SECRET) pour authentifier messages WebSocket.

### Audit log
Enregistrement immuable de toute mutation (CREATE/UPDATE/DELETE) avec user, IP, user-agent, snapshot/diff pour traçabilité + conformité.

## Métier

### Participant
Zombie, survivant, ou staff inscrit à l'événement. Identifiant : numero ID + code secret 5 chiffres.

### Type (participant)
Discriminant participant : `"zombie"` | `"survivant"` | `"staff"`. Détermine accès UI, réductions, flows métier.

### Squad (Équipe)
Petit groupe (3-8) de participants même type, assigné à créneau horaire + numéro (1-8). Permet briefing collectif, discounts groupe.

### Time Slot (Créneau)
Bloc horaire définissant repas, briefing, jeu, sortie (e.g., "14h-16h Zombies"). Chaque participant assigné à 1 créneau.

### Discount (Réduction)
Réduction appliquée boutique ou repas, en couches : participant > squad > type. Calculée au scan.

### Purchase (Achat boutique)
Transaction shop : participant × item × qty. Enregistre prix original, discount appliqué, prix final. Idempotence via `clientEventId`.

### Meal purchase (Ticket repas)
Achat repas (gratuit zombies, payant autres). Tracked séparément des shop purchases.

### Portail visiteur
Interface restreinte où participant (via code secret) peut consulter récap mais pas modifier.

### End-event
Pipeline fin d'événement : génération PDF personalisé + envoi email pour chaque participant.

## Données et persistance

### PostgreSQL
Base de données relationnelle hébergée conteneur Docker `darkevent_db`. Port 5434 hôte, 5432 conteneur. Volume `postgres_data` persistant.

### Drizzle ORM
Query builder TypeScript typé pour PostgreSQL. Remplace migrations SQL par schema déclaratif (`drizzle-kit push`).

### server_events
Table event-store serveur : enregistre tous les events acceptés avec Lamport timestamp pour réconciliation offline.

### Backup
Snapshot PostgreSQL via `pg_dump`. Recommandé toutes 30min durant événement, avant tout schema change.

## Frontend

### React
Framework UI. Client-side SPA avec Vite bundler.

### Wouter
Routeur léger (alternative Next.js). Routes: `/login` (staff), `/visitor` (visiteur), `/admin` (admin), `/scan` (bénévoles).

### React Query
Client-side cache HTTP. Gère fetching, polling, invalidation.

### shadcn/ui
Composants UI (Radix + Tailwind). Dark/zombie theme appliqué.

### React Hook Form
Gestion formulaires avec validation Zod.

## Deployment et exploitation

### Docker Compose
Orchestration 2 conteneurs : app (Node.js) + db (PostgreSQL).

### Makefile
Scripts d'automation : `make up`, `make down`, `make db-push`, `make logs`, etc.

### npm run dev
Démarrage dev local : Node.js + Vite middleware + hot reload.

### npm run build
Production build : Vite (client → dist/public) + esbuild (server → dist/index.js).

### npm start
Production run : Node.js dist/index.js sur port 5000.

---

**Retour vers** : [README.md](./README.md) — Documentation complète
