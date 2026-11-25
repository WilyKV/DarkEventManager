export const cardsPath = "/api/participant-cards";
export const souvenirErasureRequestsPath = `${cardsPath}/erasure-requests`;
export const souvenirErasureDeadline = (requestedAt: Date) => new Date(requestedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
export type SouvenirErasureRequest = { id: number; firstName: string; lastName: string; requestedAt: string };

export const souvenirSettingsPath = `${cardsPath}/settings`;
export type SouvenirAttendance = { zombies: number; survivors: number };
export type SouvenirSettings = { zombies: number | null; survivors: number | null; photoUrl: string | null };
export type SouvenirSettingsResponse = SouvenirSettings & { automatic: SouvenirAttendance };
export type SouvenirHighlights = SouvenirAttendance & { photoUrl: string | null };

export const souvenirPath = "/souvenir";
export const adminSouvenirPath = "/souvenir/admin";
export const souvenirCodeHint = "Majuscules, minuscules et espaces acceptés";
export const photoMaxBytes = 64_000;

export type PrintableCard = {
  id: number;
  firstName: string;
  surnamePrefix: string;
  type: string;
  token: string;
  code: string;
  squad?: number | null;
  briefingTime?: string | null;
};

export type SouvenirSummary = {
  firstName: string;
  lastName: string;
  type: string;
  wave: string | null;
  squad: number | null;
  squadBriefing?: string | null;
  gameStart?: string | null;
  gameEnd?: string | null;
  highlights?: SouvenirHighlights;
  squadSize?: number | null;
  arrivedAt?: string | null;
  eventDay: string | null;
};

export type ParticipantSouvenir = SouvenirSummary & {
  expiresAt: string | null;
  photoAvailable: boolean;
  erasureRequestedAt?: string | null;
};

export function souvenirExpiry(closedAt: Date) {
  const expiration = new Date(closedAt);
  const day = expiration.getUTCDate();
  expiration.setUTCDate(1);
  expiration.setUTCMonth(expiration.getUTCMonth() + 3);
  const lastDay = new Date(Date.UTC(expiration.getUTCFullYear(), expiration.getUTCMonth() + 1, 0)).getUTCDate();
  expiration.setUTCDate(Math.min(day, lastDay));
  return expiration;
}

const letters = new RegExp("\\p{L}\\p{M}*", "gu");
const marks = new RegExp("\\p{M}", "gu");
function nameKey(value: string) {
  return value.normalize("NFD").replace(marks, "").toLocaleLowerCase("fr").trim().replace(/\s+/g, " ");
}

export function cardSurnamePrefixes(roster: readonly { id: number; firstName: string; lastName: string }[]) {
  const entries = roster.map(({ id, firstName, lastName }) => {
    const surname = lastName.normalize("NFC").match(letters) ?? [];
    return { id, surname, key: JSON.stringify([nameKey(firstName), nameKey(surname[0] ?? "")]) };
  });
  const counts = new Map<string, number>();
  for (const { key } of entries) counts.set(key, (counts.get(key) ?? 0) + 1);
  return new Map(entries.map(({ id, surname, key }) =>
    [id, surname.slice(0, counts.get(key)! > 1 ? 2 : 1).join("").toLocaleUpperCase("fr")]));
}

export function printedCardName({ firstName, surnamePrefix }: Pick<PrintableCard, "firstName" | "surnamePrefix">) {
  return surnamePrefix ? `${firstName} ${surnamePrefix}.` : firstName;
}

const scheduleFields = [
  { key: "squad", label: "Squad", x: 4.5, width: 19 },
  { key: "briefingTime", label: "Briefing", x: 25.5, width: 24 },
] as const;

export function cardScheduleFields(type: string) {
  return scheduleFields.filter(field => type !== "staff" || field.key !== "briefingTime");
}

export function cardHasMealBox(type: string) {
  return type !== "survivant";
}

export function cardScheduleLabel(field: typeof scheduleFields[number], type: string) {
  return field.key === "squad" && type !== "zombie" ? "Équipe" : field.label;
}

export function cardScheduleValue(card: PrintableCard, field: typeof scheduleFields[number]["key"]) {
  if (field === "squad") return card.squad == null ? "" : `N° ${card.squad}`;
  const time = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(card.briefingTime?.trim() ?? "");
  return time && Number(time[1]) < 24 ? `${time[1].padStart(2, "0")}:${time[2]}` : "";
}

// Millimetres on the finished card. Keep the personalization positions aligned
// with previously printed stock and with the browser preview.
export const cardLayout = {
  width: 85,
  height: 55,
  nameX: 6,
  nameWidth: 46,
  nameCenterY: 25,
  namePanelY: 18.5,
  namePanelHeight: 13,
  scheduleY: 33,
  scheduleHeight: 8,
  mealBoxSize: 5.5,
  makeupBoxY: 43.5,
  makeupBoxHeight: 7,
  qrX: 55.5,
  qrY: 13.5,
  qrSize: 23,
  codeY: 27,
} as const;

export const cardAssets = "card-assets";


export function cardTheme(type: string) {
  if (type === "staff") return { label: "STAFF", accent: "#177b62", dark: "#0b241d", light: "#afefdc", zombie: false, artwork: undefined };
  if (type === "survivant") return { label: "SURVIVANT", accent: "#2563aa", dark: "#101e35", light: "#c5e0ff", zombie: false, artwork: "survivor-card-art.jpg" };
  return { label: "ZOMBIE", accent: "#dc273e", dark: "#360a14", light: "#ffc3cb", zombie: true, artwork: "zombie-card-art.png" };
}


export const cardPrintLayouts = ["a4", "card"] as const;
export type CardPrintLayout = typeof cardPrintLayouts[number];

export const a4CardBleed = 1;
export const a4CardColumns = 2;
const a4CardRows = 5;
export const a4CardGap = 4;
export const cardSheet = { width: 210, height: 297, capacity: a4CardColumns * a4CardRows } as const;

export function cardSheetPosition(index: number, side: "front" | "back") {
  const column = index % a4CardColumns;
  const row = Math.floor(index / a4CardColumns);
  const gridWidth = a4CardColumns * cardLayout.width + (a4CardColumns - 1) * a4CardGap;
  const gridHeight = a4CardRows * cardLayout.height + (a4CardRows - 1) * a4CardGap;
  const frontX = (cardSheet.width - gridWidth) / 2 + column * (cardLayout.width + a4CardGap);
  const y = (cardSheet.height - gridHeight) / 2 + row * (cardLayout.height + a4CardGap);
  return { x: side === "front" ? frontX : cardSheet.width - frontX - cardLayout.width, y };
}
