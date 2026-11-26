import { Maximize, Minimize, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { briefingChoices, displayWelcomeTime, shuffle, squadChoices, zombieBriefingLocation, zombieOverlays, zombieQuestions, zombieQuizStart } from "./zombie-welcome-timeline";
import cues from "./zombie-voice-cues.json";
import "./zombie-welcome-video.css";

const assetRoot = "/accueil-zombies/";
const files = ["zombies_video_principale_1080p.mp4", "voix_quiz.m4a"] as const;
const voiceCues: Record<string, number[]> = cues;
const feedbackClips = {
  correct: ["ok_1", "ok_2", "ok_3"],
  incorrect: ["ko_1", "ko_2", "ko_3", "ko_4", "ko_5", "ko_6"],
} as const;

function feedbackClip(result: keyof typeof feedbackClips) {
  const clips = feedbackClips[result];
  return clips[Math.floor(Math.random() * clips.length)];
}

type Phase = "loading" | "ready" | "main" | "ended" | "error";
type Quiz = { index: number; choices: string[]; correct: string };

interface Props {
  briefing: string;
  start: string;
  end: string;
  squad: number;
  otherTimes: string[];
  squadCount: number;
  onBack: () => void;
  onContinue: (completed: boolean) => void;
}

function playbackTime(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function ZombieWelcomeVideo({ briefing, start, end, squad, otherTimes, squadCount, onBack, onContinue }: Props) {
  const [sources, setSources] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [overlay, setOverlay] = useState<keyof typeof zombieOverlays>();
  const [quiz, setQuiz] = useState<Quiz>();
  const [wrong, setWrong] = useState<string[]>([]);
  const [correct, setCorrect] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [resumeNeeded, setResumeNeeded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const mutedRef = useRef(false);
  const quizComplete = useRef(false);
  const main = useRef<HTMLVideoElement>(null);
  const voice = useRef<HTMLAudioElement>(null);
  const stage = useRef<HTMLElement>(null);
  const quizStarted = useRef(false);
  const stopVoice = useRef<() => void>(() => {});
  const feedbackTimer = useRef<number>();
  const disposed = useRef(false);
  const answerLocked = useRef(false);
  const playback = useRef(0);

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
    const videoElements = [main.current, voice.current];
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

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement === stage.current && document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }
    // Expand immediately, including on browsers that delay or refuse native fullscreen.
    setExpanded(true);
    const element = stage.current;
    if (element?.requestFullscreen) {
      try {
        await element.requestFullscreen();
        if (document.fullscreenElement === element) setExpanded(false);
      } catch {
        // The viewport-sized player remains available.
      }
    }
  }

  function restart() {
    playback.current++;
    window.clearTimeout(feedbackTimer.current);
    stopVoice.current();
    quizStarted.current = false;
    quizComplete.current = false;
    setPosition(0);
    answerLocked.current = false;
    setQuiz(undefined);
    setWrong([]);
    setCorrect(false);
    setOverlay(undefined);
    if (main.current) main.current.currentTime = 0;
    setPhase("main");
    resume();
  }

  function resume() {
    if (disposed.current) return;
    setResumeNeeded(false);
    if (main.current) main.current.muted = mutedRef.current;
    void main.current?.play()?.catch(() => {
      if (!disposed.current) setResumeNeeded(true);
    });
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (main.current) main.current.muted = next;
    if (voice.current) voice.current.muted = next;
  }

  function togglePlayback() {
    const video = main.current;
    if (!video || quiz) return;
    if (video.paused) resume();
    else video.pause();
  }

  function seek(seconds: number) {
    const video = main.current;
    if (!video || !Number.isFinite(seconds)) return;
    const limit = quizComplete.current ? duration : Math.min(duration, zombieQuizStart);
    const target = Math.min(Math.max(0, seconds), limit);
    if (quiz && target >= zombieQuizStart) return;
    if (quiz) {
      playback.current++;
      window.clearTimeout(feedbackTimer.current);
      stopVoice.current();
      quizStarted.current = false;
      setQuiz(undefined);
    }
    video.currentTime = target;
    setPosition(target);
    if (quiz) resume();
  }

  function begin() {
    void toggleFullscreen();
    const audio = voice.current;
    if (audio) {
      audio.muted = true;
      void audio.play()?.then(() => {
        audio.pause();
        audio.muted = mutedRef.current;
      }).catch(() => {});

    }
    setPhase("main");
    resume();
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
          audio.muted = mutedRef.current;
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
    if (quizStarted.current || video.paused || video.seeking || current < zombieQuizStart) return;
    quizStarted.current = true;
    video.pause();
    video.currentTime = zombieQuizStart;
    setPosition(zombieQuizStart);
    askQuestion(0);
  }

  function askQuestion(index: number) {
    const { kind, audio } = zombieQuestions[index];
    const options = {
      briefing: () => ({ correct: briefing, choices: briefingChoices(briefing, otherTimes) }),
      location: () => ({ correct: zombieBriefingLocation, choices: shuffle([
        zombieBriefingLocation, "À la buvette", "Au stand Arrivée", "Près des jerricans",
      ]) }),
      squad: () => ({ correct: String(squad), choices: squadChoices(squad, squadCount) }),
    }[kind]();
    answerLocked.current = false;
    setWrong([]);
    setCorrect(false);
    setQuiz({ index, ...options });
    void playVoice(audio);
  }

  function answer(value: string) {
    if (!quiz || answerLocked.current || wrong.includes(value)) return;
    if (value !== quiz.correct) {
      setWrong(previous => [...previous, value]);
      void playVoice(feedbackClip("incorrect"));
      return;
    }
    answerLocked.current = true;
    const attempt = playback.current;
    setCorrect(true);
    const feedback = new Promise<void>(resolve => { feedbackTimer.current = window.setTimeout(resolve, 1300); });
    void Promise.all([feedback, playVoice(feedbackClip("correct"))]).then(() => {
      if (disposed.current || attempt !== playback.current) return;
      if (quiz.index + 1 < zombieQuestions.length) askQuestion(quiz.index + 1);
      else {
        quizComplete.current = true;
        setQuiz(undefined);
        resume();
      }
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
    <section ref={stage} className="zombie-show" data-expanded={expanded || undefined} aria-label="Présentation vidéo Zombies">
      <div className="zombie-show-stage">
        <div className="zombie-show-frame">
          <video ref={main} hidden={phase !== "ready" && phase !== "main"} playsInline preload="auto" src={sources[0]}
            onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
            onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
            onTimeUpdate={event => { setPosition(event.currentTarget.currentTime); updateTimeline(); }} onEnded={() => { if (phase === "main") setPhase("ended"); }}
            onError={() => setPhase("error")} />
          <audio ref={voice} preload="auto" src={sources[1]} />
          {phase === "loading" && <p className="zombie-show-message" role="status">Chargement de la vidéo…</p>}
          {phase === "error" && <div className="zombie-show-center">
            <p role="status">Vidéo indisponible</p>
            <button type="button" onClick={() => onContinue(false)}>Continuer vers le récapitulatif</button>
          </div>}
          {phase === "ready" && <div className="zombie-show-center"><button type="button" onClick={begin}><Maximize className="mr-2 inline size-5" aria-hidden /> Lancer en plein écran</button></div>}
          {visible("briefing") && <div className="zombie-show-card"><span>Votre briefing</span><strong>{displayWelcomeTime(briefing)}</strong><small>{zombieBriefingLocation}</small></div>}
          {visible("squad") && <div className="zombie-show-card"><span>Votre squad</span><strong>N° {squad}</strong></div>}
          {visible("game") && <div className="zombie-show-card zombie-show-game"><span>Le jeu</span>
            <div>Début <strong>{displayWelcomeTime(start)}</strong></div>
            <div>Fin vers <strong>{displayWelcomeTime(end)}</strong></div>
          </div>}
          {quiz && phase === "main" && <div className="zombie-show-center zombie-show-quiz">
            <h3>{zombieQuestions[quiz.index].label}</h3>
            <div className="zombie-show-choices" data-question={zombieQuestions[quiz.index].kind}>
              {quiz.choices.map(value => <button key={value} type="button" disabled={correct || wrong.includes(value)}
                data-answer={wrong.includes(value) ? "wrong" : correct && value === quiz.correct ? "correct" : undefined}
                onClick={() => answer(value)}>{zombieQuestions[quiz.index].kind === "briefing" ? displayWelcomeTime(value) : value}</button>)}
            </div>
            <p role="status">{correct ? "Bien joué !" : wrong.length ? "Essayez encore." : ""}</p>
          </div>}
          {phase === "main" && resumeNeeded && !quiz && <div className="zombie-show-center"><button type="button" onClick={resume}>Reprendre la vidéo</button></div>}
          {phase === "ended" && <div className="zombie-show-center"><button type="button" onClick={() => onContinue(true)}>Groupe suivant</button></div>}
        </div>
      </div>
      <div className="zombie-show-controls" role="group" aria-label="Commandes de la présentation">
        {phase === "main" && <>
          <label className="zombie-show-progress">
            <span className="sr-only">Position de lecture</span>
            <input type="range" min={0} max={quizComplete.current ? duration : Math.min(duration, zombieQuizStart)}
              step="any" value={Math.min(position, quizComplete.current ? duration : Math.min(duration, zombieQuizStart))} disabled={!duration}
              aria-valuetext={playbackTime(position)} onChange={event => seek(event.target.valueAsNumber)} />
            <span aria-hidden="true">{playbackTime(position)} / {playbackTime(duration)}</span>
          </label>
          <button type="button" onClick={togglePlayback} disabled={Boolean(quiz)} aria-label={paused ? "Lire la vidéo" : "Mettre en pause"}
            title={paused ? "Lire la vidéo" : "Mettre en pause"}>
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => seek((main.current?.currentTime ?? position) - 10)}
            aria-label="Reculer de 10 secondes" title="Reculer de 10 secondes">
            <SkipBack aria-hidden="true" />
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted ? "Rétablir le son" : "Couper le son"}
            title={muted ? "Rétablir le son" : "Couper le son"} aria-pressed={muted}>
            {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </button>
        </>}
        {phase !== "ended" && <button type="button" onClick={onBack}>Squads</button>}
        {phase !== "ended" && <button type="button" onClick={() => onContinue(false)}>
          <SkipForward aria-hidden="true" /> Passer la présentation
        </button>}
        {(phase === "main" || phase === "ended") && <button type="button" onClick={restart} aria-label="Recommencer la vidéo" title="Recommencer la vidéo">
          <RotateCcw aria-hidden="true" />
        </button>}
        {(phase === "main" || phase === "ended") && <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen || expanded ? "Quitter le plein écran" : "Plein écran"}
          title={fullscreen || expanded ? "Quitter le plein écran" : "Plein écran"} aria-pressed={fullscreen || expanded}>
          {fullscreen || expanded ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
        </button>}
      </div>
    </section>
  );
}
