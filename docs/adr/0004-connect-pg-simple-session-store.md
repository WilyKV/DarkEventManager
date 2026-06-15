# ADR-004 : connect-pg-simple comme session store

**Statut** : Accepté

**Date** : 2024-Q3

## Contexte

**Problème** : L'app utilise `express-session` pour persister les sessions utilisateur (staff + visiteurs). Actuellement, les sessions sont stockées en **MemoryStore** (défaut développement), ce qui signifie :

- Toute redémarrage de l'app = tous les utilisateurs se déconnectent
- Pas de persistance multi-instance (si l'on voulait plusieurs serveurs)
- Croissance mémoire incontrôlée (pas d'expiration automatique)

**Contexte opérationnel** :
- Événement : durée 4-6h, une instance serveur (Pi)
- Bénévoles : ~100-200 connectés simultanément
- Tablettes : 20-30 en opération
- Visiteurs (code secret) : sessions courtes, peu de rétention requise

**Contraintes** :
- Pas de service externe (Redis) en caverne
- PostgreSQL est déjà présent (data app)
- Persistance post-redémarrage souhaitable (restart = sauvegarde DB)
- Performance acceptable pour ~200 sessions

**Hypothèses** :
- Performance `connect-pg-simple` suffisante (< 50ms par req)
- Pas de multi-instance (1 Pi = 1 processus Node)
- Table `sessions` peut être nettoyée post-événement

## Décision

**Utiliser `connect-pg-simple` pour persister les sessions dans PostgreSQL** au lieu de MemoryStore.

### Configuration

```typescript
// server/index.ts — ajouter au démarrage
import session from 'express-session';
import PgSimple from 'connect-pg-simple';
import pg from 'pg';

const sessionStore = new (PgSimple(session))({
  pool: db.pool, // réutiliser pool PG existant
  tableName: 'sessions',
  createTableIfMissing: true, // auto-création table
  ttl: 86400, // 24h
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'insecure-dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400 * 1000, // 24h en ms
  },
}));
```

### Schéma table (auto-généré par connect-pg-simple)
```sql
CREATE TABLE sessions (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp NOT NULL
);
CREATE INDEX idx_sessions_expire ON sessions (expire);
```

### Déploiement
```bash
# Avant/pendant démarrage (inclus dans make db-push)
npm run db:push # Drizzle push
# connect-pg-simple createTableIfMissing gère le reste
```

## Conséquences

### Positives
- ✅ **Persistance** : sessions survivent redémarrage serveur
- ✅ **Aucun service externe** : lié à PG déjà présent
- ✅ **Performance acceptable** : ~20-30ms par session read (vs <1ms in-memory, vs 5-10ms Redis)
- ✅ **Audit trail** : sessions queryables pour debug
- ✅ **Cleanup automatique** : TTL + index expiré = requête de nettoyage simplement exécutée
- ✅ **Compatible multi-instance** : si jamais on scale horizontalement

### Négatives
- ❌ **Perf vs MemoryStore** : +20ms latence par requête authentifiée
- ❌ **Accès base de données** : session check = requête PG (vs lookup mémoire)
- ❌ **Croissance table** : sessions pas auto-supprimées (nettoyage manuel recommandé)
- ❌ **Dépendance PG** : si crash BDD, sessions inaccessibles (mais tout crash)

### Mitigation
- Index sur `expire` pour cleanup rapide
- Cron job post-événement : `DELETE FROM sessions WHERE expire < NOW()`
- Monitoring taille table (`SELECT count(*) FROM sessions`)
- Fallback MemoryStore en dev (configurable par env var)

## Alternatives considérées

### 1. **Redis avec connect-redis**
```typescript
const redisClient = redis.createClient({ host: 'localhost', port: 6379 });
const sessionStore = new RedisStore({ client: redisClient });
```
- ✅ Performance ultra-rapide (< 5ms)
- ✅ Cluster-ready
- ❌ Service externe requis (coût infra caverne)
- ❌ Pas de persistance (RAM = perte au redémarrage)
- ❌ Nécessite sysadmin pour déployer Redis

### 2. **MemoryStore (courant)**
- ✅ Rapide, simple, zéro config
- ❌ Pas de persistance
- ❌ Multi-instance impossible
- ❌ Croissance mémoire infinie

### 3. **File system (express-session-file-store)**
```typescript
const FileStore = require('session-file-store')(session);
const sessionStore = new FileStore();
```
- ✅ Aucune dépendance BDD
- ✅ Persistance facile
- ❌ I/O disque lent (> 100ms)
- ❌ Cleanup complexe (script cron custom)
- ❌ NAS fragile en caverne

### 4. **JSON dans `appConfig` (bespoke)**
- ✅ Très simple
- ❌ Pas de TTL/expiration
- ❌ Scalabilité mauvaise (parse JSON à chaque req)
- ❌ Limite 1-2 utilisateurs

## Implémentation

### Étapes
1. ✅ `npm install connect-pg-simple`
2. ❌ Ajouter `PgSimple` store à `server/index.ts` (en attente)
3. ❌ Tester avec `npm run test:server` (attente)
4. ❌ Déploiement : `make db-push` (attente)
5. ❌ Cleanup post-événement (script SQL)

### Script cleanup (à documenter)
```sql
-- Après l'événement
DELETE FROM sessions WHERE expire < NOW();
VACUUM sessions; -- récupérer espace
```

## Performance estimée

| Opération | MemoryStore | PG Simple | Redis |
|-----------|-------------|-----------|-------|
| Session check | <1ms | ~25ms | ~5ms |
| Par 100 req/s | neg. | 2.5s CPU | 0.5s CPU |
| Mémoire (1k sessions) | ~5MB | 0MB (BDD) | ~1MB |
| Persistance | NON | OUI | NON |
| Multi-instance | NON | OUI | OUI |

**Verdict** : Acceptable pour 1 Pi + 200 sessions (max impact ≈ 50ms par UX render cycle).

## Voir aussi

- [CLAUDE.md](../../CLAUDE.md) — Auth & Sessions : MemoryStore actuellement
- [connect-pg-simple docs](https://github.com/voxpelli/node-connect-pg-simple)
