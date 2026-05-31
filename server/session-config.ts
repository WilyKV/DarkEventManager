import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import MemoryStore from "memorystore";
import type { Pool } from "pg";

export function createSessionStore(
  env: Record<string, string | undefined>,
  pool: Pool | null,
): session.Store {
  const nodeEnv = env.NODE_ENV;

  if (nodeEnv === "production") {
    if (pool === null) {
      throw new Error("DATABASE_URL requis en production pour initialiser le store de sessions");
    }
    const PgStore = ConnectPgSimple(session);
    return new PgStore({ tableName: "sessions", createTableIfMissing: true, pool });
  }

  const MemStore = MemoryStore(session);
  if (nodeEnv === "development") {
    console.warn("[Session] MemoryStore utilisé — les sessions ne persistent pas entre les redémarrages");
  }
  return new MemStore({ checkPeriod: 86400000 });
}
