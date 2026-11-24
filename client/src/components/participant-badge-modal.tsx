import { CardCodeActions } from "@/components/card-code-actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ParticipantCard, SouvenirPhoto, usePrintableCard } from "./participant-card";
import type { ParticipantWithRelations } from "@shared/schema";
import { cardsPath } from "@shared/participant-card";
import { apiRequest } from "@/lib/queryClient";

export function ParticipantBadgeModal({ participant, onClose }: {
  participant: ParticipantWithRelations;
  onClose: () => void;
}) {
  const card = usePrintableCard(participant.id);
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carte de {participant.firstName} {participant.lastName}</DialogTitle>
          <DialogDescription>Aperçu recto verso</DialogDescription>
        </DialogHeader>
        {card.isLoading && <p role="status">Préparation de la carte…</p>}
        {card.isError && <p role="alert">Impossible de charger la carte.</p>}
        {card.data && <><CardCodeActions key={card.data.id} card={card.data} /><ParticipantCard card={card.data} /></>}
        <SouvenirPhoto key={participant.id} onSave={async photo => {
          await apiRequest("PATCH", `${cardsPath}/${participant.id}/photo`, { photo });
        }} />
      </DialogContent>
    </Dialog>
  );
}
