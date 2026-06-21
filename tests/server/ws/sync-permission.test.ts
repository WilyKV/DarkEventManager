/**
 * Tests — server/ws/sync-permission.ts
 *
 * Contrat : canDeviceSend(config, deviceId): boolean
 *
 * Logique extraite de handleSyncData dans server/websocket-sync.ts (~l.387-401) :
 *   - mode online  → true (tout appareil peut envoyer)
 *   - mode offline + masterDeviceId === deviceId → true (maître peut envoyer)
 *   - mode offline + masterDeviceId !== deviceId → false (non-maître bloqué)
 *
 * IMPORTANT : canDeviceSend ne s'applique QU'au envoi de données (handleSyncData).
 * handleRegister est log-only et ne doit PAS devenir bloquant.
 */

import { describe, it, expect } from 'vitest';
import { canDeviceSend } from '../../../server/ws/sync-permission';

// ---------------------------------------------------------------------------
// Type minimal pour le config (isOnlineMode + masterDeviceId)
// ---------------------------------------------------------------------------

interface MinimalSyncConfig {
  isOnlineMode: boolean;
  masterDeviceId: string | null | undefined;
}

// ---------------------------------------------------------------------------
// Cas 1 : mode online
// ---------------------------------------------------------------------------

describe('canDeviceSend', () => {
  describe('en mode online (isOnlineMode: true)', () => {
    it('retourne true pour n\'importe quel deviceId', () => {
      const config: MinimalSyncConfig = { isOnlineMode: true, masterDeviceId: 'master-device-001' };
      expect(canDeviceSend(config, 'any-device-id')).toBe(true);
    });

    it('retourne true même si deviceId ne correspond pas au master', () => {
      const config: MinimalSyncConfig = { isOnlineMode: true, masterDeviceId: 'master-device-001' };
      expect(canDeviceSend(config, 'client-device-999')).toBe(true);
    });

    it('retourne true si masterDeviceId est null en mode online', () => {
      const config: MinimalSyncConfig = { isOnlineMode: true, masterDeviceId: null };
      expect(canDeviceSend(config, 'some-device')).toBe(true);
    });

    it('retourne true si masterDeviceId est undefined en mode online', () => {
      const config: MinimalSyncConfig = { isOnlineMode: true, masterDeviceId: undefined };
      expect(canDeviceSend(config, 'some-device')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Cas 2 : mode offline + appareil maître
  // -------------------------------------------------------------------------

  describe('en mode offline (isOnlineMode: false) — appareil maître', () => {
    it('retourne true quand deviceId === masterDeviceId', () => {
      const config: MinimalSyncConfig = { isOnlineMode: false, masterDeviceId: 'master-device-001' };
      expect(canDeviceSend(config, 'master-device-001')).toBe(true);
    });

    it('retourne true pour différents formats d\'identifiants maîtres', () => {
      const config: MinimalSyncConfig = { isOnlineMode: false, masterDeviceId: 'uuid-1234-abcd-5678' };
      expect(canDeviceSend(config, 'uuid-1234-abcd-5678')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Cas 3 : mode offline + appareil non-maître
  // -------------------------------------------------------------------------

  describe('en mode offline (isOnlineMode: false) — appareil non-maître', () => {
    it('retourne false quand deviceId !== masterDeviceId', () => {
      const config: MinimalSyncConfig = { isOnlineMode: false, masterDeviceId: 'master-device-001' };
      expect(canDeviceSend(config, 'client-device-002')).toBe(false);
    });

    it('retourne false pour un deviceId inconnu en mode offline', () => {
      const config: MinimalSyncConfig = { isOnlineMode: false, masterDeviceId: 'master-device-001' };
      expect(canDeviceSend(config, 'totally-unknown-device')).toBe(false);
    });

    it('retourne false si masterDeviceId est null (aucun maître configuré) en mode offline', () => {
      // Sans maître configuré en mode offline, personne ne peut envoyer
      const config: MinimalSyncConfig = { isOnlineMode: false, masterDeviceId: null };
      expect(canDeviceSend(config, 'any-device')).toBe(false);
    });

    it('est sensible à la casse : "Master" !== "master" retourne false', () => {
      const config: MinimalSyncConfig = { isOnlineMode: false, masterDeviceId: 'Master-Device-001' };
      expect(canDeviceSend(config, 'master-device-001')).toBe(false);
    });
  });
});
