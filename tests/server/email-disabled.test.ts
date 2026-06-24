/**
 * Tests — email désactivé (SMTP non configuré)
 *
 * Contrat attendu :
 *   `isEmailEnabled()` retourne false quand :
 *     - EMAIL_ENABLED=false, OU
 *     - SMTP_USER/SMTP_PASS absents ou placeholders.
 *
 *   `sendEmail()` est un no-op (retourne false sans throw) quand l'email est désactivé.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// isEmailEnabled
// ---------------------------------------------------------------------------

describe('isEmailEnabled', () => {
  it('retourne false quand EMAIL_ENABLED=false', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'false');
    vi.stubEnv('SMTP_USER', 'user@real.com');
    vi.stubEnv('SMTP_PASS', 'realpassword');

    const { isEmailEnabled } = await import('../../server/email-service');
    expect(isEmailEnabled()).toBe(false);
  });

  it('retourne false quand SMTP_USER est vide', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'true');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASS', 'somepassword');

    const { isEmailEnabled } = await import('../../server/email-service');
    expect(isEmailEnabled()).toBe(false);
  });

  it('retourne false quand SMTP_PASS est vide', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'true');
    vi.stubEnv('SMTP_USER', 'user@real.com');
    vi.stubEnv('SMTP_PASS', '');

    const { isEmailEnabled } = await import('../../server/email-service');
    expect(isEmailEnabled()).toBe(false);
  });

  it('retourne false quand SMTP_USER est le placeholder "your-email@outlook.com"', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'true');
    vi.stubEnv('SMTP_USER', 'your-email@outlook.com');
    vi.stubEnv('SMTP_PASS', 'realpassword');

    const { isEmailEnabled } = await import('../../server/email-service');
    expect(isEmailEnabled()).toBe(false);
  });

  it('retourne false quand SMTP_PASS est le placeholder "your-password"', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'true');
    vi.stubEnv('SMTP_USER', 'user@real.com');
    vi.stubEnv('SMTP_PASS', 'your-password');

    const { isEmailEnabled } = await import('../../server/email-service');
    expect(isEmailEnabled()).toBe(false);
  });

  it('retourne false quand SMTP_USER est "CHANGE_ME"', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'true');
    vi.stubEnv('SMTP_USER', 'CHANGE_ME');
    vi.stubEnv('SMTP_PASS', 'realpassword');

    const { isEmailEnabled } = await import('../../server/email-service');
    expect(isEmailEnabled()).toBe(false);
  });

  it('retourne true quand EMAIL_ENABLED non défini et credentials réels', async () => {
    vi.stubEnv('EMAIL_ENABLED', '');
    vi.stubEnv('SMTP_USER', 'alice@example.com');
    vi.stubEnv('SMTP_PASS', 'secret123');

    // On réimporte car les modules sont cachés — on teste la logique pure via la fonction
    const { isEmailEnabled } = await import('../../server/email-service');
    // EMAIL_ENABLED='' n'est pas 'false', donc on vérifie les credentials
    expect(isEmailEnabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sendEmail — no-op quand désactivé
// ---------------------------------------------------------------------------

describe('sendEmail quand email désactivé', () => {
  it('retourne false sans throw quand EMAIL_ENABLED=false', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'false');
    vi.stubEnv('SMTP_USER', 'user@real.com');
    vi.stubEnv('SMTP_PASS', 'realpassword');

    const { sendEmail } = await import('../../server/email-service');

    await expect(
      sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>test</p>' })
    ).resolves.toBe(false);
  });

  it('retourne false sans throw quand credentials manquants', async () => {
    vi.stubEnv('EMAIL_ENABLED', '');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASS', '');

    const { sendEmail } = await import('../../server/email-service');

    await expect(
      sendEmail({ to: 'someone@example.com', subject: 'Bonjour', html: '<p>hi</p>' })
    ).resolves.toBe(false);
  });
});
