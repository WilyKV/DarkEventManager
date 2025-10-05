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
    name: `Squad ${squad.number}`,
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
          <Card data-testid="card-total-participants">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.participants.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.participants.zombies} zombies, {stats.participants.survivors} survivants
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-arrival-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux d'arrivée</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.participants.arrivalRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.participants.arrived} / {stats.participants.total} arrivés
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-checklist-completion">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Checklist Complète</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.checklist.completionRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.checklist.totalCompleted} / {stats.checklist.totalParticipants} terminés
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-low-stock-alerts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertes Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockShop.length + lowStockMeals.length}</div>
              <p className="text-xs text-muted-foreground">Articles à faible stock</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Participant Type Distribution */}
          <Card data-testid="card-participant-distribution">
            <CardHeader>
              <CardTitle>Répartition des participants</CardTitle>
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
          <Card data-testid="card-arrival-status">
            <CardHeader>
              <CardTitle>État d'arrivée</CardTitle>
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
        <Card className="mb-8" data-testid="card-squad-distribution">
          <CardHeader>
            <CardTitle>Répartition des squads</CardTitle>
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
          <Card data-testid="card-low-stock-items">
            <CardHeader>
              <CardTitle>Alertes de stock faible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockShop.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm">Boutique</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {lowStockShop.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-2 bg-muted/50 rounded"
                        >
                          <span className="text-sm">{item.name}</span>
                          <span className="text-sm font-semibold text-chart-2">
                            Stock: {item.stock}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {lowStockMeals.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm">Repas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {lowStockMeals.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-2 bg-muted/50 rounded"
                        >
                          <span className="text-sm">{item.name}</span>
                          <span className="text-sm font-semibold text-chart-2">
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
