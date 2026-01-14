# 🤝 Guide de Contribution - DarkEventManager

Merci de votre intérêt pour contribuer à DarkEventManager ! Ce guide vous aidera à commencer.

---

## 📋 Table des Matières

- [Code de Conduite](#code-de-conduite)
- [Comment Contribuer](#comment-contribuer)
- [Setup Environnement de Développement](#setup-environnement-de-développement)
- [Architecture du Projet](#architecture-du-projet)
- [Standards de Code](#standards-de-code)
- [Process de Pull Request](#process-de-pull-request)
- [Tests](#tests)
- [Sécurité](#sécurité)

---

## 🤗 Code de Conduite

Ce projet adhère à un code de conduite. En participant, vous acceptez de maintenir un environnement respectueux et accueillant pour tous.

**Attendus** :
- Respecter les opinions et expériences différentes
- Accepter les critiques constructives
- Se concentrer sur ce qui est meilleur pour la communauté
- Faire preuve d'empathie envers les autres membres

---

## 💡 Comment Contribuer

### Types de Contributions Acceptées

1. **🐛 Corrections de Bugs**
   - Rapporter des bugs via les issues
   - Proposer des corrections avec pull requests

2. **✨ Nouvelles Fonctionnalités**
   - Discuter d'abord dans une issue
   - Suivre le roadmap dans `AUDIT.md`

3. **📚 Documentation**
   - Améliorer les guides existants
   - Ajouter des exemples
   - Corriger les typos

4. **🧪 Tests**
   - Augmenter la couverture de tests
   - Ajouter des cas d'edge

5. **🎨 Améliorations UI/UX**
   - Corrections visuelles
   - Améliorations d'accessibilité

### Créer une Issue

**Avant de créer une issue** :
1. Vérifiez qu'elle n'existe pas déjà
2. Utilisez les templates fournis
3. Soyez précis et descriptif

**Template Bug Report** :
```markdown
## Description du Bug
[Description claire et concise]

## Steps to Reproduce
1. Aller sur '...'
2. Cliquer sur '...'
3. Scroller jusqu'à '...'
4. Voir l'erreur

## Comportement Attendu
[Ce qui devrait se passer]

## Comportement Actuel
[Ce qui se passe réellement]

## Environnement
- OS: [e.g., Ubuntu 22.04]
- Node version: [e.g., 18.17.0]
- Browser: [e.g., Chrome 120]

## Screenshots
[Si applicable]

## Logs
[Coller les logs pertinents]
```

---

## 🛠️ Setup Environnement de Développement

### Prérequis

- **Node.js** 18+
- **PostgreSQL** 14+
- **Git**
- **npm** ou **yarn**

### Installation Rapide

```bash
# Cloner le repository
git clone https://github.com/WilyKV/DarkEventManager.git
cd DarkEventManager

# Setup automatique
npm run setup

# Ou manuel :
npm install
cp .env.example .env
# Éditer .env et générer les secrets
npm run secrets:generate
npm run db:push
```

### Démarrer le Serveur de Dev

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:5000`

### Vérifier la Santé

```bash
npm run health
```

---

## 🏗️ Architecture du Projet

```
DarkEventManager/
├── client/               # Frontend React
│   └── src/
│       ├── pages/        # Pages de l'app
│       ├── components/   # Composants réutilisables
│       ├── hooks/        # Custom hooks
│       └── lib/          # Utilitaires
├── server/               # Backend Express
│   ├── routes.ts         # Routes API principales
│   ├── storage.ts        # Couche d'abstraction DB
│   ├── auth-routes.ts    # Authentification
│   └── __tests__/        # Tests serveur
├── shared/               # Code partagé (schemas)
├── scripts/              # Scripts utilitaires
└── docs/                 # Documentation
```

### Stack Technique

**Frontend** :
- React 18 + TypeScript
- Tailwind CSS + Shadcn/ui
- TanStack Query (React Query)
- Wouter (routing)
- Zod (validation)

**Backend** :
- Express.js + TypeScript
- PostgreSQL + Drizzle ORM
- bcrypt (passwords)
- WebSocket (sync)

---

## 📝 Standards de Code

### TypeScript

- **Toujours typer explicitement** les paramètres de fonction
- **Éviter `any`**, utiliser `unknown` si nécessaire
- **Utiliser les types Zod** pour la validation

```typescript
// ✅ Bon
async function getUser(id: number): Promise<User | null> {
  return await storage.getUser(id);
}

// ❌ Mauvais
async function getUser(id) {
  return await storage.getUser(id);
}
```

### Naming Conventions

- **Variables/Functions** : `camelCase`
- **Classes/Types** : `PascalCase`
- **Constants** : `UPPER_SNAKE_CASE`
- **Files** : `kebab-case.ts`
- **Components** : `PascalCase.tsx`

```typescript
// Variables
const participantCount = 10;

// Functions
function calculateDiscount(price: number): number {}

// Types
interface ParticipantData {}
type DiscountType = 'percentage' | 'fixed';

// Constants
const MAX_RETRIES = 3;
const API_BASE_URL = 'http://localhost:5000';
```

### Code Style

**Indentation** : 2 espaces
**Quotes** : Simple quotes `'` pour strings
**Semicolons** : Optionnel (mais consistant)

```typescript
// ✅ Bon
const message = 'Hello World'
const user = { name: 'John', age: 30 }

// ❌ Mauvais
const message="Hello World";
const user={name:"John",age:30};
```

### Comments

- **Commenter le "pourquoi", pas le "quoi"**
- **JSDoc pour les fonctions publiques**

```typescript
/**
 * Calculate discount for a participant based on priority rules.
 * Priority: participant-specific > squad > type
 *
 * @param participantId - The participant ID
 * @returns The discount percentage (0-100)
 */
async function calculateDiscount(participantId: number): Promise<number> {
  // Check participant-specific discount first (highest priority)
  const participantDiscount = await getParticipantDiscount(participantId);
  if (participantDiscount !== null) {
    return participantDiscount;
  }

  // Fall back to squad or type discount
  return await getDefaultDiscount(participantId);
}
```

### Error Handling

```typescript
// ✅ Bon : Gérer les erreurs spécifiquement
try {
  await updateParticipant(id, data);
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ message: error.message });
  }
  if (error instanceof NotFoundError) {
    return res.status(404).json({ message: 'Participant not found' });
  }
  logger.error('Unexpected error', { error, participantId: id });
  return res.status(500).json({ message: 'Internal server error' });
}

// ❌ Mauvais : Catch générique silencieux
try {
  await updateParticipant(id, data);
} catch (error) {
  console.log('Error');
}
```

---

## 🔄 Process de Pull Request

### 1. Fork & Branch

```bash
# Fork le repository sur GitHub

# Cloner votre fork
git clone https://github.com/VOTRE_USERNAME/DarkEventManager.git
cd DarkEventManager

# Créer une branche
git checkout -b feature/ma-nouvelle-fonctionnalite
# ou
git checkout -b fix/correction-bug
```

### 2. Développer

```bash
# Faire vos changements
# ...

# Vérifier que tout compile
npm run check

# Tester localement
npm run dev
npm run health
```

### 3. Commit

**Format des commits** : [Conventional Commits](https://www.conventionalcommits.org/)

```bash
# Types de commits :
# feat: Nouvelle fonctionnalité
# fix: Correction de bug
# docs: Documentation
# style: Formatting, missing semicolons, etc
# refactor: Refactoring
# test: Ajout de tests
# chore: Maintenance

# Exemples :
git commit -m "feat: add participant export to CSV"
git commit -m "fix: correct discount calculation for squads"
git commit -m "docs: update SECURITY.md with new procedures"
git commit -m "test: add unit tests for storage layer"
```

### 4. Push & Pull Request

```bash
# Push vers votre fork
git push origin feature/ma-nouvelle-fonctionnalite

# Créer une Pull Request sur GitHub
```

**Template de PR** :
```markdown
## Description
[Description claire des changements]

## Type de Changement
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Mon code suit les standards du projet
- [ ] J'ai commenté les parties complexes
- [ ] J'ai mis à jour la documentation
- [ ] Mes changements ne génèrent pas de warnings
- [ ] J'ai ajouté des tests
- [ ] Tous les tests passent
- [ ] J'ai vérifié la sécurité (pas de secrets exposés)

## Tests
[Comment tester ces changements]

## Screenshots
[Si applicable]

## Related Issues
Closes #123
```

### 5. Review Process

1. **Automated Checks** : CI/CD vérifie le code
2. **Code Review** : Un mainteneur revoit le code
3. **Tests** : Vérification manuelle si nécessaire
4. **Merge** : Si approuvé, merge dans main

**Lors de la review** :
- Soyez réceptif aux feedbacks
- Répondez aux commentaires
- Faites les changements demandés
- Re-poussez les commits

---

## 🧪 Tests

### Structure

```
server/
└── __tests__/
    ├── auth.test.ts
    ├── storage.test.ts
    └── routes.test.ts
```

### Écrire des Tests

Voir les exemples dans `server/__tests__/*.example`

**Configuration Jest** (à créer) :

```javascript
// jest.config.js
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

### Lancer les Tests

```bash
# Installer les dépendances de test (une fois)
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest

# Lancer tous les tests
npm test

# Lancer en mode watch
npm run test:watch

# Avec couverture
npm run test:coverage
```

### Guidelines de Tests

- **Tester les cas normaux ET les edge cases**
- **Mocker les dépendances externes** (DB, API, etc.)
- **Noms descriptifs** : `should return 404 when user not found`
- **Arrange-Act-Assert** pattern

```typescript
describe('calculateDiscount', () => {
  it('should return participant discount when set', async () => {
    // Arrange
    const participantId = 1;
    const expectedDiscount = 20;
    mockGetParticipantDiscount.mockResolvedValue(expectedDiscount);

    // Act
    const result = await calculateDiscount(participantId);

    // Assert
    expect(result).toBe(expectedDiscount);
  });
});
```

---

## 🔐 Sécurité

### Reporting Security Issues

**NE PAS** créer d'issue publique pour les vulnérabilités de sécurité.

**À la place** :
1. Envoyer un email à : security@darkeventmanager.com
2. Inclure :
   - Description de la vulnérabilité
   - Steps to reproduce
   - Impact potentiel
   - Votre suggestion de fix

### Security Checklist

Avant de soumettre du code :

- [ ] **Pas de secrets hardcodés** (API keys, passwords, etc.)
- [ ] **Input validation** avec Zod sur tous les endpoints
- [ ] **Authentication requise** pour les routes sensibles
- [ ] **Rate limiting** respecté
- [ ] **Pas de SQL injection** (utiliser Drizzle ORM)
- [ ] **Pas de XSS** (échapper les inputs utilisateur)
- [ ] **CSRF protection** en place
- [ ] **Logs** ne contiennent pas de données sensibles

### Code Security Guidelines

```typescript
// ❌ MAUVAIS : Secret exposé
const API_KEY = "sk_live_12345678";

// ✅ BON : Variable d'environnement
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error('API_KEY must be set');
}

// ❌ MAUVAIS : SQL injection possible
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ BON : Parameterized query
const user = await db.select().from(users).where(eq(users.id, userId));

// ❌ MAUVAIS : Pas de validation
app.post('/api/users', (req, res) => {
  const user = req.body;
  await createUser(user);
});

// ✅ BON : Validation Zod
app.post('/api/users', (req, res) => {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error });
  }
  await createUser(result.data);
});
```

---

## 📚 Ressources

- **Documentation** :
  - [AUDIT.md](./AUDIT.md) - Analyse complète et roadmap
  - [SECURITY.md](./SECURITY.md) - Guide de sécurité
  - [QUICKSTART.md](./QUICKSTART.md) - Guide de démarrage

- **Stack Documentation** :
  - [React](https://react.dev/)
  - [TypeScript](https://www.typescriptlang.org/)
  - [Drizzle ORM](https://orm.drizzle.team/)
  - [Express.js](https://expressjs.com/)
  - [Tailwind CSS](https://tailwindcss.com/)

- **Tools** :
  - [Shadcn/ui Components](https://ui.shadcn.com/)
  - [Zod Validation](https://zod.dev/)
  - [TanStack Query](https://tanstack.com/query/)

---

## ❓ Questions ?

- **Général** : Ouvrir une discussion sur GitHub
- **Bugs** : Créer une issue
- **Sécurité** : Email à security@darkeventmanager.com
- **Feature requests** : Créer une issue avec le tag `enhancement`

---

## 📜 Licence

En contribuant, vous acceptez que vos contributions soient sous la même licence MIT que le projet.

---

**Merci pour vos contributions ! 🎉**
