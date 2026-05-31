import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";

// Smoke test minimal : vérifie que supertest fonctionne en environnement Node
// On ne charge PAS server/index.ts pour éviter d'initialiser Drizzle/Postgres/WebSocket
// L'app Express est créée inline dans ce fichier de test
describe("smoke test server", () => {
  it("répond 200 avec { ok: true } sur GET /health", async () => {
    const app = express();

    app.get("/health", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});
