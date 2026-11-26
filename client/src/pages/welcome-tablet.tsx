import { useEffect, useState } from "react";
import { MonitorPlay } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { QRCodeScanner } from "@/components/qr-code-scanner";
import { ZombieWelcomeVideo } from "@/components/zombie-welcome-video";
import { makeTabletReceipt, readTabletQr, zombieVideoAssets, type TabletTransfer } from "@/components/welcome-tablet-transfer";

export default function WelcomeTabletPage() {
  const [group, setGroup] = useState<TabletTransfer>();
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [offlineReady, setOfflineReady] = useState<boolean>();

  useEffect(() => {
    let active = true;
    async function checkCache() {
      try {
        const ready = Boolean(navigator.serviceWorker?.controller) &&
          (await Promise.all(["/index.html", ...zombieVideoAssets].map(path =>
            caches.match(path, { ignoreSearch: true })))).every(Boolean);
        if (active) setOfflineReady(ready);
      } catch {
        if (active) setOfflineReady(false);
      }
    }
    void checkCache();
    navigator.serviceWorker?.addEventListener("controllerchange", checkCache);
    return () => {
      active = false;
      navigator.serviceWorker?.removeEventListener("controllerchange", checkCache);
    };
  }, []);

  function reset() {
    setGroup(undefined);
    setFinished(false);
    setError("");
  }

  if (group && !finished) return <main className="flex h-dvh flex-col bg-black p-2 text-white sm:p-4">
    <ZombieWelcomeVideo {...group} tablet onBack={reset} onContinue={complete => {
      if (complete) setFinished(true);
      else reset();
    }} />
  </main>;

  return <main className="grid min-h-dvh place-items-center bg-[#160a12] p-4 text-rose-50 sm:p-8">
    <section className="w-full max-w-lg space-y-5 rounded-3xl border border-rose-300/20 bg-[#25121f] p-5 shadow-xl sm:p-8">
      <header className="space-y-2">
        <MonitorPlay className="size-10 text-rose-300" aria-hidden />
        <h1 className="font-display text-3xl font-bold">{finished ? "Présentation terminée" : "Écran d’accueil Zombies"}</h1>
        <p className="text-sm text-rose-100/80">{finished
          ? "Le staff peut scanner ce QR pour confirmer la fin sur son téléphone."
          : "Scanne le QR de transfert affiché sur le téléphone du staff."}</p>
      </header>
      {finished && group ? <>
        <QRCodeSVG value={makeTabletReceipt(group)} level="M" marginSize={4} title="QR de fin de présentation"
          className="mx-auto h-auto w-48 rounded-xl bg-white" />
        <Button type="button" className="min-h-12 w-full" onClick={reset}>Groupe suivant</Button>
      </> : <>
        {offlineReady !== undefined && <p role="status" className="rounded-xl border border-white/15 p-3 text-sm">
          {offlineReady ? "Prêt hors ligne · vidéo et quiz en cache."
            : "Pour préparer le hors ligne, ouvre cet écran avec une connexion et attends la mise en cache de la vidéo."}
        </p>}
        <QRCodeScanner onScan={value => {
          const received = readTabletQr(value);
          if (received?.kind !== "zombin-tablet-v1") {
            setError("Ce QR ne correspond pas à un transfert de présentation.");
            return;
          }
          setError("");
          setGroup(received);
        }} />
        {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
      </>}
    </section>
  </main>;
}
