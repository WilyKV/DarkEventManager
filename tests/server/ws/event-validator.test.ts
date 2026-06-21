/**
 * Tests — server/ws/event-validator.ts
 *
 * Contrat : validateSyncPayload(dataType, syncData) retourne
 *   { ok: true }
 *   { ok: false; message: string }
 *
 * Les messages d'erreur français sont copiés LITTÉRALEMENT depuis handleSyncData
 * dans server/websocket-sync.ts — un client peut les parser.
 */

import { describe, it, expect } from 'vitest';
import { validateSyncPayload } from '../../../server/ws/event-validator';

// ---------------------------------------------------------------------------
// Branche 1 : dataType absent ou non-string
// ---------------------------------------------------------------------------

describe('validateSyncPayload', () => {
  describe('dataType invalide', () => {
    it('retourne ok:false quand dataType est absent (undefined)', () => {
      const result = validateSyncPayload(undefined as any, { participants: [] });
      expect(result.ok).toBe(false);
    });

    it('retourne le message "Invalid dataType" quand dataType est absent', () => {
      const result = validateSyncPayload(undefined as any, { participants: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe('Invalid dataType');
      }
    });

    it('retourne ok:false quand dataType est null', () => {
      const result = validateSyncPayload(null as any, { participants: [] });
      expect(result.ok).toBe(false);
    });

    it('retourne ok:false quand dataType est un nombre (pas une string)', () => {
      const result = validateSyncPayload(42 as any, { participants: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe('Invalid dataType');
      }
    });

    it('retourne ok:false quand dataType est une chaîne vide', () => {
      const result = validateSyncPayload('', { participants: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe('Invalid dataType');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Branche 2 : syncData absent ou non-objet
  // -------------------------------------------------------------------------

  describe('syncData invalide', () => {
    it('retourne ok:false quand syncData est absent (undefined)', () => {
      const result = validateSyncPayload('participants', undefined as any);
      expect(result.ok).toBe(false);
    });

    it('retourne le message "Invalid syncData" quand syncData est absent', () => {
      const result = validateSyncPayload('participants', undefined as any);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe('Invalid syncData');
      }
    });

    it('retourne ok:false quand syncData est null', () => {
      const result = validateSyncPayload('participants', null as any);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe('Invalid syncData');
      }
    });

    it('retourne ok:false quand syncData est une string', () => {
      const result = validateSyncPayload('participants', 'not-an-object' as any);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe('Invalid syncData');
      }
    });

    it('retourne ok:false quand syncData est un nombre', () => {
      const result = validateSyncPayload('participants', 123 as any);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe('Invalid syncData');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Branche 3 : payload trop gros (> WS_SYNC_DATA_MAX_BYTES = 10 MB)
  // -------------------------------------------------------------------------

  describe('payload trop gros', () => {
    it('retourne ok:false quand le payload JSON dépasse 10 MB', () => {
      // Créer un objet dont JSON.stringify dépasse 10 * 1024 * 1024 octets
      const bigString = 'x'.repeat(11 * 1024 * 1024);
      const result = validateSyncPayload('participants', { data: bigString });
      expect(result.ok).toBe(false);
    });

    it('retourne le message "Payload too large (max 10MB)" quand le payload dépasse 10 MB', () => {
      const bigString = 'x'.repeat(11 * 1024 * 1024);
      const result = validateSyncPayload('participants', { data: bigString });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe('Payload too large (max 10MB)');
      }
    });

    it('retourne ok:true pour un payload juste en dessous de 10 MB', () => {
      // Payload de ~1 Ko : bien en dessous de la limite
      const smallData = { items: Array.from({ length: 10 }, (_, i) => ({ id: i, name: `item-${i}` })) };
      const result = validateSyncPayload('participants', smallData);
      expect(result.ok).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Branche 4 : dataType hors de la liste autorisée
  // -------------------------------------------------------------------------

  describe('dataType non autorisé', () => {
    it('retourne ok:false quand dataType est "events" (hors liste)', () => {
      const result = validateSyncPayload('events', { data: [] });
      expect(result.ok).toBe(false);
    });

    it('retourne le message "Invalid dataType" quand dataType est hors liste', () => {
      const result = validateSyncPayload('unknown-type', { data: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe('Invalid dataType');
      }
    });

    it('retourne ok:false pour "PARTICIPANTS" (casse incorrecte)', () => {
      const result = validateSyncPayload('PARTICIPANTS', { data: [] });
      expect(result.ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Branche 5 : cas OK — tous les dataTypes autorisés
  // -------------------------------------------------------------------------

  describe('cas OK', () => {
    const allowedTypes = ['participants', 'squads', 'timeslots', 'all'];

    for (const dataType of allowedTypes) {
      it(`retourne ok:true pour dataType="${dataType}" avec syncData valide`, () => {
        const result = validateSyncPayload(dataType, { version: 1, items: [] });
        expect(result.ok).toBe(true);
      });
    }

    it('retourne ok:true pour syncData vide (objet vide)', () => {
      const result = validateSyncPayload('all', {});
      expect(result.ok).toBe(true);
    });

    it('retourne ok:true pour syncData avec tableau', () => {
      const result = validateSyncPayload('squads', [{ id: 1, name: 'Squad Alpha' }] as any);
      expect(result.ok).toBe(true);
    });
  });
});
