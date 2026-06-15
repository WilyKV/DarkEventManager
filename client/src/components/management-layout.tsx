import { useState } from "react";
import { ArrowLeft, LogOut, QrCode } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./notification-center";
import { UnifiedScanModal } from "./unified-scan-modal";
import { useAuth } from "@/lib/auth";

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
    // si c'est zombies en title il faut via-blue-900
    <div className={`min-h-screen bg-background bg-gradient-to-br from-gray-900 ${
      title.toLowerCase().includes('zombies') ? 'via-red-900' : 
      title.toLowerCase().includes('survivants') ? 'via-blue-900' : 
      title.toLowerCase().includes('staff') ? 'via-green-900' : 
      title.toLowerCase().includes('boutique') ? 'via-green-900' : 
      title.toLowerCase().includes('repas') ? 'via-orange-900' : 
      title.toLowerCase().includes('badge') ? 'via-pink-900' : 
      'via-purple-900'
    } to-gray-900 p-4 sm:p-6`}>
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
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            ) : (
              <Link href={visitor ? "/visitor" : "/home"}>
                <Button variant="outline" size="icon" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-3xl sm:text-4xl font-display text-primary">{title}</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {user && (
              <div className="text-xs sm:text-sm text-muted-foreground mr-2">
                Connecté: <span className="font-semibold">{user.username}</span>
              </div>
            )}
            <NotificationCenter />
            {showScanButton && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-cyan-500/50 text-cyan-500 hover:bg-cyan-500 hover:text-white"
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
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Page Content */}
        {children}
      </div>

      {/* Unified Scan Modal */}
      <UnifiedScanModal 
        open={scanModalOpen} 
        onOpenChange={setScanModalOpen}
      />
    </div>
  );
}
