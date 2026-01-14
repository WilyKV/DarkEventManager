# 🔐 Guide de Sécurité - DarkEventManager

## ⚠️ AVANT TOUT DÉPLOIEMENT

**Ce fichier contient des instructions CRITIQUES pour sécuriser votre installation.**

Ne déployez JAMAIS en production sans avoir complété ces étapes.

---

## 🚨 Configuration Obligatoire

### 1. Générer les Secrets de Sécurité

Trois secrets cryptographiques sont **OBLIGATOIRES** et doivent être générés avant le premier lancement :

#### a) SESSION_SECRET (64 caractères minimum)
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### b) QR_ENCRYPTION_KEY (32 bytes = 64 caractères hex)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### c) QR_ENCRYPTION_IV (16 bytes = 32 caractères hex)
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 2. Configuration Automatique

Pour générer automatiquement votre fichier `.env` :

```bash
# Créer .env à partir du template
cp .env.example .env

# Générer et ajouter les secrets (Linux/macOS)
echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")" >> .env
echo "QR_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
echo "QR_ENCRYPTION_IV=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")" >> .env

# Ouvrir .env pour configurer les autres variables (email, etc.)
nano .env
```

### 3. Vérification

Avant de lancer l'application, vérifiez que votre `.env` contient :

```bash
# Vérifier que les secrets sont bien configurés
grep -E "SESSION_SECRET|QR_ENCRYPTION_KEY|QR_ENCRYPTION_IV" .env
```

Vous devez voir 3 lignes avec des valeurs hexadécimales longues (pas "CHANGE_THIS...").

---

## 🔒 Checklist de Sécurité Pré-Production

### Configuration Serveur

- [ ] **Secrets générés** : SESSION_SECRET, QR_ENCRYPTION_KEY, QR_ENCRYPTION_IV
- [ ] **NODE_ENV** : Défini sur `production`
- [ ] **DATABASE_URL** : Pointe vers une base de production (pas localhost)
- [ ] **HTTPS activé** : Certificat SSL/TLS configuré (Let's Encrypt recommandé)
- [ ] **Firewall configuré** : Seuls les ports 443 (HTTPS) et éventuellement 80 (HTTP redirect) ouverts
- [ ] **Base de données** : Backup automatique configuré

### Mots de Passe

- [ ] **Comptes utilisateurs** : Tous les mots de passe par défaut ont été changés
- [ ] **Compte admin** : Le mot de passe "admin123" a été changé immédiatement
- [ ] **SMTP** : Credentials email configurés avec un mot de passe application (si Outlook/Gmail)

### Sessions

- [ ] **PostgreSQL sessions** : Vérifier que la table `session` a été créée automatiquement
- [ ] **Cookies sécurisés** : `secure: true` en production (automatique avec NODE_ENV=production)

### Rate Limiting

- [ ] **Activé** : Rate limiting actif sur `/api/auth/*` (5 tentatives / 15 min)
- [ ] **Monitoring** : Surveiller les logs pour détecter les attaques

### Helmet & Headers

- [ ] **Helmet actif** : Headers de sécurité appliqués automatiquement
- [ ] **CSP** : Content Security Policy ajustée selon vos besoins

---

## 🛡️ Bonnes Pratiques

### Gestion des Secrets

1. **Ne JAMAIS commiter `.env`** dans Git
   ```bash
   # Vérifier que .env est dans .gitignore
   cat .gitignore | grep "^\.env$"
   ```

2. **Rotation des secrets** : Changer les secrets tous les 90 jours en production

3. **Gestionnaire de secrets** : Pour la production, utiliser un gestionnaire comme :
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Cloud Secret Manager

### Base de Données

1. **Utilisateur dédié** : Créer un utilisateur PostgreSQL avec permissions minimales
   ```sql
   CREATE USER darkevent_app WITH PASSWORD 'strong_password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO darkevent_app;
   ```

2. **Backups automatiques** :
   ```bash
   # Backup quotidien (cron)
   0 2 * * * pg_dump $DATABASE_URL > /backups/darkevent_$(date +\%Y\%m\%d).sql
   ```

3. **Chiffrement** : Activer le chiffrement de la base de données au repos

### Monitoring

1. **Logs structurés** : Implémenter Winston (voir AUDIT.md)

2. **Alertes** : Configurer des alertes pour :
   - Tentatives de connexion échouées répétées
   - Erreurs 500 fréquentes
   - Utilisation anormale de l'API

3. **Métriques** : Surveiller :
   - Temps de réponse des endpoints
   - Taux d'erreurs
   - Utilisation CPU/RAM
   - Connexions DB

---

## 🚨 Que Faire en Cas de Compromission

### Si les secrets sont exposés

1. **Révoquer immédiatement** :
   ```bash
   # Générer de nouveaux secrets
   node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   node -e "console.log('QR_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
   node -e "console.log('QR_ENCRYPTION_IV=' + require('crypto').randomBytes(16).toString('hex'))"
   ```

2. **Invalider toutes les sessions** :
   ```sql
   TRUNCATE TABLE session;
   ```

3. **Forcer la reconnexion** de tous les utilisateurs

4. **Audit** : Vérifier les logs pour activité suspecte

### Si la base de données est compromise

1. **Isoler** : Déconnecter la base du réseau
2. **Analyser** : Identifier la portée de la compromission
3. **Restaurer** : Depuis le dernier backup sain
4. **Changer** : Tous les mots de passe utilisateurs
5. **Notifier** : Informer les utilisateurs si des données personnelles sont affectées (RGPD)

---

## 📋 Checklist de Migration (SHA-256 → bcrypt)

⚠️ **Important** : Si vous mettez à jour depuis une version utilisant SHA-256, tous les mots de passe doivent être réinitialisés.

### Option 1 : Réinitialisation Forcée (Recommandée)

```sql
-- Marquer tous les comptes comme nécessitant une réinitialisation
UPDATE users SET password_hash = '' WHERE 1=1;

-- Envoyer des emails de réinitialisation à tous les utilisateurs
-- (implémenter un script d'envoi)
```

### Option 2 : Migration Hybride (Avancée)

Créer une colonne `legacy_hash` et migrer progressivement lors des connexions :

```typescript
// À la connexion, vérifier si c'est un ancien hash
if (user.passwordHash.length === 64) { // SHA-256 = 64 chars
  // Vérifier avec SHA-256
  const oldHash = crypto.createHash('sha256').update(password).digest('hex');
  if (oldHash === user.passwordHash) {
    // Migrer vers bcrypt
    const newHash = await bcrypt.hash(password, 12);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
  }
} else {
  // Vérifier avec bcrypt
  await bcrypt.compare(password, user.passwordHash);
}
```

---

## 🔍 Tests de Sécurité

### Rate Limiting

Tester que le rate limiting fonctionne :

```bash
# Doit bloquer après 5 tentatives
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' \
    -w "\n%{http_code}\n"
done

# Les 5 premières doivent retourner 401
# Les suivantes doivent retourner 429 (Too Many Requests)
```

### Helmet Headers

Vérifier que les headers de sécurité sont présents :

```bash
curl -I http://localhost:5000/api/dashboard/stats
# Doit contenir :
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 0
```

### Sessions PostgreSQL

Vérifier que les sessions sont bien persistées :

```sql
SELECT * FROM session;
```

---

## 📞 Contact Sécurité

En cas de découverte de vulnérabilité :

1. **Ne PAS** créer d'issue publique sur GitHub
2. Envoyer un email à : security@votredomaine.com
3. Inclure :
   - Description de la vulnérabilité
   - Steps to reproduce
   - Impact potentiel
   - Votre suggestion de fix (optionnel)

---

## 📚 Ressources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [bcrypt vs alternatives](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Dernière mise à jour** : 14 Janvier 2026
