import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeScanner } from "@/components/qr-code-scanner";

interface QrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  title?: string;
}

export function QrScanner({ onScan, onClose, title = "Scanner QR Code" }: QrScannerProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <QRCodeScanner
            onScan={(data) => {
              onScan(data);
              onClose();
            }}
            onError={(error) => {
              console.error("QR Scan error:", error);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
