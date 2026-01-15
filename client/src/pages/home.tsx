import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skull, Users, ShoppingBag, Utensils, BarChart3, IdCard, Settings, UserCog, LogOut, Bluetooth } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { user, hasRole, logout } = useAuth();
  const isAdmin = hasRole('admin');

  // Debug: vérifier la structure de l'utilisateur
  console.log('User object:', user);
  console.log('Has admin role:', hasRole('admin'));

  const cards = [
    {
      title: "Dashboard",
      icon: BarChart3,
      path: "/dashboard",
      description: "Statistiques temps réel",
      gradient: "from-purple-500/20 via-purple-500/10 to-transparent",
      color: "purple-500",
      emoji: "📊",
      roles: ['admin']
    },
    {
      title: "Zombie",
      icon: Skull,
      path: "/zombie",
      description: "Gestion des zombies",
      gradient: "from-red-500/20 via-red-500/10 to-transparent",
      color: "red-500",
      emoji: "🧟",
      roles: ['admin', 'staff_zombie']
    },
    {
      title: "Survivant",
      icon: Users,
      path: "/survivant",
      description: "Gestion des survivants",
      gradient: "from-blue-500/20 via-blue-500/10 to-transparent",
      color: "blue-500",
      emoji: "🎯",
      roles: ['admin', 'staff_survivant']
    },
    {
      title: "Staff",
      icon: UserCog,
      path: "/staff",
      description: "Gestion du staff",
      gradient: "from-green-500/20 via-green-500/10 to-transparent",
      color: "green-500",
      emoji: "👥",
      roles: ['admin']
    },
    {
      title: "Boutique",
      icon: ShoppingBag,
      path: "/boutique",
      description: "Gestion des stocks",
      gradient: "from-green-500/20 via-green-500/10 to-transparent",
      color: "green-500",
      emoji: "🛒",
      roles: ['admin', 'staff_boutique']
    },
    {
      title: "Repas",
      icon: Utensils,
      path: "/repas",
      description: "Gestion des repas",
      gradient: "from-orange-500/20 via-orange-500/10 to-transparent",
      color: "orange-500",
      emoji: "🍔",
      roles: ['admin', 'staff_repas']
    },
    {
      title: "Badges",
      icon: IdCard,
      path: "/badges",
      description: "Impression des badges",
      gradient: "from-pink-500/20 via-pink-500/10 to-transparent",
      color: "pink-500",
      emoji: "🎫",
      roles: ['admin']
    },
    {
      title: "BLE Proximity",
      icon: Bluetooth,
      path: "/ble",
      description: "Gestion BLE et tracking hits",
      gradient: "from-cyan-500/20 via-cyan-500/10 to-transparent",
      color: "cyan-500",
      emoji: "📡",
      roles: ['admin']
    },
    {
      title: "Administration",
      icon: Settings,
      path: "/admin",
      description: "Gestion complète de l'événement",
      gradient: "from-indigo-500/20 via-indigo-500/10 to-transparent",
      color: "indigo-500",
      emoji: "⚙️",
      roles: ['admin']
    },
  ];

  // Filtrer les cartes selon les rôles de l'utilisateur
  const visibleCards = cards.filter(card => {
    if (!card.roles) return true;
    return card.roles.some(role => hasRole(role));
  });

  return (
      <div className="min-h-screen relative">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />

      {/* Top bar with Logout */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
        <Button
          onClick={logout}
          variant="outline"
          size="sm"
          className="gap-2 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Déconnexion</span>
        </Button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 relative">
        {/* Header */}
        <div className="text-center mb-16 pt-8">
          <div className="flex justify-center mb-4">
            <img 
              src="https://zombinthedark.fr/wp-content/uploads/2020/11/Logo_ZITD_plat_blanc-1-300x105.png" 
              alt="Zomb'in The Dark Logo" 
              className="w-[300px] h-auto"
            />
          </div>
          <p className="text-xl text-muted-foreground font-light">Système de gestion d'événement</p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleCards.map((card) => {
            const Icon = card.icon;
            const colorMap: Record<string, string> = {
              'purple-500': '#a855f7',
              'red-500': '#ef4444',
              'blue-500': '#3b82f6',
              'green-500': '#22c55e',
              'orange-500': '#f97316',
              'pink-500': '#ec4899',
              'cyan-500': '#06b6d4',
              'indigo-500': '#6366f1',
            };
            return (
              <Link key={card.path} href={card.path}>
                <Card
                  className="group relative overflow-hidden cursor-pointer border border-border/50 bg-card shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                  data-testid={`card-${card.title.toLowerCase()}`}
                  style={{
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  }}
                >
                  {/* Top accent bar - always visible, brightens on hover */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-1.5"
                    style={{
                      background: `linear-gradient(90deg, ${colorMap[card.color]}, ${colorMap[card.color]}dd)`
                    }}
                  />

                  {/* Subtle gradient overlay on hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${colorMap[card.color]}08 0%, transparent 50%)`
                    }}
                  />

                  <div className="relative h-full flex items-start p-6 gap-4">
                    {/* Icon with 3D effect */}
                    <div
                      className="flex-shrink-0 p-3.5 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                      style={{
                        backgroundColor: `${colorMap[card.color]}18`,
                        border: `1.5px solid ${colorMap[card.color]}40`,
                        boxShadow: `0 4px 12px ${colorMap[card.color]}20, inset 0 1px 0 ${colorMap[card.color]}30`
                      }}
                    >
                      <Icon
                        className="w-7 h-7 transition-all duration-300 group-hover:scale-110"
                        style={{ color: colorMap[card.color] }}
                      />
                    </div>

                    {/* Text content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <h2
                        className="text-xl font-bold mb-2.5 transition-all duration-300 group-hover:translate-x-1"
                        style={{
                          color: colorMap[card.color]
                        }}
                      >
                        {card.title}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {card.description}
                      </p>
                    </div>

                    {/* Arrow with glow effect */}
                    <div
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1 self-center"
                    >
                      <div
                        className="p-1.5 rounded-full"
                        style={{
                          backgroundColor: `${colorMap[card.color]}15`,
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          style={{ color: colorMap[card.color] }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
