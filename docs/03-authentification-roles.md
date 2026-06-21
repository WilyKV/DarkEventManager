# Authentification et gestion des rôles

## Vue d'ensemble

DarkEventManager implémente un **système d'authentification double** :

1. **Staff login** : Username + mot de passe (bcrypt) → Accès administration
2. **Visitor login** : Code secret 5 chiffres + première lettre du nom → Portail visiteur

Les deux tracks sont **mutuellement exclusives** : une session active ne peut être que staff OU visiteur, jamais les deux.

## Architecture des sessions

### Session Express

Les sessions utilisent **express-session** avec une configuration flexible selon l'environnement :

| Configuration | Mode | Détail |
|---------------|------|--------|
| **memorystore** | Défaut dev | Sessions en RAM, perdues au redémarrage (rapide) |
| **connect-pg-simple** | Production (optionnel) | Sessions persistes en PostgreSQL (ADR-004) |

**Cookie** :
- **Nom** : `darkevent.sid` (HTTPOnly pour éviter XSS)
- **Expiration** : 24 heures (`maxAge: 24h`)
- **SameSite** : Lax (CSRF protection)
- **Secure** : true en production (HTTPS uniquement)

Défaillance intentionnelle : redémarrer le serveur **log out tout le monde** (en dev). En prod, utiliser `connect-pg-simple` si sessions multi-requête requises (cf. [ADR-004](./adr/0004-connect-pg-simple-session-store.md)).

### Structure de session

```typescript
// Staff session
req.session.user = {
  id: 42,
  username: "benoit.dupont",
  roles: ["admin", "staff_zombie"],     // Tableau parsé (JSON.parse)
  rolesList?: ["admin", "staff_zombie"],  // Cache parsed
  lastLoginAt: "2024-06-20T14:32:10Z"
}

// Visitor session
req.session.visitor = {
  participantId: 123,
  firstName: "Alice",
  lastName: "Martin",
  secretCode: "04729"
}

// Note: exactement ONE des deux est présent à la fois
```

## Track 1 : Staff Login

### Endpoint
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "benoit.dupont",
  "password": "motdepasse123"
}
```

### Flow

```
Client                       Server (auth-routes.ts)            Database (PostgreSQL)
  │                          │                                   │
  ├─ POST /api/auth/login ──>│                                   │
  │  (username, password)    │                                   │
  │                          ├─ SELECT * FROM users ────────────>│
  │                          │  WHERE username = ...             │
  │                          │<─ user row (if exists) ───────────┤
  │                          │                                   │
  │                          ├─ verifyPassword(pwd, hash)        │
  │                          │  (bcrypt compare)                 │
  │                          │                                   │
  │  ✓ Valide               ├─ session.regenerate()             │
  │                          ├─ session.user = {...}            │
  │                          │                                   │
  │                          ├─ UPDATE users (lastLoginAt) ────>│
  │                          │                                   │
  │<─ 200 OK + session cookie ┤                                   │
  │  (darkevent.sid)         │                                   │
  │                          │                                   │
  │  ✗ Invalid               ├─ INSERT audit_log ───────────────>│
  │                          │  (LOGIN_FAILED)                  │
  │<─ 401 Unauthorized       │                                   │
```

### Sécurité

- **Bcrypt** : Hash password avec salt (coût = 10 par défaut)
- **Lazy migration** : Ancien SHA-256 upgrade to bcrypt on next login (cf. `isLegacyHash()`)
- **Rate-limiting** : 5 tentatives par 15 min per IP+username (cf. `staffLoginLimiter`)
- **Audit** : Chaque échec enregistré dans `audit_logs` (action: `LOGIN_FAILED`)
- **Session regenerate** : Évite fixation d'ID de session

### Rôles

Chaque user possède un tableau de **rôles** (JSONB en PostgreSQL, normalisé en Vague 5) :

| Rôle | Droits |
|------|--------|
| **admin** | Fin d'événement (end-event), gestion users, config sync |
| **staff_zombie** | Gestion participants zombies, scan boutique/repas zombies |
| **staff_survivant** | Gestion participants survivants, scan boutique/repas survivants |
| **staff_repas** | Gestion tous repas (bypass discounts) |
| **staff_boutique** | Gestion stock boutique, modifications prix |

**Avant Vague 5** : `roles` était stocké comme string JSON `"[\"admin\",\"staff_zombie\"]"`. Depuis Vague 5, c'est un vrai array JSONB (cf. `migrate-roles.ts`).

**Client** : `parseUserRoles()` normalise et cache le tableau dans `rolesList`.

### Middlewares

#### `requireAuth`

Vérifie qu'une session active existe (staff ou visitor).

```typescript
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user && !req.session.visitor) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  next();
}
```

#### `requireRole(...roles)`

Vérifie que l'utilisateur staff possède AU MOINS UN des rôles spécifiés.

```typescript
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Non staff" });
    }

    const userRoles = Array.isArray(req.session.user.roles)
      ? req.session.user.roles
      : JSON.parse(req.session.user.roles || "[]");

    if (!roles.some(r => userRoles.includes(r))) {
      return res.status(403).json({ message: "Permission refusée" });
    }

    next();
  };
}
```

**Usage** :
```typescript
app.post('/api/admin/end-event', 
  requireRole('admin'),  // Seulement admin
  endEventHandler
);

app.put('/api/purchases/:id',
  requireRole('staff_boutique', 'staff_repas'),  // L'un ou l'autre
  purchaseHandler
);
```

## Track 2 : Visitor Login

### Endpoint
```
POST /api/auth/visitor-login
Content-Type: application/json

{
  "secretCode": "04729",
  "lastNameFirstLetter": "M"  // ou "m" (case-insensitive)
}
```

### Flow

```
Visiteur                     Server                             Database
  │                          │                                  │
  ├─ Portail visiteur ──────>│ GET /visitor                     │
  │  (interface login)       │                                  │
  │                          ├─ Render form                    │
  │<─ Form HTML ──────────────┤                                  │
  │                          │                                  │
  ├─ POST /api/auth/visitor-login ┤                             │
  │  (code, lastName[0])     │                                  │
  │                          ├─ SELECT FROM participants ──────>│
  │                          │  WHERE secretCode = code         │
  │                          │<─ participant row ──────────────┤
  │                          │                                  │
  │                          ├─ Compare lastName[0] ────────────>│
  │                          │  (case-insensitive)              │
  │                          │                                  │
  │  ✓ Match                 ├─ session.visitor = {...}       │
  │                          ├─ session.user = null            │
  │                          │                                  │
  │<─ 200 OK + session       │                                  │
  │  + redirect /visitor     │                                  │
  │                          │                                  │
  │  ✗ No match              ├─ INSERT audit_log ──────────────>│
  │                          │  (action: LOGIN_FAILED)          │
  │<─ 401 Unauthorized       │                                  │
  │                          │                                  │
```

### Sécurité

- **Rate-limiting** : 10 tentatives par 15 min par IP (`visitorLoginLimiter`)
- **Code secret** : Généré aléatoirement (5 chiffres = 100k combinaisons)
- **Premier caractère** : Case-insensitive, contrôle supplémentaire contre brute-force
- **Audit** : Échecs enregistrés dans `audit_logs`

### Portail visiteur

Les visiteurs accèdent à une interface **restreinte** :

- Afficher leur code secret (pour récupération badge)
- Consulter leurs achats (boutique + repas)
- Consulter leur solde/crédits
- **Pas de modification** : lecteur seulement

Protected par `RequireVisitor` (client-side route guard).

## Logout

### Endpoint
```
POST /api/auth/logout
```

### Flow

```
Session active                Server
  │                           │
  ├─ POST /api/auth/logout ──>│
  │                           ├─ req.session.destroy()
  │                           ├─ res.clearCookie('darkevent.sid')
  │                           │
  │<─ 200 OK ───────────────────┤
  │                           │
```

**Client** : Après logout, `useAuth().checkSession()` met à jour le contexte, routeur redirige vers `/login`.

## Vérification de session

### Endpoint
```
GET /api/auth/session
```

**Retour** :
```json
{
  "user": { "id": 42, "username": "...", "rolesList": [...] },
  "visitor": null
}
// ou
{
  "user": null,
  "visitor": { "participantId": 123, "firstName": "...", "secretCode": "..." }
}
// ou
{
  "user": null,
  "visitor": null
}
```

Appelé au démarrage du client pour **hydrater** `AuthContext`.

## Initialisation de l'admin

Pour la **première utilisation**, créer un utilisateur admin :

```
POST /api/auth/init
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Comportement** :
- Si `users` table est vide → crée admin avec rôle `admin`
- Sinon → refuse (déjà initialisé)

**À changer en production** ! Implémenter une 2FA ou token one-time pour sécuriser cette init.

## Client-side Auth Context

### `AuthProvider`

Fournit un contexte React avec méthodes auth :

```typescript
const {
  user,              // Staff user { id, username, rolesList }
  visitor,           // Visitor { participantId, firstName, ... }
  isLoading,         // Pendant hydratation session
  checkSession,      // Force vérification (async)
  logout,            // Logout (async)
  hasRole,           // user && rolesList.includes(role)
  hasAnyRole,        // user && roles.some()
  hasAllRoles        // user && roles.every()
} = useAuth();
```

### Route Guards

#### `RequireAuth`

Vérifie qu'une session (staff OU visitor) est active :

```typescript
<Route path="/dashboard">
  <RequireAuth>
    <Dashboard />
  </RequireAuth>
</Route>
```

Redirige vers `/login` si non authentifié.

#### `RequireRole`

Vérifie que l'user staff possède les rôles requis :

```typescript
<Route path="/admin">
  <RequireRole roles={['admin']}>
    <AdminPanel />
  </RequireRole>
</Route>
```

Redirige vers `/access-denied` si permission insuffisante.

#### `RequireVisitor`

Vérifie qu'une session visiteur est active :

```typescript
<Route path="/visitor">
  <RequireVisitor>
    <VisitorPortal />
  </RequireVisitor>
</Route>
```

## Normalisations Vague 5

**Modification** : Le champ `users.roles` passe de **string JSON** à **vrai JSONB array**.

**Migration** :
```bash
npm run migrate:roles
# Exécute server/migrations/migrate-roles.ts
# Convertit colonne TEXT en JSONB, parse strings → arrays
```

**Impact** :
- **Server** : `requireRole()` désormais utilise `Array.isArray()` directement
- **Client** : `parseUserRoles()` maintient backward-compat pour paire legacy

---

**Voir aussi** :
- [04-synchronisation.md](./04-synchronisation.md) — Sync permissions middleware
- [08-securite.md](./08-securite.md) — Détails bcrypt, rate-limiting, audit
