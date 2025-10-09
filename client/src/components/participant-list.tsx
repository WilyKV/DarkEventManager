import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, UserCheck, UserX, Edit, Printer, LogIn, LogOut } from "lucide-react";
import { Participant, ParticipantWithRelations, TimeSlot, Squad } from "@shared/schema";
import { SimpleCheckInModal } from "./simple-check-in-modal";
import { BatchCheckInFlowModal } from "./batch-check-in-flow-modal";
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBatchCheckIn, setShowBatchCheckIn] = useState(false);

  const filteredParticipants = participants.filter(p => {
    const matchesSearch = 
      p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSlot = selectedSlot === "all" || p.timeSlotId?.toString() === selectedSlot;
    return matchesSearch && matchesSlot;
  });

  const handleToggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredParticipants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredParticipants.map(p => p.id)));
    }
  };

  const handleBatchArrival = () => {
    if (selectedIds.size === 0) return;
    setShowBatchCheckIn(true);
  };

  const handleBatchReturn = async () => {
    if (selectedIds.size === 0) return;
    try {
      const selectedParticipants = participants.filter(p => selectedIds.has(p.id));
      for (const p of selectedParticipants) {
        await fetch(`/api/participants/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returned: true, returnedAt: new Date() }),
        });
      }
      setSelectedIds(new Set());
      onUpdate();
    } catch (error) {
      console.error("Batch return error:", error);
    }
  };

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

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" data-testid="badge-selected-count">
                  {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  data-testid="button-clear-selection"
                >
                  Désélectionner
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleBatchArrival}
                  className="gap-2"
                  data-testid="button-batch-arrival"
                >
                  <LogIn className="w-4 h-4" />
                  Marquer arrivé{selectedIds.size > 1 ? "s" : ""}
                </Button>
                <Button
                  onClick={handleBatchReturn}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-batch-return"
                >
                  <LogOut className="w-4 h-4" />
                  Marquer retour{selectedIds.size > 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Select All */}
        {filteredParticipants.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size === filteredParticipants.length && filteredParticipants.length > 0}
              onCheckedChange={handleSelectAll}
              data-testid="checkbox-select-all"
            />
            <label className="text-sm text-muted-foreground cursor-pointer" onClick={handleSelectAll}>
              Sélectionner tout
            </label>
          </div>
        )}

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
                  <div className="flex items-center gap-4 flex-1">
                    <Checkbox
                      checked={selectedIds.has(participant.id)}
                      onCheckedChange={() => handleToggleSelect(participant.id)}
                      data-testid={`checkbox-participant-${participant.id}`}
                    />
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
                          <strong className="text-foreground">Squad:</strong> #{participant.squad.number}
                        </span>
                      )}
                      {participant.secretCode && (
                        <span className="font-mono text-lg text-primary">
                          <strong className="text-foreground font-sans text-sm">Code:</strong> {participant.secretCode}
                        </span>
                      )}
                    </div>
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
        <SimpleCheckInModal
          participant={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
          onSuccess={() => {
            setSelectedParticipant(null);
            onUpdate();
          }}
        />
      )}

      {showBatchCheckIn && selectedIds.size > 0 && (
        <BatchCheckInFlowModal
          participants={participants.filter(p => selectedIds.has(p.id))}
          onClose={() => setShowBatchCheckIn(false)}
          onSuccess={() => {
            setShowBatchCheckIn(false);
            setSelectedIds(new Set());
            onUpdate();
          }}
        />
      )}
    </>
  );
}
