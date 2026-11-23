import { useState } from "react";
import { ArrowLeft, Camera, Skull, UserCheck } from "lucide-react";
import { PageTransition } from "./page-transition";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./notification-center";
import { OnlineSouvenirPhotoDialog } from "./souvenir-photo-dialog";
import { OnlineWelcomeDialog } from "./online-welcome-dialog";
import { checkInRoles } from "@shared/check-in";
import { useAuth } from "@/lib/auth";
import { SideRail } from "./side-rail";
import { BottomNav } from "./bottom-nav";
import { ConnectionIndicator } from "./connection-indicator";
import { SyncPendingBadge } from "./sync-pending-badge";

interface ManagementLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  showHomeButton?: boolean; // Unused: kept for compatibility with boutique/repas pages
  useHistoryBack?: boolean; // Prop pour utiliser l'historique du navigateur
}

export function ManagementLayout({
  title,
  subtitle,
  children,
  actions,
  useHistoryBack = false,
}: ManagementLayoutProps) {
  const { visitor, hasAnyRole } = useAuth();
  const [photosOpen, setPhotosOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const canWelcome = hasAnyRole(checkInRoles);
  const openWelcome = () => setWelcomeOpen(true);

  const handleBackClick = () => {
    if (useHistoryBack) {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Side rail — desktop only */}
      <SideRail />

      {/* Main content area: offset by rail width on md+ */}
      <div className="flex min-w-0 flex-1 flex-col min-h-dvh md:pl-20 xl:pl-48">
        <div className="flex-1 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-3 sm:pb-4">
              <div className="flex items-center gap-4">
                {/* Mobile : bouton retour OU logo "DARK EVENT" cliquable */}
                {useHistoryBack ? (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleBackClick}
                    data-testid="button-back"
                    className="md:hidden"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                ) : (
                  <Link href={visitor ? "/visitor" : "/overview"} aria-label="Retour à l’accueil" data-testid="button-back"
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-emerald-300 md:hidden">
                    <Skull className="size-5" aria-hidden />
                  </Link>
                )}
                <div>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
                  <p className="text-sm sm:text-base text-muted-foreground mt-1">{subtitle}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ConnectionIndicator />
                <SyncPendingBadge />
                <NotificationCenter />
                {canWelcome && (
                  <Button type="button" className="hidden md:inline-flex" onClick={openWelcome}>
                    <UserCheck aria-hidden /> Accueillir
                  </Button>
                )}
                {canWelcome && <Button type="button" variant="outline" className="hidden md:inline-flex" onClick={() => setPhotosOpen(true)}>
                  <Camera aria-hidden /> Photos
                </Button>}
                {actions}
              </div>
            </header>

            {/* Page Content */}
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </div>
      </div>

      <BottomNav onWelcome={canWelcome ? openWelcome : undefined} onPhotos={canWelcome ? () => setPhotosOpen(true) : undefined} />
      {canWelcome && photosOpen && <OnlineSouvenirPhotoDialog onClose={() => setPhotosOpen(false)} />}
      {canWelcome && welcomeOpen && <OnlineWelcomeDialog onClose={() => setWelcomeOpen(false)} />}
    </div>
  );
}
