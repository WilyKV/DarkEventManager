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
