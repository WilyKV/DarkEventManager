import { expect, it } from "vitest";
import { makeupEstimates } from "@shared/makeup";

it("échelonne au rythme de six minutes quand la vague offre dix minutes par Zombie", () => {
  const time = "2026-11-21T17:00:00Z"; // 18 h à Paris.
  const wave = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, arrivedAt: index < 2 ? time : null }));
  const estimates = makeupEstimates(wave, "19:00");
  expect(estimates.get(1)).toBe(Date.parse(time));
  expect(estimates.get(2)).toBe(Date.parse("2026-11-21T17:06:00Z"));
  expect(makeupEstimates(wave, "19:00", 2).get(2)).toBe(Date.parse("2026-11-21T17:12:00Z"));
  expect(estimates.has(3)).toBe(false);
});

it("ne propose pas un rendez-vous avant l’arrivée d’un joueur", () => {
  const estimates = makeupEstimates([
    { id: 1, arrivedAt: "2026-11-21T17:00:00Z" },
    { id: 2, arrivedAt: "2026-11-21T17:45:00Z" },
  ], "19:00");
  expect(estimates.get(2)).toBe(Date.parse("2026-11-21T17:45:00Z"));
});

it("donne l’heure d’arrivée quand il ne reste plus de créneau avant le briefing", () => {
  const arrivedAt = "2026-11-21T18:20:00Z";
  expect(makeupEstimates([{ id: 1, arrivedAt }], " 19:00:00 ").get(1)).toBe(Date.parse(arrivedAt));
});
