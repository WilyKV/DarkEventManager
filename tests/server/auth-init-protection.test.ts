import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { select, insert, execute, transaction, hashPassword } = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("../../server/db", () => ({
  db: { select, transaction },
}));
vi.mock("../../server/password-hashing", () => ({
  hashPassword,
  verifyPassword: vi.fn(),
  isLegacyHash: vi.fn(),
}));
vi.mock("../../server/session-logger", () => ({ sessionLogger: vi.fn() }));

const credentials = { username: "organisateur", password: "test-long-passphrase!" };
const setupToken = "test-only-installation-code-with-more-than-32-characters";

async function buildApp() {
  const { registerAuthRoutes } = await import("../../server/auth-routes");
  const app = express();
  app.use(express.json());
  registerAuthRoutes(app);
  return app;
}

describe("Création du premier administrateur", () => {
  const limit = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SETUP_TOKEN", "");
    limit.mockResolvedValue([]);
    select.mockReturnValue({ from: () => ({ limit }) });
    insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    transaction.mockImplementation(callback => callback({ select, insert, execute }));
    hashPassword.mockResolvedValue("test-bcrypt-hash");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("utilise le nom fourni et n’expose aucun secret dans la réponse", async () => {
    const response = await request(await buildApp()).post("/api/auth/init").send(credentials).expect(201);
    expect(response.body).toEqual({ message: "Administrateur créé", username: credentials.username });
    expect(execute).toHaveBeenCalledOnce();
    expect(hashPassword).toHaveBeenCalledWith(credentials.password);
    expect(insert.mock.results[0].value.values).toHaveBeenCalledWith({
      username: credentials.username, passwordHash: "test-bcrypt-hash", roles: '["admin"]',
    });
  });

  it("rejette l’absence de mot de passe et les mots de passe trop courts", async () => {
    const app = await buildApp();
    await request(app).post("/api/auth/init").send({}).expect(400);
    await request(app).post("/api/auth/init").send({ ...credentials, password: "court" }).expect(400);
    expect(hashPassword).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejette un mot de passe de plus de 72 octets", async () => {
    await request(await buildApp()).post("/api/auth/init").send({ ...credentials, password: "é".repeat(37) }).expect(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("exige un code en production et refuse un code incorrect avant de calculer le hash", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const app = await buildApp();
    await request(app).post("/api/auth/init").send(credentials).expect(503);
    vi.stubEnv("SETUP_TOKEN", setupToken);
    await request(app).post("/api/auth/init").send({ ...credentials, setupToken: "incorrect" }).expect(403);
    expect(hashPassword).not.toHaveBeenCalled();
    await request(app).post("/api/auth/init").send({ ...credentials, setupToken }).expect(201);
  });

  it("ferme l’initialisation dès qu’un compte existe", async () => {
    limit.mockResolvedValue([{ id: 1 }]);
    const response = await request(await buildApp()).post("/api/auth/init").send(credentials).expect(403);
    expect(response.body.code).toBe("setup_complete");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuse une seconde création quand une requête concurrente a déjà créé le compte", async () => {
    limit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 1 }]);
    await request(await buildApp()).post("/api/auth/init").send(credentials).expect(403);
    expect(execute).toHaveBeenCalledOnce();
    expect(insert).not.toHaveBeenCalled();
  });
});
