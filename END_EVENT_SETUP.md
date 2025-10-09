# Configuration de la Fin d'Événement - Envoi d'Emails

## ✅ Fonctionnalités implémentées

### 1. 🔐 Sécurité de connexion visiteur
- Ajout d'un champ "première lettre du nom" lors de la connexion visiteur
- Validation côté client et serveur
- Message d'erreur générique pour préserver la confidentialité

### 2. 📧 Système d'envoi d'emails avec PDF
- Service d'email avec nodemailer et SMTP Outlook
- Génération de PDF récapitulatif avec pdfkit
- Mode développement : redirection vers kevin.nicol@hotmail.fr
- Mode production : envoi aux vrais participants
- Interface de progression en temps réel (Server-Sent Events)
- Gestion d'erreurs par participant

## 🚀 Configuration

### Étape 1 : Copier le fichier d'environnement

```bash
cp .env.example .env
```

### Étape 2 : Configurer les credentials SMTP Outlook

Éditez le fichier `.env` :

```bash
# Mode développement - Tous les emails vont à kevin.nicol@hotmail.fr
NODE_ENV=development
DEV_EMAIL_OVERRIDE=kevin.nicol@hotmail.fr

# Configuration SMTP Outlook/Microsoft
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@outlook.com
SMTP_PASS=votre-mot-de-passe-outlook

# Configuration de l'expéditeur
EMAIL_FROM=votre-email@outlook.com
EMAIL_FROM_NAME=Zomb'in The Dark
```

### Étape 3 : Redémarrer le serveur

```bash
make restart
```

## 🧪 Tester l'envoi d'emails

### En mode développement

1. Assurez-vous que `NODE_ENV=development` dans `.env`
2. Créez quelques participants de test avec des emails
3. Allez dans Admin > Config
4. Cliquez sur "Lancer la fin d'événement"
5. **Tous les emails seront envoyés à `kevin.nicol@hotmail.fr`**

Le sujet de l'email indiquera l'adresse originale :
```
[DEV - Original: participant@example.com] Récapitulatif de votre participation
```

### En mode production

⚠️ **ATTENTION** : Ne passez en production qu'après avoir testé !

1. Modifiez `.env` : `NODE_ENV=production`
2. Redémarrez : `make restart`
3. Les emails seront envoyés aux vraies adresses

## 📄 Contenu du PDF récapitulatif

Le PDF généré contient :
- Logo Zomb'in The Dark
- Informations du participant (nom, type, code, créneau, squad)
- Historique des achats boutique avec total
- Historique des achats repas avec total
- Date de génération

## 🔧 Dépendances installées

Les dépendances ont été installées via Docker :

```bash
# Packages principaux
make npm-install PACKAGES="nodemailer pdfkit"

# Types TypeScript
make npm-install-dev PACKAGES="@types/nodemailer @types/pdfkit"
```

## 📁 Fichiers créés/modifiés

### Nouveaux fichiers :
- `server/email-service.ts` - Service d'envoi d'emails
- `server/pdf-service.ts` - Service de génération de PDF
- `server/end-event-routes.ts` - Route API de fin d'événement
- `client/src/components/end-event-button.tsx` - Bouton et interface de progression
- `DOCKER_NPM_INSTALL.md` - Guide d'installation npm via Docker
- `.env.example` - Exemple de configuration

### Fichiers modifiés :
- `Makefile` - Ajout des commandes npm-install
- `server/index.ts` - Enregistrement de la route end-event
- `server/routes.ts` - Ajout de `/api/participants/count`
- `client/src/pages/admin.tsx` - Ajout du composant EndEventButton
- `client/src/pages/login.tsx` - Ajout du champ première lettre
- `shared/schema.ts` - Mise à jour de visitorLoginSchema
- `server/auth-routes.ts` - Validation première lettre

## 🎯 Utilisation

1. **Interface Admin** :
   - Onglet "Config"
   - Section "Fin d'événement"
   - Bouton orange "Lancer la fin d'événement"

2. **Confirmation** :
   - Dialog de confirmation affichant le nombre de participants

3. **Progression** :
   - Dialog avec barre de progression
   - Compteur "X / Total"
   - Nombre de réussis/échoués
   - Nom du participant en cours de traitement

4. **Résultat** :
   - Message de succès avec nombre d'emails envoyés
   - Les participants reçoivent un email avec PDF en pièce jointe

## ⚠️ Important

### Sécurité SMTP Outlook
- Utilisez un mot de passe d'application si vous avez l'authentification à deux facteurs
- Ne commitez JAMAIS le fichier `.env` dans git
- Le fichier `.gitignore` doit inclure `.env`

### Limites SMTP
- Outlook limite à ~300 emails par jour pour les comptes gratuits
- Ajoutez un délai entre les envois (500ms implémenté)
- Pour de gros événements, envisagez un service professionnel

### Test avant production
- Testez toujours en mode développement d'abord
- Vérifiez que les PDFs sont correctement générés
- Vérifiez que les emails arrivent dans kevin.nicol@hotmail.fr

## 📞 Support

En cas de problème :
1. Vérifiez les logs : `make logs`
2. Vérifiez le fichier `.env`
3. Vérifiez que les containers sont démarrés : `docker-compose ps`
4. Vérifiez les credentials SMTP Outlook

## 🔄 Commandes utiles

```bash
# Voir les logs en temps réel
make logs

# Redémarrer les containers
make restart

# Arrêter les containers
make down

# Démarrer les containers
make up

# Installer un paquet npm
make npm-install PACKAGES="package-name"
```
