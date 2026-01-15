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
import { Plus, Pencil, Trash2, ScanLine, Battery, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Scanner {
  id: number;
  hardwareId: string;
  macAddress: string | null;
  name: string | null;
  status: string;
  batteryLevel: number | null;
  firmwareVersion: string | null;
  lastSyncAt: string | null;
  hitCount: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ScannerList() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingScanner, setEditingScanner] = useState<Scanner | null>(null);
  const [formData, setFormData] = useState({
    hardwareId: "",
    macAddress: "",
    name: "",
    status: "available",
    batteryLevel: "100",
    firmwareVersion: "",
    notes: "",
  });

  const { data: scanners = [], isLoading } = useQuery<Scanner[]>({
    queryKey: ["/api/ble/scanners"],
    queryFn: async () => {
      const res = await fetch("/api/ble/scanners");
      if (!res.ok) throw new Error("Failed to fetch scanners");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/ble/scanners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hardwareId: data.hardwareId,
          macAddress: data.macAddress || null,
          name: data.name || null,
          status: data.status,
          batteryLevel: data.batteryLevel ? parseInt(data.batteryLevel) : null,
          firmwareVersion: data.firmwareVersion || null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create scanner");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/scanners"] });
      toast({ title: "Scanner créé avec succès" });
      setShowAddDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/ble/scanners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hardwareId: data.hardwareId,
          macAddress: data.macAddress || null,
          name: data.name || null,
          status: data.status,
          batteryLevel: data.batteryLevel ? parseInt(data.batteryLevel) : null,
          firmwareVersion: data.firmwareVersion || null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update scanner");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/scanners"] });
      toast({ title: "Scanner mis à jour avec succès" });
      setEditingScanner(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/ble/scanners/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete scanner");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/scanners"] });
      toast({ title: "Scanner supprimé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      hardwareId: "",
      macAddress: "",
      name: "",
      status: "available",
      batteryLevel: "100",
      firmwareVersion: "",
      notes: "",
    });
  };

  const handleEdit = (scanner: Scanner) => {
    setEditingScanner(scanner);
    setFormData({
      hardwareId: scanner.hardwareId,
      macAddress: scanner.macAddress || "",
      name: scanner.name || "",
      status: scanner.status,
      batteryLevel: scanner.batteryLevel?.toString() || "100",
      firmwareVersion: scanner.firmwareVersion || "",
      notes: scanner.notes || "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingScanner) {
      updateMutation.mutate({ id: editingScanner.id, data: formData });
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
          {scanners.length} scanner(s) enregistré(s)
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un scanner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Ajouter un nouveau scanner ESP32</DialogTitle>
                <DialogDescription>
                  Enregistrer un bracelet scanner pour les zombies
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
                      placeholder="ESP32-001 ou MAC address"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Scanner-001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="macAddress">Adresse MAC</Label>
                    <Input
                      id="macAddress"
                      value={formData.macAddress}
                      onChange={(e) =>
                        setFormData({ ...formData, macAddress: e.target.value })
                      }
                      placeholder="AA:BB:CC:DD:EE:FF"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firmwareVersion">Version firmware</Label>
                    <Input
                      id="firmwareVersion"
                      value={formData.firmwareVersion}
                      onChange={(e) =>
                        setFormData({ ...formData, firmwareVersion: e.target.value })
                      }
                      placeholder="v1.0.0"
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
                <Button type="submit">Créer le scanner</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : scanners.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucun scanner enregistré. Ajoutez-en un pour commencer.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hardware ID</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>MAC / Firmware</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Batterie</TableHead>
                <TableHead>Hits stockés</TableHead>
                <TableHead>Dernière sync</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scanners.map((scanner) => (
                <TableRow key={scanner.id}>
                  <TableCell className="font-mono text-xs">
                    {scanner.hardwareId}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ScanLine className="h-4 w-4 text-purple-500" />
                      {scanner.name || (
                        <span className="text-muted-foreground">Sans nom</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="space-y-0.5">
                      <div className="text-muted-foreground">
                        {scanner.macAddress || "N/A"}
                      </div>
                      <div className="flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        {scanner.firmwareVersion || "N/A"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(scanner.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getBatteryIcon(scanner.batteryLevel)}
                      {scanner.batteryLevel ? `${scanner.batteryLevel}%` : "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {scanner.hitCount || 0} hit{(scanner.hitCount || 0) > 1 ? "s" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {scanner.lastSyncAt
                      ? formatDistanceToNow(new Date(scanner.lastSyncAt), {
                          addSuffix: true,
                          locale: fr,
                        })
                      : "Jamais"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog
                        open={editingScanner?.id === scanner.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setEditingScanner(null);
                            resetForm();
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(scanner)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <form onSubmit={handleSubmit}>
                            <DialogHeader>
                              <DialogTitle>Modifier le scanner</DialogTitle>
                              <DialogDescription>
                                Mettre à jour les informations du scanner ESP32
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

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-macAddress">Adresse MAC</Label>
                                  <Input
                                    id="edit-macAddress"
                                    value={formData.macAddress}
                                    onChange={(e) =>
                                      setFormData({ ...formData, macAddress: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-firmwareVersion">
                                    Version firmware
                                  </Label>
                                  <Input
                                    id="edit-firmwareVersion"
                                    value={formData.firmwareVersion}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        firmwareVersion: e.target.value,
                                      })
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
                                      setFormData({
                                        ...formData,
                                        batteryLevel: e.target.value,
                                      })
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
                          if (
                            confirm("Êtes-vous sûr de vouloir supprimer ce scanner ?")
                          ) {
                            deleteMutation.mutate(scanner.id);
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
