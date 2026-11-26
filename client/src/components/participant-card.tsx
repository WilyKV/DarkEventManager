import { SouvenirDeleteAction } from "./souvenir-delete-action";
import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { cardAssets, cardFieldIcons, cardHasMealBox, cardLayout, cardScheduleFields, cardBriefingTime, cardTheme, cardsPath, photoMaxBytes, printedCardName, souvenirCodeHint, souvenirPath, staffSpecializationLabels, type PrintableCard } from "@shared/participant-card";

export function usePrintableCard(id: number | undefined) {
  return useQuery({
    queryKey: [cardsPath, "print", id], enabled: id !== undefined, gcTime: 0,
    queryFn: async () => {
      const response = await apiRequest("POST", `${cardsPath}/print`, { ids: [id] });
      const [card] = await response.json() as PrintableCard[];
      return card;
    },
  });
}

const { width, height, nameX, nameWidth, nameCenterY, namePanelY, namePanelHeight, mealBoxSize, mealBoxX, mealBoxY, qrLabelY, qrX, qrY, qrSize, codeY, linkX, linkY, linkWidth, backNoticeY, scheduleY, scheduleHeight, scheduleSideLabelWidth } = cardLayout;

function at(x: number, y: number, w?: number, h?: number): CSSProperties {
  return {
    left: `${x / width * 100}%`,
    top: `${y / height * 100}%`,
    width: w === undefined ? undefined : `${w / width * 100}%`,
    height: h === undefined ? undefined : `${h / height * 100}%`,
  };
}

function CardFieldIcon({ field }: { field: keyof typeof cardFieldIcons }) {
  return <svg aria-hidden viewBox="0 0 24 24" className="size-[62%] max-w-[8.4cqw] text-slate-900/20"
    fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={cardFieldIcons[field]} />
  </svg>;
}

export function ParticipantCard({ card }: { card: PrintableCard }) {
  const theme = cardTheme(card.type);
  const url = new URL(`${souvenirPath}/${card.token}`, window.location.origin).href;
  const face = "participant-card-face isolate relative aspect-[85/55] w-full max-w-[425px] overflow-hidden rounded-xl bg-[#100b12] text-white shadow-lg [container-type:inline-size]";
  const cream = "absolute rounded-[2.35cqw] bg-white text-[#101828]";
  const printedName = printedCardName(card);
  const background = <>
    <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(120deg,#0d0b11,${theme.dark} 58%,#100b12)` }} />
    {theme.artwork && <img alt="" src={`/${cardAssets}/${theme.artwork}`} className="pointer-events-none absolute inset-0 size-full object-cover" />}
    <p className="absolute whitespace-nowrap text-[5cqw] font-black leading-none" style={at(6, 5)}>ZOMB’IN THE DARK</p>
    <p className="absolute text-[2.9cqw] font-bold leading-none tracking-[0.19em]" style={{ ...at(6, 11), color: theme.light }}>{theme.label}</p>
  </>;
  return <div className="grid w-full gap-3">
    <section aria-label="Recto" className={face}>
      {background}
      <div aria-hidden className={cream} style={at(4.5, namePanelY, 48.5, namePanelHeight)} />
      <span aria-hidden className="absolute rounded-full" style={{ ...at(4.5, namePanelY + 2, 0.6, namePanelHeight - 4), background: theme.accent }} />
      <p className="absolute -translate-y-1/2 truncate font-extrabold leading-tight text-[#101828]"
        style={{ ...at(nameX, nameCenterY, nameWidth), fontSize: `${Math.min(7, 112 / Math.max(1, printedName.length))}cqw` }}>
        {printedName}
      </p>
      <QRCodeSVG title="QR code de l’espace souvenir" value={url} level="M" marginSize={4} fgColor="#ffffff" bgColor="transparent" className="absolute"
        style={at(qrX, qrY, qrSize, qrSize)} />
      <p className="absolute z-10 text-center text-[2.3cqw] font-bold leading-none text-white" style={at(qrX, qrLabelY, qrSize)}>Mon espace souvenir</p>
      {cardScheduleFields(card.type).map(field => (
        <div key={field.key}>
          <span className="absolute flex items-center justify-center rounded-l-[0.95cqw] bg-[#100b12]"
            style={at(field.x - scheduleSideLabelWidth, scheduleY, scheduleSideLabelWidth, scheduleHeight)}>
            <span className="-rotate-90 whitespace-nowrap text-[2.15cqw] font-bold leading-none">{field.label}</span>
          </span>
          <span className="absolute flex items-center justify-center rounded-r-[0.95cqw] bg-white text-[#101828]"
            style={at(field.x, scheduleY, field.width, scheduleHeight)}>
            {field.key === "briefing"
              ? <strong className="text-[5.2cqw] leading-none tabular-nums">{cardBriefingTime(card.briefingTime)}</strong>
              : <span role="img" aria-label={`Case ${field.label} à remplir à la main`} className="flex size-full items-center justify-center">
                <CardFieldIcon field={field.key} />
              </span>}
          </span>
        </div>
      ))}
      {card.type === "staff" && (
        <div aria-label="Spécialisation" className="absolute flex items-center rounded-[0.95cqw] bg-white px-[2cqw] text-[3.6cqw] font-bold text-[#101828]"
          style={at(cardLayout.staffSpecializationBox.x, cardLayout.staffSpecializationBox.y, cardLayout.staffSpecializationBox.width, cardLayout.staffSpecializationBox.height)}>
          {card.staffSpecialization && staffSpecializationLabels[card.staffSpecialization]}
        </div>
      )}
      {cardHasMealBox(card.type) && (
        <span role="img" aria-label="Case repas à cocher" className="absolute flex items-center justify-center rounded-[0.55cqw] bg-white"
          style={at(mealBoxX, mealBoxY, mealBoxSize, mealBoxSize)}>
          <CardFieldIcon field="meal" />
        </span>
      )}
      <p className="absolute whitespace-nowrap rounded-sm bg-black/65 px-0.5 text-center leading-tight" style={{
        ...at(linkX, linkY, linkWidth), fontSize: `${Math.min(2.7, 138 / url.length)}cqw`,
      }}>{url}</p>
    </section>
    <section aria-label="Verso" className={face}>
      {background}
      <p className="absolute text-center text-[4.15cqw] font-bold leading-none" style={at(13, 19, 59)}>CODE D’ACCÈS</p>
      <div className={cream} style={at(13, 24, 59, 11)} />
      <p className="absolute text-center text-[2.6cqw] leading-none text-[#334155]" style={at(13, 24.75, 59)}>
        {souvenirCodeHint}
      </p>
      <p className="absolute text-center text-[6.65cqw] font-bold leading-none text-[#101828]" style={at(13, codeY, 59)}>
        {card.code.slice(0, 5)} {card.code.slice(5)}
      </p>
      <p className="absolute text-center text-[3.3cqw] leading-tight" style={at(5, backNoticeY, 75)}>
        Scannez le QR au recto, puis saisissez ce code.<br />Espace disponible jusqu’à 3 mois après la clôture.
      </p>
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
      <SouvenirDeleteAction label="Retirer la photo"
        description="La photo sera supprimée de l’espace souvenir et les envois suivants seront bloqués."
        disabled={disabled || busy} onConfirm={() => void save(null)} />
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
