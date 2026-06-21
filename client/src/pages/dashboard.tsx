import { ManagementLayout } from "@/components/management-layout";
import { DashboardAnalytics } from "@/components/dashboard-analytics";

export default function DashboardPage() {
  return (
    <ManagementLayout
      title="Tableau de bord"
      subtitle="Statistiques en temps réel"
    >
      <DashboardAnalytics />
    </ManagementLayout>
  );
}
