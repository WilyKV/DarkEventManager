/**
 * Tests TDD — Phase Rouge — MOD-6 : parseUserRoles tolérante aux deux formes
 *
 * CONTEXTE :
 *   Dans client/src/lib/auth.tsx, la fonction `parseUserRoles` (non exportée,
 *   définie en closure dans AuthProvider) fait :
 *     const rolesList = JSON.parse(userData.roles || '[]');
 *   Après la correction serveur (MOD-6), `roles` dans la réponse JSON sera
 *   déjà un `string[]` — appeler `JSON.parse(array)` lancera une exception
 *   ou produira un résultat inattendu.
 *
 * CONTRAT CIBLE :
 *   La logique de parsing doit être TOLÉRANTE aux DEUX formes :
 *     - Si `roles` est déjà un `string[]` → l'utiliser directement
 *     - Si `roles` est une string JSON → faire JSON.parse
 *   Dans les deux cas, le résultat doit être `["admin"]` (ou le tableau attendu).
 *
 * NOTE CRITIQUE POUR LE DEVELOPER :
 *   `parseUserRoles` N'EST PAS EXPORTÉE depuis client/src/lib/auth.tsx.
 *   Elle est définie comme closure dans `AuthProvider`.
 *   Pour que ces tests fonctionnent, le developer DOIT :
 *     Option A (recommandée) : extraire et exporter `parseUserRoles` :
 *       export function parseUserRoles(userData: { roles: string | string[] }): { ..., rolesList: string[] }
 *     Option B : exporter une fonction utilitaire `parseRoles(roles: string | string[]): string[]`
 *       et faire que `parseUserRoles` l'appelle.
 *   Ces tests importent `parseUserRoles` depuis le module — ils ÉCHOUENT
 *   aujourd'hui car l'export n'existe pas.
 *
 * POURQUOI CES TESTS ÉCHOUENT EN L'ÉTAT :
 *   1. `parseUserRoles` n'est pas exportée → import échoue
 *   2. Même si elle était exportée, `JSON.parse(["admin"])` retourne `"admin"`
 *      (JSON.parse convertit l'array en string via .toString()) — le résultat
 *      serait une string, pas un tableau.
 *
 * Environment : jsdom (tests/client/ → projet "client" dans vitest.config.ts)
 */

import { describe, it, expect } from "vitest";

// IMPORT QUI ÉCHOUE AUJOURD'HUI — parseUserRoles n'est pas exportée
// Le developer doit l'exporter depuis auth.tsx pour que les tests passent.
import { parseUserRoles } from "../../client/src/lib/auth";

// ---------------------------------------------------------------------------
// Types minimaux reproduisant l'interface User de auth.tsx
// ---------------------------------------------------------------------------

interface UserWithStringRoles {
  id: number;
  username: string;
  roles: string; // string JSON brute — forme actuelle (avant MOD-6)
}

interface UserWithArrayRoles {
  id: number;
  username: string;
  roles: string[]; // tableau JS — forme cible (après MOD-6 serveur)
}

// ---------------------------------------------------------------------------
// 1. Forme actuelle : roles est une string JSON (rétro-compatibilité)
// ---------------------------------------------------------------------------

describe("parseUserRoles — tolérance rétro-compat : roles en string JSON", () => {
  it("should parse roles string array '[\"admin\"]' into string[]", () => {
    // Arrange
    const userData: UserWithStringRoles = {
      id: 1,
      username: "alice",
      roles: '["admin"]',
    };

    // Act
    // ÉCHOUE AUJOURD'HUI : parseUserRoles n'est pas exportée
    const result = parseUserRoles(userData as any);

    // Assert
    expect(result.rolesList).toEqual(["admin"]);
    expect(Array.isArray(result.rolesList)).toBe(true);
  });

  it("should parse roles string '[\"admin\",\"staff_zombie\"]' into string[]", () => {
    // Arrange
    const userData: UserWithStringRoles = {
      id: 1,
      username: "alice",
      roles: '["admin","staff_zombie"]',
    };

    // Act
    const result = parseUserRoles(userData as any);

    // Assert
    expect(result.rolesList).toEqual(["admin", "staff_zombie"]);
    expect(result.rolesList).toHaveLength(2);
  });

  it("should return empty array when roles is '[]' string", () => {
    // Arrange
    const userData: UserWithStringRoles = {
      id: 2,
      username: "bob",
      roles: "[]",
    };

    // Act
    const result = parseUserRoles(userData as any);

    // Assert
    expect(result.rolesList).toEqual([]);
    expect(Array.isArray(result.rolesList)).toBe(true);
  });

  it("should return empty array when roles is undefined or null (defensive)", () => {
    // Arrange
    const userData = {
      id: 3,
      username: "charlie",
      roles: undefined as any,
    };

    // Act
    const result = parseUserRoles(userData);

    // Assert
    expect(result.rolesList).toEqual([]);
    expect(Array.isArray(result.rolesList)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Forme cible : roles est déjà un string[] (après correction MOD-6 serveur)
// ---------------------------------------------------------------------------

describe("parseUserRoles — tolérance nouvelle forme : roles déjà en string[]", () => {
  it("should use roles as-is when already a string[] (no JSON.parse)", () => {
    // Arrange — forme renvoyée par le serveur après correction MOD-6
    const userData: UserWithArrayRoles = {
      id: 1,
      username: "alice",
      roles: ["admin"],
    };

    // Act
    // ÉCHOUE AUJOURD'HUI de deux façons :
    //   1. parseUserRoles n'est pas exportée
    //   2. JSON.parse(["admin"]) → JSON.parse("admin") → SyntaxError ou "admin" string
    const result = parseUserRoles(userData as any);

    // Assert — doit retourner ["admin"], PAS planter ni retourner une string
    expect(result.rolesList).toEqual(["admin"]);
    expect(Array.isArray(result.rolesList)).toBe(true);
  });

  it("should use multi-role array as-is when roles is already string[]", () => {
    // Arrange
    const userData: UserWithArrayRoles = {
      id: 1,
      username: "alice",
      roles: ["admin", "staff_zombie"],
    };

    // Act
    const result = parseUserRoles(userData as any);

    // Assert
    expect(result.rolesList).toEqual(["admin", "staff_zombie"]);
    expect(result.rolesList).toHaveLength(2);
  });

  it("should return empty array when roles is already an empty array []", () => {
    // Arrange
    const userData: UserWithArrayRoles = {
      id: 2,
      username: "bob",
      roles: [],
    };

    // Act
    const result = parseUserRoles(userData as any);

    // Assert
    expect(result.rolesList).toEqual([]);
    expect(Array.isArray(result.rolesList)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Invariants — le résultat doit toujours être un string[]
// ---------------------------------------------------------------------------

describe("parseUserRoles — invariants (les deux formes doivent produire le même résultat)", () => {
  it("should produce identical rolesList whether roles comes as string or array", () => {
    // Arrange — même données, deux formes d'entrée
    const userWithStringRoles = {
      id: 1,
      username: "alice",
      roles: '["admin","staff_zombie"]', // forme actuelle serveur
    };

    const userWithArrayRoles = {
      id: 1,
      username: "alice",
      roles: ["admin", "staff_zombie"], // forme cible après MOD-6
    };

    // Act
    const resultFromString = parseUserRoles(userWithStringRoles as any);
    const resultFromArray = parseUserRoles(userWithArrayRoles as any);

    // Assert — les deux doivent donner le même résultat
    expect(resultFromString.rolesList).toEqual(resultFromArray.rolesList);
    expect(resultFromString.rolesList).toEqual(["admin", "staff_zombie"]);
    expect(resultFromArray.rolesList).toEqual(["admin", "staff_zombie"]);
  });

  it("should always return rolesList as a proper JavaScript array (not a string)", () => {
    // Arrange
    const inputs = [
      { id: 1, username: "a", roles: '["admin"]' },      // string form
      { id: 2, username: "b", roles: ["admin"] },         // array form
      { id: 3, username: "c", roles: "[]" },              // empty string form
      { id: 4, username: "d", roles: [] },                // empty array form
    ];

    for (const input of inputs) {
      // Act
      const result = parseUserRoles(input as any);

      // Assert — JAMAIS une string, TOUJOURS un tableau
      expect(Array.isArray(result.rolesList)).toBe(true);
      expect(typeof result.rolesList).not.toBe("string");
    }
  });

  it("should preserve other user fields unchanged", () => {
    // Arrange
    const userData = {
      id: 42,
      username: "dave",
      roles: '["staff_repas"]',
    };

    // Act
    const result = parseUserRoles(userData as any);

    // Assert — les autres champs ne sont pas mutés
    expect(result.id).toBe(42);
    expect(result.username).toBe("dave");
  });
});
