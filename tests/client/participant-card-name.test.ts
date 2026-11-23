import { expect, it } from "vitest";
import { cardSurnamePrefixes, printedCardName } from "@shared/participant-card";

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
