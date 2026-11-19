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
    const configured = env.TRUST_PROXY_HOPS;
    const hops = configured === undefined || configured === "" ? 1 : Number(configured);
    if (!Number.isSafeInteger(hops) || hops < 0 || hops > 8) {
      throw new Error("TRUST_PROXY_HOPS doit être un entier compris entre 0 et 8.");
    }
    app.set("trust proxy", hops);
  }
}
