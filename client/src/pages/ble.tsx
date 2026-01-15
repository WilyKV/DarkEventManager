import { useState } from "react";
import { ManagementLayout } from "@/components/management-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bluetooth,
  Radio,
  ScanLine,
  Users,
  Zap,
  GamepadIcon,
  Plus,
  RefreshCw,
  Upload,
  BarChart3
} from "lucide-react";
import { BeaconList } from "@/components/ble/beacon-list";
import { ScannerList } from "@/components/ble/scanner-list";
import { AssignmentManager } from "@/components/ble/assignment-manager";
import { GameSessionManager } from "@/components/ble/game-session-manager";
import { HitViewer } from "@/components/ble/hit-viewer";
import { HitSyncUpload } from "@/components/ble/hit-sync-upload";
import { useQuery } from "@tanstack/react-query";

export default function BlePage() {
  const [activeTab, setActiveTab] = useState("beacons");

  // Fetch counts for dashboard cards
  const { data: beacons = [] } = useQuery({
    queryKey: ["/api/ble/beacons"],
    queryFn: async () => {
      const res = await fetch("/api/ble/beacons");
      if (!res.ok) throw new Error("Failed to fetch beacons");
      return res.json();
    },
  });

  const { data: scanners = [] } = useQuery({
    queryKey: ["/api/ble/scanners"],
    queryFn: async () => {
      const res = await fetch("/api/ble/scanners");
      if (!res.ok) throw new Error("Failed to fetch scanners");
      return res.json();
    },
  });

  const { data: hits = [] } = useQuery({
    queryKey: ["/api/ble/hits"],
    queryFn: async () => {
      const res = await fetch("/api/ble/hits");
      if (!res.ok) throw new Error("Failed to fetch hits");
      return res.json();
    },
  });

  const { data: gameSessions = [] } = useQuery({
    queryKey: ["/api/ble/game-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/ble/game-sessions");
      if (!res.ok) throw new Error("Failed to fetch game sessions");
      return res.json();
    },
  });

  const availableBeacons = beacons.filter((b: any) => b.status === 'available').length;
  const assignedBeacons = beacons.filter((b: any) => b.status === 'assigned').length;
  const availableScanners = scanners.filter((s: any) => s.status === 'available').length;
  const assignedScanners = scanners.filter((s: any) => s.status === 'assigned').length;
  const validatedHits = hits.filter((h: any) => h.validated).length;
  const activeSessions = gameSessions.filter((s: any) => s.status === 'in_progress').length;

  return (
    <ManagementLayout title="Gestion BLE (Bluetooth Low Energy)" icon={Bluetooth}>
      <div className="space-y-6">
        {/* Dashboard Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Beacons</CardTitle>
              <Radio className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{beacons.length}</div>
              <p className="text-xs text-muted-foreground">
                {availableBeacons} disponibles, {assignedBeacons} assignés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scanners ESP32</CardTitle>
              <ScanLine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{scanners.length}</div>
              <p className="text-xs text-muted-foreground">
                {availableScanners} disponibles, {assignedScanners} assignés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hits validés</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{validatedHits}</div>
              <p className="text-xs text-muted-foreground">
                {hits.length} total enregistrés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions actives</CardTitle>
              <GamepadIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSessions}</div>
              <p className="text-xs text-muted-foreground">
                {gameSessions.length} sessions au total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="beacons">
              <Radio className="mr-2 h-4 w-4" />
              Beacons
            </TabsTrigger>
            <TabsTrigger value="scanners">
              <ScanLine className="mr-2 h-4 w-4" />
              Scanners
            </TabsTrigger>
            <TabsTrigger value="assignments">
              <Users className="mr-2 h-4 w-4" />
              Affectations
            </TabsTrigger>
            <TabsTrigger value="sessions">
              <GamepadIcon className="mr-2 h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="hits">
              <Zap className="mr-2 h-4 w-4" />
              Hits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="beacons" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des Beacons BLE</CardTitle>
                <CardDescription>
                  Bracelets BLE portés par les survivants. Chaque beacon émet un signal UUID/Major/Minor unique.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BeaconList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scanners" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des Scanners ESP32</CardTitle>
                <CardDescription>
                  Bracelets ESP32 avec vibration portés par les zombies. Scannent les beacons à proximité.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScannerList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Affectation du Matériel</CardTitle>
                <CardDescription>
                  Assigner les beacons aux survivants et les scanners aux zombies avant le début du jeu.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AssignmentManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sessions de Jeu</CardTitle>
                <CardDescription>
                  Créer et gérer les sessions de jeu avec statistiques en temps réel.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GameSessionManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hits" className="space-y-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Synchronisation des Hits</CardTitle>
                  <CardDescription>
                    Uploader les données des ESP32 après le jeu (fichier JSON ou connexion Bluetooth).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <HitSyncUpload />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Historique des Hits</CardTitle>
                  <CardDescription>
                    Visualiser tous les événements de touche enregistrés avec validation et métadonnées.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <HitViewer />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ManagementLayout>
  );
}
