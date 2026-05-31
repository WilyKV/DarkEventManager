/**
 * A.8 — Logs conditionnels de session
 *
 * Teste la fonction `sessionLogger(req, msg, opts?)` qui adapte la verbosité
 * des logs en fonction de NODE_ENV et de la variable LOG_VERBOSE.
 *
 * Contrat attendu de la fonction :
 *   - Signature :
 *       sessionLogger(
 *         req: Pick<Request, 'method' | 'path'>,
 *         msg: string,
 *         opts?: { level?: 'info' | 'warn' | 'error'; env?: NodeJS.ProcessEnv }
 *       ): void
 *
 *   - NODE_ENV=test               → silence total (aucun console.*)
 *   - NODE_ENV=development        → info→log, warn→warn, error→error
 *   - NODE_ENV=production         → info→silence, warn→warn, error→error
 *   - LOG_VERBOSE=true (n'importe quel env) → tous les niveaux actifs
 *
 * Note developer (Phase 2b) :
 *   - Créer `server/session-logger.ts` et y exporter `sessionLogger`
 *   - Remplacer les `console.log`/`console.error` de session dans :
 *       · server/index.ts  (bloc "[Session Debug]")
 *       · server/auth-routes.ts  (Login error, Logout error, etc.)
 *   - Le paramètre `env` dans opts permet l'injection pour les tests ;
 *     en production la fonction lit `process.env` par défaut.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request } from "express";

// Import différé — ce fichier n'existe pas encore → phase RED attendue
import { sessionLogger } from "../../server/session-logger.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Crée un faux objet Request minimal pour les tests */
function makeFakeReq(
  overrides: Partial<Pick<Request, "method" | "path">> = {}
): Pick<Request, "method" | "path"> {
  return {
    method: overrides.method ?? "GET",
    path: overrides.path ?? "/api/auth/session",
  };
}

/** Variables d'environnement courantes à restaurer après chaque test */
const originalEnv = { ...process.env };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sessionLogger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy   = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy  = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    // Restaurer process.env si un test l'a modifié directement
    Object.assign(process.env, originalEnv);
    // Supprimer les clés ajoutées par les tests
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
  });

  // -------------------------------------------------------------------------
  describe("NODE_ENV=test — silence total", () => {
    const env = { NODE_ENV: "test", LOG_VERBOSE: undefined };

    it("should ne rien logguer au niveau info when NODE_ENV=test", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "message info", { level: "info", env });

      // Assert
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should ne rien logguer au niveau warn when NODE_ENV=test", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "message warn", { level: "warn", env });

      // Assert
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should ne rien logguer au niveau error when NODE_ENV=test", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "message error", { level: "error", env });

      // Assert
      expect(errorSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should ne rien logguer sans niveau explicite (défaut=info) when NODE_ENV=test", () => {
      // Arrange
      const req = makeFakeReq();

      // Act — pas d'option level → niveau par défaut est 'info'
      sessionLogger(req, "message sans niveau", { env });

      // Assert
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("NODE_ENV=development — tous les niveaux actifs", () => {
    const env = { NODE_ENV: "development", LOG_VERBOSE: undefined };

    it("should appeler console.log au niveau info when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq({ method: "POST", path: "/api/auth/login" });

      // Act
      sessionLogger(req, "connexion réussie", { level: "info", env });

      // Assert
      expect(logSpy).toHaveBeenCalledOnce();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should inclure le message dans l'appel console.log when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "détail de session", { level: "info", env });

      // Assert
      const logged = logSpy.mock.calls[0].join(" ");
      expect(logged).toContain("détail de session");
    });

    it("should appeler console.warn au niveau warn when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "session expirée", { level: "warn", env });

      // Assert
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should inclure le message dans l'appel console.warn when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "avertissement session", { level: "warn", env });

      // Assert
      const logged = warnSpy.mock.calls[0].join(" ");
      expect(logged).toContain("avertissement session");
    });

    it("should appeler console.error au niveau error when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "échec sauvegarde session", { level: "error", env });

      // Assert
      expect(errorSpy).toHaveBeenCalledOnce();
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should inclure le message dans l'appel console.error when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "erreur critique session", { level: "error", env });

      // Assert
      const logged = errorSpy.mock.calls[0].join(" ");
      expect(logged).toContain("erreur critique session");
    });

    it("should utiliser console.log par défaut (niveau info implicite) when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq();

      // Act — pas de level → défaut 'info'
      sessionLogger(req, "message par défaut", { env });

      // Assert
      expect(logSpy).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  describe("NODE_ENV=production — uniquement warn et error", () => {
    const env = { NODE_ENV: "production", LOG_VERBOSE: undefined };

    it("should ne pas appeler console.log au niveau info when NODE_ENV=production", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "info silencieuse", { level: "info", env });

      // Assert — les infos sont muettes en production
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should appeler console.warn au niveau warn when NODE_ENV=production", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "tentative suspecte", { level: "warn", env });

      // Assert
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should appeler console.error au niveau error when NODE_ENV=production", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "perte de session DB", { level: "error", env });

      // Assert
      expect(errorSpy).toHaveBeenCalledOnce();
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should ne pas appeler console.log par défaut (niveau info implicite) when NODE_ENV=production", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "info par défaut", { env });

      // Assert — même par défaut, info est muette en prod
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("LOG_VERBOSE=true — force tous les niveaux quel que soit NODE_ENV", () => {
    it("should appeler console.log au niveau info when LOG_VERBOSE=true et NODE_ENV=production", () => {
      // Arrange — normalement muet en production
      const env = { NODE_ENV: "production", LOG_VERBOSE: "true" };
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "info forcée verbose", { level: "info", env });

      // Assert — LOG_VERBOSE lève le silence
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it("should appeler console.log au niveau info when LOG_VERBOSE=true et NODE_ENV=test", () => {
      // Arrange — normalement silence total en test
      const env = { NODE_ENV: "test", LOG_VERBOSE: "true" };
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "info forcée en test", { level: "info", env });

      // Assert
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it("should appeler console.warn au niveau warn when LOG_VERBOSE=true et NODE_ENV=test", () => {
      // Arrange
      const env = { NODE_ENV: "test", LOG_VERBOSE: "true" };
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "warn forcé en test", { level: "warn", env });

      // Assert
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("should appeler console.error au niveau error when LOG_VERBOSE=true et NODE_ENV=test", () => {
      // Arrange
      const env = { NODE_ENV: "test", LOG_VERBOSE: "true" };
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "error forcée en test", { level: "error", env });

      // Assert
      expect(errorSpy).toHaveBeenCalledOnce();
    });

    it("should ne pas activer LOG_VERBOSE quand la valeur est 'false'", () => {
      // Arrange — LOG_VERBOSE explicitement false
      const env = { NODE_ENV: "production", LOG_VERBOSE: "false" };
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "info avec verbose=false", { level: "info", env });

      // Assert — production + verbose=false → info silencieuse
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("should ne pas activer LOG_VERBOSE quand la valeur est '0'", () => {
      // Arrange
      const env = { NODE_ENV: "production", LOG_VERBOSE: "0" };
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "info avec verbose=0", { level: "info", env });

      // Assert
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("contenu du message loggué", () => {
    const env = { NODE_ENV: "development", LOG_VERBOSE: undefined };

    it("should inclure la méthode HTTP dans le log when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq({ method: "POST", path: "/api/auth/login" });

      // Act
      sessionLogger(req, "tentative login", { level: "info", env });

      // Assert
      const logged = logSpy.mock.calls[0].join(" ");
      expect(logged).toContain("POST");
    });

    it("should inclure le chemin de la requête dans le log when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq({ method: "GET", path: "/api/auth/session" });

      // Act
      sessionLogger(req, "vérification session", { level: "info", env });

      // Assert
      const logged = logSpy.mock.calls[0].join(" ");
      expect(logged).toContain("/api/auth/session");
    });

    it("should appeler console exactement une fois par invocation when NODE_ENV=development", () => {
      // Arrange
      const req = makeFakeReq();

      // Act
      sessionLogger(req, "un seul appel", { level: "warn", env });

      // Assert — pas de double log
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
