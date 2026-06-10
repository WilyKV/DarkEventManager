/**
 * Tests de CARACTÉRISATION — Contrat Excel pré-migration exceljs
 *
 * Objectif : figer le comportement observable des endpoints Excel (import/export)
 * tels qu'ils existent avec la dépendance `xlsx` (SheetJS). Ces tests doivent
 * rester verts après la migration vers `exceljs` (GHSA-4r6h-8v6p-xvw6).
 *
 * Endpoints couverts :
 *   EXPORT
 *   ------
 *   GET  /api/export/participants        requireAuth (tout rôle)
 *        Feuille "Participants", colonnes : Prénom/Nom/Type/Créneau/Squad/
 *        Arrivé/Code Secret/Checklist/Repas gratuit/Repas réclamé
 *
 *   GET  /api/export/time-slots          requireAuth (tout rôle)
 *        Feuille "Creneaux", colonnes : Nom/Type/Heure Briefing/Heure Jeu
 *
 *   GET  /api/export/squads              requireAuth (tout rôle)
 *        Feuille "Squads", colonnes : Numéro/Type/Nombre de participants
 *
 *   GET  /api/export/all-data            requireAuth (tout rôle)
 *        Feuilles "Participants" + "Creneaux" + "Squads" (sauf type=staff)
 *
 *   GET  /api/data/export-all            requireAuth + requireRole('admin')
 *        Feuilles "Participants"/"Créneaux"/"Squads"/"Boutique"/"Repas"
 *
 *   GET  /api/data/export/:module        requireAuth (tout rôle) — SECURISEE
 *        Était publique (faille de sécurité). Doit désormais exiger requireAuth,
 *        cohérent avec les routes GET /api/export/* voisines.
 *        Feuille dynamique selon module (participants/timeslots/squads/shop/meals)
 *        Tests RED PHASE : les cas 401 échouent tant que le fix n'est pas appliqué.
 *
 *   IMPORT
 *   ------
 *   POST /api/participants/import        requireAuth + requireRole('admin')
 *        Colonnes attendues : firstName / lastName / timeSlotName (optionnel)
 *        Ligne 0 = header (skippée) ; réponse { message, count }
 *
 *   POST /api/data/import-all            requireAuth + requireRole('admin')
 *        Feuilles "Créneaux" / "Squads" / "Participants"
 *        Réponse { message, stats: { imported, errors } }
 *
 * Convention : les assertions portent sur le CONTRAT OBSERVABLE
 * (feuilles, colonnes, lignes, statuts HTTP, Content-Type, Content-Disposition).
 * Elles N'encodent PAS les détails internes de xlsx afin de rester valides
 * après migration vers exceljs.
 *
 * Exécution : npm test -- --project=server
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import xlsx from "xlsx";
import { USER_ROLES, type UserRole } from "@shared/schema";

// ---------------------------------------------------------------------------
// Helpers de construction de buffers .xlsx (côté TEST seulement)
// Ces helpers utilisent xlsx pour construire des fixtures — ils ne touchent pas
// au code de production. Après migration exceljs, le serveur changera mais ces
// helpers tests restent valides pour construire des fichiers d'entrée.
// ---------------------------------------------------------------------------

function buildParticipantsImportBuffer(rows: Array<Record<string, string>>): Buffer {
  // Ligne 0 = header (firstName, lastName, timeSlotName) comme attendu par le serveur
  const wsData = [
    { firstName: "firstName", lastName: "lastName", timeSlotName: "timeSlotName" },
    ...rows,
  ];
  const ws = xlsx.utils.json_to_sheet(wsData, { skipHeader: true, header: ["firstName", "lastName", "timeSlotName"] });
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function buildImportAllBuffer(options: {
  participants?: Array<Record<string, unknown>>;
  timeSlots?: Array<Record<string, unknown>>;
  squads?: Array<Record<string, unknown>>;
}): Buffer {
  const wb = xlsx.utils.book_new();

  if (options.timeSlots) {
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(options.timeSlots), "Créneaux");
  }
  if (options.squads) {
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(options.squads), "Squads");
  }
  if (options.participants) {
    xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(options.participants), "Participants");
  }

  return Buffer.from(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/** Parse un buffer binaire reçu comme réponse HTTP en workbook xlsx (côté test). */
function parseResponseBuffer(buffer: Buffer): xlsx.WorkBook {
  return xlsx.read(buffer, { type: "buffer" });
}

/** Retourne les headers (première ligne) d'une feuille. */
function getSheetHeaders(wb: xlsx.WorkBook, sheetName: string): string[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const rows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  return (rows[0] as string[]) ?? [];
}

/** Retourne toutes les lignes (hors header) d'une feuille sous forme d'objets. */
function getSheetRows(wb: xlsx.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);
}

// ---------------------------------------------------------------------------
// Mocks (mêmes patterns que admin-routes-auth.test.ts)
// ---------------------------------------------------------------------------

// Données de fixture réutilisables dans tous les tests
const mockParticipant = {
  id: 1,
  firstName: "Alice",
  lastName: "Zombie",
  email: "alice@test.com",
  type: "zombie",
  timeSlot: { id: 1, name: "Créneau 20h" },
  squad: { id: 1, number: 3 },
  arrived: true,
  arrivedAt: new Date("2026-06-06T20:00:00Z"),
  returned: false,
  returnedAt: null,
  secretCode: "12345",
  checklistCompleted: false,
  hasFreemeal: true,
  freeMealClaimed: false,
};

const mockTimeSlot = {
  id: 1,
  name: "Créneau 20h",
  type: "zombie",
  mealTime: "20h00",
  briefingTime: "19h30",
  gameTime: "21h00",
  exitTime: "23h00",
};

const mockSquad = {
  id: 1,
  number: 3,
  type: "zombie",
  timeSlotId: 1,
  maxMembers: 8,
  participants: [mockParticipant],
};

const mockShopItem = {
  id: 1,
  name: "Bière artisanale",
  category: "Boissons",
  price: "3.50",
  stock: 50,
};

const mockMealItem = {
  id: 1,
  name: "Sandwich zombie",
  category: "Plats",
  price: "6.00",
  stock: 20,
};

vi.mock("../../server/storage", () => ({
  storage: {
    getParticipants: vi.fn().mockResolvedValue([mockParticipant]),
    getParticipant: vi.fn().mockResolvedValue(mockParticipant),
    createParticipant: vi.fn().mockResolvedValue({ id: 2 }),
    generateSecretCode: vi.fn().mockResolvedValue("99999"),
    getTimeSlots: vi.fn().mockResolvedValue([mockTimeSlot]),
    createTimeSlot: vi.fn().mockResolvedValue({ id: 10, name: "Nouveau créneau", type: "zombie" }),
    getSquads: vi.fn().mockResolvedValue([mockSquad]),
    getSquadsWithParticipants: vi.fn().mockResolvedValue([mockSquad]),
    createSquad: vi.fn().mockResolvedValue({ id: 20, number: 99 }),
    getShopItems: vi.fn().mockResolvedValue([mockShopItem]),
    getMealItems: vi.fn().mockResolvedValue([mockMealItem]),
    createAuditLog: vi.fn().mockResolvedValue({ id: 1 }),
    resetData: vi.fn().mockResolvedValue(undefined),
    getPurchases: vi.fn().mockResolvedValue([]),
    getMealPurchases: vi.fn().mockResolvedValue([]),
    getGlobalDiscounts: vi.fn().mockResolvedValue(undefined),
    getGlobalMealDiscounts: vi.fn().mockResolvedValue(undefined),
  },
}));

// multer réel — on ne le mocke PAS ici pour que les fichiers .xlsx soient
// transmis tels quels au handler et que xlsx.read (côté serveur) puisse les parser.
// On utilise multer.memoryStorage() qui est le comportement de production.

// pako mocké car non pertinent pour ce test
vi.mock("pako", () => ({ default: { inflate: vi.fn(), deflate: vi.fn() } }));

// event-ingest-routes non pertinent
vi.mock("../../server/event-ingest-routes", () => ({
  registerEventIngestRoutes: vi.fn(),
}));

// sync-middleware — pass-through
vi.mock("../../server/sync-middleware", () => ({
  checkSyncPermissions: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// pdf-service non pertinent
vi.mock("../../server/pdf-service", () => ({
  generateParticipantPDF: vi.fn().mockResolvedValue(Buffer.from("")),
}));

// ---------------------------------------------------------------------------
// buildApp — identique au pattern admin-routes-auth.test.ts
// ---------------------------------------------------------------------------

type SessionUser = { id: number; username: string; roles: UserRole[] };

async function buildApp(sessionUser?: SessionUser): Promise<Express> {
  const { registerRoutes } = await import("../../server/routes");
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = sessionUser ? { user: { ...sessionUser } } : {};
    next();
  });
  await registerRoutes(app);
  return app;
}

const adminUser: SessionUser = { id: 1, username: "admin", roles: [USER_ROLES.ADMIN] };
const staffUser: SessionUser = { id: 2, username: "staff_z", roles: [USER_ROLES.STAFF_ZOMBIE] };

// ---------------------------------------------------------------------------
// Constantes de contrat observables
// ---------------------------------------------------------------------------

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Colonnes attendues par endpoint
const PARTICIPANTS_EXPORT_COLUMNS = [
  "Prénom", "Nom", "Type", "Créneau", "Squad",
  "Arrivé", "Code Secret", "Checklist", "Repas gratuit", "Repas réclamé",
];

const PARTICIPANTS_EXPORT_ALL_DATA_COLUMNS = [
  "ID", "Prénom", "Nom", "Email", "Type", "Créneau", "Squad",
  "Code Secret", "Arrivé", "Heure arrivée", "Retourné", "Heure retour",
  "Checklist", "Repas gratuit", "Repas réclamé",
];

const TIME_SLOTS_EXPORT_COLUMNS = ["Nom", "Type", "Heure Briefing", "Heure Jeu"];

const SQUADS_EXPORT_COLUMNS = ["Numéro", "Type", "Nombre de participants"];

const TIME_SLOTS_EXPORT_ALL_DATA_COLUMNS = [
  "ID", "Nom", "Type", "Heure repas", "Heure briefing", "Heure jeu", "Heure sortie",
];

const SQUADS_EXPORT_ALL_DATA_COLUMNS = [
  "ID", "Numéro", "Type", "Créneau ID", "Max membres",
];

const SHOP_EXPORT_COLUMNS = ["ID", "Nom", "Catégorie", "Prix", "Stock"];
const MEAL_EXPORT_COLUMNS = ["ID", "Nom", "Catégorie", "Prix", "Stock"];

// ===========================================================================
// SUITES DE TESTS
// ===========================================================================

describe("Excel — Tests de caractérisation (contrat pré-migration exceljs)", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // SECTION 1 — Protection des routes (comportement auth)
  // Ces tests s'assurent que les garde-fous auth restent en place
  // après la migration, indépendamment de la lib Excel utilisée.
  // =========================================================================

  describe("Protection des routes Excel (auth)", () => {

    describe("GET /api/export/participants", () => {
      it("should return 401 when no session is present", async () => {
        // Arrange
        const app = await buildApp(undefined);

        // Act
        const res = await request(app).get("/api/export/participants");

        // Assert
        expect(res.status).toBe(401);
      });

      it("should return 200 for any authenticated user (staff or admin)", async () => {
        // Arrange
        const app = await buildApp(staffUser);

        // Act
        const res = await request(app).get("/api/export/participants");

        // Assert
        expect(res.status).toBe(200);
      });
    });

    describe("GET /api/export/time-slots", () => {
      it("should return 401 when no session is present", async () => {
        const app = await buildApp(undefined);
        const res = await request(app).get("/api/export/time-slots");
        expect(res.status).toBe(401);
      });

      it("should return 200 for authenticated staff", async () => {
        const app = await buildApp(staffUser);
        const res = await request(app).get("/api/export/time-slots");
        expect(res.status).toBe(200);
      });
    });

    describe("GET /api/export/squads", () => {
      it("should return 401 when no session is present", async () => {
        const app = await buildApp(undefined);
        const res = await request(app).get("/api/export/squads");
        expect(res.status).toBe(401);
      });

      it("should return 200 for authenticated staff", async () => {
        const app = await buildApp(staffUser);
        const res = await request(app).get("/api/export/squads");
        expect(res.status).toBe(200);
      });
    });

    describe("GET /api/export/all-data", () => {
      it("should return 401 when no session is present", async () => {
        const app = await buildApp(undefined);
        const res = await request(app).get("/api/export/all-data");
        expect(res.status).toBe(401);
      });
    });

    describe("GET /api/data/export-all (admin only)", () => {
      it("should return 401 when no session is present", async () => {
        const app = await buildApp(undefined);
        const res = await request(app).get("/api/data/export-all");
        expect(res.status).toBe(401);
      });

      it("should return 403 for non-admin staff", async () => {
        const app = await buildApp(staffUser);
        const res = await request(app).get("/api/data/export-all");
        expect(res.status).toBe(403);
      });

      it("should return 200 for admin", async () => {
        const app = await buildApp(adminUser);
        const res = await request(app).get("/api/data/export-all");
        expect(res.status).toBe(200);
      });
    });

    // -----------------------------------------------------------------------
    // SECURITY FIX — route passée de PUBLIQUE à PROTÉGÉE (requireAuth)
    //
    // Avant le fix : GET /api/data/export/:module n'avait aucun middleware
    //   d'authentification → données sensibles (participants, codes secrets…)
    //   exposées sans authentification.
    //
    // Contrat cible : requireAuth (tout rôle authentifié), aligné sur les
    //   autres routes GET /api/export/* voisines.
    //   → 401 sans session, 200 avec session valide (staff ou admin).
    //
    // Ces tests ÉCHOUENT avec le code actuel (route publique → 200 au lieu
    // de 401). Ils passeront une fois requireAuth ajouté sur la route.
    // -----------------------------------------------------------------------
    describe("GET /api/data/export/:module (requireAuth — sécurisée)", () => {
      it("should return 401 when no session is present for participants module", async () => {
        // Arrange — RED PHASE : attend 401, mais la route est publique → reçoit 200
        const app = await buildApp(undefined);

        // Act
        const res = await request(app).get("/api/data/export/participants");

        // Assert
        expect(res.status).toBe(401);
      });

      it("should return 401 when no session is present for timeslots module", async () => {
        // Arrange — RED PHASE : route publique, sera 401 après le fix
        const app = await buildApp(undefined);

        // Act
        const res = await request(app).get("/api/data/export/timeslots");

        // Assert
        expect(res.status).toBe(401);
      });

      it("should return 401 when no session is present for shop module", async () => {
        // Arrange — RED PHASE : route publique, sera 401 après le fix
        const app = await buildApp(undefined);

        // Act
        const res = await request(app).get("/api/data/export/shop");

        // Assert
        expect(res.status).toBe(401);
      });

      it("should return 200 for authenticated staff (any role)", async () => {
        // Arrange — tout utilisateur authentifié doit pouvoir exporter (pas de rôle admin requis)
        const app = await buildApp(staffUser);

        // Act
        const res = await request(app).get("/api/data/export/participants");

        // Assert
        expect(res.status).toBe(200);
      });

      it("should return 200 for admin user", async () => {
        // Arrange
        const app = await buildApp(adminUser);

        // Act
        const res = await request(app).get("/api/data/export/participants");

        // Assert
        expect(res.status).toBe(200);
      });

      it("should return 400 for an unknown module when authenticated", async () => {
        // Arrange — après le fix, la validation du module doit toujours fonctionner
        const app = await buildApp(staffUser);

        // Act
        const res = await request(app).get("/api/data/export/unknown_module");

        // Assert
        expect(res.status).toBe(400);
      });
    });

    describe("POST /api/participants/import (admin only)", () => {
      it("should return 401 when no session is present", async () => {
        const app = await buildApp(undefined);
        const res = await request(app)
          .post("/api/participants/import")
          .attach("file", Buffer.from(""), "participants.xlsx");
        expect(res.status).toBe(401);
      });

      it("should return 403 for non-admin staff", async () => {
        const app = await buildApp(staffUser);
        const res = await request(app)
          .post("/api/participants/import")
          .attach("file", Buffer.from(""), "participants.xlsx");
        expect(res.status).toBe(403);
      });
    });

    describe("POST /api/data/import-all (admin only)", () => {
      it("should return 401 when no session is present", async () => {
        const app = await buildApp(undefined);
        const res = await request(app)
          .post("/api/data/import-all")
          .attach("file", Buffer.from(""), "data.xlsx");
        expect(res.status).toBe(401);
      });

      it("should return 403 for non-admin staff", async () => {
        const app = await buildApp(staffUser);
        const res = await request(app)
          .post("/api/data/import-all")
          .attach("file", Buffer.from(""), "data.xlsx");
        expect(res.status).toBe(403);
      });
    });

  });

  // =========================================================================
  // SECTION 2 — Contrat des EXPORTS (Content-Type, feuilles, colonnes, lignes)
  // =========================================================================

  describe("Export GET /api/export/participants — contrat format", () => {

    it("should return correct Content-Type for OOXML spreadsheet", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/participants")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain(XLSX_CONTENT_TYPE);
    });

    it("should include Content-Disposition with .xlsx filename", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/participants")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const disposition = res.headers["content-disposition"] ?? "";
      expect(disposition).toContain("attachment");
      expect(disposition).toMatch(/\.xlsx/);
    });

    it("should produce a parseable workbook with exactly one sheet named 'Participants'", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/participants")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const wb = parseResponseBuffer(res.body as Buffer);
      expect(wb.SheetNames).toHaveLength(1);
      expect(wb.SheetNames[0]).toBe("Participants");
    });

    it("should produce expected column headers in Participants sheet", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/participants")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const wb = parseResponseBuffer(res.body as Buffer);
      const headers = getSheetHeaders(wb, "Participants");
      expect(headers).toEqual(PARTICIPANTS_EXPORT_COLUMNS);
    });

    it("should contain one data row matching the mocked participant", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/participants")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const wb = parseResponseBuffer(res.body as Buffer);
      const rows = getSheetRows(wb, "Participants");
      expect(rows).toHaveLength(1);
      expect(rows[0]["Prénom"]).toBe("Alice");
      expect(rows[0]["Nom"]).toBe("Zombie");
      expect(rows[0]["Type"]).toBe("zombie");
      expect(rows[0]["Arrivé"]).toBe("Oui");
      expect(rows[0]["Repas gratuit"]).toBe("Oui");
      expect(rows[0]["Code Secret"]).toBe("12345");
    });

    it("should include filter label 'tous' in filename when no filterLabel query param", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/participants")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const disposition = res.headers["content-disposition"] ?? "";
      expect(disposition).toContain("_tous_");
    });

    it("should include sanitized filterLabel in filename when filterLabel query param is provided", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/participants?filterLabel=Créneau 20h")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert — accents et espaces sanitisés dans le nom de fichier
      const disposition = res.headers["content-disposition"] ?? "";
      // Extraire uniquement la valeur du paramètre filename="..."
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      expect(filenameMatch).not.toBeNull();
      const filename = filenameMatch![1];
      // Le nom de fichier ne doit contenir ni accent ni espace (sanitization)
      expect(filename).not.toContain("é");
      expect(filename).not.toContain(" ");
      // Le nom de fichier contient une partie issue du label
      expect(filename).toMatch(/Creneau_20h|Crneau_20h/);
    });

  });

  describe("Export GET /api/export/time-slots — contrat format", () => {

    it("should return OOXML Content-Type with sheet 'Creneaux' and correct columns", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/time-slots")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert — Content-Type
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain(XLSX_CONTENT_TYPE);

      // Assert — structure workbook
      const wb = parseResponseBuffer(res.body as Buffer);
      expect(wb.SheetNames).toHaveLength(1);
      expect(wb.SheetNames[0]).toBe("Creneaux");

      const headers = getSheetHeaders(wb, "Creneaux");
      expect(headers).toEqual(TIME_SLOTS_EXPORT_COLUMNS);
    });

    it("should contain one data row matching the mocked time slot", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/time-slots")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const wb = parseResponseBuffer(res.body as Buffer);
      const rows = getSheetRows(wb, "Creneaux");
      expect(rows).toHaveLength(1);
      expect(rows[0]["Nom"]).toBe("Créneau 20h");
      expect(rows[0]["Type"]).toBe("zombie");
      expect(rows[0]["Heure Briefing"]).toBe("19h30");
      expect(rows[0]["Heure Jeu"]).toBe("21h00");
    });

    it("should include .xlsx extension in Content-Disposition filename", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/time-slots")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      expect(res.headers["content-disposition"]).toMatch(/\.xlsx/);
    });

  });

  describe("Export GET /api/export/squads — contrat format", () => {

    it("should return OOXML Content-Type with sheet 'Squads' and correct columns", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/squads")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain(XLSX_CONTENT_TYPE);

      const wb = parseResponseBuffer(res.body as Buffer);
      expect(wb.SheetNames).toHaveLength(1);
      expect(wb.SheetNames[0]).toBe("Squads");

      const headers = getSheetHeaders(wb, "Squads");
      expect(headers).toEqual(SQUADS_EXPORT_COLUMNS);
    });

    it("should contain one data row with squad participant count", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/squads")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const wb = parseResponseBuffer(res.body as Buffer);
      const rows = getSheetRows(wb, "Squads");
      expect(rows).toHaveLength(1);
      expect(rows[0]["Numéro"]).toBe(3);
      expect(rows[0]["Type"]).toBe("zombie");
      // mockSquad.participants a 1 élément
      expect(rows[0]["Nombre de participants"]).toBe(1);
    });

  });

  describe("Export GET /api/export/all-data — contrat format (multi-feuilles)", () => {

    it("should produce a workbook with sheets Participants + Creneaux + Squads by default", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/all-data")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      expect(res.status).toBe(200);
      const wb = parseResponseBuffer(res.body as Buffer);
      expect(wb.SheetNames).toContain("Participants");
      expect(wb.SheetNames).toContain("Creneaux");
      expect(wb.SheetNames).toContain("Squads");
    });

    it("should produce a workbook WITHOUT Squads sheet when type=staff", async () => {
      // Arrange — le code routes.ts exclut la feuille Squads pour type=staff
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/all-data?type=staff")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      expect(res.status).toBe(200);
      const wb = parseResponseBuffer(res.body as Buffer);
      expect(wb.SheetNames).not.toContain("Squads");
      expect(wb.SheetNames).toContain("Participants");
      expect(wb.SheetNames).toContain("Creneaux");
    });

    it("should have correct columns in each sheet of all-data export", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/export/all-data")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert — colonnes de Participants (all-data a "Checklist" sans hasMerch extra)
      const wb = parseResponseBuffer(res.body as Buffer);
      const partHeaders = getSheetHeaders(wb, "Participants");
      expect(partHeaders).toEqual(PARTICIPANTS_EXPORT_COLUMNS);

      const tsHeaders = getSheetHeaders(wb, "Creneaux");
      expect(tsHeaders).toEqual(TIME_SLOTS_EXPORT_COLUMNS);

      const squadHeaders = getSheetHeaders(wb, "Squads");
      expect(squadHeaders).toEqual(SQUADS_EXPORT_COLUMNS);
    });

  });

  describe("Export GET /api/data/export-all (admin) — contrat format (5 feuilles)", () => {

    it("should produce a workbook with all 5 sheets", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/data/export-all")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      expect(res.status).toBe(200);
      const wb = parseResponseBuffer(res.body as Buffer);
      expect(wb.SheetNames).toContain("Participants");
      expect(wb.SheetNames).toContain("Créneaux");
      expect(wb.SheetNames).toContain("Squads");
      expect(wb.SheetNames).toContain("Boutique");
      expect(wb.SheetNames).toContain("Repas");
      expect(wb.SheetNames).toHaveLength(5);
    });

    it("should have correct columns in Participants sheet (includes ID, Email, timestamps)", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/data/export-all")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const wb = parseResponseBuffer(res.body as Buffer);
      const headers = getSheetHeaders(wb, "Participants");
      expect(headers).toEqual(PARTICIPANTS_EXPORT_ALL_DATA_COLUMNS);
    });

    it("should have correct columns in Créneaux sheet (includes ID + all time fields)", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/data/export-all")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert — note: feuille nommée "Créneaux" (avec accent) dans export-all
      const wb = parseResponseBuffer(res.body as Buffer);
      const headers = getSheetHeaders(wb, "Créneaux");
      expect(headers).toEqual(TIME_SLOTS_EXPORT_ALL_DATA_COLUMNS);
    });

    it("should have correct columns in Squads sheet (includes ID, Créneau ID, Max membres)", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/data/export-all")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const wb = parseResponseBuffer(res.body as Buffer);
      const headers = getSheetHeaders(wb, "Squads");
      expect(headers).toEqual(SQUADS_EXPORT_ALL_DATA_COLUMNS);
    });

    it("should have correct columns in Boutique and Repas sheets", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/data/export-all")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const wb = parseResponseBuffer(res.body as Buffer);
      expect(getSheetHeaders(wb, "Boutique")).toEqual(SHOP_EXPORT_COLUMNS);
      expect(getSheetHeaders(wb, "Repas")).toEqual(MEAL_EXPORT_COLUMNS);
    });

    it("should contain one data row in Boutique with mocked shop item", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/data/export-all")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const wb = parseResponseBuffer(res.body as Buffer);
      const rows = getSheetRows(wb, "Boutique");
      expect(rows).toHaveLength(1);
      expect(rows[0]["Nom"]).toBe("Bière artisanale");
      expect(rows[0]["Catégorie"]).toBe("Boissons");
    });

    it("should include darkevent_export_complet in filename", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app)
        .get("/api/data/export-all")
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      // Assert
      const disposition = res.headers["content-disposition"] ?? "";
      expect(disposition).toContain("darkevent_export_complet");
    });

  });

  // -------------------------------------------------------------------------
  // SECURITY FIX — contrat format adapté : route /api/data/export/:module
  // est désormais protégée par requireAuth (plus publique).
  // Les tests de contrat de format utilisent un utilisateur authentifié
  // (staffUser) pour vérifier le contenu du fichier Excel exporté.
  // -------------------------------------------------------------------------
  describe("Export GET /api/data/export/:module — contrat format (requireAuth)", () => {

    it("should return 401 for unauthenticated request — RED PHASE guard", async () => {
      // Arrange — RED PHASE : ce test ÉCHOUE tant que la route est publique
      // (reçoit 200 au lieu de 401). Il passera après ajout de requireAuth.
      const app = await buildApp(undefined);

      // Act
      const res = await request(app).get("/api/data/export/participants");

      // Assert
      expect(res.status).toBe(401);
    });

    it.each([
      ["participants", "Participants", ["ID", "Prénom", "Nom", "Email", "Type", "Créneau", "Squad", "Code Secret", "Arrivé", "Checklist", "Repas gratuit"]],
      ["timeslots",   "Créneaux",    ["ID", "Nom", "Type", "Heure repas", "Heure briefing", "Heure jeu", "Heure sortie"]],
      ["squads",      "Squads",      ["ID", "Numéro", "Type", "Créneau ID", "Max membres"]],
      ["shop",        "Boutique",    ["ID", "Nom", "Catégorie", "Prix", "Stock"]],
      ["meals",       "Repas",       ["ID", "Nom", "Catégorie", "Prix", "Stock"]],
    ] as const)(
      "should export module '%s' with sheet '%s' and expected columns when authenticated",
      async (module, sheetName, expectedCols) => {
        // Arrange — utilisateur authentifié (staff suffisant, pas besoin d'admin)
        const app = await buildApp(staffUser);

        // Act
        const res = await request(app)
          .get(`/api/data/export/${module}`)
          .buffer(true)
          .parse((res, callback) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => callback(null, Buffer.concat(chunks)));
          });

        // Assert
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain(XLSX_CONTENT_TYPE);

        const wb = parseResponseBuffer(res.body as Buffer);
        expect(wb.SheetNames).toContain(sheetName);

        const headers = getSheetHeaders(wb, sheetName);
        expect(headers).toEqual(expectedCols);
      }
    );

    it("should return 400 for unknown module when authenticated", async () => {
      // Arrange
      const app = await buildApp(staffUser);

      // Act
      const res = await request(app).get("/api/data/export/unknown");

      // Assert
      expect(res.status).toBe(400);
    });

  });

  // =========================================================================
  // SECTION 3 — Contrat des IMPORTS
  // =========================================================================

  describe("Import POST /api/participants/import — contrat comportement", () => {

    it("should return 400 when no file is attached", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act — pas de fichier attaché
      const res = await request(app)
        .post("/api/participants/import")
        .field("type", "zombie");

      // Assert
      expect(res.status).toBe(400);
      expect(res.body.message).toBeTruthy();
    });

    it("should return { message, count } JSON with count = number of valid rows processed", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      const buffer = buildParticipantsImportBuffer([
        { firstName: "Bob",   lastName: "Survivant", timeSlotName: "Créneau 20h" },
        { firstName: "Carol", lastName: "Zombie",    timeSlotName: "" },
      ]);

      // Act
      const res = await request(app)
        .post("/api/participants/import")
        .field("type", "zombie")
        .attach("file", buffer, "participants.xlsx");

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ message: expect.any(String), count: 2 });
      // createParticipant appelé 2 fois (une par ligne valide)
      expect(storage.createParticipant).toHaveBeenCalledTimes(2);
    });

    it("should skip rows with empty firstName or lastName", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      const buffer = buildParticipantsImportBuffer([
        { firstName: "",      lastName: "Zombie",  timeSlotName: "" }, // firstName vide → ignoré
        { firstName: "Alice", lastName: "",         timeSlotName: "" }, // lastName vide → ignoré
        { firstName: "Bob",   lastName: "Valid",    timeSlotName: "" }, // valide
      ]);

      // Act
      const res = await request(app)
        .post("/api/participants/import")
        .field("type", "zombie")
        .attach("file", buffer, "participants.xlsx");

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(storage.createParticipant).toHaveBeenCalledTimes(1);
    });

    it("should create a new time slot when timeSlotName is unknown", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");
      // getTimeSlots retourne [] → pas de créneau existant → création attendue
      vi.mocked(storage.getTimeSlots).mockResolvedValue([]);

      const buffer = buildParticipantsImportBuffer([
        { firstName: "Dave", lastName: "Ghoul", timeSlotName: "Nouveau créneau" },
      ]);

      // Act
      const res = await request(app)
        .post("/api/participants/import")
        .field("type", "zombie")
        .attach("file", buffer, "participants.xlsx");

      // Assert
      expect(res.status).toBe(200);
      expect(storage.createTimeSlot).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Nouveau créneau", type: "zombie" })
      );
    });

    it("should reuse existing time slot when timeSlotName matches", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");
      // getTimeSlots retourne le mock créneau existant
      vi.mocked(storage.getTimeSlots).mockResolvedValue([mockTimeSlot]);

      const buffer = buildParticipantsImportBuffer([
        { firstName: "Eve", lastName: "Morte", timeSlotName: "Créneau 20h" },
      ]);

      // Act
      const res = await request(app)
        .post("/api/participants/import")
        .field("type", "zombie")
        .attach("file", buffer, "participants.xlsx");

      // Assert — createTimeSlot ne doit PAS être appelé
      expect(res.status).toBe(200);
      expect(storage.createTimeSlot).not.toHaveBeenCalled();
      expect(storage.createParticipant).toHaveBeenCalledWith(
        expect.objectContaining({ timeSlotId: 1 })
      );
    });

    it("should handle a completely empty Excel file (only header row) without error", async () => {
      // Arrange — fichier valide mais sans données (juste la ligne header)
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      const buffer = buildParticipantsImportBuffer([]); // aucune ligne de données

      // Act
      const res = await request(app)
        .post("/api/participants/import")
        .field("type", "zombie")
        .attach("file", buffer, "participants.xlsx");

      // Assert — doit répondre 200 avec count = 0
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(storage.createParticipant).not.toHaveBeenCalled();
    });

    it("should ignore timeSlotName column if missing from rows", async () => {
      // Arrange — colonnes firstName + lastName seulement
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      // Construire manuellement un xlsx sans colonne timeSlotName
      const wsData = [
        { firstName: "firstName", lastName: "lastName" },
        { firstName: "Frank", lastName: "Undead" },
      ];
      const ws = xlsx.utils.json_to_sheet(wsData, {
        skipHeader: true,
        header: ["firstName", "lastName"],
      });
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
      const buffer = Buffer.from(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }));

      // Act
      const res = await request(app)
        .post("/api/participants/import")
        .field("type", "zombie")
        .attach("file", buffer, "participants.xlsx");

      // Assert — timeSlotId doit être null (pas de crash)
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(storage.createParticipant).toHaveBeenCalledWith(
        expect.objectContaining({ timeSlotId: null })
      );
    });

  });

  describe("Import POST /api/data/import-all — contrat comportement", () => {

    it("should return 400 when no file is attached", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      // Act
      const res = await request(app).post("/api/data/import-all");

      // Assert
      expect(res.status).toBe(400);
    });

    it("should return { message, stats } JSON after successful import", async () => {
      // Arrange
      const app = await buildApp(adminUser);

      const buffer = buildImportAllBuffer({
        timeSlots: [
          { name: "Créneau A", type: "zombie", mealTime: "20h", briefingTime: "19h30", gameTime: "21h", exitTime: "23h" },
        ],
        squads: [
          { number: 1, type: "zombie", maxMembers: 8 },
        ],
        participants: [
          { firstName: "Alice", lastName: "Zombie", type: "zombie" },
        ],
      });

      // Act
      const res = await request(app)
        .post("/api/data/import-all")
        .attach("file", buffer, "data.xlsx");

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: expect.any(String),
        stats: expect.objectContaining({
          imported: expect.any(Number),
          errors: expect.any(Number),
        }),
      });
    });

    it("should import time slots from Créneaux sheet when present", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      const buffer = buildImportAllBuffer({
        timeSlots: [
          { name: "Slot Test", type: "zombie", mealTime: "20h", briefingTime: "19h30", gameTime: "21h", exitTime: "23h" },
        ],
      });

      // Act
      await request(app)
        .post("/api/data/import-all")
        .attach("file", buffer, "data.xlsx");

      // Assert — createTimeSlot appelé avec les champs corrects
      expect(storage.createTimeSlot).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Slot Test", type: "zombie" })
      );
    });

    it("should import squads from Squads sheet when present", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      const buffer = buildImportAllBuffer({
        squads: [{ number: 7, type: "survivant", maxMembers: 6 }],
      });

      // Act
      await request(app)
        .post("/api/data/import-all")
        .attach("file", buffer, "data.xlsx");

      // Assert
      expect(storage.createSquad).toHaveBeenCalledWith(
        expect.objectContaining({ number: 7, type: "survivant" })
      );
    });

    it("should import participants from Participants sheet when present", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      const buffer = buildImportAllBuffer({
        participants: [{ firstName: "Grace", lastName: "Shamble", type: "zombie" }],
      });

      // Act
      await request(app)
        .post("/api/data/import-all")
        .attach("file", buffer, "data.xlsx");

      // Assert
      expect(storage.createParticipant).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: "Grace", lastName: "Shamble", type: "zombie" })
      );
    });

    it("should skip participant rows missing firstName, lastName or type", async () => {
      // Arrange
      const app = await buildApp(adminUser);
      const { storage } = await import("../../server/storage");

      const buffer = buildImportAllBuffer({
        participants: [
          { firstName: "",      lastName: "X",       type: "zombie" },    // firstName vide
          { firstName: "Y",     lastName: "",         type: "survivant" }, // lastName vide
          { firstName: "Valid", lastName: "Row",      type: "zombie" },    // valide
        ],
      });

      // Act
      await request(app)
        .post("/api/data/import-all")
        .attach("file", buffer, "data.xlsx");

      // Assert
      expect(storage.createParticipant).toHaveBeenCalledTimes(1);
    });

    it("should process a file with no matching sheets without error (empty workbook)", async () => {
      // Arrange — workbook vide (aucune feuille connue)
      const app = await buildApp(adminUser);

      const wb = xlsx.utils.book_new();
      // Ajouter une feuille inconnue pour que xlsx.write accepte le workbook
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet([]), "IrrelevantSheet");
      const buffer = Buffer.from(xlsx.write(wb, { type: "buffer", bookType: "xlsx" }));

      // Act
      const res = await request(app)
        .post("/api/data/import-all")
        .attach("file", buffer, "data.xlsx");

      // Assert — doit répondre 200 avec stats.imported = 0
      expect(res.status).toBe(200);
      expect(res.body.stats.imported).toBe(0);
    });

  });

});
