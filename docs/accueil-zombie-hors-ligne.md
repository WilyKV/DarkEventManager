# Accueil zombie hors ligne

DarkEventManager s’installe comme PWA. Sur Android, ouvrez l’adresse HTTPS dans Chrome et touchez **Installer l’application** depuis l’accueil ou le menu. Sur iPhone ou iPad, ouvrez l’adresse dans Safari, puis touchez **Partager → Sur l’écran d’accueil → Ajouter**.

1. **Préparer en ligne.** Avec votre compte d’accueil, importez le fichier Excel dans **Zombies → Données** et vérifiez les créneaux et les équipes. Sur le téléphone ou la tablette que vous utiliserez, ouvrez l’icône installée, connectez-vous, puis ouvrez **Menu → Hors ligne**.
2. **Télécharger la liste.** Choisissez une phrase de déverrouillage d’au moins 12 caractères, différente du mot de passe de votre compte, puis touchez **Télécharger la liste chiffrée**. La phrase déverrouille uniquement la copie locale. Gardez-la à portée de main pour la séance.
3. **Travailler sans réseau.** Testez en mode avion avant la séance. Fermez et rouvrez l’application par son icône, puis utilisez la phrase pour **Ouvrir la liste**. Recherchez un joueur, cochez son arrivée et sa checklist, choisissez son équipe et touchez **Enregistrer sur cet appareil**. Le compteur indique les fiches à envoyer.
4. **Envoyer quand le serveur est accessible.** Touchez **Envoyer au serveur**. Si nécessaire, reconnectez-vous avec le compte qui a préparé la liste. Les fiches confirmées sortent de la file. Les conflits restent visibles avec le motif du refus.

Utilisez le même appareil et ouvrez la même icône pendant la séance. La copie chiffrée et les fiches en attente restent dans le stockage de cette application. Après l’envoi de toutes les fiches, **Supprimer la copie locale** efface la liste sur l’appareil.

Le WebSocket passe par `/ws` sur le domaine HTTPS de l’application. Il signale aux écrans connectés les changements déjà enregistrés sur le serveur. L’envoi des fiches hors ligne passe par une requête HTTPS quand vous touchez **Envoyer au serveur**. Le statut du direct est visible dans **Administration → Configuration**.

Le profil `make local` permet d’essayer ces étapes en Docker à `http://127.0.0.1:5000` depuis l’ordinateur. Sur un téléphone ou une tablette qui accède à un autre ordinateur, ouvrez une adresse HTTPS valide.
