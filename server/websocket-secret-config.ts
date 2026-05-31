/**
 * Validation de la variable d'environnement WEBSOCKET_SECRET au démarrage.
 * Fonction pure : ne lit pas process.env, ne produit aucun side-effect.
 */

export type ValidateWebSocketSecretResult = {
  valid: boolean;
  message?: string;
  mode: 'fail' | 'warn' | 'ok';
};

const MIN_SECRET_LENGTH = 32;

export function validateWebSocketSecret(
  env: Record<string, string | undefined>
): ValidateWebSocketSecretResult {
  const isProduction = env.NODE_ENV === 'production';
  const secret = env.WEBSOCKET_SECRET;
  const hasSecret = typeof secret === 'string' && secret.length > 0;

  if (!hasSecret) {
    if (isProduction) {
      return {
        valid: false,
        mode: 'fail',
        message:
          'WEBSOCKET_SECRET est absent ou vide. En production, cette variable est obligatoire. ' +
          'Définissez une valeur aléatoire d\'au moins 32 caractères.',
      };
    }
    return {
      valid: true,
      mode: 'warn',
      message:
        'WEBSOCKET_SECRET non défini. Un secret aléatoire est généré automatiquement ' +
        '(non recommandé hors développement).',
    };
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    return {
      valid: true,
      mode: 'warn',
      message:
        `WEBSOCKET_SECRET est trop court (${secret.length} caractères). ` +
        `Minimum recommandé : ${MIN_SECRET_LENGTH} caractères.`,
    };
  }

  return { valid: true, mode: 'ok' };
}
