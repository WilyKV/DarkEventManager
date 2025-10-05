import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ParticipantWithRelations, Squad } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ManagementLayout } from "@/components/management-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QrCode, UserCheck, Camera, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SimpleCheckInModal } from "@/components/simple-check-in-modal";

export default function ScanPage() {
  const { toast } = useToast();
  const [scannedParticipant, setScannedParticipant] = useState<ParticipantWithRelations | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: allParticipants = [] } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants"],
  });

  const { data: zombieSquads = [] } = useQuery<Squad[]>({
    queryKey: ["/api/squads", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/squads?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch squads");
      return res.json();
    },
  });

  const { data: survivantSquads = [] } = useQuery<Squad[]>({
    queryKey: ["/api/squads", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/squads?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch squads");
      return res.json();
    },
  });

  const handleScan = async (participantId: number) => {
    setIsProcessing(true);
    setScanError(null);
    
    try {
      const participant = allParticipants.find(p => p.id === participantId);
      
      if (!participant) {
        setScanError(`Participant avec l'ID ${participantId} introuvable`);
        toast({
          title: "Erreur",
          description: `Participant avec l'ID ${participantId} introuvable`,
          variant: "destructive",
        });
        return;
      }

      setScannedParticipant(participant);
      
      toast({
        title: "Participant trouvé",
        description: `${participant.firstName} ${participant.lastName}`,
      });
    } catch (error) {
      console.error("Scan error:", error);
      setScanError("Erreur lors du scan du badge");
      toast({
        title: "Erreur",
        description: "Erreur lors du scan du badge",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualEntry = () => {
    const id = parseInt(manualId);
    if (isNaN(id)) {
      setScanError("ID invalide");
      return;
    }
    handleScan(id);
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
      title="Scanner les badges"
      subtitle="Scannez les badges QR des participants pour enregistrer leur arrivée"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Scanner un badge
            </CardTitle>
            <CardDescription>
              Scannez le QR code ou entrez manuellement l'ID du participant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Manual ID Entry */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
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
                  data-testid="input-participant-id"
                  disabled={isProcessing}
                />
                <Button
                  onClick={handleManualEntry}
                  disabled={!manualId || isProcessing}
                  data-testid="button-manual-scan"
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

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Pour scanner un QR code, entrez l'ID du participant affiché sur le badge
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Participant Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Participant scanné
            </CardTitle>
            <CardDescription>
              Informations du participant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scannedParticipant ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {scannedParticipant.firstName} {scannedParticipant.lastName}
                    </h3>
                    <p className="text-muted-foreground">ID: {scannedParticipant.id}</p>
                  </div>
                  <Badge variant={scannedParticipant.type === "zombie" ? "default" : "secondary"}>
                    {scannedParticipant.type === "zombie" ? "Zombie" : "Survivant"}
                  </Badge>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  {scannedParticipant.timeSlot && (
                    <div>
                      <p className="text-sm text-muted-foreground">Créneau</p>
                      <p className="font-medium">{scannedParticipant.timeSlot.name}</p>
                    </div>
                  )}
                  {scannedParticipant.squad && (
                    <div>
                      <p className="text-sm text-muted-foreground">Squad</p>
                      <p className="font-medium">Squad {scannedParticipant.squad.number}</p>
                    </div>
                  )}
                  {scannedParticipant.lockerNumber && (
                    <div>
                      <p className="text-sm text-muted-foreground">Casier</p>
                      <p className="font-mono text-lg font-bold text-primary">
                        {scannedParticipant.lockerNumber}
                      </p>
                    </div>
                  )}
                </div>

                {scannedParticipant.arrived && (
                  <Alert>
                    <UserCheck className="h-4 w-4" />
                    <AlertDescription>
                      Ce participant est déjà enregistré comme arrivé
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <QrCode className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Aucun participant scanné
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
