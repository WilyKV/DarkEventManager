export const makeupSettingsPath = "/api/check-in/makeup-settings";
export const defaultMakeupArtists = 4;

const minute = 60_000;
const parisClock = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function makeupEstimates(
  wave: readonly { id: number; arrivedAt?: string | null }[],
  briefing: string | undefined,
  artists = defaultMakeupArtists,
) {
  const estimates = new Map<number, number>();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(briefing?.trim() ?? "");
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || !wave.length || artists < 1) return estimates;
  const arrivals = wave.flatMap(player => {
    const time = player.arrivedAt ? Date.parse(player.arrivedAt) : NaN;
    return Number.isFinite(time) ? [{ id: player.id, time }] : [];
  }).sort((a, b) => a.time - b.time || a.id - b.id);
  if (!arrivals.length) return estimates;

  const first = arrivals[0].time;
  const parts = parisClock.formatToParts(first);
  const hours = Number(parts.find(part => part.type === "hour")?.value);
  const minutes = Number(parts.find(part => part.type === "minute")?.value);
  const seconds = (first % minute) / minute;
  const rawWindow = Number(match[1]) * 60 + Number(match[2]) - (hours * 60 + minutes + seconds);
  const windowMinutes = rawWindow < -12 * 60 ? rawWindow + 24 * 60 : rawWindow;
  // At four artists, use 60% of the nominal interval. With no time left
  // before the briefing, keep an indicative cadence of six minutes.
  const cadence = windowMinutes > 0 ? (windowMinutes / wave.length) * 0.6 : 6;
  // The card displays whole minutes, so consecutive calls must differ by at least one.
  const interval = Math.max(1, cadence * (defaultMakeupArtists / artists)) * minute;
  let previous = first - interval;
  for (const { id, time } of arrivals) {
    previous = Math.max(time, previous + interval);
    estimates.set(id, Math.round(previous));
  }
  return estimates;
}
