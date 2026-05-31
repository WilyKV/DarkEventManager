/**
 * Tests TDD — Red Phase
 *
 * SEC-HARDENING / MED-5
 * Headers de sécurité HTTP : Helmet doit être appliqué sur chaque réponse.
 *
 * Contrat attendu (à implémenter dans server/security-headers.ts) :
 *
 *   export function applySecurityHeaders(app: Express): void
 *
 * Cette fonction appelle helmet() avec des options sécurisées sur l'app Express.
 * Elle sera importée dans server/index.ts et appelée avant le montage des routes.
 *
 * Dépendance à installer : npm install helmet && npm install --save-dev @types/helmet
 *
 * Ces tests échoueront tant que server/security-headers.ts n'existe pas.
 */

import express, { type Express } from "express";
import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Import dynamique — le fichier n'existe pas encore (Red Phase)
// ---------------------------------------------------------------------------

type ApplySecurityHeaders = (app: Express) => void;

async function importApplySecurityHeaders(): Promise<ApplySecurityHeaders> {
  const mod = await import("../../server/security-headers");
  return mod.applySecurityHeaders;
}

// ---------------------------------------------------------------------------
// Factory : mini app Express avec security headers et un endpoint GET /health
// ---------------------------------------------------------------------------

async function buildAppWithSecurityHeaders(): Promise<Express> {
  const applySecurityHeaders = await importApplySecurityHeaders();
  const app = express();
  applySecurityHeaders(app);
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  return app;
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("applySecurityHeaders", () => {

  // -------------------------------------------------------------------------
  // 1. Headers de protection contre les attaques classiques
  // -------------------------------------------------------------------------

  describe("headers de protection présents sur GET /health", () => {

    it("should set x-content-type-options: nosniff on every response", async () => {
      // Arrange
      const app = await buildAppWithSecurityHeaders();

      // Act
      const response = await request(app).get("/health");

      // Assert
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("should set x-frame-options header to protect against clickjacking", async () => {
      // Arrange
      const app = await buildAppWithSecurityHeaders();

      // Act
      const response = await request(app).get("/health");

      // Assert — SAMEORIGIN ou DENY sont tous deux acceptables
      const xFrameOptions = response.headers["x-frame-options"];
      expect(xFrameOptions).toBeDefined();
      expect(["SAMEORIGIN", "DENY"]).toContain(xFrameOptions);
    });

    it("should set x-dns-prefetch-control: off to prevent DNS leaks", async () => {
      // Arrange
      const app = await buildAppWithSecurityHeaders();

      // Act
      const response = await request(app).get("/health");

      // Assert
      expect(response.headers["x-dns-prefetch-control"]).toBe("off");
    });

    it("should set strict-transport-security header for HSTS", async () => {
      // Arrange
      const app = await buildAppWithSecurityHeaders();

      // Act
      const response = await request(app).get("/health");

      // Assert — la présence du header suffit ; la valeur exacte est gérée par Helmet
      expect(response.headers["strict-transport-security"]).toBeDefined();
    });

    it("should set x-xss-protection header", async () => {
      // Arrange
      const app = await buildAppWithSecurityHeaders();

      // Act
      const response = await request(app).get("/health");

      // Assert
      expect(response.headers["x-xss-protection"]).toBeDefined();
    });

  });

  // -------------------------------------------------------------------------
  // 2. Suppression des headers qui révèlent la stack technique
  // -------------------------------------------------------------------------

  describe("suppression des headers informatifs dangereux", () => {

    it("should NOT include x-powered-by header (révèle Express)", async () => {
      // Arrange
      const app = await buildAppWithSecurityHeaders();

      // Act
      const response = await request(app).get("/health");

      // Assert
      // Helmet désactive x-powered-by via hidePoweredBy()
      expect(response.headers["x-powered-by"]).toBeUndefined();
    });

  });

  // -------------------------------------------------------------------------
  // 3. Les headers sont présents sur toutes les routes, pas seulement /health
  // -------------------------------------------------------------------------

  describe("headers appliqués sur toutes les routes", () => {

    it("should set security headers on a POST route as well", async () => {
      // Arrange
      const applySecurityHeaders = await importApplySecurityHeaders();
      const app = express();
      applySecurityHeaders(app);
      app.get("/api/test", (_req, res) => res.json({ ok: true }));
      app.post("/api/data", (_req, res) => res.json({ saved: true }));

      // Act — on vérifie sur une route POST
      const response = await request(app).post("/api/data").send({});

      // Assert
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-powered-by"]).toBeUndefined();
    });

    it("should set security headers even on 404 responses", async () => {
      // Arrange
      const app = await buildAppWithSecurityHeaders();

      // Act
      const response = await request(app).get("/route-inexistante");

      // Assert — Helmet agit avant le routing, les headers doivent être présents
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    });

  });

  // -------------------------------------------------------------------------
  // 4. La fonction ne casse pas une app Express sans routes
  // -------------------------------------------------------------------------

  describe("robustesse de applySecurityHeaders", () => {

    it("should not throw when called on an empty Express app", async () => {
      // Arrange
      const applySecurityHeaders = await importApplySecurityHeaders();
      const app = express();

      // Act & Assert — aucune exception levée
      expect(() => applySecurityHeaders(app)).not.toThrow();
    });

    it("should return void (aucune valeur de retour)", async () => {
      // Arrange
      const applySecurityHeaders = await importApplySecurityHeaders();
      const app = express();

      // Act
      const result = applySecurityHeaders(app);

      // Assert
      expect(result).toBeUndefined();
    });

  });

});
