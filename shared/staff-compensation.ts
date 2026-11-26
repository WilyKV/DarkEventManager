import { z } from "zod";

export const staffCompensationPath = "/api/staff/compensation";
export const staffCompensationSchema = z.object({
  volunteer: z.boolean().nullable(),
  rateCents: z.int32().nonnegative().nullable(),
}).strict().refine(({ volunteer, rateCents }) => volunteer === false || rateCents === null);

export type StaffCompensation = z.infer<typeof staffCompensationSchema> & { participantId: number };
