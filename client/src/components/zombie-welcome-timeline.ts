export const zombieOverlays = {
  briefing: [69.50, 77.23],
  squad: [81.00, 83.51],
  game: [86.49, 91.27],
} as const;

export const zombieTimeline = [
  { time: 74.37, kind: "briefing" },
  { time: 83.22, kind: "squad" },
  { time: 85.95, kind: "quizBriefing" },
  { time: 90.98, kind: "game" },
  { time: 94.92, kind: "quizSquad" },
] as const;

export function normalizeWelcomeTime(value?: string) {
  const match = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(value?.trim() ?? "");
  if (!match || Number(match[1]) > 23) return undefined;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function displayWelcomeTime(value: string) {
  const [hours, minutes] = value.split(":");
  return `${Number(hours)} h ${minutes}`;
}

export function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function briefingChoices(correct: string, otherTimes: readonly string[]) {
  const [hours, minutes] = correct.split(":").map(Number);
  const time = hours * 60 + minutes;
  const pool = shuffle(Array.from(new Set(otherTimes)).filter(value => value !== correct));
  const offsets = shuffle([-90, -75, -60, -45, -30, -15, 15, 30, 45, 60, 75, 90]);
  for (const offset of offsets) {
    const candidate = time + offset;
    if (candidate < 0 || candidate >= 1440) continue;
    const label = `${String(Math.floor(candidate / 60)).padStart(2, "0")}:${String(candidate % 60).padStart(2, "0")}`;
    if (!pool.includes(label)) pool.push(label);
  }
  return shuffle([correct, ...pool.slice(0, 3)]);
}

export function squadChoices(correct: number, count: number) {
  // Small events still need four choices. Use the reference player's minimum of four.
  const pool = Array.from({ length: Math.max(4, count) }, (_, index) => index + 1).filter(value => value !== correct);
  return shuffle([correct, ...shuffle(pool).slice(0, 3)]).map(String);
}
