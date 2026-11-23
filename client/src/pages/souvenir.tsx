import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, CalendarDays, Clock3, Download, Flag, Images, LockKeyhole, LogOut, Radio, Users } from "lucide-react";
import { cardAssets, cardsPath, souvenirCodeHint, type ParticipantSouvenir } from "@shared/participant-card";
import { SouvenirDeleteAction } from "@/components/souvenir-delete-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "./souvenir.css";

const eventDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });
const parisDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return <div className="souvenir-detail">
    <dt>{icon}{label}</dt>
    <dd>{children}</dd>
  </div>;
}

function SouvenirPortrait({ summary, src, onRemove, busy }: { summary: ParticipantSouvenir; src: string; onRemove?: () => void; busy: boolean }) {
  const [failed, setFailed] = useState(false);
  const hasPhoto = summary.photoAvailable && !failed;
  return <figure className={`souvenir-portrait ${hasPhoto ? "souvenir-portrait--photo" : ""}`}>
    <div className="souvenir-portrait-image">
      {hasPhoto ? <img src={src} alt={`Photo souvenir de ${summary.firstName}`} onError={() => setFailed(true)} />
        : <><img src={`/${cardAssets}/souvenir-unknown.jpg`} alt="" /><span className="souvenir-question" aria-hidden>?</span></>}
    </div>
    <figcaption>
      {hasPhoto ? <a href={src} download="photo-souvenir.jpg"><Download /> Télécharger ma photo</a> : "Aucune photo disponible"}
    </figcaption>
    {summary.photoAvailable && onRemove && <div className="flex justify-center pb-2">
      <SouvenirDeleteAction label="Retirer ma photo" description="Votre photo sera supprimée définitivement de l’espace souvenir."
        disabled={busy} onConfirm={onRemove} />
    </div>}
  </figure>;
}

export default function SouvenirPage({ params }: { params: { token?: string; id?: string } }) {
  return <SouvenirSession key={params.id ? `admin:${params.id}` : params.token} token={params.token} adminId={params.id} />;
}

function SouvenirSession({ token, adminId }: { token?: string; adminId?: string }) {
  const open = `${cardsPath}/open/${encodeURIComponent(token ?? "")}`;
  const view = adminId ? `${cardsPath}/admin/${encodeURIComponent(adminId)}` : `${cardsPath}/view/${encodeURIComponent(token ?? "")}`;
  const adminPreview = useQuery<ParticipantSouvenir>({
    enabled: Boolean(adminId),
    queryKey: [view],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const response = await fetch(view, { cache: "no-store", signal });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Impossible d’afficher cet espace souvenir.");
      return response.json();
    },
  });
  const [visitorSummary, setSummary] = useState<ParticipantSouvenir>();
  const summary = adminId ? adminPreview.data : visitorSummary;
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [checkingSession, setCheckingSession] = useState(!adminId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [erased, setErased] = useState(false);

  useEffect(() => {
    if (adminId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${view}?resume=1`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const data = await response.json() as ParticipantSouvenir;
          if (!controller.signal.aborted) setSummary(data);
        } else if (response.status === 410 && !controller.signal.aborted) {
          setError("Cet espace souvenir a expiré.");
        }
      } catch {
        // If the saved session cannot be reached, the code form remains available.
      } finally {
        if (!controller.signal.aborted) setCheckingSession(false);
      }
    })();
    return () => controller.abort();
  }, [adminId, view]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (busy || checkingSession) return;
    setBusy(true);
    setError("");
    try {
      const auth = await fetch(open, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, remember }) });
      if (!auth.ok) throw new Error((await auth.json().catch(() => null))?.message ?? "Impossible d’ouvrir l’espace.");
      const response = await fetch(view, { cache: "no-store" });
      if (!response.ok) throw new Error("L’espace souvenir est indisponible.");
      setSummary(await response.json());
      setCode("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion au serveur impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    setSummary(undefined);
    setError("");
    setBusy(true);
    try {
      const response = await fetch(open, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setRemember(false);
    } catch {
      setError("Impossible de fermer la session sur le serveur. Réessayez.");
      setSummary(summary);
    } finally {
      setBusy(false);
    }
  }

  async function erase(scope: "photo" | "all") {
    if (busy || adminId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(scope === "photo" ? `${view}/photo` : view, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Impossible de supprimer les données.");
      if (scope === "photo") {
        setSummary(current => current && { ...current, photoAvailable: false });
      } else {
        setSummary(undefined);
        setErased(true);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion au serveur impossible.");
    } finally {
      setBusy(false);
    }
  }

  const squadLabel = summary?.type === "zombie" ? "Squad" : "Équipe";
  const role = summary?.type === "survivant" ? "Survivant" : summary?.type === "staff" ? "Staff" : "Zombie";

  return <main className="souvenir" data-profile={summary?.type}>
    <div className="souvenir-backdrop" aria-hidden />
    <div className="souvenir-wrap">
      <header className="souvenir-masthead">
        <span className="souvenir-brand">ZOMB’IN<span> THE DARK</span></span>
        {adminId && <span className="text-sm">Aperçu administrateur</span>}
        {summary && !adminId && <Button type="button" variant="ghost" disabled={busy} onClick={() => void close()} className="souvenir-close">
          <LogOut /> Fermer mon espace
        </Button>}
      </header>
      {summary ? <>
        {error && <p role="alert" className="souvenir-error">{error}</p>}
        <section className="souvenir-hero souvenir-enter" aria-labelledby="souvenir-title">
          <div className="souvenir-intro">
            <p className="souvenir-kicker">Espace souvenir <span aria-hidden>·</span> {role}</p>
            <h1 id="souvenir-title">Merci,<br /><span>{summary.firstName} !</span></h1>
            <p className="souvenir-participant">{summary.firstName} {summary.lastName}</p>
            <p className="souvenir-thanks">Merci d’avoir participé à Zomb’in The Dark.</p>
            {summary.eventDay && <time className="souvenir-event-date" dateTime={summary.eventDay}>
              <CalendarDays /> {eventDate.format(new Date(summary.eventDay))}
            </time>}
          </div>
          <SouvenirPortrait summary={summary} src={`${view}/photo`} busy={busy}
            onRemove={adminId ? undefined : () => void erase("photo")} />
        </section>
        <section className="souvenir-recap souvenir-enter" aria-label="Récapitulatif de la participation">
          {summary.type !== "staff" && <div className="souvenir-squad">
            <div className="souvenir-squad-label"><Users /> {squadLabel}</div>
            {summary.squad !== null ? <>
              <p className="souvenir-number"><span>N°</span> {summary.squad}</p>
              {summary.squadSize != null && <p className="souvenir-squad-size">{summary.squadSize} {summary.squadSize === 1 ? "membre" : "membres"}</p>}
            </> : <p className="souvenir-squad-size">Sans affectation</p>}
          </div>}
          <dl className="souvenir-details">
            <Detail icon={<Radio />} label="Vague">{summary.wave ?? "Sans vague attribuée"}</Detail>
            {summary.arrivedAt && <Detail icon={<Clock3 />} label="Arrivée">
              <time dateTime={summary.arrivedAt}>{parisDate.format(new Date(summary.arrivedAt))}</time>
            </Detail>}
            {summary.gameStart && <Detail icon={<Clock3 />} label="Début du jeu">{summary.gameStart}</Detail>}
            {summary.gameEnd && <Detail icon={<Flag />} label="Fin du jeu · vague">{summary.gameEnd}</Detail>}
            {summary.squadBriefing && <Detail icon={<Users />} label={`Consignes · ${squadLabel}`}>{summary.squadBriefing}</Detail>}
          </dl>
        </section>
        {summary.highlights && <section className="souvenir-highlights" aria-label="La soirée en chiffres">
          <h2>La soirée en chiffres</h2>
          <dl>
            <div><dt>Zombies présents</dt><dd>{summary.highlights.zombies.toLocaleString("fr-FR")}</dd></div>
            <div><dt>Survivants présents</dt><dd>{summary.highlights.survivors.toLocaleString("fr-FR")}</dd></div>
          </dl>
        </section>}
        <section className="souvenir-album" aria-labelledby="souvenir-album-title">
          <span className="souvenir-album-icon" aria-hidden><Images /></span>
          <div>
            <h2 id="souvenir-album-title">Photos de l’événement</h2>
            <p>{summary.highlights?.photoUrl ? "Retrouvez les photos de la soirée dans l’album." : "Les photos de l’événement seront bientôt disponibles."}</p>
          </div>
          {summary.highlights?.photoUrl && <a href={summary.highlights.photoUrl} target="_blank" rel="noopener noreferrer">
            Voir les photos <ArrowRight aria-hidden />
          </a>}
        </section>
        <footer className="souvenir-footer">
          <LockKeyhole aria-hidden />
          {summary.expiresAt ? <p>Espace disponible jusqu’au <time dateTime={summary.expiresAt}>{parisDate.format(new Date(summary.expiresAt))}</time>, soit trois mois après la clôture de l’événement.</p>
            : <p>Cet espace restera accessible jusqu’à trois mois après la clôture de l’événement.</p>}
        </footer>
        {!adminId && <section className="souvenir-highlights" aria-labelledby="souvenir-data-title">
          <h2 id="souvenir-data-title">Mes données personnelles</h2>
          <p className="my-3 text-sm text-[#e1cdd5]">{summary.expiresAt
            ? "Vous pouvez demander leur effacement avant la date prévue."
            : "La suppression complète est disponible après la clôture de l’événement."}</p>
          <SouvenirDeleteAction label="Supprimer mes données" disabled={busy || !summary.expiresAt}
            description="Votre fiche, son récapitulatif et votre photo seront supprimés de l’application. Le code de la carte cessera de fonctionner."
            onConfirm={() => void erase("all")} />
        </section>}
      </> : erased ? <section className="souvenir-unlock">
        <div><h1>Vos données ont été supprimées.</h1><p>Le code de cette carte ne permet plus d’ouvrir l’espace souvenir.</p></div>
      </section> : adminId ? (
        <section className="souvenir-unlock">
          <div>
            <h1>Espace souvenir</h1>
            {adminPreview.isPending && <p role="status">Chargement…</p>}
            {adminPreview.isError && <p role="alert" className="souvenir-error">{adminPreview.error.message}</p>}
          </div>
        </section>
      ) : <section className="souvenir-unlock souvenir-enter">
        <div>
          <h1>Votre espace<br /><span>souvenir.</span></h1>
          <p>Retrouvez votre photo et le récapitulatif de votre participation.</p>
        </div>
        <form onSubmit={unlock}>
          <span className="souvenir-form-icon" aria-hidden><LockKeyhole /></span>
          <label htmlFor="souvenir-code">Code au verso de la carte</label>
          <Input id="souvenir-code" type="password" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby="souvenir-code-hint"
            value={code} onChange={event => setCode(event.target.value)} placeholder="10 caractères" required disabled={checkingSession} />
          <p id="souvenir-code-hint" className="text-sm text-[#e1cdd5]">{souvenirCodeHint}.</p>
          {error && <p role="alert" className="souvenir-error">{error}</p>}
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={remember} disabled={checkingSession || busy}
              onChange={event => setRemember(event.target.checked)} />
            Retenir le code sur cet appareil
          </label>
          <Button type="submit" loading={busy || checkingSession}>{checkingSession ? "Vérification…" : "Ouvrir mon espace"} <ArrowRight /></Button>
        </form>
      </section>}
    </div>
  </main>;
}
