/**
 * Tests TDD — Phase Rouge
 * Cible : server/qr-encryption.ts (module à créer)
 *
 * Format des tokens GCM attendu : <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *   - IV      : 12 bytes  → 24 chars hex
 *   - authTag : 16 bytes  → 32 chars hex
 *   - ciphertext : longueur variable (hex)
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  encryptQRPayload,
  decryptQRPayload,
  generateQRKey,
  deriveKeyFromEnv,
} from "../../server/qr-encryption";

// ---------------------------------------------------------------------------
// Helpers de test
// ---------------------------------------------------------------------------

function makeKey(): Buffer {
  return generateQRKey();
}

// ---------------------------------------------------------------------------
// generateQRKey
// ---------------------------------------------------------------------------

describe("generateQRKey", () => {
  it("devrait retourner un Buffer de 32 bytes", () => {
    // Arrange / Act
    const key = generateQRKey();

    // Assert
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it("devrait générer des clés différentes à chaque appel", () => {
    // Arrange / Act
    const key1 = generateQRKey();
    const key2 = generateQRKey();

    // Assert
    expect(key1.toString("hex")).not.toBe(key2.toString("hex"));
  });
});

// ---------------------------------------------------------------------------
// deriveKeyFromEnv
// ---------------------------------------------------------------------------

describe("deriveKeyFromEnv", () => {
  it("devrait retourner un Buffer de 32 bytes pour une string hex valide de 64 chars", () => {
    // Arrange
    const hexKey = crypto.randomBytes(32).toString("hex"); // 64 chars hex

    // Act
    const key = deriveKeyFromEnv(hexKey);

    // Assert
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
    expect(key.toString("hex")).toBe(hexKey);
  });

  it("devrait throw avec message clair si la variable est undefined", () => {
    // Arrange / Act / Assert
    expect(() => deriveKeyFromEnv(undefined)).toThrow("QR_ENCRYPTION_KEY manquant");
  });

  it("devrait throw avec message clair si la variable est une string vide", () => {
    // Arrange / Act / Assert
    expect(() => deriveKeyFromEnv("")).toThrow("QR_ENCRYPTION_KEY manquant");
  });

  it("devrait throw si la string hex fait moins de 64 chars", () => {
    // Arrange
    const shortHex = "deadbeef"; // 8 chars

    // Act / Assert
    expect(() => deriveKeyFromEnv(shortHex)).toThrow("doit être 64 caractères hex");
  });

  it("devrait throw si la string n'est pas du hex valide", () => {
    // Arrange
    const nonHex = "Z".repeat(64); // 64 chars mais pas hex

    // Act / Assert
    expect(() => deriveKeyFromEnv(nonHex)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// encryptQRPayload — format du token
// ---------------------------------------------------------------------------

describe("encryptQRPayload — format du token", () => {
  it("devrait retourner un token au format <iv>:<authTag>:<ciphertext> avec séparateur ':'", () => {
    // Arrange
    const key = makeKey();
    const plaintext = "données de test";

    // Act
    const token = encryptQRPayload(plaintext, key);
    const parts = token.split(":");

    // Assert — 3 parties séparées par ':'
    expect(parts.length).toBe(3);
  });

  it("devrait avoir un IV de 24 chars hex (12 bytes)", () => {
    // Arrange
    const key = makeKey();

    // Act
    const token = encryptQRPayload("test", key);
    const [ivHex] = token.split(":");

    // Assert
    expect(ivHex.length).toBe(24);
    expect(/^[0-9a-f]+$/i.test(ivHex)).toBe(true);
  });

  it("devrait avoir un authTag de 32 chars hex (16 bytes)", () => {
    // Arrange
    const key = makeKey();

    // Act
    const token = encryptQRPayload("test", key);
    const parts = token.split(":");
    const authTagHex = parts[1];

    // Assert
    expect(authTagHex.length).toBe(32);
    expect(/^[0-9a-f]+$/i.test(authTagHex)).toBe(true);
  });

  it("devrait avoir un ciphertext non vide pour un plaintext non vide", () => {
    // Arrange
    const key = makeKey();

    // Act
    const token = encryptQRPayload("non vide", key);
    const parts = token.split(":");
    const ciphertextHex = parts[2];

    // Assert
    expect(ciphertextHex.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/i.test(ciphertextHex)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IV aléatoire — preuve fondamentale de GCM avec IV random par chiffrement
// ---------------------------------------------------------------------------

describe("encryptQRPayload — IV aléatoire", () => {
  it("devrait produire des tokens différents pour deux chiffrements du même plaintext", () => {
    // Arrange
    const key = makeKey();
    const plaintext = "même message";

    // Act
    const token1 = encryptQRPayload(plaintext, key);
    const token2 = encryptQRPayload(plaintext, key);

    // Assert — les tokens complets diffèrent (IV différent entraîne tout le reste différent)
    expect(token1).not.toBe(token2);
  });

  it("devrait avoir des IV différents pour deux chiffrements du même plaintext", () => {
    // Arrange
    const key = makeKey();
    const plaintext = "même message";

    // Act
    const iv1 = encryptQRPayload(plaintext, key).split(":")[0];
    const iv2 = encryptQRPayload(plaintext, key).split(":")[0];

    // Assert — IV distincts, preuve que l'IV est généré aléatoirement
    expect(iv1).not.toBe(iv2);
  });

  it("devrait produire 10 IV différents sur 10 appels successifs", () => {
    // Arrange
    const key = makeKey();
    const plaintext = "test répété";

    // Act
    const ivs = Array.from({ length: 10 }, () =>
      encryptQRPayload(plaintext, key).split(":")[0]
    );
    const uniqueIvs = new Set(ivs);

    // Assert
    expect(uniqueIvs.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Roundtrip encrypt / decrypt
// ---------------------------------------------------------------------------

describe("decryptQRPayload — roundtrip", () => {
  it("devrait retourner le plaintext original après chiffrement/déchiffrement", () => {
    // Arrange
    const key = makeKey();
    const plaintext = "Hello Zomb'in The Dark";

    // Act
    const token = encryptQRPayload(plaintext, key);
    const result = decryptQRPayload(token, key);

    // Assert
    expect(result).toBe(plaintext);
  });

  it("devrait gérer un plaintext vide (retourne string vide)", () => {
    // Arrange
    const key = makeKey();
    const plaintext = "";

    // Act
    const token = encryptQRPayload(plaintext, key);
    const result = decryptQRPayload(token, key);

    // Assert
    expect(result).toBe("");
  });

  it("devrait gérer des caractères UTF-8 avec accents", () => {
    // Arrange
    const key = makeKey();
    const plaintext = "Événement: Fête des Morts, été 2025";

    // Act
    const token = encryptQRPayload(plaintext, key);
    const result = decryptQRPayload(token, key);

    // Assert
    expect(result).toBe(plaintext);
  });

  it("devrait gérer des emojis dans le plaintext", () => {
    // Arrange
    const key = makeKey();
    const plaintext = "Zombie 🧟 Survivant 🏃 Staff 💀";

    // Act
    const token = encryptQRPayload(plaintext, key);
    const result = decryptQRPayload(token, key);

    // Assert
    expect(result).toBe(plaintext);
  });

  it("devrait gérer un payload JSON comme le code existant", () => {
    // Arrange
    const key = makeKey();
    const payload = JSON.stringify({ id: 42, code: "12345" });

    // Act
    const token = encryptQRPayload(payload, key);
    const result = decryptQRPayload(token, key);

    // Assert
    expect(result).toBe(payload);
    expect(JSON.parse(result)).toEqual({ id: 42, code: "12345" });
  });

  it("devrait gérer un plaintext long (> 1000 chars)", () => {
    // Arrange
    const key = makeKey();
    const plaintext = "A".repeat(1000) + "fin";

    // Act
    const token = encryptQRPayload(plaintext, key);
    const result = decryptQRPayload(token, key);

    // Assert
    expect(result).toBe(plaintext);
  });
});

// ---------------------------------------------------------------------------
// Tamper detection — propriété fondamentale d'AES-GCM (authenticated encryption)
// ---------------------------------------------------------------------------

describe("decryptQRPayload — tamper detection (AES-GCM)", () => {
  it("devrait throw si le ciphertext est modifié (1 char altéré)", () => {
    // Arrange
    const key = makeKey();
    const token = encryptQRPayload("données sensibles", key);
    const parts = token.split(":");
    // Altère le premier char du ciphertext
    const tamperedChar = parts[2][0] === "a" ? "b" : "a";
    const tamperedToken = `${parts[0]}:${parts[1]}:${tamperedChar}${parts[2].slice(1)}`;

    // Act / Assert
    expect(() => decryptQRPayload(tamperedToken, key)).toThrow();
  });

  it("devrait throw si l'authTag est modifié", () => {
    // Arrange
    const key = makeKey();
    const token = encryptQRPayload("données sensibles", key);
    const parts = token.split(":");
    // Altère le premier char de l'authTag
    const tamperedChar = parts[1][0] === "a" ? "b" : "a";
    const tamperedToken = `${parts[0]}:${tamperedChar}${parts[1].slice(1)}:${parts[2]}`;

    // Act / Assert
    expect(() => decryptQRPayload(tamperedToken, key)).toThrow();
  });

  it("devrait throw si l'IV est modifié", () => {
    // Arrange
    const key = makeKey();
    const token = encryptQRPayload("données sensibles", key);
    const parts = token.split(":");
    // Altère le premier char de l'IV
    const tamperedChar = parts[0][0] === "a" ? "b" : "a";
    const tamperedToken = `${tamperedChar}${parts[0].slice(1)}:${parts[1]}:${parts[2]}`;

    // Act / Assert
    expect(() => decryptQRPayload(tamperedToken, key)).toThrow();
  });

  it("devrait throw avec un message ou type d'erreur cohérent lors d'une altération", () => {
    // Arrange
    const key = makeKey();
    const token = encryptQRPayload("test", key);
    const parts = token.split(":");
    const tamperedChar = parts[2][0] === "0" ? "1" : "0";
    const tamperedToken = `${parts[0]}:${parts[1]}:${tamperedChar}${parts[2].slice(1)}`;

    // Act / Assert — l'erreur doit exister (GCM garantit l'authentication failure)
    expect(() => decryptQRPayload(tamperedToken, key)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Clé incorrecte
// ---------------------------------------------------------------------------

describe("decryptQRPayload — clé incorrecte", () => {
  it("devrait throw si on déchiffre avec une clé différente", () => {
    // Arrange
    const key1 = makeKey();
    const key2 = makeKey();
    const token = encryptQRPayload("secret", key1);

    // Act / Assert
    expect(() => decryptQRPayload(token, key2)).toThrow();
  });

  it("devrait throw si la clé est trop courte (< 32 bytes)", () => {
    // Arrange
    const shortKey = Buffer.alloc(16, 0); // AES-128, pas AES-256
    const validKey = makeKey();
    const token = encryptQRPayload("test", validKey);

    // Act / Assert
    expect(() => decryptQRPayload(token, shortKey)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tokens malformés
// ---------------------------------------------------------------------------

describe("decryptQRPayload — tokens malformés", () => {
  it("devrait throw si le token ne contient aucun ':'", () => {
    // Arrange
    const key = makeKey();
    const badToken = "tokenSansDelimiteur";

    // Act / Assert
    expect(() => decryptQRPayload(badToken, key)).toThrow();
  });

  it("devrait throw si le token ne contient qu'un seul ':' (2 parties seulement)", () => {
    // Arrange
    const key = makeKey();
    const badToken = "aaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbb"; // 2 parties

    // Act / Assert
    expect(() => decryptQRPayload(badToken, key)).toThrow();
  });

  it("devrait throw si l'IV n'est pas du hex valide", () => {
    // Arrange
    const key = makeKey();
    // IV = 24 chars non-hex
    const badToken = "ZZZZZZZZZZZZZZZZZZZZZZZZ:deadbeefdeadbeefdeadbeefdeadbeef:deadbeef";

    // Act / Assert
    expect(() => decryptQRPayload(badToken, key)).toThrow();
  });

  it("devrait throw si l'authTag n'est pas du hex valide", () => {
    // Arrange
    const key = makeKey();
    // authTag = 32 chars non-hex
    const badToken = `${"ab".repeat(12)}:${"ZZ".repeat(16)}:${"cd".repeat(8)}`;

    // Act / Assert
    expect(() => decryptQRPayload(badToken, key)).toThrow();
  });

  it("devrait throw si le ciphertext est du hex invalide", () => {
    // Arrange
    const key = makeKey();
    const badToken = `${"ab".repeat(12)}:${"cd".repeat(16)}:ZZZZZZ`;

    // Act / Assert
    expect(() => decryptQRPayload(badToken, key)).toThrow();
  });

  it("devrait throw si le token est une string vide", () => {
    // Arrange
    const key = makeKey();

    // Act / Assert
    expect(() => decryptQRPayload("", key)).toThrow();
  });

  it("devrait throw si l'IV fait moins de 24 chars hex (< 12 bytes)", () => {
    // Arrange
    const key = makeKey();
    // IV trop court : 10 chars au lieu de 24
    const badToken = `aabbccddee:${"cd".repeat(16)}:${"ef".repeat(8)}`;

    // Act / Assert
    expect(() => decryptQRPayload(badToken, key)).toThrow();
  });
});
