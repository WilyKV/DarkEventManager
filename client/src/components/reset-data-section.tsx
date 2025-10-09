import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
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

interface ResetOption {
  label: string;
  module: string;
  type?: string;
  description?: string;
}

interface ResetDataSectionProps {
  options: ResetOption[];
  title?: string;
  description?: string;
}

export function ResetDataSection({ 
  options, 
  title = "Réinitialisation des données",
  description = "Supprimer définitivement les données (action irréversible)"
}: ResetDataSectionProps) {
  const { toast } = useToast();
  const [resetDialog, setResetDialog] = useState<{ module: string; type?: string; label: string } | null>(null);

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
        description: `Les données ont été supprimées avec succès.`,
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

  return (
    <>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {options.map((option, index) => (
              <Button
                key={index}
                variant="destructive"
                className={`w-full gap-2 ${option.module === "all" ? "md:col-span-2" : ""}`}
                onClick={() => setResetDialog({ 
                  module: option.module, 
                  type: option.type,
                  label: option.label 
                })}
              >
                <Trash2 className="w-4 h-4" />
                {option.label}
              </Button>
            ))}
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
              Êtes-vous absolument sûr de vouloir supprimer <strong>{resetDialog?.label}</strong> ?
              <br /><br />
              <strong className="text-destructive">Cette action est irréversible.</strong>
              <br /><br />
              Il est fortement recommandé d'exporter vos données avant de procéder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetDialog && resetMutation.mutate({
                module: resetDialog.module,
                type: resetDialog.type
              })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmer la suppression
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
