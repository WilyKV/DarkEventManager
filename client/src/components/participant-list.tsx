import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserCheck, UserX, Edit, Printer } from "lucide-react";
import { Participant, ParticipantWithRelations, TimeSlot, Squad } from "@shared/schema";
import { CheckInModal } from "./check-in-modal";
import { Link } from "wouter";

interface ParticipantListProps {
  participants: ParticipantWithRelations[];
  timeSlots: TimeSlot[];
  squads: Squad[];
  type: "zombie" | "survivant";
  onUpdate: () => void;
}

export function ParticipantList({ participants, timeSlots, squads, type, onUpdate }: ParticipantListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string>("all");
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithRelations | null>(null);

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = 
      p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSlot = selectedSlot === "all" || p.timeSlotId?.toString() === selectedSlot;
    return matchesSearch && matchesSlot;
  });

  return (
    <>
      <div className="space-y-6">
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou prénom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-participant"
            />
          </div>
          <select
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
            className="px-4 min-h-9 rounded-md border border-input bg-background text-foreground"
            data-testid="select-time-slot"
          >
            <option value="all">Tous les créneaux</option>
            {timeSlots.map(slot => (
              <option key={slot.id} value={slot.id.toString()}>{slot.name}</option>
            ))}
          </select>
        </div>

        {/* Participants Grid */}
        <div className="grid gap-4">
          {filteredParticipants.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Aucun participant trouvé</p>
            </Card>
          ) : (
            filteredParticipants.map(participant => (
              <Card 
                key={participant.id} 
                className="p-6 hover-elevate transition-all"
                data-testid={`card-participant-${participant.id}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-xl font-semibold text-foreground">
                        {participant.firstName} {participant.lastName}
                      </h3>
                      {participant.arrived ? (
                        <Badge className="bg-primary text-primary-foreground" data-testid={`badge-arrived-${participant.id}`}>
                          <UserCheck className="w-3 h-3 mr-1" />
                          Arrivé
                        </Badge>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-not-arrived-${participant.id}`}>
                          <UserX className="w-3 h-3 mr-1" />
                          En attente
                        </Badge>
                      )}
                      {participant.checklistCompleted && (
                        <Badge className="bg-chart-1 text-white" data-testid={`badge-checklist-${participant.id}`}>
                          Checklist OK
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>
                        <strong className="text-foreground">Créneau:</strong>{" "}
                        {participant.timeSlot?.name || "Non assigné"}
                      </span>
                      {participant.squad && (
                        <span>
                          <strong className="text-foreground">Squad:</strong> {participant.squad.name}
                        </span>
                      )}
                      {participant.lockerNumber && (
                        <span className="font-mono text-lg text-primary">
                          <strong className="text-foreground font-sans text-sm">Casier:</strong> {participant.lockerNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/badges?participantId=${participant.id}`}>
                      <Button
                        variant="outline"
                        className="gap-2"
                        data-testid={`button-print-badge-${participant.id}`}
                      >
                        <Printer className="w-4 h-4" />
                        Badge
                      </Button>
                    </Link>
                    <Button
                      onClick={() => setSelectedParticipant(participant)}
                      className="gap-2"
                      data-testid={`button-manage-${participant.id}`}
                    >
                      <Edit className="w-4 h-4" />
                      {participant.arrived ? "Modifier" : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {selectedParticipant && (
        <CheckInModal
          participant={selectedParticipant}
          squads={squads.filter(s => s.type === type)}
          onClose={() => setSelectedParticipant(null)}
          onSuccess={() => {
            setSelectedParticipant(null);
            onUpdate();
          }}
        />
      )}
    </>
  );
}
