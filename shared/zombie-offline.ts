import { welcomeChecksSchema, type WelcomeChecklist } from "./welcome-checklist";
import { z } from "zod";
import type { WelcomeTimeSlot } from "./time-slot-notes";
import type { CheckInType } from "./check-in";

export const offlineCheckInPage = "/hors-ligne";
export const legacyOfflineCheckInPage = "/zombie/hors-ligne";
export const offlineCheckInApi = "/api/check-in/offline";

export const zombieChecklist = {
  squadExplained: "Équipe présentée",
  briefingExplained: "Briefing expliqué",
  mealTicketGiven: "Carte participant remise",
  waterBottleGiven: "Bouteille d’eau remise",
  makeupWaitExplained: "Ordre de passage au maquillage expliqué",
  mapGiven: "Carte remise (facultatif)",
} as const;

export const zombieChecklistSchema = z.object({
  squadExplained: z.boolean(),
  briefingExplained: z.boolean(),
  mealTicketGiven: z.boolean(),
  waterBottleGiven: z.boolean(),
  makeupWaitExplained: z.boolean(),
  mapGiven: z.boolean(),
}).strict();

export const checkInStateSchema = z.object({
  arrived: z.boolean(),
  arrivedAt: z.string().datetime().nullable(),
  squadId: z.number().int().positive().nullable(),
  checklist: zombieChecklistSchema,
  welcomeChecks: welcomeChecksSchema.optional(),
}).strict().refine(state => state.arrived || state.arrivedAt === null, {
  message: "L’heure d’arrivée doit correspondre au statut de présence.",
});

export const offlineUpdateSchema = z.object({
  id: z.number().int().positive(),
  identity: z.string().length(64),
  revision: z.string().length(64),
  state: checkInStateSchema,
  allowOverCapacity: z.boolean().optional(),
}).strict();

export const offlineNewPlayerSchema = z.object({
  firstName: z.string().trim().min(1, "Saisissez le prénom.").max(100),
  lastName: z.string().trim().min(1, "Saisissez le nom.").max(100),
  type: z.enum(["zombie", "survivant", "staff"]),
  timeSlotId: z.number().int().positive().nullable(),
}).strict();

export type OfflineNewPlayer = z.infer<typeof offlineNewPlayerSchema>;
export type OfflinePlayerReceipt = Pick<OfflineParticipant, "id" | "identity" | "revision">;

export const emptyOfflineChecklist: OfflineCheckIn["checklist"] = {
  squadExplained: false, briefingExplained: false, mealTicketGiven: false,
  waterBottleGiven: false, makeupWaitExplained: false, mapGiven: false,
};

export type OfflineCheckIn = z.infer<typeof checkInStateSchema>;
type OfflineUpdate = z.infer<typeof offlineUpdateSchema>;
export type OfflineParticipant = OfflineUpdate & {
  type: CheckInType;
  firstName: string;
  lastName: string;
  timeSlotId: number | null;
  returned: boolean;
};
export type OfflineSnapshot = {
  ownerId: number;
  canDeleteParticipants?: boolean;
  profileTypes: CheckInType[];
  eventDay: string | null;
  makeupArtists?: number;
  welcomeChecklist?: WelcomeChecklist;
  participants: OfflineParticipant[];
  timeSlots: (WelcomeTimeSlot & { type?: CheckInType })[];
  squads: { id: number; number: number; timeSlotId: number; type: CheckInType; maxMembers: number | null; briefing?: string | null }[];
};

export type OfflineSyncResult =
  | { id: number; revision: string }
  | { id: number; error: string };

export function normalizePlayerName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}
