import Dexie, { type Table } from "dexie";
import type { OfflineSnapshot } from "@shared/zombie-offline";

export type LocalOfflineSession = OfflineSnapshot & {
  preparedAt: string;
  pending: number[];
  conflicts: Record<number, string>;
  /** Confirmed overflow, keyed by participant and tied to the selected squad. */
  capacityOverrides?: Record<number, number>;
};

type LegacySession = Omit<LocalOfflineSession, "profileTypes" | "eventDay" | "participants" | "squads"> & {
  participants: Omit<OfflineSnapshot["participants"][number], "type">[];
  squads: Omit<OfflineSnapshot["squads"][number], "type">[];
};

type Envelope = {
  id: "current";
  revision: string;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
};

const database = new Dexie("darkevent-zombie-offline");
database.version(1).stores({ sessions: "id" });
const sessions: Table<Envelope, "current"> = database.table("sessions");

export async function checkOfflineShell() {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!window.isSecureContext || !registration?.active?.scriptURL.endsWith("/sw.js") ||
    !navigator.serviceWorker.controller || !await caches.match("/index.html", { ignoreSearch: true })) {
    throw new Error("L’application hors ligne n’est pas encore installée. Rechargez cette page en ligne avant de préparer la liste.");
  }
}

export function getOfflineCopy() {
  return sessions.get("current");
}

export async function offlineKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export function readOfflineSession(session: LocalOfflineSession | LegacySession): LocalOfflineSession {
  if ("profileTypes" in session) return session;
  return {
    ...session,
    profileTypes: ["zombie"],
    eventDay: null,
    participants: session.participants.map(player => ({ ...player, type: "zombie" })),
    squads: session.squads.map(team => ({ ...team, type: "zombie" })),
  };
}

export async function openOfflineCopy(copy: Envelope, key: CryptoKey): Promise<LocalOfflineSession> {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: copy.iv }, key, copy.ciphertext);
  return readOfflineSession(JSON.parse(new TextDecoder().decode(plaintext)));
}

export async function storeOfflineCopy(
  data: LocalOfflineSession, key: CryptoKey, salt: Uint8Array, expected: Envelope | undefined,
): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  const next: Envelope = { id: "current", revision: crypto.randomUUID(), salt, iv, ciphertext };
  await database.transaction("rw", sessions, async () => {
    // Avoid overwriting work from another tab or a restored copy.
    const existing = await getOfflineCopy();
    if (existing?.revision !== expected?.revision) throw new Error("La copie a changé dans un autre onglet. Rechargez cette page.");
    await sessions.put(next);
  });
  return next;
}

export async function removeOfflineCopy(expected: Envelope) {
  await database.transaction("rw", sessions, async () => {
    if ((await getOfflineCopy())?.revision !== expected.revision) {
      throw new Error("La copie a changé dans un autre onglet. Rechargez cette page.");
    }
    await sessions.delete("current");
  });
}
