import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ZombieWelcomeVideo } from "@/components/zombie-welcome-video";
import { briefingChoices, squadChoices } from "@/components/zombie-welcome-timeline";

afterEach(() => vi.restoreAllMocks());

it("donne quatre choix uniques, avec les horaires connus en priorité", () => {
  const choices = briefingChoices("00:00", ["00:00", "14:00", "14:00"]);
  expect(new Set(choices).size).toBe(4);
  expect(choices).toEqual(expect.arrayContaining(["00:00", "14:00"]));
  expect(new Set(squadChoices(7, 12)).size).toBe(4);
});

it("garde la vidéo en pause pour les quiz et renvoie vers le récapitulatif après la fin", async () => {
  const user = userEvent.setup();
  const playing = new WeakSet<HTMLMediaElement>();
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("media", { headers: { "Content-Type": "video/mp4" } }));
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL() { return "blob:test"; }
    static revokeObjectURL() {}
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    if (this instanceof HTMLAudioElement) return Promise.reject(new Error("Son désactivé dans le test"));
    playing.add(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    playing.delete(this);
  });
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (this: HTMLMediaElement) {
    return !playing.has(this);
  });
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(1);
  const onContinue = vi.fn();
  const view = render(<ZombieWelcomeVideo briefing="18:00" start="18:30" end="20:00"
    squad={7} otherTimes={["17:45", "18:15", "19:00"]} squadCount={12} onBack={vi.fn()} onContinue={onContinue} />);
  try {
    await user.click(await screen.findByRole("button", { name: "Lancer la présentation" }));
    const video = view.container.querySelector("video")!;
    expect(video.paused).toBe(false);
    expect(view.container.querySelectorAll("video")).toHaveLength(1);
    const reach = (seconds: number) => {
      video.currentTime = seconds;
      fireEvent.timeUpdate(video);
    };
    reach(91.30);
    expect(screen.getByText("Votre briefing")).toBeVisible();
    expect(video.currentTime).toBe(91.30);
    expect(video.paused).toBe(false);
    reach(101.22);
    expect(screen.getByText("Votre squad")).toBeVisible();
    expect(video.paused).toBe(false);

    reach(113.84);
    expect(video.currentTime).toBe(113.83);
    expect(video.paused).toBe(true);
    const wrong = screen.getByRole("button", { name: /17\s+h\s+45/ });
    await user.click(wrong);
    expect(wrong).toBeDisabled();
    expect(wrong).toHaveAttribute("data-answer", "wrong");
    expect(video.paused).toBe(true);
    await user.click(screen.getByRole("button", { name: /18\s+h\s+00/ }));
    const location = await screen.findByRole("button", { name: "À côté du stand maquillage" }, { timeout: 2500 });
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(113.83);
    await user.click(location);
    expect(await screen.findByRole("heading", { name: "Quel est le numéro de votre squad ?" }, { timeout: 2500 })).toBeVisible();
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(113.83);
    await user.click(screen.getByRole("button", { name: "7" }));
    await waitFor(() => expect(video.paused).toBe(false), { timeout: 2500 });

    fireEvent.ended(video);
    await user.click(screen.getByRole("button", { name: "Groupe suivant" }));
    expect(onContinue).toHaveBeenCalledExactlyOnceWith(true);
  } finally {
    view.unmount();
    vi.unstubAllGlobals();
  }
}, 12_000);
