/**
 * Génération et vérification des tokens HMAC pour l'authentification WebSocket.
 * Utilise le module `crypto` natif Node.js — aucune dépendance externe.
 *
 * Format du token : <deviceIdBase64url>.<expiry>.<hmac_hex>
 *   - deviceIdBase64url : deviceId encodé en base64url (gère les points, =, espaces, unicode)
 *   - expiry            : timestamp ms (Date.now() + WS_TOKEN_TTL_MS) en string décimal
 *   - hmac_hex          : HMAC-SHA256 hexadécimal de "<deviceIdBase64url>.<expiry>"
 */

import crypto from 'crypto';

export const WS_TOKEN_TTL_MS = 15 * 60 * 1000; // 900 000 ms

function toBase64url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64').toString('utf8');
}

function computeHmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function signDeviceToken(
  deviceId: string,
  secret: string,
  now: number = Date.now()
): string {
  const deviceIdEncoded = toBase64url(deviceId);
  const expiry = (now + WS_TOKEN_TTL_MS).toString();
  const payload = `${deviceIdEncoded}.${expiry}`;
  const hmac = computeHmac(payload, secret);
  return `${deviceIdEncoded}.${expiry}.${hmac}`;
}

export function verifyDeviceToken(
  token: string,
  secret: string,
  now: number = Date.now()
): { valid: boolean; deviceId?: string; reason?: 'expired' | 'invalid_signature' | 'malformed' } {
  if (!token) {
    return { valid: false, reason: 'malformed' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'malformed' };
  }

  const [deviceIdEncoded, expiryStr, providedHmac] = parts;

  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry)) {
    return { valid: false, reason: 'malformed' };
  }

  if (now > expiry) {
    return { valid: false, reason: 'expired' };
  }

  const payload = `${deviceIdEncoded}.${expiryStr}`;
  const expectedHmac = computeHmac(payload, secret);

  if (
    providedHmac.length !== expectedHmac.length ||
    !crypto.timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))
  ) {
    return { valid: false, reason: 'invalid_signature' };
  }

  const deviceId = fromBase64url(deviceIdEncoded);
  return { valid: true, deviceId };
}
