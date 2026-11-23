export const cardsPath = "/api/participant-cards";
export const souvenirPath = "/souvenir";
export const photoMaxBytes = 64_000;

export type PrintableCard = {
  id: number;
  firstName: string;
  surnamePrefix: string;
  type: string;
  token: string;
  code: string;
};

export type SouvenirSummary = {
  firstName: string;
  lastName: string;
  type: string;
  wave: string | null;
  squad: number | null;
  squadBriefing?: string | null;
  squadSize?: number | null;
  arrivedAt?: string | null;
  eventDay: string | null;
};

export type ParticipantSouvenir = SouvenirSummary & {
  expiresAt: string | null;
  photoAvailable: boolean;
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
  mealBoxSize: 5.5,
  qrX: 55.5,
  qrY: 13.5,
  qrSize: 23,
  codeY: 27,
} as const;

export const cardAssets = "card-assets";
export const cardArtwork = "zombie-card-art.png";

export function cardTheme(type: string) {
  if (type === "staff") return { label: "STAFF", accent: "#177b62", dark: "#0b241d", light: "#afefdc", zombie: false };
  if (type === "survivant") return { label: "SURVIVANT", accent: "#2563aa", dark: "#101e35", light: "#c5e0ff", zombie: false };
  return { label: "ZOMBIE", accent: "#dc273e", dark: "#360a14", light: "#ffc3cb", zombie: true };
}


export const cardPrintLayouts = ["a4", "card"] as const;
export type CardPrintLayout = typeof cardPrintLayouts[number];

const a4Columns = 2;
export const cardSheet = { width: 210, height: 297, capacity: a4Columns * 5 } as const;

export function cardSheetPosition(index: number, side: "front" | "back") {
  const column = index % a4Columns;
  const row = Math.floor(index / a4Columns);
  const frontX = (cardSheet.width - 2 * cardLayout.width - 4) / 2 + column * (cardLayout.width + 4);
  const y = (cardSheet.height - 5 * cardLayout.height - 8) / 2 + row * (cardLayout.height + 2);
  return { x: side === "front" ? frontX : cardSheet.width - frontX - cardLayout.width, y };
}
