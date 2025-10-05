import { Card } from "@/components/ui/card";
import { Skull, Users, ShoppingBag, Utensils, BarChart3 } from "lucide-react";
import { Link } from "wouter";

export default function HomePage() {
  const cards = [
    {
      title: "Dashboard",
      icon: BarChart3,
      path: "/dashboard",
      description: "Statistiques temps réel",
      color: "from-chart-1/20 to-chart-1/5"
    },
    {
      title: "Zombie",
      icon: Skull,
      path: "/zombie",
      description: "Gestion des zombies",
      color: "from-primary/20 to-primary/5"
    },
    {
      title: "Survivant",
      icon: Users,
      path: "/survivant",
      description: "Gestion des survivants",
      color: "from-chart-3/20 to-chart-3/5"
    },
    {
      title: "Boutique",
      icon: ShoppingBag,
      path: "/boutique",
      description: "Gestion des stocks",
      color: "from-chart-2/20 to-chart-2/5"
    },
    {
      title: "Repas",
      icon: Utensils,
      path: "/repas",
      description: "Gestion des repas",
      color: "from-chart-5/20 to-chart-5/5"
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <h1 className="text-5xl md:text-7xl font-display text-primary mb-4 tracking-wider">
            ZOMBINTHEDARK
          </h1>
          <p className="text-xl text-muted-foreground">Système de gestion d'événement</p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.path} href={card.path}>
                <Card 
                  className={`group relative overflow-hidden h-64 md:h-72 cursor-pointer border-2 hover-elevate active-elevate-2 transition-all duration-300`}
                  data-testid={`card-${card.title.toLowerCase()}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-50`} />
                  
                  <div className="relative h-full flex flex-col items-center justify-center p-8 gap-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/30 transition-all duration-300" />
                      <Icon className="w-16 h-16 md:w-20 md:h-20 text-primary relative z-10 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    
                    <div className="text-center">
                      <h2 className="text-2xl md:text-3xl font-display text-foreground mb-2">
                        {card.title}
                      </h2>
                      <p className="text-muted-foreground">{card.description}</p>
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
