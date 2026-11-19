import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { liveQueryPrefixes, matchesQueryPrefix } from "@shared/live-updates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { TimeSlot } from "@shared/schema";
import { TimeSlotFields, timeSlotDialogClass, timeSlotFormSchema, timeSlotFormValues, type TimeSlotFormData } from "./time-slot-fields";

interface EditTimeSlotDialogProps {
  timeSlot: TimeSlot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTimeSlotDialog({ timeSlot, open, onOpenChange }: EditTimeSlotDialogProps) {
  const { toast } = useToast();

  const form = useForm<TimeSlotFormData>({
    resolver: zodResolver(timeSlotFormSchema),
    defaultValues: timeSlotFormValues(timeSlot),
  });

  useEffect(() => {
    form.reset(timeSlotFormValues(timeSlot));
  }, [timeSlot, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: TimeSlotFormData) => {
      return await apiRequest("PATCH", `/api/time-slots/${timeSlot.id}`, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) => typeof key === "string" &&
          liveQueryPrefixes.roster.some(prefix => matchesQueryPrefix(key, prefix)),
      });
      toast({
        title: "Créneau modifié",
        description: "Le créneau horaire a été modifié avec succès.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la modification du créneau.",
        variant: "destructive",
      });
      console.error("Error updating time slot:", error);
    },
  });

  const onSubmit = (data: TimeSlotFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={timeSlotDialogClass}>
        <DialogHeader>
          <DialogTitle>
            Modifier le créneau horaire
          </DialogTitle>
          <DialogDescription>
            Les précisions facultatives s’affichent à l’accueil des personnes de ce créneau.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <TimeSlotFields control={form.control} />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Modification..." : "Modifier"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
