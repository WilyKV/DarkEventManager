import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Squad, TimeSlot } from "@shared/schema";

const squadFormSchema = z.object({
  number: z.coerce.number().min(1, "Le numéro de squad est obligatoire"),
  timeSlotId: z.coerce.number().min(1, "Le créneau est obligatoire"),
  maxMembers: z.coerce.number().min(1, "Le nombre maximum de membres est obligatoire"),
});

type SquadFormData = z.infer<typeof squadFormSchema>;

interface EditSquadDialogProps {
  squad: Squad;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSquadDialog({ squad, open, onOpenChange }: EditSquadDialogProps) {
  const { toast } = useToast();

  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: squad.type }],
    queryFn: async () => {
      const res = await fetch(`/api/time-slots?type=${squad.type}`);
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  const form = useForm<SquadFormData>({
    resolver: zodResolver(squadFormSchema),
    defaultValues: {
      number: squad.number,
      timeSlotId: squad.timeSlotId,
      maxMembers: squad.maxMembers,
    },
  });

  // Update form when squad changes
  useEffect(() => {
    form.reset({
      number: squad.number,
      timeSlotId: squad.timeSlotId,
      maxMembers: squad.maxMembers,
    });
  }, [squad, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: SquadFormData) => {
      return await apiRequest("PATCH", `/api/squads/${squad.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/squads");
        }
      });
      toast({
        title: "Squad modifiée",
        description: "La squad a été modifiée avec succès.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la modification de la squad.",
        variant: "destructive",
      });
      console.error("Error updating squad:", error);
    },
  });

  const onSubmit = (data: SquadFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Modifier la squad
          </DialogTitle>
          <DialogDescription>
            Modifiez les informations de la squad.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro de la squad</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Ex: 1, 2, 3..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timeSlotId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Créneau horaire</FormLabel>
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(value) => field.onChange(parseInt(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un créneau" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot.id} value={slot.id.toString()}>
                          {slot.name} - Jeu: {slot.gameTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxMembers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre maximum de membres</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Ex: 8"
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
