# ADR-002 : Toggle 3 modes connectivité Cloud/Pi/Auto

**Statut** : Proposé

**Date** : 2024-Q4

## Contexte

**Problème** : DarkEventManager doit supporter plusieurs scénarios de déploiement :
1. **Développement** : développeur en local ou sur serveur Cloud (dev.example.com)
2. **Test alpha/beta** : tests en conditions réelles, mais avec fallback Cloud
3. **Événement en production** : Raspberry Pi en caverne, Internet intermittent
4. **Récupération post-événement** : sync asynchrone vers Cloud pour audit

Actuellement, le mode de connectivité est codé en dur ou détecté au démarrage. Passer de Pi à Cloud requiert un redémarrage.

**Contraintes** :
- Les bénévoles ne doivent pas redémarrer l'app en plein événement
- Migration dynamique entre Pi et Cloud
- Authentification et règles d'autorisation changent par mode

**Hypothèses** :
- Un sélecteur de mode dans l'UI admin suffit
- Les données locales sont sauvegardables/restaurables par l'équipe IT
- Latence Cloud acceptable pour tests, pas pour production caverne

## Décision

**Introduire un toggle de mode connectivité** avec 3 options, stocké dans `appConfig.connectivityMode` (configurable à chaud, sans redémarrage) :

### Mode 1 : **Pi** (offline-first, défaut événement)
- Endpoint : `http://pi.local:5000` (ou IP réseau caverne)
- WebSocket : `/ws` signé HMAC
- Authentification : personnel + code secret
- Sync : locale uniquement, fallback tablette master

### Mode 2 : **Cloud** (online-first, défaut développement)
- Endpoint : `https://api.example.com` (configurable par env var)
- WebSocket : `/ws` avec token JWT/Bearer
- Authentification : user/pass + éventuellement OAuth
- Sync : continue vers Cloud, fallback IndexedDB local

### Mode 3 : **Auto** (intelligent, défaut test alpha)
- Tente Pi en priorité (découverte mDNS `pi.local`)
- Si Pi inaccessible, bascule à Cloud automatiquement
- Réessaye Pi périodiquement
- Métriques : ping/latency displayed à l'opérateur

## Implémentation

```typescript
// shared/schema.ts — ajouter à appConfig
export type ConnectivityMode = 'pi' | 'cloud' | 'auto';

export interface AppConfig {
  connectivityMode: ConnectivityMode;
  cloudEndpoint?: string;  // si mode cloud/auto
  piLocalEndpoint?: string; // si mode pi/auto (défaut: http://pi.local:5000)
  isOnlineMode: boolean;   // pour compatiblité rétro, auto-dérivé de mode
}

// client/src/lib/sync-config.ts — nouvelle
export class SyncConfig {
  async initMode(initial: ConnectivityMode): Promise<void> { /* détection */ }
  async switchMode(newMode: ConnectivityMode): Promise<void> { /* migrate */ }
  getActiveEndpoint(): string { /* based on mode */ }
  getPriority(): ConnectivityMode[] { /* fallback order */ }
}

// server/routes.ts — nouveau endpoint
POST /api/admin/sync/switch-mode
Body: { mode: 'pi' | 'cloud' | 'auto' }
Response: { success: true, mode: string, endpoint: string }
```

## Conséquences

### Positives
- ✅ Flexibilité déploiement (dev, test, production)
- ✅ Pas de redémarrage requis
- ✅ Fallback automatique en mode **Auto**
- ✅ Testable en conditions réelles (alpha) sans sacrifier Pi
- ✅ Possibilité de sync asynchrone Cloud post-événement

### Négatives
- ❌ Complexité client accrue (gestion multi-endpoint)
- ❌ Risque de basculement involontaire en **Auto**
- ❌ Débogage multi-mode plus difficile
- ❌ Guard-rails requis (ex: interdire cloud si événement en cours)

### Mitigation
- Ajouter confirmation UI avant bascule de mode
- Logging détaillé de chaque changement de mode
- Mode par défaut selon `NODE_ENV` (development → cloud, production → pi)
- Tests d'intégration multi-mode

## Alternatives considérées

### 1. **Un seul mode, choisi à déploiement**
- ✅ Plus simple
- ❌ Inflexible (redéploiement = downtime)

### 2. **Détection magique (mDNS uniquement)**
- ✅ Aucune config utilisateur
- ❌ Fragile sur réseaux WiFi complexes

### 3. **Trois binaires séparés** (app-pi, app-cloud, app-hybrid)
- ✅ Zéro couplage
- ❌ Triplication du code, maintenance cauchemar

## Backlog & Dépendances

- **US-Connectivity-1** : Ajouter sélecteur mode dans `client/src/components/admin-connectivity-mode.tsx`
- **US-Connectivity-2** : Impl. mDNS discovery pour mode Auto
- **US-Connectivity-3** : Cloud endpoint config (env var, UI)
- **US-Connectivity-4** : Migration données Pi → Cloud (batch export)

## Voir aussi

- [ADR-001](./0001-topologie-raspberry-pi-cave-local.md) — Topologie Pi, rationale
- [ADR-003](./0003-event-sourcing-local-first-lamport.md) — Event-sourcing pour résolution de conflits multi-mode
