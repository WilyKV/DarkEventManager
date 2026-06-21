# ADR-001 : Topologie Raspberry Pi cave-local

**Statut** : Accepté

**Date** : 2024-Q3

## Contexte

**Problème** : Zomb'in The Dark est un événement d'envergure (500-1000 participants) organisé dans une grotte naturelle, sans accès Internet. L'application de gestion (participants, équipes, discounts, achats) doit fonctionner en temps réel avec des tablettes Android opérées par des bénévoles non-techniques.

**Contraintes** :
- Pas de connectivité Internet en caverne
- Latence ultra-faible requise (temps réel pour scanner QR, paiements)
- Bénévoles sans formation IT
- Centaines de mutations simultanées (scan QR, achats, modifications équipes)
- Architecture doit survivre à la perte d'une tablette

**Hypothèses** :
- Un site central (la « base ») dispose d'une connexion Ethernet ou WiFi fiable
- Les tablettes et la base communiquent via un réseau local WiFi/Ethernet en caverne
- La durée de l'événement est finie (quelques heures) — pas besoin de persistance infinie hors-ligne

## Décision

**Utiliser un hub Raspberry Pi en réseau local de caverne** comme coordinateur unique des mutations et source de vérité (single source of truth).

Architecture :
- **Serveur central** : Raspberry Pi exécutant Node.js + Express + PostgreSQL, accessible via `http://pi.local:5000`
- **Clients** : Tablettes Android se connectant au Pi via WiFi caverne (pas de Cloud)
- **Données** : PostgreSQL local sur le Pi, synchronisées via WebSocket et HTTP
- **Fallback** : Une tablette élue « master device » peut basculer en mode offline-first et réconcilier ultérieurement

**Justification** :
- ✅ Zéro dépendance Internet
- ✅ Latence < 100ms (LAN), acceptable pour UX temps réel
- ✅ Coût d'infrastructure faible (un Pi + une batterie)
- ✅ Modèle centralisé simple à dérouler pour bénévoles
- ✅ Audit trail centralisé pour conformité

## Conséquences

### Positives
- Architecture prévisible et débogage aisé
- Sessions et authentification centralisées
- Mutations atomiques garanties (ACID PostgreSQL)
- Snapshot d'urgence facile (`pg_dump`)

### Négatives
- **SPOF (Single Point of Failure)** : défaillance du Pi = arrêt des mutations
- Dépendance à une Raspi spécifique (matériel, SD card corruptible)
- Pas de résilience multi-site (1 événement = 1 Pi)
- Consommation batterie Pi + WiFi (4-6h sur batterie externe)

### Mitigation
- Snapshot `pg_dump` sauvegardé régulièrement sur une clé USB
- Tablette « master device » peut opérer en offline-first et réconcilier post-événement
- Test de failover pré-événement
- Communication claire aux bénévoles : « Pi = cœur de l'app »

## Alternatives considérées

### 1. **P2P pur (Cryo, Yjs, WebRTC)**
Chaque tablette = pair, synchronisation par CRDT
- ✅ Aucun SPOF
- ✅ Résilience totale
- ❌ Complexité extrême (résolution de conflits, vector clocks)
- ❌ Débogage difficile pour bénévoles
- ❌ Concurrence => conflits fréquents

### 2. **Cloud centralisé (Firebase, AWS, Heroku)**
Synchronisation vers le Cloud avec fallback local
- ✅ Audit centralisé immuable
- ✅ Multi-région possible
- ❌ Dépendance Internet (contredit le besoin)
- ❌ Coût d'infrastructure
- ❌ Latence réseau inacceptable en grotte (si WiFi faible)

### 3. **Hybrid : Pi + Cloud avec sync asynchrone**
Pi = primary en event, Cloud = archive post-event
- ✅ Audit trail immuable dans Cloud
- ✅ Récupération de bande passante si WiFi revient
- ❌ Ajout de complexité (sync scheduler)
- ❌ Coût (Cloud + Pi)
- ✅ **Candidate pour une itération future** (ADR-002)

## Implémentation

- **Serveur** : `server/index.ts` (Express + WebSocket)
- **WebSocket** : `server/websocket-sync.ts`, chemin `/ws`, HMAC signé
- **Fallback offline** : `client/src/components/websocket-sync-client.tsx`
- **Mode détection** : `appConfig.isOnlineMode` (basculable à chaud)

## Voir aussi

- [ADR-002](./0002-toggle-3-modes-connectivite.md) — Evolution vers un mode Cloud optionnel
- [ADR-003](./0003-event-sourcing-local-first-lamport.md) — Event-sourcing local-first pour réconciliation
