export const demoDataPath = "/api/admin/demo-data";

export const demoVolumeCounts = { survivant: 800, zombie: 100, staff: 50 } as const;

export type DemoDataPreset = "standard" | "volume";

export interface DemoDataStatus {
  loaded: boolean;
  participants: number;
}
