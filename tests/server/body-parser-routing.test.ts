/**
 * Tests TDD — Red Phase
 *
 * SEC-HARDENING / CRIT-4
 * Body parser route-scoped : démontrer que le pattern Express natif
 * (montage du parser 10MB AVANT le parser global dans server/index.ts)
 * fonctionne correctement et rend inutile le hack `insertBeforeGlobalJsonParser`.
 *
 * Ces tests servent de justification pour supprimer la fonction
 * `insertBeforeGlobalJsonParser` de server/event-ingest-routes.ts
 * et câbler le parser directement dans server/index.ts :
 *
 *   // server/index.ts — à ajouter AVANT app.use(express.json())
 *   app.use("/api/events/bulk-ingest", express.json({ limit: "10mb" }));
 *   app.use(express.json()); // global ~100kb (défaut Express)
 *
 * Note : ces tests utilisent une mini app autonome.
 * Ils ne dépendent PAS de server/index.ts ni de server/event-ingest-routes.ts.
 * Le contrat validé ici est le comportement attendu du wiring propre.
 */

import express, { type Express, type Request, type Response } from "express";
import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Limite du parser global Express (défaut : 100kb). */
const GLOBAL_LIMIT_BYTES = 100 * 1024; // 100 kb

/** Limite du parser route-scoped pour bulk-ingest. */
const BULK_INGEST_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Factory : mini app Express reproduisant le wiring propre cible
//
// Ordre de montage :
//   1. Parser route-scoped 10MB sur /api/events/bulk-ingest
//   2. Parser global ~100kb
//   3. Routes de test
// ---------------------------------------------------------------------------

function buildApp(): Express {
  const app = express();

  // Parser route-scoped AVANT le parser global — c'est l'ordre cible dans index.ts
  app.use("/api/events/bulk-ingest", express.json({ limit: "10mb" }));

  // Parser global avec limite basse (simulant le comportement par défaut Express)
  app.use(express.json({ limit: "100kb" }));

  // Route bulk-ingest : retourne la taille du body reçu
  app.post("/api/events/bulk-ingest", (req: Request, res: Response) => {
    const size = JSON.stringify(req.body).length;
    res.json({ size, parsed: true });
  });

  // Route régulière : soumise uniquement au parser global
  app.post("/api/regular", (req: Request, res: Response) => {
    const size = JSON.stringify(req.body).length;
    res.json({ size, parsed: true });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Génère un body JSON de taille approximative `targetBytes`.
 * Retourne un objet { events: [string, string, ...] } avec des chaînes rembourrant.
 */
function buildBodyOfSize(targetBytes: number): Record<string, unknown> {
  // On vise targetBytes - overhead JSON (~20 octets pour {"events":[""]})
  const paddingSize = Math.max(0, targetBytes - 20);
  const paddingString = "x".repeat(paddingSize);
  return { events: [paddingString] };
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("Body parser route-scoped vs global — wiring propre sans insertBeforeGlobalJsonParser", () => {

  // -------------------------------------------------------------------------
  // 1. Route /api/events/bulk-ingest — parser 10MB
  // -------------------------------------------------------------------------

  describe("POST /api/events/bulk-ingest (parser 10MB route-scoped)", () => {

    it("should accept a body of 5MB and return 200", async () => {
      // Arrange
      const app = buildApp();
      const body = buildBodyOfSize(5 * 1024 * 1024); // 5 MB

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.parsed).toBe(true);
    });

    it("should accept a body of 50kb and return 200", async () => {
      // Arrange
      const app = buildApp();
      const body = buildBodyOfSize(50 * 1024); // 50 kb

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));

      // Assert
      expect(response.status).toBe(200);
    });

    it("should accept a body at exactly the global limit boundary (100kb) and return 200", async () => {
      // Arrange — juste sous la limite globale, mais au-dessus du seuil qu'un parser
      // global strict bloquerait si non intercepté en premier.
      const app = buildApp();
      const body = buildBodyOfSize(GLOBAL_LIMIT_BYTES - 1); // 100kb - 1 octet

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));

      // Assert
      expect(response.status).toBe(200);
    });

    it("should return 413 when body exceeds 10MB", async () => {
      // Arrange
      const app = buildApp();
      const body = buildBodyOfSize(BULK_INGEST_LIMIT_BYTES + 10 * 1024); // 10MB + 10kb

      // Act
      const response = await request(app)
        .post("/api/events/bulk-ingest")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));

      // Assert
      expect(response.status).toBe(413);
    });

  });

  // -------------------------------------------------------------------------
  // 2. Route /api/regular — parser global ~100kb
  // -------------------------------------------------------------------------

  describe("POST /api/regular (parser global 100kb)", () => {

    it("should accept a body of 50kb and return 200", async () => {
      // Arrange
      const app = buildApp();
      const body = buildBodyOfSize(50 * 1024); // 50 kb

      // Act
      const response = await request(app)
        .post("/api/regular")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.parsed).toBe(true);
    });

    it("should return 413 when body exceeds the global 100kb limit", async () => {
      // Arrange
      const app = buildApp();
      // On dépasse légèrement la limite globale
      const body = buildBodyOfSize(5 * 1024 * 1024); // 5 MB — bien au-delà de 100kb

      // Act
      const response = await request(app)
        .post("/api/regular")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));

      // Assert
      // Le parser global (100kb) doit rejeter les corps dépassant sa limite.
      expect(response.status).toBe(413);
    });

    it("should return 413 for a body of exactly 200kb on /api/regular", async () => {
      // Arrange
      const app = buildApp();
      const body = buildBodyOfSize(200 * 1024); // 200 kb

      // Act
      const response = await request(app)
        .post("/api/regular")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));

      // Assert
      expect(response.status).toBe(413);
    });

  });

  // -------------------------------------------------------------------------
  // 3. Isolation : le parser 10MB ne s'applique PAS à /api/regular
  // -------------------------------------------------------------------------

  describe("isolation des parsers entre routes", () => {

    it("should NOT allow 5MB bodies on /api/regular even though /api/events/bulk-ingest allows them", async () => {
      // Arrange
      const app = buildApp();
      const largeBody = buildBodyOfSize(5 * 1024 * 1024); // 5 MB

      // Act
      const bulkResponse = await request(app)
        .post("/api/events/bulk-ingest")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(largeBody));

      const regularResponse = await request(app)
        .post("/api/regular")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(largeBody));

      // Assert — même body, comportements opposés selon la route
      expect(bulkResponse.status).toBe(200);
      expect(regularResponse.status).toBe(413);
    });

    it("should correctly parse both routes when body is within the global limit", async () => {
      // Arrange — body de 10kb, accepté par les deux parsers
      const app = buildApp();
      const smallBody = { events: ["small payload"] };

      // Act
      const bulkResponse = await request(app)
        .post("/api/events/bulk-ingest")
        .send(smallBody);

      const regularResponse = await request(app)
        .post("/api/regular")
        .send(smallBody);

      // Assert — les deux routes parsent correctement
      expect(bulkResponse.status).toBe(200);
      expect(regularResponse.status).toBe(200);
      expect(bulkResponse.body.parsed).toBe(true);
      expect(regularResponse.body.parsed).toBe(true);
    });

  });

  // -------------------------------------------------------------------------
  // 4. Ordre de montage — le route-scoped parser doit être AVANT le global
  // -------------------------------------------------------------------------

  describe("ordre de montage correct (route-scoped AVANT global)", () => {

    it("should return 200 on bulk-ingest for 1MB body when route-scoped parser is mounted first", async () => {
      // Arrange — ordre correct : route-scoped avant global
      const appCorrect = express();
      appCorrect.use("/api/events/bulk-ingest", express.json({ limit: "10mb" }));
      appCorrect.use(express.json({ limit: "100kb" }));
      appCorrect.post("/api/events/bulk-ingest", (req: Request, res: Response) => {
        res.json({ parsed: true, size: JSON.stringify(req.body).length });
      });

      const body = buildBodyOfSize(1 * 1024 * 1024); // 1 MB

      // Act
      const response = await request(appCorrect)
        .post("/api/events/bulk-ingest")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));

      // Assert
      expect(response.status).toBe(200);
    });

    it("should return 413 on bulk-ingest for 1MB body when global parser is mounted BEFORE route-scoped (ordre inversé)", async () => {
      // Arrange — ordre INCORRECT : global avant route-scoped
      // Ce test documente le problème que `insertBeforeGlobalJsonParser` tentait de résoudre.
      // Avec le wiring propre (ordre correct), ce cas ne se produit pas.
      const appIncorrect = express();
      appIncorrect.use(express.json({ limit: "100kb" })); // global en premier — MAUVAIS ORDRE
      appIncorrect.use("/api/events/bulk-ingest", express.json({ limit: "10mb" }));
      appIncorrect.post("/api/events/bulk-ingest", (req: Request, res: Response) => {
        res.json({ parsed: true });
      });

      const body = buildBodyOfSize(1 * 1024 * 1024); // 1 MB

      // Act
      const response = await request(appIncorrect)
        .post("/api/events/bulk-ingest")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(body));

      // Assert — le parser global rejette avant que le route-scoped puisse agir
      // Ce test confirme pourquoi l'ordre de montage dans server/index.ts est critique.
      expect(response.status).toBe(413);
    });

  });

});
