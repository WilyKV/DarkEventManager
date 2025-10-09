import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  Upload,
  Trash2,
  Database,
  QrCode,
  FileSpreadsheet,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QRCodeDisplay } from "./qr-code-display";
import { QRCodeScanner } from "./qr-code-scanner";

interface DataManagementProps {
  type?: "zombie" | "survivant" | "staff" | "boutique" | "repas" | "badge";
}

export function DataManagement({ type }: DataManagementProps) {
  const { toast } = useToast();
  const [resetDialog, setResetDialog] = useState<{ module: string; type?: string } | null>(null);
  const [qrShareDialog, setQrShareDialog] = useState(false);
  const [qrImportDialog, setQrImportDialog] = useState(false);
  const [qrData, setQrData] = useState("");
  const [qrModule, setQrModule] = useState<string>("all");

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async ({ module, type }: { module: string; type?: string }) => {
      const response = await fetch("/api/data/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, type }),
      });
      if (!response.ok) throw new Error("Reset failed");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries();
      toast({
        title: "Données réinitialisées",
        description: `Les données de ${variables.module} ont été supprimées avec succès.`,
      });
      setResetDialog(null);
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser les données.",
        variant: "destructive",
      });
    },
  });

  // Export functions
  const handleExportAll = async () => {
    try {
      const response = await fetch("/api/data/export-all");
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `darkevent_export_complet_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: "Toutes les données ont été exportées.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données.",
        variant: "destructive",
      });
    }
  };

  const handleExportModule = async (module: string, moduleType?: string) => {
    try {
      const url = moduleType
        ? `/api/data/export/${module}?type=${moduleType}`
        : `/api/data/export/${module}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = response.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || `${module}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Export réussi",
        description: `Les données de ${module} ont été exportées.`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données.",
        variant: "destructive",
      });
    }
  };

  // Import function
  const handleImportFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/data/import-all", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Import failed");
      const result = await response.json();

      queryClient.invalidateQueries();
      toast({
        title: "Import réussi",
        description: `${result.stats.imported} éléments importés.`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'importer les données.",
        variant: "destructive",
      });
    }
  };

  // QR Share
  const handleQRShare = async () => {
    try {
      const response = await fetch("/api/data/qr-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: qrModule, type }),
      });

      if (!response.ok) throw new Error("QR share failed");
      const result = await response.json();

      setQrData(result.qrData);
      setQrShareDialog(true);

      toast({
        title: "QR Code généré",
        description: `Données prêtes pour le partage (${Math.round(result.size / 1024)}KB).`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le QR Code.",
        variant: "destructive",
      });
    }
  };

  // QR Import
  const handleQRImport = async () => {
    try {
      const response = await fetch("/api/data/qr-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrData }),
      });

      if (!response.ok) throw new Error("QR import failed");
      const result = await response.json();

      queryClient.invalidateQueries();
      setQrImportDialog(false);
      setQrData("");

      toast({
        title: "Import QR réussi",
        description: `${result.stats.imported} éléments importés.`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'importer les données du QR Code.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Reset Section */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Réinitialisation des données
          </CardTitle>
          <CardDescription>
            Supprimer définitivement les données (action irréversible)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {type && (
              <>
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => setResetDialog({ module: "participants", type })}
                >
                  <Trash2 className="w-4 h-4" />
                  Reset {type}s
                </Button>

                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => setResetDialog({ module: "timeslots", type })}
                >
                  <Trash2 className="w-4 h-4" />
                  Reset créneaux {type}
                </Button>

                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => setResetDialog({ module: "squads", type })}
                >
                  <Trash2 className="w-4 h-4" />
                  Reset squads {type}
                </Button>
              </>
            )}

            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => setResetDialog({ module: "shop" })}
            >
              <Trash2 className="w-4 h-4" />
              Reset boutique
            </Button>

            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => setResetDialog({ module: "meals" })}
            >
              <Trash2 className="w-4 h-4" />
              Reset repas
            </Button>

            <Button
              variant="destructive"
              className="w-full gap-2 md:col-span-2"
              onClick={() => setResetDialog({ module: "all" })}
            >
              <Database className="w-4 h-4" />
              Reset TOUTES les données
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={!!resetDialog} onOpenChange={(open) => !open && setResetDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmer la réinitialisation
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous absolument sûr de vouloir supprimer ces données ?
              <br />
              <strong>Cette action est irréversible et supprimera toutes les données de {resetDialog?.module}.</strong>
              <br /><br />
              Il est fortement recommandé d'exporter vos données avant de procéder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetDialog && resetMutation.mutate(resetDialog)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmer la suppression
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Share Dialog */}
      <Dialog open={qrShareDialog} onOpenChange={setQrShareDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>QR Code de partage</DialogTitle>
            <DialogDescription>
              Scannez ce QR Code avec un autre appareil
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <QRCodeDisplay data={qrData} />
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Import Dialog */}
      <Dialog open={qrImportDialog} onOpenChange={setQrImportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Scanner QR Code</DialogTitle>
            <DialogDescription>
              Scannez le QR Code pour importer les données
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <QRCodeScanner
              onScan={(data) => {
                setQrData(data);
                handleQRImport();
              }}
              onError={(error) => {
                toast({
                  title: "Erreur de scan",
                  description: error.message,
                  variant: "destructive",
                });
              }}
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ou coller manuellement
                </span>
              </div>
            </div>

            <div>
              <Label>Données QR Code</Label>
              <textarea
                className="w-full h-32 text-xs font-mono p-2 bg-background rounded border mt-2"
                value={qrData}
                onChange={(e) => setQrData(e.target.value)}
                placeholder="Collez les données du QR Code ici..."
              />
            </div>

            <Button
              onClick={handleQRImport}
              disabled={!qrData}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importer les données
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
