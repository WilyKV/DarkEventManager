# 🔧 Guide de Dépannage - DarkEventManager

## Problèmes courants et solutions

### 1. ❌ Erreur `Cannot find package 'pdfkit'` ou `'nodemailer'`

**Symptôme** :
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pdfkit' imported from /app/dist/index.js
```

**Cause** :
- Les dépendances ont été ajoutées au `package.json` mais Docker utilise une image en cache
- L'installation npm n'a pas été faite dans l'image Docker

**Solution** :

1. **Arrêter et supprimer les conteneurs et volumes** :
   ```bash
   docker-compose -f .docker/docker-compose.yml down -v
   ```

2. **Supprimer l'image Docker** :
   ```bash
   docker rmi docker-app
   ```

3. **Reconstruire l'image SANS cache** :
   ```bash
   docker-compose -f .docker/docker-compose.yml build --no-cache app
   ```

4. **Redémarrer les conteneurs** :
   ```bash
   make up
   # ou
   docker-compose -f .docker/docker-compose.yml up -d
   ```

5. **Recréer les tables de la base de données** (si nécessaire) :
   ```bash
   docker-compose -f .docker/docker-compose.yml exec app npm run db:push
   ```

---

### 2. 🔄 Ajout d'une nouvelle dépendance npm

**Procédure correcte** :

1. **Ajouter la dépendance au `package.json`** :
   ```json
   "dependencies": {
     "nouvelle-librairie": "^1.0.0"
   }
   ```

2. **Reconstruire l'image Docker** :
   ```bash
   make build
   # Si le cache pose problème :
   docker-compose -f .docker/docker-compose.yml build --no-cache app
   ```

3. **Redémarrer** :
   ```bash
   make start
   # ou
   make down
   make up
   ```

**⚠️ NE PAS FAIRE** :
- ❌ `npm install` directement sur l'hôte Windows/WSL
- ❌ `make npm-install` puis redémarrer → les packages seront perdus au prochain build

**✅ TOUJOURS** :
- ✅ Modifier `package.json`
- ✅ Rebuild l'image Docker
- ✅ Redémarrer les conteneurs

---

### 3. 🗄️ Erreur `relation "participants" does not exist`

**Symptôme** :
```
error: relation "participants" does not exist
```

**Cause** :
- La base de données est vide (premier démarrage ou après `down -v`)

**Solution** :
```bash
docker-compose -f .docker/docker-compose.yml exec app npm run db:push
```

---

### 4. 📦 Docker utilise toujours l'ancienne version du code

**Symptôme** :
- Les modifications du code ne sont pas prises en compte
- Anciennes fonctionnalités persistent

**Solution** :

1. **Build complet sans cache** :
   ```bash
   docker-compose -f .docker/docker-compose.yml down
   docker-compose -f .docker/docker-compose.yml build --no-cache
   docker-compose -f .docker/docker-compose.yml up -d
   ```

2. **Ou utiliser la commande make** :
   ```bash
   make start  # Fait down + build + up + db:push automatiquement
   ```

---

### 5. 🔧 Le conteneur crash au démarrage

**Diagnostic** :

1. **Voir les logs** :
   ```bash
   make logs
   # ou
   docker-compose -f .docker/docker-compose.yml logs app --tail=100
   ```

2. **Vérifier l'état des conteneurs** :
   ```bash
   docker-compose -f .docker/docker-compose.yml ps
   ```

3. **Vérifier les erreurs de build** :
   ```bash
   docker-compose -f .docker/docker-compose.yml build
   ```

**Solutions courantes** :
- Erreur de syntaxe TypeScript → Vérifier le code
- Port déjà utilisé → Changer le port dans `.docker/docker-compose.yml`
- Base de données non disponible → Attendre que `darkevent_db` soit `healthy`

---

### 6. 🔑 Variables d'environnement non prises en compte

**Symptôme** :
- Configuration SMTP ne fonctionne pas
- Variables `.env` ignorées

**Solution** :

1. **Vérifier que `.env` existe** :
   ```bash
   ls -la .env
   ```

2. **Vérifier le contenu** :
   ```bash
   cat .env | grep SMTP
   ```

3. **Redémarrer les conteneurs** pour recharger l'environnement :
   ```bash
   make restart
   # ou
   docker-compose -f .docker/docker-compose.yml restart
   ```

4. **Si ça ne fonctionne toujours pas**, rebuild complet :
   ```bash
   make start
   ```

---

## 🛠️ Commandes Make utiles

```bash
make install        # Installer les dépendances (première fois)
make build          # Construire l'image Docker
make up             # Démarrer les conteneurs
make down           # Arrêter les conteneurs
make restart        # Redémarrer les conteneurs
make logs           # Voir les logs en temps réel
make start          # Rebuild complet (down + build + up + db:push)
make npm-install PACKAGES="package-name"  # Installer un package (⚠️ temporaire)
```

---

## 📋 Checklist de démarrage après un clone

1. Copier le fichier d'environnement :
   ```bash
   cp .env.example .env
   ```

2. Configurer les variables (SMTP, etc.) dans `.env`

3. Démarrer le projet :
   ```bash
   make start
   ```

4. Accéder à l'application :
   - Frontend : http://localhost:5000
   - Base de données : localhost:5434

---

## 🆘 En cas de problème persistant

### Reset complet du projet

```bash
# Arrêter et supprimer TOUT
docker-compose -f .docker/docker-compose.yml down -v

# Supprimer l'image
docker rmi docker-app 2>/dev/null || true

# Supprimer les builds en cache
docker builder prune -af

# Reconstruire complètement
make build

# Redémarrer
make up

# Recréer la BDD
docker-compose -f .docker/docker-compose.yml exec app npm run db:push
```

### Vérifier la santé du système

```bash
# État des conteneurs
docker-compose -f .docker/docker-compose.yml ps

# Logs application
docker-compose -f .docker/docker-compose.yml logs app --tail=50

# Logs base de données
docker-compose -f .docker/docker-compose.yml logs db --tail=50

# Liste des images Docker
docker images | grep docker-app

# Utilisation disque Docker
docker system df
```

---

## 📞 Support

- Documentation : Voir `END_EVENT_SETUP.md`, `NEXT_STEPS.md`
- Logs : `make logs`
- Issues : Créer une issue GitHub avec les logs

---

*Dernière mise à jour : 13 octobre 2025*
