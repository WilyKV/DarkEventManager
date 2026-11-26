import type { Control } from "react-hook-form";
import { z } from "zod";
import { staffAssignmentKinds, staffAssignmentLabels } from "@shared/participant-card";
import type { TimeSlot } from "@shared/schema";
import { staffAssignmentPhases, staffAssignmentPhaseLabels, timeSlotHourFields, timeSlotNoteMaxLength, timeSlotNotesSchema, timeSlotPhases } from "@shared/time-slot-notes";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const timeSlotDialogClass = "max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.25rem)] max-w-xl overflow-y-auto rounded-xl p-4 sm:p-6";

export const timeSlotFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  staffAssignment: z.enum(staffAssignmentKinds).nullable(),
  mealTime: z.string().min(1, "L’heure du repas est obligatoire"),
  briefingTime: z.string().min(1, "L’heure du briefing est obligatoire"),
  gameTime: z.string().min(1, "L’heure de jeu est obligatoire"),
  exitTime: z.string().min(1, "L’heure de sortie est obligatoire"),
  welcomeNotes: timeSlotNotesSchema,
});

export const staffAssignmentFormSchema = timeSlotFormSchema.extend({
  mealTime: z.string(),
  briefingTime: z.string(),
  gameTime: z.string(),
  exitTime: z.string(),
});

export type TimeSlotFormData = z.infer<typeof timeSlotFormSchema>;

export function timeSlotFormValues(slot?: TimeSlot): TimeSlotFormData {
  return {
    name: slot?.name ?? "",
    staffAssignment: slot?.staffAssignment ?? null,
    mealTime: slot?.mealTime ?? "",
    briefingTime: slot?.briefingTime ?? "",
    gameTime: slot?.gameTime ?? "",
    exitTime: slot?.exitTime ?? "",
    welcomeNotes: { meal: "", briefing: "", game: "", exit: "", other: "", ...slot?.welcomeNotes },
  };
}

const labels = {
  meal: ["Heure du repas", "Précisions sur le repas"],
  briefing: ["Heure du briefing", "Précisions sur le briefing"],
  game: ["Heure de jeu", "Précisions sur le jeu"],
  exit: ["Heure de sortie", "Précisions sur la sortie"],
};

export function TimeSlotFields({ control, staff = false }: { control: Control<TimeSlotFormData>; staff?: boolean }) {
  return (
    <>
      {staff && <FormField control={control} name="staffAssignment" render={({ field }) => (
        <FormItem>
          <FormLabel>Spécialisation sur la carte</FormLabel>
          <FormControl><select value={field.value ?? ""} onChange={event =>
            field.onChange(staffAssignmentKinds.find(kind => kind === event.target.value) ?? null)}
            className="min-h-11 w-full rounded-md border border-input bg-background px-2">
            <option value="">Choisir une spécialisation</option>
            {staffAssignmentKinds.map(kind => <option key={kind} value={kind}>
              {kind === "autre" ? "Autre · case vierge sur la carte" : staffAssignmentLabels[kind]}
            </option>)}
          </select></FormControl>
          <FormMessage />
        </FormItem>
      )} />}
      <FormField control={control} name="name" render={({ field }) => (
        <FormItem>
          <FormLabel>{staff ? "Nom de l’attribution" : "Nom du créneau"}</FormLabel>
          <FormControl><Input placeholder={staff ? "Ex. Accueil et retours Zombies" : "Ex. Vague de 18 h"} {...field} data-testid="input-timeslot-name" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      {(staff ? staffAssignmentPhases : timeSlotPhases).map(phase => (
        <div key={phase} className="space-y-3 rounded-lg border border-border bg-card/60 p-3">
          <FormField control={control} name={timeSlotHourFields[phase]} render={({ field }) => (
            <FormItem>
              <FormLabel>{staff && phase !== "game" ? staffAssignmentPhaseLabels[phase] : labels[phase][0]}</FormLabel>
              <FormControl><Input type="time" {...field} data-testid={`input-${phase}-time`} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={control} name={`welcomeNotes.${phase}`} render={({ field }) => (
            <FormItem>
              <FormLabel>{staff ? "Précisions" : labels[phase][1]}</FormLabel>
              <FormControl><Textarea rows={2} maxLength={timeSlotNoteMaxLength} {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      ))}
      <FormField control={control} name="welcomeNotes.other" render={({ field }) => (
        <FormItem>
          <FormLabel>Autre</FormLabel>
          <FormControl><Textarea rows={2} maxLength={timeSlotNoteMaxLength} {...field} value={field.value ?? ""} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );
}
