# Domaine métier : Modèle de données

## Concepts clés

### Types de participants

Chaque participant a un **type** qui détermine ses droits, les réductions, et les flux d'accès :

| Type | Rôle | Caractéristiques |
|------|------|-----------------|
| **Zombie** | Prédateur/monstre | Peut scanner QR, 1 repas gratuit, discounts boutique |
| **Survivant** | Civil | Peut scanner QR, achats payants, accès boutique standard |
| **Staff** | Bénévole/organisateur | Accès admin, gestion équipes, scanning superviseur |

Le type discrimine le flux UI, les réductions applicables, et l'accès aux menus.

### Concept de « Squad » (Équipe)

Une **squad** est une petite équipe constituée de **3-8 participants** du même type, assignée à un **créneau horaire** et identifiée par un **numéro (1-8 par créneau)**.

Les squads permettent :
- **Briefing collectif** : Expliquer les règles à un groupe
- **Discounts de groupe** : Réduction appliquée à la squad entière
- **Tracking collectif** : "Squad 3 des zombies (14h-16h) est complète"
- **Audit d'assignation** : Historique des mouvements de participants entre squads

### Réductions en couches

Les réductions (boutique et repas) suivent une **hiérarchie de priorité** :

```
Réduction participant spécifique (plus spécifique)
        ↓
Réduction squad (groupe)
        ↓
Réduction type (zombie/survivant/staff)  (moins spécifique)
```

**Appliquée au moment du scan** : le système cherche la plus spécifique disponible.

Tables distinctes pour :
- `discounts` — Réductions boutique
- `meal_discounts` — Réductions repas

### Code secret et portail visiteur

Chaque participant reçoit un **code secret unique de 5 chiffres** (ex: `04729`) permettant :
1. Accès au **portail visiteur** : première lettre du nom + code secret = connexion
2. **Récupération de badge** : si le participant perd son QR/badge
3. **Autonomie** : pas besoin de faire la queue à l'enregistrement

## Schéma de données complet

### Table `participants`

Enregistre chaque personne inscrite à l'événement.

```sql
participants
├─ id                     : INTEGER PRIMARY KEY
├─ firstName              : TEXT
├─ lastName               : TEXT
├─ email                  : TEXT
├─ type                   : TEXT ('zombie' | 'survivant' | 'staff')
├─ timeSlotId             : INTEGER FK → time_slots
├─ squadId                : INTEGER FK → squads
├─ secretCode             : TEXT (5 digits unique)
├─ arrived                : BOOLEAN (enregistrement effectué)
├─ arrivedAt              : TIMESTAMP
├─ returned               : BOOLEAN (participant est parti)
├─ returnedAt             : TIMESTAMP
├─ mealTicketGiven        : BOOLEAN
├─ waterBottleGiven       : BOOLEAN
├─ squadExplained         : BOOLEAN
├─ briefingExplained      : BOOLEAN
├─ makeupWaitExplained    : BOOLEAN
├─ mapGiven               : BOOLEAN
├─ checklistCompleted     : BOOLEAN (enregistrement complet)
├─ hasFreemeal            : BOOLEAN (zombies: 1 repas gratuit)
├─ freeMealClaimed        : BOOLEAN
└─ createdAt              : TIMESTAMP
```

### Table `time_slots`

Définit les créneaux d'accès et horaires.

```sql
time_slots
├─ id                  : INTEGER PRIMARY KEY
├─ name                : TEXT (e.g., "Créneau 14h-16h Zombies")
├─ type                : TEXT ('zombie' | 'survivant' | 'staff')
├─ mealTime            : TEXT (heure repas, e.g., "14:15")
├─ briefingTime        : TEXT (e.g., "13:45")
├─ gameTime            : TEXT (e.g., "14:30")
└─ exitTime            : TEXT (e.g., "16:00")
```

### Table `squads`

Groupes de participants assignés à un créneau.

```sql
squads
├─ id                  : INTEGER PRIMARY KEY
├─ number              : INTEGER (1-8, identifie la squad dans le créneau)
├─ type                : TEXT ('zombie' | 'survivant' | 'staff')
├─ timeSlotId          : INTEGER FK → time_slots
├─ maxMembers          : INTEGER (default 8)
└─ briefing            : TEXT (notes briefing squad)
```

### Table `shop_items`

Produits vendus à la boutique.

```sql
shop_items
├─ id                  : INTEGER PRIMARY KEY
├─ name                : TEXT (e.g., "Bière artisanale")
├─ icon                : TEXT (Lucide icon name, e.g., "Beer")
├─ stock               : INTEGER
├─ price               : TEXT (price as string, e.g., "5.00")
├─ category            : TEXT (e.g., "Boissons", "Food", "Merch")
```

### Table `purchases`

Enregistre chaque achat à la boutique.

```sql
purchases
├─ id                     : INTEGER PRIMARY KEY
├─ participantId          : INTEGER FK → participants
├─ shopItemId             : INTEGER FK → shop_items
├─ quantity               : INTEGER (default 1)
├─ unitPrice              : TEXT (prix après réduction)
├─ originalPrice          : TEXT (prix avant réduction)
├─ discountApplied        : INTEGER (% 0-100)
├─ totalPrice             : TEXT (unitPrice * quantity)
├─ isPaid                 : BOOLEAN (paiement reçu)
├─ purchasedAt            : TIMESTAMP
├─ clientEventId          : TEXT UNIQUE (idempotence: ADR-005)
└─ createdAt              : TIMESTAMP
```

**Important** : Le champ `clientEventId` permet de **rejouer** la même mutation sans dupliquer l'achat (garantie d'idempotence).

### Table `discounts`

Applique les réductions boutique (3 niveaux : type, squad, participant).

```sql
discounts
├─ id                     : INTEGER PRIMARY KEY
├─ zombieDiscount         : INTEGER (% 0-100, nul = 0)
├─ survivantDiscount      : INTEGER (% 0-100, nul = 0)
├─ staffDiscount          : INTEGER (% 0-100, nul = 0)
├─ squadId                : INTEGER FK → squads (null si général)
├─ squadDiscount          : INTEGER (% 0-100)
├─ participantId          : INTEGER FK → participants UNIQUE
├─ participantDiscount    : INTEGER (% 0-100)
├─ createdAt              : TIMESTAMP
└─ updatedAt              : TIMESTAMP
```

### Table `meal_items`

Propose des articles de repas (buffet).

```sql
meal_items
├─ id                  : INTEGER PRIMARY KEY
├─ name                : TEXT (e.g., "Saucisse grillée")
├─ icon                : TEXT (Lucide icon)
├─ stock               : INTEGER
├─ price               : TEXT
└─ category            : TEXT (e.g., "Viande", "Légumes")
```

### Table `meal_purchases`

Enregistre les tickets/achats de repas.

```sql
meal_purchases
├─ id                     : INTEGER PRIMARY KEY
├─ participantId          : INTEGER FK → participants
├─ mealItemId             : INTEGER FK → meal_items
├─ quantity               : INTEGER
├─ unitPrice              : TEXT (après réduction)
├─ originalPrice          : TEXT (avant réduction)
├─ discountApplied        : INTEGER (%)
├─ totalPrice             : TEXT
├─ isPaid                 : BOOLEAN
├─ purchasedAt            : TIMESTAMP
├─ clientEventId          : TEXT UNIQUE (idempotence)
└─ createdAt              : TIMESTAMP
```

### Table `meal_discounts`

Applique les réductions repas (mêmes 3 niveaux).

```sql
meal_discounts
├─ id                     : INTEGER PRIMARY KEY
├─ zombieDiscount         : INTEGER (%)
├─ survivantDiscount      : INTEGER (%)
├─ staffDiscount          : INTEGER (%)
├─ squadId                : INTEGER FK → squads
├─ squadDiscount          : INTEGER (%)
├─ participantId          : INTEGER FK → participants UNIQUE
├─ participantDiscount    : INTEGER (%)
├─ createdAt              : TIMESTAMP
└─ updatedAt              : TIMESTAMP
```

### Table `audit_logs`

Traçabilité complète : chaque CREATE/UPDATE/DELETE engendre une entrée.

```sql
audit_logs
├─ id                  : INTEGER PRIMARY KEY
├─ action              : TEXT ('CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN_FAILED')
├─ tableName           : TEXT (e.g., "purchases")
├─ recordId            : INTEGER (identifiant modifié)
├─ userId              : INTEGER FK → users (nullable pour login)
├─ username            : TEXT (nom utilisateur qui a agit)
├─ snapshot            : JSON (état avant / après)
├─ diff                : JSON ({ field: { old: x, new: y } })
├─ ipAddress           : TEXT (IP du client)
├─ userAgent           : TEXT (navigateur/device)
└─ createdAt           : TIMESTAMP DEFAULT now()
```

### Table `squad_audit_log`

Historique des assignations de participants à des squads.

```sql
squad_audit_log
├─ id                  : INTEGER PRIMARY KEY
├─ participantId       : INTEGER FK → participants
├─ oldSquadId          : INTEGER FK → squads (nullable)
├─ newSquadId          : INTEGER FK → squads (nullable)
├─ reason              : TEXT (motif du changement)
├─ changedBy           : TEXT (user/staff qui a modifié)
└─ changedAt           : TIMESTAMP
```

### Table `app_config`

Configuration globale de l'application (une seule ligne en général).

```sql
app_config
├─ id                  : INTEGER PRIMARY KEY
├─ isOnlineMode        : BOOLEAN (online vs offline)
├─ masterDeviceId      : TEXT (UUID tablette master)
├─ masterDeviceName    : TEXT (nom affichable de la master)
└─ updatedAt           : TIMESTAMP
```

### Table `users`

Comptes staff pour authentification.

```sql
users
├─ id                  : INTEGER PRIMARY KEY
├─ username            : TEXT UNIQUE
├─ passwordHash        : TEXT (bcrypt ou legacy SHA-256)
├─ roles               : JSONB (array: ['admin', 'staff_zombie', ...])
├─ lastLoginAt         : TIMESTAMP
└─ createdAt           : TIMESTAMP
```

**Normalisé en Vague 5** : `roles` est maintenant un **JSONB array** (au lieu de string JSON).

### Table `server_events`

Event-store serveur (ADR-003) pour reconciliation offline.

```sql
server_events
├─ id                  : TEXT PRIMARY KEY (UUID v4)
├─ clientEventId       : TEXT (lien vers ClientEvent IndexedDB)
├─ type                : TEXT (e.g., 'participant.update')
├─ payload             : JSON (données métier)
├─ deviceId            : TEXT (UUID tablette source)
├─ lamportTimestamp    : INTEGER (ordre causal)
├─ sequenceNumber      : INTEGER
├─ userId              : TEXT (user qui a trigger)
├─ ipAddress           : TEXT
└─ createdAt           : TIMESTAMP
```

## Flux métier typiques

### 1. Enregistrement d'un participant

```
1. Bénévole scanne le QR du participant
   → Portail visiteur (code secret + 1ère lettre nom)
2. Participant se connecte
3. Système affiche recap (type, squad, repas gratuit?, créneau)
4. Bénévole distribue :
   - Ticket repas
   - Bouteille d'eau
   - Insigne/brassard
   - Briefing squad
5. Marquer checklistCompleted = true
6. Enregistrement terminé (audit_log: CREATE participants)
```

### 2. Achat à la boutique

```
1. Participant (ou staff pour lui) scanne QR à la boutique
2. Système détecte : type participant → applique réduction en cascade
3. Affiche prix final (avec discount appliqué %)
4. Validation paiement
5. INSERT purchases avec :
   - clientEventId = UUID v4 (idempotence)
   - discountApplied = % réduction
   - totalPrice = (originalPrice - discount) * qty
6. Si mode offline : Event local + IndexedDB
7. Si mode online : Mutation serveur immédiate
8. Broadcast WebSocket → sync all tablets (update stock, UI)
```

### 3. Modification de squad

```
1. Staff recrute/transfère un participant
2. PUT /api/participants/{id} { squadId: 5 }
3. Serveur :
   - Valide squad existe et n'est pas full
   - UPDATE participants.squadId
   - INSERT squad_audit_log (oldSquad → newSquad)
   - Enregistre audit_log (CREATE squad_audit_log)
4. WebSocket broadcast → all tablets
5. UI maj : participant affiche nouvelle squad
```

### 4. Fin d'événement

```
1. Admin : POST /api/admin/end-event
2. Serveur itère tous les participants avec email
3. Pour chaque participant :
   - SELECT purchases WHERE participantId
   - SELECT meal_purchases WHERE participantId
   - Génère PDF (pdfkit) : badge, achats, repas
   - Envoie email (nodemailer + Outlook SMTP) + PDF attachment
   - SSE stream update progress
4. Admin voit barre de progression en temps réel
5. Post-event : emails dans les boîtes réceptions
```

## Index et performance

Afin de garantir des requêtes < 100ms en mode temps réel :

| Index | Raison |
|-------|--------|
| `participants(type, timeSlotId)` | Filtrer par type/créneau fréquent |
| `purchases(participantId, purchasedAt)` | Historique achat par participant |
| `meal_purchases(participantId)` | Tickets repas par participant |
| `squads(timeSlotId, number, type)` | Finder une squad rapidement |
| `audit_logs(createdAt DESC)` | Audit trail chronologique |
| `purchases(clientEventId) UNIQUE (WHERE NOT NULL)` | Idempotence (ADR-005) |
| `server_events(deviceId, lamportTimestamp)` | Event-sourcing reconciliation |

---

**Voir aussi** :
- [03-authentification-roles.md](./03-authentification-roles.md) — Rôles et droits
- [04-synchronisation.md](./04-synchronisation.md) — Event-sourcing et Lamport
- [05-sauvegardes-restauration.md](./05-sauvegardes-restauration.md) — Backup de ce modèle
