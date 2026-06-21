import { useState } from "react";
import { ArrowLeft, LogOut, QrCode } from "lucide-react";
import { PageTransition } from "./page-transition";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./notification-center";
import { UnifiedScanModal } from "./unified-scan-modal";
import { useAuth } from "@/lib/auth";
import { SideRail } from "./side-rail";
import { BottomNav } from "./bottom-nav";

interface ManagementLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  showScanButton?: boolean;
  showHomeButton?: boolean; // Unused: kept for compatibility with boutique/repas pages
  scanLink?: string; // Deprecated: kept for compatibility
  useHistoryBack?: boolean; // Nouveau prop pour utiliser l'historique du navigateur
}

export function ManagementLayout({ 
  title, 
  subtitle, 
  children, 
  actions, 
  showScanButton = false,
  scanLink = "/scan", // Kept for compatibility but not used
  useHistoryBack = false
}: ManagementLayoutProps) {
  const { user, visitor, logout } = useAuth();
  const [location] = useLocation();
  const [scanModalOpen, setScanModalOpen] = useState(false);

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
      <div className="flex-1 md:pl-20 flex flex-col min-h-screen">
        <div className="flex-1 p-4 sm:p-6 pb-28 md:pb-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
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
                  <Link href={visitor ? "/visitor" : "/home"}>
                    <Button variant="outline" size="icon" data-testid="button-back" className="md:hidden">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                  </Link>
                )}
                <div>
                  <h1 className="text-3xl sm:text-4xl font-display tracking-tight text-primary">{title}</h1>
                  <p className="text-sm sm:text-base text-muted-foreground mt-1">{subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <NotificationCenter />
                {showScanButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground"
                    title="Scanner QR Code"
                    onClick={() => setScanModalOpen(true)}
                  >
                    <QrCode className="w-4 h-4" />
                    <span className="hidden sm:inline">Scanner</span>
                  </Button>
                )}
                {actions}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  title="Se déconnecter"
                  className="md:hidden"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Page Content */}
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />

      {/* Unified Scan Modal */}
      <UnifiedScanModal
        open={scanModalOpen}
        onOpenChange={setScanModalOpen}
      />
    </div>
  );
}
