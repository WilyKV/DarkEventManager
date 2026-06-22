# Déploiement DarkEventManager — Jetson Orin Nano

## Architecture

```
GitHub (push tag vX.Y.Z)
        │
        ▼
GitHub Actions (workflow .github/workflows/deploy.yml)
        │  déclenche
        ▼
Runner self-hosted ──────────► Jetson Orin Nano (aarch64)
  (sur le Jetson)                    │
        │                           │  docker compose -p darkevent
        │                           │  -f .docker/docker-compose.prod.yml
        ▼                           ▼
  scripts/deploy.sh      ┌──────────────────────┐
        │                │ darkevent_db           │ (postgres:17-alpine)
        │                │ darkevent_app          │ (Dockerfile.prod)
        │                │ réseau: darkevent_default │
        │                └──────────────────────┘
        │
        └─ NE TOUCHE PAS aux 13 autres conteneurs du Jetson
```

### Pourquoi runner self-hosted ?

- **Pas de registry externe** : l'image est buildée nativement sur le Jetson (arm64), éliminant les problèmes de cross-compilation et de transfert réseau.
- **Build natif arm64** : pas de QEMU, les performances sont optimales sur la RAM limitée du Jetson (7.4Gi).
- **Isolation via `-p darkevent`** : le project name Docker scoppe tous les objets (conteneurs, volumes, réseaux) au projet, sans risque de collision avec les autres services.
- **Pas de NAT entrant** : le Jetson n'a pas besoin d'être joignable depuis GitHub ; c'est le runner qui poll GitHub.

---

## Prérequis — Setup one-shot (ordre important)

### Étape 1 : Créer les répertoires persistants

```bash
# Seul backups/ est un répertoire hôte (dumps SQL).
# uploads/ est désormais un volume Docker nommé (darkevent_uploads) —
# il est créé automatiquement au premier "docker compose up".
mkdir -p ~/DarkEventManager/backups
```

### Étape 2 : Créer le fichier `.env` de production

```bash
nano ~/DarkEventManager/.env
chmod 600 ~/DarkEventManager/.env
```

Contenu minimal requis :

```dotenv
# === Application ===
NODE_ENV=production
# PORT interne du conteneur (ne pas changer) ; APP_PORT modifie le port hôte
# APP_PORT=5000

# === Base de données ===
# Géré automatiquement par docker-compose.prod.yml ; laisser vide ou cohérent :
DATABASE_URL=postgres://darkevent:darkevent@db:5432/darkevent

# === Sécurité des sessions (OBLIGATOIRE — changer en prod) ===
SESSION_SECRET=REMPLACER_PAR_UNE_CHAINE_ALEATOIRE_LONGUE

# === WebSocket HMAC (OBLIGATOIRE — valeur fixe pour multi-instance) ===
WEBSOCKET_SECRET=REMPLACER_PAR_UNE_CHAINE_ALEATOIRE_FIXE

# === Chiffrement QR (OBLIGATOIRE — valeur fixe pour cohérence entre redémarrages) ===
QR_ENCRYPTION_KEY=REMPLACER_CLE_AES256_32_OCTETS_HEX
QR_ENCRYPTION_IV=REMPLACER_IV_16_OCTETS_HEX

# === Email (Outlook SMTP) ===
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre@email.com
SMTP_PASS=votre_mot_de_passe
EMAIL_FROM=votre@email.com
EMAIL_FROM_NAME=DarkEventManager

# === Dev uniquement (ne pas définir en prod) ===
# DEV_EMAIL_OVERRIDE=test@example.com
```

> **Attention** : `SESSION_SECRET`, `WEBSOCKET_SECRET`, `QR_ENCRYPTION_KEY` et `QR_ENCRYPTION_IV` doivent être des valeurs aléatoires fixes (ne pas changer après le premier déploiement au risque d'invalider les sessions et les QR codes existants).

Générer des valeurs sécurisées :

```bash
# SESSION_SECRET (64 caractères)
openssl rand -hex 32

# WEBSOCKET_SECRET
openssl rand -hex 32

# QR_ENCRYPTION_KEY (32 octets = 64 hex)
openssl rand -hex 32

# QR_ENCRYPTION_IV (16 octets = 32 hex)
openssl rand -hex 16
```

### Étape 3 : Installer et enregistrer le runner GitHub Actions

Sur le Jetson, en tant que `wilykv` :

```bash
# Créer le dossier runner
mkdir -p ~/actions-runner && cd ~/actions-runner

# Télécharger la dernière version arm64 depuis :
# https://github.com/WilyKV/DarkEventManager/settings/actions/runners/new
# (GitHub génère la commande curl exacte avec le token d'enregistrement)
curl -o actions-runner-linux-arm64-X.Y.Z.tar.gz -L \
    https://github.com/actions/runner/releases/download/vX.Y.Z/actions-runner-linux-arm64-X.Y.Z.tar.gz
tar xzf actions-runner-linux-arm64-X.Y.Z.tar.gz

# Enregistrer le runner avec les labels requis par le workflow
./config.sh \
    --url https://github.com/WilyKV/DarkEventManager \
    --token TOKEN_GITHUB_GENERE \
    --labels "self-hosted,linux,ARM64" \
    --name "jetson-orin-nano" \
    --unattended

# Installer comme service systemd et démarrer
sudo ./svc.sh install
sudo ./svc.sh start

# Vérifier le statut
sudo ./svc.sh status
```

> Le token d'enregistrement est valable 1 heure. En générer un depuis :
> `https://github.com/WilyKV/DarkEventManager/settings/actions/runners`

### Étape 4 : Exposition via le reverse proxy nginx (darkevent.wilykv.fr)

Le reverse proxy du Jetson est le conteneur `nginx_proxy` (image `nginx:alpine`).
Ses fichiers de conf sont dans `~/JetsonProxy/conf.d/` (montés en `:ro`).
Le rechargement se fait via `cd ~/JetsonProxy && make reload` (graceful, sans downtime).

Le fichier de conf nginx prêt à l'emploi se trouve dans le repo :
`.docker/nginx/darkevent.wilykv.fr.conf`

#### Procédure ordonnée (à exécuter dans cet ordre exact)

**1. Créer l'enregistrement DNS**

Ajouter un enregistrement `A` chez votre registrar DNS :
```
darkevent.wilykv.fr  →  <IP publique du Jetson>
```
Attendre la propagation DNS (quelques minutes à quelques heures selon le TTL).

**2. Générer le certificat SSL Let's Encrypt**

> **Attention** : cette commande stoppe nginx_proxy environ 30 secondes
> (mode standalone certbot). Tous les sites proxifiés par le Jetson seront
> brièvement inaccessibles. Faire cette opération **hors heure de pointe**.

```bash
cd ~/JetsonProxy
make ssl-init DOMAIN=darkevent.wilykv.fr EMAIL=wilykv@gmail.com
```

Le cert est stocké dans le volume `jetsonproxy_certbot_certs` monté sur
`/etc/letsencrypt` dans `nginx_proxy`. Le chemin attendu dans la conf nginx :
```
/etc/letsencrypt/live/darkevent.wilykv.fr/fullchain.pem
/etc/letsencrypt/live/darkevent.wilykv.fr/privkey.pem
```

**3. Copier la conf nginx**

```bash
# Depuis la racine du repo cloné sur le Jetson (ex: ~/DarkEventManager)
cp .docker/nginx/darkevent.wilykv.fr.conf ~/JetsonProxy/conf.d/darkevent.wilykv.fr.conf
```

**4. S'assurer que darkevent_app est démarré et sur le réseau `proxy`**

Le `docker-compose.prod.yml` déclare déjà le service `app` sur les réseaux
`default` et `proxy`. Il suffit que le conteneur soit lancé :

```bash
docker compose -p darkevent -f ~/DarkEventManager/.docker/docker-compose.prod.yml up -d app
```

Vérifier que `darkevent_app` est bien attaché au réseau `proxy` :
```bash
docker network inspect proxy | grep darkevent_app
```

**5. Recharger nginx_proxy**

```bash
cd ~/JetsonProxy && make reload
```

Le reload est graceful (pas d'interruption de service pour les autres sites).
Vérifier que DarkEventManager est accessible sur `https://darkevent.wilykv.fr`.

#### Isolation réseau — garanties

- Le réseau `proxy` est déclaré `external: true` dans notre compose : **il n'est
  PAS recréé ni détruit** par nos opérations `up`/`down`. Aucun risque pour les
  autres projets hébergés sur le Jetson.
- Le service `db` (darkevent_db) est exclusivement sur le réseau `darkevent_default`
  (réseau interne). Il n'est **jamais** joignable depuis le réseau `proxy` partagé.
  Seul `darkevent_app` a accès aux deux réseaux, ce qui est le minimum requis.

---

## Procédure de release

```bash
# 1. S'assurer que main est à jour et les tests passent
git checkout main
git pull
npm test

# 2. Taguer la version
git tag v1.2.3
git push origin v1.2.3

# GitHub Actions déclenche automatiquement le déploiement.
# Suivre les logs : https://github.com/WilyKV/DarkEventManager/actions
```

---

## Commandes diagnostic (toujours scopées -p darkevent)

```bash
# Alias pratique
alias dc-prod='docker compose -p darkevent -f ~/DarkEventManager/.docker/docker-compose.prod.yml'
# (adapter le chemin si le repo est cloné ailleurs)

# État des conteneurs
dc-prod ps

# Logs de l'application (suivi temps réel)
dc-prod logs -f app

# Logs de la base de données
dc-prod logs -f db

# Connexion psql directe
dc-prod exec db psql -U darkevent darkevent

# Redémarrer l'application sans toucher la DB
dc-prod restart app

# Arrêter proprement (SANS -v pour conserver les données)
dc-prod down

# Lancer manuellement une migration
# (le service db-migrate n'a plus de "profiles:" — run fonctionne directement)
dc-prod run --rm db-migrate
```

---

## Rollback manuel

```bash
# Lister les images darkevent disponibles (les builds taguent TAG + latest)
docker images | grep darkevent-app

# Rollback sur un tag précédent : re-tagger l'image voulue en latest puis relancer
docker tag darkevent-app:v1.1.0 darkevent-app:latest
dc-prod up -d app

# Ou relancer deploy.sh depuis n'importe quel répertoire contenant le repo au bon tag
# (le script utilise des chemins absolus, le cwd n'a pas d'importance)
bash /chemin/vers/repo/scripts/deploy.sh v1.1.0

# Ou restaurer le dump SQL
dc-prod exec -T db psql -U darkevent darkevent \
    < ~/DarkEventManager/backups/dump_YYYYMMDD_HHMMSS.sql
```

---

## Avertissements importants

### Sessions in-memory

Les sessions utilisateur sont stockées en mémoire (memorystore). Tout redémarrage du conteneur `app` déconnecte tous les utilisateurs. Planifier les déploiements **hors événement** ou pendant une pause.

### `db:push` déclaratif potentiellement destructif

`drizzle-kit push` compare le schéma défini dans `shared/schema.ts` avec la base réelle et applique les différences de manière déclarative. Il peut supprimer des colonnes ou tables sans migration SQL traditionnelle. Le dump pré-migration (`backups/`) est la seule protection : **ne jamais supprimer les backups récents**.

### Port UDP 8888 non publié

La découverte LAN des appareils (offline-mode) utilise le port UDP 8888. Ce port n'est pas publié dans le compose prod. Si le mode offline avec plusieurs appareils est utilisé, ajouter `ports: - "8888:8888/udp"` dans le service `app`.

### Volume nommé `darkevent_uploads`

Les fichiers uploadés sont stockés dans le volume Docker nommé `darkevent_uploads` (plus de bind mount `../uploads` fragile via symlink). Le volume est créé automatiquement au premier `docker compose up`. Pour inspecter ou sauvegarder son contenu :

```bash
# Inspecter le volume
docker volume inspect darkevent_uploads

# Copier le contenu vers l'hôte (backup manuel)
docker run --rm \
    -v darkevent_uploads:/data \
    -v ~/DarkEventManager/uploads-backup:/backup \
    alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

### `bufferutil` optionnel

`bufferutil` (dépendance optionnelle de `ws`) n'a pas de prebuild pour arm64. Le build tente de le compiler depuis les sources (python3/make/g++ présents dans l'image) et retombe automatiquement sur le fallback JavaScript si la compilation échoue. Aucune action requise.

### Réseau `proxy` externe

Le service `app` est attaché au réseau externe `proxy` dans `docker-compose.prod.yml`.
Ce réseau est déclaré `external: true` : il n'est ni créé ni supprimé par ce projet,
il appartient à `JetsonProxy`. Le service `db` reste exclusivement sur le réseau interne
`darkevent_default` — il n'est jamais exposé au réseau proxy partagé. Voir l'Étape 4
de la procédure de déploiement pour la mise en service complète.
