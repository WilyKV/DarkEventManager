import type { ReactNode } from "react";
import { Camera, List, Menu, UserCheck, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const itemClass = "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-45";

export function OfflineNavigation({ ready, busy, view, onList, onSquads, onWelcome, onPhotos, children }: {
  ready: boolean;
  busy: boolean;
  onList: () => void;
  onSquads: () => void;
  view: "list" | "squads";
  onWelcome: () => void;
  onPhotos: () => void;
  children: ReactNode;
}) {
  return (
    <nav aria-label="Navigation hors ligne" className="workspace-navigation fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-1">
        <button type="button" className={itemClass} disabled={!ready} aria-pressed={ready && view === "list"} onClick={onList}><List className="size-5" aria-hidden /> Liste</button>
        <button type="button" className={itemClass} disabled={!ready} aria-pressed={ready && view === "squads"} onClick={onSquads}><Users className="size-5" aria-hidden /> Squads</button>
        <button type="button" className={`${itemClass} text-primary`} disabled={!ready || busy} onClick={onWelcome}>
          <UserCheck className="size-5" aria-hidden /> Accueillir
        </button>
        <button type="button" className={`${itemClass} text-primary`} disabled={!ready || busy} onClick={onPhotos}>
          <Camera className="size-5" aria-hidden /> Photos
        </button>
        <Sheet>
          <SheetTrigger className={itemClass}><Menu className="size-5" aria-hidden /> Menu</SheetTrigger>
          <SheetContent side="bottom" className="workspace-navigation mx-auto max-h-[85dvh] max-w-xl overflow-y-auto rounded-t-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <SheetTitle>Accueil hors ligne</SheetTitle>
            <SheetDescription>Gérez la copie enregistrée sur cet appareil.</SheetDescription>
            <div className="mt-4 grid gap-2">{children}</div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
