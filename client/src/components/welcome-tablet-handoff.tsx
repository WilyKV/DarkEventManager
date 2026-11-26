import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { QRCodeScanner } from "./qr-code-scanner";
import { readTabletQr, type TabletTransfer } from "./welcome-tablet-transfer";

export function WelcomeTabletHandoff({ transfer }: { transfer: TabletTransfer }) {
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  return <section className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4" aria-label="Présentation sur tablette">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="font-semibold">Présentation sur tablette · Squad {transfer.squad}</h3>
        <p className="text-sm text-muted-foreground">{confirmed ? "Présentation terminée sur la tablette."
          : "Ouvre Écran d’accueil sur la tablette et scanne le QR de transfert."}</p>
      </div>
      {!confirmed && <Button type="button" variant="outline" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? "Masquer le QR" : "Afficher le QR"}
      </Button>}
    </div>
    {!confirmed && expanded && <QRCodeSVG title="QR de transfert vers la tablette" value={JSON.stringify(transfer)}
      level="M" marginSize={4} className="h-auto w-48 rounded-xl bg-white" />}
    {!confirmed && <Button type="button" variant="ghost" aria-expanded={scanning} onClick={() => {
      setScanning(!scanning);
      setExpanded(false);
      setError("");
    }}>{scanning ? "Fermer le scanner" : "Lire le QR de fin sur la tablette"}</Button>}
    {!confirmed && scanning && <QRCodeScanner onScan={value => {
      const result = readTabletQr(value);
      if (result?.kind !== "zombin-tablet-done-v1" || result.id !== transfer.id) {
        setError("Ce QR de fin ne correspond pas à ce groupe.");
        return;
      }
      setError("");
      setScanning(false);
      setConfirmed(true);
    }} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
