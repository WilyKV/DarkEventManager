.PHONY: help install up down build restart logs clean db-push exec local

DOCKER_COMPOSE = docker-compose -f .docker/docker-compose.yml
LOCAL_COMPOSE = docker compose -f .docker/docker-compose.yml -f .docker/docker-compose.local.yml

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

local: ## Lance l'aperçu Docker sur http://127.0.0.1:5000
	$(LOCAL_COMPOSE) build app
	$(LOCAL_COMPOSE) up -d --wait db
	$(LOCAL_COMPOSE) run --rm --no-deps app npm run db:push
	$(LOCAL_COMPOSE) up -d --wait app

install: ## Installe les dépendances dans le conteneur
	$(DOCKER_COMPOSE) run --rm app npm install

npm-install: ## Installe un paquet npm (usage: make npm-install PACKAGES="package-name")
	$(DOCKER_COMPOSE) run --rm app npm install $(PACKAGES)

npm-install-dev: ## Installe un paquet npm en dev (usage: make npm-install-dev PACKAGES="@types/package")
	$(DOCKER_COMPOSE) run --rm app npm install --save-dev $(PACKAGES)

up: ## Démarre les conteneurs
	$(DOCKER_COMPOSE) up -d --remove-orphans

down: ## Arrête les conteneurs
	$(DOCKER_COMPOSE) down

restart: ## Redémarre les conteneurs
	$(DOCKER_COMPOSE) restart

build: ## Build les images Docker
	$(DOCKER_COMPOSE) build --no-cache

logs: ## Affiche les logs
	$(DOCKER_COMPOSE) logs -f

clean: ## Supprime les conteneurs et volumes
	$(DOCKER_COMPOSE) down -v

db-push: ## Applique les migrations de base de données
	$(DOCKER_COMPOSE) run --rm app npm run db:push

start: down build up db-push

exec: ## Accède au shell du conteneur app
	$(DOCKER_COMPOSE) exec app sh
