#!/bin/sh
set -eu

: "${DATABASE_URL:?Renseignez DATABASE_URL dans les variables de démarrage}"
: "${SESSION_SECRET:?Renseignez SESSION_SECRET dans les variables de démarrage}"
: "${WEBSOCKET_SECRET:?Renseignez WEBSOCKET_SECRET dans les variables de démarrage}"
: "${QR_ENCRYPTION_KEY:?Renseignez QR_ENCRYPTION_KEY dans les variables de démarrage}"

exec node dist/index.js
