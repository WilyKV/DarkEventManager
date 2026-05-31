import crypto from "crypto";

/**
 * Chiffre un plaintext avec AES-256-GCM.
 * Format du token : <iv_hex>:<authTag_hex>:<ciphertext_hex>
 * IV : 12 bytes aléatoires par appel.
 */
export function encryptQRPayload(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Déchiffre un token produit par encryptQRPayload.
 * Lève une erreur si le format est invalide, le token altéré, ou la clé incorrecte.
 */
export function decryptQRPayload(token: string, key: Buffer): string {
  const parts = token.split(":");
  if (parts.length !== 3) {
    throw new Error("Token malformé : format attendu <iv>:<authTag>:<ciphertext>");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (ivHex.length !== 24 || !/^[0-9a-fA-F]+$/.test(ivHex)) {
    throw new Error("Token malformé : IV invalide");
  }
  if (authTagHex.length !== 32 || !/^[0-9a-fA-F]+$/.test(authTagHex)) {
    throw new Error("Token malformé : authTag invalide");
  }
  if (!/^[0-9a-fA-F]*$/.test(ciphertextHex)) {
    throw new Error("Token malformé : ciphertext invalide");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Génère une clé AES-256 aléatoire (32 bytes). */
export function generateQRKey(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * Dérive une clé depuis une variable d'environnement.
 * Attend une string de 64 caractères hexadécimaux.
 */
export function deriveKeyFromEnv(envKey: string | undefined): Buffer {
  if (!envKey) {
    throw new Error("QR_ENCRYPTION_KEY manquant");
  }
  if (envKey.length < 64) {
    throw new Error("QR_ENCRYPTION_KEY doit être 64 caractères hex");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(envKey)) {
    throw new Error("QR_ENCRYPTION_KEY doit être 64 caractères hex valides");
  }
  return Buffer.from(envKey, "hex");
}
