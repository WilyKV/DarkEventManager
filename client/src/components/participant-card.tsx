import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { cardsPath, photoMaxBytes, souvenirPath, type PrintableCard } from "@shared/participant-card";

export function usePrintableCard(id: number | undefined) {
  return useQuery({
    queryKey: [cardsPath, "print", id], enabled: id !== undefined, staleTime: 10 * 60_000, gcTime: 0,
    queryFn: async () => {
      const response = await apiRequest("POST", `${cardsPath}/print`, { ids: [id] });
      const [card] = await response.json() as PrintableCard[];
      return card;
    },
  });
}

export function ParticipantCard({ card }: { card: PrintableCard }) {
  const accent = card.type === "zombie" ? "#941c32" : card.type === "staff" ? "#176246" : "#17558d";
  const url = new URL(`${souvenirPath}/${card.token}`, window.location.origin).href;
  const face = "relative w-full max-w-[425px] overflow-hidden rounded-xl border border-slate-200 bg-white p-[5.5%] text-slate-900 shadow-sm";
  return <div className="grid w-full gap-3">
    <section aria-label="Recto" className={face}>
      <div className="mb-3 h-1.5 rounded-full" style={{ background: accent }} />
      <p className="text-xs font-bold tracking-wide">ZOMB’IN THE DARK</p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(86px,34%)] items-center gap-2">
        <p className="break-words text-xl font-black leading-tight sm:text-2xl">{card.firstName}<br />{card.lastName}</p>
        <div className="text-center">
          <QRCodeSVG value={url} level="M" marginSize={4} className="h-auto w-full rounded border" />
          <p className="mt-1 text-xs text-slate-600">Mon espace souvenir</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 font-bold"><span aria-hidden className="size-4 rounded-sm border border-slate-800" /> Repas</span>
        <span>N° de passage <span aria-hidden className="inline-block w-10 border-b border-slate-500" /></span>
      </div>
    </section>
    <section aria-label="Verso" className={face}>
      <div className="mb-3 h-1.5 rounded-full" style={{ background: accent }} />
      <p className="text-xs font-bold tracking-wide">ZOMB’IN THE DARK</p>
      <div className="my-4 text-center">
        <p className="text-sm font-bold">Code d’accès</p>
        <p className="mx-auto mt-2 max-w-64 rounded-lg border border-slate-300 px-2 py-2 font-mono text-xl font-bold">
          {card.code.slice(0, 5)} {card.code.slice(5)}
        </p>
      </div>
      <p className="text-center text-xs text-slate-600">Scannez le QR au recto, puis saisissez ce code. Espace disponible jusqu’à 3 mois après la clôture.</p>
    </section>
  </div>;
}

async function preparePhoto(file: File) {
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) throw new Error("Choisissez une image de moins de 20 Mo.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossible de lire la photo.");
    for (const size of [960, 720, 540, 400]) {
      const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/jpeg", 0.78);
      if (encoded.length <= 23 + 4 * Math.floor(photoMaxBytes / 3)) return encoded.slice("data:image/jpeg;base64,".length);
    }
    throw new Error("Impossible de compresser cette photo.");
  } finally {
    bitmap.close();
  }
}

export function SouvenirPhoto({ onSave, pendingPhoto, onCancelPendingPhoto, disabled }: {
  onSave: (photo: string | null) => Promise<void>;
  pendingPhoto?: string | null;
  onCancelPendingPhoto?: () => Promise<void>;
  disabled?: boolean;
}) {
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const preview = draft ?? pendingPhoto;
  async function save(photo: string | null) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await onSave(photo);
      setDraft(undefined);
      setNotice(photo ? "Photo enregistrée." : "Retrait de la photo enregistré.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer la photo.");
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label="Photo souvenir" className="space-y-3 rounded-xl border border-border bg-card p-3">
    <h3 className="flex items-center gap-2 font-semibold"><Camera className="size-4" /> Photo souvenir</h3>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={consent} disabled={disabled || busy}
        onChange={event => { setConsent(event.target.checked); if (!event.target.checked) setDraft(undefined); }} />
      La personne accepte la photo et son affichage dans son espace privé.
    </label>
    <input aria-label="Prendre ou choisir la photo" type="file" accept="image/*" capture="environment"
      disabled={!consent || disabled || busy} className="block max-w-full text-sm disabled:opacity-50"
      onChange={async event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        setBusy(true);
        setError("");
        setNotice("");
        setDraft(undefined);
        try { setDraft(await preparePhoto(file)); }
        catch { setError("Cette photo n’a pas pu être lue. Essayez avec un fichier JPEG ou PNG."); }
        finally { setBusy(false); }
      }} />
    {preview && <img src={`data:image/jpeg;base64,${preview}`} alt="Photo souvenir à associer" className="max-h-44 rounded-lg object-contain" />}
    {pendingPhoto !== undefined && <p className="text-sm text-muted-foreground">Modification enregistrée sur cet appareil, en attente d’envoi.</p>}
    <div className="flex flex-wrap gap-2">
      {draft && <Button type="button" disabled={!consent || disabled || busy} onClick={() => void save(draft)}>Associer la photo</Button>}
      <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => void save(null)}><Trash2 /> Retirer la photo</Button>
      {pendingPhoto !== undefined && onCancelPendingPhoto && <Button type="button" variant="ghost" disabled={disabled || busy}
        onClick={async () => {
          try { await onCancelPendingPhoto(); setNotice("Envoi local annulé."); }
          catch { setError("Impossible d’annuler l’envoi."); }
        }}>Annuler l’envoi local</Button>}
    </div>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
