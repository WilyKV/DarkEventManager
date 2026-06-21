/**
 * Permission d'envoi de données en mode synchronisation WebSocket.
 *
 * Extrait de WebSocketSyncServer.handleSyncData (server/websocket-sync.ts ~l.387-401).
 * Fonction pure sans effets de bord — ne lit pas storage, ne logue pas.
 *
 * NOTE INTENTIONNELLE : handleRegister est log-only/non-bloquant (~l.296-307).
 * Cette fonction s'applique UNIQUEMENT à l'envoi de données (handleSyncData),
 * PAS à l'enregistrement des clients — handleRegister reste inchangé.
 */

/** Sous-ensemble du config sync nécessaire à la vérification de permission. */
export interface SyncPermissionConfig {
  isOnlineMode: boolean;
  masterDeviceId: string | null | undefined;
}

/**
 * Détermine si un appareil est autorisé à envoyer des données de synchronisation.
 *
 * Règles :
 *   - Mode online  → `true` (tout appareil authentifié peut envoyer)
 *   - Mode offline + deviceId === masterDeviceId → `true`
 *   - Mode offline + deviceId !== masterDeviceId → `false`
 *
 * @param config   - Configuration de synchronisation (isOnlineMode, masterDeviceId).
 * @param deviceId - Identifiant de l'appareil qui tente d'envoyer.
 * @returns `true` si l'envoi est autorisé, `false` sinon.
 */
export function canDeviceSend(config: SyncPermissionConfig, deviceId: string): boolean {
  if (config.isOnlineMode) {
    return true;
  }

  // Mode offline : seul le maître peut envoyer des données
  return config.masterDeviceId === deviceId;
}
