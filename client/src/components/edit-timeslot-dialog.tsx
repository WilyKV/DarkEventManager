import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TimeSlot } from "@shared/schema";

const timeSlotFormSchema = z.object({
  name: z.string().min(1, "Le nom du créneau est obligatoire"),
  mealTime: z.string().min(1, "L'heure du repas est obligatoire"),
  briefingTime: z.string().min(1, "L'heure du briefing est obligatoire"),
  gameTime: z.string().min(1, "L'heure de jeu est obligatoire"),
  exitTime: z.string().min(1, "L'heure de sortie est obligatoire"),
});

type TimeSlotFormData = z.infer<typeof timeSlotFormSchema>;

interface EditTimeSlotDialogProps {
  timeSlot: TimeSlot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTimeSlotDialog({ timeSlot, open, onOpenChange }: EditTimeSlotDialogProps) {
  const { toast } = useToast();

  const form = useForm<TimeSlotFormData>({
    resolver: zodResolver(timeSlotFormSchema),
    defaultValues: {
      name: timeSlot.name,
      mealTime: timeSlot.mealTime,
      briefingTime: timeSlot.briefingTime,
      gameTime: timeSlot.gameTime,
      exitTime: timeSlot.exitTime,
    },
  });

  // Update form when timeSlot changes
  useEffect(() => {
    form.reset({
      name: timeSlot.name,
      mealTime: timeSlot.mealTime,
      briefingTime: timeSlot.briefingTime,
      gameTime: timeSlot.gameTime,
      exitTime: timeSlot.exitTime,
    });
  }, [timeSlot, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: TimeSlotFormData) => {
      return await apiRequest("PATCH", `/api/time-slots/${timeSlot.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/time-slots");
        }
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Modifier le créneau horaire
          </DialogTitle>
          <DialogDescription>
            Modifiez les informations du créneau horaire.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du créneau</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Créneau 1, Matin, Après-midi..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mealTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heure du repas</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="briefingTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heure du briefing</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gameTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heure de jeu</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="exitTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heure de sortie</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
