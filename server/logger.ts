/**
 * Logger structuré — DarkEventManager
 *
 * Basé sur pino pour des logs JSON en production et un format lisible en développement.
 *
 * @example Usage basique
 * ```ts
 * import { logger } from './logger';
 *
 * logger.info('Serveur démarré');
 * logger.warn({ port: 5000 }, 'Port non sécurisé');
 * logger.error({ err }, 'Erreur inattendue');
 * ```
 *
 * @example Child logger nommé (remplace les préfixes ad-hoc [WebSocket], [Email], etc.)
 * ```ts
 * const wsLogger = logger.child({ module: 'websocket' });
 * wsLogger.info('Connexion établie');
 * ```
 *
 * @remarks
 * - Niveau configurable via `LOG_LEVEL` (défaut : `info`, `debug` en dev).
 * - En développement (`NODE_ENV !== 'production'`) : transport pino-pretty (couleurs, timestamps lisibles).
 * - En production : JSON brut sur stdout.
 * - pino-pretty est importé dynamiquement en dev uniquement pour éviter de le bundler en prod.
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const defaultLevel = isDev ? 'debug' : (process.env.LOG_LEVEL ?? 'info');

const devTransport: pino.TransportSingleOptions = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'pid,hostname',
    messageFormat: '[{module}] {msg}',
  },
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? defaultLevel,
  ...(isDev ? { transport: devTransport } : {}),
});

/**
 * Crée un child logger portant un nom de module.
 * Remplace les préfixes manuels comme `[WebSocket]`, `[Email]`, `[PDF]`.
 *
 * @param module - Nom du module (ex: 'websocket', 'email', 'sync')
 */
export function childLogger(module: string): pino.Logger {
  return logger.child({ module });
}
