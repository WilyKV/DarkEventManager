import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wifi, WifiOff, Crown, AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { WebSocketSyncClient } from "@/components/websocket-sync-client";

interface SyncConfig {
  id: number;
  isOnlineMode: boolean;
  masterDeviceId: string | null;
  masterDeviceName: string | null;
  lastSyncAt: string | null;
  updatedAt: string;
}

// Get or create device ID from localStorage
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

function getDeviceName(): string {
  return localStorage.getItem('deviceName') || 'Mon appareil';
}

function setDeviceName(name: string) {
  localStorage.setItem('deviceName', name);
}

export function SyncModeManager() {
  const { toast } = useToast();
  const deviceId = getDeviceId();
  const [localDeviceName, setLocalDeviceName] = useState(getDeviceName());

  // Fetch sync config
  const { data: config, isLoading } = useQuery<SyncConfig>({
    queryKey: ['/api/sync/config'],
    queryFn: async () => {
      const res = await fetch('/api/sync/config');
      if (!res.ok) throw new Error('Failed to fetch sync config');
      return res.json();
    },
  });

  // Update sync config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (update: Partial<SyncConfig>) => {
      const res = await fetch('/api/sync/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error('Failed to update sync config');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sync/config'] });
      toast({
        title: "Configuration mise à jour",
        description: "Le mode de synchronisation a été modifié avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour la configuration",
        variant: "destructive",
      });
    },
  });

  const isMasterDevice = config?.masterDeviceId === deviceId;
  const isOnlineMode = config?.isOnlineMode ?? true;

  const handleToggleMode = async () => {
    if (!isOnlineMode && isMasterDevice) {
      // Switching from offline to online - remove master device
      await updateConfigMutation.mutateAsync({
        isOnlineMode: true,
        masterDeviceId: null,
        masterDeviceName: null,
      });
    } else if (isOnlineMode) {
      // Switching from online to offline - set this device as master
      await updateConfigMutation.mutateAsync({
        isOnlineMode: false,
        masterDeviceId: deviceId,
        masterDeviceName: localDeviceName,
      });
    } else {
      toast({
        title: "Action non autorisée",
        description: "Seul l'appareil maître peut changer le mode de synchronisation",
        variant: "destructive",
      });
    }
  };

  const handleBecomeMaster = async () => {
    if (!isOnlineMode) {
      await updateConfigMutation.mutateAsync({
        masterDeviceId: deviceId,
        masterDeviceName: localDeviceName,
      });
    }
  };

  const handleSaveDeviceName = () => {
    setDeviceName(localDeviceName);
    if (isMasterDevice && !isOnlineMode) {
      updateConfigMutation.mutate({
        masterDeviceName: localDeviceName,
      });
    }
    toast({
      title: "Nom de l'appareil enregistré",
      description: `Votre appareil s'appelle maintenant "${localDeviceName}"`,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Device Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Informations de cet appareil
          </CardTitle>
          <CardDescription>Identifiant unique et nom de cet appareil</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">ID de l'appareil</Label>
            <p className="text-sm font-mono bg-muted p-2 rounded mt-1">{deviceId}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deviceName">Nom de l'appareil</Label>
            <div className="flex gap-2">
              <Input
                id="deviceName"
                value={localDeviceName}
                onChange={(e) => setLocalDeviceName(e.target.value)}
                placeholder="Ex: Tablette Admin, PC Principal..."
              />
              <Button onClick={handleSaveDeviceName} variant="outline">
                Enregistrer
              </Button>
            </div>
          </div>

          {isMasterDevice && (
            <Alert>
              <Crown className="h-4 w-4" />
              <AlertDescription>
                <strong>Cet appareil est l'appareil maître</strong> - Il peut synchroniser les données avec la base de données.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sync Mode Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnlineMode ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            Mode de synchronisation
          </CardTitle>
          <CardDescription>
            Gérez le mode de fonctionnement : en ligne (tous peuvent synchroniser) ou hors ligne (seul le maître synchronise)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              {isOnlineMode ? (
                <Wifi className="w-8 h-8 text-green-500" />
              ) : (
                <WifiOff className="w-8 h-8 text-orange-500" />
              )}
              <div>
                <p className="font-semibold">
                  {isOnlineMode ? 'Mode En ligne' : 'Mode Hors ligne'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isOnlineMode
                    ? 'Tous les appareils peuvent synchroniser avec la base de données'
                    : 'Seul l\'appareil maître peut synchroniser avec la base de données'}
                </p>
              </div>
            </div>
            <Switch
              checked={!isOnlineMode}
              onCheckedChange={handleToggleMode}
              disabled={!isOnlineMode && !isMasterDevice}
            />
          </div>

          {/* Offline Mode Info */}
          {!isOnlineMode && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Mode hors ligne activé</strong></p>
                  <p className="text-sm">
                    Appareil maître actuel : <strong>{config?.masterDeviceName || 'Non défini'}</strong>
                  </p>
                  {!isMasterDevice && (
                    <>
                      <p className="text-sm">
                        Vous ne pouvez pas synchroniser directement avec la base de données.
                        Utilisez les QR Codes ou la connexion WebSocket pour partager vos données avec l'appareil maître.
                      </p>
                      <Button
                        onClick={handleBecomeMaster}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                      >
                        Devenir l'appareil maître
                      </Button>
                    </>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Last Sync Info */}
          {config?.lastSyncAt && (
            <div className="text-sm text-muted-foreground">
              Dernière synchronisation : {new Date(config.lastSyncAt).toLocaleString('fr-FR')}
            </div>
          )}

          {/* Feature Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Check className="w-3 h-3" />
              QR Codes (toujours actif)
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Check className="w-3 h-3" />
              Export/Import Excel
            </Badge>
            {!isOnlineMode && (
              <Badge variant="default" className="gap-1">
                <Wifi className="w-3 h-3" />
                WebSocket actif
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* WebSocket Sync Client - Only show in offline mode */}
      {!isOnlineMode && (
        <WebSocketSyncClient
          isMaster={isMasterDevice}
          deviceId={deviceId}
          deviceName={localDeviceName}
        />
      )}
    </div>
  );
}
