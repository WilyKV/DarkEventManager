import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SouvenirPhotoDialog } from "@/components/souvenir-photo-dialog";

it("propose tous les profils et retrouve une personne par son nom, même sans saisir l’accent", async () => {
  const user = userEvent.setup();
  render(<SouvenirPhotoDialog players={[
    { id: 1, firstName: "Clara", lastName: "Évrard", type: "zombie" },
    { id: 2, firstName: "Aline", lastName: "Borel", type: "staff" },
    { id: 3, firstName: "Mia", lastName: "Martin", type: "survivant" },
  ]} onClose={vi.fn()} onSave={vi.fn()} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  await user.click(screen.getByRole("button", { name: "E", exact: true }));
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: /Évrard Clara/ }));
  expect(screen.getByLabelText("Prendre ou choisir la photo")).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Liste des participants" }));
  await user.type(screen.getByRole("searchbox"), "clara evrard");
  expect(screen.getByRole("button", { name: /Évrard Clara/ })).toBeVisible();
});
