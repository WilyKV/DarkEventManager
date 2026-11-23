import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, Users, CalendarDays } from "lucide-react";
import { cardsPath, type ParticipantSouvenir } from "@shared/participant-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SouvenirPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const open = `${cardsPath}/open/${encodeURIComponent(token)}`;
  const view = `${cardsPath}/view/${encodeURIComponent(token)}`;
  const [summary, setSummary] = useState<ParticipantSouvenir>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSummary(undefined);
    setCode("");
    setError("");
  }, [token]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
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

  return <main className="mx-auto grid min-h-dvh w-full max-w-2xl content-center gap-5 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <p className="text-sm font-bold tracking-widest text-primary">ZOMB’IN THE DARK</p>
      <h1 className="text-3xl font-black sm:text-5xl">{summary ? `Merci, ${summary.firstName} !` : "Votre espace souvenir"}</h1>
    </header>
    {summary ? <>
      <p>Merci d’avoir participé à Zomb’in The Dark.</p>
      <dl className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <div><dt className="text-sm text-muted-foreground">Participant</dt><dd className="font-semibold">{summary.firstName} {summary.lastName}</dd></div>
        <div><dt className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" /> Vague</dt><dd className="font-semibold">{summary.wave ?? "Sans vague attribuée"}</dd></div>
        {summary.type !== "staff" && <div><dt className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" /> {summary.type === "zombie" ? "Squad" : "Équipe"}
        </dt><dd className="font-semibold">{summary.squad ?? "Sans affectation"}</dd></div>}
        {summary.eventDay && <div><dt className="text-sm text-muted-foreground">Date de l’événement</dt>
          <dd className="font-semibold">{new Intl.DateTimeFormat("fr", { dateStyle: "long", timeZone: "UTC" }).format(new Date(summary.eventDay))}</dd></div>}
        {summary.squadBriefing && <div className="sm:col-span-2"><dt className="text-sm text-muted-foreground">Consignes de votre {summary.type === "zombie" ? "squad" : "équipe"}</dt>
          <dd className="whitespace-pre-wrap break-words">{summary.squadBriefing}</dd></div>}
      </dl>
      {summary.photoAvailable && <figure className="space-y-2">
        <img src={`${view}/photo`} alt={`Photo souvenir de ${summary.firstName}`} className="mx-auto max-h-[65dvh] rounded-2xl object-contain" />
        <figcaption className="text-center"><a className="text-sm underline" href={`${view}/photo`} download="photo-souvenir.jpg">Télécharger ma photo</a></figcaption>
      </figure>}
      <p className="rounded-xl border border-border bg-muted/50 p-3 text-sm">
        {summary.expiresAt
          ? `Espace disponible jusqu’au ${new Intl.DateTimeFormat("fr", { dateStyle: "long", timeStyle: "short" }).format(new Date(summary.expiresAt))}, soit trois mois après la clôture de l’événement.`
          : "Cet espace restera accessible jusqu’à trois mois après la clôture de l’événement."}
      </p>
      <Button type="button" variant="outline" className="justify-self-start" onClick={() => {
        setSummary(undefined);
        void fetch(open, { method: "DELETE" }).catch(() => undefined);
      }}>Fermer mon espace</Button>
    </> : (
      <form className="space-y-4 rounded-2xl border border-border bg-card p-5" onSubmit={unlock}>
        <label htmlFor="souvenir-code" className="block font-semibold">Code au verso de la carte</label>
        <Input id="souvenir-code" type="password" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={16}
          value={code} onChange={event => setCode(event.target.value)} placeholder="10 caractères" required />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" loading={busy}><LockKeyhole className="size-4" /> Ouvrir mon espace</Button>
      </form>
    )}
  </main>;
}
