# ADR-003 : Event-sourcing local-first avec Lamport timestamps

**Statut** : Accepté (partiellement)

**Date** : 2024-Q3

## Contexte

**Problème** : En mode offline, plusieurs tablettes peuvent émettre des mutations concurrentes sans se connaître mutuellement. Comment réconcilier ces mutations quand elles reviennent au serveur centralisé ?

Exemple critique :
- Tablette A: "Scanner QR participantX" (achat shop) à 14:32:10 local
- Tablette B: "Modifier équipe participantX" à 14:32:05 local
- Les horloges locales ne sont pas synchronisées

Besoins :
- Ordre causal des mutations (qui a modifié quoi avant quoi)
- Déterminisme : même ordre à chaque replay
- Audit trail : "cette modification a été précédée de cela"
- Pas de CRDT complexe (bénévoles non-techniques)

## Décision

**Implémenter un event-store local-first avec Lamport timestamps** pour résolution déterministe de conflits.

### Architecture

#### 1. **Event-store côté client** (IndexedDB via Dexie)
Fichier : `client/src/db/event-store.ts`

Chaque mutation client émet un **ClientEvent** :
```typescript
interface ClientEvent {
  id: string;              // UUID v4, unique par client
  type: 'purchase' | 'participant.update' | 'squad.reassign' | …
  payload: Record<string, unknown>;
  timestamp: number;       // Lamport timestamp local
  lamportClock: number;    // Compteur d'ordre causal (incrémenté à chaque émission)
  deviceId: string;        // UUID de la tablette
  sequenceNumber: number;  // Ordre sur cette tablette (1, 2, 3, …)
  synced: boolean;         // false → à envoyer, true → confirmé par serveur
}
```

#### 2. **Event-store côté serveur** (table `server_events`)
Schéma Drizzle :
```typescript
export const serverEvents = pgTable('server_events', {
  id: text('id').primaryKey(),
  clientEventId: text('client_event_id'),  // lien vers ClientEvent
  type: text('type'),
  payload: json('payload'),
  deviceId: text('device_id'),
  lamportTimestamp: integer('lamport_timestamp'), // max(clientLamport, serverLamport) + 1
  sequenceNumber: integer('sequence_number'),
  createdAt: timestamp('created_at').defaultNow(),
  userId: text('user_id'),
  ipAddress: text('ip_address'),
});
```

#### 3. **Lamport Timestamp Logic**

**Définition** : Un entier incrémenté pour chaque événement dans le système distribué, garantissant causalité.

**Règle d'incrémentation (serveur)** :
```
serverLamport = max(clientLamport, lastServerLamport) + 1
```

Où :
- `clientLamport` = timestamp du client qui envoie l'événement
- `lastServerLamport` = dernier timestamp du serveur

**Avantage** : Même sans horloge synchronisée, l'ordre causal est préservé.

#### 4. **Résolution de conflits**

Lors de la réconciliation (sync après offline) :

**Par défaut (LWW — Last-Write-Wins)** :
- Pour le même champ sur le même objet, événement avec plus grand Lamport timestamp gagne
- En cas d'égalité, device ID en ordre lexicographique

```typescript
// Pseudo-code server/storage.ts
function reconcileEvents(events: ServerEvent[]): void {
  const sortedEvents = events.sort((a, b) => {
    if (a.lamportTimestamp !== b.lamportTimestamp) {
      return a.lamportTimestamp - b.lamportTimestamp;
    }
    return a.deviceId.localeCompare(b.deviceId);
  });

  for (const event of sortedEvents) {
    applyEventToDatabase(event); // INSERT/UPDATE/DELETE
  }
}
```

**Futurs (US-5)** : Permettre override custom per-type (ex: `squad.reassign` = majorité vote).

## Conséquences

### Positives
- ✅ **Déterministe** : replay des mêmes événements => même état final (idéal pour tests + audit)
- ✅ **Causalité préservée** : pas de mutation orpheline
- ✅ **Simple à comprendre** : Lamport << CRDT (pas de vector clocks)
- ✅ **Audit trail complet** : `server_events` = log immuable pour conformité
- ✅ **Offline-first** : client peut émettre sans attendre serveur
- ✅ **Idempotence** : même clientEventId réémis = IGNORE au serveur (via unique index partiel, ADR-005)

### Négatives
- ❌ **LWW résout mal les vraies collisions** : A scanne achat, B modifie prix => B gagne (peut être faux)
- ❌ **Stockage IndexedDB** : croissance => purge requise si tablette offline longtemps
- ❌ **Lamport skew** : client envoie Lamport = 9999, serveur en est à 100 => gros jump (non-dangereux mais étrange)
- ❌ **Pas de causalité cross-device** : si A → B → C, mais B n'a pas vu A, Lamport peut mettre C avant B

### Mitigation
- Implémenter purge IndexedDB (keep last 10k events)
- Logging Lamport skew pour debug
- Tests scénario multi-device (US-5 tests)
- Override LWW pour types critiques (achats, équipes)

## Alternatives considérées

### 1. **Vector Clocks**
```
VC_A = [1, 0], VC_B = [0, 1] => pas d'ordre => conflit
```
- ✅ Causalité parfaite
- ❌ Complexe (n-tuple par événement), overhead stockage
- ❌ Comparaison non-totale (nécessite resolver custom)
- ❌ Difficile pour bénévoles à déboguer

### 2. **CRDT (Yjs, Automerge)**
- ✅ Résolution automatique sans conflits
- ✅ Très documenté
- ❌ Overhead mémoire énorme pour 1k+ participants
- ❌ Courbe apprentissage raide

### 3. **Horloge centralisée (serveur Lamport uniquement)**
Client demande `GET /api/sync/lamport` avant chaque mutation.
- ✅ Simple
- ❌ Nécessite latence réseau (break offline-first)
- ❌ Serveur est SPOF

### 4. **Timestamps ISO (horloge système)**
- ✅ Standard, simple
- ❌ Dépend horloge local synchronisée (pas garanti)
- ❌ Collisions possibles (même milliseconde)

## Implémentation

### Phase 1 (Accepté, partiellement livré — US-1, US-2)
- ✅ Dexie event-store client (`client/src/db/event-store.ts`)
- ✅ `server_events` table + storage layer
- ✅ WebSocket sync push/pull
- ✅ Lamport counter basique

### Phase 2 (À venir — US-5, équilibreur de charge Q4)
- ❌ Custom resolver par type (votes, consensus)
- ❌ Compression events (batch rewrite)
- ❌ Cloud sync asynchrone + merge historique

## Testing

```typescript
// tests/server/event-sourcing.test.ts
test('Lamport order preserved on multi-device sync', () => {
  const eventA = makeEvent({ lamport: 10, deviceId: 'tab-1' });
  const eventB = makeEvent({ lamport: 9, deviceId: 'tab-2' });
  
  const sorted = reconcileEvents([eventB, eventA]);
  expect(sorted[0].id).toBe(eventB.id); // Lamport 9 < 10
  expect(sorted[1].id).toBe(eventA.id);
});
```

## Voir aussi

- [ADR-005](./0005-idempotence-achats-client-event-id.md) — Index unique partiel pour garantir idempotence
- [ADR-001](./0001-topologie-raspberry-pi-cave-local.md) — Context : offline en caverne requiert event-sourcing
