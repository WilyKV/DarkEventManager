import express, { type RequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoDataPath } from "@shared/demo-data";
import { registerDemoDataRoutes } from "../../server/demo-data-routes";

const service = vi.hoisted(() => ({
  getDemoDataStatus: vi.fn(),
  loadDemoData: vi.fn(),
  removeDemoData: vi.fn(),
}));

vi.mock("../../server/demo-data", () => service);

function createApp(roles?: string[]) {
  const fakeSession: RequestHandler = (req, _res, next) => {
    if (roles) Object.assign(req, { session: { user: { id: 1, username: "test", roles } } });
    next();
  };
  const app = express();
  app.use(fakeSession);
  registerDemoDataRoutes(app);
  return app;
}

describe("Données de test", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(["get", "post", "delete"] as const)("réserve %s à l’administrateur", async method => {
    await request(createApp())[method](demoDataPath).expect(401);
    await request(createApp(["staff_zombie"]))[method](demoDataPath).expect(403);
    expect(service.getDemoDataStatus).not.toHaveBeenCalled();
    expect(service.loadDemoData).not.toHaveBeenCalled();
    expect(service.removeDemoData).not.toHaveBeenCalled();
  });

  it("expose l’état renvoyé après chaque opération", async () => {
    const app = createApp(["admin"]);
    const empty = { loaded: false, participants: 0 };
    const loaded = { loaded: true, participants: 12 };
    service.getDemoDataStatus.mockResolvedValue(empty);
    service.loadDemoData.mockResolvedValue(loaded);
    service.removeDemoData.mockResolvedValue(empty);
    await request(app).get(demoDataPath).expect(200, empty);
    await request(app).post(demoDataPath).expect(200, loaded);
    await request(app).delete(demoDataPath).expect(200, empty);
  });

  it("signale un lien avec une fiche réelle sans exposer les détails PostgreSQL", async () => {
    service.removeDemoData.mockRejectedValue(new Error("Détails internes", {
      cause: Object.assign(new Error("Contrainte"), { code: "23503" }),
    }));
    const { body } = await request(createApp(["admin"])).delete(demoDataPath).expect(409);
    expect(body.message).toContain("Aucune donnée n’a été supprimée");
    expect(body.message).not.toContain("Détails internes");
  });
});
