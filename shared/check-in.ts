import { z } from "zod";
import { zombieChecklist, zombieChecklistSchema } from "./zombie-offline";

export const checkInPath = "/api/check-in";
export const checkInRosterPath = `${checkInPath}/roster`;
export const checkInTypes = ["zombie", "survivant", "staff"] as const;
export type CheckInType = typeof checkInTypes[number];
export type ChecklistItem = keyof typeof zombieChecklist;

export const checkInProfiles = {
  zombie: {
    label: "Zombie",
    checklist: ["squadExplained", "briefingExplained", "mealTicketGiven", "waterBottleGiven", "makeupWaitExplained", "mapGiven"],
  },
  survivant: {
    label: "Survivant",
    checklist: ["squadExplained", "briefingExplained", "mapGiven"],
  },
  staff: { label: "Staff", checklist: [] },
} satisfies Record<CheckInType, { label: string; checklist: ChecklistItem[] }>;

export function isCheckInType(type: string): type is CheckInType {
  return (checkInTypes as readonly string[]).includes(type);
}

export const checkInRoles = ["admin", "staff_zombie", "staff_survivant"];

export const checkInDetailsSchema = z.object({
  squadId: z.number().int().positive().nullable(),
  checklist: zombieChecklistSchema.partial(),
}).strict();

export type CheckInDetails = z.infer<typeof checkInDetailsSchema>;

export type CheckInPlayer = {
  id: number;
  firstName: string;
  lastName: string;
  type: CheckInType;
  timeSlotId: number | null;
  arrived: boolean;
  returned: boolean;
  details: CheckInDetails;
  revision: string;
};

export type CheckInRoster = {
  players: CheckInPlayer[];
  slots: { id: number; name: string; briefingTime: string; gameTime: string }[];
  teams: { id: number; number: number; timeSlotId: number; maxMembers: number | null; members: number }[];
};

export function checkInChecklistComplete(type: CheckInType, details: CheckInDetails) {
  const required = checkInProfiles[type].checklist.filter(key => key !== "mapGiven");
  return required.length > 0 && required.every(key => details.checklist[key]);
}
