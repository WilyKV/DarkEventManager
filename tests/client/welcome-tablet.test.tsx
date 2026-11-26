import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import WelcomeTabletPage from "@/pages/welcome-tablet";
import { makeTabletReceipt, makeTabletTransfer, readTabletQr } from "@/components/welcome-tablet-transfer";

const sent = vi.hoisted(() => ({ code: "" }));
vi.mock("@/components/qr-code-scanner", () => ({
  QRCodeScanner: ({ onScan }: { onScan: (value: string) => void }) =>
    <button type="button" onClick={() => onScan(sent.code)}>Simuler un scan</button>,
}));
vi.mock("@/components/zombie-welcome-video", () => ({
  ZombieWelcomeVideo: ({ briefing, squad, onContinue }: { briefing: string; squad: number; onContinue: (done: boolean) => void }) =>
    <button type="button" onClick={() => onContinue(true)}>Terminer squad {squad} à {briefing}</button>,
}));

afterEach(() => vi.unstubAllGlobals());

it("reçoit un groupe par QR et produit un accusé local sans requête réseau", async () => {
  const user = userEvent.setup();
  const transfer = makeTabletTransfer({ briefing: "18:00", start: "19:00", end: "22:00", squad: 2, otherTimes: ["20:00"], squadCount: 6 });
  const fetch = vi.fn().mockRejectedValue(new Error("Hors ligne"));
  vi.stubGlobal("fetch", fetch);
  render(<WelcomeTabletPage />);
  sent.code = "https://example.com/souvenir/participant";
  await user.click(screen.getByRole("button", { name: "Simuler un scan" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Ce QR ne correspond pas");
  sent.code = JSON.stringify(transfer);
  await user.click(screen.getByRole("button", { name: "Simuler un scan" }));
  await user.click(screen.getByRole("button", { name: "Terminer squad 2 à 18:00" }));
  expect(screen.getByRole("heading", { name: "Présentation terminée" })).toBeVisible();
  expect(readTabletQr(makeTabletReceipt(transfer))).toEqual({ kind: "zombin-tablet-done-v1", id: transfer.id });
  expect(screen.getByText("QR de fin de présentation")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Groupe suivant" }));
  expect(screen.getByRole("heading", { name: "Écran d’accueil Zombies" })).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

it("écarte les QR invalides et limite le transfert aux paramètres de présentation", () => {
  const payload = { briefing: "18:00", start: "19:00", end: "22:00", squad: 2, otherTimes: [], squadCount: 6, firstName: "Clara" };
  const transfer = makeTabletTransfer(payload);
  expect(JSON.stringify(transfer)).not.toContain("Clara");
  expect(readTabletQr(JSON.stringify({ ...transfer, end: "29:00" }))).toBeUndefined();
});
