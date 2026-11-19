# Variables de production DarkEventManager

Le Compose du Jetson lit `~/DarkEventManager/.env`. Pour une plateforme qui fournit déjà PostgreSQL et un proxy HTTPS, sélectionnez [`.docker/docker-compose.hosted.yml`](../.docker/docker-compose.hosted.yml) avec la racine du dépôt (`/` dans Coolify) comme répertoire de base. Activez `DATABASE_URL`, `SESSION_SECRET`, `WEBSOCKET_SECRET` et `QR_ENCRYPTION_KEY` à l’exécution seulement. Le Compose définit `NODE_ENV=production` pour le conteneur de l’application. Les conteneurs de production doivent être joints par le proxy HTTPS. Celui-ci transmet `X-Forwarded-Proto: https` pour que le serveur envoie le cookie de session. HTTPS permet aussi à la PWA de s’installer sur téléphone ou tablette.

| Variable | Valeur et origine |
| --- | --- |
| `NODE_ENV` | `production`. Le Compose de production le définit. |
| `PORT` | Port d’écoute de l’application. Le Compose du Jetson utilise `5000`. Le Compose pour base hébergée le déduit de `HOSTED_APP_PORT`. |
| `APP_PORT` | Port publié sur l’hôte avec le Compose du Jetson, `5000` par défaut. |
| `HOSTED_APP_PORT` | Port interne du service `app` avec le Compose pour base hébergée, `80` par défaut. Configurez le même port dans le proxy de la plateforme. |
| `DATABASE_URL` | Avec le Compose pour base hébergée, utilisez l’URL de connexion fournie par votre plateforme et conservez ses paramètres TLS. L’application et le service de migration reçoivent la même variable. Le Compose du Jetson impose son URL de base intégrée. |
| `TRUST_PROXY_HOPS` | Nombre de proxies de confiance entre Internet et le conteneur. `1` par défaut. Utilisez `2` si le seul chemin public passe par Traefik sur le Jetson puis Traefik sur Kevin Pro. |
| `SETUP_TOKEN` | Requis pour créer le premier administrateur sur une base vide. Générez une valeur indépendante avec `openssl rand -hex 32`. Configurez-la à l’exécution et saisissez-la dans le champ **Code d’installation** de la page de configuration. Une base déjà initialisée ignore ce réglage. |
| `SESSION_SECRET` | Obligatoire. Générez 32 octets aléatoires en hexadécimal. Signe les cookies de session. Gardez la même valeur entre redémarrages et entre instances. La rotation invalide les sessions. |
| `WEBSOCKET_SECRET` | Obligatoire. Générez une deuxième valeur indépendante de 32 octets en hexadécimal. Signe les jetons WebSocket. |
| `QR_ENCRYPTION_KEY` | Générez une troisième valeur indépendante, exactement 64 caractères hexadécimaux. Conservez-la pour relire les QR codes créés avec cette clé. Sinon, le serveur tombe sur une clé temporaire propre au processus. |
| `EMAIL_ENABLED` | `false` pour l’accueil zombie. Activez l’envoi uniquement après configuration du SMTP. |
| `LOG_LEVEL` | Facultatif. `info` par défaut en production. |
| `LOG_VERBOSE` | Facultatif. Laissez `false` sauf diagnostic ciblé. |

Générez chaque clé et le code d’installation séparément sur la machine cible. Chaque exécution produit 64 caractères hexadécimaux.

```bash
openssl rand -hex 32
```

Avec Node.js, si OpenSSL n’est pas installé :

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Utilisez le [modèle de production](../.env.prod.example) et renseignez les valeurs dans le fichier ou le coffre de secrets. Sur Linux, réservez la lecture au propriétaire avec `chmod 600 .env`. Conservez une copie des clés dans votre gestionnaire de secrets. La phrase secrète choisie sur le téléphone pour l’accueil hors ligne est un réglage de cet appareil. Elle ne fait pas partie des variables du serveur.

Si vous activez les e-mails, votre fournisseur SMTP vous donne `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `SMTP_PASS`. Utilisez un identifiant SMTP ou un mot de passe d’application si le fournisseur en propose. Vérifiez que le compte est autorisé à envoyer depuis `EMAIL_FROM`, ou laissez ce champ vide pour utiliser `SMTP_USER`. `EMAIL_FROM_NAME` règle le nom visible, avec « Zomb’in The Dark » par défaut. Pour le port 587, utilisez généralement `SMTP_SECURE=false` avec STARTTLS. Pour le port 465, utilisez généralement `SMTP_SECURE=true`.

`QR_ENCRYPTION_IV` appartient à l’ancien format. Les QR codes actuels utilisent un IV généré pour chaque code. `DEV_EMAIL_OVERRIDE` et `SERVE_BUILT_CLIENT` concernent les essais en développement.


## Base PostgreSQL déjà créée dans la plateforme

Pour vérifier ce Compose manuellement depuis la racine du dépôt, utilisez le même répertoire de projet que Coolify.

```bash
docker compose --project-directory . -f .docker/docker-compose.hosted.yml config --quiet
```

- Utilisez le nom de la base de DarkEventManager dans `DATABASE_URL`. Si l’URL privée fournie par la plateforme utilise un nom de conteneur, rendez la base joignable depuis le projet de l’application en rattachant les deux ressources au même réseau privé dans la plateforme. `localhost` désigne le conteneur de l’application elle-même.
- Configurez le domaine HTTPS pour le service `app` sur le port interne `80` ou sur la valeur de `HOSTED_APP_PORT` si vous l’avez définie. Le service `db-migrate` initialise le schéma de la base, puis s’arrête. L’application démarre après sa réussite. Définissez un compte PostgreSQL avec les droits de créer et modifier les tables de cette base pendant l’initialisation.
- Pour un schéma existant, sauvegardez la base avant une mise à jour. Ce Compose limite la migration aux tables de DarkEventManager et laisse les changements exigeant une confirmation à examiner.

Si un proxy chez vous reçoit le HTTPS et relaie les requêtes vers le port `80` du VPS, créez dans Coolify une route HTTP pour le domaine public vers le service `app` sur le port interne `80`. Le proxy Coolify du VPS garde l’écoute publique et répartit les requêtes selon l’en-tête `Host`. Le proxy chez vous doit donc conserver le `Host` du domaine public. Pour que la connexion et la PWA fonctionnent, faites aussi parvenir `X-Forwarded-Proto: https` à l’application. Configurez le proxy du VPS pour accepter les en-têtes transmis par l’adresse de votre proxy chez vous. Dans cette topologie, la redirection HTTP vers HTTPS se fait au proxy chez vous.
