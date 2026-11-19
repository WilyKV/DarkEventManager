#!/bin/sh
set -eu

: "${DATABASE_URL:?Renseignez DATABASE_URL dans les variables de démarrage}"

# Check the connection directly because Drizzle Kit can hide connection errors.
node --input-type=module <<'JS'
import pg from "pg";

let client;
try {
  client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
} catch (error) {
  const hints = {
    "28P01": "identifiant ou mot de passe refusé",
    "3D000": "base introuvable",
    ENOTFOUND: "nom d’hôte introuvable",
    ECONNREFUSED: "port PostgreSQL inaccessible",
  };
  console.error(`Connexion PostgreSQL impossible (${error.code ?? "configuration"}) : ${hints[error.code] ?? "vérifiez l’URL, le réseau et les paramètres TLS"}.`);
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
JS

output=$(mktemp)
trap 'rm -f "$output"' EXIT

# Drizzle Kit can log an error without returning a nonzero exit code.
if npm run db:push -- --config drizzle.hosted.config.ts >"$output" 2>&1 && grep -Eq '\] (Changes applied|No changes detected)' "$output"; then
  cat "$output"
else
  cat "$output" >&2
  echo 'Migration PostgreSQL non confirmée. Vérifiez la connexion et les changements proposés.' >&2
  exit 1
fi
