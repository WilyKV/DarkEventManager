import type { Express } from "express";
import { demoDataPath } from "@shared/demo-data";
import { requireRole } from "./auth-middleware";
import { getDemoDataStatus, loadDemoData, removeDemoData } from "./demo-data";

export function registerDemoDataRoutes(app: Express) {
  const adminOnly = requireRole("admin");
  app.get(demoDataPath, adminOnly, async (_req, res) => {
    res.json(await getDemoDataStatus());
  });

  app.post(demoDataPath, adminOnly, async (_req, res) => {
    res.json(await loadDemoData());
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
