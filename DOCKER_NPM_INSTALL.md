# Installation des dépendances via Docker

## Important : Toutes les commandes npm doivent être exécutées via Docker/Make

Pour éviter les problèmes de compatibilité Windows/WSL, **toutes les installations de paquets npm doivent être effectuées via Docker**.

## Installation de nodemailer et pdfkit

```bash
# Depuis le répertoire du projet
make npm-install PACKAGES="nodemailer pdfkit"
```

Ou directement avec docker-compose :

```bash
docker-compose exec app npm install nodemailer pdfkit
```

## Installation des types TypeScript (dev dependencies)

```bash
make npm-install-dev PACKAGES="@types/nodemailer @types/pdfkit"
```

Ou :

```bash
docker-compose exec app npm install --save-dev @types/nodemailer @types/pdfkit
```

## Configuration SMTP Outlook

1. Copiez le fichier `.env.example` vers `.env` :
   ```bash
   cp .env.example .env
   ```

2. Éditez le fichier `.env` et remplissez vos informations SMTP Outlook :
   ```bash
   SMTP_HOST=smtp-mail.outlook.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=votre-email@outlook.com
   SMTP_PASS=votre-mot-de-passe
   
   EMAIL_FROM=votre-email@outlook.com
   EMAIL_FROM_NAME=Zomb'in The Dark
   
   # En développement, tous les emails seront envoyés à cette adresse
   NODE_ENV=development
   DEV_EMAIL_OVERRIDE=kevin.nicol@hotmail.fr
   ```

3. Redémarrez les containers Docker :
   ```bash
   make restart
   ```

## Mode Développement vs Production

### Développement (par défaut)
- `NODE_ENV=development`
- Tous les emails sont redirigés vers `DEV_EMAIL_OVERRIDE` (kevin.nicol@hotmail.fr)
- Permet de tester l'envoi d'emails sans risque d'envoyer aux vrais participants

### Production
- `NODE_ENV=production`
- Les emails sont envoyés aux adresses réelles des participants
- ⚠️ À utiliser uniquement en production !

## Commandes Make utiles

```bash
# Installer un paquet npm
make npm-install PACKAGES="package-name"

# Installer un paquet npm en dev
make npm-install-dev PACKAGES="package-name"

# Redémarrer les containers
make restart

# Voir les logs
make logs

# Arrêter les containers
make down

# Démarrer les containers
make up
```

## Note importante

❗ **NE JAMAIS exécuter `npm install` directement depuis Windows/WSL**

Toujours utiliser :
- `make npm-install PACKAGES="..."`
- Ou `docker-compose exec app npm install ...`

Cela évite les problèmes de chemins UNC et de compatibilité entre Windows et Linux.
