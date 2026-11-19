export const eventBackupPath = "/api/admin/backup";
export const eventBackupExtension = ".darkevent";
export const eventBackupPassphraseMin = 12;
export const eventBackupPassphraseMax = 512;
export const eventBackupMaxBytes = 32 * 1024 * 1024;

export type EventBackupSummary = {
  createdAt: string;
  eventDay: string | null;
  participants: number;
  squads: number;
  timeSlots: number;
  users: number;
};
