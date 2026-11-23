import { ExternalLink } from "lucide-react";
import { adminSouvenirPath } from "@shared/participant-card";
import { Button } from "@/components/ui/button";

export function AdminSouvenirLink({ id, name }: { id: number; name: string }) {
  return <Button asChild size="icon" variant="ghost">
    <a href={`${adminSouvenirPath}/${id}`} target="_blank" rel="noopener noreferrer"
      title="Voir l’espace souvenir" aria-label={`Voir l’espace souvenir — ${name} (nouvel onglet)`}>
      <ExternalLink aria-hidden />
    </a>
  </Button>;
}
