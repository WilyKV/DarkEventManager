import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerEventBackupRoutes } from "../../server/event-backup-routes";
import { eventBackupPath } from "../../shared/event-backup";

const repository = vi.hoisted(() => ({
  read: vi.fn(),
  inspect: vi.fn(),
  restore: vi.fn(),
}));

vi.mock("../../server/event-backup-data", () => ({
  readEventBackup: repository.read,
  inspectEventBackup: repository.inspect,
  restoreEventBackup: repository.restore,
  InvalidEventBackup: class extends Error {},
}));

const passphrase = "phrase de sauvegarde de recette";
const payload = {
  version: 1,
  createdAt: "2026-11-21T12:30:00.000Z",
  tables: { users: { rows: '[{"password_hash":"hash-test-privé"}]', count: 1, nextId: 2 } },
};
const summary = {
  createdAt: payload.createdAt, eventDay: "2026-11-21", participants: 5, squads: 2, timeSlots: 3, users: 1,
};

function makeApp(role: string) {
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    Object.assign(req, { session: { user: { roles: [role] }, destroy: (done: () => void) => done() } });
    next();
  });
  registerEventBackupRoutes(app);
  return app;
}

function upload(app: ReturnType<typeof makeApp>, action: "verify" | "restore", bytes: Buffer, phrase = passphrase) {
  return request(app).post(`${eventBackupPath}/${action}`)
    .field("passphrase", phrase)
    .attach("file", bytes, "recette.darkevent");
}

describe("Sauvegarde chiffrée", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.read.mockResolvedValue(payload);
    repository.inspect.mockImplementation(backup => ({ backup, summary }));
    repository.restore.mockResolvedValue(undefined);
  });

  it("chiffre les données et refuse de restaurer un fichier altéré ou une phrase incorrecte", async () => {
    const app = makeApp("admin");
    const exported = await request(app).post(`${eventBackupPath}/export`).send({ passphrase }).expect(200);
    const bytes = exported.body as Buffer;
    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes.includes(Buffer.from("hash-test-privé"))).toBe(false);
    expect(exported.headers["content-disposition"]).toContain(".darkevent");
    expect(exported.headers["cache-control"]).toBe("no-store");

    await upload(app, "verify", bytes).expect(200, summary);
    expect(repository.inspect).toHaveBeenCalledWith(payload);
    await upload(app, "restore", bytes, "autre phrase valide en longueur").expect(400);
    const altered = Buffer.from(bytes);
    altered[altered.length - 1] ^= 1;
    await upload(app, "restore", altered).expect(400);
    expect(repository.restore).not.toHaveBeenCalled();

    await upload(app, "restore", bytes).expect(200, summary);
    expect(repository.restore).toHaveBeenCalledExactlyOnceWith(payload);
  });

  it("réserve l’export et la restauration aux administrateurs", async () => {
    const app = makeApp("staff_zombie");
    await request(app).post(`${eventBackupPath}/export`).send({ passphrase }).expect(403);
    await upload(app, "restore", Buffer.from("contenu")).expect(403);
    expect(repository.read).not.toHaveBeenCalled();
    expect(repository.restore).not.toHaveBeenCalled();
  });
});
