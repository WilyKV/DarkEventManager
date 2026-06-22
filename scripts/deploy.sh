#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Déploiement DarkEventManager sur Jetson Orin Nano
# Usage : bash scripts/deploy.sh [TAG]
#   TAG : tag git à déployer (ex: v1.2.3), défaut : "latest"
#
# RÈGLES DE SÉCURITÉ :
#   - Toutes les commandes docker compose portent -p darkevent
#   - Jamais de docker system prune ou image prune global
#   - Jamais de down -v (détruirait les données)
#   - Les 13 autres conteneurs du Jetson ne sont jamais touchés
# =============================================================================
set -euo pipefail

# =============================================================================
# 0. Variables globales
# =============================================================================
TAG="${1:-latest}"
COMPOSE_FILE=".docker/docker-compose.prod.yml"
COMPOSE_PROJECT="darkevent"
APP_PORT="${APP_PORT:-5000}"
BACKUP_DIR="${HOME}/DarkEventManager/backups"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Raccourci pour toutes les commandes docker compose scopées
DC="docker compose -p ${COMPOSE_PROJECT} -f ${REPO_ROOT}/${COMPOSE_FILE}"

echo "=== DarkEventManager — Déploiement du tag : ${TAG} ==="
echo "    Racine repo : ${REPO_ROOT}"
echo "    Compose     : ${REPO_ROOT}/${COMPOSE_FILE}"

# Se placer à la racine du repo (requis pour les chemins relatifs du compose)
cd "${REPO_ROOT}"

# =============================================================================
# 1. Capturer l'image actuelle pour rollback éventuel
# =============================================================================
echo ""
echo "--- [1/8] Capture de l'image actuelle pour rollback ---"
PREVIOUS_IMAGE_ID=""
if docker inspect darkevent_app > /dev/null 2>&1; then
    # Capture le SHA256 de l'image réellement en cours d'exécution (pas le tag,
    # qui serait écrasé par le build suivant).
    PREVIOUS_IMAGE_ID=$(docker inspect darkevent_app \
        --format '{{.Image}}' 2>/dev/null || true)
    echo "    Image actuelle (sha256) : ${PREVIOUS_IMAGE_ID:-inconnue}"
else
    echo "    Aucun conteneur darkevent_app existant (premier déploiement)."
fi

# =============================================================================
# 2. Dump PostgreSQL avant toute migration (optionnel si DB inexistante)
# =============================================================================
echo ""
echo "--- [2/8] Sauvegarde PostgreSQL pré-migration ---"
mkdir -p "${BACKUP_DIR}"
DUMP_FILE="${BACKUP_DIR}/dump_$(date +%Y%m%d_%H%M%S).sql"

if docker inspect darkevent_db > /dev/null 2>&1; then
    echo "    Dump vers : ${DUMP_FILE}"
    # -T : pas de TTY (compatibilité CI)
    if ${DC} exec -T db pg_dump \
        -U darkevent \
        --no-password \
        darkevent > "${DUMP_FILE}" 2>/dev/null; then
        # Vérifie que le dump n'est pas vide
        if [ ! -s "${DUMP_FILE}" ]; then
            rm -f "${DUMP_FILE}"
            echo "    AVERTISSEMENT : dump vide supprimé. Déploiement continue."
        else
            echo "    Dump OK."
        fi
    else
        rm -f "${DUMP_FILE}"
        echo "    AVERTISSEMENT : dump échoué (DB peut-être vide). Déploiement continue."
    fi
else
    echo "    Pas de conteneur DB actif — dump ignoré (premier déploiement)."
fi

# Nettoyage : garder les 5 dumps les plus récents, supprimer les autres
ls -t "${BACKUP_DIR}"/dump_*.sql 2>/dev/null | tail -n +6 | xargs -r rm -f \
    && echo "    Anciens dumps purgés (5 plus récents conservés)."

# =============================================================================
# 3. Build de la nouvelle image
# =============================================================================
echo ""
echo "--- [3/8] Build de l'image Docker ---"
${DC} build
# Double-tagage : TAG versionné (conservé pour rollback) + latest (référence courante)
docker tag darkevent-app:latest "darkevent-app:${TAG}" 2>/dev/null \
    || docker image tag \
        "$(${DC} images -q app 2>/dev/null | head -1)" \
        "darkevent-app:${TAG}" 2>/dev/null \
    || true
echo "    Build OK (image taguée darkevent-app:${TAG} et darkevent-app:latest)."

# =============================================================================
# 4. Démarrage de la DB seule et attente du healthcheck
# =============================================================================
echo ""
echo "--- [4/8] Démarrage de la base de données ---"
${DC} up -d db
echo "    Attente de la DB (pg_isready)..."

MAX_WAIT=60
WAITED=0
until ${DC} exec -T db pg_isready -U darkevent -q 2>/dev/null; do
    if [ "${WAITED}" -ge "${MAX_WAIT}" ]; then
        echo "    ERREUR : DB non disponible après ${MAX_WAIT}s."
        exit 1
    fi
    sleep 2
    WAITED=$((WAITED + 2)) || true
done
echo "    DB prête (${WAITED}s)."

# =============================================================================
# 5. Migration de la base de données (drizzle-kit push)
# =============================================================================
echo ""
echo "--- [5/8] Migration DB (drizzle-kit push) ---"
# Le service db-migrate utilise le stage builder (drizzle-kit disponible).
# --force : approuve automatiquement les statements potentiellement destructifs
# (drizzle-kit v0.31.10+ supporte ce flag nativement — pas besoin de pipe stdin).
${DC} run --rm --no-deps db-migrate
echo "    Migration OK."

# =============================================================================
# 6. Déploiement de l'application
# =============================================================================
echo ""
echo "--- [6/8] Déploiement de l'application ---"
${DC} up -d
echo "    Conteneurs démarrés."

# =============================================================================
# 7. Smoke test — attendre que l'app réponde HTTP 200
# =============================================================================
echo ""
echo "--- [7/8] Smoke test (http://localhost:${APP_PORT}) ---"
MAX_SMOKE=60
SMOKE_WAITED=0
HTTP_OK=false

until curl -sf "http://localhost:${APP_PORT}/" > /dev/null 2>&1; do
    if [ "${SMOKE_WAITED}" -ge "${MAX_SMOKE}" ]; then
        HTTP_OK=false
        break
    fi
    sleep 3
    SMOKE_WAITED=$((SMOKE_WAITED + 3)) || true
done

if curl -sf "http://localhost:${APP_PORT}/" > /dev/null 2>&1; then
    HTTP_OK=true
fi

if [ "${HTTP_OK}" = "true" ]; then
    echo "    App répond OK (${SMOKE_WAITED}s)."
else
    echo "    ERREUR : l'app ne répond pas après ${MAX_SMOKE}s."

    # --- Rollback ---
    echo ""
    echo "--- ROLLBACK en cours ---"
    echo "    Logs récents :"
    ${DC} logs --tail=30 app || true

    if [ -n "${PREVIOUS_IMAGE_ID}" ]; then
        echo "    Retour sur l'image SHA256 : ${PREVIOUS_IMAGE_ID}"
        # Re-tague l'ancienne image vers le nom attendu par compose (darkevent-app:latest)
        # puis relance via compose pour rester dans l'isolation du projet darkevent.
        if docker tag "${PREVIOUS_IMAGE_ID}" darkevent-app:rollback-in-progress 2>/dev/null; then
            docker tag darkevent-app:rollback-in-progress darkevent-app:latest 2>/dev/null || true
            docker rmi darkevent-app:rollback-in-progress 2>/dev/null || true
            ${DC} up -d app \
                && echo "    Rollback via compose OK." \
                || echo "    AVERTISSEMENT : rollback automatique impossible — intervention manuelle requise."
        else
            echo "    AVERTISSEMENT : re-tagage impossible — intervention manuelle requise."
        fi
    else
        echo "    Pas d'image précédente — rollback manuel requis."
        echo "    Commandes : ${DC} logs app && ${DC} down"
    fi

    exit 1
fi

# =============================================================================
# 8. Nettoyage CIBLÉ des images orphelines du projet darkevent
# =============================================================================
echo ""
echo "--- [8/8] Nettoyage des images orphelines ---"
# JAMAIS de docker image prune global — filtre strict sur le projet darkevent
docker image prune -f \
    --filter "label=com.docker.compose.project=darkevent" \
    2>/dev/null \
    && echo "    Nettoyage OK." \
    || echo "    Nettoyage ignoré (aucune image orpheline)."

# =============================================================================
# Résumé
# =============================================================================
echo ""
echo "=============================================="
echo " Déploiement ${TAG} terminé avec succès."
echo " App : http://localhost:${APP_PORT}"
echo " Logs : docker compose -p darkevent -f .docker/docker-compose.prod.yml logs -f"
echo "=============================================="
