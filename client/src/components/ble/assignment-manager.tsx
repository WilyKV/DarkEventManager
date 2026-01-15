import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Radio, ScanLine, UserPlus, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function AssignmentManager() {
  const { toast } = useToast();
  const [selectedBeacon, setSelectedBeacon] = useState("");
  const [selectedSurvivor, setSelectedSurvivor] = useState("");
  const [selectedScanner, setSelectedScanner] = useState("");
  const [selectedZombie, setSelectedZombie] = useState("");

  // Fetch available beacons/scanners
  const { data: availableBeacons = [] } = useQuery({
    queryKey: ["/api/ble/beacons", { status: "available" }],
    queryFn: async () => {
      const res = await fetch("/api/ble/beacons?status=available");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: availableScanners = [] } = useQuery({
    queryKey: ["/api/ble/scanners", { status: "available" }],
    queryFn: async () => {
      const res = await fetch("/api/ble/scanners?status=available");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Fetch participants
  const { data: survivors = [] } = useQuery({
    queryKey: ["/api/participants", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: zombies = [] } = useQuery({
    queryKey: ["/api/participants", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Fetch active assignments
  const { data: beaconAssignments = [] } = useQuery({
    queryKey: ["/api/ble/beacon-assignments", { status: "active" }],
    queryFn: async () => {
      const res = await fetch("/api/ble/beacon-assignments?status=active");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: scannerAssignments = [] } = useQuery({
    queryKey: ["/api/ble/scanner-assignments", { status: "active" }],
    queryFn: async () => {
      const res = await fetch("/api/ble/scanner-assignments?status=active");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Mutations
  const assignBeaconMutation = useMutation({
    mutationFn: async (data: { participantId: number; beaconId: number }) => {
      const res = await fetch("/api/ble/beacon-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to assign beacon");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/beacons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ble/beacon-assignments"] });
      toast({ title: "Beacon assigné avec succès" });
      setSelectedBeacon("");
      setSelectedSurvivor("");
    },
    onError: () => {
      toast({ title: "Erreur lors de l'assignation", variant: "destructive" });
    },
  });

  const assignScannerMutation = useMutation({
    mutationFn: async (data: { participantId: number; scannerId: number }) => {
      const res = await fetch("/api/ble/scanner-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to assign scanner");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/scanners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ble/scanner-assignments"] });
      toast({ title: "Scanner assigné avec succès" });
      setSelectedScanner("");
      setSelectedZombie("");
    },
    onError: () => {
      toast({ title: "Erreur lors de l'assignation", variant: "destructive" });
    },
  });

  const returnBeaconMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await fetch(`/api/ble/beacon-assignments/${assignmentId}/return`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to return beacon");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/beacons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ble/beacon-assignments"] });
      toast({ title: "Beacon retourné avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors du retour", variant: "destructive" });
    },
  });

  const returnScannerMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await fetch(`/api/ble/scanner-assignments/${assignmentId}/return`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to return scanner");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/scanners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ble/scanner-assignments"] });
      toast({ title: "Scanner retourné avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors du retour", variant: "destructive" });
    },
  });

  return (
    <Tabs defaultValue="beacons">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="beacons">
          <Radio className="mr-2 h-4 w-4" />
          Beacons → Survivants
        </TabsTrigger>
        <TabsTrigger value="scanners">
          <ScanLine className="mr-2 h-4 w-4" />
          Scanners → Zombies
        </TabsTrigger>
      </TabsList>

      <TabsContent value="beacons" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Assigner un beacon à un survivant</CardTitle>
            <CardDescription>
              {availableBeacons.length} beacon(s) disponible(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Beacon disponible</Label>
                <Select value={selectedBeacon} onValueChange={setSelectedBeacon}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un beacon" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBeacons.map((beacon: any) => (
                      <SelectItem key={beacon.id} value={beacon.id.toString()}>
                        {beacon.name || beacon.hardwareId} - Batterie: {beacon.batteryLevel}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Survivant</Label>
                <Select value={selectedSurvivor} onValueChange={setSelectedSurvivor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un survivant" />
                  </SelectTrigger>
                  <SelectContent>
                    {survivors.map((survivor: any) => (
                      <SelectItem key={survivor.id} value={survivor.id.toString()}>
                        {survivor.firstName} {survivor.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={() => {
                if (selectedBeacon && selectedSurvivor) {
                  assignBeaconMutation.mutate({
                    beaconId: parseInt(selectedBeacon),
                    participantId: parseInt(selectedSurvivor),
                  });
                }
              }}
              disabled={!selectedBeacon || !selectedSurvivor}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Assigner
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Affectations actives</CardTitle>
            <CardDescription>
              {beaconAssignments.length} beacon(s) actuellement assigné(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {beaconAssignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune affectation active
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beacon</TableHead>
                    <TableHead>Survivant</TableHead>
                    <TableHead>Assigné depuis</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {beaconAssignments.map((assignment: any) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <Badge variant="outline">Beacon #{assignment.beaconId}</Badge>
                      </TableCell>
                      <TableCell>Participant #{assignment.participantId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(assignment.assignedAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => returnBeaconMutation.mutate(assignment.id)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Retourner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="scanners" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Assigner un scanner à un zombie</CardTitle>
            <CardDescription>
              {availableScanners.length} scanner(s) disponible(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scanner disponible</Label>
                <Select value={selectedScanner} onValueChange={setSelectedScanner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un scanner" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableScanners.map((scanner: any) => (
                      <SelectItem key={scanner.id} value={scanner.id.toString()}>
                        {scanner.name || scanner.hardwareId} - Batterie:{" "}
                        {scanner.batteryLevel}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Zombie</Label>
                <Select value={selectedZombie} onValueChange={setSelectedZombie}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un zombie" />
                  </SelectTrigger>
                  <SelectContent>
                    {zombies.map((zombie: any) => (
                      <SelectItem key={zombie.id} value={zombie.id.toString()}>
                        {zombie.firstName} {zombie.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={() => {
                if (selectedScanner && selectedZombie) {
                  assignScannerMutation.mutate({
                    scannerId: parseInt(selectedScanner),
                    participantId: parseInt(selectedZombie),
                  });
                }
              }}
              disabled={!selectedScanner || !selectedZombie}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Assigner
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Affectations actives</CardTitle>
            <CardDescription>
              {scannerAssignments.length} scanner(s) actuellement assigné(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scannerAssignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune affectation active
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scanner</TableHead>
                    <TableHead>Zombie</TableHead>
                    <TableHead>Assigné depuis</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scannerAssignments.map((assignment: any) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <Badge variant="outline">Scanner #{assignment.scannerId}</Badge>
                      </TableCell>
                      <TableCell>Participant #{assignment.participantId}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(assignment.assignedAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => returnScannerMutation.mutate(assignment.id)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Retourner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
