/**
 * Routeur de messages WebSocket.
 *
 * Extrait du switch dans WebSocketSyncServer.handleMessage (server/websocket-sync.ts ~l.248-267).
 * Sépare la table de dispatch de la logique métier des handlers.
 *
 * Le caller (WebSocketSyncServer) fournit les handlers concrets ;
 * le router se contente d'appeler le bon handler selon message.type.
 */

import { WebSocket } from 'ws';

/** Handlers fournis par WebSocketSyncServer au routeur. */
export interface MessageHandlers {
  onSyncRequest: (ws: WebSocket, message: unknown) => void;
  onSyncData: (ws: WebSocket, message: unknown) => void;
  onGetClients: (ws: WebSocket) => void;
  onPing: (ws: WebSocket) => void;
  onUnknown: (ws: WebSocket) => void;
}

/**
 * Dispatche un message vers le handler approprié selon `message.type`.
 *
 * Ne gère PAS le cas `register` — il est traité en amont dans handleMessage
 * avant l'authentification (comportement conservé intentionnellement).
 *
 * @param ws       - La connexion WebSocket source.
 * @param message  - Le message parsé (objet avec au moins `type: string`).
 * @param handlers - Les handlers fournis par l'orchestrateur.
 */
export function routeMessage(
  ws: WebSocket,
  message: { type?: string },
  handlers: MessageHandlers,
): void {
  switch (message.type) {
    case 'sync-request':
      handlers.onSyncRequest(ws, message);
      break;

    case 'sync-data':
      handlers.onSyncData(ws, message);
      break;

    case 'get-clients':
      handlers.onGetClients(ws);
      break;

    case 'ping':
      handlers.onPing(ws);
      break;

    default:
      handlers.onUnknown(ws);
  }
}
