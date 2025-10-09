import { useState, useEffect } from "react";
import { ManagementLayout } from "@/components/management-layout";
import { UnifiedScanModal } from "@/components/unified-scan-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode } from "lucide-react";

export default function ScanPage() {
  const [modalOpen, setModalOpen] = useState(false);

  // Auto-open modal when page loads
  useEffect(() => {
    setModalOpen(true);
  }, []);

  return (
    <ManagementLayout
      title="Scanner"
      subtitle="Scanner les QR codes des participants"
      useHistoryBack={true}
      showScanButton={true}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-6 h-6" />
            Scanner un participant
          </CardTitle>
          <CardDescription>
            La modale de scan s'ouvre automatiquement. Vous pouvez scanner plusieurs participants à la suite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Utilisez le bouton "Scanner" dans l'en-tête pour ouvrir à nouveau la modale de scan.
          </p>
        </CardContent>
      </Card>

      <UnifiedScanModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
      />
    </ManagementLayout>
  );
}
