# ADR-005 : Idempotence achats via clientEventId + index unique partiel

**Statut** : Accepté

**Date** : 2024-Q3

## Contexte

**Problème** : En mode offline ou avec une latence réseau instable, une tablette peut émettre plusieurs fois la même mutation (achat shop, repas, etc.) avant de recevoir la confirmation du serveur.

Scénario critique :
1. Tablette A émet : `POST /api/purchases { participantId: 42, amount: 15, clientEventId: 'uuid-abc' }`
2. Serveur reçoit, crée achat, répond `201 Created`
3. Réponse réseau se perd
4. Tablette timeout → retry avec **le même clientEventId**
5. Serveur reçoit à nouveau
6. **Sans idempotence** = 2 achats créés, solde doublement débité ❌
7. **Avec idempotence** = 1er achat appliqué, 2e ignoré, solde correct ✅

**Contraintes** :
- Débits affectent solde participant (données critiques)
- Beaucoup de mutations concurrentes (50-100 req/s pendant événement)
- Pas de compensations comptables possibles (event terminé = fermeture)
- Index requis pour performance (<5ms lookup)

**Hypothèses** :
- Tablettes toujours généraient UUID v4 unique (crypto)
- Index unique partiel acceptable en taille (sauf achats annulés)
- NULL = "pas de clientEventId" (achats batch legacy) doit être autorisé

## Décision

**Implémenter l'idempotence via `purchases.client_event_id` (UUID v4 unique par émission) + index unique partiel (`WHERE client_event_id IS NOT NULL`)** avec `ON CONFLICT DO NOTHING`.

### Schéma Drizzle

```typescript
// shared/schema.ts — modifier table purchases
export const purchases = pgTable(
  'purchases',
  {
    id: text('id').primaryKey().defaultRandom(),
    participantId: text('participant_id').notNull().references(
      () => participants.id,
      { onDelete: 'cascade' }
    ),
    shopItemId: text('shop_item_id').notNull().references(
      () => shopItems.id
    ),
    quantity: integer('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull(), // cents
    totalPrice: integer('total_price').notNull(), // quantity * unitPrice
    clientEventId: text('client_event_id').unique('uniq_purchases_client_event_id_partial'),
    // ^ unique partial index : "WHERE client_event_id IS NOT NULL"
    createdAt: timestamp('created_at').defaultNow(),
    createdBy: text('created_by'), // user who recorded
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    // Index unique partiel : uniquement si clientEventId fourni
    uniqueClientEventId: uniqueIndex(
      'uniq_purchases_client_event_id'
    ).on(table.clientEventId).where(sql`${table.clientEventId} IS NOT NULL`),
  })
);
```

### Insertion avec idempotence (PostgreSQL)

```typescript
// server/storage.ts — createPurchase()
async function createPurchase(input: {
  participantId: string;
  shopItemId: string;
  quantity: number;
  unitPrice: number;
  clientEventId?: string;
  createdBy?: string;
}): Promise<Purchase | null> {
  const result = await db
    .insert(purchases)
    .values({
      id: crypto.randomUUID(),
      participantId: input.participantId,
      shopItemId: input.shopItemId,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      totalPrice: input.quantity * input.unitPrice,
      clientEventId: input.clientEventId,
      createdBy: input.createdBy,
    })
    .onConflictDoNothing({
      target: purchases.clientEventId, // spécifier colonne unique
    })
    .returning();

  // Résultat :
  // - Si clientEventId nouveau => INSERT réussi, retourne row
  // - Si clientEventId doublon => IGNORE (ON CONFLICT DO NOTHING), retourne []
  return result[0] ?? null;
}
```

### Appel côté route HTTP

```typescript
// server/routes.ts
app.post('/api/purchases', requireAuth, async (req, res) => {
  const { participantId, shopItemId, quantity, clientEventId } = req.body;

  const purchase = await storage.createPurchase({
    participantId,
    shopItemId,
    quantity,
    clientEventId, // optionnel, venant du client
    createdBy: req.session.user?.username,
  });

  if (!purchase) {
    // Doublon détecté
    // Retourner 201 + achat existant (idempotent, de l'extérieur c'est pareil)
    const existing = await storage.getPurchaseByClientEventId(clientEventId);
    return res.status(201).json({ message: 'Created (or already exists)', purchase: existing });
  }

  res.status(201).json({ message: 'Created', purchase });
});
```

### Côté client (React)

```typescript
// client/src/hooks/usePurchase.ts
export function usePurchase() {
  const createPurchase = useMutation(async (input: {
    participantId: string;
    shopItemId: string;
    quantity: number;
  }) => {
    const clientEventId = crypto.randomUUID(); // généré client
    return fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        clientEventId, // toujours envoyer
      }),
    }).then(r => r.json());
  });

  return { createPurchase };
}
```

## Conséquences

### Positives
- ✅ **Idempotence garantie** : réémission = ignorée, solde dédupliqué
- ✅ **Performance** : index partiel = lookup <5ms même avec 100k achats
- ✅ **Simplement testable** : scénario double-emit facile à vérifier
- ✅ **Compatible audit trail** : `client_event_id` lien direct vers `server_events.client_event_id` (ADR-003)
- ✅ **Null-safe** : `WHERE ... IS NOT NULL` => achats legacy ou batch sans ID passent
- ✅ **Pas de transaction coûteuse** : `ON CONFLICT` = atomic au niveau DB

### Négatives
- ❌ **Colonne ajoutée** : migration schema requise (`make db-push`)
- ❌ **Stockage** : ~36 bytes UUID par achat (negligible pour 1-5k achats/event)
- ❌ **Responsabilité client** : doit générer + envoyer `clientEventId` (sinon perte idempotence)
- ❌ **Comptage achats** : requêtes counting doivent filtrer pour éviter doublons (peu probable)

### Mitigation
- **Documentation clientes requise** : "toujours envoyer `clientEventId` pour achats temps réel"
- **Monitoring** : alerter si `clientEventId` NULL dans les achats
- **Testing** : scénario E2E double-emit + vérifier solde
- **Backward compat** : NULL autorisé (Legacy batch imports)

## Alternatives considérées

### 1. **Unique sur participantId + shopItemId + timestamp**
```sql
UNIQUE(participant_id, shop_item_id, created_at)
```
- ✅ Pas de client-side UUID
- ❌ Timestamp au ms insuffisant (100 req/s = collisions)
- ❌ Cas légitime (acheter même item 2x) serait rejeté
- ❌ Fragile aux horloge dérives

### 2. **Deduplication côté application (cache Redis)**
Store clientEventId en Redis TTL 5min, check avant INSERT
- ✅ Flexible
- ❌ Service externe (pas en caverne)
- ❌ Race condition si 2 inserts simultanés
- ❌ Perte Redis = perte idempotence

### 3. **Versioning optimiste + retry**
`purchases.version = 1, 2, 3, …` avec `WHERE version = expected`
- ✅ Détecte vraies collisions
- ❌ Complexe (client doit connaître version)
- ❌ Requête SELECT avant INSERT = +latence

### 4. **Idempotency Keys (RFC 7231 style)**
Header HTTP `Idempotency-Key`, server store en cache
- ✅ Standard HTTP
- ❌ Nécessite Redis ou session long-term
- ❌ Overkill pour cet use case

## Testing

```typescript
// tests/server/purchases.test.ts
test('Double-emit du même achat est idempotent', async () => {
  const clientEventId = randomUUID();
  const input = {
    participantId: 'p123',
    shopItemId: 'item-456',
    quantity: 1,
    clientEventId,
  };

  const purchase1 = await storage.createPurchase(input);
  const purchase2 = await storage.createPurchase(input); // même clientEventId

  expect(purchase1).toBeDefined();
  expect(purchase2).toBeNull(); // doublon ignoré
  
  // Vérifier solde participant unique
  const participant = await storage.getParticipant('p123');
  expect(participant.balance).toBe(-15); // une seule fois débité
});

test('Deux achats différents du même item sont permis', async () => {
  const input1 = { participantId: 'p123', shopItemId: 'item-456', quantity: 1, clientEventId: randomUUID() };
  const input2 = { participantId: 'p123', shopItemId: 'item-456', quantity: 1, clientEventId: randomUUID() };

  const p1 = await storage.createPurchase(input1);
  const p2 = await storage.createPurchase(input2);

  expect(p1).toBeDefined();
  expect(p2).toBeDefined();
  expect(p1.id).not.toBe(p2.id); // deux achats distincts
  
  const participant = await storage.getParticipant('p123');
  expect(participant.balance).toBe(-30); // débité 2x
});
```

## Déploiement

```bash
# 1. Ajouter colonne + index (make db-push)
npm run db:push

# 2. Migrer achats existants
UPDATE purchases SET client_event_id = gen_random_uuid()
WHERE client_event_id IS NULL AND created_at < NOW() - INTERVAL '1 day';
-- (optionnel : remplir les anciens achats)

# 3. Vérifier index créé
\d purchases

# 4. Tester idempotence
npm test -- tests/server/purchases.test.ts
```

## Voir aussi

- [ADR-003](./0003-event-sourcing-local-first-lamport.md) — Event-sourcing, `server_events.client_event_id` lien
- [ADR-001](./0001-topologie-raspberry-pi-cave-local.md) — Offline retries raison de ce besoin
