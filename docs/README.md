# Documentation DarkEventManager

Bienvenue dans la documentation de **Zomb'in The Dark** — le système de gestion d'événement pour un rassemblement zombie en milieu naturel (grotte) sans accès Internet.

Cette documentation est destinée aux propriétaires du projet, bénévoles, et équipe technique qui doivent comprendre comment fonctionne l'application, comment les données sont sauvegardées, et comment la synchronisation entre tablettes et serveur opère.

## À propos du projet

**DarkEventManager** est une application web et mobile (Progressive Web App) permettant de gérer en temps réel :
- L'arrivée et le suivi des **500-1000 participants** (zombies, survivants, staff)
- La formation d'**équipes (squads)** et l'assignation dynamique
- La **boutique** : ventes de boissons, nourriture, merchandise
- Les **repas** : ticket gratuit pour les zombies, payants pour autres types
- Un **portail visiteur** : code secret 5 chiffres + première lettre du nom pour accès autonome

**Stack technique** :
- **Frontend** : React 18 + Vite + shadcn/ui + PWA (offline-first)
- **Backend** : Express + Node.js + WebSocket
- **Base de données** : PostgreSQL + Drizzle ORM
- **Synchronisation** : Event-sourcing local-first + Lamport timestamps + WebSocket

## Table des matières

1. **[Vue d'ensemble](./01-vue-ensemble.md)** — Architecture générale, contexte événement, stack technique
2. **[Domaine métier](./02-domaine-metier.md)** — Modèle de données, participants, squads, boutique, repas, réductions
3. **[Authentification et rôles](./03-authentification-roles.md)** — Double piste auth (staff/visiteur), sessions, rôles, middlewares
4. **[Synchronisation des données](./04-synchronisation.md)** — Mode online/offline, WebSocket, event-sourcing, PWA et cache
5. **[Sauvegardes et restauration](./05-sauvegardes-restauration.md)** — Localisation des données, commandes backup/restore, stratégies de continuité
6. **[Fin d'événement - PDF et emails](./06-fin-evenement-pdf-email.md)** — Pipeline de génération de récapitulatifs et envoi aux participants
7. **[Installation et exploitation](./07-installation-exploitation.md)** — Lancer le projet (Docker / local), configuration .env, démarrage
8. **[Sécurité](./08-securite.md)** — Chiffrement, rate-limiting, audit logs, secrets
9. **[Guide de déploiement](./09-deploiement.md)** — Déployer en production sur serveur Linux pas à pas (Docker, HTTPS, init, dépannage)

## Architecture Decision Records (ADR)

Pour chaque décision architecturale importante, consulter le dossier **[docs/adr/](./adr/)** :

- **[ADR-001](./adr/0001-topologie-raspberry-pi-cave-local.md)** — Topologie Raspberry Pi centralisée en mode local
- **[ADR-002](./adr/0002-toggle-3-modes-connectivite.md)** — Toggle 3 modes connectivité (Cloud/Pi/Auto)
- **[ADR-003](./adr/0003-event-sourcing-local-first-lamport.md)** — Event-sourcing local-first avec Lamport timestamps
- **[ADR-004](./adr/0004-connect-pg-simple-session-store.md)** — Session store PostgreSQL centralisé
- **[ADR-005](./adr/0005-idempotence-achats-client-event-id.md)** — Idempotence des achats via clientEventId

## Commandes essentielles

### Docker (recommandé)
```bash
make up           # Démarrer les conteneurs
make down         # Arrêter les conteneurs
make start        # Reset complet : down + build + up + db-push
make db-push      # Appliquer le schéma à la DB
make logs         # Voir les logs en temps réel
```

### Local (sans Docker)
```bash
npm install       # Installer les dépendances
npm run dev       # Démarrer en mode développement (port 5000)
npm run db:push   # Appliquer le schéma à la DB
npm test          # Lancer les tests
```

## Glossaire

| Terme | Définition |
|-------|-----------|
| **Pi** | Serveur central Raspberry Pi hébergé en caverne, source de vérité unique |
| **Tablette** | Appareil Android/iPad utilisé par bénévoles pour scanner QR, effectuer achats, gérer équipes |
| **Master device** | Tablette élue capable d'opérer en mode offline-first si le Pi est indisponible |
| **Mode online** | Tous les appareils connectés au Pi peuvent écrire à la DB (mode normal) |
| **Mode offline** | Seul le master device peut écrire ; autres tablettes sont en lecture seule |
| **Event-sourcing** | Architekture où chaque mutation est enregistrée comme un événement immuable avant d'être appliquée |
| **Lamport timestamp** | Entier incrémenté pour garantir l'ordre causal des événements sans horloge synchronisée |
| **WebSocket** | Connexion persistante bidirectionnelle pour synchroniser les mutations entre Pi et tablettes |
| **PWA** | Progressive Web App : le frontend fonctionne offline via Service Worker + IndexedDB |
| **Secret code** | Code 5 chiffres unique par participant pour accès au portail visiteur |

## Liens utiles

- **Code** : `/server/`, `/client/`, `/shared/`
- **Tests** : `/tests/`
- **Configuration** : `.env.example`, `vite.config.ts`, `Makefile`
- **Docker** : `.docker/docker-compose.yml`, `.docker/Dockerfile`
- **Historique** : `todo.md` (feature backlog et décisions)

---

**Dernière mise à jour** : Juin 2024 (Vague 5 — Code Health)

Pour toute question, consulter `CLAUDE.md` ou contacter l'équipe de développement.
