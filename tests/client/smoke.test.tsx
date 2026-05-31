import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

// Smoke test minimal : vérifie que React Testing Library fonctionne en jsdom
// On utilise un <button> natif pour éviter les dépendances Radix/shadcn
// (le composant Button shadcn charge @radix-ui/react-slot et des CSS tokens)
describe("smoke test client", () => {
  it("rend un bouton et le trouve via son rôle accessible", () => {
    render(<button>Hello</button>);

    const btn = screen.getByRole("button", { name: /hello/i });
    expect(btn).toBeInTheDocument();
  });
});
