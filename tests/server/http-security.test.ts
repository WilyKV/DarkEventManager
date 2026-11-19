import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { SessionData } from "express-session";
import { protectApiOrigin } from "../../server/request-origin";

const { getPurchases, getMealPurchases } = vi.hoisted(() => ({ getPurchases: vi.fn(), getMealPurchases: vi.fn() }));
vi.mock("../../server/storage", () => ({
  storage: {
    getPurchases,
    getMealPurchases,
    getSyncConfig: vi.fn().mockResolvedValue({ isOnlineMode: true }),
  },
}));
vi.mock("../../server/event-ingest-routes", () => ({ registerEventIngestRoutes: vi.fn() }));

async function appWithSession(session: Partial<SessionData>) {
  const { registerRoutes } = await import("../../server/routes");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { session });
    next();
  });
  await registerRoutes(app);
  return app;
}

describe("Protection des requêtes qui modifient les données", () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use("/api", protectApiOrigin);
  app.post("/api/participants", (_req, res) => res.sendStatus(204));

  it("accepte l’origine HTTPS transmise par le proxy", async () => {
    await request(app).post("/api/participants")
      .set("Host", "gestion.example")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://gestion.example")
      .expect(204);
  });

  it("refuse une modification provenant d’une autre origine", async () => {
    await request(app).post("/api/participants")
      .set("Host", "gestion.example")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", "https://autre.example")
      .expect(403);
    await request(app).post("/api/participants")
      .set("Sec-Fetch-Site", "same-site")
      .expect(403);
  });
});

describe("Autorisations boutique et repas", () => {
  it("refuse les modifications anonymes", async () => {
    const app = await appWithSession({});
    await request(app).post("/api/purchases").send({}).expect(401);
    await request(app).post("/api/meal-purchases").send({}).expect(401);
    await request(app).put("/api/discounts/global").send({}).expect(401);
    await request(app).delete("/api/meal-items/1").expect(401);
  });

  it("limite la lecture des achats d’un visiteur à son propre dossier", async () => {
    const app = await appWithSession({ visitor: { participantId: 7, firstName: "Test", lastName: "Participant", secretCode: "12345" } });
    getPurchases.mockResolvedValue([]);
    getMealPurchases.mockResolvedValue([]);
    await request(app).get("/api/purchases?participantId=7").expect(200, []);
    await request(app).get("/api/meal-purchases?participantId=7").expect(200, []);
    await request(app).get("/api/purchases").expect(403);
    await request(app).get("/api/meal-purchases?participantId=8").expect(403);
    await request(app).post("/api/purchases").send({}).expect(401);
    expect(getPurchases).toHaveBeenCalledOnce();
    expect(getPurchases).toHaveBeenCalledWith(7);
    expect(getMealPurchases).toHaveBeenCalledOnce();
    expect(getMealPurchases).toHaveBeenCalledWith(7);
  });

  it("limite les autorisations d’un compte zombie à son rôle", async () => {
    const app = await appWithSession({ user: { id: 1, username: "test-accueil", roles: ["staff_zombie"] } });
    await request(app).get("/api/purchases").expect(403);
    await request(app).post("/api/meal-purchases").send({}).expect(403);
  });
});
