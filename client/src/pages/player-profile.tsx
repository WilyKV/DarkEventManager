import { useState, type FormEvent } from "react";
import { playerProfilePath, type PlayerProfile } from "@shared/souvenir-engagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SouvenirDeleteAction } from "@/components/souvenir-delete-action";
import { apiRequest } from "@/lib/queryClient";
import "./souvenir.css";

export default function PlayerProfilePage() {
  const [key, setKey] = useState("");
  const [profile, setProfile] = useState<PlayerProfile>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await apiRequest("POST", `${playerProfilePath}/open`, { key: key.trim() });
      setProfile(await response.json());
    } catch {
      setError("Clé invalide, profil expiré ou connexion indisponible.");
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await apiRequest("POST", `${playerProfilePath}/delete`, { key: key.trim() });
      setProfile(undefined);
      setKey("");
    } catch {
      setError("Le profil n’a pas pu être supprimé.");
    } finally { setBusy(false); }
  }

  function exportProfile() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mes-donnees-profil-joueur.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="souvenir">
    <div className="souvenir-backdrop" aria-hidden />
    <div className="souvenir-wrap">
      <section className="souvenir-highlights space-y-3">
        <h1 className="text-2xl font-bold">Mon profil joueur</h1>
        {profile ? <>
          <p className="text-lg font-semibold">{profile.firstName} {profile.lastName}</p>
          {profile.email && <p>{profile.email}</p>}
          <p>{profile.visits} {profile.visits === 1 ? "participation enregistrée" : "participations enregistrées"}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={exportProfile}>Télécharger mes données</Button>
            <Button type="button" variant="outline" onClick={() => { setProfile(undefined); setKey(""); }}>Fermer le profil</Button>
            <SouvenirDeleteAction label="Supprimer mon profil" confirmLabel="Supprimer définitivement" disabled={busy}
              description="Ton profil joueur et son compteur de participations seront supprimés." onConfirm={() => void remove()} />
          </div>
        </> : <form className="space-y-3" onSubmit={event => void open(event)}>
          <label className="grid gap-1 text-sm">Clé privée du profil
            <Input type="password" autoComplete="off" value={key} required onChange={event => setKey(event.target.value)} />
          </label>
          <Button disabled={busy}>Ouvrir mon profil</Button>
        </form>}
        {error && <p role="alert">{error}</p>}
        <p className="text-sm opacity-80">Ce profil est supprimé après un an sans activité.</p>
      </section>
    </div>
  </main>;
}
