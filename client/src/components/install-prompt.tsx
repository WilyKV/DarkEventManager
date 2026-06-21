import { useState, useEffect } from "react";
import { X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SNOOZE_KEY = "pwa-install-snoozed-until";
const SNOOZE_DAYS = 7;

function isSnoozed(): boolean {
  const until = localStorage.getItem(SNOOZE_KEY);
  if (!until) return false;
  return Date.now() < parseInt(until, 10);
}

function snooze(): void {
  const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(SNOOZE_KEY, String(until));
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) && /WebKit/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isSnoozed() || isStandalone()) return;

    if (isIosSafari()) {
      setShowIosGuide(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  };

  const handleLater = () => {
    snooze();
    setDeferredPrompt(null);
    setShowIosGuide(false);
    setDismissed(true);
  };

  if (dismissed) return null;

  if (showIosGuide) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-2 right-2 md:left-auto md:right-4 md:max-w-sm z-50 rounded-xl border border-primary/40 bg-card/95 backdrop-blur-sm p-3 shadow-lg flex items-start gap-3">
        <Share className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Installer Zomb'in</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Appuyez sur <strong>Partager</strong> puis <strong>"Sur l'écran d'accueil"</strong>
          </p>
        </div>
        <button onClick={handleLater} className="text-muted-foreground hover:text-foreground p-1 shrink-0" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-2 right-2 md:left-auto md:right-4 md:max-w-sm z-50 rounded-xl border border-primary/40 bg-card/95 backdrop-blur-sm p-3 shadow-lg flex items-center gap-3">
      <span className="text-xl shrink-0" aria-hidden>📲</span>
      <p className="flex-1 text-sm text-foreground min-w-0">
        Installer <strong>Zomb'in</strong> sur cet appareil
      </p>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={handleInstall} className="bg-primary text-primary-foreground h-8 px-3 text-xs">
          Installer
        </Button>
        <button onClick={handleLater} className="text-muted-foreground hover:text-foreground p-1" aria-label="Plus tard">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
