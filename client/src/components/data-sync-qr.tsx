import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Scan, Download, Upload, Loader2, RefreshCw, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QRCodeScanner } from "@/components/qr-code-scanner";
import { QRCodeSVG } from "qrcode.react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DataSyncQRProps {
  module: "participants" | "timeslots" | "squads" | "shop" | "meals" | "all";
  type?: "zombie" | "survivant";
  title: string;
  description: string;
}

export function DataSyncQR({ module, type, title, description }: DataSyncQRProps) {
  const { toast } = useToast();
  const [qrData, setQrData] = useState<string>("");
  const [qrSize, setQrSize] = useState<number>(0);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [showScannerDialog, setShowScannerDialog] = useState(false);

  // Generate QR code for export
  const generateQRMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/data/qr-share", { module, type });
      return response.json();
    },
    onSuccess: (data) => {
      setQrData(data.qrData);
      setQrSize(data.size);
      setOriginalSize(data.originalSize);
      toast({
        title: "QR Code généré",
        description: `Données compressées : ${Math.round((data.size / data.originalSize) * 100)}% de la taille originale`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Import data from QR code
  const importQRMutation = useMutation({
    mutationFn: async (qrData: string) => {
      const response = await apiRequest("POST", "/api/data/qr-import", { qrData });
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Import QR data:", data);
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/squads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meal-items"] });
      
      const imported = data.stats?.imported || 0;
      const errors = data.stats?.errors || 0;
      
      toast({
        title: "Import réussi",
        description: `${imported} éléments importés avec succès${errors > 0 ? ` (${errors} erreurs)` : ''}`,
      });
      setScanResult(`Importation réussie ! ${imported} éléments importés`);
      setIsScanning(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur d'import",
        description: error.message,
        variant: "destructive",
      });
      setScanResult("Erreur lors de l'importation");
    },
  });

  // Generate QR on mount
  useEffect(() => {
    generateQRMutation.mutate();
  }, [module, type]);

  const handleScanQR = () => {
    setIsScanning(true);
    setScanResult(null);
    setShowScannerDialog(true);
  };

  const handleQRScanned = (data: string) => {
    setShowScannerDialog(false);
    setIsScanning(false);
    importQRMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="export" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="export" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Partager mes données
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Récupérer des données
              </TabsTrigger>
            </TabsList>

            <TabsContent value="export" className="space-y-4">
              <Alert>
                <QrCode className="w-4 h-4" />
                <AlertDescription>
                  Présentez ce QR code à un autre administrateur pour qu'il puisse récupérer les données de cette section.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col items-center space-y-4">
                {generateQRMutation.isPending ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : qrData ? (
                  <>
                    <div className="bg-white p-4 rounded-lg shadow-lg">
                      <QRCodeSVG
                        value={qrData}
                        size={256}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground text-center">
                      <p>Taille compressée : {(qrSize / 1024).toFixed(2)} KB</p>
                      <p>Taille originale : {(originalSize / 1024).toFixed(2)} KB</p>
                      <p>Compression : {Math.round((qrSize / originalSize) * 100)}%</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => generateQRMutation.mutate()}
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Régénérer le QR Code
                    </Button>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground">
                    Aucune donnée à exporter
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="import" className="space-y-4">
              <Alert>
                <Scan className="w-4 h-4" />
                <AlertDescription>
                  Scannez le QR code d'un autre administrateur pour récupérer ses données et les importer dans cette section.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col items-center space-y-4">
                {scanResult && (
                  <Alert variant={scanResult.includes("réussie") ? "default" : "destructive"}>
                    <Check className="w-4 h-4" />
                    <AlertDescription>{scanResult}</AlertDescription>
                  </Alert>
                )}

                <Button
                  size="lg"
                  onClick={handleScanQR}
                  disabled={isScanning || importQRMutation.isPending}
                  className="gap-2"
                >
                  {importQRMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Import en cours...
                    </>
                  ) : (
                    <>
                      <Scan className="w-5 h-5" />
                      Scanner un QR Code
                    </>
                  )}
                </Button>

                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Cliquez sur le bouton pour activer la caméra et scanner le QR code d'un autre appareil.
                  Les données seront automatiquement importées.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Scanner Dialog */}
      <Dialog open={showScannerDialog} onOpenChange={setShowScannerDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Scanner un QR Code</DialogTitle>
            <DialogDescription>
              Positionnez le QR code devant la caméra pour le scanner
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <QRCodeScanner 
              onScan={handleQRScanned}
              onError={(error) => {
                toast({
                  title: "Erreur de scan",
                  description: error.message,
                  variant: "destructive",
                });
                setShowScannerDialog(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
