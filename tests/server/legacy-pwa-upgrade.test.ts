import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const script = readFileSync(new URL("../../client/public/legacy-pwa-upgrade.js", import.meta.url), "utf8");

function install(active: boolean, cachedManifest?: object) {
  const addEventListener = vi.fn();
  const skipWaiting = vi.fn();
  const match = vi.fn(async () => cachedManifest && { json: async () => cachedManifest });
  runInNewContext(script, {
    URL,
    self: { registration: { active, scope: "https://example.test/" }, addEventListener, skipWaiting },
    caches: { match },
  });
  const waitUntil = vi.fn();
  addEventListener.mock.calls[0][1]({ waitUntil });
  return { waited: waitUntil.mock.calls[0]?.[0], skipWaiting, match };
}

describe("Migration de la PWA installée", () => {
  it("active la mise à jour pour l’ancien manifeste sans identifiant", async () => {
    const { waited, skipWaiting, match } = install(true, { display: "standalone" });
    await waited;
    expect(match).toHaveBeenCalledWith(new URL("https://example.test/manifest.webmanifest"), { ignoreSearch: true });
    expect(skipWaiting).toHaveBeenCalledOnce();
  });

  it("laisse le service worker en attente pour le manifeste actuel", async () => {
    const { waited, skipWaiting } = install(true, { display: "standalone", id: "/" });
    await waited;
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it("ne force pas l’activation en l’absence de preuve d’une version ancienne", async () => {
    const { waited, skipWaiting } = install(true);
    await waited;
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it("ne cherche pas de manifeste pendant la première installation", () => {
    const { waited, match } = install(false);
    expect(waited).toBeUndefined();
    expect(match).not.toHaveBeenCalled();
  });
});
