import { Link, useLocation } from "wouter";
import {
  Skull,
  Users,
  ShoppingBag,
  Utensils,
  QrCode,
  UserCog,
  IdCard,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getSectionColor } from "@/lib/section-colors";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles?: string[];
}

/** Même liste que side-rail sans Accueil ni Dashboard standalone */
const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Zombies",      icon: Skull,           path: "/zombie",    roles: ["admin", "staff_zombie"] },
  { label: "Survivants",   icon: Users,           path: "/survivant", roles: ["admin", "staff_survivant"] },
  { label: "Staff",        icon: UserCog,         path: "/staff",     roles: ["admin"] },
  { label: "Boutique",     icon: ShoppingBag,     path: "/boutique",  roles: ["admin", "staff_boutique"] },
  { label: "Repas",        icon: Utensils,        path: "/repas",     roles: ["admin", "staff_repas"] },
  { label: "Badges",       icon: IdCard,          path: "/badges",    roles: ["admin"] },
  { label: "Analytics",   icon: LayoutDashboard, path: "/dashboard", roles: ["admin"] },
  { label: "Admin",        icon: Settings,        path: "/admin",     roles: ["admin"] },
];

const SCAN_ROLES = ["admin", "staff_zombie", "staff_survivant", "staff_boutique", "staff_repas"];

function useFilteredNavItems(): NavItem[] {
  const { hasRole } = useAuth();
  return ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((r) => hasRole(r));
  });
}

export function BottomNav() {
  const [location] = useLocation();
  const { hasAnyRole } = useAuth();
  const filtered = useFilteredNavItems();
  const canScan = hasAnyRole(SCAN_ROLES);

  // Slot budget: 4 items + 1 FAB = 2 left + FAB + 2 right
  const slots      = filtered.slice(0, 4);
  const leftSlots  = slots.slice(0, 2);
  const rightSlots = slots.slice(2, 4);

  const isActive = (path: string) => location === path;

  const renderSlot = (item: NavItem) => {
    const Icon  = item.icon;
    const active = isActive(item.path);
    const color  = getSectionColor(item.path);

    return (
      <Link key={item.path} href={item.path}>
        <button
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 py-1 rounded-lg transition-all active:scale-95 ${
            active ? "" : "text-muted-foreground hover:text-foreground"
          }`}
          style={active ? { color } : undefined}
        >
          <div
            className="relative p-1.5 rounded-lg transition-colors"
            style={active ? { backgroundColor: `${color}1f` } : undefined}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            {active && (
              <span
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ backgroundColor: color }}
              />
            )}
          </div>
          <span className="text-[10px] font-medium leading-tight">{item.label}</span>
        </button>
      </Link>
    );
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-end h-16">
        {/* Left slots */}
        <div className="flex flex-1 items-center justify-around">
          {leftSlots.map(renderSlot)}
        </div>

        {/* FAB central — Scanner */}
        <div className="flex items-end justify-center px-2 pb-2">
          {canScan ? (
            <Link href="/scan">
              <button
                className={`flex items-center justify-center h-14 w-14 rounded-full shadow-lg -translate-y-3 transition-all active:scale-95 ${
                  isActive("/scan")
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                    : "bg-primary text-primary-foreground hover:brightness-110"
                }`}
              >
                <QrCode size={26} />
              </button>
            </Link>
          ) : (
            <div className="w-14" />
          )}
        </div>

        {/* Right slots */}
        <div className="flex flex-1 items-center justify-around">
          {rightSlots.map(renderSlot)}
          {rightSlots.length < 2 && <div className="w-[44px]" />}
        </div>
      </div>
    </nav>
  );
}
