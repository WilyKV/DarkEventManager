/**
 * Validation de la variable d'environnement SESSION_SECRET au démarrage.
 * Fonction pure : ne lit pas process.env, ne produit aucun side-effect.
 */

export type ValidateSessionSecretResult = {
  valid: boolean;
  secret: string;
  message?: string;
  mode: 'fail' | 'warn' | 'ok';
};

const DEFAULT_SECRET = 'darkevent-secret-key-change-in-production';
const MIN_SECRET_LENGTH = 32;

export function validateSessionSecret(
  env: Record<string, string | undefined>
): ValidateSessionSecretResult {
  const isProduction = env.NODE_ENV === 'production';
  const secret = env.SESSION_SECRET;
  const hasSecret = typeof secret === 'string' && secret.length > 0;
  const isDefault = secret === DEFAULT_SECRET;

  if (!hasSecret || isDefault) {
    if (isProduction) {
      return {
        valid: false,
        secret: DEFAULT_SECRET,
        mode: 'fail',
        message:
          'SESSION_SECRET est absent ou égal à la valeur par défaut. ' +
          'En production, cette variable est obligatoire. ' +
          'Définissez une valeur aléatoire d\'au moins 32 caractères.',
      };
    }
    return {
      valid: true,
      secret: DEFAULT_SECRET,
      mode: 'warn',
      message:
        'SESSION_SECRET non défini ou égal à la valeur par défaut. ' +
        'Utilisation du secret de développement (non recommandé hors développement).',
    };
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    return {
      valid: true,
      secret,
      mode: 'warn',
      message:
        `SESSION_SECRET est trop court (${secret.length} caractères). ` +
        `Minimum recommandé : ${MIN_SECRET_LENGTH} caractères.`,
    };
  }

  return { valid: true, secret, mode: 'ok' };
}
