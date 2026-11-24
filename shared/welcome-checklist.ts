import { z } from "zod";

export const welcomeChecklistPath = "/api/check-in/welcome-checklist";
export const welcomeChecklistLimit = 20;
const defaultItem = z.enum(["squadExplained", "briefingExplained", "mealTicketGiven", "waterBottleGiven", "makeupWaitExplained", "mapGiven"]);
const customId = z.string().uuid();

export const welcomeChecklistSchema = z.object({
  hidden: z.array(defaultItem).max(6),
  extra: z.array(z.object({
    id: customId,
    title: z.string().trim().min(1).max(100),
    note: z.string().trim().max(500),
  }).strict()).max(welcomeChecklistLimit).refine(items => new Set(items.map(item => item.id)).size === items.length),
}).strict();

export const welcomeChecksSchema = z.record(customId, z.boolean())
  .refine(items => Object.keys(items).length <= welcomeChecklistLimit);

export type WelcomeChecklist = z.infer<typeof welcomeChecklistSchema>;
export const defaultWelcomeChecklist: WelcomeChecklist = { hidden: [], extra: [] };

export function mergeWelcomeChecks(current: Record<string, boolean> | null | undefined, changes: Record<string, boolean> | undefined, settings: WelcomeChecklist) {
  return Object.fromEntries(settings.extra.flatMap(({ id }) => {
    const value = changes?.[id] ?? current?.[id];
    return value === undefined ? [] : [[id, value]];
  }));
}
