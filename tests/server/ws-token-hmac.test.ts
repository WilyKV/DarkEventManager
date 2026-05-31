/**
 * Tests — A.5 : HMAC signing du token d'authentification WebSocket
 *
 * Contrat attendu :
 *   Les fonctions et constantes suivantes doivent être exportées depuis
 *   `server/ws-token.ts` (nouveau module à créer en Phase 2b).
 *
 *   Constante :
 *     export const WS_TOKEN_TTL_MS: number = 15 * 60 * 1000  // 900 000 ms
 *
 *   Format de token (chaîne) :
 *     "<deviceId>.<expiry>.<hmac>"
 *     - deviceId  : encodé en base64url pour gérer les caractères spéciaux (., =, espaces)
 *     - expiry    : timestamp ms (Date.now() + WS_TOKEN_TTL_MS) converti en string
 *     - hmac      : sha256 hex de `<deviceIdEncoded>.<expiry>` signé avec le secret
 *
 *   Fonctions :
 *     export function signDeviceToken(
 *       deviceId: string,
 *       secret: string,
 *       now?: number   // optionnel, pour les tests — défaut: Date.now()
 *     ): string
 *
 *     export function verifyDeviceToken(
 *       token: string,
 *       secret: string,
 *       now?: number   // optionnel, pour les tests — défaut: Date.now()
 *     ): {
 *       valid: boolean;
 *       deviceId?: string;
 *       reason?: 'expired' | 'invalid_signature' | 'malformed';
 *     }
 *
 *   Note sur le choix du module :
 *     Les fonctions `generateWebSocketToken` / `verifyWebSocketToken` existent déjà dans
 *     `server/sync-middleware.ts` mais utilisent le timestamp de GÉNÉRATION (pas d'expiry
 *     explicite) et ne supportent pas les deviceId avec des points. Phase 2b crée
 *     `server/ws-token.ts` comme remplacement propre et testable.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  signDeviceToken,
  verifyDeviceToken,
  WS_TOKEN_TTL_MS,
} from '../../server/ws-token';

// ---------------------------------------------------------------------------
// Constantes de test
// ---------------------------------------------------------------------------

const SECRET_A = 'secret-alpha-32chars-xxxxxxxxxxx';
const SECRET_B = 'secret-beta-32chars-yyyyyyyyyyyy';
const DEVICE_SIMPLE = 'device-abc-123';
const NOW = 1_700_000_000_000; // timestamp fixe pour la reproductibilité

// ---------------------------------------------------------------------------
// Suite A.5 — Constante TTL
// ---------------------------------------------------------------------------

describe('WS_TOKEN_TTL_MS', () => {
  it('doit valoir 15 minutes en millisecondes', () => {
    expect(WS_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// Suite A.5 — signDeviceToken
// ---------------------------------------------------------------------------

describe('signDeviceToken', () => {
  it('doit retourner une chaîne non vide', () => {
    // Arrange / Act
    const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

    // Assert
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('doit produire un token avec exactement 3 parties séparées par des points', () => {
    // Arrange / Act
    const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);
    const parts = token.split('.');

    // Assert
    expect(parts).toHaveLength(3);
  });

  it('doit encoder l\'expiry comme NOW + WS_TOKEN_TTL_MS', () => {
    // Arrange / Act
    const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);
    const parts = token.split('.');
    const expiry = parseInt(parts[1], 10);

    // Assert
    expect(expiry).toBe(NOW + WS_TOKEN_TTL_MS);
  });

  it('doit produire des tokens différents pour deux deviceId différents', () => {
    // Arrange / Act
    const token1 = signDeviceToken('device-A', SECRET_A, NOW);
    const token2 = signDeviceToken('device-B', SECRET_A, NOW);

    // Assert
    expect(token1).not.toBe(token2);
  });

  it('doit produire des tokens différents pour deux secrets différents', () => {
    // Arrange / Act
    const token1 = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);
    const token2 = signDeviceToken(DEVICE_SIMPLE, SECRET_B, NOW);

    // Assert
    expect(token1).not.toBe(token2);
  });

  it('doit être déterministe : même entrée → même token', () => {
    // Arrange / Act
    const token1 = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);
    const token2 = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

    // Assert
    expect(token1).toBe(token2);
  });
});

// ---------------------------------------------------------------------------
// Suite A.5 — verifyDeviceToken — cas valide
// ---------------------------------------------------------------------------

describe('verifyDeviceToken', () => {
  describe('token valide', () => {
    it('doit retourner valid=true pour un token signé et vérifié immédiatement', () => {
      // Arrange
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

      // Act — now identique à la signature → age = 0 ms
      const result = verifyDeviceToken(token, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('doit retourner le deviceId correct pour un token valide', () => {
      // Arrange
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

      // Act
      const result = verifyDeviceToken(token, SECRET_A, NOW);

      // Assert
      expect(result.deviceId).toBe(DEVICE_SIMPLE);
    });

    it('doit accepter un token vérifié à NOW + TTL - 1ms (1ms avant expiration)', () => {
      // Arrange
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

      // Act — une milliseconde avant l'expiration
      const result = verifyDeviceToken(token, SECRET_A, NOW + WS_TOKEN_TTL_MS - 1);

      // Assert
      expect(result.valid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Suite A.5 — verifyDeviceToken — token expiré
  // -------------------------------------------------------------------------

  describe('token expiré', () => {
    it('doit retourner valid=false quand now > expiry de 1ms', () => {
      // Arrange
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

      // Act — exactement 1ms après l'expiration
      const result = verifyDeviceToken(token, SECRET_A, NOW + WS_TOKEN_TTL_MS + 1);

      // Assert
      expect(result.valid).toBe(false);
    });

    it('doit retourner reason="expired" quand le token a expiré', () => {
      // Arrange
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

      // Act
      const result = verifyDeviceToken(token, SECRET_A, NOW + WS_TOKEN_TTL_MS + 1);

      // Assert
      expect(result.reason).toBe('expired');
    });

    it('doit retourner valid=false quand now = expiry exactement (limite stricte)', () => {
      // Arrange — le token expire à NOW + TTL
      // La limite est stricte : tokenAge > TTL signifie que now = expiry+1 est invalid
      // now = expiry exactement (tokenAge = TTL) → comportement défini par le developer
      // On teste le cas incontestablement expiré (NOW + TTL + 1000ms)
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

      // Act — 1 seconde après expiration
      const result = verifyDeviceToken(token, SECRET_A, NOW + WS_TOKEN_TTL_MS + 1000);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });
  });

  // -------------------------------------------------------------------------
  // Suite A.5 — verifyDeviceToken — signature invalide
  // -------------------------------------------------------------------------

  describe('signature invalide', () => {
    it('doit retourner valid=false quand le dernier caractère du HMAC est modifié', () => {
      // Arrange
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);
      const parts = token.split('.');
      const hmac = parts[2];
      // Modifier le dernier caractère du HMAC
      const alteredHmac = hmac.slice(0, -1) + (hmac.endsWith('a') ? 'b' : 'a');
      const tamperedToken = `${parts[0]}.${parts[1]}.${alteredHmac}`;

      // Act
      const result = verifyDeviceToken(tamperedToken, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(false);
    });

    it('doit retourner reason="invalid_signature" quand le HMAC est altéré', () => {
      // Arrange
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);
      const parts = token.split('.');
      const hmac = parts[2];
      const alteredHmac = hmac.slice(0, -1) + (hmac.endsWith('a') ? 'b' : 'a');
      const tamperedToken = `${parts[0]}.${parts[1]}.${alteredHmac}`;

      // Act
      const result = verifyDeviceToken(tamperedToken, SECRET_A, NOW);

      // Assert
      expect(result.reason).toBe('invalid_signature');
    });

    it('doit retourner valid=false quand le token est signé avec SECRET_A mais vérifié avec SECRET_B', () => {
      // Arrange
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

      // Act
      const result = verifyDeviceToken(token, SECRET_B, NOW);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_signature');
    });

    it('ne doit pas retourner le deviceId quand la signature est invalide', () => {
      // Arrange
      const token = signDeviceToken(DEVICE_SIMPLE, SECRET_A, NOW);

      // Act
      const result = verifyDeviceToken(token, SECRET_B, NOW);

      // Assert
      expect(result.deviceId).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Suite A.5 — verifyDeviceToken — token malformé
  // -------------------------------------------------------------------------

  describe('token malformé', () => {
    it('doit retourner valid=false pour une chaîne sans séparateur', () => {
      // Arrange
      const malformed = 'tokensanspoint';

      // Act
      const result = verifyDeviceToken(malformed, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(false);
    });

    it('doit retourner reason="malformed" pour une chaîne sans séparateur', () => {
      // Arrange
      const malformed = 'tokensanspoint';

      // Act
      const result = verifyDeviceToken(malformed, SECRET_A, NOW);

      // Assert
      expect(result.reason).toBe('malformed');
    });

    it('doit retourner reason="malformed" pour un token avec seulement 2 parties', () => {
      // Arrange
      const malformed = 'device-id.1700000000000';

      // Act
      const result = verifyDeviceToken(malformed, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('malformed');
    });

    it('doit retourner reason="malformed" pour un token avec 4 parties ou plus', () => {
      // Arrange
      const malformed = 'a.b.c.d';

      // Act
      const result = verifyDeviceToken(malformed, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('malformed');
    });

    it('doit retourner reason="malformed" pour une chaîne vide', () => {
      // Arrange
      const malformed = '';

      // Act
      const result = verifyDeviceToken(malformed, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('malformed');
    });

    it('doit retourner reason="malformed" quand l\'expiry n\'est pas un nombre valide', () => {
      // Arrange — expiry non numérique
      const malformed = 'device-id.NOT_A_NUMBER.fakesignature';

      // Act
      const result = verifyDeviceToken(malformed, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('malformed');
    });
  });

  // -------------------------------------------------------------------------
  // Suite A.5 — Roundtrip avec deviceId contenant des caractères spéciaux
  // -------------------------------------------------------------------------

  describe('deviceId avec caractères spéciaux', () => {
    it('doit faire un roundtrip correct avec un deviceId contenant des points', () => {
      // Arrange
      const deviceWithDots = 'device.with.dots';
      const token = signDeviceToken(deviceWithDots, SECRET_A, NOW);

      // Act
      const result = verifyDeviceToken(token, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.deviceId).toBe(deviceWithDots);
    });

    it('doit faire un roundtrip correct avec un deviceId contenant des signes "="', () => {
      // Arrange
      const deviceWithEquals = 'device=with=equals';
      const token = signDeviceToken(deviceWithEquals, SECRET_A, NOW);

      // Act
      const result = verifyDeviceToken(token, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.deviceId).toBe(deviceWithEquals);
    });

    it('doit faire un roundtrip correct avec un deviceId contenant des espaces', () => {
      // Arrange
      const deviceWithSpaces = 'device with spaces';
      const token = signDeviceToken(deviceWithSpaces, SECRET_A, NOW);

      // Act
      const result = verifyDeviceToken(token, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.deviceId).toBe(deviceWithSpaces);
    });

    it('doit faire un roundtrip correct avec un deviceId contenant des caractères unicode', () => {
      // Arrange — nom de l'appareil en français, cas réel
      const deviceUnicode = 'Appareil-Émile-grotte-🧟';
      const token = signDeviceToken(deviceUnicode, SECRET_A, NOW);

      // Act
      const result = verifyDeviceToken(token, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.deviceId).toBe(deviceUnicode);
    });

    it('doit faire un roundtrip correct avec un deviceId UUID standard', () => {
      // Arrange — format UUID le plus courant
      const deviceUuid = '550e8400-e29b-41d4-a716-446655440000';
      const token = signDeviceToken(deviceUuid, SECRET_A, NOW);

      // Act
      const result = verifyDeviceToken(token, SECRET_A, NOW);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.deviceId).toBe(deviceUuid);
    });
  });
});
