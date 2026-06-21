// Database connection setup
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?\n" +
      "→ Avec Docker (recommandé) : `make start` (ou `docker-compose -f .docker/docker-compose.yml up -d --build`),\n" +
      "  ce qui lance Postgres ET injecte DATABASE_URL automatiquement.\n" +
      "→ En local sans Docker : copiez `.env.example` en `.env` (chargé via dotenv),\n" +
      "  puis assurez-vous qu'une base Postgres est accessible.",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
