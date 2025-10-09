import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Send, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EndEventProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentParticipant?: string;
  status: "idle" | "processing" | "completed" | "error";
}

export function EndEventButton() {
  const { toast } = useToast();
  const [showProgress, setShowProgress] = useState(false);
  const [progressData, setProgressData] = useState<EndEventProgress>({
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    status: "idle",
  });

  // Query to get participant count for preview
  const { data: participantCount } = useQuery<number>({
    queryKey: ["/api/participants/count"],
    queryFn: async () => {
      const res = await fetch("/api/participants/count");
      if (!res.ok) throw new Error("Failed to fetch participant count");
      return res.json();
    },
  });

  const endEventMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/end-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur lors de l'envoi des récapitulatifs");
      }

      // Stream progress updates
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Impossible de lire le flux de données");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              setProgressData(data);
            } catch (e) {
              console.error("Failed to parse progress data:", e);
            }
          }
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Envoi terminé",
        description: `${progressData.succeeded} email(s) envoyé(s) avec succès`,
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

  const handleStartEndEvent = async () => {
    setShowProgress(true);
    setProgressData({
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      status: "processing",
    });
    endEventMutation.mutate();
  };

  const progressPercentage =
    progressData.total > 0 ? (progressData.processed / progressData.total) * 100 : 0;

  return (
    <>
      <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-500">
            <Send className="w-5 h-5" />
            Fin d'événement
          </CardTitle>
          <CardDescription>
            Envoyer un récapitulatif PDF chiffré à tous les participants par email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-500">Action importante</p>
                <p className="text-xs text-muted-foreground">
                  Cette action enverra un email à chaque participant contenant un PDF chiffré
                  avec son badge, ses informations et l'historique de ses achats/repas.
                </p>
                {participantCount && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>{participantCount}</strong> participant(s) recevront un email
                  </p>
                )}
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" className="w-full bg-orange-500 hover:bg-orange-600">
                <Send className="w-4 h-4 mr-2" />
                Lancer la fin d'événement
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la fin d'événement</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Êtes-vous sûr de vouloir lancer le processus de fin d'événement ?
                  </p>
                  <p className="font-medium">
                    Cela va envoyer un email avec un PDF récapitulatif à{" "}
                    <strong>{participantCount || "tous les"}</strong> participant(s).
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cette opération peut prendre plusieurs minutes selon le nombre de participants.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleStartEndEvent}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Confirmer l'envoi
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Progress Dialog */}
      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoi des récapitulatifs en cours</DialogTitle>
            <DialogDescription>
              Génération et envoi des PDFs aux participants...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progression</span>
                <span className="font-medium">
                  {progressData.processed} / {progressData.total}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {progressData.currentParticipant && (
              <p className="text-sm text-muted-foreground">
                En cours: {progressData.currentParticipant}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">
                  Réussis: <strong>{progressData.succeeded}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-red-500">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">
                  Échoués: <strong>{progressData.failed}</strong>
                </span>
              </div>
            </div>

            {progressData.status === "completed" && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-500 font-medium text-center">
                  ✓ Envoi terminé avec succès
                </p>
              </div>
            )}

            {progressData.status === "error" && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-500 font-medium text-center">
                  ✗ Une erreur est survenue
                </p>
              </div>
            )}

            {progressData.status === "completed" && (
              <Button
                onClick={() => setShowProgress(false)}
                className="w-full"
                variant="outline"
              >
                Fermer
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
