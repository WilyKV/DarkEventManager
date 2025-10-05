.PHONY: help install up down build restart logs clean db-push exec

DOCKER_COMPOSE = docker-compose -f .docker/docker-compose.yml

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Installe les dépendances dans le conteneur
	$(DOCKER_COMPOSE) run --rm app npm install

up: ## Démarre les conteneurs
	$(DOCKER_COMPOSE) up -d --build --remove-orphans

down: ## Arrête les conteneurs
	$(DOCKER_COMPOSE) down

build: ## Build les images Docker
	$(DOCKER_COMPOSE) build

restart: ## Redémarre les conteneurs
	$(DOCKER_COMPOSE) restart

logs: ## Affiche les logs
	$(DOCKER_COMPOSE) logs -f

clean: ## Supprime les conteneurs et volumes
	$(DOCKER_COMPOSE) down -v

db-push: ## Applique les migrations de base de données
	$(DOCKER_COMPOSE) run --rm app npm run db:push

start: down build up db-push

exec: ## Accède au shell du conteneur app
	$(DOCKER_COMPOSE) exec app sh
