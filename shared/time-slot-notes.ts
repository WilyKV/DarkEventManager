import { z } from "zod";

export const timeSlotPhases = ["meal", "briefing", "game", "exit"] as const;
export type TimeSlotPhase = typeof timeSlotPhases[number];
export const timeSlotHourFields = {
  meal: "mealTime", briefing: "briefingTime", game: "gameTime", exit: "exitTime",
} as const satisfies Record<TimeSlotPhase, string>;
export const timeSlotNoteMaxLength = 2000;

const note = z.string().trim().max(timeSlotNoteMaxLength, "Le texte doit faire au plus 2 000 caractères.").optional();
export const timeSlotNotesSchema = z.object({
  meal: note,
  briefing: note,
  game: note,
  exit: note,
  other: note,
}).strict();

export type TimeSlotNotes = z.infer<typeof timeSlotNotesSchema>;

export type WelcomeTimeSlot = {
  id: number;
  name: string;
  briefingTime: string;
  gameTime: string;
  mealTime?: string;
  exitTime?: string;
  welcomeNotes?: TimeSlotNotes | null;
};
