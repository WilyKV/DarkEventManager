/**
 * Tests TDD — Red Phase
 *
 * MED-1 : requireRole() doit utiliser un match STRICT (égalité exacte dans un tableau),
 * pas un substring match.
 *
 * Bug actuel (server/auth-middleware.ts:26) :
 *   const hasRole = roles.some(role => (userRoles as unknown as string).includes(role));
 *   → Cast en string + .includes() → substring match.
 *   → Exemples de bypass :
 *     - user.roles = ["staff_zombie"], requireRole("zombie") → passe (FAUX POSITIF)
 *     - user.roles = ["super_admin"],  requireRole("admin")  → passe (FAUX POSITIF)
 *     - user.roles = ["staff_admin"],  requireRole("admin")  → passe (FAUX POSITIF)
 *
 * Solution attendue : Array.isArray(userRoles) && userRoles.includes(role)
 * ou : userRoles.some(r => r === role)
 *
 * Note sur la gestion du format JSON-encoded string dans la session :
 *   D'après CLAUDE.md, users.roles est JSON-encoded en string dans la session.
 *   Le developer devra normaliser userRoles via JSON.parse si typeof userRoles === 'string'.
 *   Les tests couvrent les deux formats (array natif et JSON string).
 */

import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole } from "../../server/auth-middleware";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit un Request Express fictif avec une session utilisateur.
 * @param roles - tableau de rôles (stocké nativement comme tableau)
 */
function buildRequest(roles: string[] | string | null): Partial<Request> {
  return {
    session: {
      user: {
        id: 1,
        username: "test_user",
        roles: roles as any,
      },
    } as any,
  };
}

/**
 * Exécute le middleware requireRole et retourne le statut simulé.
 * Retourne "next" si next() est appelé, sinon le code de statut HTTP.
 */
function runMiddleware(
  req: Partial<Request>,
  ...roles: string[]
): { outcome: "next" | number; body?: unknown } {
  let outcome: "next" | number = "next";
  let body: unknown;

  const mockNext = vi.fn(() => {
    outcome = "next";
  });

  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn((data) => {
      body = data;
      return mockRes;
    }),
  } as unknown as Response;

  // Capturer le code de statut
  (mockRes.status as any).mockImplementation((code: number) => {
    outcome = code;
    return mockRes;
  });

  requireRole(...roles)(req as Request, mockRes, mockNext as unknown as NextFunction);

  return { outcome, body };
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

describe("requireRole() — match strict", () => {

  // -------------------------------------------------------------------------
  // 1. Cas de base — match exact
  // -------------------------------------------------------------------------

  describe("match exact", () => {

    it("should call next() when user has exactly the required role", () => {
      // Arrange
      const req = buildRequest(["admin"]);

      // Act
      const { outcome } = runMiddleware(req, "admin");

      // Assert
      expect(outcome).toBe("next");
    });

    it("should call next() when user has multiple roles including the required one", () => {
      // Arrange — tableau avec le rôle requis parmi d'autres
      const req = buildRequest(["staff_zombie", "admin"]);

      // Act
      const { outcome } = runMiddleware(req, "admin");

      // Assert
      expect(outcome).toBe("next");
    });

    it("should call next() when user has the required staff role exactly", () => {
      // Arrange
      const req = buildRequest(["staff_zombie"]);

      // Act
      const { outcome } = runMiddleware(req, "staff_zombie");

      // Assert
      expect(outcome).toBe("next");
    });

  });

  // -------------------------------------------------------------------------
  // 2. Substring NON-match — cas critiques du bug MED-1
  // -------------------------------------------------------------------------

  describe("substring — doit retourner 403 (pas de substring match)", () => {

    it("should return 403 when user has staff_zombie but zombie is required", () => {
      // Arrange — "zombie" est une sous-chaîne de "staff_zombie" → faux positif avec .includes()
      const req = buildRequest(["staff_zombie"]);

      // Act
      const { outcome } = runMiddleware(req, "zombie");

      // Assert — le match strict rejette : "staff_zombie" !== "zombie"
      expect(outcome).toBe(403);
    });

    it("should return 403 when user has staff_admin but admin is required", () => {
      // Arrange — "admin" est une sous-chaîne de "staff_admin"
      const req = buildRequest(["staff_admin"]);

      // Act
      const { outcome } = runMiddleware(req, "admin");

      // Assert
      expect(outcome).toBe(403);
    });

    it("should return 403 when user has super_admin but admin is required", () => {
      // Arrange — scénario exact décrit dans MED-1 : futur rôle "super_admin"
      // avec substring match, requireRole('admin') passe pour un super_admin
      const req = buildRequest(["super_admin"]);

      // Act
      const { outcome } = runMiddleware(req, "admin");

      // Assert — "super_admin" !== "admin" → 403
      expect(outcome).toBe(403);
    });

    it("should return 403 when user has staff_repas but staff is required", () => {
      // Arrange — "staff" est une sous-chaîne de "staff_repas"
      const req = buildRequest(["staff_repas"]);

      // Act
      const { outcome } = runMiddleware(req, "staff");

      // Assert
      expect(outcome).toBe(403);
    });

    it("should return 403 when user has admin_plus but admin is required", () => {
      // Arrange — "admin" est un préfixe de "admin_plus"
      const req = buildRequest(["admin_plus"]);

      // Act
      const { outcome } = runMiddleware(req, "admin");

      // Assert
      expect(outcome).toBe(403);
    });

  });

  // -------------------------------------------------------------------------
  // 3. OR entre plusieurs rôles requis
  // -------------------------------------------------------------------------

  describe("plusieurs rôles requis (logique OR)", () => {

    it("should call next() when user has admin and either admin or staff_zombie is required", () => {
      // Arrange
      const req = buildRequest(["admin"]);

      // Act
      const { outcome } = runMiddleware(req, "admin", "staff_zombie");

      // Assert
      expect(outcome).toBe("next");
    });

    it("should call next() when user has staff_zombie and either admin or staff_zombie is required", () => {
      // Arrange
      const req = buildRequest(["staff_zombie"]);

      // Act
      const { outcome } = runMiddleware(req, "admin", "staff_zombie");

      // Assert
      expect(outcome).toBe("next");
    });

    it("should return 403 when user has staff_repas but admin or staff_zombie is required", () => {
      // Arrange
      const req = buildRequest(["staff_repas"]);

      // Act
      const { outcome } = runMiddleware(req, "admin", "staff_zombie");

      // Assert
      expect(outcome).toBe(403);
    });

  });

  // -------------------------------------------------------------------------
  // 4. Tableau de rôles vide
  // -------------------------------------------------------------------------

  describe("rôles vides", () => {

    it("should return 403 when user has an empty roles array", () => {
      // Arrange
      const req = buildRequest([]);

      // Act
      const { outcome } = runMiddleware(req, "admin");

      // Assert
      expect(outcome).toBe(403);
    });

    it("should return 403 when user has empty roles array even with multiple required roles", () => {
      // Arrange
      const req = buildRequest([]);

      // Act
      const { outcome } = runMiddleware(req, "admin", "staff_zombie", "staff_repas");

      // Assert
      expect(outcome).toBe(403);
    });

  });

  // -------------------------------------------------------------------------
  // 5. Cas dégradés — types inattendus pour roles
  // -------------------------------------------------------------------------

  describe("rôles non-array (cas dégradés — pas de crash)", () => {

    it("should return 403 (not crash) when user.roles is null", () => {
      // Arrange
      const req = buildRequest(null);

      // Act + Assert — ne doit pas lever d'exception
      expect(() => runMiddleware(req, "admin")).not.toThrow();
      const { outcome } = runMiddleware(req, "admin");
      expect(outcome).toBe(403);
    });

    it("should return 403 (not crash) when user.roles is undefined", () => {
      // Arrange
      const req: Partial<Request> = {
        session: { user: { id: 1, username: "test" } } as any,
      };

      // Act + Assert
      expect(() => runMiddleware(req, "admin")).not.toThrow();
      const { outcome } = runMiddleware(req, "admin");
      expect(outcome).toBe(403);
    });

    it("should handle JSON-encoded string roles and match the role exactly", () => {
      // Arrange — format réel de la session (d'après CLAUDE.md : roles est JSON-encoded)
      // Le developer doit parser la string si nécessaire
      const req = buildRequest(JSON.stringify(["admin", "staff_zombie"]));

      // Act
      const { outcome } = runMiddleware(req, "admin");

      // Assert — doit parser la string JSON et trouver "admin"
      expect(outcome).toBe("next");
    });

    it("should return 403 for JSON-encoded roles when substring would match but exact does not", () => {
      // Arrange — roles encodés en JSON string, substring du rôle fourni
      const req = buildRequest(JSON.stringify(["staff_zombie"]));

      // Act — cherche "zombie" (sous-chaîne de "staff_zombie")
      const { outcome } = runMiddleware(req, "zombie");

      // Assert — match strict : "staff_zombie" !== "zombie" → 403
      expect(outcome).toBe(403);
    });

  });

  // -------------------------------------------------------------------------
  // 6. Auth manquante
  // -------------------------------------------------------------------------

  describe("utilisateur non authentifié", () => {

    it("should return 401 when session has no user", () => {
      // Arrange
      const req: Partial<Request> = {
        session: {} as any,
      };

      // Act
      const { outcome } = runMiddleware(req, "admin");

      // Assert
      expect(outcome).toBe(401);
    });

    it("should return 401 when session is absent", () => {
      // Arrange
      const req: Partial<Request> = {};

      // Act
      const { outcome } = runMiddleware(req, "admin");

      // Assert
      expect(outcome).toBe(401);
    });

    it("should include a message in the 401 response", () => {
      // Arrange
      const req: Partial<Request> = { session: {} as any };

      // Act
      const { body } = runMiddleware(req, "admin");

      // Assert
      expect((body as any)?.message).toBeTruthy();
    });

  });

  // -------------------------------------------------------------------------
  // 7. Message d'erreur 403
  // -------------------------------------------------------------------------

  describe("message d'erreur 403", () => {

    it("should include a message in the 403 response body", () => {
      // Arrange
      const req = buildRequest(["staff_repas"]);

      // Act
      const { body } = runMiddleware(req, "admin");

      // Assert
      expect((body as any)?.message).toBeTruthy();
    });

  });

});
