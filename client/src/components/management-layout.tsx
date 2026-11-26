import { useState } from "react";
import { ArrowLeft, Camera, UserCheck } from "lucide-react";
import { PageTransition } from "./page-transition";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./notification-center";
import { OnlineSouvenirPhotoDialog } from "./souvenir-photo-dialog";
import { OnlineWelcomeDialog } from "./online-welcome-dialog";
import { checkInRoles } from "@shared/check-in";
import { useCanGoBack } from "@/hooks/use-app-back";
import { useAuth } from "@/lib/auth";
import { homeItem, managementModules } from "@/lib/management-nav";
import { SideRail } from "./side-rail";
import { BottomNav } from "./bottom-nav";
import { ConnectionIndicator } from "./connection-indicator";
import { SyncPendingBadge } from "./sync-pending-badge";

interface ManagementLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ManagementLayout({
  title,
  subtitle,
  children,
  actions,
}: ManagementLayoutProps) {
  const [location, navigate] = useLocation();
  const canGoBack = useCanGoBack();
  const module = managementModules.find(item => item.path === location) ?? homeItem;
  const ModuleIcon = module.icon;
  const { visitor, hasAnyRole } = useAuth();
  const [photosOpen, setPhotosOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const canWelcome = hasAnyRole(checkInRoles);
  const openWelcome = () => setWelcomeOpen(true);

  const home = visitor ? "/visitor" : "/overview";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Side rail — desktop only */}
      <SideRail />

      {/* Main content area: offset by rail width on md+ */}
      <div className="flex min-w-0 flex-1 flex-col min-h-dvh md:pl-20 xl:pl-56">
        <div className="flex-1 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <header className="workspace-header flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0"
                  aria-label="Retour à la page précédente" title="Retour à la page précédente" data-testid="button-back"
                  disabled={!canGoBack && location === home}
                  onClick={() => { if (canGoBack) window.history.back(); else navigate(home, { replace: true }); }}>
                  <ArrowLeft className="size-5" aria-hidden />
                </Button>
                <span className="hidden md:block">
                  <span className="workspace-icon size-14" data-tone={module.tone}><ModuleIcon className="size-7" aria-hidden /></span>
                </span>
                <div>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
                  <p className="text-sm sm:text-base text-muted-foreground mt-1">{subtitle}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ConnectionIndicator />
                <SyncPendingBadge />
                <NotificationCenter />
                {canWelcome && (
                  <Button type="button" className="hidden min-h-11 md:inline-flex" onClick={openWelcome}>
                    <UserCheck aria-hidden /> Accueillir
                  </Button>
                )}
                {canWelcome && <Button type="button" variant="outline" className="hidden min-h-11 md:inline-flex" onClick={() => setPhotosOpen(true)}>
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
