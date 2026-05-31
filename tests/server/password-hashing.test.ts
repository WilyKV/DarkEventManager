/**
 * Tests TDD — Phase Rouge
 * Cible : server/password-hashing.ts (module à créer)
 *
 * Dépendance attendue : bcryptjs (cost factor 12)
 * Format bcrypt : $2b$12$... ou $2a$12$... (longueur ~60 chars)
 *
 * Format legacy SHA-256 : 64 chars hex minuscules
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  hashPassword,
  verifyPassword,
  isLegacyHash,
  isBcryptHash,
} from "../../server/password-hashing";

// ---------------------------------------------------------------------------
// hashPassword
// ---------------------------------------------------------------------------

describe("hashPassword", () => {
  it("devrait retourner un hash bcrypt commençant par $2b$12$ ou $2a$12$", async () => {
    // Arrange
    const password = "motDePasse!123";

    // Act
    const hash = await hashPassword(password);

    // Assert — cost factor 12 obligatoire
    expect(hash.startsWith("$2b$12$") || hash.startsWith("$2a$12$")).toBe(true);
  });

  it("devrait retourner un hash d'environ 60 caractères (format bcrypt)", async () => {
    // Arrange
    const password = "motDePasse!123";

    // Act
    const hash = await hashPassword(password);

    // Assert — un hash bcrypt fait exactement 60 chars
    expect(hash.length).toBe(60);
  });

  it("devrait produire deux hashes différents pour le même password (salt unique)", async () => {
    // Arrange
    const password = "mêmeMotDePasse";

    // Act
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Assert — le salt est aléatoire à chaque appel
    expect(hash1).not.toBe(hash2);
  });

  it("devrait ne PAS retourner un hash SHA-256 hex de 64 chars", async () => {
    // Arrange
    const password = "test";

    // Act
    const hash = await hashPassword(password);

    // Assert — garantit qu'on n'utilise plus SHA-256
    expect(hash.length).not.toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(false);
  });

  it("devrait hasher un password vide sans throw", async () => {
    // Arrange
    const password = "";

    // Act / Assert
    await expect(hashPassword(password)).resolves.toMatch(/^\$2[ab]\$12\$/);
  });

  it("devrait hasher un password très long (72+ chars, limite bcrypt)", async () => {
    // Arrange — bcrypt tronque à 72 bytes, mais ne doit pas throw
    const password = "A".repeat(100);

    // Act / Assert
    await expect(hashPassword(password)).resolves.toMatch(/^\$2[ab]\$12\$/);
  });
});

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------

describe("verifyPassword", () => {
  it("devrait retourner true pour le bon password", async () => {
    // Arrange
    const password = "monMotDePasse";
    const hash = await hashPassword(password);

    // Act
    const result = await verifyPassword(password, hash);

    // Assert
    expect(result).toBe(true);
  });

  it("devrait retourner false pour un mauvais password", async () => {
    // Arrange
    const password = "monMotDePasse";
    const wrongPassword = "mauvaisMotDePasse";
    const hash = await hashPassword(password);

    // Act
    const result = await verifyPassword(wrongPassword, hash);

    // Assert
    expect(result).toBe(false);
  });

  it("devrait retourner false pour un password vide contre un hash valide", async () => {
    // Arrange
    const hash = await hashPassword("motDePasse");

    // Act
    const result = await verifyPassword("", hash);

    // Assert
    expect(result).toBe(false);
  });

  it("devrait être sensible à la casse", async () => {
    // Arrange
    const password = "MotDePasse";
    const hash = await hashPassword(password);

    // Act
    const result = await verifyPassword("motdepasse", hash);

    // Assert
    expect(result).toBe(false);
  });

  it("devrait être sensible aux espaces", async () => {
    // Arrange
    const password = "mot de passe";
    const hash = await hashPassword(password);

    // Act
    const result = await verifyPassword("motdepasse", hash);

    // Assert
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isLegacyHash — détection format SHA-256 (64 chars hex)
// ---------------------------------------------------------------------------

describe("isLegacyHash", () => {
  it("devrait retourner true pour un SHA-256 hex valide de 64 chars", () => {
    // Arrange — SHA-256 de "admin123" (exemple du code existant)
    const sha256Hash = "0192023a7bbd73250516f069df18b500";
    const sha256Full = crypto.createHash("sha256").update("admin123").digest("hex");
    // sha256Full = 64 chars hex minuscules

    // Act / Assert
    expect(isLegacyHash(sha256Full)).toBe(true);
  });

  it("devrait retourner true pour le SHA-256 vide connu (e3b0...)", () => {
    // Arrange — SHA-256 de "" (string vide)
    const emptySha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    // Act / Assert
    expect(isLegacyHash(emptySha256)).toBe(true);
  });

  it("devrait retourner false pour un hash bcrypt", () => {
    // Arrange
    const bcryptHash = "$2b$12$abcdefghijklmnopqrstuvOABCDEFGHIJKLMNOPQRSTUVWXYZ01234";

    // Act / Assert
    expect(isLegacyHash(bcryptHash)).toBe(false);
  });

  it("devrait retourner false pour une string de longueur != 64", () => {
    // Arrange
    const shortHash = "deadbeef";
    const longHash = "a".repeat(65);

    // Act / Assert
    expect(isLegacyHash(shortHash)).toBe(false);
    expect(isLegacyHash(longHash)).toBe(false);
  });

  it("devrait retourner false pour une string de 64 chars non-hex", () => {
    // Arrange — 64 chars mais pas hex
    const nonHex = "Z".repeat(64);

    // Act / Assert
    expect(isLegacyHash(nonHex)).toBe(false);
  });

  it("devrait retourner false pour une string vide", () => {
    // Arrange / Act / Assert
    expect(isLegacyHash("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBcryptHash — détection format bcrypt ($2a$ ou $2b$)
// ---------------------------------------------------------------------------

describe("isBcryptHash", () => {
  it("devrait retourner true pour un hash commençant par $2b$12$", () => {
    // Arrange
    const bcryptHash = "$2b$12$abcdefghijklmnopqrstuvOABCDEFGHIJKLMNOPQRSTUVWXYZ01234";

    // Act / Assert
    expect(isBcryptHash(bcryptHash)).toBe(true);
  });

  it("devrait retourner true pour un hash commençant par $2a$10$ (version a, cost 10)", () => {
    // Arrange — ancienne version 'a', différent cost factor, doit être accepté
    const bcryptHashA = "$2a$10$abcdefghijklmnopqrstuvOABCDEFGHIJKLMNOPQRSTUVWXYZ01234";

    // Act / Assert
    expect(isBcryptHash(bcryptHashA)).toBe(true);
  });

  it("devrait retourner true pour un hash commençant par $2b$12$ généré par hashPassword", async () => {
    // Arrange
    const hash = await hashPassword("test");

    // Act / Assert
    expect(isBcryptHash(hash)).toBe(true);
  });

  it("devrait retourner false pour un hash SHA-256 hex de 64 chars", () => {
    // Arrange
    const sha256Hash = crypto.createHash("sha256").update("admin123").digest("hex");

    // Act / Assert
    expect(isBcryptHash(sha256Hash)).toBe(false);
  });

  it("devrait retourner false pour une string vide", () => {
    // Arrange / Act / Assert
    expect(isBcryptHash("")).toBe(false);
  });

  it("devrait retourner false pour un format $1$ (md5-crypt, non supporté)", () => {
    // Arrange
    const md5Hash = "$1$abc$defghijklmnopqrstuvwxyz01";

    // Act / Assert
    expect(isBcryptHash(md5Hash)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyPassword — migration transparente legacy SHA-256 → bcrypt
// ---------------------------------------------------------------------------

describe("verifyPassword — migration transparente des hashes legacy", () => {
  it("devrait retourner true si le hash legacy correspond au SHA-256 du password", async () => {
    // Arrange — simule un user avec l'ancien hash SHA-256
    const password = "admin123";
    const legacyHash = crypto.createHash("sha256").update(password).digest("hex");

    // Act — l'appel doit fonctionner en mode compat lecture
    const result = await verifyPassword(password, legacyHash);

    // Assert — compatibilité ascendante pour login migration
    expect(result).toBe(true);
  });

  it("devrait retourner false si le password ne correspond pas au SHA-256 legacy", async () => {
    // Arrange
    const password = "admin123";
    const legacyHash = crypto.createHash("sha256").update(password).digest("hex");

    // Act
    const result = await verifyPassword("mauvaisPassword", legacyHash);

    // Assert
    expect(result).toBe(false);
  });

  it("devrait retourner true pour un hash bcrypt ET false pour legacy avec la même API", async () => {
    // Arrange
    const password = "monPassword";
    const bcryptHash = await hashPassword(password);
    const legacyHash = crypto.createHash("sha256").update(password).digest("hex");

    // Act
    const bcryptResult = await verifyPassword(password, bcryptHash);
    const legacyResult = await verifyPassword(password, legacyHash);

    // Assert — les deux doivent retourner true (compat bi-mode)
    expect(bcryptResult).toBe(true);
    expect(legacyResult).toBe(true);
  });

  it("devrait différencier un hash SHA-256 correct d'un hash SHA-256 incorrect", async () => {
    // Arrange
    const password = "test";
    const sha256OfTest = crypto.createHash("sha256").update("test").digest("hex");
    const sha256OfOther = crypto.createHash("sha256").update("autre").digest("hex");

    // Act
    const correct = await verifyPassword(password, sha256OfTest);
    const wrong = await verifyPassword(password, sha256OfOther);

    // Assert
    expect(correct).toBe(true);
    expect(wrong).toBe(false);
  });
});
