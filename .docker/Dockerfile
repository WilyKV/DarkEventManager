FROM node:22-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le reste des fichiers
COPY . .

# Build de l'application
RUN npm run build

# Exposer le port
EXPOSE 5000

# Démarrer l'application
CMD ["npm", "start"]
