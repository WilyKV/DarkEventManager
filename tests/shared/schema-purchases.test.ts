/**
 * A.6 — TDD Red Phase : schéma Zod insertPurchaseSchema
 *
 * Ces tests spécifient le comportement ATTENDU une fois que le champ
 * `clientEventId` sera ajouté à la table `purchases` dans shared/schema.ts.
 *
 * État actuel (RED) :
 *  - `clientEventId` n'existe PAS encore sur InsertPurchase
 *  - Les tests portant sur ce champ échouent à la compilation (ts-expect-error)
 *    ET à l'exécution (parse réussit alors qu'on attend un échec, ou vice-versa)
 */

import { describe, it, expect } from "vitest";
import { insertPurchaseSchema } from "@shared/schema";
import { z } from "zod";

// Données minimales valides pour un achat (champs obligatoires actuels)
const basePurchase = {
  participantId: 1,
  shopItemId: 2,
  quantity: 1,
  unitPrice: "5.00",
  originalPrice: "5.00",
  totalPrice: "5.00",
};

describe("insertPurchaseSchema", () => {
  describe("champ clientEventId — UUID v4 optionnel", () => {
    it("should accept a valid v4 UUID as clientEventId", () => {
      // Arrange
      const input = {
        ...basePurchase,
        // @ts-expect-error A.6 - clientEventId à ajouter par developer dans shared/schema.ts
        clientEventId: "550e8400-e29b-41d4-a716-446655440000",
      };

      // Act
      // @ts-expect-error A.6 - idem
      const result = insertPurchaseSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject a non-UUID string as clientEventId", () => {
      // Arrange
      const input = {
        ...basePurchase,
        // @ts-expect-error A.6 - clientEventId à ajouter par developer dans shared/schema.ts
        clientEventId: "not-a-uuid",
      };

      // Act
      // @ts-expect-error A.6 - idem
      const result = insertPurchaseSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.errors.map((e) => e.path[0]);
        expect(paths).toContain("clientEventId");
      }
    });

    it("should accept purchase without clientEventId (backward compatibility)", () => {
      // Arrange — aucun clientEventId fourni
      const input = { ...basePurchase };

      // Act
      const result = insertPurchaseSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject an empty string as clientEventId", () => {
      // Arrange
      const input = {
        ...basePurchase,
        // @ts-expect-error A.6 - clientEventId à ajouter par developer dans shared/schema.ts
        clientEventId: "",
      };

      // Act
      // @ts-expect-error A.6 - idem
      const result = insertPurchaseSchema.safeParse(input);

      // Assert — une chaîne vide n'est pas un UUID valide
      expect(result.success).toBe(false);
    });

    it("should reject a UUID that is too short (truncated)", () => {
      // Arrange — UUID tronqué, 35 chars au lieu de 36
      const input = {
        ...basePurchase,
        // @ts-expect-error A.6 - clientEventId à ajouter par developer dans shared/schema.ts
        clientEventId: "550e8400-e29b-41d4-a716-44665544000",
      };

      // Act
      // @ts-expect-error A.6 - idem
      const result = insertPurchaseSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject a UUID that is too long", () => {
      // Arrange — UUID avec caractères supplémentaires
      const input = {
        ...basePurchase,
        // @ts-expect-error A.6 - clientEventId à ajouter par developer dans shared/schema.ts
        clientEventId: "550e8400-e29b-41d4-a716-446655440000-extra",
      };

      // Act
      // @ts-expect-error A.6 - idem
      const result = insertPurchaseSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should accept null as clientEventId (nullable for retro-compat)", () => {
      // Arrange — null explicite signifie "pas d'idempotence voulue"
      const input = {
        ...basePurchase,
        // @ts-expect-error A.6 - clientEventId à ajouter par developer dans shared/schema.ts
        clientEventId: null,
      };

      // Act
      // @ts-expect-error A.6 - idem
      const result = insertPurchaseSchema.safeParse(input);

      // Assert — null doit être autorisé (tablettes non migrées)
      expect(result.success).toBe(true);
    });
  });
});
