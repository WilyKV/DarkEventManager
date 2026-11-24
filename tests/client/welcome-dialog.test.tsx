import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeDialog } from "@/components/welcome-dialog";
import type { CheckInPlayer, CheckInRoster } from "@shared/check-in";

function player(id: number, firstName: string, lastName: string, overrides: Partial<CheckInPlayer> = {}): CheckInPlayer {
  return { id, firstName, lastName, type: "zombie", timeSlotId: 1, arrived: false, returned: false,
    revision: String(id), details: { squadId: null, checklist: {} }, ...overrides };
}

const clara = player(1, "Clara", "Martin");
const lucie = player(2, "Lucie", "Évrard", { details: { squadId: 2, checklist: {} } });
const paul = player(3, "Paul", "Martin");
const roster: CheckInRoster = {
  players: [paul, clara, lucie,
    player(4, "Gaël", "Durand", { timeSlotId: 2 }),
    player(5, "Mia", "Martin", { type: "survivant", timeSlotId: 3 }),
    player(6, "Aline", "Borel", { type: "staff", timeSlotId: null }),
    player(7, "Sam", "Sorti", { returned: true, details: { squadId: 1, checklist: {} } }),
  ],
  slots: [
    { id: 2, type: "zombie", name: "Vague 20 h", briefingTime: "20:00", gameTime: "21:00" },
    { id: 1, type: "zombie", name: "Vague 18 h", mealTime: "17:45", briefingTime: "18:00", gameTime: "19:00", exitTime: "22:00",
      welcomeNotes: { meal: "Repas à la buvette.", briefing: "Rendez-vous sous le préau.",
        game: "Départ au portail vert.", exit: "Retour par le parking.", other: "Récupérez vos sacs en repartant." } },
    { id: 3, type: "survivant", name: "Vague des survivants", briefingTime: "17:00", gameTime: "18:00" },
  ],
  teams: [
    { id: 1, number: 2, timeSlotId: 1, maxMembers: 8, members: 1, briefing: "Rendez-vous au portail nord." },
    { id: 2, number: 3, timeSlotId: 1, maxMembers: 1, members: 1 },
  ],
};

type User = ReturnType<typeof userEvent.setup>;
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (user: User, name: string | RegExp) => user.click(button(name));

async function begin(user: User, quantity = 1) {
  await click(user, "Zombie");
  await click(user, quantity === 1 ? "1 personne" : `${quantity} personnes`);
  await click(user, "Choisir les personnes");
}

async function reviewArrival(user: User) {
  await click(user, "Passer la présentation");
  await click(user, "Vérifier les arrivées");
}

beforeEach(() => sessionStorage.clear());

describe("Accueil tactile", () => {
  it("filtre par profil, par vague et par initiale et conserve la sélection entre les lettres", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<WelcomeDialog roster={roster} onClose={vi.fn()} onSave={onSave} />);
    expect(button("Survivant")).toBeVisible();
    expect(button("Staff")).toBeVisible();

    await click(user, "Zombie");
    expect(screen.getByText("Zombie · Vague 18 h")).toBeVisible();
    expect(within(screen.getByRole("group", { name: "Nombre de personnes" })).getAllByRole("button")).toHaveLength(8);
    await click(user, "2 personnes");
    await click(user, "Choisir les personnes");
    expect(button("Commencer l’accueil")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Martin/ })).toBeNull();

    await click(user, "M");
    const players = within(screen.getByRole("list", { name: "Personnes à accueillir" })).getAllByRole("button");
    expect(players[0]).toHaveTextContent("Martin Clara");
    expect(players[1]).toHaveTextContent("Martin Paul");
    expect(players).toHaveLength(2);
    await click(user, /Martin Clara/);
    await click(user, "E");
    await click(user, /Évrard Lucie/);
    expect(button(/Évrard Lucie/)).toHaveAttribute("aria-pressed", "true");
    await click(user, "M");
    expect(button(/Martin Clara/)).toHaveAttribute("aria-pressed", "true");
    expect(button(/Martin Paul/)).toBeDisabled();

    const search = screen.getByRole("searchbox");
    await user.type(search, "durand gaël");
    expect(screen.getByText("Aucun résultat.")).toBeVisible();
    await user.clear(search);
    await user.type(search, "lucie evrard");
    expect(button(/Évrard Lucie/)).toHaveAttribute("aria-pressed", "true");
    await click(user, "Voir ma sélection");
    expect(button(/Martin Clara/)).toBeVisible();
    await click(user, "Commencer l’accueil");

    const recommended = button(/Squad 2.*Recommandée/);
    expect(recommended).toHaveTextContent("7 places libres");
    expect(button("Confirmer la squad")).toBeDisabled();
    const members = button("Membres · Squad 2 · 1");
    expect(members).toHaveTextContent("1 / 8");
    await user.click(members);
    expect(members).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("list", { name: "Membres · Squad 2" })).getByText("Sam Sorti")).toBeVisible();
    expect(recommended).toHaveAttribute("aria-pressed", "false");
    await user.click(recommended);
    await click(user, "Confirmer la squad");
    expect(screen.getByText("Bonjour Clara ! Bonjour Lucie !")).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
    await reviewArrival(user);
    await click(user, "Valider les 2 arrivées");
    expect(await screen.findByText("2 personnes accueillies.")).toBeVisible();
    expect(onSave.mock.calls.map(([person, details]) => [person.id, details.squadId])).toEqual([[1, 1], [2, 1]]);

    await click(user, "Nouveau groupe");
    expect(screen.getByText("Zombie · Vague 18 h")).toBeVisible();
    await click(user, "Clôturer la vague");
    expect(screen.getByText("Zombie · Vague 20 h")).toBeVisible();
    await click(user, "Choisir les personnes");
    await click(user, "D");
    expect(button(/Durand Gaël/)).toBeVisible();
    expect(button("M")).toBeDisabled();
  });

  it("retrouve la vague active après fermeture du dialogue", async () => {
    const user = userEvent.setup();
    const props = { roster, onClose: vi.fn(), onSave: vi.fn() };
    const first = render(<WelcomeDialog {...props} />);
    await click(user, "Zombie");
    await click(user, "Clôturer la vague");
    first.unmount();
    render(<WelcomeDialog {...props} />);
    await click(user, "Zombie");
    expect(screen.getByText("Zombie · Vague 20 h")).toBeVisible();
    await click(user, "Clôturer la vague");
    expect(screen.getByText(/Toutes les vagues sont terminées/)).toBeVisible();
  });

  it("permet de saisir plus de huit personnes sans afficher d’autres vagues", async () => {
    const user = userEvent.setup();
    render(<WelcomeDialog roster={{ ...roster, players: Array.from({ length: 15 }, (_, i) => player(i + 20, `Prénom ${i}`, "Martin")) }}
      onClose={vi.fn()} onSave={vi.fn()} />);
    await click(user, "Zombie");
    await click(user, "Plus de 8");
    const number = screen.getByRole("spinbutton", { name: "Nombre de personnes" });
    await user.clear(number);
    await user.type(number, "15");
    await click(user, "Choisir les personnes");
    expect(screen.getByText("0 sur 15 sélectionnées")).toBeVisible();
  });

  it("permet de garder le staff sans créneau et limite le choix aux profils autorisés", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<WelcomeDialog roster={roster} profileTypes={["staff"]} onSave={onSave} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Zombie" })).toBeNull();
    await click(user, "Staff");
    expect(screen.getByText("Staff · Sans créneau")).toBeVisible();
    await click(user, "Choisir les personnes");
    await click(user, "B");
    await click(user, /Borel Aline/);
    await click(user, "Commencer l’accueil");
    expect(screen.getByText("Bonjour Aline !")).toBeVisible();
    await reviewArrival(user);
    await click(user, "Valider l’arrivée");
    expect(await screen.findByText("1 personne accueillie.")).toBeVisible();
  });

  it("permet de confirmer un dépassement avant l’enregistrement local groupé", async () => {
    const user = userEvent.setup();
    const onSaveOfflineGroup = vi.fn();
    render(<WelcomeDialog roster={roster} onClose={vi.fn()} onSaveOfflineGroup={onSaveOfflineGroup} />);
    await begin(user, 2);
    await click(user, "M");
    await click(user, /Martin Clara/);
    await click(user, /Martin Paul/);
    await click(user, "Commencer l’accueil");
    await click(user, /Squad 3.*Complète/);
    expect(button("Confirmer la squad")).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Confirmer le dépassement/ }));
    await click(user, "Confirmer la squad");
    await reviewArrival(user);
    await click(user, "Valider les 2 arrivées");
    expect(onSaveOfflineGroup).toHaveBeenCalledTimes(1);
    expect(onSaveOfflineGroup.mock.calls[0][0].map(({ player, details, overflowConfirmed }: {
      player: CheckInPlayer; details: CheckInPlayer["details"]; overflowConfirmed: boolean;
    }) => [player.id, details.squadId, overflowConfirmed])).toEqual([[1, 2, true], [3, 2, true]]);
  });

  it("reprend un enregistrement en ligne partiel sans renvoyer les fiches déjà enregistrées", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Serveur indisponible")).mockResolvedValueOnce(undefined);
    render(<WelcomeDialog roster={roster} onClose={vi.fn()} onSave={onSave} />);
    await begin(user, 2);
    await click(user, "M");
    await click(user, /Martin Clara/);
    await click(user, /Martin Paul/);
    await click(user, "Commencer l’accueil");
    await click(user, /Squad 2.*Recommandée/);
    await click(user, "Confirmer la squad");
    await reviewArrival(user);
    await click(user, "Valider les 2 arrivées");
    expect(await screen.findByRole("alert")).toHaveTextContent("Serveur indisponible");
    await click(user, "Réessayer");
    expect(await screen.findByText("2 personnes accueillies.")).toBeVisible();
    expect(onSave.mock.calls.map(([person]) => person.id)).toEqual([1, 3, 3]);
  });

  it("conserve les confirmations existantes et permet de les corriger", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const previous = { ...clara, arrived: true, details: { squadId: 1,
      checklist: { squadExplained: true, mealTicketGiven: true, briefingExplained: true } } };
    render(<WelcomeDialog roster={{ ...roster, players: [previous] }} onClose={vi.fn()} onSave={onSave} />);
    await begin(user);
    await click(user, "M");
    await click(user, /Martin Clara/);
    await click(user, "Commencer l’accueil");
    await click(user, "Confirmer la squad");
    await click(user, "Passer la présentation");
    const card = screen.getByRole("checkbox", { name: "Remettre la carte participant" });
    const water = screen.getByRole("checkbox", { name: "Donner la bouteille d’eau" });
    expect(card).toBeChecked();
    expect(water).not.toBeChecked();
    await user.click(card);
    await user.click(water);
    expect(card).not.toBeChecked();
    expect(water).toBeChecked();
    await click(user, "Vérifier les arrivées");
    await click(user, "Valider l’arrivée");
    expect(onSave).toHaveBeenCalledWith(previous, {
      squadId: 1, checklist: { squadExplained: true, mealTicketGiven: false, briefingExplained: true, waterBottleGiven: true },
    }, false);
  });
});
