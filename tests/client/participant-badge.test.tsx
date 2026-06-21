import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ParticipantBadge } from "@/components/participant-badge";
import type { ParticipantWithRelations } from "@shared/schema";

// Mock QRCode.toCanvas pour éviter les erreurs canvas en jsdom
vi.mock("qrcode");

function buildParticipant(
  overrides: Partial<ParticipantWithRelations> = {},
): ParticipantWithRelations {
  return {
    id: 1,
    firstName: "Jean",
    lastName: "Dupont",
    type: "zombie",
    secretCode: "12345",
    squadId: null,
    timeSlotId: null,
    email: null,
    phone: null,
    purchasedItems: false,
    hasMeal: false,
    squadExplained: false,
    createdAt: new Date(),
    squad: null,
    timeSlot: null,
    ...overrides,
  } as ParticipantWithRelations;
}

function renderBadge(participant: ParticipantWithRelations) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  // Prépopuler le cache avec les données du participant pour éviter tout fetch réseau
  qc.setQueryData([`/api/participants/${participant.id}`], participant);
  return render(
    <QueryClientProvider client={qc}>
      <ParticipantBadge participant={participant} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  // Mock fetch globalement pour éviter les appels réseau
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({}),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ParticipantBadge — numéro de squad", () => {
  it("affiche le numéro de squad dans le carré blanc quand la squad est assignée", () => {
    const participant = buildParticipant({
      squad: { id: 3, number: 7, name: "Squad 7", timeSlotId: 1, createdAt: new Date() },
      squadId: 3,
    });

    renderBadge(participant);

    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("ne display rien dans le carré blanc quand aucune squad n'est assignée", () => {
    const participant = buildParticipant({ squad: null, squadId: null });

    renderBadge(participant);

    // Le texte "Squad" doit exister (label du bloc), mais aucun chiffre dans le carré
    expect(screen.getByText("Squad")).toBeInTheDocument();
    // Pas de span visible avec un numéro de squad
    const whiteBox = screen.getByText("Squad")
      .closest("div[class*='space-y-2']")
      ?.querySelector(".bg-white.border-2");
    expect(whiteBox?.querySelector("span")).toBeNull();
  });
});
