import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WelcomeDialog } from "@/components/welcome-dialog";
import type { CheckInRoster } from "@shared/check-in";

const roster: CheckInRoster = {
  players: [
    { id: 1, firstName: "Élodie", lastName: "Martin", type: "zombie", timeSlotId: 1, arrived: false, returned: false,
      revision: "zombie", details: { squadId: null, checklist: {} } },
    { id: 2, firstName: "Gaël", lastName: "Durand", type: "survivant", timeSlotId: 2, arrived: false, returned: false,
      revision: "survivant", details: { squadId: null, checklist: {} } },
    { id: 3, firstName: "Aline", lastName: "Borel", type: "staff", timeSlotId: null, arrived: true, returned: false,
      revision: "staff", details: { squadId: null, checklist: {} } },
    { id: 4, firstName: "Sam", lastName: "Sorti", type: "zombie", timeSlotId: 1, arrived: true, returned: true,
      revision: "sorti", details: { squadId: null, checklist: {} } },
  ],
  slots: [
    { id: 1, name: "Vague 18 h", mealTime: "17:45", briefingTime: "18:00", gameTime: "19:00", exitTime: "22:00" },
    { id: 2, name: "Vague 20 h", briefingTime: "20:00", gameTime: "21:00" },
  ],
  teams: [
    { id: 1, number: 2, timeSlotId: 1, maxMembers: 8, members: 1, briefing: "Rendez-vous au portail nord." },
    { id: 2, number: 3, timeSlotId: 1, maxMembers: 1, members: 1 },
  ],
};

describe("Accueil groupé", () => {
  it("sélectionne le nombre demandé, conserve la sélection entre filtres et ouvre la bonne fiche", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<WelcomeDialog roster={roster} onClose={vi.fn()} onSave={save} />);

    await user.click(screen.getByRole("button", { name: "3 personnes" }));
    await user.click(screen.getByRole("button", { name: "Choisir les personnes" }));
    const begin = screen.getByRole("button", { name: "Commencer l’accueil" });
    expect(begin).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Sam Sorti/ })).toBeNull();
    const players = within(screen.getByRole("list", { name: "Personnes à accueillir" })).getAllByRole("button");
    expect(players[0]).toHaveTextContent("Aline Borel");
    expect(players[1]).toHaveTextContent("Élodie Martin");
    expect(players[2]).toHaveTextContent("Gaël Durand");
    const zombies = screen.getByRole("button", { name: "Zombies", exact: true });
    await user.click(zombies);
    expect(zombies).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: /Gaël Durand/ })).toBeNull();
    await user.click(zombies);
    expect(zombies).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Gaël Durand/ })).toBeVisible();
    await user.type(screen.getByRole("searchbox"), "martin elodie");
    await user.click(screen.getByRole("button", { name: /Élodie Martin/ }));
    await user.clear(screen.getByRole("searchbox"));
    await user.click(screen.getByRole("button", { name: "Survivants", exact: true }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrer par créneau" }), "2");
    await user.click(screen.getByRole("button", { name: /Gaël Durand/ }));
    expect(begin).toBeDisabled();
    expect(screen.getByText("2 sur 3 sélectionnées")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Staff", exact: true }));
    await user.click(screen.getByRole("button", { name: /Aline Borel/ }));
    await user.click(screen.getByRole("button", { name: "Voir ma sélection" }));
    expect(screen.getByRole("button", { name: /Élodie Martin/, pressed: true })).toBeVisible();
    await user.click(begin);

    expect(screen.getByText("Étape 1 sur 6")).toBeVisible();
    expect(screen.getByRole("option", { name: "Équipe 3 (complète)" })).toBeDisabled();
    await user.selectOptions(screen.getByRole("combobox", { name: "Équipe" }), "1");
    await user.click(screen.getByRole("button", { name: "Équipe présentée" }));
    expect(screen.getByText("18:00")).toBeVisible();
    expect(screen.getByText("22:00")).toBeVisible();
    expect(screen.getByText("Rendez-vous au portail nord.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Briefing expliqué" }));
    expect(screen.getByText("17:45")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Passer cette étape" }));
    await user.click(screen.getByRole("button", { name: "Bouteille d’eau remise" }));
    await user.click(screen.getByRole("button", { name: "Attente maquillage expliquée" }));
    await user.click(screen.getByRole("button", { name: "Passer cette étape" }));
    expect(screen.getByRole("button", { name: /Remettre le ticket repas À faire/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Proposer une carte Facultatif/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Enregistrer et continuer" }));
    expect(await screen.findByRole("heading", { name: "Gaël Durand" })).toBeVisible();
    expect(screen.getByText("Étape 1 sur 3")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continuer sans équipe" }));
    await user.click(screen.getByRole("button", { name: "Briefing expliqué" }));
    await user.click(screen.getByRole("button", { name: "Passer cette étape" }));
    expect(screen.queryByRole("button", { name: /maquillage/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Enregistrer et continuer" }));
    expect(await screen.findByRole("heading", { name: "Aline Borel" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Équipe" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Enregistrer et terminer" }));

    expect(await screen.findByText("3 personnes accueillies.")).toBeVisible();
    expect(save.mock.calls.map(([player]) => player.id)).toEqual([1, 2, 3]);
    expect(save).toHaveBeenNthCalledWith(1, roster.players[0], {
      squadId: 1, checklist: { squadExplained: true, briefingExplained: true, waterBottleGiven: true, makeupWaitExplained: true },
    });
    expect(save).toHaveBeenNthCalledWith(2, roster.players[1], { squadId: null, checklist: { briefingExplained: true } });
  });

  it("affiche les profils accessibles même si leur liste est vide", async () => {
    const user = userEvent.setup();
    render(<WelcomeDialog roster={{ ...roster, players: [roster.players[0]] }} onClose={vi.fn()} onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Choisir les personnes" }));
    const filters = within(screen.getByRole("group", { name: "Filtrer par profil" }));
    expect(filters.getAllByRole("button")).toHaveLength(3);
    await user.click(filters.getByRole("button", { name: "Staff" }));
    expect(screen.getByText("Aucun résultat.")).toBeVisible();
  });

  it("conserve la fiche en cours en cas d’erreur d’enregistrement", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValueOnce(new Error("Serveur inaccessible")).mockResolvedValue(undefined);
    render(<WelcomeDialog roster={roster} onClose={vi.fn()} onSave={save} />);
    await user.click(screen.getByRole("button", { name: "Choisir les personnes" }));
    await user.click(screen.getByRole("button", { name: /Élodie Martin/ }));
    expect(screen.getByRole("button", { name: /Gaël Durand/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Commencer l’accueil" }));

    await user.click(screen.getByRole("button", { name: "Voir le récapitulatif" }));
    await user.click(screen.getByRole("button", { name: /Donner la bouteille d’eau À faire/ }));
    await user.click(screen.getByRole("button", { name: "Bouteille d’eau remise" }));
    const submit = screen.getByRole("button", { name: "Enregistrer et terminer" });
    await user.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent("Serveur inaccessible");
    expect(screen.getByRole("button", { name: /Donner la bouteille d’eau Confirmé/ })).toBeVisible();
    await user.click(submit);
    expect(await screen.findByText("1 personne accueillie.")).toBeVisible();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("conserve les confirmations existantes et permet de les corriger depuis le récapitulatif", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    const player = { ...roster.players[0], arrived: true, details: {
      squadId: 1, checklist: { squadExplained: true, mealTicketGiven: true, briefingExplained: true },
    } };
    render(<WelcomeDialog roster={{ ...roster, players: [player] }} onClose={vi.fn()} onSave={save} />);
    await user.click(screen.getByRole("button", { name: "Choisir les personnes" }));
    await user.click(screen.getByRole("button", { name: /Élodie Martin/ }));
    await user.click(screen.getByRole("button", { name: "Commencer l’accueil" }));
    await user.click(screen.getByRole("button", { name: "Voir le récapitulatif" }));
    await user.click(screen.getByRole("button", { name: /Remettre le ticket repas Confirmé/ }));
    await user.click(screen.getByRole("button", { name: "Marquer à faire" }));
    expect(screen.getByRole("button", { name: /Remettre le ticket repas À faire/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Enregistrer et terminer" }));
    expect(save).toHaveBeenCalledWith(player, {
      squadId: 1, checklist: { squadExplained: true, mealTicketGiven: false, briefingExplained: true },
    });
  });
});
