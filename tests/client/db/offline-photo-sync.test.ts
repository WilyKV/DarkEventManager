import { expect, it, vi } from "vitest";
import { sendOfflineChanges } from "@/db/offline-roster-sync";
import type { LocalOfflineSession } from "@/db/zombie-offline";
import { apiRequest } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));

it("attend la confirmation serveur avant de retirer la photo de la copie locale", async () => {
  const photo = "/9j/2Q==";
  const session: LocalOfflineSession = {
    ownerId: 3, preparedAt: "2026-11-21T16:00:00Z", eventDay: null, profileTypes: ["zombie"],
    timeSlots: [], squads: [], conflicts: {}, pending: [], pendingPhotos: { 4: photo },
    participants: [{
      id: 4, type: "zombie", timeSlotId: null, returned: false, firstName: "Clara", lastName: "Martin",
      identity: "a".repeat(64), revision: "b".repeat(64),
      state: { arrived: false, arrivedAt: null, squadId: null, checklist: {
        squadExplained: false, briefingExplained: false, mealTicketGiven: false,
        waterBottleGiven: false, makeupWaitExplained: false, mapGiven: false,
      } },
    }],
  };
  const persist = vi.fn(async (data: LocalOfflineSession) => data);
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Hors connexion"))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));

  await expect(sendOfflineChanges(session, persist, String)).rejects.toThrow("Hors connexion");
  expect(persist).not.toHaveBeenCalled();
  expect(session.pendingPhotos).toEqual({ 4: photo });

  await expect(sendOfflineChanges(session, persist, String)).resolves.toEqual({ sent: 1, remaining: 0 });
  expect(apiRequest).toHaveBeenLastCalledWith("PATCH", "/api/participant-cards/4/photo",
    { ownerId: 3, identity: "a".repeat(64), photo }, expect.any(AbortSignal));
  expect(persist).toHaveBeenCalledWith(expect.objectContaining({ pendingPhotos: {} }));
});
