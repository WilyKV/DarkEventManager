/**
 * Tests — server/ws/message-router.ts
 *
 * Contrat : routeMessage(ws, message, handlers) dispatche vers le bon handler
 * selon message.type, en conservant exactement le comportement du switch
 * original de WebSocketSyncServer.handleMessage (~l.248-267).
 *
 * Le cas `register` est intentionnellement absent : il est traité EN AMONT
 * dans handleMessage (avant vérification d'authentification).
 */

import { describe, it, expect, vi } from 'vitest';
import { routeMessage } from '../../../server/ws/message-router';
import type { MessageHandlers } from '../../../server/ws/message-router';
import type { WebSocket } from 'ws';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Crée un WebSocket mock minimal. */
function makeMockWs(): WebSocket {
  return {} as WebSocket;
}

/** Crée des handlers espions (tous no-op par défaut). */
function makeHandlers(): { handlers: MessageHandlers; spies: Record<string, ReturnType<typeof vi.fn>> } {
  const spies = {
    onSyncRequest: vi.fn(),
    onSyncData: vi.fn(),
    onGetClients: vi.fn(),
    onPing: vi.fn(),
    onUnknown: vi.fn(),
  };
  return { handlers: spies as MessageHandlers, spies };
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe('routeMessage', () => {
  // -------------------------------------------------------------------------
  // Cas "sync-request"
  // -------------------------------------------------------------------------

  describe('type: "sync-request"', () => {
    it('appelle onSyncRequest avec ws et le message complet', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();
      const message = { type: 'sync-request', targetDeviceId: 'device-002', requestType: 'full' };

      routeMessage(ws, message, handlers);

      expect(spies.onSyncRequest).toHaveBeenCalledOnce();
      expect(spies.onSyncRequest).toHaveBeenCalledWith(ws, message);
    });

    it('n\'appelle aucun autre handler pour type sync-request', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, { type: 'sync-request' }, handlers);

      expect(spies.onSyncData).not.toHaveBeenCalled();
      expect(spies.onGetClients).not.toHaveBeenCalled();
      expect(spies.onPing).not.toHaveBeenCalled();
      expect(spies.onUnknown).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cas "sync-data"
  // -------------------------------------------------------------------------

  describe('type: "sync-data"', () => {
    it('appelle onSyncData avec ws et le message complet', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();
      const message = { type: 'sync-data', dataType: 'participants', syncData: { items: [] } };

      routeMessage(ws, message, handlers);

      expect(spies.onSyncData).toHaveBeenCalledOnce();
      expect(spies.onSyncData).toHaveBeenCalledWith(ws, message);
    });

    it('n\'appelle aucun autre handler pour type sync-data', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, { type: 'sync-data' }, handlers);

      expect(spies.onSyncRequest).not.toHaveBeenCalled();
      expect(spies.onGetClients).not.toHaveBeenCalled();
      expect(spies.onPing).not.toHaveBeenCalled();
      expect(spies.onUnknown).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cas "get-clients"
  // -------------------------------------------------------------------------

  describe('type: "get-clients"', () => {
    it('appelle onGetClients avec ws uniquement (pas le message)', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, { type: 'get-clients' }, handlers);

      expect(spies.onGetClients).toHaveBeenCalledOnce();
      expect(spies.onGetClients).toHaveBeenCalledWith(ws);
    });

    it('n\'appelle aucun autre handler pour type get-clients', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, { type: 'get-clients' }, handlers);

      expect(spies.onSyncRequest).not.toHaveBeenCalled();
      expect(spies.onSyncData).not.toHaveBeenCalled();
      expect(spies.onPing).not.toHaveBeenCalled();
      expect(spies.onUnknown).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cas "ping"
  // -------------------------------------------------------------------------

  describe('type: "ping"', () => {
    it('appelle onPing avec ws', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, { type: 'ping' }, handlers);

      expect(spies.onPing).toHaveBeenCalledOnce();
      expect(spies.onPing).toHaveBeenCalledWith(ws);
    });

    it('n\'appelle aucun autre handler pour type ping', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, { type: 'ping' }, handlers);

      expect(spies.onSyncRequest).not.toHaveBeenCalled();
      expect(spies.onSyncData).not.toHaveBeenCalled();
      expect(spies.onGetClients).not.toHaveBeenCalled();
      expect(spies.onUnknown).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Cas default : type inconnu
  // -------------------------------------------------------------------------

  describe('type inconnu (default)', () => {
    it('appelle onUnknown pour un type arbitraire inconnu', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, { type: 'unknown-action' }, handlers);

      expect(spies.onUnknown).toHaveBeenCalledOnce();
      expect(spies.onUnknown).toHaveBeenCalledWith(ws);
    });

    it('appelle onUnknown quand type est undefined', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, {}, handlers);

      expect(spies.onUnknown).toHaveBeenCalledOnce();
    });

    it('appelle onUnknown pour "register" (non géré ici : géré en amont)', () => {
      // Le type "register" est traité AVANT routeMessage dans handleMessage.
      // S'il parvenait au router, il tomberait dans default.
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, { type: 'register' }, handlers);

      expect(spies.onUnknown).toHaveBeenCalledOnce();
    });

    it('n\'appelle qu\'un seul handler pour un type inconnu', () => {
      const ws = makeMockWs();
      const { handlers, spies } = makeHandlers();

      routeMessage(ws, { type: 'does-not-exist' }, handlers);

      expect(spies.onSyncRequest).not.toHaveBeenCalled();
      expect(spies.onSyncData).not.toHaveBeenCalled();
      expect(spies.onGetClients).not.toHaveBeenCalled();
      expect(spies.onPing).not.toHaveBeenCalled();
      expect(spies.onUnknown).toHaveBeenCalledOnce();
    });
  });
});
