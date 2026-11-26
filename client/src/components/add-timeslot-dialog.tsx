import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";
import { staffAssignmentFormSchema, TimeSlotFields, timeSlotDialogClass, timeSlotFormSchema, timeSlotFormValues, type TimeSlotFormData } from "./time-slot-fields";

interface AddTimeSlotDialogProps {
  type: "zombie" | "survivant" | "staff";
}

export function AddTimeSlotDialog({ type }: AddTimeSlotDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const staff = type === "staff";

  const form = useForm<TimeSlotFormData>({
    resolver: zodResolver(staff ? staffAssignmentFormSchema : timeSlotFormSchema),
    defaultValues: timeSlotFormValues(),
  });

  const createMutation = useMutation({
    mutationFn: async (data: TimeSlotFormData) => {
      const timeSlotData = {
        ...data,
        ...(staff && { gameTime: "" }),
        type,
      };
      return await apiRequest("POST", "/api/time-slots", timeSlotData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) => typeof key === "string" &&
          liveQueryPrefixes.roster.some(prefix => matchesQueryPrefix(key, prefix)),
      });
      toast({
        title: staff ? "Attribution ajoutée" : "Créneau ajouté",
        description: staff ? "L’attribution a été créée." : "Le créneau horaire a été créé avec succès.",
      });
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: staff ? "Impossible d’enregistrer l’attribution." : "Impossible d’enregistrer le créneau.",
        variant: "destructive",
      });
      console.error("Error creating time slot:", error);
    },
  });

  const onSubmit = (data: TimeSlotFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-timeslot">
          <Clock className="w-4 h-4 mr-2" />
          Ajouter {type === "staff" ? "une attribution" : "un créneau"}
        </Button>
      </DialogTrigger>
      <DialogContent className={timeSlotDialogClass}>
        <DialogHeader>
          <DialogTitle>
            {staff ? "Ajouter une attribution" : `Ajouter un créneau horaire (${type})`}
          </DialogTitle>
          <DialogDescription>
            {staff ? "Les précisions facultatives s’affichent à l’accueil du staff." : "Les précisions facultatives s’affichent à l’accueil des personnes de ce créneau."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <TimeSlotFields control={form.control} staff={staff} />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-timeslot"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-timeslot"
              >
                {createMutation.isPending ? "Création..." : "Créer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
