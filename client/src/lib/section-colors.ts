/** Couleur hex par chemin de section. Fallback : émeraude primary. */
export const SECTION_COLORS: Record<string, string> = {
  "/overview":   "#10b981",
  "/zombie":     "#ef4444",
  "/survivant":  "#3b82f6",
  "/staff":      "#22c55e",
  "/boutique":   "#22c55e",
  "/repas":      "#f97316",
  "/badges":     "#ec4899",
  "/admin":      "#6366f1",
  "/users":      "#6366f1",
  "/scan":       "#10b981",
  "/dashboard":  "#a855f7",
};

const DEFAULT_COLOR = "#10b981";

/** Retourne la couleur hex de la section ou l'émeraude par défaut. */
export function getSectionColor(path: string): string {
  return SECTION_COLORS[path] ?? DEFAULT_COLOR;
}
