import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ParticipantWithRelations } from "@shared/schema";
import { ParticipantBadge } from "@/components/participant-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { ManagementLayout } from "@/components/management-layout";

export default function BadgesPage() {
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithRelations | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [location] = useLocation();

  const { data: participants = [], isLoading } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants"],
  });

  // Auto-select participant from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const participantId = params.get("participantId");
    
    if (participantId && participants.length > 0 && !selectedParticipant) {
      const participant = participants.find(p => p.id === parseInt(participantId));
      if (participant) {
        setSelectedParticipant(participant);
      }
    }
  }, [participants, selectedParticipant]);

  const filteredParticipants = participants.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="print:hidden">
        <ManagementLayout
          title="Badges"
          subtitle="Sélectionnez un participant pour imprimer son badge avec QR code"
        >
          <div className="space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Participant Selection */}
          <Card className="print-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                Sélectionner un participant
              </CardTitle>
              <CardDescription>
                {participants.length} participant{participants.length !== 1 ? "s" : ""} au total
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="text"
                placeholder="Rechercher par nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 min-h-9 rounded-md border border-input bg-background text-foreground"
                data-testid="input-search-participant"
              />

              <div className="max-h-[500px] overflow-y-auto space-y-2">
                {isLoading && (
                  <p className="text-center text-muted-foreground py-8">
                    Chargement des participants...
                  </p>
                )}

                {!isLoading && filteredParticipants.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun participant trouvé
                  </p>
                )}

                {filteredParticipants.map(participant => (
                  <button
                    key={participant.id}
                    onClick={() => setSelectedParticipant(participant)}
                    className={`
                      w-full p-4 rounded-lg border text-left
                      hover-elevate active-elevate-2
                      ${selectedParticipant?.id === participant.id
                        ? "bg-primary/10 border-primary/50"
                        : "bg-card"}
                    `}
                    data-testid={`button-select-participant-${participant.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold">
                          {participant.firstName} {participant.lastName}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {participant.type === "zombie" ? "Zombie" : "Survivant"}
                          </Badge>
                          {participant.squad && (
                            <Badge variant="secondary" className="text-xs">
                              Squad {participant.squad.number}
                            </Badge>
                          )}
                          {participant.lockerNumber && (
                            <Badge variant="secondary" className="text-xs font-mono">
                              Casier {participant.lockerNumber}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Badge Preview */}
          <div className="space-y-4">
            {selectedParticipant ? (
              <>
                <div className="print-hidden flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Aperçu du badge</h2>
                  <Button onClick={handlePrint} data-testid="button-print-badge">
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimer
                  </Button>
                </div>
                <div className="flex justify-center print-full-page">
                  <ParticipantBadge participant={selectedParticipant} />
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <UserCircle className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Sélectionnez un participant<br />pour voir son badge
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        </div>
        </ManagementLayout>
      </div>

      {/* Print View - Only shown when printing */}
      {selectedParticipant && (
        <div className="hidden print:block">
          <ParticipantBadge participant={selectedParticipant} />
        </div>
      )}
    </>
  );
}
