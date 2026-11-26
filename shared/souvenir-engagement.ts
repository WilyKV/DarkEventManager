import { z } from "zod";

export const playerProfilePath = "/api/player-profile";
export const eventReviewsPath = "/api/event-reviews";
export const reviewInput = z.object({
  halfStars: z.number().int().min(2).max(10),
  comment: z.string().trim().max(2000),
}).strict();
export type EventReview = z.infer<typeof reviewInput>;
export type AdminEventReview = EventReview & { id: number; updatedAt: string; eventDay: string | null };

export const profileKey = z.string().regex(/^[a-f0-9]{64}$/i).transform(value => value.toLowerCase());
export const profileClaimInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), key: profileKey, email: z.email().trim().max(254).nullable() }).strict(),
  z.object({ action: z.literal("link"), key: profileKey }).strict(),
]);
export type PlayerProfile = {
  firstName: string;
  lastName: string;
  email: string | null;
  visits: number;
  lastActivityAt: string;
};

export const keepsakeSections = ["identity", "participation", "photo", "purchases", "review", "event"] as const;
export type KeepsakeSection = typeof keepsakeSections[number];
