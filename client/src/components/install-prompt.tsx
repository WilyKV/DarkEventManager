/// <reference types="vite-plugin-pwa/react" />
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Download, RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallContext = createContext<{ installed: boolean; prompt: InstallEvent | null; clearPrompt: () => void }>({
  installed: false, prompt: null, clearPrompt: () => {},
});

function useInstalled() {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const onInstalled = () => setInstalled(true);
    update();
    display.addEventListener("change", update);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      display.removeEventListener("change", update);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return installed;
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const installed = useInstalled();
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    immediate: true,
    // An update accepted in another tab must not reload a form in this tab.
    onNeedReload: () => {},
  });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let lastCheck = 0;
    const checkForUpdate = () => {
      const now = Date.now();
      if (document.visibilityState !== "visible" || !navigator.onLine || now - lastCheck < 15_000) return;
      lastCheck = now;
      void navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {});
    };
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("pageshow", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    return () => {
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("pageshow", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
    };
  }, []);

  useEffect(() => {
    if (!updating) return;
    const serviceWorker = navigator.serviceWorker;
    const reload = () => window.location.reload();
    let cancelled = false;
    serviceWorker.addEventListener("controllerchange", reload, { once: true });
    const timeout = window.setTimeout(() => setUpdating(false), 8_000);
    void serviceWorker.getRegistration().then(registration => {
      if (cancelled) return;
      if (registration?.waiting) return updateServiceWorker();
      reload();
    }).catch(() => setUpdating(false));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      serviceWorker.removeEventListener("controllerchange", reload);
    };
  }, [updating, updateServiceWorker]);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  return (
    <InstallContext.Provider value={{ installed, prompt, clearPrompt: () => setPrompt(null) }}>
      {children}
      {needRefresh && !updateDismissed && (
        <aside className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 rounded-xl border border-border bg-card p-4 shadow-lg md:inset-x-auto md:bottom-4 md:right-4 md:w-80" aria-label="Mise à jour de l’application">
          <p className="font-medium">Une nouvelle version est prête.</p>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">Enregistrez la fiche en cours avant d’actualiser.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={updating} onClick={() => setUpdating(true)}><RefreshCw /> {updating ? "Actualisation…" : "Actualiser"}</Button>
            <Button size="sm" variant="ghost" disabled={updating} onClick={() => setUpdateDismissed(true)}>Plus tard</Button>
          </div>
        </aside>
      )}
    </InstallContext.Provider>
  );
}

export function InstallAppButton({ className }: { className?: string }) {
  const { installed, prompt, clearPrompt } = useContext(InstallContext);
  const [open, setOpen] = useState(false);
  if (installed) return null;

  const apple = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  async function install(event: React.MouseEvent<HTMLButtonElement>) {
    if (!prompt) return;
    event.preventDefault();
    clearPrompt();
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === "dismissed") setOpen(false);
    } catch {
      setOpen(true);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={install} variant="outline" className={className}><Download /> Installer l’application</Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Installer Zomb’in The Dark</DialogTitle>
          <DialogDescription>
            {apple
              ? "Dans Safari, touchez Partager, puis Sur l’écran d’accueil et Ajouter. Ouvrez ensuite Zomb’in depuis la nouvelle icône."
              : "Dans le menu de votre navigateur, choisissez Installer l’application ou Ajouter à l’écran d’accueil. Ouvrez ensuite Zomb’in depuis la nouvelle icône."}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
