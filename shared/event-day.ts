import { z } from "zod";

export const eventDayPath = "/api/event/day";
export const eventDaySchema = z.object({ eventDay: z.iso.date().nullable() }).strict();

export function formatEventDay(day: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: "UTC" })
    .format(new Date(`${day}T12:00:00Z`));
}
