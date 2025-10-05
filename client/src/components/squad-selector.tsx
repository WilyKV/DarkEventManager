import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SquadWithRelations } from "@shared/schema";
import { Users, UserPlus } from "lucide-react";

interface SquadSelectorProps {
  squads: SquadWithRelations[];
  selectedSquadId: string;
  onSquadSelect: (squadId: string) => void;
  participantType: "zombie" | "survivant";
}

export function SquadSelector({ 
  squads, 
  selectedSquadId, 
  onSquadSelect,
  participantType 
}: SquadSelectorProps) {
  const [expandedSquad, setExpandedSquad] = useState<number | null>(null);

  const toggleSquad = (squadId: number) => {
    setExpandedSquad(expandedSquad === squadId ? null : squadId);
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">
        Attribution à une Squad
        {participantType === "zombie" && (
          <span className="text-sm text-muted-foreground font-normal ml-2">
            (Maximum 8 squads par créneau)
          </span>
        )}
      </Label>
      
      <div className="space-y-2">
        <Button
          variant={selectedSquadId === "" ? "default" : "outline"}
          className="w-full justify-start gap-2"
          onClick={() => onSquadSelect("")}
          data-testid="button-no-squad"
        >
          Aucune squad
        </Button>

        <ScrollArea className="h-[300px] rounded-md border p-2">
          <div className="space-y-2">
            {squads.map((squad) => {
              const memberCount = squad.participants?.length || 0;
              const isSelected = selectedSquadId === squad.id.toString();
              const isExpanded = expandedSquad === squad.id;

              return (
                <div
                  key={squad.id}
                  className="rounded-lg border bg-card"
                  data-testid={`squad-card-${squad.id}`}
                >
                  <div className="flex items-center gap-2 p-3">
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="flex-1 justify-start gap-2"
                      onClick={() => onSquadSelect(squad.id.toString())}
                      data-testid={`button-select-squad-${squad.id}`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="font-semibold">
                        Squad {squad.number}
                      </span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSquad(squad.id)}
                      data-testid={`button-toggle-squad-${squad.id}`}
                    >
                      <Users className="w-4 h-4 mr-1" />
                      <Badge variant="secondary" className="ml-1">
                        {memberCount}
                        {squad.maxMembers && `/${squad.maxMembers}`}
                      </Badge>
                    </Button>
                  </div>

                  {isExpanded && memberCount > 0 && (
                    <div className="border-t p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-2 font-semibold">
                        Membres ({memberCount})
                      </p>
                      <div className="space-y-1">
                        {squad.participants?.map((participant) => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-2 text-sm p-1.5 rounded bg-background"
                            data-testid={`participant-${participant.id}`}
                          >
                            <span className="font-medium">
                              {participant.firstName} {participant.lastName}
                            </span>
                            {participant.lockerNumber && (
                              <Badge variant="outline" className="ml-auto text-xs">
                                Casier {participant.lockerNumber}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isExpanded && memberCount === 0 && (
                    <div className="border-t p-3 bg-muted/30">
                      <p className="text-sm text-muted-foreground italic text-center">
                        Aucun membre dans cette squad
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {squads.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucune squad disponible</p>
                <p className="text-sm mt-1">
                  Créez des squads pour ce créneau
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
