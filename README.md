# 🧟 DarkEventManager

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-green)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Security](https://img.shields.io/badge/security-hardened-success)](./SECURITY.md)

**Système de gestion d'événements full-stack pour "Zomb'in The Dark"**

Un système complet de gestion d'événements zombie/survivant avec check-in QR code, gestion de boutique, services de repas, et tableau de bord en temps réel. Conçu pour gérer des centaines de participants avec des fonctionnalités avancées de synchronisation et d'audit.

---

## ✨ Fonctionnalités Principales

### 🎫 Gestion des Participants
- ✅ Inscription et gestion de participants (zombie/survivant/staff)
- ✅ Check-in via QR code sécurisé
- ✅ Assignation automatique aux squads
- ✅ Génération de badges personnalisés
- ✅ Authentification 2-facteurs pour visiteurs

### 📊 Tableau de Bord Temps Réel
- ✅ Statistiques en direct (taux d'arrivée, complétion checklist)
- ✅ Graphiques interactifs (Recharts)
- ✅ Monitoring des stocks
- ✅ Vue d'ensemble des squads

### 🛒 Système de Boutique & Repas
- ✅ Gestion d'inventaire en temps réel
- ✅ Tracking des achats
- ✅ Système de réductions multiniveau (type/squad/individuel)
- ✅ Repas gratuit pour zombies

### 🔄 Synchronisation Avancée
- ✅ Mode online/offline avec WebSocket
- ✅ Support multi-devices
- ✅ Master/slave architecture
- ✅ Résolution de conflits

### 📧 Communication
- ✅ Génération de PDFs personnalisés
- ✅ Envoi d'emails en masse (SMTP)
- ✅ Récapitulatifs avec historique d'achats

### 🔒 Sécurité & Audit
- ✅ **bcrypt** pour les mots de passe
- ✅ **Rate limiting** anti brute-force
- ✅ **Helmet** security headers
- ✅ Sessions PostgreSQL persistantes
- ✅ Chiffrement AES-256 des QR codes
- ✅ Audit trail complet (CRUD operations)
- ✅ Contrôle d'accès basé sur les rôles

---

## 🚀 Démarrage Rapide

### Option 1 : Setup Automatique (Recommandé)

```bash
# Cloner le repository
git clone https://github.com/WilyKV/DarkEventManager.git
cd DarkEventManager

# Installation et configuration automatique
npm install
npm run setup

# Lancer l'application
npm run dev

# Dans un autre terminal : vérifier la santé
npm run health
```

### Option 2 : Setup Manuel

Voir le guide détaillé : [QUICKSTART.md](./QUICKSTART.md)

---

## 📋 Prérequis

- **Node.js** 18+ ([Télécharger](https://nodejs.org/))
- **PostgreSQL** 14+ ([Télécharger](https://www.postgresql.org/download/))
- **npm** ou **yarn**

---

## 🏗️ Stack Technique

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Shadcn/ui** - Component library (40+ components)
- **TanStack Query** - Server state management
- **Wouter** - Lightweight routing
- **Zod** - Schema validation
- **Framer Motion** - Animations
- **Recharts** - Data visualization

### Backend
- **Express.js** - HTTP server
- **TypeScript** - Type safety
- **PostgreSQL** - Database
- **Drizzle ORM** - Type-safe queries
- **bcrypt** - Password hashing
- **WebSocket (ws)** - Real-time sync
- **Nodemailer** - Email service
- **PDFKit** - PDF generation
- **express-rate-limit** - Rate limiting
- **Helmet** - Security headers

### Security
- **bcrypt** (salt rounds: 12)
- **connect-pg-simple** (persistent sessions)
- **AES-256-CBC** (QR encryption)
- **Zod validation** (all inputs)
- **CSRF protection** ready
- **Rate limiting** (auth: 5/15min, API: 100/min)

---

## 📁 Structure du Projet

```
DarkEventManager/
├── client/                 # Frontend React
│   └── src/
│       ├── pages/          # Route pages (12 pages)
│       ├── components/     # Reusable components (40+ components)
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities & helpers
├── server/                 # Backend Express
│   ├── routes.ts           # Main API routes
│   ├── auth-routes.ts      # Authentication
│   ├── storage.ts          # Database layer
│   ├── email-service.ts    # Email handling
│   ├── pdf-service.ts      # PDF generation
│   └── __tests__/          # Test templates
├── shared/                 # Shared code
│   └── schema.ts           # Zod schemas + DB models
├── scripts/                # Development tools
│   ├── setup.sh            # Automated setup
│   └── health-check.sh     # Health verification
├── docs/                   # Documentation
│   ├── QUICKSTART.md       # Quick start guide
│   ├── SECURITY.md         # Security guide
│   ├── AUDIT.md            # Complete audit (700+ lines)
│   ├── CONTRIBUTING.md     # Contribution guide
│   └── CHANGELOG.md        # Version history
└── .env.example            # Environment template
```

---

## 🔐 Configuration Sécurité

### Générer les Secrets (OBLIGATOIRE)

```bash
# Générer automatiquement
npm run secrets:generate

# Ou manuellement :
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # QR_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # QR_ENCRYPTION_IV
```

### Configurer .env

```env
# Security (REQUIRED)
SESSION_SECRET=<64 caractères hex>
QR_ENCRYPTION_KEY=<64 caractères hex>
QR_ENCRYPTION_IV=<32 caractères hex>

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/darkevent

# SMTP (Optional)
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

**⚠️ IMPORTANT** : Sans ces secrets, l'application ne démarrera pas.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](./QUICKSTART.md) | Guide de démarrage détaillé (installation, configuration, troubleshooting) |
| [SECURITY.md](./SECURITY.md) | Guide de sécurité complet (checklist, procedures, tests) |
| [AUDIT.md](./AUDIT.md) | Audit complet du projet (20 recommandations, roadmap 4-6 semaines) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guide de contribution (standards, workflow, tests) |
| [CHANGELOG.md](./CHANGELOG.md) | Historique des versions et breaking changes |

---

## 🛠️ Scripts Disponibles

### Development
```bash
npm run dev              # Démarrer le serveur de développement
npm run build            # Build pour production
npm run start            # Démarrer en production
npm run check            # Vérification TypeScript
```

### Setup & Maintenance
```bash
npm run setup            # Setup automatique interactif
npm run health           # Vérifier la santé du système
npm run health:watch     # Monitoring continu
npm run secrets:generate # Générer les secrets de sécurité
npm run clean            # Clean install complet
```

### Database
```bash
npm run db:push          # Push schema vers DB
npm run db:studio        # Ouvrir Drizzle Studio
npm run db:generate      # Générer migrations
npm run db:migrate       # Appliquer migrations
```

### Security
```bash
npm run audit:security   # Audit de sécurité npm
npm run audit:fix        # Corriger les vulnérabilités
```

---

## 🎯 Utilisation

### 1. Premier Lancement

```bash
# Créer le compte admin
curl -X POST http://localhost:5000/api/auth/init

# Ou visiter dans le navigateur :
# http://localhost:5000/api/auth/init
```

### 2. Connexion Staff

- URL : `http://localhost:5000/login`
- Username : `admin`
- Password : `admin123`

**⚠️ CHANGEZ LE MOT DE PASSE IMMÉDIATEMENT !**

### 3. Connexion Visiteur

Les participants se connectent avec :
- Code secret (5 chiffres)
- Première lettre du nom de famille

---

## 🧪 Tests

### Installation

```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

### Configuration

Créer `jest.config.js` :

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.d.ts',
    '!server/__tests__/**',
  ],
};
```

### Exemples

Voir les templates complets dans `server/__tests__/*.example`

### Lancer les Tests

```bash
npm test                 # Tous les tests
npm run test:watch       # Mode watch
npm run test:coverage    # Avec couverture
```

---

## 📊 Métriques du Projet

- **Lines of Code** : ~10,000+
- **TypeScript Files** : 70+
- **UI Components** : 40+
- **API Endpoints** : 50+
- **Database Tables** : 13
- **Security Score** : 4/5 ⭐⭐⭐⭐
- **Test Coverage** : Target 80%

---

## 🗺️ Roadmap

### ✅ Version 1.1.0 (Actuelle) - Security Update
- [x] bcrypt password hashing
- [x] Rate limiting
- [x] Helmet security headers
- [x] PostgreSQL sessions
- [x] Environment variable validation

### 🔄 Version 1.2.0 - Architecture
- [ ] Modularize routes.ts
- [ ] Unit tests (50% coverage)
- [ ] Structured logging (Winston)
- [ ] Pagination

### 🚀 Version 1.3.0 - Developer Experience
- [ ] API documentation (Swagger)
- [ ] CI/CD pipeline
- [ ] ESLint + Prettier
- [ ] Pre-commit hooks

### 🎯 Version 2.0.0 - Enterprise
- [ ] Sentry monitoring
- [ ] Automated backups
- [ ] PWA / Service Worker
- [ ] Advanced analytics

Voir [AUDIT.md](./AUDIT.md) pour la roadmap complète.

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](./CONTRIBUTING.md) pour :
- Code de conduite
- Process de contribution
- Standards de code
- Guidelines de tests

### Quick Start Contribution

```bash
# Fork & clone
git clone https://github.com/YOUR_USERNAME/DarkEventManager.git

# Créer une branche
git checkout -b feature/ma-fonctionnalite

# Développer, commiter, pusher
git commit -m "feat: add new feature"
git push origin feature/ma-fonctionnalite

# Créer une Pull Request sur GitHub
```

---

## 🔒 Sécurité

### Reporting Vulnerabilities

**NE PAS** créer d'issue publique pour les vulnérabilités.

**Envoyer un email à** : security@darkeventmanager.com

Voir [SECURITY.md](./SECURITY.md) pour les détails.

### Security Features

- ✅ bcrypt password hashing (salt rounds: 12)
- ✅ Rate limiting (auth: 5/15min, API: 100/min)
- ✅ Helmet security headers
- ✅ PostgreSQL persistent sessions
- ✅ AES-256-CBC QR encryption
- ✅ Zod input validation
- ✅ Complete audit trail
- ✅ Role-based access control

---

## 📝 Licence

MIT License - voir [LICENSE](./LICENSE)

---

## 👥 Auteurs

- **Équipe DarkEventManager**
- Contributions bienvenues !

---

## 🙏 Remerciements

- **Shadcn/ui** pour les magnifiques composants
- **Drizzle** pour l'ORM type-safe
- **Replit** pour l'infrastructure de développement
- La communauté open-source

---

## 📞 Support

- **Documentation** : Voir les fichiers dans `/docs`
- **Issues** : [GitHub Issues](https://github.com/WilyKV/DarkEventManager/issues)
- **Discussions** : [GitHub Discussions](https://github.com/WilyKV/DarkEventManager/discussions)

---

## 🌟 Star History

Si ce projet vous a aidé, n'hésitez pas à lui donner une ⭐ sur GitHub !

---

<div align="center">

**Fait avec ❤️ pour Zomb'in The Dark**

[Documentation](./docs) • [Security](./SECURITY.md) • [Contributing](./CONTRIBUTING.md) • [Changelog](./CHANGELOG.md)

</div>
