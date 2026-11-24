import { checkInRoles } from "@shared/check-in";
import { offlineCheckInPage } from "@shared/zombie-offline";
import { Home, IdCard, LayoutDashboard, QrCode, Settings, ShoppingBag, Skull, UserCog, Users, Utensils, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const homeItem = { label: "Accueil", icon: Home, path: "/overview", tone: "slate", description: "Résumé de l’événement", roles: [] };
const zombieRoles = ["admin", "staff_zombie"];
export const managementModules = [
  { label: "Zombies", icon: Skull, path: "/zombie", tone: "red", description: "Arrivées, vagues et squads", roles: zombieRoles },
  { label: "Survivants", icon: Users, path: "/survivant", tone: "blue", description: "Arrivées, vagues et équipes", roles: ["admin", "staff_survivant"] },
  { label: "Boutique", icon: ShoppingBag, path: "/boutique", tone: "violet", description: "Ventes et achats des participants", roles: ["admin", "staff_boutique"] },
  { label: "Repas", icon: Utensils, path: "/repas", tone: "amber", description: "Valider et suivre les repas", roles: ["admin", "staff_repas"] },
  { label: "Scanner un badge", icon: QrCode, path: "/scan", tone: "blue", description: "Retrouver une personne par son QR code", roles: ["admin", "staff_zombie", "staff_survivant", "staff_boutique", "staff_repas"] },
  { label: "Hors ligne", icon: WifiOff, path: offlineCheckInPage, tone: "green", description: "Préparer l’accueil sur cet appareil", roles: checkInRoles },
  { label: "Staff", icon: UserCog, path: "/staff", tone: "green", description: "Présences et gestion du staff", roles: ["admin"] },
  { label: "Cartes", icon: IdCard, path: "/badges", tone: "violet", description: "Préparer et imprimer les cartes A4", roles: ["admin"] },
  { label: "Statistiques", icon: LayoutDashboard, path: "/dashboard", tone: "blue", description: "Consulter les chiffres de l’événement", roles: ["admin"] },
  { label: "Administration", icon: Settings, path: "/admin", tone: "slate", description: "Réglages, comptes et données", roles: ["admin"] },
];

export function useManagementNav() {
  const { hasAnyRole } = useAuth();
  return managementModules.filter(item => hasAnyRole(item.roles));
}
