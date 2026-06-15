/**
 * Validation pure des payloads de synchronisation WebSocket.
 *
 * Extrait de WebSocketSyncServer.handleSyncData (server/websocket-sync.ts).
 * Fonction pure sans effets de bord — aucune dépendance extérieure.
 *
 * Les messages d'erreur sont intentionnellement copiés à l'identique
 * depuis handleSyncData : des clients peuvent parser ces chaînes.
 */

import { WS_SYNC_DATA_MAX_BYTES } from '../config/limits';

/** Types de données autorisés pour la synchronisation. */
const ALLOWED_DATA_TYPES = ['participants', 'squads', 'timeslots', 'all'] as const;

export type SyncDataType = (typeof ALLOWED_DATA_TYPES)[number];

/** Résultat de la validation du payload sync-data. */
export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Valide le payload d'un message sync-data WebSocket.
 *
 * Vérifie dans l'ordre :
 *   1. `dataType` est une string non vide
 *   2. `syncData` est un objet (non null)
 *   3. La taille JSON de `syncData` ne dépasse pas WS_SYNC_DATA_MAX_BYTES
 *   4. `dataType` appartient à la liste des types autorisés
 *
 * @param dataType - Le type de données à synchroniser.
 * @param syncData - L'objet contenant les données.
 * @returns `{ ok: true }` si valide, `{ ok: false; message }` sinon.
 */
export function validateSyncPayload(dataType: unknown, syncData: unknown): ValidationResult {
  // 1. Validation de dataType : doit être une string non vide
  if (!dataType || typeof dataType !== 'string') {
    return { ok: false, message: 'Invalid dataType' };
  }

  // 2. Validation de syncData : doit être un objet non null
  if (!syncData || typeof syncData !== 'object') {
    return { ok: false, message: 'Invalid syncData' };
  }

  // 3. Validation de la taille du payload
  const payloadSize = JSON.stringify(syncData).length;
  if (payloadSize > WS_SYNC_DATA_MAX_BYTES) {
    return { ok: false, message: 'Payload too large (max 10MB)' };
  }

  // 4. Validation que dataType est dans la liste autorisée
  if (!(ALLOWED_DATA_TYPES as readonly string[]).includes(dataType)) {
    return { ok: false, message: 'Invalid dataType' };
  }

  return { ok: true };
}
