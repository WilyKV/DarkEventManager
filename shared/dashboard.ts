export const dashboardReportsPath = "/api/dashboard/reports";

export interface DashboardStats {
  participants: {
    total: number;
    zombies: number;
    survivors: number;
    staff: number;
    arrived: number;
    pending: number;
    arrivalRate: number;
  };
  squads: {
    name: string;
    type: string;
    currentMembers: number;
    maxMembers: number;
  }[];
  checklist: {
    totalCompleted: number;
    totalParticipants: number;
    completionRate: number;
  };
  stock: {
    shopItems: { name: string; stock: number; category: string }[];
    mealItems: { name: string; stock: number; category: string }[];
  };
}

export type DashboardReport = DashboardStats & { startedAt: string | null };
