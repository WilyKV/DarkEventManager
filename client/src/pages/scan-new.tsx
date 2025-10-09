import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ParticipantWithRelations } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ManagementLayout } from "@/components/management-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QrCode, UserCheck, AlertCircle, Loader2, Database, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SimpleCheckInModal } from "@/components/simple-check-in-modal";
import { QRCodeScanner } from "@/components/qr-code-scanner";
import pako from "pako";

type QRCodeType = "badge" | "data-export" | "unknown";

interface SmartScanResult {
  type: QRCodeType;
  data: any;
  rawData: string;
}

export default function ScanPage() {
  const { toast } = useToast();
  const [scannedParticipant, setScannedParticipant] = useState<ParticipantWithRelations | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanType, setLastScanType] = useState<QRCodeType | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: allParticipants = [] } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants"],
  });

  // Detect QR Code Type
  const detectQRCodeType = (rawData: string): SmartScanResult => {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(rawData);
      
      // Check if it's a badge QR code (simple participant ID structure)
      if (parsed.participantId && typeof parsed.participantId === 'number') {
        return {
          type: "badge",
          data: parsed,
          rawData
        };
      }
      
      // Check if it's a data export (contains participants, timeSlots, squads, etc.)
      if (parsed.participants || parsed.timeSlots || parsed.squads || parsed.data) {
        return {
          type: "data-export",
          data: parsed,
          rawData
        };
      }
      
      // Unknown format
      return {
        type: "unknown",
        data: parsed,
        rawData
      };
    } catch (error) {
      // Not JSON, might be compressed data
      try {
        const compressed = atob(rawData);
        const decompressed = pako.inflate(
          Uint8Array.from(compressed, (c) => c.charCodeAt(0)),
          { to: "string" }
        );
        const parsed = JSON.parse(decompressed);
        
        if (parsed.participants || parsed.timeSlots || parsed.squads || parsed.data) {
          return {
            type: "data-export",
            data: parsed,
            rawData: decompressed
          };
        }
      } catch (decompressError) {
        console.error("Failed to decompress:", decompressError);
      }
      
      return {
        type: "unknown",
        data: null,
        rawData
      };
    }
  };

  // Import mutation for data exports
  const importDataMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/import/all", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && (
            key.startsWith("/api/participants") ||
            key.startsWith("/api/time-slots") ||
            key.startsWith("/api/squads")
          );
        }
      });
      setImportResult({
        success: true,
        message: "Données importées avec succès ! Les données existantes ont été remplacées."
      });
      toast({
        title: "✅ Import réussi",
        description: "Les données ont été importées et les données existantes ont été remplacées.",
      });
    },
    onError: (error: any) => {
      console.error("Import error:", error);
      setImportResult({
        success: false,
        message: `Erreur lors de l'import : ${error.message || 'Erreur inconnue'}`
      });
      toast({
        title: "❌ Erreur d'import",
        description: "Impossible d'importer les données",
        variant: "destructive",
      });
    },
  });

  // Smart QR Code Handler
  const handleSmartScan = async (rawData: string) => {
    setIsProcessing(true);
    setScanError(null);
    setImportResult(null);
    
    try {
      const scanResult = detectQRCodeType(rawData);
      setLastScanType(scanResult.type);
      
      console.log("Smart Scan Result:", scanResult);
      
      switch (scanResult.type) {
        case "badge":
          // Handle participant badge
          await handleBadgeScan(scanResult.data.participantId);
          break;
          
        case "data-export":
          // Handle data import
          await handleDataImport(scanResult.data);
          break;
          
        default:
          setScanError("Type de QR Code non reconnu");
          toast({
            title: "QR Code inconnu",
            description: "Ce QR Code n'est pas reconnu par le système",
            variant: "destructive",
          });
      }
    } catch (error) {
      console.error("Smart scan error:", error);
      setScanError("Erreur lors de l'analyse du QR Code");
      toast({
        title: "Erreur",
        description: "Impossible d'analyser le QR Code",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Badge Scan (Participant Check-in/Check-out)
  const handleBadgeScan = async (participantId: number) => {
    const participant = allParticipants.find(p => p.id === participantId);
    
    if (!participant) {
      setScanError(`Participant avec l'ID ${participantId} introuvable`);
      toast({
        title: "❌ Participant introuvable",
        description: `Aucun participant trouvé avec l'ID ${participantId}`,
        variant: "destructive",
      });
      return;
    }

    // Smart action based on participant status
    if (!participant.arrived) {
      // Not arrived yet → Check-in
      setScannedParticipant(participant);
      toast({
        title: "👋 Participant trouvé - Arrivée",
        description: `${participant.firstName} ${participant.lastName} - Enregistrer l'arrivée`,
      });
    } else if (participant.arrived && !participant.inGame) {
      // Arrived but not in game → Check-in to game
      setScannedParticipant(participant);
      toast({
        title: "🎮 Participant trouvé - Entrée en jeu",
        description: `${participant.firstName} ${participant.lastName} - Enregistrer l'entrée en jeu`,
      });
    } else if (participant.inGame) {
      // In game → Check-out from game
      setScannedParticipant(participant);
      toast({
        title: "🏁 Participant trouvé - Sortie du jeu",
        description: `${participant.firstName} ${participant.lastName} - Enregistrer la sortie`,
      });
    } else {
      // Already processed
      setScannedParticipant(participant);
      toast({
        title: "ℹ️ Participant déjà traité",
        description: `${participant.firstName} ${participant.lastName}`,
      });
    }
  };

  // Handle Data Import
  const handleDataImport = async (data: any) => {
    console.log("Importing data:", data);
    
    // Validate data structure
    if (!data.participants && !data.timeSlots && !data.squads) {
      setScanError("Format de données invalide");
      toast({
        title: "Format invalide",
        description: "Le QR Code ne contient pas de données valides",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation
    const participantsCount = data.participants?.length || 0;
    const timeSlotsCount = data.timeSlots?.length || 0;
    const squadsCount = data.squads?.length || 0;
    
    toast({
      title: "📦 Import de données détecté",
      description: `${participantsCount} participants, ${timeSlotsCount} créneaux, ${squadsCount} squads`,
    });

    // Perform import
    await importDataMutation.mutateAsync(data);
  };

  const handleManualEntry = () => {
    const id = parseInt(manualId);
    if (isNaN(id)) {
      setScanError("ID invalide");
      return;
    }
    handleBadgeScan(id);
    setManualId("");
  };

  const handleCheckInSuccess = () => {
    setScannedParticipant(null);
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/participants");
      }
    });
  };

  return (
    <ManagementLayout
      title="Scanner Intelligent"
      subtitle="Scannez n'importe quel QR Code : badges participants, données de sauvegarde, etc."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Scanner universel
            </CardTitle>
            <CardDescription>
              Scannez automatiquement tout type de QR Code : badges, sauvegardes, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code Scanner */}
            <div className="space-y-3">
              <QRCodeScanner
                onScan={(data) => handleSmartScan(data)}
                disabled={isProcessing}
              />
            </div>

            {/* Manual ID Entry for badges only */}
            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-3 block">
                Entrée manuelle (ID du participant)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="ID du participant"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleManualEntry();
                    }
                  }}
                  className="flex-1 px-4 min-h-9 rounded-md border border-input bg-background text-foreground"
                  disabled={isProcessing}
                />
                <Button
                  onClick={handleManualEntry}
                  disabled={!manualId || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Scanner"
                  )}
                </Button>
              </div>
            </div>

            {scanError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{scanError}</AlertDescription>
              </Alert>
            )}

            {importResult && (
              <Alert variant={importResult.success ? "default" : "destructive"}>
                {importResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>{importResult.message}</AlertDescription>
              </Alert>
            )}

            {lastScanType && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {lastScanType === "badge" && (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Dernier scan : Badge participant</span>
                    </>
                  )}
                  {lastScanType === "data-export" && (
                    <>
                      <Database className="w-4 h-4" />
                      <span>Dernier scan : Données de sauvegarde</span>
                    </>
                  )}
                  {lastScanType === "unknown" && (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Dernier scan : Type inconnu</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Participant Info or Import Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastScanType === "data-export" ? (
                <>
                  <Database className="w-5 h-5" />
                  Statut d'import
                </>
              ) : (
                <>
                  <UserCheck className="w-5 h-5" />
                  Participant scanné
                </>
              )}
            </CardTitle>
            <CardDescription>
              {lastScanType === "data-export" 
                ? "Résultat de l'import des données"
                : "Informations du participant"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lastScanType === "data-export" && importResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border-2 ${
                  importResult.success 
                    ? "bg-green-500/10 border-green-500/50" 
                    : "bg-red-500/10 border-red-500/50"
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    {importResult.success ? (
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-500" />
                    )}
                    <div>
                      <h3 className="font-bold text-lg">
                        {importResult.success ? "✅ Import réussi" : "❌ Échec de l'import"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {importResult.message}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Les données importées ont écrasé les données existantes dans les sections concernées.
                  </p>
                </div>
              </div>
            ) : scannedParticipant ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {scannedParticipant.firstName} {scannedParticipant.lastName}
                    </h3>
                    <p className="text-muted-foreground">ID: {scannedParticipant.id}</p>
                  </div>
                  <Badge variant={
                    scannedParticipant.type === "zombie" ? "default" : 
                    scannedParticipant.type === "staff" ? "secondary" :
                    "outline"
                  }>
                    {scannedParticipant.type === "zombie" ? "🧟 Zombie" : 
                     scannedParticipant.type === "staff" ? "👥 Staff" :
                     "🛡️ Survivant"}
                  </Badge>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  {scannedParticipant.timeSlot && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {scannedParticipant.type === "staff" ? "Attribution" : "Créneau"}
                      </p>
                      <p className="font-medium">{scannedParticipant.timeSlot.name}</p>
                    </div>
                  )}
                  {scannedParticipant.squad && scannedParticipant.type !== "staff" && (
                    <div>
                      <p className="text-sm text-muted-foreground">Squad</p>
                      <p className="font-medium">Squad {scannedParticipant.squad.number}</p>
                    </div>
                  )}
                  {scannedParticipant.secretCode && (
                    <div>
                      <p className="text-sm text-muted-foreground">Code</p>
                      <p className="font-mono text-lg font-bold text-primary">
                        {scannedParticipant.secretCode}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status indicators */}
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${scannedParticipant.arrived ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-sm">{scannedParticipant.arrived ? "✅ Arrivé" : "⏳ Pas encore arrivé"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${scannedParticipant.inGame ? 'bg-blue-500' : 'bg-gray-400'}`} />
                    <span className="text-sm">{scannedParticipant.inGame ? "🎮 En jeu" : "🏠 Hors jeu"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <QrCode className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Scannez un QR Code pour commencer
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Badges participants, données de sauvegarde, etc.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Check-in Modal */}
      {scannedParticipant && (
        <SimpleCheckInModal
          participant={scannedParticipant}
          onClose={() => setScannedParticipant(null)}
          onSuccess={handleCheckInSuccess}
        />
      )}
    </ManagementLayout>
  );
}
