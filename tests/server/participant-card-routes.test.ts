import { createHash } from "node:crypto";
import { staffCardPath } from "@shared/card-scan";
import { storage } from "../../server/storage";
import express from "express";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cardsPath, souvenirErasureRequestsPath, souvenirExpiry, souvenirSettingsPath } from "@shared/participant-card";

const { readCard, savePhotoWithdrawal } = vi.hoisted(() => ({ readCard: vi.fn(), savePhotoWithdrawal: vi.fn() }));
vi.mock("../../server/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: readCard }) }),
    update: () => ({ set: savePhotoWithdrawal }),
  },
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
      summary: { firstName: "Clara", lastName: "Martin", type: "zombie", wave: "Vague 2", squad: 4, eventDay: null,
        gameStart: "20:00", gameEnd: "22:00", highlights: { zombies: 64, survivors: 80, photoUrl: "https://example.com/album" } },
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
    expect(recap.body).toMatchObject({ firstName: "Clara", wave: "Vague 2", squad: 4, photoAvailable: true, gameStart: "20:00", gameEnd: "22:00", highlights: { zombies: 64, survivors: 80 } });
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

  it("protège les réglages admin et les actions de suppression", async () => {
    const app = makeApp();
    expect((await request(app).get(souvenirSettingsPath)).status).toBe(401);
    expect((await request(app).patch(souvenirSettingsPath)).status).toBe(401);
    expect((await request(app).delete(view)).status).toBe(401);
    expect((await request(app).delete(`${view}/photo`)).status).toBe(401);
    const agent = request.agent(app);
    expect((await agent.post(open).send({ code })).status).toBe(204);
    expect((await agent.delete(`${cardsPath}/view/${"B".repeat(27)}`)).status).toBe(401);
    expect((await agent.delete(`${cardsPath}/view/${"B".repeat(27)}/photo`)).status).toBe(401);
  });

  it("enregistre une demande sans effacer le profil ni fermer sa session", async () => {
    const requestedAt = new Date("2027-01-03T12:00:00Z");
    const agent = request.agent(makeApp());
    expect((await agent.post(open).send({ code })).status).toBe(204);
    readCard.mockResolvedValueOnce([{
      participantId: 12, token, code, expiresAt: new Date(Date.now() + 86_400_000),
      erasureRequestedAt: requestedAt,
      summary: { firstName: "Clara", lastName: "Martin", type: "zombie", wave: null, squad: null, eventDay: null,
        gameStart: null, gameEnd: null, highlights: { zombies: 64, survivors: 80, photoUrl: null } },
    }]);
    savePhotoWithdrawal.mockReturnValueOnce({ where: () => ({ returning: async () => [{ requestedAt }] }) });
    expect((await agent.post(`${view}/erasure-request`)).body).toEqual({ requestedAt: requestedAt.toISOString() });
    expect((await agent.delete(view)).status).toBe(405);
    const recap = await agent.get(view);
    expect(recap.status).toBe(200);
    expect(recap.body.erasureRequestedAt).toBe(requestedAt.toISOString());
    expect((await request(makeApp()).post(`${view}/erasure-request`)).status).toBe(401);
    expect((await request(makeApp("staff_zombie")).get(souvenirErasureRequestsPath)).status).toBe(403);
    expect((await request(makeApp("staff_zombie")).delete(`${souvenirErasureRequestsPath}/3`)).status).toBe(403);
  });

  it("efface la photo authentifiée et mémorise le retrait pour les envois suivants", async () => {
    savePhotoWithdrawal.mockReturnValue({ where: () => ({ returning: async () => [{ id: 3 }] }) });
    const agent = request.agent(makeApp());
    expect((await agent.post(open).send({ code })).status).toBe(204);
    expect((await agent.delete(`${view}/photo`)).status).toBe(204);
    expect(savePhotoWithdrawal).toHaveBeenCalledWith({ photo: null, photoRemovedAt: expect.any(Date) });
  });

  it("reprend la session sur cet appareil uniquement avec l’accord du participant", async () => {
    const agent = request.agent(makeApp());
    expect((await agent.post(open).send({ code })).status).toBe(204);
    expect((await agent.get(view)).status).toBe(200);
    expect((await agent.get(`${view}?resume=1`)).status).toBe(401);
    expect((await agent.post(open).send({ code, remember: true })).status).toBe(204);
    expect((await agent.get(`${view}?resume=1`)).status).toBe(200);
    expect((await agent.delete(open)).status).toBe(204);
    expect((await agent.get(`${view}?resume=1`)).status).toBe(401);
  });

  it("affiche uniquement les actions liées au rôle et au profil scanné", async () => {
    const createdAt = new Date("2026-11-21T10:00:00Z");
    const identity = createHash("sha256").update(JSON.stringify([12, createdAt])).digest("hex");
    readCard.mockResolvedValue([{ participantId: 12, token, identity, expiresAt: null }]);
    const participant = vi.spyOn(storage, "getParticipant").mockResolvedValue({
      id: 12, type: "zombie", firstName: "Clara", lastName: "Martin", createdAt,
      arrived: true, returned: false, secretCode: "SECRET", freeMealClaimed: false,
    } as Awaited<ReturnType<typeof storage.getParticipant>>);
    try {
      const url = `${staffCardPath}/${token}`;
      expect((await request(makeApp()).get(url)).status).toBe(401);
      expect((await request(makeApp("staff_survivant")).get(url)).status).toBe(403);
      const zombie = await request(makeApp("staff_zombie")).get(url);
      expect(zombie.body).toMatchObject({ presence: "present", canManagePresence: true, canServeMeals: false, canSell: false });
      expect(zombie.body.participant).not.toHaveProperty("secretCode");
      expect((await request(makeApp("staff_repas")).get(url)).body).toMatchObject({ canManagePresence: false, canServeMeals: true, canSell: false });
      expect((await request(makeApp("staff_boutique")).get(url)).body).toMatchObject({ canManagePresence: false, canServeMeals: false, canSell: true });
      expect((await request(makeApp("staff_repas")).post(`${url}/presence`).send({ action: "depart" })).status).toBe(403);
    } finally {
      participant.mockRestore();
    }
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
