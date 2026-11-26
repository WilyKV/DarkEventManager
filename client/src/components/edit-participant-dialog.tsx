import { StaffCompensationEditor } from "./staff-compensation";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";
import type { InsertParticipant, ParticipantWithRelations, TimeSlot } from "@shared/schema";
import { liveQueryPrefixes, matchesQueryPrefix } from "@shared/live-updates";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditParticipantDialogProps {
  participant: ParticipantWithRelations;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditParticipantDialog({ participant, onClose, onSuccess }: EditParticipantDialogProps) {
  const { hasAnyRole } = useAuth();
  const staff = participant.type === "staff";
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: participant.firstName,
    lastName: participant.lastName,
    email: participant.email || "",
    timeSlotId: participant.timeSlotId?.toString() || "none",
  });

  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: participant.type }],
    queryFn: async () => {
      const res = await fetch(`/api/time-slots?type=${participant.type}`);
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<InsertParticipant>) => {
      return apiRequest("PATCH", `/api/participants/${participant.id}`, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) => typeof key === "string" &&
          liveQueryPrefixes.roster.some(prefix => matchesQueryPrefix(key, prefix)),
      });
      toast({
        title: "Participant modifié",
        description: "Les informations ont été mises à jour avec succès",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le participant",
        variant: "destructive",
      });
    },
  });

  const regenerateCodeMutation = useMutation({
    mutationFn: async () => {
      // Generate a new code by calling the API
      const response = await fetch('/api/participants/regenerate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id }),
      });
      if (!response.ok) throw new Error('Failed to regenerate code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "/api/participants"
      });
      toast({
        title: "Code régénéré",
        description: "Un nouveau code unique a été généré",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de régénérer le code",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim() || updateMutation.isPending) return;
    const updateData = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email || null,
      timeSlotId: formData.timeSlotId && formData.timeSlotId !== "none" ? parseInt(formData.timeSlotId) : null,
    };

    updateMutation.mutate(updateData);
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !updateMutation.isPending) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.25rem)] max-w-md overflow-y-auto rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Modifier le participant</DialogTitle>
          <DialogDescription>{participant.firstName} {participant.lastName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Prénom *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Nom *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeSlot">{staff ? "Attribution" : "Créneau"}</Label>
            <Select
              value={formData.timeSlotId}
              onValueChange={(value) => setFormData({ ...formData, timeSlotId: value })}
            >
              <SelectTrigger id="timeSlot">
                <SelectValue placeholder={staff ? "Sélectionner une attribution" : "Sélectionner un créneau"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{staff ? "Sans attribution" : "Aucun créneau"}</SelectItem>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot.id} value={slot.id.toString()}>
                    {slot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label>Code unique</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-muted rounded-md">
                <p className="font-mono text-lg font-bold text-primary">
                  {participant.secretCode || "Non assigné"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => regenerateCodeMutation.mutate()}
                disabled={regenerateCodeMutation.isPending}
                title="Régénérer le code"
              >
                {regenerateCodeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cliquez sur l'icône pour générer un nouveau code unique
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={updateMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || !formData.firstName.trim() || !formData.lastName.trim()}
              className="flex-1"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </form>
        {staff && hasAnyRole(["admin"]) && <StaffCompensationEditor participantId={participant.id} />}
      </DialogContent>
    </Dialog>
  );
}
