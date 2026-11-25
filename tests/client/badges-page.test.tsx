import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import BadgesPage from "@/pages/badges";

vi.mock("@/components/management-layout", () => ({
  ManagementLayout: ({ children, title }: { children: ReactNode; title: string }) => (
    <main><h1>{title}</h1>{children}</main>
  ),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ hasAnyRole: () => true }) }));

it("ouvre l’onglet Cartes avec le lien de téléchargement du modèle", () => {
  const client = new QueryClient();
  client.setQueryData(["/api/participants"], [{ id: 1, firstName: "Clara", lastName: "Martin", type: "zombie" }]);
  render(<QueryClientProvider client={client}><BadgesPage /></QueryClientProvider>);

  expect(screen.getByRole("heading", { name: "Cartes participants" })).toBeVisible();
  const template = screen.getByRole("link", { name: /Modèle vierge/ }) as HTMLAnchorElement;
  const defaultTemplate = new URL(template.href);
  expect(defaultTemplate.pathname).toBe("/api/participant-cards/template");
  expect(Object.fromEntries(defaultTemplate.searchParams)).toEqual({ layout: "a4", origin: window.location.origin, type: "zombie" });
  fireEvent.change(screen.getByLabelText("Profil du modèle vierge"), { target: { value: "staff" } });
  expect(new URL(template.href).searchParams.get("type")).toBe("staff");
  expect(screen.getByRole("button", { name: "Clara Martin" })).toBeVisible();
  expect(screen.getByRole("link", { name: /Voir l’espace souvenir.*Clara Martin/ })).toHaveAttribute("href", "/souvenir/admin/1");
});
