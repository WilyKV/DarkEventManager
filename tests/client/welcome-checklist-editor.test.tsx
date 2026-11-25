import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { defaultWelcomeChecklist, welcomeChecklistPath, welcomeChecklistSchema, welcomeOffers } from "@shared/welcome-checklist";
import { WelcomeChecklistEditor } from "@/components/welcome-checklist-editor";

it("enregistre les points masqués et ajoutés dans la checklist partagée", async () => {
  const user = userEvent.setup();
  const client = new QueryClient();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (_path, options) => {
    const settings = welcomeChecklistSchema.parse(JSON.parse(String(options?.body)));
    return Response.json(settings);
  });
  try {
    render(<QueryClientProvider client={client}>
      <WelcomeChecklistEditor settings={defaultWelcomeChecklist} canEdit />
    </QueryClientProvider>);
    await user.click(screen.getByRole("checkbox", { name: "Proposer une carte" }));
    await user.type(screen.getByRole("textbox", { name: "Nouveau point" }), "Montrer le point de rassemblement");
    await user.type(screen.getByRole("textbox", { name: "Détail à rappeler" }), "Près du portail vert.");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer la checklist" }));
    await waitFor(() => expect(client.getQueryData([welcomeChecklistPath])).toMatchObject({
      hidden: ["mapGiven"],
      extra: [{ title: "Montrer le point de rassemblement", note: "Près du portail vert." }],
    }));
    await user.click(screen.getByRole("button", { name: "Supprimer le point Montrer le point de rassemblement" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer la checklist" }));
    await waitFor(() => expect(client.getQueryData([welcomeChecklistPath])).toEqual({ hidden: ["mapGiven"], extra: [] }));
    expect(fetch).toHaveBeenLastCalledWith(welcomeChecklistPath, expect.objectContaining({ method: "PATCH" }));
  } finally {
    fetch.mockRestore();
    client.clear();
  }
});

it("préconfigure les offres pour la vague sélectionnée", async () => {
  const user = userEvent.setup();
  const client = new QueryClient();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (_path, options) =>
    Response.json(welcomeChecklistSchema.parse(JSON.parse(String(options?.body)))),
  );
  try {
    render(<QueryClientProvider client={client}>
      <WelcomeChecklistEditor canEdit wave={{ id: 1, name: "Vague 1" }}
        settings={{ ...defaultWelcomeChecklist, prefilledOffersByWave: { 2: [welcomeOffers[1].id] } }} />
    </QueryClientProvider>);
    const manga = screen.getByRole("checkbox", { name: welcomeOffers[0].title });
    expect(manga).not.toBeChecked();
    await user.click(manga);
    await user.click(screen.getByRole("button", { name: "Enregistrer la checklist" }));
    await waitFor(() => expect(client.getQueryData([welcomeChecklistPath])).toMatchObject({
      prefilledOffersByWave: { 1: [welcomeOffers[0].id], 2: [welcomeOffers[1].id] },
    }));
  } finally {
    fetch.mockRestore();
    client.clear();
  }
});
