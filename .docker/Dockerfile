FROM node:24-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --no-audit --no-fund

# Copier le reste des fichiers
COPY . .

# Build de l'application
RUN npm run build

# Exposer le port
EXPOSE 5000

# Démarrer l'application
CMD ["npm", "start"]
