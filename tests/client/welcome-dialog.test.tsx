import React, { useState } from "react";
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
    { id: 1, name: "Vague 18 h", mealTime: "17:45", briefingTime: "18:00", gameTime: "19:00", exitTime: "22:00",
      welcomeNotes: { meal: "Repas à la buvette.", briefing: "Rendez-vous sous le préau.",
        game: "Départ au portail vert.", exit: "Retour par le parking.", other: "Récupérez vos sacs en repartant." } },
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
    expect(screen.getByRole("button", { name: /Équipe 3.*Complète/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Équipe 2.*Recommandée/ }));
    await user.click(screen.getByRole("button", { name: "Équipe présentée" }));
    expect(screen.getByText("18:00")).toBeVisible();
    expect(screen.getByText("22:00")).toBeVisible();
    expect(screen.getByText("Rendez-vous au portail nord.")).toBeVisible();
    expect(screen.getByText("Rendez-vous sous le préau.")).toBeVisible();
    expect(screen.getByText("Départ au portail vert.")).toBeVisible();
    expect(screen.getByText("Retour par le parking.")).toBeVisible();
    expect(screen.queryByText("Repas à la buvette.")).toBeNull();
    expect(screen.queryByRole("region", { name: "Autre" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Briefing expliqué" }));
    expect(screen.getByText("17:45")).toBeVisible();
    expect(screen.getByText("Repas à la buvette.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Passer cette étape" }));
    await user.click(screen.getByRole("button", { name: "Bouteille d’eau remise" }));
    await user.click(screen.getByRole("button", { name: "Attente maquillage expliquée" }));
    await user.click(screen.getByRole("button", { name: "Passer cette étape" }));
    expect(within(screen.getByRole("region", { name: "Autre" })).getByText("Récupérez vos sacs en repartant.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Remettre le ticket repas À faire/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Proposer une carte Facultatif/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Enregistrer et continuer" }));
    expect(await screen.findByRole("heading", { name: "Gaël Durand" })).toBeVisible();
    expect(screen.getByText("Étape 1 sur 3")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continuer sans équipe" }));
    await user.click(screen.getByRole("button", { name: "Briefing expliqué" }));
    await user.click(screen.getByRole("button", { name: "Passer cette étape" }));
    expect(screen.queryByRole("region", { name: "Autre" })).toBeNull();
    expect(screen.queryByRole("button", { name: /maquillage/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Enregistrer et continuer" }));
    expect(await screen.findByRole("heading", { name: "Aline Borel" })).toBeVisible();
    expect(screen.queryByRole("list", { name: "Équipes du créneau" })).toBeNull();
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

  it("recommande l’équipe qui peut se remplir avec le groupe compatible et reprend le choix après une sauvegarde", async () => {
    const user = userEvent.setup();
    const first = roster.players[0];
    const second = { ...first, id: 5, firstName: "Louise" };
    const assigned = { ...first, id: 6, firstName: "Morgan", details: { ...first.details, squadId: 10 } };
    const save = vi.fn();
    function Session() {
      const [active, setActive] = useState<CheckInRoster>({
        ...roster,
        players: [first, second, assigned, roster.players[1]],
        teams: [
          { id: 10, number: 1, timeSlotId: 1, maxMembers: 8, members: 7 },
          { id: 11, number: 2, timeSlotId: 1, maxMembers: 8, members: 3 },
          { id: 12, number: 3, timeSlotId: 1, maxMembers: 8, members: 6 },
          { id: 13, number: 4, timeSlotId: 1, maxMembers: 8, members: 6, type: "survivant" },
          { id: 14, number: 5, timeSlotId: 1, maxMembers: null, members: 9 },
        ],
      });
      return <WelcomeDialog roster={active} onClose={vi.fn()} onSave={async (player, details) => {
        save(player.id, details.squadId);
        setActive(previous => ({
          ...previous,
          teams: previous.teams.map(team => ({
            ...team, members: team.members + Number(team.id === details.squadId) - Number(team.id === player.details.squadId),
          })),
        }));
      }} />;
    }
    render(<Session />);
    await user.click(screen.getByRole("button", { name: "4 personnes" }));
    await user.click(screen.getByRole("button", { name: "Choisir les personnes" }));
    for (const name of [/Élodie Martin/, /Louise Martin/, /Morgan Martin/, /Gaël Durand/]) {
      await user.click(screen.getByRole("button", { name }));
    }
    await user.click(screen.getByRole("button", { name: "Commencer l’accueil" }));
    const cards = within(screen.getByRole("list", { name: "Équipes du créneau" }));
    const suggested = cards.getByRole("button", { name: /Équipe 3.*Recommandée/ });
    expect(cards.getAllByRole("button")[0]).toBe(suggested);
    expect(suggested).toHaveTextContent("6 / 8 affectés");
    expect(suggested).toHaveTextContent("2 places libres");
    expect(cards.queryByRole("button", { name: /Équipe 4/ })).toBeNull();
    expect(cards.getByRole("button", { name: /Équipe 5/ })).toHaveTextContent("Sans limite de places");
    await user.click(cards.getByRole("button", { name: /Équipe 1/ }));
    expect(screen.queryByRole("checkbox", { name: /Proposer cette équipe/ })).toBeNull();
    await user.click(suggested);
    await user.click(screen.getByRole("checkbox", { name: "Proposer cette équipe aux 2 personnes" }));
    await user.click(screen.getByRole("button", { name: "Équipe présentée" }));
    await user.click(screen.getByRole("button", { name: "Voir le récapitulatif" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer et continuer" }));
    expect(await screen.findByRole("heading", { name: "Louise Martin" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Équipe 3.*Choix du groupe/, pressed: true })).toHaveTextContent("7 / 8 affectés");
    await user.click(screen.getByRole("button", { name: "Voir le récapitulatif" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer et continuer" }));
    expect(await screen.findByRole("heading", { name: "Morgan Martin" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Équipe 1/, pressed: true })).toBeVisible();
    expect(screen.getByRole("button", { name: /Équipe 3.*Complète/ })).toBeDisabled();
    expect(save.mock.calls).toEqual([[first.id, 12], [second.id, 12]]);
  });

  it("indique qu’il faut répartir le groupe si aucune équipe ne peut prendre tout le monde", async () => {
    const user = userEvent.setup();
    render(<WelcomeDialog roster={{ ...roster, players: [roster.players[0], { ...roster.players[0], id: 5, firstName: "Louise" }],
      teams: [{ ...roster.teams[0], members: 7 }, roster.teams[1]] }} onClose={vi.fn()} onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "2 personnes" }));
    await user.click(screen.getByRole("button", { name: "Choisir les personnes" }));
    await user.click(screen.getByRole("button", { name: /Élodie Martin/ }));
    await user.click(screen.getByRole("button", { name: /Louise Martin/ }));
    await user.click(screen.getByRole("button", { name: "Commencer l’accueil" }));
    expect(screen.getByText(/Aucune équipe n’a assez de place pour les 2 personnes/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Équipe 2.*Pour ce joueur/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Équipe 3.*Complète/ })).toBeDisabled();
  });
});
