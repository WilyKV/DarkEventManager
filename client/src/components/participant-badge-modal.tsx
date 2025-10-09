import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ParticipantBadge } from "./participant-badge";
import { ParticipantWithRelations } from "@shared/schema";

interface ParticipantBadgeModalProps {
  participant: ParticipantWithRelations;
  onClose: () => void;
}

export function ParticipantBadgeModal({ participant, onClose }: ParticipantBadgeModalProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <ParticipantBadge participant={participant} />
      </DialogContent>
    </Dialog>
  );
}
