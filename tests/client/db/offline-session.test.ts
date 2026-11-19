import { expect, it } from "vitest";
import { readOfflineSession } from "@/db/zombie-offline";

it("rouvre une ancienne copie zombie en conservant ses fiches à synchroniser", () => {
  const player = {
    id: 4,
    identity: "identity",
    revision: "revision",
    firstName: "Camille",
    lastName: "Recette",
    timeSlotId: 2,
    returned: false,
    state: {
      arrived: true,
      arrivedAt: "2026-11-21T17:30:00.000Z",
      squadId: 1,
      checklist: { squadExplained: true, briefingExplained: false, mealTicketGiven: false,
        waterBottleGiven: false, makeupWaitExplained: false, mapGiven: false },
    },
  };
  const team = { id: 1, timeSlotId: 2, number: 1, maxMembers: 8 };
  const previous = {
    ownerId: 3,
    preparedAt: "2026-11-21T16:00:00.000Z",
    pending: [4],
    conflicts: { 4: "Fiche à revoir" },
    participants: [player],
    timeSlots: [],
    squads: [team],
  };

  const active = readOfflineSession(previous);
  expect(active).toEqual({
    ...previous,
    profileTypes: ["zombie"],
    eventDay: null,
    participants: [{ ...player, type: "zombie" }],
    squads: [{ ...team, type: "zombie" }],
  });
  expect(readOfflineSession(active)).toBe(active);
});
