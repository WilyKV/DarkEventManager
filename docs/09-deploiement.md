# Guide de déploiement — DarkEventManager (Zomb'in The Dark)

Ce guide fournit les étapes **exactes et complètes** pour déployer DarkEventManager sur un serveur Linux en production. Suivi pas à pas, il garantit un déploiement fonctionnel du jour 1.

## 0. Prérequis

### Serveur Linux
- **OS** : Ubuntu 22.04 LTS, Debian 12, Raspberry Pi OS, ou équivalent
- **Processeur** : ARM64 ou x86-64 (recommandé : quad-core minimum)
- **RAM** : 2 GB minimum (4 GB recommandé)
- **Stockage** : 20 GB libres (SSD de préférence)
- **Accès root/sudo** : Requis pour installation Docker

### Logiciel
- **Docker** : v20.10+ (moteur de conteneurs)
- **Docker Compose** : v2.0+ (orchestration multi-conteneur)
- **openssl** : pour génération de secrets (pré-installé sur Linux)

### Réseau
- **Port 80/443** : Disponibles (reverse proxy HTTPS obligatoire en prod)
- **Port 5000** : Disponible (application Express)
- **Port 5434** : Disponible (PostgreSQL sur l'hôte, optionnel)
- **Nom de domaine** : Recommandé pour HTTPS avec certificat TLS

### Dépendances optionnelles
- **git** : Pour cloner le référentiel
- **curl** : Pour tests HTTP
- **nano** ou **vim** : Édition fichiers `.env`

---

## 1. Récupérer le code

Cloner le référentiel GitHub et naviguer vers le répertoire racine :

```bash
git clone https://github.com/votre-org/darkeventmanager.git
cd darkeventmanager
```

Ou, si déjà cloné, mettre à jour le code :

```bash
cd /chemin/vers/darkeventmanager
git pull origin main
```

---

## 2. Installer Docker et Docker Compose

### Sur Raspberry Pi OS / Debian

```bash
# Télécharger et exécuter le script d'installation Docker officiel
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter l'utilisateur courant au groupe docker (évite sudo)
sudo usermod -aG docker $USER
newgrp docker

# Vérifier l'installation
docker --version
# Output: Docker version 27.x.x, build xxxxx
```

### Installer Docker Compose v2

```bash
# Déterminer le type de processeur
ARCH=$(uname -m)
# Output: aarch64 (ARM) ou x86_64 (Intel)

# Télécharger la dernière version de Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-${ARCH}" \
  -o /usr/local/bin/docker-compose

# Rendre exécutable
sudo chmod +x /usr/local/bin/docker-compose

# Vérifier
docker-compose --version
# Output: Docker Compose version 2.x.x, build xxxxx
```

### Sur macOS (optionnel, pour test local)

```bash
brew install docker docker-compose
# ou installer Docker Desktop (inclut Compose)
```

---

## 3. Créer et remplir le fichier `.env`

### Étape 1 : Copier le template

```bash
cp .env.example .env
```

### Étape 2 : Générer les secrets cryptographiques

**Ouvrir un terminal et générer chaque clé secrète :**

```bash
# Générer WEBSOCKET_SECRET (32 octets hex)
openssl rand -hex 32
# Output: a3f2b8c9e1d4f6a7b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f

# Générer SESSION_SECRET (32 octets hex)
openssl rand -hex 32
# Output: b4f3c9d0e2e5g7a8b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f

# Générer QR_ENCRYPTION_KEY (32 octets hex)
openssl rand -hex 32
# Output: c5g4d0e1f3f6h8a9b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f

# Générer QR_ENCRYPTION_IV (16 octets hex)
openssl rand -hex 16
# Output: d6h5e1f2g4g7i9a0b5c6d7e8f9a0b1c2
```

**Copier et conserver chaque valeur générée.**

### Étape 3 : Éditer le fichier `.env`

```bash
nano .env
# ou vim, ou un autre éditeur
```

**Remplir avec ce template (remplacer les valeurs en majuscules par les vôtres) :**

```env
# === ENVIRONNEMENT ET PORT ===
NODE_ENV=production
PORT=5000

# === DATABASE ===
# En Docker, le conteneur app accède à "db:5432" automatiquement
# Cette variable est SURCHARGÉE par docker-compose.yml (priorité haute)
DATABASE_URL=postgres://darkevent:darkevent@db:5432/darkevent

# === SESSION ===
# Copier la valeur générée par: openssl rand -hex 32
SESSION_SECRET=COLLEZ_ICI_LE_SESSION_SECRET_GENERE

# === WEBSOCKET (OBLIGATOIRE en prod) ===
# Copier la valeur générée par: openssl rand -hex 32
# Si absent, le serveur refuse de démarrer avec erreur "WEBSOCKET_SECRET is required"
WEBSOCKET_SECRET=COLLEZ_ICI_LE_WEBSOCKET_SECRET_GENERE

# === CHIFFREMENT QR CODES ===
# Copier la valeur générée par: openssl rand -hex 32
QR_ENCRYPTION_KEY=COLLEZ_ICI_LE_QR_ENCRYPTION_KEY_GENERE

# Copier la valeur générée par: openssl rand -hex 16
# Obsolète (migré en AES-GCM), à conserver pour compatibilité
QR_ENCRYPTION_IV=COLLEZ_ICI_LE_QR_ENCRYPTION_IV_GENERE

# === SMTP (pour emails fin d'événement) ===
# Utiliser Outlook/Microsoft (recommandé)
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@outlook.com
SMTP_PASS=votre-app-password

# === ADRESSE EMAIL ===
EMAIL_FROM=votre-email@outlook.com
EMAIL_FROM_NAME=Zomb'in The Dark

# === MODE DÉVELOPPEMENT UNIQUEMENT ===
# En développement, tous les emails sont redirigés vers cette adresse
# LAISSER VIDE en production
DEV_EMAIL_OVERRIDE=
```

**Explications clés :**

- `NODE_ENV=production` : Force le conteneur Docker en mode production (sert le build Vite, pas de hot-reload)
- `DATABASE_URL` : Surchargée automatiquement par `docker-compose.yml` → utilise l'URL interne du conteneur (db:5432)
- `SESSION_SECRET` et `WEBSOCKET_SECRET` : **OBLIGATOIRES**. Sans eux, le serveur refuse de démarrer
- `QR_ENCRYPTION_KEY` et `QR_ENCRYPTION_IV` : Déchiffrage des codes QR participants
- `SMTP_*` : Optionnel mais nécessaire pour la génération de récapitulatifs PDF + emails

### Étape 4 : Configurer l'email (Outlook)

**Créer un "App Password" Outlook** (requis si 2FA activé) :

1. Aller à https://account.microsoft.com/security
2. Activer l'authentification à deux facteurs (si pas encore fait)
3. Section "App passwords" → Créer un nouveau mot de passe
4. Sélectionner "Mail" et "Windows"
5. Copier le mot de passe 16 caractères → Coller dans `SMTP_PASS`

**Alternative : Gmail (SMTP 2FA)**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-app-password
```

### Étape 5 : Protéger le fichier `.env`

```bash
# Restreindre la lecture au propriétaire uniquement
chmod 600 .env

# Vérifier (affiche "-rw-------")
ls -la .env
```

---

## 4. Construire et démarrer l'application

### Étape 1 : Construire les images Docker

```bash
# Depuis le répertoire racine du projet
make build

# OU directement avec docker-compose :
docker-compose -f .docker/docker-compose.yml build --no-cache
```

**Cela va** :
- Télécharger l'image node:22-alpine
- Installer toutes les dépendances npm
- Compiler le frontend React (Vite)
- Compiler le backend Express (esbuild)

**Durée** : ~3-5 minutes selon la connexion réseau.

### Étape 2 : Démarrer les conteneurs

```bash
make up

# OU directement :
docker-compose -f .docker/docker-compose.yml up -d --remove-orphans
```

**Cela va** :
- Créer et démarrer le conteneur PostgreSQL (`darkevent_db`)
- Attendre la santé du DB (healthcheck pg_isready)
- Créer et démarrer le conteneur app (`darkevent_app`)

**Durée** : ~10-15 secondes pour full startup.

### Étape 3 : Vérifier le démarrage

```bash
# Voir les logs en temps réel
make logs

# OU :
docker-compose -f .docker/docker-compose.yml logs -f
```

**Attendre le message** :
```
darkevent_app  | Server running on port 5000
darkevent_app  | Database connected
```

Puis appuyer sur `Ctrl+C` pour quitter les logs.

### Étape 4 : Vérifier les conteneurs actifs

```bash
docker-compose -f .docker/docker-compose.yml ps

# Output :
# NAME            STATUS       PORTS
# darkevent_db    Up 10s       5434->5432/tcp
# darkevent_app   Up 5s        5000->5000/tcp
```

---

## 5. Initialiser la base de données

### Étape 1 : Appliquer le schéma

```bash
make db-push

# OU directement :
docker-compose -f .docker/docker-compose.yml run --rm app npm run db:push
```

**Cela va** :
- Lancer Drizzle Kit
- Appliquer le schéma déclaratif (`shared/schema.ts`)
- Créer tous les tables, indexes, constraints

**Output attendu** :
```
✔ Your database is synced with your schema
```

### Étape 2 : Créer les index partiels (idempotence)

**Se connecter au conteneur PostgreSQL** :

```bash
docker exec -it darkevent_db psql -U darkevent -d darkevent
```

**Copier-coller les commandes SQL suivantes** :

```sql
-- Index partiels pour idempotence achats (clientEventId)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS purchases_client_event_id_unique
  ON purchases (client_event_id) WHERE client_event_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS server_events_client_event_id_unique
  ON server_events (client_event_id) WHERE client_event_id IS NOT NULL;

-- Quitter avec \q
\q
```

**Importance** : Ces index garantissent qu'une achat ne peut être inséré deux fois en cas de requête dupliquée (failover, retry réseau).

### Étape 3 : Vérifier les tables

```bash
docker exec -it darkevent_db psql -U darkevent -d darkevent -c "
  SELECT schemaname, tablename 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY tablename;
"
```

**Output attendu** : ~15 tables (participants, purchases, squads, etc.)

---

## 6. Mettre en place le HTTPS (Obligatoire en production)

### Contexte : Pourquoi HTTPS est obligatoire

En production, le cookie de session est configuré avec le flag `secure: true` → il **n'est jamais envoyé en HTTP simple**. Accéder en http:// entraîne une déconnexion immédiate.

**Solution** : Utiliser un reverse proxy HTTPS devant le port 5000.

### Option A : Caddy (Recommandé — TLS auto)

Caddy automatise le certificat HTTPS gratuitement via Let's Encrypt. **Le plus simple.**

#### Installation Caddy

```bash
sudo apt-get update
sudo apt-get install -y caddy
```

#### Configurer Caddy

Éditer `/etc/caddy/Caddyfile` :

```bash
sudo nano /etc/caddy/Caddyfile
```

**Remplacer le contenu par** (adapter `example.com` à votre domaine) :

```caddy
example.com {
  reverse_proxy localhost:5000 {
    # Headers WebSocket (proxy upgrade)
    header_up Upgrade websocket
    header_up Connection upgrade
    header_up X-Forwarded-For {http.request.remote}
    header_up X-Forwarded-Proto {http.request.proto}
  }
}

# HTTPS automatique : Let's Encrypt
# Caddy crée/renouvelle les certificats automatiquement
```

#### Démarrer Caddy

```bash
sudo systemctl start caddy
sudo systemctl enable caddy

# Vérifier le statut
sudo systemctl status caddy
```

#### Vérifier le certificat

```bash
curl -I https://example.com
# HTTP/2 200 OK
```

---

### Option B : Nginx (Standard — nécessite certificat manuel)

Nginx est plus configuré mais plus flexible.

#### Installation Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

#### Configurer Nginx

Créer un fichier de config site Nginx :

```bash
sudo nano /etc/nginx/sites-available/darkevent
```

**Coller cette configuration** (adapter `example.com` à votre domaine) :

```nginx
# Redirection HTTP → HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    server_name example.com;

    # Certificats SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Configuration SSL de sécurité
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy vers l'app Express
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # Headers standards reverse proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket (critical pour /ws)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

#### Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/darkevent /etc/nginx/sites-enabled/
sudo nginx -t   # Vérifier la syntaxe
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### Obtenir le certificat SSL (Let's Encrypt)

```bash
# Installer certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Générer le certificat
sudo certbot certonly --nginx -d example.com

# Renouvellement automatique (cron via certbot)
sudo systemctl enable certbot.timer
```

#### Tester

```bash
curl -I https://example.com
# HTTP/1.1 200 OK
```

---

### Vérification HTTPS + WebSocket

```bash
# Tester connexion HTTPS
curl -I https://example.com
# HTTP/2 200 OK (ou HTTP/1.1)

# Tester WebSocket
# Via le navigateur : accéder à https://example.com
# Ouvrir DevTools → Network → filtrer "WS" 
# Une connexion WebSocket doit apparaître comme "101 Switching Protocols"
```

---

## 7. Initialiser l'admin

### Première utilisation : Créer le compte administrateur

À la première utilisation, aucun utilisateur n'existe. Le serveur expose deux options :

#### Option 1 : Wizard web (recommandé)

Accéder à l'application : https://example.com

Une page d'initialisation guide la création de l'admin et la configuration initiale.

#### Option 2 : Endpoint API direct

```bash
curl -X POST https://example.com/api/auth/init \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "votre-mot-de-passe-fort"
  }'

# Response:
# { "message": "Admin user created", "username": "admin" }
```

### ⚠️ Étape critique : Changer le mot de passe

1. Accéder à https://example.com
2. Login avec admin / `votre-mot-de-passe`
3. Aller à Settings → Admin Account
4. **Changer immédiatement** le mot de passe

---

## 8. Vérifications post-déploiement

### Checklist complète

```
[ ] 1. make up : conteneurs actifs
[ ] 2. make db-push : schéma appliqué sans erreur
[ ] 3. Index partiels créés (SQL vérifié)
[ ] 4. Reverse proxy HTTPS fonctionnel
[ ] 5. Admin créé et loggé avec succès
[ ] 6. Page /login accessible en HTTPS
[ ] 7. Portail visiteur /visitor accessible
[ ] 8. WebSocket /ws connecté (DevTools Network)
[ ] 9. Import participants possible
[ ] 10. Backup PostgreSQL testée
```

### Test complet du déploiement

```bash
# 1. Vérifier la page de login
curl -I https://example.com/login
# HTTP/2 200

# 2. Tester l'authentification admin
curl -c cookies.txt -X POST https://example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "votre-mot-de-passe"}'

# 3. Vérifier la session
curl -b cookies.txt https://example.com/api/auth/session
# { "user": { "id": 1, "username": "admin", ... } }

# 4. Vérifier les participants (doit être vide au départ)
curl -b cookies.txt https://example.com/api/participants
# []

# 5. Accéder au portail visiteur
curl -I https://example.com/visitor
# HTTP/2 200
```

---

## 9. Sauvegardes et restauration

Voir document complet : [05-sauvegardes-restauration.md](./05-sauvegardes-restauration.md)

### Sauvegarde rapide (avant chaque db:push)

```bash
docker exec darkevent_db pg_dump -U darkevent darkevent \
  > backup_$(date +%Y-%m-%d_%H-%M-%S).sql

# Vérifier la taille
ls -lh backup_*.sql
```

### Restauration d'urgence

```bash
# 1. Arrêter l'app
docker-compose -f .docker/docker-compose.yml down

# 2. Supprimer le volume (WARNING: destructif)
docker volume rm docker_postgres_data

# 3. Relancer la DB vide
docker-compose -f .docker/docker-compose.yml up -d db

# 4. Restaurer depuis la sauvegarde
docker exec -i darkevent_db psql -U darkevent darkevent < backup_DATE.sql

# 5. Relancer l'app
docker-compose -f .docker/docker-compose.yml up -d app
```

---

## 10. Mises à jour et redéploiement

### Déployer une nouvelle version

```bash
# 1. Tirer les derniers changements
git pull origin main

# 2. (Optionnel) Sauvegarder la DB avant schema change
docker exec darkevent_db pg_dump -U darkevent darkevent \
  > backup_before_update_$(date +%Y-%m-%d).sql

# 3. Recompiler les images
make build

# 4. Relancer l'app
make up

# 5. Si le schéma a changé, appliquer les changements
make db-push
```

### Vérifier la version

```bash
# Consulter le git log
git log --oneline -5

# Accéder à l'app
curl https://example.com/api/auth/session
```

---

## 11. Mode offline-first et LAN (optionnel)

DarkEventManager supporte une mode offline complète pour tablettes sans Internet.

### Découverte UDP sur LAN

Ouvrir le port UDP 8888 sur le pare-feu du serveur :

```bash
sudo ufw allow 8888/udp
# OU sur iptables :
sudo iptables -A INPUT -p udp --dport 8888 -j ACCEPT
```

### PWA installable

Le build production génère automatiquement un service worker. Les tablettes Android/iPad peuvent :

1. Accéder à https://example.com
2. Bouton navigateur "Installer" (PWA) → installer comme app
3. Fonctionner offline via cache

---

## 12. Dépannage

### Le serveur refuse de démarrer

**Symptôme** :
```
Error: WEBSOCKET_SECRET is required for production
```

**Cause** : `WEBSOCKET_SECRET` absent du `.env`

**Solution** :
```bash
# Générer une clé
openssl rand -hex 32

# Éditer .env
nano .env
# Remplir WEBSOCKET_SECRET=...

# Redémarrer
make restart
```

---

### La page de login renvoie 502 Bad Gateway

**Symptôme** :
```
502 Bad Gateway (depuis Nginx/Caddy)
```

**Cause** : L'app Express n'est pas accessible sur localhost:5000

**Solution** :
```bash
# Vérifier que l'app est active
docker-compose -f .docker/docker-compose.yml ps app

# Voir les logs
docker-compose -f .docker/docker-compose.yml logs app

# Vérifier le port interne
docker-compose -f .docker/docker-compose.yml port app 5000
# Output: 0.0.0.0:5000

# Vérifier la connectivité
docker exec darkevent_app curl -I http://localhost:5000
# HTTP/1.1 200 OK
```

---

### Les utilisateurs ne peuvent pas se connecter (login échoue silencieusement)

**Symptôme** :
- Login form accepté
- Aucune erreur, mais page reload vers /login
- Cookies absent

**Cause** : Le cookie n'est pas `secure: true` en HTTPS

**Solution** :
- Vérifier que le reverse proxy HTTPS est actif
- Vérifier l'en-tête `X-Forwarded-Proto: https` dans la config proxy

**Test** :
```bash
# Depuis le conteneur app
docker exec darkevent_app curl -v http://localhost:5000/api/auth/session

# Vérifier la réponse Set-Cookie
# Doit contenir: secure; HttpOnly; SameSite=Lax
```

---

### La WebSocket `/ws` n'est pas connectée

**Symptôme** :
- DevTools Network montre pas de connexion WebSocket
- Les données ne se synchronisent pas entre tablettes

**Cause** : Le reverse proxy ne forward pas l'upgrade WebSocket

**Solution** :
- **Caddy** : Vérifier que `header_up Upgrade websocket` et `header_up Connection upgrade` sont présents
- **Nginx** : Vérifier que `proxy_set_header Upgrade $http_upgrade;` et `proxy_set_header Connection "upgrade";` sont présents

**Test** :
```bash
# Accéder au site en HTTPS
# DevTools → Network → filtrer "WS"
# Créer une mutation (ex: créer un participant)
# Une connexion WebSocket "ws://..." doit apparaître avec status "101 Switching Protocols"
```

---

### Erreur "UNIQUE constraint violated on purchases"

**Symptôme** :
```
Error: duplicate key value violates unique constraint
```

**Cause** : Tentative d'insertion d'une achat avec un `clientEventId` déjà existant (sans idempotence)

**Solution** :
```bash
# Cette erreur ne devrait pas se produire (index partiels appliqués)
# Si présente : les index ne sont pas créés

# Vérifier
docker exec darkevent_db psql -U darkevent -d darkevent -c "
  SELECT indexname FROM pg_indexes 
  WHERE tablename = 'purchases';
"

# Doivent contenir: purchases_client_event_id_unique

# Si absent: recréer
docker exec -it darkevent_db psql -U darkevent -d darkevent -c "
  CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS purchases_client_event_id_unique
    ON purchases (client_event_id) WHERE client_event_id IS NOT NULL;
"
```

---

### PostgreSQL consomme trop de RAM / CPU

**Symptôme** :
```
docker stats
# darkevent_db     500MB   ...   50%
```

**Cause** : Base croît rapidement (~1000+ participants = millions d'events en event-sourcing)

**Solution** :
```bash
# Vérifier la taille
docker exec darkevent_db psql -U darkevent -d darkevent -c "
  SELECT pg_size_pretty(pg_database_size('darkevent'));
"

# Nettoyer les tables temporaires / logs anciens
docker exec darkevent_db psql -U darkevent -d darkevent -c "
  DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '7 days';
"

# Vacuum (maintenance)
docker exec darkevent_db vacuumdb -U darkevent darkevent
```

---

### Impossible de relancer après `make clean`

**Symptôme** :
```
Error: volume docker_postgres_data already exists
```

**Cause** : Docker volume résiduel d'un autre projet / session

**Solution** :
```bash
# Lister tous les volumes
docker volume ls | grep postgres

# Supprimer le volume spécifique
docker volume rm docker_postgres_data

# Relancer
make start
```

---

### HTTPS: Certificat expiré / Certbot échoue

**Symptôme** :
```
curl: (60) SSL: certificate problem: certificate has expired
```

**Solution** :
```bash
# Renouveler le certificat
sudo certbot renew --force-renewal

# Recharger Nginx
sudo systemctl reload nginx

# Tester
curl -I https://example.com
```

---

## Ressources supplémentaires

| Document | Lien |
|----------|------|
| **Architecture générale** | [01-vue-ensemble.md](./01-vue-ensemble.md) |
| **Domaine métier** | [02-domaine-metier.md](./02-domaine-metier.md) |
| **Auth & sessions** | [03-authentification-roles.md](./03-authentification-roles.md) |
| **Synchronisation** | [04-synchronisation.md](./04-synchronisation.md) |
| **Backups & restore** | [05-sauvegardes-restauration.md](./05-sauvegardes-restauration.md) |
| **Fin d'événement** | [06-fin-evenement-pdf-email.md](./06-fin-evenement-pdf-email.md) |
| **Installation dev** | [07-installation-exploitation.md](./07-installation-exploitation.md) |
| **Sécurité** | [08-securite.md](./08-securite.md) |
| **ADR** | [adr/](./adr/) |

## Support

Pour déboguer, consulter :

1. **CLAUDE.md** (root) — Instructions projet et architecture
2. **Logs en temps réel** — `make logs`
3. **Shell conteneur** — `make exec`
4. **Tests de connectivité** — `curl`, `docker exec`

---

**Dernière mise à jour** : Juin 2026  
**Auteur** : Doc Writer Agent  
**Version** : Stable v1.0.0
