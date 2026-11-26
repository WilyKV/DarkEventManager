import { z } from "zod";

export const welcomeTabletPage = "/ecran-accueil";
export const zombieVideoAssets = [
  "/accueil-zombies/zombies_video_principale_1080p.mp4",
  "/accueil-zombies/voix_quiz.m4a",
] as const;

const hour = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const id = z.string().uuid();
const presentation = z.object({
  briefing: hour,
  start: hour,
  end: hour,
  squad: z.number().int().positive().max(2_147_483_647),
  otherTimes: z.array(hour).max(8),
  squadCount: z.number().int().min(1).max(10_000),
});

const transfer = presentation.extend({ kind: z.literal("zombin-tablet-v1"), id });
const receipt = z.object({ kind: z.literal("zombin-tablet-done-v1"), id });

export type TabletPresentation = z.infer<typeof presentation>;
export type TabletTransfer = z.infer<typeof transfer>;

export function makeTabletTransfer(data: TabletPresentation): TabletTransfer {
  return transfer.parse({ ...data, kind: "zombin-tablet-v1", id: crypto.randomUUID() });
}

export function makeTabletReceipt(transfer: TabletTransfer) {
  return JSON.stringify(receipt.parse({ kind: "zombin-tablet-done-v1", id: transfer.id }));
}

export function readTabletQr(value: string) {
  if (value.length > 700) return;
  try {
    const parsed = z.discriminatedUnion("kind", [transfer, receipt]).safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // The camera can also see QR codes unrelated to this presentation.
  }
}
