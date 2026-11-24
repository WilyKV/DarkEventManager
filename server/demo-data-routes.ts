import type { Express } from "express";
import { demoDataPath } from "@shared/demo-data";
import { requireRole } from "./auth-middleware";
import { getDemoDataStatus, loadDemoData, removeDemoData } from "./demo-data";

export function registerDemoDataRoutes(app: Express) {
  const adminOnly = requireRole("admin");
  app.get(demoDataPath, adminOnly, async (_req, res) => {
    res.json(await getDemoDataStatus());
  });

  app.post(demoDataPath, adminOnly, async (req, res) => {
    const preset = req.query.preset ?? "standard";
    if (preset !== "standard" && preset !== "volume") {
      return res.status(400).json({ message: "Scénario de test inconnu." });
    }
    res.json(await loadDemoData(preset));
  });

  app.delete(demoDataPath, adminOnly, async (_req, res) => {
    try {
      res.json(await removeDemoData());
    } catch (error) {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "23503") {
        return res.status(409).json({
          message: "Une opération ou une fiche réelle est liée à la démo. Retirez ce lien avant de réessayer. Aucune donnée n’a été supprimée.",
        });
      }
      throw error;
    }
  });
}
