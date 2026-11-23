import { expect, it } from "vitest";
import { cardLayout, cardSheet, cardSheetPosition, cardSurnamePrefixes, printedCardName } from "@shared/participant-card";

it("limite le nom imprimé à une initiale et en ajoute une deuxième en cas de collision", () => {
  const people = [
    { id: 1, firstName: "Clara", lastName: "Martin" },
    { id: 2, firstName: "Clara", lastName: "Mercier" },
    { id: 3, firstName: "Élodie", lastName: "Durand" },
    { id: 4, firstName: "Paul", lastName: "Martin" },
    { id: 5, firstName: "Elodie", lastName: "D’Angelo" },
  ];
  const prefixes = cardSurnamePrefixes(people);
  expect(people.map(person => printedCardName({ firstName: person.firstName, surnamePrefix: prefixes.get(person.id)! })))
    .toEqual(["Clara MA.", "Clara ME.", "Élodie DU.", "Paul M.", "Elodie DA."]);
});

it("aligne chaque verso en miroir sur le recto A4, même quand la feuille n’est pas pleine", () => {
  expect(cardSheet.capacity).toBe(10);
  for (let slot = 0; slot < cardSheet.capacity; slot++) {
    const front = cardSheetPosition(slot, "front");
    const back = cardSheetPosition(slot, "back");
    expect(front.x + back.x + cardLayout.width).toBe(cardSheet.width);
    expect(front.y).toBe(back.y);
    expect(front.y + cardLayout.height).toBeLessThan(cardSheet.height);
  }
  expect(cardSheetPosition(0, "back")).toEqual(cardSheetPosition(1, "front"));
});
