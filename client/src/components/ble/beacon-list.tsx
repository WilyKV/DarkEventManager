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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Radio, Battery, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Beacon {
  id: number;
  hardwareId: string;
  uuid: string | null;
  major: number | null;
  minor: number | null;
  name: string | null;
  status: string;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function BeaconList() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingBeacon, setEditingBeacon] = useState<Beacon | null>(null);
  const [formData, setFormData] = useState({
    hardwareId: "",
    uuid: "",
    major: "",
    minor: "",
    name: "",
    status: "available",
    batteryLevel: "100",
    notes: "",
  });

  const { data: beacons = [], isLoading } = useQuery<Beacon[]>({
    queryKey: ["/api/ble/beacons"],
    queryFn: async () => {
      const res = await fetch("/api/ble/beacons");
      if (!res.ok) throw new Error("Failed to fetch beacons");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/ble/beacons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hardwareId: data.hardwareId,
          uuid: data.uuid || null,
          major: data.major ? parseInt(data.major) : null,
          minor: data.minor ? parseInt(data.minor) : null,
          name: data.name || null,
          status: data.status,
          batteryLevel: data.batteryLevel ? parseInt(data.batteryLevel) : null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create beacon");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/beacons"] });
      toast({ title: "Beacon créé avec succès" });
      setShowAddDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/ble/beacons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hardwareId: data.hardwareId,
          uuid: data.uuid || null,
          major: data.major ? parseInt(data.major) : null,
          minor: data.minor ? parseInt(data.minor) : null,
          name: data.name || null,
          status: data.status,
          batteryLevel: data.batteryLevel ? parseInt(data.batteryLevel) : null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update beacon");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/beacons"] });
      toast({ title: "Beacon mis à jour avec succès" });
      setEditingBeacon(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ble/beacons/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete beacon");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/beacons"] });
      toast({ title: "Beacon supprimé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      hardwareId: "",
      uuid: "",
      major: "",
      minor: "",
      name: "",
      status: "available",
      batteryLevel: "100",
      notes: "",
    });
  };

  const handleEdit = (beacon: Beacon) => {
    setEditingBeacon(beacon);
    setFormData({
      hardwareId: beacon.hardwareId,
      uuid: beacon.uuid || "",
      major: beacon.major?.toString() || "",
      minor: beacon.minor?.toString() || "",
      name: beacon.name || "",
      status: beacon.status,
      batteryLevel: beacon.batteryLevel?.toString() || "100",
      notes: beacon.notes || "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBeacon) {
      updateMutation.mutate({ id: editingBeacon.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      available: { variant: "default", label: "Disponible" },
      assigned: { variant: "secondary", label: "Assigné" },
      in_use: { variant: "outline", label: "En cours" },
      lost: { variant: "destructive", label: "Perdu" },
      damaged: { variant: "destructive", label: "Endommagé" },
    };
    const config = variants[status] || { variant: "default", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getBatteryIcon = (level: number | null) => {
    if (!level) return <Battery className="h-4 w-4 text-gray-400" />;
    const color = level > 50 ? "text-green-500" : level > 20 ? "text-yellow-500" : "text-red-500";
    return <Battery className={`h-4 w-4 ${color}`} />;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {beacons.length} beacon(s) enregistré(s)
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un beacon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Ajouter un nouveau beacon</DialogTitle>
                <DialogDescription>
                  Enregistrer un bracelet BLE pour les survivants
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hardwareId">Hardware ID *</Label>
                    <Input
                      id="hardwareId"
                      value={formData.hardwareId}
                      onChange={(e) =>
                        setFormData({ ...formData, hardwareId: e.target.value })
                      }
                      placeholder="UUID:Major:Minor ou UUID complet"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Beacon-001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="uuid">UUID</Label>
                    <Input
                      id="uuid"
                      value={formData.uuid}
                      onChange={(e) => setFormData({ ...formData, uuid: e.target.value })}
                      placeholder="A7C34E12-..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="major">Major</Label>
                    <Input
                      id="major"
                      type="number"
                      value={formData.major}
                      onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minor">Minor</Label>
                    <Input
                      id="minor"
                      type="number"
                      value={formData.minor}
                      onChange={(e) => setFormData({ ...formData, minor: e.target.value })}
                      placeholder="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Statut</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Disponible</SelectItem>
                        <SelectItem value="assigned">Assigné</SelectItem>
                        <SelectItem value="in_use">En cours</SelectItem>
                        <SelectItem value="lost">Perdu</SelectItem>
                        <SelectItem value="damaged">Endommagé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batteryLevel">Batterie (%)</Label>
                    <Input
                      id="batteryLevel"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.batteryLevel}
                      onChange={(e) =>
                        setFormData({ ...formData, batteryLevel: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Informations supplémentaires..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Créer le beacon</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : beacons.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucun beacon enregistré. Ajoutez-en un pour commencer.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hardware ID</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>UUID / Major / Minor</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Batterie</TableHead>
                <TableHead>Dernière détection</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beacons.map((beacon) => (
                <TableRow key={beacon.id}>
                  <TableCell className="font-mono text-xs">
                    {beacon.hardwareId}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-blue-500" />
                      {beacon.name || <span className="text-muted-foreground">Sans nom</span>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {beacon.uuid && (
                      <div className="space-y-0.5">
                        <div className="text-muted-foreground">{beacon.uuid.substring(0, 8)}...</div>
                        <div>
                          M:{beacon.major || "?"} / m:{beacon.minor || "?"}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(beacon.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getBatteryIcon(beacon.batteryLevel)}
                      {beacon.batteryLevel ? `${beacon.batteryLevel}%` : "N/A"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {beacon.lastSeenAt
                      ? formatDistanceToNow(new Date(beacon.lastSeenAt), {
                          addSuffix: true,
                          locale: fr,
                        })
                      : "Jamais"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog
                        open={editingBeacon?.id === beacon.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setEditingBeacon(null);
                            resetForm();
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(beacon)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <form onSubmit={handleSubmit}>
                            <DialogHeader>
                              <DialogTitle>Modifier le beacon</DialogTitle>
                              <DialogDescription>
                                Mettre à jour les informations du beacon
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-hardwareId">Hardware ID *</Label>
                                  <Input
                                    id="edit-hardwareId"
                                    value={formData.hardwareId}
                                    onChange={(e) =>
                                      setFormData({ ...formData, hardwareId: e.target.value })
                                    }
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-name">Nom</Label>
                                  <Input
                                    id="edit-name"
                                    value={formData.name}
                                    onChange={(e) =>
                                      setFormData({ ...formData, name: e.target.value })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-uuid">UUID</Label>
                                  <Input
                                    id="edit-uuid"
                                    value={formData.uuid}
                                    onChange={(e) =>
                                      setFormData({ ...formData, uuid: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-major">Major</Label>
                                  <Input
                                    id="edit-major"
                                    type="number"
                                    value={formData.major}
                                    onChange={(e) =>
                                      setFormData({ ...formData, major: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-minor">Minor</Label>
                                  <Input
                                    id="edit-minor"
                                    type="number"
                                    value={formData.minor}
                                    onChange={(e) =>
                                      setFormData({ ...formData, minor: e.target.value })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-status">Statut</Label>
                                  <Select
                                    value={formData.status}
                                    onValueChange={(value) =>
                                      setFormData({ ...formData, status: value })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="available">Disponible</SelectItem>
                                      <SelectItem value="assigned">Assigné</SelectItem>
                                      <SelectItem value="in_use">En cours</SelectItem>
                                      <SelectItem value="lost">Perdu</SelectItem>
                                      <SelectItem value="damaged">Endommagé</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-batteryLevel">Batterie (%)</Label>
                                  <Input
                                    id="edit-batteryLevel"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.batteryLevel}
                                    onChange={(e) =>
                                      setFormData({ ...formData, batteryLevel: e.target.value })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-notes">Notes</Label>
                                <Input
                                  id="edit-notes"
                                  value={formData.notes}
                                  onChange={(e) =>
                                    setFormData({ ...formData, notes: e.target.value })
                                  }
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="submit">Mettre à jour</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Êtes-vous sûr de vouloir supprimer ce beacon ?")) {
                            deleteMutation.mutate(beacon.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
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
