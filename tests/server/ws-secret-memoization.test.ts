/**
 * Tests TDD — Red Phase
 *
 * HIGH-1 / CRIT-3 : getWebSocketSecret() doit être mémoizé.
 *
 * Problème actuel (server/sync-middleware.ts:97-100) :
 *   return process.env.WEBSOCKET_SECRET || crypto.randomBytes(32).toString('hex');
 *   → Sans variable d'env, un nouveau secret aléatoire est généré à CHAQUE appel.
 *   → Conséquence : deux appels consécutifs produisent deux secrets différents,
 *     rendant invalides tous les tokens signés avec le premier appel.
 *
 * Solution attendue : une variable module-scope cachée, évaluée une seule fois.
 *   let _cachedSecret: string | null = null;
 *   export function getWebSocketSecret(): string {
 *     if (!_cachedSecret) {
 *       _cachedSecret = process.env.WEBSOCKET_SECRET || crypto.randomBytes(32).toString('hex');
 *     }
 *     return _cachedSecret;
 *   }
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Suite 1 : avec WEBSOCKET_SECRET défini dans l'environnement
// ---------------------------------------------------------------------------

describe("getWebSocketSecret() avec WEBSOCKET_SECRET défini", () => {
  const FIXED_SECRET = "mon-secret-fixe-de-test-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  beforeEach(() => {
    process.env.WEBSOCKET_SECRET = FIXED_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.WEBSOCKET_SECRET;
    vi.resetModules();
  });

  it("should return the value of process.env.WEBSOCKET_SECRET", async () => {
    // Arrange
    const { getWebSocketSecret } = await import("../../server/sync-middleware");

    // Act
    const secret = getWebSocketSecret();

    // Assert
    expect(secret).toBe(FIXED_SECRET);
  });

  it("should return exactly the same string on 10 consecutive calls", async () => {
    // Arrange
    const { getWebSocketSecret } = await import("../../server/sync-middleware");

    // Act
    const results = Array.from({ length: 10 }, () => getWebSocketSecret());

    // Assert — tous identiques
    const unique = new Set(results);
    expect(unique.size).toBe(1);
    expect(results[0]).toBe(FIXED_SECRET);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 : sans WEBSOCKET_SECRET (secret aléatoire, mais mémoizé)
// ---------------------------------------------------------------------------

describe("getWebSocketSecret() sans WEBSOCKET_SECRET (random mémoizé)", () => {
  beforeEach(() => {
    delete process.env.WEBSOCKET_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("should return a non-empty string even without env variable", async () => {
    // Arrange
    const { getWebSocketSecret } = await import("../../server/sync-middleware");

    // Act
    const secret = getWebSocketSecret();

    // Assert
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(0);
  });

  it("should return the SAME string on 10 consecutive calls within the same process", async () => {
    // Arrange — même import = même instance de module = même secret mémoizé
    const { getWebSocketSecret } = await import("../../server/sync-middleware");

    // Act
    const results = Array.from({ length: 10 }, () => getWebSocketSecret());

    // Assert — le secret doit être identique à chaque appel (mémoization)
    // Si ce test échoue, c'est que getWebSocketSecret() génère un nouveau random à chaque appel
    const unique = new Set(results);
    expect(unique.size).toBe(1);
  });

  it("should return a string of 64 hex characters (32 random bytes in hex)", async () => {
    // Arrange
    const { getWebSocketSecret } = await import("../../server/sync-middleware");

    // Act
    const secret = getWebSocketSecret();

    // Assert — crypto.randomBytes(32).toString('hex') produit 64 caractères hex
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should return DIFFERENT secrets when the module is reset between calls (simulates two processes)", async () => {
    // Arrange — premier "process" : import frais du module
    const { getWebSocketSecret: getSecret1 } = await import("../../server/sync-middleware");
    const secret1 = getSecret1();

    // Reset du module — simule un second process ou un redémarrage
    vi.resetModules();

    // Second "process" : nouvel import = nouveau secret aléatoire
    const { getWebSocketSecret: getSecret2 } = await import("../../server/sync-middleware");
    const secret2 = getSecret2();

    // Assert — deux process distincts doivent avoir des secrets différents
    // (probabilité de collision ~2^-256, négligeable)
    expect(secret1).not.toBe(secret2);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 : intégration — sign + verify avec getWebSocketSecret()
// ---------------------------------------------------------------------------

describe("getWebSocketSecret() — intégration signDeviceToken / verifyDeviceToken", () => {
  beforeEach(() => {
    delete process.env.WEBSOCKET_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("should produce a valid token when signing and verifying with the same getWebSocketSecret() call", async () => {
    // Arrange
    const { getWebSocketSecret } = await import("../../server/sync-middleware");
    const { signDeviceToken, verifyDeviceToken } = await import("../../server/ws-token");
    const deviceId = "device-integration-test";

    // Act — le secret est récupéré deux fois via getWebSocketSecret()
    // Si non mémoizé, les deux appels retournent des secrets différents → verify échoue
    const token = signDeviceToken(deviceId, getWebSocketSecret());
    const result = verifyDeviceToken(token, getWebSocketSecret());

    // Assert
    expect(result.valid).toBe(true);
    expect(result.deviceId).toBe(deviceId);
  });

  it("should fail token verification when secrets differ between sign and verify (regression guard)", async () => {
    // Arrange — ce test démontre que le bug existe SANS mémoization
    // On simule manuellement deux appels retournant des secrets différents
    const { signDeviceToken, verifyDeviceToken } = await import("../../server/ws-token");
    const crypto = await import("crypto");

    const secretAtSign = crypto.randomBytes(32).toString("hex");
    const secretAtVerify = crypto.randomBytes(32).toString("hex"); // différent !
    const deviceId = "device-regression";

    // Act
    const token = signDeviceToken(deviceId, secretAtSign);
    const result = verifyDeviceToken(token, secretAtVerify);

    // Assert — secrets différents → invalid_signature
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_signature");
  });
});
