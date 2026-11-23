import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Droplet, Flag, Paintbrush, Pause, Play, RotateCcw, SkipForward, Users, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckInRoster, CheckInType } from "@shared/check-in";
import type { WelcomeTimeSlot } from "@shared/time-slot-notes";
import { placementLabels } from "./squad-placement";
import type { OfflineArrival } from "./offline-group-welcome";

function localFrenchVoice() {
  return window.speechSynthesis?.getVoices().find(voice => voice.localService && /^fr(?:[-_]|$)/i.test(voice.lang));
}

function spokenTime(time: string) {
  return time.replace(/^(\d{1,2}):(\d{2})(?::\d{2})?$/, (_, hours: string, minutes: string) =>
    `${Number(hours)} heures${minutes === "00" ? "" : ` ${Number(minutes)}`}`);
}

export function WelcomeBriefing({ type, slot, arrivals, teams, onBack, onContinue }: {
  type: CheckInType;
  slot?: WelcomeTimeSlot;
  arrivals: OfflineArrival[];
  teams: CheckInRoster["teams"];
  onBack: () => void;
  onContinue: (completed: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  const [skipped, setSkipped] = useState(false);
  const [voice, setVoice] = useState(localFrenchVoice);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () => setVoice(localFrenchVoice());
    update();
    synth.addEventListener("voiceschanged", update);
    return () => synth.removeEventListener("voiceschanged", update);
  }, []);

  const words = placementLabels(type);
  const teamsById = new Map(teams.map(team => [team.id, team]));
  const namesByTeam = new Map<number, string[]>();
  for (const { player, details } of arrivals) {
    const id = details.squadId;
    if (id === null || !teamsById.has(id)) continue;
    namesByTeam.set(id, [...(namesByTeam.get(id) ?? []), player.firstName]);
  }
  const scenes = [
    { title: "Bienvenue !", Icon: Flag, text: arrivals.map(({ player }) => `Bonjour ${player.firstName} !`).join(" "),
      colors: "from-indigo-950 to-violet-950" },
    ...Array.from(namesByTeam, ([id, names]) => {
      const team = teamsById.get(id)!;
      return { title: `${words.name} ${team.number}`, Icon: Users,
        text: `${names.join(", ")}. Retrouvez votre ${words.noun} après le briefing. ${team.briefing?.trim() ?? ""}`.trim(),
        colors: "from-blue-950 to-indigo-950" };
    }),
    ...type === "zombie" ? [
      { title: "Repas et maquillage", Icon: Paintbrush,
        text: [
          "Présentez votre carte à la buvette pour le repas. Le numéro de passage inscrit sur la carte indique votre ordre de passage au maquillage. Présentez votre carte au stand à votre tour.",
          slot?.mealTime ? `Le repas est prévu à ${spokenTime(slot.mealTime)}.` : "",
          slot?.welcomeNotes?.meal,
        ].filter(Boolean).join(" "),
        colors: "from-rose-950 to-orange-950" },
      { title: "Avant de partir", Icon: Droplet,
        text: "Remplissez votre bouteille aux jerricans avant de partir en jeu. Une carte est disponible si vous souhaitez reconnaître le terrain.",
        colors: "from-cyan-950 to-blue-950" },
    ] : type === "survivant" && slot?.welcomeNotes?.meal ? [{
      title: "Repas", Icon: CalendarClock,
      text: [slot.mealTime ? `Le repas est prévu à ${spokenTime(slot.mealTime)}.` : "", slot.welcomeNotes.meal].filter(Boolean).join(" "),
      colors: "from-cyan-950 to-blue-950",
    }] : [],
    { title: "Les horaires", Icon: CalendarClock,
      text: [
        slot?.briefingTime ? `Soyez prêts pour le briefing à ${spokenTime(slot.briefingTime)}.` : "Vérifiez l’heure du briefing avec l’équipe d’accueil.",
        slot?.welcomeNotes?.briefing,
        slot?.gameTime ? `Le jeu commence à ${spokenTime(slot.gameTime)}.` : "",
        slot?.welcomeNotes?.game,
        slot?.exitTime ? `La sortie est prévue à ${spokenTime(slot.exitTime)}.` : "",
        slot?.welcomeNotes?.exit,
        type !== "staff" ? "Après le jeu, repassez au stand Arrivée pour confirmer votre retour." : "",
        slot?.welcomeNotes?.other,
      ].filter(Boolean).join(" "),
      colors: "from-emerald-950 to-teal-950" },
  ];
  const scene = scenes[Math.min(index, scenes.length - 1)];
  const sceneText = scene.text;
  const finished = index >= scenes.length;

  useEffect(() => {
    if (!playing || finished) return;
    const synth = window.speechSynthesis;
    const spoken = sound && voice && synth && typeof SpeechSynthesisUtterance !== "undefined";
    const duration = Math.max(3000, sceneText.trim().split(/\s+/).length * 430);
    const next = () => setIndex(index + 1);
    let timer = window.setTimeout(next, spoken ? duration * 2 + 5000 : duration);
    if (spoken) {
      const utterance = new SpeechSynthesisUtterance(sceneText);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 0.95;
      utterance.onend = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(next, 450);
      };
      utterance.onerror = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(next, duration);
      };
      synth.speak(utterance);
      return () => {
        utterance.onend = null;
        utterance.onerror = null;
        window.clearTimeout(timer);
        synth.cancel();
      };
    }
    return () => window.clearTimeout(timer);
  }, [sceneText, playing, finished, index, sound, voice]);

  return (
    <section aria-label="Présentation d’accueil" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className={`relative isolate grid min-h-0 flex-1 place-items-center overflow-y-auto rounded-2xl bg-gradient-to-br p-5 text-center text-white sm:p-10 ${scene.colors}`}>
        <div className="pointer-events-none absolute inset-x-4 top-4 flex gap-1.5" aria-hidden>
          {scenes.map((item, i) => <span key={item.title + i}
            className={`h-1 flex-1 rounded-full ${i <= index ? "bg-white" : "bg-white/25"}`} />)}
        </div>
        <div key={index} className="my-5 flex max-w-4xl flex-col items-center gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <span className="grid size-16 place-items-center rounded-2xl bg-white/15 sm:size-24">
            <scene.Icon className="size-9 sm:size-14" strokeWidth={1.5} aria-hidden />
          </span>
          <h3 className="text-3xl font-bold sm:text-6xl">{finished ? "À vous de jouer !" : scene.title}</h3>
          <p aria-live="polite" className="whitespace-pre-line break-words text-lg leading-relaxed text-white/90 sm:text-2xl">
            {finished ? "La présentation est terminée." : sceneText}
          </p>
          {!playing && !finished && <Button type="button" size="lg" onClick={() => setPlaying(true)}><Play /> {index === 0 ? "Lancer la présentation" : "Reprendre"}</Button>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onBack}><ArrowLeft /> {type === "staff" ? "Personnes" : words.plural}</Button>
        {playing && !finished && <Button type="button" variant="outline" onClick={() => setPlaying(false)}><Pause /> Pause</Button>}
        {!finished && <Button type="button" variant="outline" disabled={!playing} onClick={() => { setSkipped(true); setIndex(index + 1); }}><SkipForward /> Suivant</Button>}
        {finished && <Button type="button" variant="outline" onClick={() => { setIndex(0); setSkipped(false); setPlaying(true); }}><RotateCcw /> Rejouer</Button>}
        {voice ? <Button type="button" variant="outline" aria-pressed={sound} onClick={() => setSound(!sound)}>
          {sound ? <Volume2 /> : <VolumeX />} Voix
        </Button> : <span className="text-sm text-muted-foreground">Sous-titres · voix française locale indisponible</span>}
        <Button type="button" className="ml-auto" onClick={() => onContinue(finished && !skipped)}>
          {finished ? "Vérifier l’accueil" : "Passer la présentation"} <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
