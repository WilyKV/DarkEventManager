import { z } from "zod";

export const welcomeChecklistPath = "/api/check-in/welcome-checklist";
export const welcomeChecklistLimit = 20;
const defaultItem = z.enum(["squadExplained", "briefingExplained", "mealTicketGiven", "waterBottleGiven", "makeupWaitExplained", "mapGiven"]);
export const welcomeOffers = [
  { id: "ab623085-61d5-4389-bbd9-f27db314bdee", title: "Remettre le manga offert", note: "Un manga sur le thème de l’événement par participant." },
  { id: "8a348076-3d12-48c4-a869-12221e51a9cc", title: "Présenter le produit au charbon actif", note: "Présentez le produit proposé par l’intervenant aux personnes intéressées." },
] as const;

const offerId = z.enum([welcomeOffers[0].id, welcomeOffers[1].id]);
const customId = z.string().uuid();

export const welcomeChecklistSchema = z.object({
  prefilledOffersByWave: z.record(z.string().regex(/^\d+$/), z.array(offerId).max(welcomeOffers.length)).optional(),
  hidden: z.array(defaultItem).max(6),
  extra: z.array(z.object({
    id: customId,
    title: z.string().trim().min(1).max(100),
    note: z.string().trim().max(500),
  }).strict()).max(welcomeChecklistLimit).refine(items => new Set(items.map(item => item.id)).size === items.length),
}).strict();

export const welcomeChecksSchema = z.record(customId, z.boolean())
  .refine(items => Object.keys(items).length <= welcomeChecklistLimit + welcomeOffers.length);

export type WelcomeChecklist = z.infer<typeof welcomeChecklistSchema>;
export const defaultWelcomeChecklist: WelcomeChecklist = { hidden: [], extra: [] };

export function activeWelcomePoints(settings: WelcomeChecklist, waveId?: number) {
  const enabled = waveId === undefined ? [] : settings.prefilledOffersByWave?.[waveId] ?? [];
  return [...settings.extra, ...welcomeOffers.filter(point => enabled.includes(point.id))];
}

export function mergeWelcomeChecks(current: Record<string, boolean> | null | undefined, changes: Record<string, boolean> | undefined, settings: WelcomeChecklist) {
  return Object.fromEntries([...settings.extra, ...welcomeOffers].flatMap(({ id }) => {
    const value = changes?.[id] ?? current?.[id];
    return value === undefined ? [] : [[id, value]];
  }));
}
