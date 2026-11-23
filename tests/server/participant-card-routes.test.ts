import express from "express";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cardsPath, souvenirExpiry } from "@shared/participant-card";

const { readCard } = vi.hoisted(() => ({ readCard: vi.fn() }));
vi.mock("../../server/db", () => ({
  db: { select: () => ({ from: () => ({ where: readCard }) }) },
}));

import { registerParticipantCardRoutes } from "../../server/participant-card-routes";

const token = "A".repeat(27);
const code = "ABCD234567";
const view = `${cardsPath}/view/${token}`;
const open = `${cardsPath}/open/${token}`;

function makeApp(role?: string) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "local-test-session-only", resave: false, saveUninitialized: false }));
  if (role) app.use((req, _res, next) => {
    req.session.user = { id: 1, username: "test", roles: [role] };
    next();
  });
  registerParticipantCardRoutes(app);
  return app;
}

describe("Espace souvenir", () => {
  beforeEach(() => {
    readCard.mockReset().mockResolvedValue([{
      participantId: 12, token, code, expiresAt: new Date(Date.now() + 86_400_000),
      summary: { firstName: "Clara", lastName: "Martin", type: "zombie", wave: "Vague 2", squad: 4, eventDay: null },
      photo: "/9j/2Q==",
    }]);
  });

  it("protège le récapitulatif et la photo par le code du verso", async () => {
    const agent = request.agent(makeApp());
    expect((await agent.get(view)).status).toBe(401);
    expect((await agent.get(`${view}/photo`)).status).toBe(401);
    expect((await agent.post(open).send({ code: "ZZZZZ45678" })).status).toBe(401);
    expect((await agent.post(open).send({ code: "abcd2 34567" })).status).toBe(204);

    const recap = await agent.get(view);
    expect(recap.status).toBe(200);
    expect(recap.headers["cache-control"]).toContain("no-store");
    expect(recap.body).toMatchObject({ firstName: "Clara", wave: "Vague 2", squad: 4, photoAvailable: true });
    expect(recap.body).not.toHaveProperty("code");
    expect(recap.body).not.toHaveProperty("photo");
    expect((await agent.get(`${view}/photo`)).headers["content-type"]).toMatch(/^image\/jpeg/);
    expect((await agent.get(`${cardsPath}/view/${"B".repeat(27)}`)).status).toBe(401);
    expect((await agent.delete(open)).status).toBe(204);
    expect((await agent.get(view)).status).toBe(401);
  });

  it.each(["abcd234567", "ABCD2 34567", " a B c D 2\u00a034567 ", "AbCd2-34567"])(
    "accepte la saisie du code avec les variantes de casse et d’espacement (%s)",
    async input => {
      expect((await request(makeApp()).post(open).send({ code: input })).status).toBe(204);
    },
  );

  it("réserve l’aperçu et sa photo aux administrateurs", async () => {
    for (const path of [`${cardsPath}/admin/12`, `${cardsPath}/admin/12/photo`]) {
      expect((await request(makeApp()).get(path)).status).toBe(401);
      expect((await request(makeApp("staff_zombie")).get(path)).status).toBe(403);
    }
    const agent = request.agent(makeApp());
    expect((await agent.post(open).send({ code })).status).toBe(204);
    expect((await agent.get(`${cardsPath}/admin/12`)).status).toBe(401);
    expect((await request(makeApp("admin")).get(`${cardsPath}/admin/invalide`)).status).toBe(404);
  });

  it("refuse une carte expirée même après ouverture de la session", async () => {
    const agent = request.agent(makeApp());
    expect((await agent.post(open).send({ code })).status).toBe(204);
    readCard.mockResolvedValue([{ token, code, expiresAt: new Date(0) }]);
    expect((await agent.get(view)).status).toBe(410);
    expect((await agent.get(`${view}/photo`)).status).toBe(410);
    expect((await agent.post(open).send({ code })).status).toBe(410);
  });

  it("ajoute trois mois calendaires, y compris en fin de mois", () => {
    expect(souvenirExpiry(new Date("2027-01-31T22:15:00Z")).toISOString()).toBe("2027-04-30T22:15:00.000Z");
    expect(souvenirExpiry(new Date("2027-11-29T22:15:00Z")).toISOString()).toBe("2028-02-29T22:15:00.000Z");
  });
});
