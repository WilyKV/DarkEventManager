export const cardsPath = "/api/participant-cards";
export const souvenirPath = "/souvenir";
export const photoMaxBytes = 64_000;

export type PrintableCard = {
  id: number;
  firstName: string;
  lastName: string;
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

// Millimetres on the finished card. Keep the personalization positions aligned
// with previously printed stock and with the browser preview.
export const cardLayout = {
  width: 85,
  height: 55,
  nameX: 6,
  nameWidth: 46,
  firstNameY: 18,
  lastNameY: 29,
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
