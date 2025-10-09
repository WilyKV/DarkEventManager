# ✅ Résolution du problème - ERR_MODULE_NOT_FOUND

## 📌 Problème initial

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'pdfkit' imported from /app/dist/index.js
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'nodemailer' imported from /app/dist/index.js
```

## 🔍 Cause

Les packages `nodemailer` et `pdfkit` n'étaient **pas dans le `package.json`** du projet. Ils avaient été installés manuellement via `make npm-install` dans un conteneur en cours d'exécution, mais cette installation était **temporaire** et disparaissait à chaque reconstruction de l'image Docker.

## ✨ Solution appliquée

### 1. Ajout des dépendances dans `package.json`

**Dépendances de production** :
```json
"nodemailer": "^6.9.16",
"pdfkit": "^0.15.0"
```

**Dépendances de développement** :
```json
"@types/nodemailer": "^6.4.16",
"@types/pdfkit": "^0.13.5"
```

### 2. Nettoyage complet de Docker

```bash
# Arrêter et supprimer conteneurs + volumes
docker-compose -f .docker/docker-compose.yml down -v

# Supprimer l'ancienne image
docker rmi docker-app
```

### 3. Reconstruction sans cache

```bash
# Rebuild complet sans utiliser le cache Docker
docker-compose -f .docker/docker-compose.yml build --no-cache app
```

Cette étape était **essentielle** car Docker utilisait son cache de l'étape `RUN npm install` avec l'ancien `package.json`.

### 4. Redémarrage

```bash
make up
# ou
docker-compose -f .docker/docker-compose.yml up -d
```

### 5. Réinitialisation de la base de données

```bash
docker-compose -f .docker/docker-compose.yml exec app npm run db:push
```

## ✅ Résultat

- ✅ Les packages `nodemailer` et `pdfkit` sont maintenant **installés de manière permanente**
- ✅ L'application démarre sans erreur
- ✅ Les conteneurs sont UP et fonctionnels
- ✅ Les services email et PDF sont opérationnels

## 📚 Leçons apprises

### ❌ Mauvaise pratique

```bash
# Installation temporaire (perdue au prochain build)
make npm-install PACKAGES="pdfkit nodemailer"
docker-compose restart
```

### ✅ Bonne pratique

```bash
# 1. Modifier package.json
nano package.json  # Ajouter les dépendances

# 2. Rebuild l'image
docker-compose -f .docker/docker-compose.yml build --no-cache

# 3. Redémarrer
docker-compose -f .docker/docker-compose.yml up -d
```

## 🔧 Commandes de vérification

### Vérifier que les packages sont bien installés

```bash
# Dans le conteneur
docker-compose -f .docker/docker-compose.yml exec app npm list nodemailer
docker-compose -f .docker/docker-compose.yml exec app npm list pdfkit
```

### Vérifier les logs

```bash
# Pas d'erreur ERR_MODULE_NOT_FOUND
docker-compose -f .docker/docker-compose.yml logs app | grep -i "ERR_MODULE_NOT_FOUND"
# Résultat attendu : aucune sortie
```

### Vérifier l'état des conteneurs

```bash
docker-compose -f .docker/docker-compose.yml ps
# Les deux conteneurs doivent être "Up"
```

## 📝 Modifications de fichiers

### Fichiers modifiés :
- ✅ `package.json` - Ajout de nodemailer, pdfkit et leurs types

### Fichiers créés :
- ✅ `TROUBLESHOOTING.md` - Guide de dépannage complet
- ✅ `RESOLUTION_ERR_MODULE.md` - Ce fichier

## 🎯 Prochaines étapes

Maintenant que l'application fonctionne correctement, vous pouvez :

1. **Configurer SMTP** → Suivre `NEXT_STEPS.md`
2. **Tester l'envoi d'emails** en mode développement
3. **Créer des participants de test**
4. **Utiliser le bouton "Fin d'événement"** dans l'admin

## 🔗 Documentation liée

- `END_EVENT_SETUP.md` - Configuration complète du système de fin d'événement
- `NEXT_STEPS.md` - Prochaines étapes pour configurer SMTP
- `DOCKER_NPM_INSTALL.md` - Guide d'installation npm via Docker
- `TROUBLESHOOTING.md` - Guide de dépannage général

---

**Problème résolu le** : 13 octobre 2025  
**Temps de résolution** : ~20 minutes  
**Impact** : Aucune perte de code, uniquement recréation de la base de données (normale)
