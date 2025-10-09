import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ParticipantWithRelations } from "@shared/schema";
import { ParticipantBadge } from "@/components/participant-badge";
import { DataSyncButton } from "@/components/data-sync-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, UserCircle, Database, IdCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { ManagementLayout } from "@/components/management-layout";

export default function BadgesPage() {
  const [activeTab, setActiveTab] = useState("badges");
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithRelations | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [location] = useLocation();

  const { data: participants = [], isLoading } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants"],
    queryFn: async () => {
      const res = await fetch("/api/participants");
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
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

  // Update selected participant when data refreshes
  useEffect(() => {
    if (selectedParticipant && participants.length > 0) {
      const updatedParticipant = participants.find(p => p.id === selectedParticipant.id);
      if (updatedParticipant) {
        setSelectedParticipant(updatedParticipant);
      }
    }
  }, [participants]);

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
          subtitle="Impression et gestion des badges participants"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted/50 border border-border/50">
              <TabsTrigger value="badges" className="gap-2 data-[state=active]:bg-indigo-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/20">
                <IdCard className="w-4 h-4" />
                Badges
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-2 data-[state=active]:bg-indigo-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/20">
                <Database className="w-4 h-4" />
                Données
              </TabsTrigger>
            </TabsList>

            {/* Badges Tab */}
            <TabsContent value="badges" className="space-y-6">
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
                          {participant.secretCode && (
                            <Badge variant="secondary" className="text-xs font-mono">
                              Code {participant.secretCode}
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
            </TabsContent>

            {/* Data Tab */}
            <TabsContent value="data" className="space-y-6">
              <DataSyncButton
                module="all"
                title="Gestion des données"
                description="Synchronisez toutes les données de l'application vers l'appareil maître"
              />
            </TabsContent>
          </Tabs>
        </ManagementLayout>
      </div>      {/* Print View - Only shown when printing */}
      {selectedParticipant && (
        <div className="hidden print:block">
          <ParticipantBadge participant={selectedParticipant} />
        </div>
      )}
    </>
  );
}
