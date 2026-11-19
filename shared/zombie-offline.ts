import { z } from "zod";

export const zombieChecklist = {
  squadExplained: "Équipe présentée",
  briefingExplained: "Briefing expliqué",
  mealTicketGiven: "Ticket repas remis",
  waterBottleGiven: "Bouteille d’eau remise",
  makeupWaitExplained: "Attente maquillage expliquée",
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
}).strict().refine(state => state.arrived === (state.arrivedAt !== null), {
  message: "L’heure d’arrivée doit correspondre au statut de présence.",
});

export const zombieUpdateSchema = z.object({
  id: z.number().int().positive(),
  identity: z.string().length(64),
  revision: z.string().length(64),
  state: checkInStateSchema,
}).strict();

export type ZombieCheckIn = z.infer<typeof checkInStateSchema>;
export type ZombieUpdate = z.infer<typeof zombieUpdateSchema>;
export type OfflineZombie = ZombieUpdate & {
  firstName: string;
  lastName: string;
  timeSlotId: number | null;
  returned: boolean;
};
export type ZombieSnapshot = {
  ownerId: number;
  participants: OfflineZombie[];
  timeSlots: { id: number; name: string; briefingTime: string; gameTime: string }[];
  squads: { id: number; number: number; timeSlotId: number; maxMembers: number | null }[];
};

export type ZombieSyncResult =
  | { id: number; revision: string }
  | { id: number; error: string };

export function checklistComplete(checklist: ZombieCheckIn["checklist"]): boolean {
  return checklist.squadExplained && checklist.briefingExplained && checklist.mealTicketGiven &&
    checklist.waterBottleGiven && checklist.makeupWaitExplained;
}

export function normalizePlayerName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}
