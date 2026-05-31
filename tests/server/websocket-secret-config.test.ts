/**
 * Tests — A.2 : Validation de WEBSOCKET_SECRET au démarrage
 *
 * Contrat attendu :
 *   La fonction `validateWebSocketSecret` doit être exportée depuis
 *   `server/websocket-secret-config.ts` (nouveau module à créer en Phase 2b).
 *
 *   Signature :
 *     export function validateWebSocketSecret(
 *       env: Record<string, string | undefined>
 *     ): { valid: boolean; message?: string; mode: 'fail' | 'warn' | 'ok' }
 *
 *   Règles de comportement :
 *     - NODE_ENV=production + WEBSOCKET_SECRET absent  → mode 'fail', valid false, message explicite
 *     - NODE_ENV=development + WEBSOCKET_SECRET absent → mode 'warn', valid true (secret généré en interne)
 *     - WEBSOCKET_SECRET présent et length < 32        → mode 'warn', valid true
 *     - WEBSOCKET_SECRET présent et length >= 32       → mode 'ok', valid true, pas de message
 *
 *   IMPORTANT : La fonction est PURE — elle ne lit pas process.env et n'a pas de side-effects.
 *   Le module appelant est responsable de faire le console.warn / throw selon le retour.
 */

import { describe, it, expect } from 'vitest';
import { validateWebSocketSecret } from '../../server/websocket-secret-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(
  nodeEnv: string | undefined,
  wsSecret: string | undefined
): Record<string, string | undefined> {
  return {
    NODE_ENV: nodeEnv,
    WEBSOCKET_SECRET: wsSecret,
  };
}

// ---------------------------------------------------------------------------
// Suite A.2 — NODE_ENV=production
// ---------------------------------------------------------------------------

describe('validateWebSocketSecret', () => {
  describe('en production (NODE_ENV=production)', () => {
    it('doit retourner mode fail quand WEBSOCKET_SECRET est absent', () => {
      // Arrange
      const env = makeEnv('production', undefined);

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.mode).toBe('fail');
    });

    it('doit retourner un message explicite en français quand WEBSOCKET_SECRET est absent', () => {
      // Arrange
      const env = makeEnv('production', undefined);

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.message).toBeDefined();
      expect(result.message!.length).toBeGreaterThan(10);
      // Le message doit mentionner WEBSOCKET_SECRET pour orienter l'opérateur
      expect(result.message).toMatch(/WEBSOCKET_SECRET/);
    });

    it('doit retourner mode fail quand WEBSOCKET_SECRET est une chaîne vide', () => {
      // Arrange
      const env = makeEnv('production', '');

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.mode).toBe('fail');
    });

    it('doit retourner mode warn (pas fail) quand WEBSOCKET_SECRET est présent mais trop court', () => {
      // Arrange — secret de 16 chars (< 32) mais présent en prod
      const env = makeEnv('production', 'secret-trop-court');

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.mode).toBe('warn');
      expect(result.message).toBeDefined();
    });

    it('doit retourner mode ok quand WEBSOCKET_SECRET est présent et >= 32 chars', () => {
      // Arrange — 32 chars exactement
      const env = makeEnv('production', 'a'.repeat(32));

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.mode).toBe('ok');
    });

    it('doit retourner mode ok sans message quand WEBSOCKET_SECRET est >= 32 chars', () => {
      // Arrange — 64 chars (clé hex typique)
      const env = makeEnv('production', 'f'.repeat(64));

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.mode).toBe('ok');
      expect(result.message).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Suite A.2 — NODE_ENV=development
  // -------------------------------------------------------------------------

  describe('en développement (NODE_ENV=development)', () => {
    it('doit retourner mode warn (pas fail) quand WEBSOCKET_SECRET est absent', () => {
      // Arrange
      const env = makeEnv('development', undefined);

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.mode).toBe('warn');
    });

    it('doit retourner un message d\'avertissement quand WEBSOCKET_SECRET est absent en dev', () => {
      // Arrange
      const env = makeEnv('development', undefined);

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.message).toBeDefined();
      expect(result.message!.length).toBeGreaterThan(5);
    });

    it('doit retourner mode warn quand WEBSOCKET_SECRET est absent (chaîne vide) en dev', () => {
      // Arrange
      const env = makeEnv('development', '');

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.mode).toBe('warn');
    });

    it('doit retourner mode ok quand WEBSOCKET_SECRET est présent et >= 32 chars en dev', () => {
      // Arrange
      const env = makeEnv('development', 'dev-secret-long-enough-for-testing-ok');

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.mode).toBe('ok');
    });
  });

  // -------------------------------------------------------------------------
  // Suite A.2 — Longueur du secret (indépendant de NODE_ENV)
  // -------------------------------------------------------------------------

  describe('validation de la longueur du secret', () => {
    it('doit retourner mode warn quand le secret fait exactement 31 chars (< 32)', () => {
      // Arrange
      const env = makeEnv('production', 'a'.repeat(31));

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.mode).toBe('warn');
      expect(result.valid).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('doit retourner mode ok quand le secret fait exactement 32 chars (seuil minimum)', () => {
      // Arrange
      const env = makeEnv('production', 'a'.repeat(32));

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.mode).toBe('ok');
      expect(result.valid).toBe(true);
    });

    it('doit retourner mode ok quand le secret fait 64 chars (hex typique)', () => {
      // Arrange
      const env = makeEnv('production', 'abcdef1234567890'.repeat(4));

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.mode).toBe('ok');
    });

    it('doit mentionner la longueur minimale dans le message warn de longueur', () => {
      // Arrange
      const env = makeEnv('production', 'court');

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.mode).toBe('warn');
      // Le message doit contenir '32' pour guider le developer
      expect(result.message).toMatch(/32/);
    });
  });

  // -------------------------------------------------------------------------
  // Suite A.2 — Absence de NODE_ENV (ni prod ni dev)
  // -------------------------------------------------------------------------

  describe('quand NODE_ENV est absent ou inconnu', () => {
    it('doit traiter NODE_ENV absent comme mode non-production (warn au lieu de fail)', () => {
      // Arrange — comportement permissif si env est inconnu (évite de bloquer CI/test)
      const env = makeEnv(undefined, undefined);

      // Act
      const result = validateWebSocketSecret(env);

      // Assert — on n'exige pas fail pour une env inconnue
      expect(result.valid).toBe(true);
      expect(['warn', 'ok']).toContain(result.mode);
    });

    it('doit traiter NODE_ENV=test comme mode non-production', () => {
      // Arrange
      const env = makeEnv('test', undefined);

      // Act
      const result = validateWebSocketSecret(env);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.mode).toBe('warn');
    });
  });
});
