import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeScanner } from "@/components/qr-code-scanner";
import { UserCheck, LogOut, Info, QrCode, CheckCircle2, Users, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Participant {
  id: number;
  firstName: string;
  lastName: string;
  type: string;
  arrivedAt: string | null;
  returnedAt: string | null;
  email?: string;
  timeSlot?: { name: string };
  squad?: { number: number };
}

interface UnifiedScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanComplete?: () => void;
}

export function UnifiedScanModal({ open, onOpenChange, onScanComplete }: UnifiedScanModalProps) {
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [scanningMode, setScanningMode] = useState(true);
  const [processedParticipants, setProcessedParticipants] = useState<Participant[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const checkInMutation = useMutation({
    mutationFn: async (participantId: number): Promise<Participant> => {
      const res = await apiRequest("PATCH", `/api/participants/${participantId}`, {
        arrivedAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      setProcessedParticipants(prev => [...prev, data]);
      toast({
        title: "Enregistrement réussi",
        description: `${data.firstName} ${data.lastName} a été enregistré(e)`,
      });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (participantId: number): Promise<Participant> => {
      const res = await apiRequest("PATCH", `/api/participants/${participantId}`, {
        returnedAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      setProcessedParticipants(prev => [...prev, data]);
      toast({
        title: "Sortie enregistrée",
        description: `${data.firstName} ${data.lastName} a quitté l'événement`,
      });
      toast({
        title: "🎁 Remettre les goodies !",
        description: `N'oubliez pas de remettre les goodies à ${data.firstName} ${data.lastName} !`,
        duration: 8000,
      });
    },
  });

  const handleScanSuccess = async (encryptedData: string) => {
    try {
      // Use existing QR scan endpoint
      const response = await fetch("/api/qr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrData: encryptedData }),
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Participant non trouvé");
      }
      
      const data = await response.json();
      setScannedParticipant(data.participant);
      setScanningMode(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "QR Code invalide ou participant introuvable",
        variant: "destructive",
      });
    }
  };

  const handleCheckIn = () => {
    if (scannedParticipant) {
      checkInMutation.mutate(scannedParticipant.id);
    }
  };

  const handleCheckOut = () => {
    if (scannedParticipant) {
      checkOutMutation.mutate(scannedParticipant.id);
    }
  };

  const handleViewDetails = () => {
    if (scannedParticipant) {
      window.open(`/badges?participantId=${scannedParticipant.id}`, '_blank');
    }
  };

  const handleScanAnother = () => {
    setScannedParticipant(null);
    setScanningMode(true);
  };

  const handleClose = () => {
    setScannedParticipant(null);
    setScanningMode(true);
    setProcessedParticipants([]);
    onOpenChange(false);
    if (onScanComplete) {
      onScanComplete();
    }
  };

  useEffect(() => {
    if (!open) {
      setScannedParticipant(null);
      setScanningMode(true);
      setProcessedParticipants([]);
    }
  }, [open]);

  const getStatusBadge = (participant: Participant) => {
    if (participant.returnedAt) {
      return <Badge variant="secondary">Sorti</Badge>;
    } else if (participant.arrivedAt) {
      return <Badge className="bg-green-500">Présent</Badge>;
    } else {
      return <Badge variant="outline">Non enregistré</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-6 h-6" />
            Scanner un participant
          </DialogTitle>
          <DialogDescription>
            Scannez le QR code du participant pour accéder aux actions rapides
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {scanningMode ? (
            /* Mode Scan */
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-full max-w-md">
                <QRCodeScanner 
                  onScan={handleScanSuccess}
                  onError={(error) => {
                    console.error("QR Scan error:", error);
                    toast({
                      title: "Erreur",
                      description: "Erreur lors du scan",
                      variant: "destructive",
                    });
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Positionnez le QR code du participant devant la caméra
              </p>
            </div>
          ) : (
            /* Infos Participant + Actions */
            scannedParticipant && (
              <div className="space-y-4">
                {/* Infos Participant */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold">
                          {scannedParticipant.firstName} {scannedParticipant.lastName}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {scannedParticipant.type.charAt(0).toUpperCase() + scannedParticipant.type.slice(1)}
                          </Badge>
                          {getStatusBadge(scannedParticipant)}
                          {scannedParticipant.timeSlot && (
                            <Badge variant="secondary">{scannedParticipant.timeSlot.name}</Badge>
                          )}
                          {scannedParticipant.squad && (
                            <Badge className="bg-red-500">Squad {scannedParticipant.squad.number}</Badge>
                          )}
                        </div>
                        {scannedParticipant.email && (
                          <p className="text-sm text-muted-foreground">{scannedParticipant.email}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    onClick={handleCheckIn}
                    disabled={!!scannedParticipant.arrivedAt || checkInMutation.isPending}
                    className="h-auto py-6 flex-col gap-2"
                    variant={scannedParticipant.arrivedAt ? "secondary" : "default"}
                  >
                    <UserCheck className="w-6 h-6" />
                    <span>
                      {scannedParticipant.arrivedAt ? "Déjà enregistré" : "Enregistrer"}
                    </span>
                  </Button>

                  <Button
                    onClick={handleCheckOut}
                    disabled={!scannedParticipant.arrivedAt || !!scannedParticipant.returnedAt || checkOutMutation.isPending}
                    className="h-auto py-6 flex-col gap-2"
                    variant={scannedParticipant.returnedAt ? "secondary" : "destructive"}
                  >
                    <LogOut className="w-6 h-6" />
                    <span>
                      {scannedParticipant.returnedAt ? "Déjà sorti" : "Sortir du jeu"}
                    </span>
                  </Button>

                  <Button
                    onClick={handleViewDetails}
                    className="h-auto py-6 flex-col gap-2"
                    variant="outline"
                  >
                    <Info className="w-6 h-6" />
                    <span>Voir détails</span>
                  </Button>
                </div>

                {/* Bouton Scanner un autre */}
                <div className="flex justify-center pt-4">
                  <Button onClick={handleScanAnother} variant="outline" className="gap-2">
                    <QrCode className="w-4 h-4" />
                    Scanner un autre participant
                  </Button>
                </div>
              </div>
            )
          )}

          {/* Liste des participants traités */}
          {processedParticipants.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-green-500" />
                  <h4 className="font-semibold">Participants traités ({processedParticipants.length})</h4>
                </div>
                <div className="space-y-2">
                  {processedParticipants.map((p, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm flex-wrap">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{p.firstName} {p.lastName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {p.returnedAt ? "Sorti" : "Enregistré"}
                      </Badge>
                      {p.returnedAt && (
                        <Badge className="text-xs bg-amber-500 hover:bg-amber-500 gap-1 flex items-center">
                          <Gift className="w-3 h-3" />
                          Goodies à remettre
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleClose} variant="outline">
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
