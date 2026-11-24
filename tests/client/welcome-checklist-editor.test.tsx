import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { defaultWelcomeChecklist, welcomeChecklistPath, welcomeChecklistSchema } from "@shared/welcome-checklist";
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
