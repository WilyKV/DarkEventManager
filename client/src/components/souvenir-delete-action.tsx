import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function SouvenirDeleteAction({ label, description, disabled, onConfirm }: {
  label: string;
  description: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  return <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button type="button" variant="outline" disabled={disabled}><Trash2 aria-hidden /> {label}</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{label} ?</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Annuler</AlertDialogCancel>
        <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={onConfirm}>Supprimer définitivement</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
