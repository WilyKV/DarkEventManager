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
export const souvenirRecoveryPath = `${souvenirPath}/recuperation`;
export const souvenirRecoveryApi = `${cardsPath}/recover`;
export const adminSouvenirPath = "/souvenir/admin";
export const souvenirCodeHint = "Casse, espaces et symboles ignorés";
export function normalizeSouvenirCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
export const photoMaxBytes = 64_000;

export const staffSpecializations = ["zombies", "survivants", "boutique", "repas", "photographe", "modele", "maquillage", "web-design", "general"] as const;
export type StaffSpecialization = typeof staffSpecializations[number];

export const staffSpecializationLabels: Record<StaffSpecialization, string> = {
  zombies: "Zombies",
  survivants: "Survivants",
  boutique: "Boutique",
  repas: "Repas",
  photographe: "Photographe",
  modele: "Modèle",
  maquillage: "Maquilleuse",
  "web-design": "Web designer",
  general: "Général",
};

export const staffAssignmentKinds = [...staffSpecializations, "autre"] as const;
export type StaffAssignmentKind = typeof staffAssignmentKinds[number];
export const staffAssignmentLabels = {
  ...staffSpecializationLabels, zombies: "Gestion des zombies", survivants: "Gestion des survivants",
  boutique: "Gestion de la boutique", repas: "Gestion des repas", autre: "Autre",
} satisfies Record<StaffAssignmentKind, string>;

export function staffCardSpecialization(assignment: StaffAssignmentKind | null | undefined, legacy?: StaffSpecialization | null) {
  if (assignment === "autre") return null;
  return assignment ?? legacy ?? null;
}

export type PrintableCard = {
  id: number;
  firstName: string;
  surnamePrefix: string;
  type: string;
  token: string;
  code: string;
  squad?: number | null;
  briefingTime?: string | null;
  staffSpecialization?: StaffSpecialization | null;
};

export type SouvenirPurchaseLine = {
  category: "boutique" | "repas";
  name: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
  paid: boolean;
};
export type SouvenirPurchases = {
  freeMealClaimed: boolean;
  freeMealIncluded: boolean;
  lines: SouvenirPurchaseLine[];
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
  purchases?: SouvenirPurchases;
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

const briefingField = { key: "briefing", label: "Briefing", x: 5, width: 14 } as const;
const squadField = { key: "squad", label: "Squad", x: 23, width: 11.5 } as const;
const makeupField = { key: "makeup", label: "Maquillage", x: 38.5, width: 14.5 } as const;

export const cardFieldIcons = {
  squad: "M13 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0M4 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 5a3 3 0 0 1 0 6M18 13a4 4 0 0 1 3 4v2",
  makeup: "M10 14l8-10a2 2 0 0 1 3 3l-8 10M10 14a4 4 0 0 0-5 3c0 2-2 4-2 4h5a4 4 0 0 0 5-4z",
  meal: "M4 3v5a3 3 0 0 0 6 0V3M7 3v18M18 21V3c-3 1-4 4-4 8v2h4",
} as const;

export function cardScheduleFields(type: string) {
  if (type === "staff") return [];
  if (type === "survivant") return [briefingField, { ...squadField, label: "Équipe" }];
  return [briefingField, squadField, makeupField];
}

export function cardHasMealBox(type: string) {
  return type !== "survivant";
}

export function cardBriefingTime(briefing: PrintableCard["briefingTime"]) {
  const time = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(briefing?.trim() ?? "");
  return time && Number(time[1]) < 24 ? `${time[1].padStart(2, "0")}:${time[2]}` : "";
}

// Millimetres on the finished card. Keep the personalization positions aligned
// with previously printed stock and with the browser preview.
const namePanelY = 20;
const scheduleY = 32;
const scheduleHeight = 11.5;

export const cardLayout = {
  width: 85,
  height: 55,
  nameX: 6,
  nameWidth: 46,
  nameCenterY: 25,
  namePanelY,
  namePanelHeight: 10,
  staffSpecializationBox: { x: 4.5, y: 32, width: 48.5, height: 9 },
  scheduleY,
  scheduleHeight,
  scheduleSideLabelWidth: 3.5,
  mealBoxSize: 6,
  mealBoxX: 73.5,
  mealBoxY: 44.5,
  qrX: 54,
  qrY: 15,
  qrSize: 26,
  qrLabelY: 12.5,
  codeY: 27,
  linkX: 5,
  linkY: 46,
  linkWidth: 66,
  backNoticeY: 42,
} as const;

export const cardAssets = "card-assets";


export function cardTheme(type: string) {
  if (type === "staff") return { label: "STAFF", accent: "#177b62", dark: "#0b241d", light: "#afefdc", zombie: false, artwork: "staff-card-art.jpg" };
  if (type === "survivant") return { label: "SURVIVANT", accent: "#2563aa", dark: "#101e35", light: "#c5e0ff", zombie: false, artwork: "survivor-card-art.jpg" };
  return { label: "ZOMBIE", accent: "#dc273e", dark: "#360a14", light: "#ffc3cb", zombie: true, artwork: "zombie-card-art.png" };
}


export const cardPrintLayouts = ["a4-calibrated", "a4", "card"] as const;
export type CardPrintLayout = typeof cardPrintLayouts[number];

export const a4CardBleed = { x: 2.5, y: 1.5 } as const;
export const a4CardColumns = 2;
const a4CardGap = { x: 7, y: 4 } as const;
export const cardSheet = { width: 210, height: 297, capacity: 10 } as const;
export const calibratedCardSheet = { ...cardSheet, capacity: 8 } as const;
export const defaultCardPrintLayout: CardPrintLayout = "a4-calibrated";

export function cardPrintFormatLabel(layout: CardPrintLayout) {
  return layout === "a4-calibrated" ? "a4-calibre" : layout === "a4" ? "a4" : "85x55";
}

export function cardSheetOffset(side: "front" | "back", calibrated: boolean) {
  return calibrated && side === "front" ? { x: -1, y: -5 } : { x: 0, y: 0 };
}

export function cardSheetPosition(index: number, side: "front" | "back", calibrated = false) {
  const a4CardRows = (calibrated ? calibratedCardSheet.capacity : cardSheet.capacity) / a4CardColumns;
  const column = index % a4CardColumns;
  const row = Math.floor(index / a4CardColumns);
  const gridWidth = a4CardColumns * cardLayout.width + (a4CardColumns - 1) * a4CardGap.x;
  const gridHeight = a4CardRows * cardLayout.height + (a4CardRows - 1) * a4CardGap.y;
  const frontX = (cardSheet.width - gridWidth) / 2 + column * (cardLayout.width + a4CardGap.x);
  const y = (cardSheet.height - gridHeight) / 2 + row * (cardLayout.height + a4CardGap.y);
  const offset = cardSheetOffset(side, calibrated);
  return {
    x: (side === "front" ? frontX : cardSheet.width - frontX - cardLayout.width) + offset.x,
    y: y + offset.y,
  };
}
