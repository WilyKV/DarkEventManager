# 🚀 Guide de Démarrage Rapide - DarkEventManager

## ⚠️ AVANT DE COMMENCER

Suite aux **corrections de sécurité critiques**, vous devez configurer les secrets cryptographiques **AVANT** le premier lancement.

---

## 📋 Prérequis

- **Node.js** 18+ installé
- **PostgreSQL** installé et en cours d'exécution
- **npm** ou **yarn**

---

## 🔧 Installation Initiale

### 1. Cloner et Installer les Dépendances

```bash
# Cloner le repository (si pas déjà fait)
git clone https://github.com/WilyKV/DarkEventManager.git
cd DarkEventManager

# Installer les dépendances
npm install
```

### 2. Créer la Base de Données PostgreSQL

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE darkevent;

# Créer un utilisateur
CREATE USER darkevent WITH PASSWORD 'darkevent';

# Donner les permissions
GRANT ALL PRIVILEGES ON DATABASE darkevent TO darkevent;

# Quitter
\q
```

### 3. Configuration Environnement - **CRITIQUE**

#### Option A : Configuration Automatique (Recommandé)

```bash
# Copier le template
cp .env.example .env

# Générer les secrets automatiquement (Linux/macOS)
echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")" >> .env
echo "QR_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
echo "QR_ENCRYPTION_IV=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")" >> .env
```

#### Option B : Configuration Manuelle

1. **Copier le template** :
   ```bash
   cp .env.example .env
   ```

2. **Générer les secrets** :
   ```bash
   # SESSION_SECRET (64 bytes = 128 caractères hex)
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

   # QR_ENCRYPTION_KEY (32 bytes = 64 caractères hex)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

   # QR_ENCRYPTION_IV (16 bytes = 32 caractères hex)
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```

3. **Éditer `.env`** et remplacer les valeurs :
   ```bash
   nano .env
   # ou
   code .env
   ```

### 4. Configurer les Variables d'Environnement

Éditer `.env` avec vos valeurs :

```env
NODE_ENV=development
DATABASE_URL=postgres://darkevent:darkevent@localhost:5432/darkevent

# Secrets générés automatiquement
SESSION_SECRET=<votre_secret_128_caractères>
QR_ENCRYPTION_KEY=<votre_clé_64_caractères>
QR_ENCRYPTION_IV=<votre_iv_32_caractères>

# Configuration Email (optionnel pour dev)
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-app-password

EMAIL_FROM=your-email@outlook.com
EMAIL_FROM_NAME=Zomb'in The Dark

# Email de développement
DEV_EMAIL_OVERRIDE=dev@example.com
```

### 5. Initialiser la Base de Données

```bash
# Pousser le schéma vers la base de données
npm run db:push

# Si vous avez des migrations
npm run migrate:roles
```

### 6. Créer le Compte Administrateur

```bash
# Lancer le serveur en dev
npm run dev
```

Dans un autre terminal ou navigateur :
```bash
# Créer le compte admin par défaut (username: admin, password: admin123)
curl -X POST http://localhost:5000/api/auth/init

# OU visitez : http://localhost:5000/api/auth/init
```

**⚠️ IMPORTANT** : Changez immédiatement le mot de passe admin123 !

---

## 🏃 Lancer l'Application

### Mode Développement

```bash
npm run dev
```

L'application sera accessible sur : **http://localhost:5000**

### Mode Production

```bash
# Build l'application
npm run build

# Lancer en production
NODE_ENV=production npm start
```

---

## 👤 Première Connexion

### Connexion Staff

1. Aller sur : **http://localhost:5000/login**
2. Mode : **Staff**
3. Username : `admin`
4. Password : `admin123`

**⚠️ Changez immédiatement le mot de passe !**

### Créer de Nouveaux Utilisateurs

Une fois connecté en tant qu'admin :
1. Aller dans **Admin** > **Utilisateurs**
2. Créer de nouveaux comptes staff avec des rôles :
   - `admin` : Accès complet
   - `staff_zombie` : Gestion zombies
   - `staff_survivant` : Gestion survivants
   - `staff_repas` : Gestion repas
   - `staff_boutique` : Gestion boutique

---

## 🔒 Sécurité Post-Installation

### Checklist Minimale

- [ ] Secrets générés avec crypto.randomBytes (pas de valeurs par défaut)
- [ ] Mot de passe admin changé
- [ ] `.env` ajouté à `.gitignore` (déjà fait)
- [ ] Database backups configurés
- [ ] SMTP configuré (si emails requis)

### Pour la Production

Voir **SECURITY.md** pour la checklist complète :
- HTTPS configuré
- `NODE_ENV=production`
- Firewall configuré
- Monitoring en place
- etc.

---

## 🧪 Test de l'Installation

### 1. Vérifier que le Serveur Fonctionne

```bash
curl http://localhost:5000/health
# Devrait retourner: {"status":"healthy","timestamp":"..."}
```

### 2. Vérifier les Sessions PostgreSQL

```bash
psql -U darkevent -d darkevent -c "SELECT * FROM session LIMIT 5;"
```

### 3. Tester le Rate Limiting

```bash
# Tester 10 tentatives de connexion (5 seront bloquées)
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' \
    -w "\n%{http_code}\n"
done
```

Résultat attendu :
- Premières 5 requêtes : `401` (Unauthorized)
- Suivantes : `429` (Too Many Requests)

---

## 🐛 Problèmes Courants

### Erreur : "SESSION_SECRET must be set"

**Solution** : Vous n'avez pas généré les secrets. Suivez l'étape 3.

### Erreur : "QR_ENCRYPTION_KEY must be set"

**Solution** : Générez les clés QR avec les commandes de l'étape 3.

### Erreur : "DATABASE_URL connection failed"

**Solutions** :
1. Vérifier que PostgreSQL est lancé : `sudo service postgresql status`
2. Vérifier les credentials dans `.env`
3. Tester la connexion : `psql postgres://darkevent:darkevent@localhost:5432/darkevent`

### Erreur : "EADDRINUSE: address already in use"

**Solution** : Le port 5000 est déjà utilisé.
```bash
# Trouver le processus
lsof -i :5000

# Le tuer
kill -9 <PID>

# OU changer le port
PORT=3000 npm run dev
```

### Impossible de se connecter avec admin/admin123

**Solutions** :
1. Vérifier que `/api/auth/init` a été appelé
2. Vérifier que la table `users` existe : `psql -d darkevent -c "\dt"`
3. Vérifier le contenu : `psql -d darkevent -c "SELECT * FROM users;"`

### Erreurs TypeScript lors de `npm run check`

**Note** : Certaines erreurs TypeScript existaient déjà. L'application fonctionne en mode `transpileOnly`. Les corrections de sécurité sont indépendantes de ces erreurs.

---

## 📚 Documentation Complète

- **AUDIT.md** : Rapport complet d'audit (20 recommandations)
- **SECURITY.md** : Guide de sécurité détaillé
- **README.md** : Documentation générale (si existant)

---

## 🆘 Support

### En cas de problème :

1. **Vérifier les logs** :
   ```bash
   # Logs du serveur en développement
   npm run dev
   ```

2. **Vérifier les variables d'environnement** :
   ```bash
   cat .env | grep -v "^#"
   ```

3. **Réinitialiser la base de données** :
   ```bash
   psql -d darkevent -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   npm run db:push
   ```

4. **Consulter les fichiers d'audit** :
   - `AUDIT.md` pour les recommandations
   - `SECURITY.md` pour la sécurité

---

## 🎯 Prochaines Étapes

Une fois l'installation validée :

1. **Lire AUDIT.md** pour comprendre les améliorations futures
2. **Configurer les emails** (SMTP)
3. **Importer des données de test** (participants, créneaux, squads)
4. **Tester les flows** :
   - Création de participants
   - Check-in avec QR codes
   - Gestion boutique/repas
   - Dashboard en temps réel

---

**Dernière mise à jour** : 14 Janvier 2026

**Version sécurisée** : Toutes les corrections critiques sont appliquées ✅
