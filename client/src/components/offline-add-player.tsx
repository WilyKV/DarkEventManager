import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkInProfiles, type CheckInType } from "@shared/check-in";
import { offlineNewPlayerSchema, type OfflineNewPlayer, type OfflineSnapshot } from "@shared/zombie-offline";

const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

export function OfflineAddPlayer({ data, busy, error, onClose, onSave }: {
  data: OfflineSnapshot;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (player: OfflineNewPlayer) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [type, setType] = useState(data.profileTypes[0]);
  const [timeSlotId, setTimeSlotId] = useState("");
  const [validationError, setValidationError] = useState("");
  const slots = data.timeSlots.filter(slot => slot.type === type || (slot.type === undefined &&
    (data.profileTypes.length === 1 || data.squads.some(squad => squad.type === type && squad.timeSlotId === slot.id))));

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="w-[calc(100%-1.25rem)] max-w-md rounded-xl">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>Ajouter un joueur</DialogTitle>
          <DialogDescription>Créez sa fiche sur cet appareil, puis enchaînez avec son accueil.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={event => {
          event.preventDefault();
          if (busy) return;
          const result = offlineNewPlayerSchema.safeParse({ firstName, lastName, type, timeSlotId: timeSlotId ? Number(timeSlotId) : null });
          if (!result.success) setValidationError(result.error.issues[0].message);
          else {
            setValidationError("");
            onSave(result.data);
          }
        }}>
          <label className="block space-y-1 text-sm">Prénom
            <Input className="min-h-11" required maxLength={100} value={firstName} onChange={event => setFirstName(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">Nom
            <Input className="min-h-11" required maxLength={100} value={lastName} onChange={event => setLastName(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">Profil
            <select className={selectClass} value={type} onChange={event => {
              setType(event.target.value as CheckInType);
              setTimeSlotId("");
            }}>
              {data.profileTypes.map(item => <option key={item} value={item}>{checkInProfiles[item].label}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-sm">Créneau
            <select className={selectClass} value={timeSlotId} onChange={event => setTimeSlotId(event.target.value)}>
              <option value="">Sans créneau</option>
              {slots.map(slot => <option key={slot.id} value={slot.id}>{slot.name}</option>)}
            </select>
          </label>
          {(validationError || error) && <p role="alert" className="text-sm text-destructive">{validationError || error}</p>}
          <Button type="submit" className="w-full" loading={busy}>Ajouter et accueillir</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
