import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Square, BarChart3, Users, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function GameSessionManager() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSessionForStats, setSelectedSessionForStats] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    sessionId: "",
    name: "",
    type: "mixed",
    startTime: new Date().toISOString().slice(0, 16),
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["/api/ble/game-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/ble/game-sessions");
      if (!res.ok) throw new Error("Failed to fetch game sessions");
      return res.json();
    },
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/ble/game-sessions/stats", selectedSessionForStats],
    queryFn: async () => {
      if (!selectedSessionForStats) return null;
      const res = await fetch(
        `/api/ble/game-sessions/${selectedSessionForStats}/stats`
      );
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!selectedSessionForStats,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/ble/game-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: data.sessionId,
          name: data.name || null,
          type: data.type,
          startTime: new Date(data.startTime).toISOString(),
          status: "in_progress",
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/game-sessions"] });
      toast({ title: "Session créée avec succès" });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/ble/game-sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "completed" && { endTime: new Date().toISOString() }),
        }),
      });
      if (!res.ok) throw new Error("Failed to update session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/game-sessions"] });
      toast({ title: "Session mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      sessionId: "",
      name: "",
      type: "mixed",
      startTime: new Date().toISOString().slice(0, 16),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      scheduled: { variant: "secondary", label: "Planifiée", icon: null },
      in_progress: { variant: "default", label: "En cours", icon: Play },
      completed: { variant: "outline", label: "Terminée", icon: Square },
      cancelled: { variant: "destructive", label: "Annulée", icon: null },
    };
    const config = variants[status] || { variant: "default", label: status, icon: null };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant}>
        {Icon && <Icon className="mr-1 h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {sessions.length} session(s) enregistrée(s)
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Créer une session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Créer une nouvelle session de jeu</DialogTitle>
                <DialogDescription>
                  Définir une session pour suivre les hits et statistiques
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionId">ID de session *</Label>
                  <Input
                    id="sessionId"
                    value={formData.sessionId}
                    onChange={(e) =>
                      setFormData({ ...formData, sessionId: e.target.value })
                    }
                    placeholder="SESSION-2024-01-15"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la session</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Soirée Vendredi 20h"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zombie">Zombies uniquement</SelectItem>
                      <SelectItem value="survivant">Survivants uniquement</SelectItem>
                      <SelectItem value="mixed">Mixte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startTime">Heure de début</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Créer la session</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucune session créée. Commencez par en créer une.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session ID</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Hits</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session: any) => (
                <TableRow key={session.id}>
                  <TableCell className="font-mono text-xs">
                    {session.sessionId}
                  </TableCell>
                  <TableCell>{session.name || <span className="text-muted-foreground">Sans nom</span>}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{session.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(session.startTime), "PPp", { locale: fr })}
                  </TableCell>
                  <TableCell>{getStatusBadge(session.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-yellow-500" />
                      <span className="font-semibold">{session.totalHits || 0}</span>
                      <span className="text-muted-foreground text-xs">
                        ({session.validatedHits || 0} validés)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {session.status === "in_progress" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateSessionMutation.mutate({
                              id: session.id,
                              status: "completed",
                            })
                          }
                        >
                          <Square className="mr-1 h-3 w-3" />
                          Terminer
                        </Button>
                      )}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSessionForStats(session.sessionId)}
                          >
                            <BarChart3 className="mr-1 h-3 w-3" />
                            Stats
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Statistiques de la session</DialogTitle>
                            <DialogDescription>{session.sessionId}</DialogDescription>
                          </DialogHeader>
                          {isLoadingStats ? (
                            <div className="text-center py-8">Chargement...</div>
                          ) : stats ? (
                            <div className="grid gap-4">
                              <div className="grid grid-cols-3 gap-4">
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Total Hits</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold">
                                      {stats.totalHits}
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Zombies uniques</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold">
                                      {stats.uniqueZombies}
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Survivants uniques</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold">
                                      {stats.uniqueSurvivors}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">RSSI moyen</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold">
                                    {stats.avgRssi?.toFixed(1)} dBm
                                  </div>
                                </CardContent>
                              </Card>

                              {stats.topZombies && stats.topZombies.length > 0 && (
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm">Top Zombies</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-2">
                                      {stats.topZombies.map((zombie: any, idx: number) => (
                                        <div
                                          key={zombie.zombieId}
                                          className="flex justify-between items-center"
                                        >
                                          <span className="text-sm">
                                            #{idx + 1} - Zombie #{zombie.zombieId}
                                          </span>
                                          <Badge>{zombie.hitCount} hits</Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              Aucune statistique disponible
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
