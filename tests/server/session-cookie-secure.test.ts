/**
 * Tests TDD — Red Phase
 *
 * SEC-HARDENING / MED-3
 * Cookie de session : `secure` doit être `true` en production.
 *
 * Contrat attendu (à implémenter dans server/session-cookie-config.ts) :
 *
 *   export function getSessionCookieOptions(env: NodeJS.ProcessEnv): {
 *     secure: boolean;
 *     httpOnly: boolean;
 *     sameSite: 'lax' | 'strict' | 'none';
 *     maxAge: number;
 *   }
 *
 * Cette fonction sera importée dans server/index.ts pour remplacer
 * le bloc `cookie: { secure: false, ... }` hardcodé à la ligne 31.
 *
 * Ces tests échoueront tant que server/session-cookie-config.ts n'existe pas.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Import dynamique — le fichier n'existe pas encore (Red Phase)
// ---------------------------------------------------------------------------

type SessionCookieOptions = {
  secure: boolean;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  maxAge: number;
};

type GetSessionCookieOptions = (env: NodeJS.ProcessEnv) => SessionCookieOptions;

async function importGetSessionCookieOptions(): Promise<GetSessionCookieOptions> {
  const mod = await import("../../server/session-cookie-config");
  return mod.getSessionCookieOptions;
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("getSessionCookieOptions", () => {

  // -------------------------------------------------------------------------
  // 1. Propriété `secure` selon NODE_ENV
  // -------------------------------------------------------------------------

  describe("propriété secure selon NODE_ENV", () => {

    it("should return secure: true when NODE_ENV is production", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();
      const env = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

      // Act
      const options = getSessionCookieOptions(env);

      // Assert
      expect(options.secure).toBe(true);
    });

    it("should return secure: false when NODE_ENV is development", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();
      const env = { NODE_ENV: "development" } as NodeJS.ProcessEnv;

      // Act
      const options = getSessionCookieOptions(env);

      // Assert
      expect(options.secure).toBe(false);
    });

    it("should return secure: false when NODE_ENV is test", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();
      const env = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

      // Act
      const options = getSessionCookieOptions(env);

      // Assert
      expect(options.secure).toBe(false);
    });

    it("should return secure: false when NODE_ENV is undefined (défaut non-production)", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();
      const env = {} as NodeJS.ProcessEnv;

      // Act
      const options = getSessionCookieOptions(env);

      // Assert
      // En l'absence de NODE_ENV, on est en mode non-production par défaut,
      // donc pas de cookie sécurisé (HTTP local sans TLS).
      expect(options.secure).toBe(false);
    });

    it("should return secure: false when NODE_ENV is an unexpected value", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();
      const env = { NODE_ENV: "staging" } as NodeJS.ProcessEnv;

      // Act
      const options = getSessionCookieOptions(env);

      // Assert
      // Seule la valeur exacte "production" active secure: true.
      expect(options.secure).toBe(false);
    });

  });

  // -------------------------------------------------------------------------
  // 2. Propriétés invariantes (indépendantes de NODE_ENV)
  // -------------------------------------------------------------------------

  describe("propriétés invariantes indépendantes de NODE_ENV", () => {

    it("should always return httpOnly: true regardless of NODE_ENV", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();

      // Act & Assert — vérifié pour les 3 envs principaux
      for (const nodeEnv of ["production", "development", "test"]) {
        const options = getSessionCookieOptions({ NODE_ENV: nodeEnv } as NodeJS.ProcessEnv);
        expect(options.httpOnly, `httpOnly doit être true en NODE_ENV=${nodeEnv}`).toBe(true);
      }
    });

    it("should always return sameSite: lax regardless of NODE_ENV", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();

      // Act & Assert
      for (const nodeEnv of ["production", "development", "test"]) {
        const options = getSessionCookieOptions({ NODE_ENV: nodeEnv } as NodeJS.ProcessEnv);
        expect(options.sameSite, `sameSite doit être 'lax' en NODE_ENV=${nodeEnv}`).toBe("lax");
      }
    });

    it("should always return maxAge of 86400000 (24h) regardless of NODE_ENV", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();
      const expectedMaxAge = 24 * 60 * 60 * 1000; // 86 400 000 ms

      // Act & Assert
      for (const nodeEnv of ["production", "development", "test"]) {
        const options = getSessionCookieOptions({ NODE_ENV: nodeEnv } as NodeJS.ProcessEnv);
        expect(options.maxAge, `maxAge doit être 86400000 en NODE_ENV=${nodeEnv}`).toBe(expectedMaxAge);
      }
    });

  });

  // -------------------------------------------------------------------------
  // 3. Contrat de typage — les champs obligatoires sont présents
  // -------------------------------------------------------------------------

  describe("contrat de l'objet retourné", () => {

    it("should return an object with all required fields", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();

      // Act
      const options = getSessionCookieOptions({ NODE_ENV: "production" } as NodeJS.ProcessEnv);

      // Assert
      expect(options).toHaveProperty("secure");
      expect(options).toHaveProperty("httpOnly");
      expect(options).toHaveProperty("sameSite");
      expect(options).toHaveProperty("maxAge");
    });

    it("should return boolean type for secure and httpOnly fields", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();

      // Act
      const options = getSessionCookieOptions({ NODE_ENV: "production" } as NodeJS.ProcessEnv);

      // Assert
      expect(typeof options.secure).toBe("boolean");
      expect(typeof options.httpOnly).toBe("boolean");
    });

    it("should return number type for maxAge field", async () => {
      // Arrange
      const getSessionCookieOptions = await importGetSessionCookieOptions();

      // Act
      const options = getSessionCookieOptions({ NODE_ENV: "development" } as NodeJS.ProcessEnv);

      // Assert
      expect(typeof options.maxAge).toBe("number");
    });

  });

});
