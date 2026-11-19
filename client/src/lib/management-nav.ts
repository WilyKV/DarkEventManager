import { Home, IdCard, LayoutDashboard, QrCode, Settings, ShoppingBag, Skull, UserCog, Users, Utensils, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const homeItem = { label: "Accueil", icon: Home, path: "/overview", roles: [] };
const zombieRoles = ["admin", "staff_zombie"];
const modules = [
  { label: "Zombies", icon: Skull, path: "/zombie", roles: zombieRoles },
  { label: "Survivants", icon: Users, path: "/survivant", roles: ["admin", "staff_survivant"] },
  { label: "Boutique", icon: ShoppingBag, path: "/boutique", roles: ["admin", "staff_boutique"] },
  { label: "Repas", icon: Utensils, path: "/repas", roles: ["admin", "staff_repas"] },
  { label: "Scanner un badge", icon: QrCode, path: "/scan", roles: ["admin", "staff_zombie", "staff_survivant", "staff_boutique", "staff_repas"] },
  { label: "Hors ligne", icon: WifiOff, path: "/zombie/hors-ligne", roles: zombieRoles },
  { label: "Staff", icon: UserCog, path: "/staff", roles: ["admin"] },
  { label: "Badges", icon: IdCard, path: "/badges", roles: ["admin"] },
  { label: "Statistiques", icon: LayoutDashboard, path: "/dashboard", roles: ["admin"] },
  { label: "Administration", icon: Settings, path: "/admin", roles: ["admin"] },
];

export function useManagementNav() {
  const { hasAnyRole } = useAuth();
  return modules.filter(item => hasAnyRole(item.roles));
}
