import { useState, useEffect } from "react";
import { ManagementLayout } from "@/components/management-layout";
import { UnifiedScanModal } from "@/components/unified-scan-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-6 h-6" />
            Scanner un participant
          </CardTitle>
          <CardDescription>
            Placez le QR code de la carte devant la caméra. Vous pouvez scanner plusieurs cartes à la suite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" className="min-h-11" onClick={() => setModalOpen(true)}><QrCode aria-hidden /> Scanner un badge</Button>
        </CardContent>
      </Card>

      <UnifiedScanModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
      />
    </ManagementLayout>
  );
}
