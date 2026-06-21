# Sauvegardes et restauration : Garantir la continuité

## Où vivent les données

DarkEventManager stocke les données en deux endroits :

### 1. PostgreSQL serveur (source de vérité)

**Conteneur Docker** : `darkevent_db`

```
Hôte: localhost:5434
Conteneur: 5432
Credentials: darkevent / darkevent
Database: darkevent
Volume: postgres_data (persistant entre redémarrages)
```

**Contient** :
- Tous les participants, achats, repas
- Audit logs complets (traçabilité)
- Server events (event-sourcing)
- Configuration sync
- Sessions (optionnel, si `connect-pg-simple`)

### 2. IndexedDB local (tablettes)

**Browser-side storage** sur chaque appareil :

```
Database: darkeventmanager-events
Tables:
  - events (AppEvent records)
  - meta (Lamport counter)
Storage: Persistant dans le navigateur / PWA
Capacité: ~50MB par device (dépend du navigateur)
```

**Contient** :
- Événements locaux (avant sync)
- Cache des données serveur (pour offline)
- État application (React Query)

**Pas une backup** : perte du navigateur = perte des events non-synced.

## Stratégie de sauvegarde

### Sauvegarde PostgreSQL (Critique)

**Fréquence recommandée** :
- **Pendant l'événement** : Toutes les 30 minutes
- **Après l'événement** : 1x avant archivage
- **En production** : Quotidienne ou continu (selon SLA)

### Commande pg_dump via Docker

**Snapshot unique** :
```bash
docker exec darkevent_db pg_dump \
  -U darkevent \
  -d darkevent \
  --format=custom \
  --file=/tmp/backup.dump

docker cp darkevent_db:/tmp/backup.dump ./backup_$(date +%Y%m%d_%H%M%S).dump
```

**Format plain SQL** (lisible) :
```bash
docker exec darkevent_db pg_dump \
  -U darkevent \
  -d darkevent \
  --format=plain \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Avec options de performance** :
```bash
docker exec darkevent_db pg_dump \
  -U darkevent \
  -d darkevent \
  --jobs=4 \
  --format=directory \
  --file=/tmp/backup_dir
```

### Sauvegarde Docker volume

**Snapshot complet du volume** (recommandé pour production) :

```bash
# Stopper le conteneur (optionnel mais plus sûr)
docker-compose -f .docker/docker-compose.yml down

# Créer un snapshot
docker run --rm -v postgres_data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_$(date +%Y%m%d_%H%M%S).tar.gz /data

# Relancer
docker-compose -f .docker/docker-compose.yml up -d
```

### Sauvegarde fichiers uploads

PDFs générés lors de fin d'événement :

```bash
docker cp darkevent_app:/app/uploads ./uploads_backup_$(date +%Y%m%d)
```

## Restauration

### Cas 1 : Base de données corrompue

**From dump SQL** :

```bash
# Recréer DB clean
docker exec darkevent_db dropdb -U darkevent darkevent
docker exec darkevent_db createdb -U darkevent darkevent

# Restaurer depuis dump
docker exec -i darkevent_db psql -U darkevent darkevent \
  < backup_20240620_120000.sql

# Appliquer schéma (si needed)
make db-push
```

**From custom format dump** :

```bash
docker exec -i darkevent_db pg_restore \
  -U darkevent \
  -d darkevent \
  --single-transaction \
  < backup.dump
```

### Cas 2 : Conteneur entièrement perdu

```bash
# Arrêter tout
docker-compose -f .docker/docker-compose.yml down

# Supprimer le volume (ATTENTION: perte de data)
docker volume rm postgres_data

# Redémarrer
docker-compose -f .docker/docker-compose.yml up -d

# Restaurer depuis backup
docker exec -i darkevent_db psql -U darkevent darkevent \
  < backup_20240620_120000.sql

# Vérifier intégrité
docker-compose -f .docker/docker-compose.yml exec app npm run check
```

### Cas 3 : Récupération post-événement

Après l'événement, si tablettes offline ont des events non-synced :

```bash
# 1. Redémarrer le serveur
make up

# 2. Vérifier intégrité DB
docker-compose -f .docker/docker-compose.yml exec app npm run check

# 3. Vérifier que master device sync
# (via interface ou logs)
docker-compose -f .docker/docker-compose.yml logs app | grep bulk-ingest

# 4. Si succès: master device = ready
# Si échec: investiguer (voir section Réconciliation)
```

## Schéma de données applicables via drizzle-kit push

**Important** : Le schema est appliqué via `drizzle-kit push`, **pas via migrations SQL**.

```bash
# Appliquer le schéma (safe, idempotent)
make db-push

# Ou manuellement
npm run db:push
```

**Conséquence critique** : Si vous modifiez `shared/schema.ts`, **faire un backup AVANT** :

```bash
# Backup PRÉ-modification
docker exec darkevent_db pg_dump -U darkevent darkevent \
  > backup_before_schema_change_$(date +%Y%m%d_%H%M%S).sql

# Modifier shared/schema.ts
vi shared/schema.ts

# Appliquer
make db-push

# Si erreur: restore
docker exec -i darkevent_db psql -U darkevent darkevent \
  < backup_before_schema_change_*.sql
```

## Réconciliation offline (Bulk ingest)

### Problème

Tablette master offline capture N événements. Quand Pi revient :

```
IndexedDB (tablette):
  [event1, event2, event3, ...]  (clientEventId, lamportTs local)

PostgreSQL (serveur):
  Vierge de ces events
```

### Solution : Bulk ingest

Endpoint : `POST /api/events/bulk-ingest` (server/sync-routes.ts)

```bash
curl -X POST http://pi.local:5000/api/events/bulk-ingest \
  -H "Content-Type: application/json" \
  -H "X-Device-ID: device-uuid" \
  -d '{
    "events": [
      {
        "eventUuid": "uuid-1",
        "clientEventId": "uuid-client-1",
        "aggregateId": "42",
        "aggregateType": "participant",
        "eventType": "participant.assigned_to_squad",
        "payload": { "squadId": 5 },
        "deviceId": "device-uuid",
        "lamportTs": 100,
        "wallClockTs": 1234567890000
      },
      ...
    ]
  }'
```

**Traitement serveur** :

```typescript
// server/sync-routes.ts
app.post('/api/events/bulk-ingest', checkSyncPermissions, async (req, res) => {
  const { events } = req.body;
  
  // Transaction atomique
  db.transaction(() => {
    for (const event of events) {
      // 1. Compute new Lamport
      let newLamport = Math.max(event.lamportTs, lastServerLamport) + 1;
      lastServerLamport = newLamport;
      
      // 2. Store server_events
      db.insert(serverEvents).values({
        id: crypto.randomUUID(),
        clientEventId: event.clientEventId,
        type: event.eventType,
        payload: event.payload,
        lamportTimestamp: newLamport,
        ...
      });
      
      // 3. Apply mutation (INSERT/UPDATE participant, purchase, etc.)
      applyEventToDatabase(event);
      
      // 4. Log audit
      createAuditLog({ action: 'SYNC', ... });
    }
  });
  
  res.json({
    processed: events.length,
    newLamports: [...],
    status: 'reconciled'
  });
});
```

### Garanties de réconciliation

✅ **Atomicité** : Tous les events traitent ou aucun  
✅ **Déterminisme** : Même ordre sur replay (Lamport)  
✅ **Idempotence** : Rejeu d'event avec même `clientEventId` = SKIP  
✅ **Audit** : Chaque event enregistré dans `server_events` + `audit_logs`

### Fallback si Pi toujours down

Si Pi ne se rétablit pas pendant l'événement :

1. **Master device continue** en mode offline-first
2. **Autres tablettes** : lecture seule (cache service worker)
3. **Post-événement** : Exporter data master → USB
4. **Restaurer** sur nouveau Pi :

```bash
# Sur master: export IndexedDB
# (script custom: serialize IndexedDB → JSON)

# Sur nouveau Pi: import JSON → PostgreSQL
# (script custom: parse JSON → INSERT statements)

make db-push  # Ensure schema
npm run migrate:roles  # If needed
```

## Stratégie Disaster Recovery

### RTO (Recovery Time Objective) : 1h
### RPO (Recovery Point Objective) : 30 min

### Checklist

| Scénario | Action | Temps |
|----------|--------|-------|
| Pi reboot | Conteneur redémarre auto | 2 min |
| Disk plein | Nettoyer logs, PDFs vieux | 10 min |
| DB corruption | Restore depuis backup dernier 30min | 15 min |
| Pi hardware failure | Swapper Pi + restore backup | 30 min |
| WiFi down | Master device mode offline | Immédiat |
| Power loss | Battery Pi + tablettes | 4-6h autonomie |

### Pré-événement (Test failover)

```bash
# 1. Backup full
make backup  # Custom script

# 2. Shutdown Pi intentionally
docker-compose -f .docker/docker-compose.yml down

# 3. Vérifier tablettes basculent mode offline
# (check logs / UI)

# 4. Tablette master: effectuer mutation
# (scan QR, achat, etc.)

# 5. Redémarrer Pi
docker-compose -f .docker/docker-compose.yml up -d

# 6. Tablette master sync
# (bulk-ingest events)

# 7. Vérifier intégrité data
docker exec darkevent_app npm run check
```

## Monitoring backup

### Logs de backup

Implémenter dans un `make backup` cron :

```bash
#!/bin/bash
BACKUP_DIR="/backups/darkevent"
DATE=$(date +%Y%m%d_%H%M%S)

# Dump DB
docker exec darkevent_db pg_dump \
  -U darkevent -d darkevent \
  > $BACKUP_DIR/db_$DATE.sql

# Check size
SIZE=$(du -h $BACKUP_DIR/db_$DATE.sql | cut -f1)
echo "Backup $DATE: $SIZE" >> $BACKUP_DIR/backup.log

# Keep last 10 backups
ls -t $BACKUP_DIR/db_*.sql | tail -n +11 | xargs rm -f

# Alert if last backup > 1h ago
LAST_BACKUP=$(ls -t $BACKUP_DIR/db_*.sql | head -1 | xargs stat -f %m)
NOW=$(date +%s)
AGE=$(( (NOW - LAST_BACKUP) / 60 ))

if [ $AGE -gt 60 ]; then
  echo "WARNING: Last backup is ${AGE} minutes old" | mail -s "Backup alert" admin@example.com
fi
```

---

**Voir aussi** :
- [01-vue-ensemble.md](./01-vue-ensemble.md) — Architecture générale
- [04-synchronisation.md](./04-synchronisation.md) — Event-sourcing and reconciliation
- [ADR-001](./adr/0001-topologie-raspberry-pi-cave-local.md) — Failover strategy
