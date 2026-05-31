/**
 * A.7 — Sessions persistantes via connect-pg-simple
 *
 * Teste la fonction pure `createSessionStore(env, pool)` qui choisit
 * le bon store en fonction de l'environnement et de la disponibilité
 * d'une connexion à la base de données.
 *
 * Contrat attendu de la fonction :
 *   - Signature : createSessionStore(env: NodeJS.ProcessEnv, pool: pg.Pool | null): session.Store
 *   - env.NODE_ENV === 'production' ET pool non-null  → PgSessionStore (connect-pg-simple)
 *   - env.NODE_ENV === 'development' ET pool null      → MemoryStore + console.warn
 *   - env.NODE_ENV === 'development' ET pool non-null  → MemoryStore + console.warn (dev = toujours mémoire)
 *   - env.NODE_ENV === 'production'  ET pool null      → throw Error (fail-fast)
 *
 * Note developer (Phase 2b) :
 *   - Créer `server/session-config.ts` et y exporter `createSessionStore`
 *   - connect-pg-simple doit être instancié avec :
 *       { tableName: 'sessions', createTableIfMissing: true, pool }
 *   - Ajouter la table `sessions` dans `shared/schema.ts` (voir schéma en bas de fichier)
 *   - Câbler `createSessionStore` dans `server/index.ts` à la place du `new SessionStore()`
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Pool } from "pg";
import type session from "express-session";

// ---------------------------------------------------------------------------
// Mock total de connect-pg-simple — aucun appel DB réel
// ---------------------------------------------------------------------------

// La factory de connect-pg-simple prend `session` en paramètre et retourne
// une classe. On simule ce comportement avec un constructeur espionnable.
const MockPgStoreConstructor = vi.fn().mockImplementation(function (
  this: any,
  opts: Record<string, unknown>
) {
  this._opts = opts;
  // Interface minimale attendue par express-session
  this.get = vi.fn();
  this.set = vi.fn();
  this.destroy = vi.fn();
});

const mockConnectPgSimpleFactory = vi.fn().mockReturnValue(MockPgStoreConstructor);

vi.mock("connect-pg-simple", () => ({
  default: mockConnectPgSimpleFactory,
}));

// Mock de memorystore — retourne un constructeur espionnable
const MockMemoryStoreConstructor = vi.fn().mockImplementation(function (
  this: any,
  opts: Record<string, unknown>
) {
  this._opts = opts;
  this.get = vi.fn();
  this.set = vi.fn();
  this.destroy = vi.fn();
});

const mockMemoryStoreFactory = vi.fn().mockReturnValue(MockMemoryStoreConstructor);

vi.mock("memorystore", () => ({
  default: mockMemoryStoreFactory,
}));

// ---------------------------------------------------------------------------
// Import différé pour que les mocks soient actifs avant le chargement du module
// ---------------------------------------------------------------------------

// `createSessionStore` sera importée depuis le fichier que le developer créera.
// On l'importe ici via un chemin relatif vers le futur `server/session-config.ts`.
// Tant que ce fichier n'existe pas, le test échoue à l'import → phase RED attendue.
import { createSessionStore } from "../../server/session-config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Crée un faux pg.Pool (pas d'appels DB réels) */
function makeFakePool(): Pool {
  return {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as Pool;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createSessionStore", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    MockPgStoreConstructor.mockClear();
    MockMemoryStoreConstructor.mockClear();
    mockConnectPgSimpleFactory.mockClear();
    mockMemoryStoreFactory.mockClear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  describe("en environnement production avec DATABASE_URL présent", () => {
    it("should retourner un PgSessionStore when NODE_ENV=production et pool fourni", () => {
      // Arrange
      const env = { NODE_ENV: "production", DATABASE_URL: "postgres://host/db" };
      const pool = makeFakePool();

      // Act
      const store = createSessionStore(env, pool);

      // Assert — le store retourné est une instance de PgSessionStore mocké
      expect(store).toBeInstanceOf(MockPgStoreConstructor);
    });

    it("should instancier connect-pg-simple avec tableName='sessions' when NODE_ENV=production", () => {
      // Arrange
      const env = { NODE_ENV: "production", DATABASE_URL: "postgres://host/db" };
      const pool = makeFakePool();

      // Act
      createSessionStore(env, pool);

      // Assert — les options de construction sont correctes
      expect(MockPgStoreConstructor).toHaveBeenCalledOnce();
      const opts = MockPgStoreConstructor.mock.calls[0][0] as Record<string, unknown>;
      expect(opts.tableName).toBe("sessions");
    });

    it("should instancier connect-pg-simple avec createTableIfMissing=true when NODE_ENV=production", () => {
      // Arrange
      const env = { NODE_ENV: "production", DATABASE_URL: "postgres://host/db" };
      const pool = makeFakePool();

      // Act
      createSessionStore(env, pool);

      // Assert
      const opts = MockPgStoreConstructor.mock.calls[0][0] as Record<string, unknown>;
      expect(opts.createTableIfMissing).toBe(true);
    });

    it("should transmettre le pool pg au PgSessionStore when NODE_ENV=production", () => {
      // Arrange
      const env = { NODE_ENV: "production", DATABASE_URL: "postgres://host/db" };
      const pool = makeFakePool();

      // Act
      createSessionStore(env, pool);

      // Assert — le pool est bien passé (pas un autre objet)
      const opts = MockPgStoreConstructor.mock.calls[0][0] as Record<string, unknown>;
      expect(opts.pool).toBe(pool);
    });

    it("should ne pas émettre de warning when NODE_ENV=production et pool fourni", () => {
      // Arrange
      const env = { NODE_ENV: "production", DATABASE_URL: "postgres://host/db" };
      const pool = makeFakePool();

      // Act
      createSessionStore(env, pool);

      // Assert
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("en environnement production SANS pool (fail-fast)", () => {
    it("should throw une erreur explicite when NODE_ENV=production et pool null", () => {
      // Arrange
      const env = { NODE_ENV: "production", DATABASE_URL: undefined };

      // Act & Assert
      expect(() => createSessionStore(env, null)).toThrow();
    });

    it("should inclure 'DATABASE_URL' dans le message d'erreur when pool null en production", () => {
      // Arrange
      const env = { NODE_ENV: "production", DATABASE_URL: undefined };

      // Act & Assert
      expect(() => createSessionStore(env, null)).toThrowError(/DATABASE_URL/i);
    });

    it("should ne pas instancier de store avant de throw when NODE_ENV=production et pool null", () => {
      // Arrange
      const env = { NODE_ENV: "production", DATABASE_URL: undefined };

      // Act
      try { createSessionStore(env, null); } catch { /* intentionnel */ }

      // Assert — aucun store ne doit avoir été construit
      expect(MockPgStoreConstructor).not.toHaveBeenCalled();
      expect(MockMemoryStoreConstructor).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("en environnement development SANS pool", () => {
    it("should retourner un MemoryStore when NODE_ENV=development et pool null", () => {
      // Arrange
      const env = { NODE_ENV: "development", DATABASE_URL: undefined };

      // Act
      const store = createSessionStore(env, null);

      // Assert
      expect(store).toBeInstanceOf(MockMemoryStoreConstructor);
    });

    it("should émettre un warning quand le MemoryStore est utilisé en development", () => {
      // Arrange
      const env = { NODE_ENV: "development", DATABASE_URL: undefined };

      // Act
      createSessionStore(env, null);

      // Assert — le developer est averti que la persistance est absente
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("should mentionner 'MemoryStore' dans le warning when NODE_ENV=development", () => {
      // Arrange
      const env = { NODE_ENV: "development", DATABASE_URL: undefined };

      // Act
      createSessionStore(env, null);

      // Assert
      const warnMessage = warnSpy.mock.calls[0][0] as string;
      expect(warnMessage).toMatch(/MemoryStore/i);
    });

    it("should ne pas instancier PgSessionStore when NODE_ENV=development", () => {
      // Arrange
      const env = { NODE_ENV: "development", DATABASE_URL: undefined };

      // Act
      createSessionStore(env, null);

      // Assert
      expect(MockPgStoreConstructor).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("en environnement development AVEC pool fourni", () => {
    it("should retourner un MemoryStore même si un pool est disponible when NODE_ENV=development", () => {
      // Arrange — en dev on ne veut pas utiliser PG pour les sessions
      const env = { NODE_ENV: "development", DATABASE_URL: "postgres://host/db" };
      const pool = makeFakePool();

      // Act
      const store = createSessionStore(env, pool);

      // Assert
      expect(store).toBeInstanceOf(MockMemoryStoreConstructor);
    });

    it("should émettre un warning même si pool fourni when NODE_ENV=development", () => {
      // Arrange
      const env = { NODE_ENV: "development", DATABASE_URL: "postgres://host/db" };
      const pool = makeFakePool();

      // Act
      createSessionStore(env, pool);

      // Assert
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("should ne pas instancier PgSessionStore when NODE_ENV=development même avec pool", () => {
      // Arrange
      const env = { NODE_ENV: "development", DATABASE_URL: "postgres://host/db" };
      const pool = makeFakePool();

      // Act
      createSessionStore(env, pool);

      // Assert
      expect(MockPgStoreConstructor).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("en environnement test (NODE_ENV=test)", () => {
    it("should retourner un MemoryStore when NODE_ENV=test et pool null", () => {
      // Arrange
      const env = { NODE_ENV: "test", DATABASE_URL: undefined };

      // Act
      const store = createSessionStore(env, null);

      // Assert
      expect(store).toBeInstanceOf(MockMemoryStoreConstructor);
    });

    it("should ne pas throw when NODE_ENV=test et pool null", () => {
      // Arrange
      const env = { NODE_ENV: "test", DATABASE_URL: undefined };

      // Act & Assert
      expect(() => createSessionStore(env, null)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  describe("valeur de retour — interface session.Store", () => {
    it("should retourner un objet avec les méthodes get, set, destroy when production", () => {
      // Arrange
      const env = { NODE_ENV: "production", DATABASE_URL: "postgres://host/db" };
      const pool = makeFakePool();

      // Act
      const store = createSessionStore(env, pool) as session.Store & {
        get: unknown; set: unknown; destroy: unknown;
      };

      // Assert — interface minimale attendue par express-session
      expect(typeof store.get).toBe("function");
      expect(typeof store.set).toBe("function");
      expect(typeof store.destroy).toBe("function");
    });

    it("should retourner un objet avec les méthodes get, set, destroy when development", () => {
      // Arrange
      const env = { NODE_ENV: "development", DATABASE_URL: undefined };

      // Act
      const store = createSessionStore(env, null) as session.Store & {
        get: unknown; set: unknown; destroy: unknown;
      };

      // Assert
      expect(typeof store.get).toBe("function");
      expect(typeof store.set).toBe("function");
      expect(typeof store.destroy).toBe("function");
    });
  });
});

/*
 * ---------------------------------------------------------------------------
 * SCHÉMA DRIZZLE pour la table `sessions` (à ajouter dans shared/schema.ts)
 * ---------------------------------------------------------------------------
 *
 * import { index } from "drizzle-orm/pg-core";
 *
 * export const sessions = pgTable(
 *   "sessions",
 *   {
 *     sid:    text("sid").primaryKey(),
 *     sess:   json("sess").notNull(),
 *     expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
 *   },
 *   (table) => [
 *     index("sessions_expire_idx").on(table.expire),
 *   ]
 * );
 *
 * Conforme à connect-pg-simple v10 :
 *   https://github.com/voxpelli/node-connect-pg-simple#usage
 * ---------------------------------------------------------------------------
 */
