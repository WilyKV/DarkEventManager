import { Link, useLocation } from "wouter";
import {
  Home,
  Skull,
  Users,
  ShoppingBag,
  Utensils,
  QrCode,
  BarChart3,
  UserCog,
  IdCard,
  Settings,
  LogOut,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ConnectionIndicator } from "./connection-indicator";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles?: string[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: Home, path: "/home" },
  { label: "Dashboard", icon: BarChart3, path: "/dashboard", roles: ["admin"] },
  { label: "Zombies", icon: Skull, path: "/zombie", roles: ["admin", "staff_zombie"] },
  { label: "Survivants", icon: Users, path: "/survivant", roles: ["admin", "staff_survivant"] },
  { label: "Staff", icon: UserCog, path: "/staff", roles: ["admin"] },
  { label: "Boutique", icon: ShoppingBag, path: "/boutique", roles: ["admin", "staff_boutique"] },
  { label: "Repas", icon: Utensils, path: "/repas", roles: ["admin", "staff_repas"] },
  { label: "Badges", icon: IdCard, path: "/badges", roles: ["admin"] },
  { label: "Scanner", icon: QrCode, path: "/scan", roles: ["admin", "staff_zombie", "staff_survivant", "staff_boutique", "staff_repas"] },
  { label: "Admin", icon: Settings, path: "/admin", roles: ["admin"] },
  { label: "Utilisateurs", icon: UserCheck, path: "/users", roles: ["admin"] },
];

function useFilteredNavItems(): NavItem[] {
  const { hasRole } = useAuth();
  return ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((r) => hasRole(r));
  });
}

export function SideRail() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const filtered = useFilteredNavItems();

  const isActive = (path: string) => location === path;

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-20 z-40 bg-card border-r border-border overflow-y-auto">
      {/* Logo / App title */}
      <div className="flex flex-col items-center justify-center py-4 px-2 border-b border-border/50 shrink-0 gap-1">
        <div className="text-center">
          <span className="text-primary font-display text-xs font-bold leading-tight block">DARK</span>
          <span className="text-foreground font-display text-xs font-bold leading-tight block">EVENT</span>
        </div>
        <ConnectionIndicator />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center py-3 gap-1 flex-1 px-2">
        {filtered.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} href={item.path}>
              <button
                className={`relative flex flex-col items-center justify-center gap-1 w-full min-h-[60px] px-1 py-2 rounded-xl transition-all duration-150 group ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                title={item.label}
              >
                {/* Active left accent bar */}
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" />
                )}
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium leading-tight text-center line-clamp-2">
                  {item.label}
                </span>
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user + logout */}
      <div className="shrink-0 border-t border-border/50 py-3 px-2 flex flex-col items-center gap-2">
        {user && (
          <div className="text-[9px] text-muted-foreground text-center font-medium truncate w-full">
            {user.username}
          </div>
        )}
        <button
          onClick={logout}
          className="flex flex-col items-center justify-center gap-1 w-full min-h-[52px] px-1 py-2 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
          title="Se déconnecter"
        >
          <LogOut size={18} />
          <span className="text-[9px] font-medium">Quitter</span>
        </button>
      </div>
    </aside>
  );
}
