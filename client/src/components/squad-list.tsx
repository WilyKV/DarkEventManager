import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Users, Clock } from "lucide-react";
import { SquadWithRelations } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SquadListProps {
  type: "zombie" | "survivant";
  showActions?: boolean;
}

export function SquadList({ type, showActions = false }: SquadListProps) {
  const { toast } = useToast();

  const { data: squads = [], isLoading } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type }],
    queryFn: async () => {
      const res = await fetch(`/api/squads/with-participants?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch squads");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (squadId: number) => {
      return apiRequest("DELETE", `/api/squads/${squadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/squads" });
      toast({
        title: "Squad supprimée",
        description: "La squad a été supprimée avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la squad",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (squads.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune squad créée pour le moment</p>
        </CardContent>
      </Card>
    );
  }

  // Group squads by timeslot
  const squadsByTimeslot = squads.reduce((acc, squad) => {
    const timeSlotId = squad.timeSlotId;
    if (!acc[timeSlotId]) {
      acc[timeSlotId] = [];
    }
    acc[timeSlotId].push(squad);
    return acc;
  }, {} as Record<number, SquadWithRelations[]>);

  return (
    <div className="space-y-6">
      {Object.entries(squadsByTimeslot).map(([timeSlotId, timeSlotSquads]) => {
        const timeSlot = timeSlotSquads[0]?.timeSlot;
        return (
          <div key={timeSlotId}>
            {/* Timeslot header */}
            {timeSlot && (
              <div className="mb-4 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">{timeSlot.name}</h3>
                  <Badge variant="outline" className="ml-2">
                    {timeSlotSquads.length} squad{timeSlotSquads.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground ml-7">
                  Briefing: {timeSlot.briefingTime} • Jeu: {timeSlot.gameTime} • Sortie: {timeSlot.exitTime}
                </p>
              </div>
            )}

            {/* Squads grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {timeSlotSquads.map((squad) => (
                <Card key={squad.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">Squad {squad.number}</CardTitle>
                      </div>
                      {showActions && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer la Squad {squad.number}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Les participants de cette squad ne seront pas supprimés,
                                mais ils ne seront plus assignés à une squad.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(squad.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Members count */}
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="outline" className="font-mono">
                        {squad.participants?.length || 0} / {squad.maxMembers}
                      </Badge>
                    </div>

                    {/* Briefing */}
                    {squad.briefing && (
                      <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                        {squad.briefing}
                      </div>
                    )}

                    {/* Members list */}
                    {squad.participants && squad.participants.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Membres:</p>
                        <div className="space-y-1">
                          {squad.participants.map((p) => (
                            <div key={p.id} className="text-sm text-muted-foreground flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              {p.firstName} {p.lastName}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
