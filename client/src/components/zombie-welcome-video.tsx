import { useEffect, useRef, useState } from "react";
import { briefingChoices, displayWelcomeTime, squadChoices, zombieOverlays, zombieTimeline } from "./zombie-welcome-timeline";
import cues from "./zombie-voice-cues.json";
import "./zombie-welcome-video.css";

const assetRoot = "/accueil-zombies/";
const files = ["zombies_boucle_intro_1080p.mp4", "zombies_video_principale_1080p.mp4", "voix_repliques.m4a"] as const;
const voiceCues: Record<string, number[]> = cues;
type Phase = "loading" | "ready" | "intro" | "main" | "ended" | "error";
type Quiz = { kind: "briefing" | "squad"; choices: string[]; correct: string };

interface Props {
  names: string[];
  briefing: string;
  start: string;
  end: string;
  squad: number;
  otherTimes: string[];
  squadCount: number;
  onBack: () => void;
  onContinue: (completed: boolean) => void;
}

export function ZombieWelcomeVideo({ names, briefing, start, end, squad, otherTimes, squadCount, onBack, onContinue }: Props) {
  const [sources, setSources] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [nameIndex, setNameIndex] = useState(0);
  const [overlay, setOverlay] = useState<keyof typeof zombieOverlays>();
  const [quiz, setQuiz] = useState<Quiz>();
  const [wrong, setWrong] = useState<string[]>([]);
  const [correct, setCorrect] = useState(false);
  const [resumeNeeded, setResumeNeeded] = useState(false);
  const intro = useRef<HTMLVideoElement>(null);
  const main = useRef<HTMLVideoElement>(null);
  const voice = useRef<HTMLAudioElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const nextCue = useRef(0);
  const stopVoice = useRef<() => void>(() => {});
  const feedbackTimer = useRef<number>();
  const disposed = useRef(false);
  const introActive = useRef(false);
  const answerLocked = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const urls: string[] = [];
    disposed.current = false;
    // Read complete files from the PWA precache. Blob URLs also support media seeking offline.
    void Promise.all(files.map(async file => {
      const response = await fetch(assetRoot + file, { signal: controller.signal });
      if (!response.ok) throw new Error("Média indisponible");
      const blob = await response.blob();
      if (controller.signal.aborted || !blob.type.match(/^(video|audio)\//)) throw new Error("Média indisponible");
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return url;
    })).then(result => {
      if (controller.signal.aborted) return;
      setSources(result);
      setPhase("ready");
    }).catch(() => {
      if (!controller.signal.aborted) setPhase("error");
    });
    const fullscreenStage = stage.current;
    const videoElements = [intro.current, main.current, voice.current];
    return () => {
      disposed.current = true;
      controller.abort();
      stopVoice.current();
      videoElements.forEach(media => { if (media && !media.paused) media.pause(); });
      window.clearTimeout(feedbackTimer.current);
      urls.forEach(url => URL.revokeObjectURL(url));
      if (fullscreenStage && document.fullscreenElement === fullscreenStage) void document.exitFullscreen?.()?.catch(() => {});
    };
  }, []);

  function resume() {
    if (disposed.current) return;
    setResumeNeeded(false);
    if (main.current) main.current.muted = false;
    void main.current?.play()?.catch(() => {
      if (!disposed.current) setResumeNeeded(true);
    });
  }

  function startMain() {
    if (!introActive.current) return;
    introActive.current = false;
    intro.current?.pause();
    setPhase("main");
    resume();
  }

  useEffect(() => {
    if (phase !== "intro") return;
    const synthesis = window.speechSynthesis;
    const french = synthesis?.getVoices().find(item => item.localService && /^fr(?:[-_]|$)/i.test(item.lang));
    let advanced = false;
    let utterance: SpeechSynthesisUtterance | undefined;
    const advance = () => {
      if (advanced || !introActive.current) return;
      advanced = true;
      if (nameIndex + 1 >= names.length) startMain();
      else setNameIndex(nameIndex + 1);
    };
    let fallbackTimer: number | undefined;
    const timeout = window.setTimeout(advance, french ? 6000 : 2400);
    if (french && names[nameIndex] && typeof SpeechSynthesisUtterance !== "undefined") {
      utterance = new SpeechSynthesisUtterance(`Bonjour ${names[nameIndex]} !`);
      utterance.voice = french;
      utterance.lang = french.lang;
      utterance.onend = advance;
      utterance.onerror = () => {
        window.clearTimeout(timeout);
        fallbackTimer = window.setTimeout(advance, 2400);
      };
      synthesis.speak(utterance);
    }
    return () => {
      advanced = true;
      window.clearTimeout(timeout);
      window.clearTimeout(fallbackTimer);
      if (utterance) {
        utterance.onend = utterance.onerror = null;
        synthesis.cancel();
      }
    };
  }, [phase, nameIndex, names]);

  function begin() {
    introActive.current = true;
    setPhase("intro");
    void intro.current?.play()?.catch(() => {});
    for (const media of [main.current, voice.current]) {
      if (!media) continue;
      media.muted = true;
      void media.play()?.then(() => {
        if (introActive.current) media.pause();
      }).catch(() => {});
    }
    void stage.current?.requestFullscreen?.()?.catch(() => {});
  }

  function playVoice(key: string): Promise<void> {
    stopVoice.current();
    const audio = voice.current;
    const cue = voiceCues[key];
    if (!audio || !cue) return Promise.resolve();
    const [startAt, length] = cue;
    return new Promise(resolve => {
      let frame = 0;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        audio.pause();
        audio.removeEventListener("loadedmetadata", play);
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
        resolve();
      };
      const track = () => {
        if (audio.currentTime >= startAt + length || audio.ended) finish();
        else frame = window.requestAnimationFrame(track);
      };
      const play = () => {
        try {
          audio.currentTime = startAt;
          audio.muted = false;
          void audio.play()?.catch(finish);
          frame = window.requestAnimationFrame(track);
        } catch {
          finish();
        }
      };
      const timeout = window.setTimeout(finish, length * 1000 + 2500);
      stopVoice.current = finish;
      if (audio.readyState >= 1) play();
      else audio.addEventListener("loadedmetadata", play, { once: true });
    });
  }

  function updateTimeline() {
    const video = main.current;
    if (phase !== "main" || !video) return;
    const current = video.currentTime;
    setOverlay((Object.keys(zombieOverlays) as (keyof typeof zombieOverlays)[]).find(key => {
      const [from, until] = zombieOverlays[key];
      return current >= from && current < until;
    }));
    const cue = zombieTimeline[nextCue.current];
    if (!cue || video.paused || video.seeking || video.currentTime < cue.time) return;

    nextCue.current++;
    video.pause();
    video.currentTime = cue.time;
    if (cue.kind === "quizBriefing" || cue.kind === "quizSquad") {
      const isBriefing = cue.kind === "quizBriefing";
      answerLocked.current = false;
      setWrong([]);
      setCorrect(false);
      setQuiz(isBriefing
        ? { kind: "briefing", correct: briefing, choices: briefingChoices(briefing, otherTimes) }
        : { kind: "squad", correct: String(squad), choices: squadChoices(squad, squadCount) });
      void playVoice(isBriefing ? "q_briefing" : "q_squad");
      return;
    }
    const announce = async () => {
      const key = (value: string) => value.replace(":", "");
      if (cue.kind === "briefing") await playVoice(`briefing_${key(briefing)}`);
      if (cue.kind === "squad") await playVoice(`squad_${squad}`);
      if (cue.kind === "game") {
        await playVoice(`debut_${key(start)}`);
        if (!disposed.current) await playVoice(`fin_${key(end)}`);
      }
      resume();
    };
    void announce();
  }

  function answer(value: string) {
    if (!quiz || answerLocked.current || wrong.includes(value)) return;
    if (value !== quiz.correct) {
      setWrong(previous => [...previous, value]);
      void playVoice(Math.random() < 0.5 ? "ko_1" : "ko_2");
      return;
    }
    answerLocked.current = true;
    setCorrect(true);
    const feedback = new Promise<void>(resolve => { feedbackTimer.current = window.setTimeout(resolve, 1300); });
    void Promise.all([feedback, playVoice(`ok_${1 + Math.floor(Math.random() * 3)}`)]).then(() => {
      if (disposed.current) return;
      setQuiz(undefined);
      resume();
    });
  }

  const timelineUpdate = useRef(updateTimeline);
  timelineUpdate.current = updateTimeline;
  useEffect(() => {
    if (phase !== "main") return;
    let frame = 0;
    const tick = () => {
      timelineUpdate.current();
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  const visible = (key: keyof typeof zombieOverlays) => phase === "main" && overlay === key;

  return (
    <section className="zombie-show" aria-label="Présentation vidéo Zombies">
      <div ref={stage} className="zombie-show-stage">
        <div className="zombie-show-frame">
          <video ref={intro} hidden={phase !== "intro"} muted loop playsInline preload="auto" src={sources[0]} />
          <video ref={main} hidden={phase !== "main"} playsInline preload="auto" src={sources[1]}
            onTimeUpdate={updateTimeline} onEnded={() => { if (phase === "main") setPhase("ended"); }}
            onError={() => setPhase("error")} />
          <audio ref={voice} preload="auto" src={sources[2]} />
          {phase === "loading" && <p className="zombie-show-message" role="status">Chargement de la vidéo…</p>}
          {phase === "error" && <div className="zombie-show-center">
            <p role="status">Vidéo indisponible</p>
            <button type="button" onClick={() => onContinue(false)}>Continuer vers le récapitulatif</button>
          </div>}
          {phase === "ready" && <div className="zombie-show-center"><button type="button" onClick={begin}>Lancer la présentation</button></div>}
          {phase === "intro" && <>
            <div className="zombie-show-name" key={nameIndex}><span>Bienvenue</span><strong>{names[nameIndex]}</strong></div>
            <button type="button" className="zombie-show-skip" onClick={startMain}>Passer</button>
          </>}
          {visible("briefing") && <div className="zombie-show-card"><span>Votre briefing</span><strong>{displayWelcomeTime(briefing)}</strong><small>à côté du stand maquillage</small></div>}
          {visible("squad") && <div className="zombie-show-card"><span>Votre squad</span><strong>N° {squad}</strong></div>}
          {visible("game") && <div className="zombie-show-card zombie-show-game"><span>Le jeu</span>
            <div>Début <strong>{displayWelcomeTime(start)}</strong></div>
            <div>Fin vers <strong>{displayWelcomeTime(end)}</strong></div>
          </div>}
          {quiz && phase === "main" && <div className="zombie-show-center zombie-show-quiz">
            <h3>{quiz.kind === "briefing" ? "À quelle heure est votre briefing ?" : "Quel est le numéro de votre squad ?"}</h3>
            <div className="zombie-show-choices">
              {quiz.choices.map(value => <button key={value} type="button" disabled={correct || wrong.includes(value)}
                data-answer={wrong.includes(value) ? "wrong" : correct && value === quiz.correct ? "correct" : undefined}
                onClick={() => answer(value)}>{quiz.kind === "briefing" ? displayWelcomeTime(value) : value}</button>)}
            </div>
            <p role="status">{correct ? "Bien joué !" : wrong.length ? "Essayez encore." : ""}</p>
          </div>}
          {phase === "main" && resumeNeeded && !quiz && <div className="zombie-show-center"><button type="button" onClick={resume}>Reprendre la vidéo</button></div>}
          {phase === "main" && <button type="button" className="zombie-show-skip" onClick={() => onContinue(false)}>Passer la présentation</button>}
          {phase === "ended" && <div className="zombie-show-center"><button type="button" onClick={() => onContinue(true)}>Groupe suivant</button></div>}
        </div>
      </div>
      {phase !== "ended" && <div className="zombie-show-controls">
        <button type="button" onClick={onBack}>Squads</button>
        <button type="button" onClick={() => onContinue(false)}>Passer la présentation</button>
      </div>}
    </section>
  );
}
