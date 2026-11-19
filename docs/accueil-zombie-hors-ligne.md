# Accueil zombie hors ligne

DarkEventManager est une PWA. Sur Android, ouvrez l’adresse HTTPS de l’application dans Chrome, puis choisissez **Installer l’application** ou **Ajouter à l’écran d’accueil**. Sur iPhone ou iPad, ouvrez-la dans Safari, puis touchez **Partager → Sur l’écran d’accueil**. Ouvrez ensuite l’icône installée pour préparer l’appareil. L’installation et la préparation doivent se faire avec accès au serveur.

1. Connectez-vous, importez la liste Excel depuis **Zombies → Données**, puis vérifiez les créneaux et les équipes. Faites-le avant de préparer la copie locale.
2. Sur l’appareil retenu, ouvrez **Zombies → Accueil hors ligne**. Choisissez une phrase secrète et touchez **Préparer cet appareil**. Attendez le message « Liste prête sur cet appareil ». Si l’installation vient d’être faite, il peut être nécessaire de recharger la page une fois.
3. Faites un essai en mode avion. Fermez puis rouvrez l’application depuis son icône. Ouvrez la liste avec votre phrase secrète, recherchez un joueur, choisissez son équipe et cochez les étapes effectuées. À chaque validation, la fiche reste sur l’appareil. La carte est facultative.
4. Quand le réseau revient, touchez **Envoyer au serveur**. Si la session a expiré, reconnectez-vous avec le compte qui a préparé la liste. Les fiches confirmées sortent de la file. Les conflits restent visibles sur l’appareil avec la raison du refus.

Utilisez un appareil pour toute la séance. La copie locale chiffrée est propre au navigateur ou à la PWA dans laquelle vous l’avez préparée. Gardez la phrase secrète et évitez d’effacer les données de l’application avant que toutes les fiches soient confirmées. Après l’événement, **Supprimer la copie locale** efface la liste de cet appareil.

Le profil `make local` permet d’essayer ce parcours en Docker à `http://127.0.0.1:5000` dans le navigateur de l’ordinateur. Sur un téléphone ou une tablette qui accède à un autre ordinateur, utilisez une adresse HTTPS valide.
