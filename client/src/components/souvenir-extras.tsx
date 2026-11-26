import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Star } from "lucide-react";
import { Link } from "wouter";
import { keepsakeSections, type EventReview, type KeepsakeSection, type PlayerProfile } from "@shared/souvenir-engagement";
import type { ParticipantSouvenir } from "@shared/participant-card";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const labels: Record<KeepsakeSection, string> = {
  identity: "Prénom, nom et profil", participation: "Participation et horaires", photo: "Photo souvenir",
  purchases: "Repas et achats", review: "Mon avis", event: "Date et chiffres de la soirée",
};

export function SouvenirExports({ view, summary }: { view: string; summary: ParticipantSouvenir }) {
  const [selected, setSelected] = useState<KeepsakeSection[]>(["identity", "participation", "event"]);
  const available = keepsakeSections.filter(section => section !== "photo" || summary.photoAvailable);
  const sections = selected.filter(section => available.includes(section));
  return <section className="souvenir-highlights space-y-3" aria-labelledby="souvenir-exports-title">
    <h2 id="souvenir-exports-title">Télécharger mon souvenir</h2>
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="mb-2 text-sm">Rubriques à inclure dans le PDF</legend>
      {available.map(section => <label key={section} className="flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm">
        <input type="checkbox" className="size-4 accent-rose-400" checked={selected.includes(section)}
          onChange={event => setSelected(items => event.target.checked ? [...items, section] : items.filter(item => item !== section))} />
        {labels[section]}
      </label>)}
    </fieldset>
    <div className="flex flex-wrap gap-2">
      {sections.length ? <Button asChild><a href={`${view}/keepsake?sections=${sections.join(",")}`} download>
        <Download aria-hidden /> Télécharger le PDF
      </a></Button> : <Button disabled>Télécharger le PDF</Button>}
      <Button asChild variant="outline"><a href={`${view}/export`} download>Télécharger mes données (JSON)</a></Button>
    </div>
  </section>;
}

function ReviewForm({ view, review }: { view: string; review: EventReview | null }) {
  const [halfStars, setHalfStars] = useState(review?.halfStars ?? 0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (halfStars < 2 || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await apiRequest("PUT", `${view}/review`, { halfStars, comment });
      setError(false);
      setMessage("Ton avis a été enregistré.");
    } catch {
      setError(true);
      setMessage("Impossible d’enregistrer ton avis.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={event => void submit(event)} className="space-y-3">
    <fieldset>
      <legend className="mb-2 text-sm">Note de 1 à 5 étoiles, par demi-étoile</legend>
      <div className="flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5].map(star => <div key={star} className="relative size-12 rounded-lg bg-white/5 text-amber-300 focus-within:ring-2 focus-within:ring-amber-300">
          <Star aria-hidden className="absolute inset-2 size-8" />
          <div className="pointer-events-none absolute inset-2 overflow-hidden" style={{ clipPath: `inset(0 ${100 - Math.max(0, Math.min(2, halfStars - (star - 1) * 2)) * 50}% 0 0)` }}>
            <Star aria-hidden className="size-8 fill-current" />
          </div>
          <div className="absolute inset-0 flex">
            {(star === 1 ? [2] : [star * 2 - 1, star * 2]).map(value => <label key={value} className="flex-1 cursor-pointer">
              <input type="radio" name="event-rating" className="sr-only" aria-label={`${String(value / 2).replace(".", ",")} sur 5`}
                checked={halfStars === value} onChange={() => { setHalfStars(value); setMessage(""); }} />
            </label>)}
          </div>
        </div>)}
      </div>
      <p className="mt-2 text-sm">{halfStars ? `${String(halfStars / 2).replace(".", ",")} / 5` : "Choisis ta note."}</p>
    </fieldset>
    <label className="grid gap-1 text-sm">Commentaire (facultatif)
      <Textarea className="bg-black/20" rows={3} maxLength={2000} value={comment}
        placeholder="Qu’est-ce qui t’a plu ? Que pourrait-on améliorer ?" onChange={event => { setComment(event.target.value); setMessage(""); }} />
    </label>
    <Button type="submit" disabled={halfStars < 2 || busy}>Enregistrer mon avis</Button>
    {message && <p role={error ? "alert" : "status"} className="text-sm">{message}</p>}
  </form>;
}

function generateProfileKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, "0")).join("");
}

function ProfileClaim({ view, linked }: { view: string; linked: boolean }) {
  const [action, setAction] = useState<"create" | "link">();
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<PlayerProfile>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${view}/profile`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(
          action === "create" ? { action, key, email: email.trim() || null } : { action, key: key.trim() }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Impossible d’enregistrer le profil.");
      setResult(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer le profil.");
    } finally { setBusy(false); }
  }

  return <section className="souvenir-highlights space-y-3" aria-labelledby="souvenir-profile-title">
    <h2 id="souvenir-profile-title">Mon profil joueur</h2>
    <p className="text-sm">Garde ton prénom, ton nom et ton nombre de participations pour les prochains événements. L’e-mail est facultatif. Le profil est supprimé après un an sans activité.</p>
    {result ? <div className="space-y-2">
      <p role="status">Participation enregistrée · {result.visits} au total.</p>
      {action === "create" && <label className="grid gap-1 text-sm">Copie cette clé privée. Elle te permettra de retrouver ton profil.
        <Input readOnly value={key} className="font-mono" onFocus={event => event.currentTarget.select()} />
      </label>}
    </div> : linked ? <p className="text-sm">Cette participation est déjà rattachée à un profil.</p> : <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={action === "create" ? "default" : "outline"} disabled={busy}
          onClick={() => { if (action !== "create") setKey(generateProfileKey()); setAction("create"); setError(""); }}>Créer mon profil</Button>
        <Button type="button" variant={action === "link" ? "default" : "outline"} disabled={busy}
          onClick={() => { if (action !== "link") setKey(""); setAction("link"); setError(""); }}>Rattacher à mon profil</Button>
      </div>
      {action && <form className="space-y-2" onSubmit={event => void submit(event)}>
        {action === "create" ? <>
          <label className="grid gap-1 text-sm">E-mail (facultatif)
            <Input type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">Ta clé privée · conserve-la avant de valider, elle ne pourra pas être récupérée
            <Input readOnly value={key} className="font-mono" onFocus={event => event.currentTarget.select()} />
          </label>
        </> : <label className="grid gap-1 text-sm">Clé privée du profil
          <Input type="password" autoComplete="off" value={key} required onChange={event => setKey(event.target.value)} />
        </label>}
        <Button type="submit" disabled={busy}>{action === "create" ? "Confirmer la création" : "Ajouter cette participation"}</Button>
      </form>}
    </>}
    {error && <p role="alert" className="text-sm">{error}</p>}
    <Link href="/profil-joueur" className="inline-block text-sm underline underline-offset-4">Ouvrir mon profil joueur</Link>
  </section>;
}

export function SouvenirEngagement({ view, summary }: { view: string; summary: ParticipantSouvenir }) {
  const query = useQuery<{ review: EventReview | null; profileLinked: boolean }>({
    queryKey: [`${view}/review`], gcTime: 0, retry: false,
  });
  return <>
    <section className="souvenir-highlights space-y-3" aria-labelledby="souvenir-review-title">
      <h2 id="souvenir-review-title">Ton avis sur l’événement</h2>
      <p className="text-sm">Ton avis est visible par l’administration jusqu’à l’expiration de ton espace souvenir.</p>
      {query.data ? <ReviewForm view={view} review={query.data.review} />
        : <p role={query.isError ? "alert" : "status"} className="text-sm">{query.isError ? "Impossible de charger ton avis." : "Chargement de ton avis…"}</p>}
    </section>
    {summary.arrivedAt && query.data && <ProfileClaim view={view} linked={query.data.profileLinked} />}
  </>;
}
