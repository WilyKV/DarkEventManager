/**
 * Tests de caractérisation — shared/aggregate-types.ts
 *
 * Vérifie que AGGREGATE_TYPES contient exactement les 5 valeurs attendues,
 * dans l'ordre exact, et que AggregateType les représente correctement.
 */

import { describe, it, expect } from "vitest";
import { AGGREGATE_TYPES } from "../../shared/aggregate-types";

describe("AGGREGATE_TYPES", () => {
  it("should contain exactly 5 aggregate types", () => {
    expect(AGGREGATE_TYPES).toHaveLength(5);
  });

  it("should contain 'participant' as first element", () => {
    expect(AGGREGATE_TYPES[0]).toBe("participant");
  });

  it("should contain 'purchase' as second element", () => {
    expect(AGGREGATE_TYPES[1]).toBe("purchase");
  });

  it("should contain 'meal_purchase' as third element", () => {
    expect(AGGREGATE_TYPES[2]).toBe("meal_purchase");
  });

  it("should contain 'squad' as fourth element", () => {
    expect(AGGREGATE_TYPES[3]).toBe("squad");
  });

  it("should contain 'discount' as fifth element", () => {
    expect(AGGREGATE_TYPES[4]).toBe("discount");
  });

  it("should equal exactly ['participant', 'purchase', 'meal_purchase', 'squad', 'discount'] in that order", () => {
    expect(AGGREGATE_TYPES).toEqual([
      "participant",
      "purchase",
      "meal_purchase",
      "squad",
      "discount",
    ]);
  });

  it("should not include any type outside the 5 expected values", () => {
    // Vérifie qu'aucune valeur inconnue n'est présente dans le tableau
    const expected = ["participant", "purchase", "meal_purchase", "squad", "discount"];
    for (const value of AGGREGATE_TYPES) {
      expect(expected).toContain(value);
    }
  });
});
