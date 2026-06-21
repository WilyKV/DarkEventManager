import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Package, TrendingUp } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ManagementLayout } from "@/components/management-layout";

interface DashboardStats {
  participants: {
    total: number;
    zombies: number;
    survivors: number;
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

export default function DashboardPage() {

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 5000,
  });

  if (isLoading || !stats) {
    return (
      <ManagementLayout
        title="Tableau de bord"
        subtitle="Statistiques en temps réel"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </ManagementLayout>
    );
  }

  const participantTypeData = [
    { name: "Zombies", value: stats.participants.zombies, color: "hsl(var(--primary))" },
    { name: "Survivants", value: stats.participants.survivors, color: "hsl(var(--chart-3))" },
  ];

  const arrivalData = [
    { name: "Arrivés", value: stats.participants.arrived, color: "hsl(var(--chart-1))" },
    { name: "En attente", value: stats.participants.pending, color: "hsl(var(--chart-2))" },
  ];

  const squadData = stats.squads.map((squad) => ({
    name: squad.name,
    Membres: squad.currentMembers,
    Maximum: squad.maxMembers,
    fill: squad.type === "zombie" ? "hsl(var(--primary))" : "hsl(var(--chart-3))",
  }));

  const lowStockShop = stats.stock.shopItems.filter(item => item.stock < 10);
  const lowStockMeals = stats.stock.mealItems.filter(item => item.stock < 10);

  return (
    <ManagementLayout
      title="Tableau de bord"
      subtitle="Statistiques en temps réel"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card
            data-testid="card-total-participants"
            className="relative overflow-hidden border-l-4 border-l-primary bg-gradient-to-br from-primary/5 via-background to-background"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary">Total Participants</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
                <Users className="h-5 w-5 text-primary relative" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                {stats.participants.total}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-red-500 font-semibold">{stats.participants.zombies} zombies</span>, <span className="text-blue-500 font-semibold">{stats.participants.survivors} survivants</span>
              </p>
            </CardContent>
          </Card>

          <Card
            data-testid="card-arrival-rate"
            className="relative overflow-hidden border-l-4 border-l-green-500 bg-gradient-to-br from-green-500/5 via-background to-background"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-600">Taux d'arrivée</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 blur-lg rounded-full" />
                <TrendingUp className="h-5 w-5 text-green-500 relative" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-br from-green-600 to-green-500 bg-clip-text text-transparent">
                {stats.participants.arrivalRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.participants.arrived} / {stats.participants.total} arrivés
              </p>
            </CardContent>
          </Card>

          <Card
            data-testid="card-checklist-completion"
            className="relative overflow-hidden border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-500/5 via-background to-background"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Checklist Complète</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full" />
                <CheckCircle className="h-5 w-5 text-blue-500 relative" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-blue-500 bg-clip-text text-transparent">
                {stats.checklist.completionRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.checklist.totalCompleted} / {stats.checklist.totalParticipants} terminés
              </p>
            </CardContent>
          </Card>

          <Card
            data-testid="card-low-stock-alerts"
            className="relative overflow-hidden border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-500/5 via-background to-background"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-600">Alertes Stock</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500/20 blur-lg rounded-full" />
                <Package className="h-5 w-5 text-orange-500 relative" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-br from-orange-600 to-orange-500 bg-clip-text text-transparent">
                {lowStockShop.length + lowStockMeals.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Articles à faible stock</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Participant Type Distribution */}
          <Card
            data-testid="card-participant-distribution"
            className="relative overflow-hidden bg-gradient-to-br from-red-500/5 via-blue-500/5 to-background border-t-4 border-t-primary"
          >
            <CardHeader>
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-red-500 to-blue-500 bg-clip-text text-transparent">
                Répartition des participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={participantTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {participantTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Arrival Status */}
          <Card
            data-testid="card-arrival-status"
            className="relative overflow-hidden bg-gradient-to-br from-green-500/5 via-yellow-500/5 to-background border-t-4 border-t-green-500"
          >
            <CardHeader>
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-green-600 to-yellow-600 bg-clip-text text-transparent">
                État d'arrivée
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={arrivalData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {arrivalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Squad Distribution */}
        <Card
          className="mb-8 relative overflow-hidden bg-gradient-to-br from-purple-500/5 via-background to-background border-t-4 border-t-purple-500"
          data-testid="card-squad-distribution"
        >
          <CardHeader>
            <CardTitle className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Répartition des squads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={squadData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Membres" fill="hsl(var(--primary))" />
                <Bar dataKey="Maximum" fill="hsl(var(--muted))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        {(lowStockShop.length > 0 || lowStockMeals.length > 0) && (
          <Card
            data-testid="card-low-stock-items"
            className="relative overflow-hidden bg-gradient-to-br from-orange-500/5 via-background to-background border-t-4 border-t-orange-500"
          >
            <CardHeader>
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                ⚠️ Alertes de stock faible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockShop.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm text-orange-600">Boutique</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {lowStockShop.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg hover:border-orange-500/40 transition-colors"
                        >
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="text-sm font-bold text-orange-600 bg-orange-100 dark:bg-orange-950 px-2 py-1 rounded">
                            Stock: {item.stock}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lowStockMeals.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm text-orange-600">Repas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {lowStockMeals.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg hover:border-orange-500/40 transition-colors"
                        >
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="text-sm font-bold text-orange-600 bg-orange-100 dark:bg-orange-950 px-2 py-1 rounded">
                            Stock: {item.stock}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ManagementLayout>
  );
}
