import { useState } from "react";
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
  DialogTrigger,
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
import { Clock } from "lucide-react";

const timeSlotFormSchema = z.object({
  name: z.string().min(1, "Le nom du créneau est obligatoire"),
  mealTime: z.string().min(1, "L'heure du repas est obligatoire"),
  briefingTime: z.string().min(1, "L'heure du briefing est obligatoire"),
  gameTime: z.string().min(1, "L'heure de jeu est obligatoire"),
  exitTime: z.string().min(1, "L'heure de sortie est obligatoire"),
});

type TimeSlotFormData = z.infer<typeof timeSlotFormSchema>;

interface AddTimeSlotDialogProps {
  type: "zombie" | "survivant";
}

export function AddTimeSlotDialog({ type }: AddTimeSlotDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<TimeSlotFormData>({
    resolver: zodResolver(timeSlotFormSchema),
    defaultValues: {
      name: "",
      mealTime: "",
      briefingTime: "",
      gameTime: "",
      exitTime: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TimeSlotFormData) => {
      const timeSlotData = {
        ...data,
        type,
      };
      return await apiRequest("POST", "/api/time-slots", timeSlotData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/time-slots");
        }
      });
      toast({
        title: "Créneau ajouté",
        description: "Le créneau horaire a été créé avec succès.",
      });
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la création du créneau.",
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
          Ajouter un créneau
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Ajouter un créneau horaire ({type})
          </DialogTitle>
          <DialogDescription>
            Remplissez les informations pour créer un nouveau créneau horaire.
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
                      data-testid="input-timeslot-name"
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
                      data-testid="input-meal-time"
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
                      data-testid="input-briefing-time"
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
                      data-testid="input-game-time"
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
                      data-testid="input-exit-time"
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
