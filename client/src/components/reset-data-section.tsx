import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
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
  const [resetDialog, setResetDialog] = useState<ResetOption | null>(null);

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
    onSuccess: () => {
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
                className={`w-full gap-2 whitespace-normal ${option.module === "all" ? "md:col-span-2" : ""}`}
                onClick={() => setResetDialog(option)}
              >
                <Trash2 className="w-4 h-4" />
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={!!resetDialog} onOpenChange={open => { if (!open && !resetMutation.isPending) setResetDialog(null); }}>
        <AlertDialogContent className="w-[calc(100%-1.25rem)] rounded-xl p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmer la réinitialisation
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resetDialog?.description ?? "Cette action efface les données sélectionnées."}
              <br /><br />
              Vérifiez votre sauvegarde avant de continuer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetMutation.isPending}>Annuler</AlertDialogCancel>
            <Button type="button" variant="destructive" loading={resetMutation.isPending}
              onClick={() => resetDialog && resetMutation.mutate({
                module: resetDialog.module,
                type: resetDialog.type
              })}
            >
              Confirmer la suppression
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
