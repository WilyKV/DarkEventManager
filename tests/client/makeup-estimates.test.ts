import { expect, it } from "vitest";
import { makeupEstimates } from "@shared/makeup";

const minute = 60_000;

it("attribue le même créneau aux quatre premières arrivées, même à des heures différentes", () => {
  const first = Date.parse("2026-11-21T17:00:00Z"); // 18 h à Paris.
  const wave = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    arrivedAt: index < 5 ? new Date(first + index * minute).toISOString() : null,
  })).reverse();
  const estimates = makeupEstimates(wave, "19:00");
  expect(Array.from(estimates.values())).toEqual([first, first, first, first, first + 6 * minute]);
  expect(estimates.has(6)).toBe(false);

  const withTwoArtists = makeupEstimates(wave, "19:00", 2);
  expect(Array.from(withTwoArtists.values())).toEqual([
    first, first, first + 6 * minute, first + 6 * minute, first + 12 * minute,
  ]);
});

it("décale un nouveau créneau si son premier participant arrive après l’heure prévue", () => {
  const first = "2026-11-21T17:00:00Z";
  const late = "2026-11-21T17:45:00Z";
  const estimates = makeupEstimates([
    ...Array.from({ length: 4 }, (_, index) => ({ id: index + 1, arrivedAt: first })),
    { id: 5, arrivedAt: late },
  ], "19:00");
  expect(estimates.get(5)).toBe(Date.parse(late));
});

it("conserve des créneaux de six minutes après le briefing", () => {
  const arrivedAt = "2026-11-21T18:20:00Z";
  const wave = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, arrivedAt }));
  const first = Date.parse(arrivedAt);
  expect(Array.from(makeupEstimates(wave, " 19:00:00 ").values())).toEqual(
    wave.map((_, index) => first + Math.floor(index / 4) * 6 * minute),
  );
  expect(makeupEstimates(wave, "19:00", 8).get(8)).toBe(first);
  expect(makeupEstimates(wave, "19:00", 8).get(9)).toBe(first + 6 * minute);
});

it("garde une minute entre les créneaux très serrés", () => {
  const arrivedAt = "2026-11-21T17:59:00Z";
  const wave = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, arrivedAt }));
  expect(makeupEstimates(wave, "19:00").get(7)).toBe(Date.parse(arrivedAt) + minute);
});
