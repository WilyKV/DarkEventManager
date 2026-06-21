/**
 * Tests TDD — SEC-HARDENING / MED-SEC-5
 *
 * CSP conditionnel selon NODE_ENV :
 *   - production : Content-Security-Policy présent
 *   - développement : Content-Security-Policy absent, autres en-têtes Helmet présents
 */

import express, { type Express } from "express";
import request from "supertest";
import { describe, it, expect, afterEach } from "vitest";

type ApplySecurityHeaders = (app: Express) => void;

async function importFresh(): Promise<ApplySecurityHeaders> {
  // Purge the module cache to pick up the current NODE_ENV
  const key = Object.keys(
    (await import("module")) as unknown as Record<string, unknown>
  ).find(() => false);
  void key;

  const mod = await import("../../server/security-headers?t=" + Date.now());
  return mod.applySecurityHeaders;
}

function buildApp(applySecurityHeaders: ApplySecurityHeaders): Express {
  const app = express();
  applySecurityHeaders(app);
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  return app;
}

describe("applySecurityHeaders — CSP conditionnel", () => {
  const originalNodeEnv = process.env["NODE_ENV"];

  afterEach(() => {
    process.env["NODE_ENV"] = originalNodeEnv;
  });

  it("production : Content-Security-Policy est présent", async () => {
    // Arrange
    process.env["NODE_ENV"] = "production";
    const applySecurityHeaders = await importFresh();
    const app = buildApp(applySecurityHeaders);

    // Act
    const response = await request(app).get("/health");

    // Assert
    expect(response.headers["content-security-policy"]).toBeDefined();
  });

  it("développement : Content-Security-Policy est absent", async () => {
    // Arrange
    process.env["NODE_ENV"] = "development";
    const applySecurityHeaders = await importFresh();
    const app = buildApp(applySecurityHeaders);

    // Act
    const response = await request(app).get("/health");

    // Assert
    expect(response.headers["content-security-policy"]).toBeUndefined();
  });

  it("développement : X-Content-Type-Options reste présent (Helmet actif)", async () => {
    // Arrange
    process.env["NODE_ENV"] = "development";
    const applySecurityHeaders = await importFresh();
    const app = buildApp(applySecurityHeaders);

    // Act
    const response = await request(app).get("/health");

    // Assert
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
