import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ParticipantWithRelations, SquadWithRelations } from "@shared/schema";
import { orderSquads, recommendSquad, SquadPlacementCard, squadPlaces } from "./squad-placement";

interface SquadSelectorProps {
  squads: SquadWithRelations[];
  players: readonly Pick<ParticipantWithRelations, "squadId">[];
  selectedSquadId: string;
  onSquadSelect: (squadId: string) => void;
}

export function SquadSelector({ squads, players, selectedSquadId, onSquadSelect }: SquadSelectorProps) {
  const [expandedSquad, setExpandedSquad] = useState<number | null>(null);
  const alreadyAssigned = new Map<number, number>();
  for (const { squadId } of players) {
    if (squadId !== null) alreadyAssigned.set(squadId, (alreadyAssigned.get(squadId) ?? 0) + 1);
  }
  const teams = squads.map(squad => ({ ...squad, members: squad.participants?.length ?? 0 }));
  const seatsNeeded = (id: number) => players.length - (alreadyAssigned.get(id) ?? 0);
  const recommendation = recommendSquad(teams, seatsNeeded);

  return (
    <div className="space-y-2">
      <Button type="button" variant={selectedSquadId === "" ? "default" : "outline"}
        className="w-full justify-start" onClick={() => onSquadSelect("")} data-testid="button-no-squad">
        Sans équipe
      </Button>

      {teams.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Aucune squad disponible pour ce créneau.</p> : (
        <>
          {players.length > 1 && (
            <p className="text-sm text-muted-foreground">
              {recommendation ? `Attribution de ${players.length} personnes.` : `Aucune équipe ne peut accueillir les ${players.length} personnes ensemble.`}
            </p>
          )}
          <ScrollArea className="h-[300px] rounded-lg border p-2">
            <ul className="space-y-2 pr-1" aria-label="Squads disponibles">
              {orderSquads(teams, seatsNeeded, recommendation?.id).map(team => {
                const isExpanded = expandedSquad === team.id;
                return (
                  <li key={team.id} className="rounded-lg bg-card" data-testid={`squad-card-${team.id}`}>
                    <SquadPlacementCard team={team} selected={selectedSquadId === String(team.id)}
                      label={team.id === recommendation?.id ? "Recommandée" : undefined}
                      disabled={squadPlaces(team) < seatsNeeded(team.id)} onSelect={() => onSquadSelect(String(team.id))} />
                    <Button type="button" variant="ghost" size="sm" className="min-h-11 text-muted-foreground"
                      aria-expanded={isExpanded} onClick={() => setExpandedSquad(isExpanded ? null : team.id)}
                      data-testid={`button-toggle-squad-${team.id}`}>
                      Membres <ChevronDown className={isExpanded ? "rotate-180" : undefined} />
                    </Button>
                    {isExpanded && (
                      <div className="border-t border-border px-3 py-2 text-sm">
                        {team.members === 0 ? <p className="text-muted-foreground">Aucun membre</p> : (
                          <ul className="space-y-1">
                            {team.participants?.map(participant => (
                              <li key={participant.id} data-testid={`participant-${participant.id}`}>
                                {participant.firstName} {participant.lastName}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
