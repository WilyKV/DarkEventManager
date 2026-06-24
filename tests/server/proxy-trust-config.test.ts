/**
 * Tests — configureProxyTrust
 *
 * Vérifie que `trust proxy` est activé uniquement en production.
 *
 * Contexte : en production, l'app tourne derrière nginx (TLS terminé par nginx,
 * HTTP vers l'app). Sans `trust proxy`, express-session n'émet pas le Set-Cookie
 * quand `cookie.secure === true`, car `req.secure === false` côté app.
 *
 * Solution : `app.set('trust proxy', 1)` activé AVANT `app.use(session(...))`.
 */

import express from "express";
import { describe, it, expect } from "vitest";
import { configureProxyTrust } from "../../server/proxy-trust-config";

describe("configureProxyTrust", () => {

  describe("en NODE_ENV=production", () => {

    it("should enable trust proxy (value 1) so session cookie is emitted behind nginx", () => {
      // Arrange
      const app = express();

      // Act
      configureProxyTrust(app, { NODE_ENV: "production" });

      // Assert — app.get('trust proxy') renvoie la valeur brute passée (1)
      expect(app.get("trust proxy")).toBe(1);
    });

    it("should report app.enabled('trust proxy') as true in production", () => {
      // Arrange
      const app = express();

      // Act
      configureProxyTrust(app, { NODE_ENV: "production" });

      // Assert
      expect(app.enabled("trust proxy")).toBe(true);
    });

  });

  describe("hors production (dev, test, undefined)", () => {

    it("should NOT set trust proxy in development", () => {
      // Arrange
      const app = express();

      // Act
      configureProxyTrust(app, { NODE_ENV: "development" });

      // Assert — valeur par défaut Express = false / undefined
      expect(app.enabled("trust proxy")).toBe(false);
    });

    it("should NOT set trust proxy in test", () => {
      // Arrange
      const app = express();

      // Act
      configureProxyTrust(app, { NODE_ENV: "test" });

      // Assert
      expect(app.enabled("trust proxy")).toBe(false);
    });

    it("should NOT set trust proxy when NODE_ENV is undefined", () => {
      // Arrange
      const app = express();

      // Act
      configureProxyTrust(app, {});

      // Assert
      expect(app.enabled("trust proxy")).toBe(false);
    });

  });

});
