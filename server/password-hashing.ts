import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_COST = 12;

/** Hash un password avec bcrypt (cost 12). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Vérifie un password contre un hash bcrypt ou SHA-256 legacy.
 * Retourne false si le password est vide ou si le format n'est pas reconnu.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password) return false;
  if (!hash) return false;
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  if (isLegacyHash(hash)) {
    const sha256 = crypto.createHash("sha256").update(password).digest("hex");
    return sha256 === hash;
  }
  return false;
}

/** Retourne true si le hash est un SHA-256 hex de 64 caractères. */
export function isLegacyHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

/** Retourne true si le hash est un hash bcrypt ($2a$ ou $2b$). */
export function isBcryptHash(hash: string): boolean {
  return /^\$2[ab]\$\d{2}\$/.test(hash);
}
