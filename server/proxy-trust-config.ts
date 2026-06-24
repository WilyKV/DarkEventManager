import { type Express } from "express";

/**
 * Configure la confiance au proxy inverse (nginx) en production.
 *
 * En production, l'app tourne derrière nginx qui termine TLS et proxifie en HTTP.
 * Sans `trust proxy`, Express voit `req.secure === false` et n'émet pas le
 * `Set-Cookie` quand `cookie.secure === true` — la session n'atteint jamais
 * le navigateur. On fait confiance au 1er hop (nginx) via `X-Forwarded-Proto`.
 *
 * Doit être appelée AVANT `app.use(session(...))`.
 */
export function configureProxyTrust(
  app: Express,
  env: NodeJS.ProcessEnv,
): void {
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
}
