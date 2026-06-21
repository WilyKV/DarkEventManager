/**
 * Tests — GET /api/setup/status
 *
 * Vérifie que l'endpoint public renvoie :
 * - needsSetup: true quand la table users est vide
 * - needsSetup: false quand au moins un user existe
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock de la DB
// ---------------------------------------------------------------------------

const mockDbSelectLimit = vi.fn();

vi.mock("../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: mockDbSelectLimit,
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../server/session-logger", () => ({
  sessionLogger: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper : mini-app avec uniquement les routes auth (inclut /api/setup/status)
// ---------------------------------------------------------------------------

async function buildApp(): Promise<Express> {
  const { registerAuthRoutes } = await import("../../server/auth-routes");

  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      regenerate: (cb: (err: any) => void) => cb(null),
      save: (cb: (err: any) => void) => cb(null),
    };
    next();
  });

  registerAuthRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/setup/status", () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retourne needsSetup: true quand la table users est vide", async () => {
    mockDbSelectLimit.mockResolvedValue([]);

    const response = await request(app).get("/api/setup/status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ needsSetup: true });
  });

  it("retourne needsSetup: false quand au moins un user existe", async () => {
    mockDbSelectLimit.mockResolvedValue([
      { id: 1, username: "admin", roles: '["admin"]' },
    ]);

    const response = await request(app).get("/api/setup/status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ needsSetup: false });
  });

  it("est accessible sans authentification", async () => {
    mockDbSelectLimit.mockResolvedValue([]);

    const response = await request(app).get("/api/setup/status");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("needsSetup");
  });
});
