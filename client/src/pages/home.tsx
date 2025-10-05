import { Card } from "@/components/ui/card";
import { Skull, Users, ShoppingBag, Utensils, BarChart3, IdCard, QrCode, Settings } from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  const cards = [
    {
      title: "Dashboard",
      icon: BarChart3,
      path: "/dashboard",
      description: "Statistiques temps réel",
      gradient: "from-primary/10 via-primary/5 to-transparent"
    },
    {
      title: "Zombie",
      icon: Skull,
      path: "/zombie",
      description: "Gestion des zombies",
      gradient: "from-chart-2/10 via-chart-2/5 to-transparent"
    },
    {
      title: "Survivant",
      icon: Users,
      path: "/survivant",
      description: "Gestion des survivants",
      gradient: "from-chart-3/10 via-chart-3/5 to-transparent"
    },
    {
      title: "Boutique",
      icon: ShoppingBag,
      path: "/boutique",
      description: "Gestion des stocks",
      gradient: "from-chart-4/10 via-chart-4/5 to-transparent"
    },
    {
      title: "Repas",
      icon: Utensils,
      path: "/repas",
      description: "Gestion des repas",
      gradient: "from-chart-5/10 via-chart-5/5 to-transparent"
    },
    {
      title: "Badges",
      icon: IdCard,
      path: "/badges",
      description: "Impression des badges",
      gradient: "from-primary/10 via-primary/5 to-transparent"
    },
    {
      title: "Scanner",
      icon: QrCode,
      path: "/scan",
      description: "Scanner les badges QR",
      gradient: "from-muted/50 via-muted/20 to-transparent"
    },
        {
      title: "Administration",
      icon: Settings,
      path: "/admin",
      description: "Ajout/modification/import",
      gradient: "from-primary/10 via-primary/5 to-transparent"
    }
  ];

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 relative">
        {/* Header */}
        <div className="text-center mb-16 pt-8">
          <div className="inline-block mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl" />
              <Skull className="w-20 h-20 text-primary relative" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-4">
            Zombinthedark
          </h1>
          <p className="text-xl text-muted-foreground font-light">Système de gestion d'événement</p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.path} href={card.path}>
                <Card
                  className="group relative overflow-hidden h-56 cursor-pointer border border-border/50 hover:border-primary/30 bg-card/50 backdrop-blur-sm hover-elevate active-elevate-2 transition-all duration-300"
                  data-testid={`card-${card.title.toLowerCase()}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                  <div className="relative h-full flex flex-col items-center justify-center p-8 gap-5">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <Icon className="w-14 h-14 text-primary relative z-10 group-hover:scale-110 transition-transform duration-300" />
                    </div>

                    <div className="text-center">
                      <h2 className="text-2xl font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors duration-300">
                        {card.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">{card.description}</p>
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
