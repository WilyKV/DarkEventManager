import { expect, it, vi } from "vitest";
import { demoRecords, participants, squads, timeSlots } from "@shared/schema";
import { loadDemoData } from "../../server/demo-data";

const database = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../../server/db", () => ({ db: database }));
vi.mock("../../server/storage", () => ({
  storage: { generateSecretCode: vi.fn().mockResolvedValue("12345") },
}));

it("charge puis retrouve les 950 fiches de démonstration réparties sur deux vagues", async () => {
  const rows = new Map<unknown, Array<Record<string, unknown> & { id: number }>>();
  database.transaction.mockImplementation(async run => run({
    execute: async () => undefined,
    select: () => ({ from: async (table: unknown) => rows.get(table) ?? [] }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown> | Record<string, unknown>[]) => {
        const previous = rows.get(table) ?? [];
        const inserted = [values].flat().map((value, index) => ({ ...value, id: previous.length + index + 1 }));
        const result = { returning: async () => inserted, onConflictDoNothing: () => result };
        rows.set(table, [...previous, ...inserted]);
        return result;
      },
    }),
  }));

  const expected = { loaded: true, participants: 950 };
  expect(await loadDemoData("volume")).toEqual(expected);
  expect(await loadDemoData("volume")).toEqual(expected);

  const players = rows.get(participants)!;
  const slots = rows.get(timeSlots)!;
  const teams = rows.get(squads)!;
  expect(slots).toHaveLength(6);
  for (const [type, count] of Object.entries({ zombie: 100, survivant: 800, staff: 50 })) {
    const waves = slots.filter(slot => slot.type === type);
    expect(waves).toHaveLength(2);
    for (const wave of waves) {
      expect(players.filter(player => player.type === type && player.timeSlotId === wave.id)).toHaveLength(count / 2);
      const seats = teams.filter(team => team.timeSlotId === wave.id)
        .reduce((total, team) => total + Number(team.maxMembers), 0);
      expect(seats).toBeGreaterThanOrEqual(count / 2);
    }
  }
  expect(new Set(rows.get(demoRecords)!.map(row => row.participantId).filter(Boolean))).toEqual(
    new Set(players.map(player => player.id)),
  );
});
