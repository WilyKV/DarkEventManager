import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, CalendarDays, Clock3, Download, LockKeyhole, LogOut, Radio, Users } from "lucide-react";
import { cardAssets, cardsPath, souvenirCodeHint, type ParticipantSouvenir } from "@shared/participant-card";
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

function SouvenirPortrait({ summary, src }: { summary: ParticipantSouvenir; src: string }) {
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
  </figure>;
}

export default function SouvenirPage({ params }: { params: { token: string } }) {
  return <SouvenirSession key={params.token} token={params.token} />;
}

function SouvenirSession({ token }: { token: string }) {
  const open = `${cardsPath}/open/${encodeURIComponent(token)}`;
  const view = `${cardsPath}/view/${encodeURIComponent(token)}`;
  const [summary, setSummary] = useState<ParticipantSouvenir>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const auth = await fetch(open, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
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
    } catch {
      setError("Impossible de fermer la session sur le serveur. Réessayez.");
      setSummary(summary);
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
        {summary && <Button type="button" variant="ghost" onClick={() => void close()} className="souvenir-close">
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
          <SouvenirPortrait summary={summary} src={`${view}/photo`} />
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
            {summary.squadBriefing && <Detail icon={<Users />} label={`Consignes · ${squadLabel}`}>{summary.squadBriefing}</Detail>}
          </dl>
        </section>
        <footer className="souvenir-footer">
          <LockKeyhole aria-hidden />
          {summary.expiresAt ? <p>Espace disponible jusqu’au <time dateTime={summary.expiresAt}>{parisDate.format(new Date(summary.expiresAt))}</time>, soit trois mois après la clôture de l’événement.</p>
            : <p>Cet espace restera accessible jusqu’à trois mois après la clôture de l’événement.</p>}
        </footer>
      </> : <section className="souvenir-unlock souvenir-enter">
        <div>
          <h1>Votre espace<br /><span>souvenir.</span></h1>
          <p>Retrouvez votre photo et le récapitulatif de votre participation.</p>
        </div>
        <form onSubmit={unlock}>
          <span className="souvenir-form-icon" aria-hidden><LockKeyhole /></span>
          <label htmlFor="souvenir-code">Code au verso de la carte</label>
          <Input id="souvenir-code" type="password" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby="souvenir-code-hint"
            value={code} onChange={event => setCode(event.target.value)} placeholder="10 caractères" required />
          <p id="souvenir-code-hint" className="text-sm text-[#e1cdd5]">{souvenirCodeHint}.</p>
          {error && <p role="alert" className="souvenir-error">{error}</p>}
          <Button type="submit" loading={busy}>Ouvrir mon espace <ArrowRight /></Button>
        </form>
      </section>}
    </div>
  </main>;
}
