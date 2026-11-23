import { cardsPath, souvenirPath } from "./participant-card";

export const staffCardPath = `${cardsPath}/staff`;
export const freeMealPath = `${cardsPath}/free-meal`;

export type ScannedCardProfile = {
  id: number;
  type: string;
  firstName: string;
  lastName: string;
  freeMealClaimed: boolean | null;
};

export type CardPresence = "expected" | "present" | "departed";

export type StaffCardScan = {
  participant: ScannedCardProfile;
  presence: CardPresence;
  canManagePresence: boolean;
  canServeMeals: boolean;
  canSell: boolean;
};

export function tokenFromCardQr(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return new RegExp(`^${souvenirPath}/([A-Za-z0-9_-]{27})/?$`).exec(url.pathname)?.[1];
  } catch {
    return undefined;
  }
}
