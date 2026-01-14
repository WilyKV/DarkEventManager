/**
 * QR Code Encryption Utilities
 *
 * Provides AES-256-CBC encryption/decryption for QR code data
 */

import crypto from 'crypto';
import { logger } from './logger';

// Encryption key and IV for QR codes - MUST be set in environment variables
const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY;
const ENCRYPTION_IV = process.env.QR_ENCRYPTION_IV;

// Validate encryption keys are present
if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
  throw new Error(
    '🚨 CRITICAL: QR_ENCRYPTION_KEY and QR_ENCRYPTION_IV must be set in environment variables.\n' +
    'Generate them with:\n' +
    '  QR_ENCRYPTION_KEY=$(node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")\n' +
    '  QR_ENCRYPTION_IV=$(node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))")'
  );
}

// Validate key lengths
if (ENCRYPTION_KEY.length < 32) {
  throw new Error('QR_ENCRYPTION_KEY must be at least 32 characters');
}
if (ENCRYPTION_IV.length < 16) {
  throw new Error('QR_ENCRYPTION_IV must be at least 16 characters');
}

/**
 * Encrypt QR code data (participant ID + secret code)
 */
export function encryptQRData(participantId: number, secretCode: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = Buffer.from(ENCRYPTION_IV.padEnd(16, '0').slice(0, 16));
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  const data = JSON.stringify({ id: participantId, code: secretCode });
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  logger.debug('QR data encrypted', { participantId });
  return encrypted;
}

/**
 * Decrypt QR code data
 */
export function decryptQRData(encryptedData: string): { id: number; code: string } | null {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const iv = Buffer.from(ENCRYPTION_IV.padEnd(16, '0').slice(0, 16));
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const data = JSON.parse(decrypted);
    logger.debug('QR data decrypted', { participantId: data.id });
    return data;
  } catch (error: any) {
    logger.warn('QR decryption failed', { error: error.message });
    return null;
  }
}
