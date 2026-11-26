import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import BadgesPage from "@/pages/badges";

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ hasAnyRole: () => true }) }));
vi.mock("@/components/management-layout", () => ({ ManagementLayout: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/participant-card", () => ({ usePrintableCard: () => ({}), ParticipantCard: () => null, SouvenirPhoto: () => null }));
vi.mock("@/components/data-sync-button", () => ({ DataSyncButton: () => null }));
vi.mock("@/components/admin-souvenir-link", () => ({ AdminSouvenirLink: () => null }));

it("combine les profils, la vague et la squad et garde les sélections précédentes visibles dans le total", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const user = userEvent.setup();
  const wave1 = { id: 1, name: "Vague 1" };
  const wave2 = { id: 2, name: "Vague 2" };
  client.setQueryData(["/api/participants"], [
    { id: 1, firstName: "Clara", lastName: "Martin", type: "zombie", timeSlot: wave1, timeSlotId: 1, squadId: 10, squad: { id: 10, number: 2, type: "zombie" } },
    { id: 2, firstName: "Paul", lastName: "Martin", type: "zombie", timeSlot: wave2, timeSlotId: 2, squadId: 20, squad: { id: 20, number: 2, type: "zombie" } },
    { id: 3, firstName: "Léa", lastName: "Martin", type: "survivant", timeSlot: wave1, timeSlotId: 1, squadId: 30, squad: { id: 30, number: 3, type: "survivant" } },
    { id: 4, firstName: "Sam", lastName: "Martin", type: "staff", timeSlotId: null, squadId: null },
  ]);
  render(<QueryClientProvider client={client}><BadgesPage /></QueryClientProvider>);
  const roster = within(screen.getByRole("region", { name: "Participants à imprimer" }));
  await user.click(roster.getByRole("button", { name: "Zombies" }));
  await user.click(roster.getByRole("button", { name: "Survivants" }));
  expect(roster.getAllByRole("checkbox")).toHaveLength(3);
  await user.selectOptions(roster.getByRole("combobox", { name: "Vague", exact: true }), "1");
  expect(roster.getAllByRole("checkbox")).toHaveLength(2);
  await user.selectOptions(roster.getByRole("combobox", { name: "Squad ou équipe" }), "10");
  expect(roster.getAllByRole("checkbox")).toHaveLength(1);
  await user.click(roster.getByRole("button", { name: "Sélectionner les résultats" }));
  expect(roster.getByRole("checkbox", { name: "Inclure Clara Martin" })).toBeChecked();
  await user.selectOptions(roster.getByRole("combobox", { name: "Vague", exact: true }), "2");
  expect(roster.getByRole("checkbox", { name: "Inclure Paul Martin" })).not.toBeChecked();
  expect(roster.getByRole("status")).toHaveTextContent("1 à imprimer (dont 1 hors des filtres actuels)");
});
