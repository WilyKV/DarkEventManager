import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TimeSlot } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
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
import { UserPlus, Copy, Check } from "lucide-react";

const participantFormSchema = z.object({
  firstName: z.string().min(1, "Le prénom est obligatoire"),
  lastName: z.string().min(1, "Le nom est obligatoire"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  timeSlotId: z.coerce.number().optional(),
});

type ParticipantFormData = z.infer<typeof participantFormSchema>;

interface AddParticipantDialogProps {
  participantType: "zombie" | "survivant" | "staff";
}

/** Retourne l'id du créneau courant (dont la plage contient l'heure actuelle),
 *  ou le seul créneau si unique, ou undefined. Robuste si les champs sont absents. */
function findCurrentSlotId(slots: TimeSlot[]): number | undefined {
  if (slots.length === 1) return slots[0].id;
  if (slots.length === 0) return undefined;

  const now = new Date();
  const pad = (h: number, m: number) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const nowStr = pad(now.getHours(), now.getMinutes());

  for (const slot of slots) {
    try {
      const start = slot.briefingTime as string | undefined;
      const end = slot.exitTime as string | undefined;
      if (!start || !end) continue;
      // Comparer HH:MM lexicographiquement (suffisant pour créneaux journaliers)
      if (nowStr >= start.slice(0, 5) && nowStr <= end.slice(0, 5)) {
        return slot.id;
      }
    } catch {
      // Champ mal formé — on ignore ce créneau
    }
  }
  return undefined;
}

/** Déduit le type participant par défaut depuis les rôles du staff connecté.
 *  L'admin (ou tout rôle non ciblé) reçoit undefined (garde le choix de la prop). */
function defaultTypeFromRole(
  roles: string[] | undefined,
  contextType: "zombie" | "survivant" | "staff"
): "zombie" | "survivant" | "staff" {
  if (!roles) return contextType;
  if (roles.includes("staff_zombie") && !roles.includes("staff_survivant")) {
    return "zombie";
  }
  if (roles.includes("staff_survivant") && !roles.includes("staff_zombie")) {
    return "survivant";
  }
  return contextType;
}

interface SecretCodeBannerProps {
  code: string;
}

function SecretCodeBanner({ code }: SecretCodeBannerProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: "Copié !", description: `Code ${code} copié dans le presse-papier.` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Erreur copie",
        description: "Impossible d'accéder au presse-papier.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 p-4 text-center">
      <p className="text-sm text-muted-foreground mb-1">Code secret du participant</p>
      <p className="font-mono tracking-widest text-3xl font-bold text-primary">{code}</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-3 gap-2"
        onClick={handleCopy}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? "Copié !" : "Copier le code"}
      </Button>
    </div>
  );
}

export function AddParticipantDialog({ participantType }: AddParticipantDialogProps) {
  const [open, setOpen] = useState(false);
  const [lastSecretCode, setLastSecretCode] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Rôles de l'utilisateur connecté
  const userRoles: string[] = useMemo(() => {
    if (!user) return [];
    if (user.rolesList && user.rolesList.length > 0) return user.rolesList;
    return [];
  }, [user]);

  // Type effectif selon le rôle staff (ne change rien si le contexte impose déjà le type)
  const effectiveType = defaultTypeFromRole(userRoles, participantType);

  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: [`/api/time-slots?type=${effectiveType}`],
  });

  // Créneau courant calculé après chargement des créneaux
  const defaultTimeSlotId = useMemo(
    () => findCurrentSlotId(timeSlots),
    [timeSlots]
  );

  const form = useForm<ParticipantFormData>({
    resolver: zodResolver(participantFormSchema),
    mode: "onBlur",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      timeSlotId: undefined,
    },
  });

  // Synchronise le créneau par défaut dès que les données arrivent
  const currentTimeSlotId = form.watch("timeSlotId");
  if (
    defaultTimeSlotId !== undefined &&
    currentTimeSlotId === undefined &&
    timeSlots.length > 0
  ) {
    form.setValue("timeSlotId", defaultTimeSlotId);
  }

  const createMutation = useMutation({
    mutationFn: async (data: ParticipantFormData) => {
      const participantData = {
        ...data,
        type: effectiveType,
        timeSlotId: data.timeSlotId || null,
      };
      const res = await apiRequest("POST", "/api/participants", participantData);
      // apiRequest peut retourner la réponse ou la parser — on gère les deux cas
      if (res && typeof res === "object" && "json" in res && typeof (res as Response).json === "function") {
        return (res as Response).json();
      }
      return res;
    },
    onSuccess: (created: unknown) => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/participants");
        },
      });

      const secretCode =
        created &&
        typeof created === "object" &&
        "secretCode" in created &&
        typeof (created as { secretCode: unknown }).secretCode === "string"
          ? (created as { secretCode: string }).secretCode
          : null;

      if (secretCode) {
        setLastSecretCode(secretCode);
        toast({
          title: "Participant ajouté",
          description: `Code secret : ${secretCode}`,
        });
      } else {
        toast({
          title: "Participant ajouté",
          description: "Le participant a été créé avec succès.",
        });
      }

      form.reset();
      // On ne ferme PAS immédiatement : on affiche le code dans le dialog
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la création du participant.",
        variant: "destructive",
      });
      console.error("Error creating participant:", error);
    },
  });

  const onSubmit = (data: ParticipantFormData) => {
    createMutation.mutate(data);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setLastSecretCode(null);
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-participant">
          <UserPlus className="w-4 h-4 mr-2" />
          Ajouter un {participantType === "staff" ? "membre du personnel" : "participant"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Ajouter un {effectiveType === "zombie" ? "zombie" : effectiveType === "survivant" ? "survivant" : "membre du personnel"}
          </DialogTitle>
          <DialogDescription>
            Remplissez les informations pour créer un nouveau participant.
          </DialogDescription>
        </DialogHeader>

        {lastSecretCode ? (
          <div>
            <SecretCodeBanner code={lastSecretCode} />
            <div className="flex justify-end mt-6">
              <Button onClick={() => { setLastSecretCode(null); setOpen(false); }}>
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ex : Jean"
                        className="text-base"
                        {...field}
                        data-testid="input-firstname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ex : Dupont"
                        className="text-base"
                        {...field}
                        data-testid="input-lastname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        inputMode="email"
                        placeholder="ex : jean@mail.com"
                        className="text-base"
                        {...field}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Optionnel — pour l&apos;envoi du récap PDF
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeSlotId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Créneau horaire (optionnel)</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value ? parseInt(value) : undefined)
                      }
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-timeslot" className="text-base">
                          <SelectValue placeholder="Sélectionner un créneau" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot.id} value={slot.id.toString()}>
                            {slot.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  data-testid="button-cancel"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? "Création..." : "Créer"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
