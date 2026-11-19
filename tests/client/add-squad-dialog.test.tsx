import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AddSquadDialog } from "@/components/add-squad-dialog";

afterEach(() => vi.restoreAllMocks());

it("crée plus de huit squads par créneau en une opération, avec des numéros propres à chaque créneau", async () => {
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const slots = [{ id: 1, name: "Vague 18 h" }, { id: 2, name: "Vague 20 h" }];
  const squads = [{ timeSlotId: 1, number: 8 }, { timeSlotId: 1, number: 6 }];
  client.setQueryData(["/api/time-slots", { type: "zombie" }], slots);
  client.setQueryData(["/api/squads/with-participants", { type: "zombie" }], squads);

  const fetchApi = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (url === "/api/squads/batch") return Response.json({ created: 24 }, { status: 201 });
    return Response.json(String(url).startsWith("/api/time-slots") ? slots : squads);
  });
  render(<QueryClientProvider client={client}><AddSquadDialog type="zombie" /></QueryClientProvider>);

  await user.click(screen.getByRole("button", { name: "Ajouter des squads" }));
  const quantity = screen.getByRole("spinbutton", { name: /Nombre de squads/ });
  await user.clear(quantity);
  await user.type(quantity, "12");
  expect(quantity).toBeValid();
  expect(screen.getByText(/Prochains numéros 9 à 20/)).toBeVisible();
  expect(screen.getByText(/Prochains numéros 1 à 12/)).toBeVisible();
  for (const { name } of slots) await user.click(screen.getByRole("checkbox", { name }));
  await user.click(screen.getByRole("button", { name: "Créer", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  const writes = fetchApi.mock.calls.filter(([, options]) => options?.method === "POST");
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toBe("/api/squads/batch");
  expect(JSON.parse(String(writes[0][1]?.body))).toEqual({
    type: "zombie", count: 12, maxMembers: 8, briefing: null, slots: [{ id: 1, lastNumber: 8 }, { id: 2, lastNumber: 0 }],
  });
});
