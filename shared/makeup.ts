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
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || !wave.length || !Number.isInteger(artists) || artists < 1) return estimates;
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
  // Give each appointment one seat per artist. The next appointment starts
  // after the estimated makeup duration, or when its first participant arrives.
  const cadence = windowMinutes > 0 ? (windowMinutes / wave.length) * 0.6 : 6;
  const interval = Math.max(1, cadence) * minute;
  let slot = first - interval;
  for (const [index, { id, time }] of arrivals.entries()) {
    if (index % artists === 0) slot = Math.max(time, slot + interval);
    estimates.set(id, Math.round(slot));
  }
  return estimates;
}
