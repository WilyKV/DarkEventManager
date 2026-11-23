import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ParticipantWithRelations, SquadWithRelations } from "@shared/schema";
import { orderSquads, placementLabels, recommendSquad, SquadPlacementCard, squadPlaces } from "./squad-placement";

interface SquadSelectorProps {
  squads: SquadWithRelations[];
  players: readonly Pick<ParticipantWithRelations, "squadId" | "type">[];
  selectedSquadId: string;
  onSquadSelect: (squadId: string) => void;
}

export function SquadSelector({ squads, players, selectedSquadId, onSquadSelect }: SquadSelectorProps) {
  const profile = players[0]?.type;
  const words = placementLabels(profile);
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
        Sans {words.noun}
      </Button>

      {teams.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Aucune {words.noun} disponible pour ce créneau.</p> : (
        <>
          {players.length > 1 && (
            <p className="text-sm text-muted-foreground">
              {recommendation ? `Attribution de ${players.length} personnes.` : `Aucune ${words.noun} ne peut accueillir les ${players.length} personnes ensemble.`}
            </p>
          )}
          <ScrollArea className="h-[300px] rounded-lg border p-2">
            <ul className="space-y-2 pr-1" aria-label={`${words.plural} disponibles`}>
              {orderSquads(teams, seatsNeeded, recommendation?.id).map(team => (
                <li key={team.id} data-testid={`squad-card-${team.id}`}>
                  <SquadPlacementCard team={team} profile={profile} people={team.participants}
                    selected={selectedSquadId === String(team.id)} label={team.id === recommendation?.id ? "Recommandée" : undefined}
                    disabled={squadPlaces(team) < seatsNeeded(team.id)} onSelect={() => onSquadSelect(String(team.id))} />
                </li>
              ))}
            </ul>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
