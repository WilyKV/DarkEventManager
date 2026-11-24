import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound } from "lucide-react";
import { cardsPath, souvenirPath, type PrintableCard } from "@shared/participant-card";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function CardCodeActions({ card }: { card: PrintableCard }) {
  const { hasAnyRole } = useAuth();
  const client = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const link = new URL(`${souvenirPath}/${card.token}`, window.location.origin).href;
  const reset = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `${cardsPath}/admin/${card.id}/regenerate-code`);
      return await response.json() as { code: string };
    },
    onSuccess: async ({ code }) => {
      const queryKey = [cardsPath, "print", card.id];
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData<PrintableCard>(queryKey, current => ({ ...(current ?? card), code }));
    },
  });
  if (!hasAnyRole(["admin"])) return null;

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" loading={reset.isPending}><KeyRound /> Régénérer le code</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Régénérer le code d’accès ?</AlertDialogTitle>
            <AlertDialogDescription>L’ancien code et les sessions ouvertes avec ce code seront révoqués. Recopiez le nouveau code sur une carte de secours et remettez-la au participant.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => reset.mutate()}>Régénérer le code</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button type="button" variant="outline" onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        } catch {
          setShowLink(true);
        }
      }}><Copy /> Copier le lien souvenir</Button>
    </div>
    {showLink && <Input readOnly aria-label="Lien souvenir à copier" value={link} onFocus={event => event.currentTarget.select()} />}
    {copied && <p role="status" className="text-sm text-muted-foreground">Lien copié.</p>}
    {reset.isSuccess && <p role="status" className="text-sm">Nouveau code à recopier au verso <strong className="font-mono">{card.code.slice(0, 5)} {card.code.slice(5)}</strong></p>}
    {reset.isError && <p role="alert" className="text-sm text-destructive">Impossible de régénérer le code. Vérifiez que la carte est encore active.</p>}
  </div>;
}
