import { offlineCheckInPage } from "@shared/zombie-offline";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Radio, Shield, WifiOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConnectionIndicator } from "@/components/connection-indicator";
import { apiRequest } from "@/lib/queryClient";

interface SyncConfig {
  isOnlineMode: boolean;
  masterDeviceId?: string | null;
  masterDeviceName?: string | null;
}

export function SyncModeManager() {
  const queryClient = useQueryClient();
  const { data: config, isError, refetch } = useQuery<SyncConfig>({ queryKey: ["/api/sync/config"] });
  const [deviceName, setDeviceName] = useState(() => localStorage.getItem("deviceName") || "Mon appareil");
  const update = useMutation({
    mutationFn: async (isOnlineMode: boolean) => {
      if (isOnlineMode) {
        await apiRequest("POST", "/api/sync/config", { isOnlineMode, masterDeviceId: null, masterDeviceName: null });
        return;
      }

      const id = localStorage.getItem("deviceId") || crypto.randomUUID?.();
      if (!id) throw new Error("Ouvrez l’application en HTTPS pour désigner cet appareil.");
      localStorage.setItem("deviceId", id);
      localStorage.setItem("deviceName", deviceName.trim());
      await apiRequest("POST", "/api/sync/config", { isOnlineMode, masterDeviceId: id, masterDeviceName: deviceName.trim() });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sync/config"] }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Radio className="size-5 shrink-0" /> Mises à jour en direct</CardTitle>
            <CardDescription>Le WebSocket signale les modifications enregistrées au serveur aux écrans ouverts.</CardDescription>
          </CardHeader>
          <CardContent><ConnectionIndicator /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><WifiOff className="size-5 shrink-0" /> Accueil hors ligne</CardTitle>
            <CardDescription>Préparez une copie chiffrée de la liste pour travailler sur cet appareil en mode avion.</CardDescription>
          </CardHeader>
          <CardContent><Link href={offlineCheckInPage} className={buttonVariants({ variant: "outline" })}>Ouvrir l’accueil hors ligne</Link></CardContent>
        </Card>
      </div>
      <details className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <summary className="cursor-pointer font-medium"><Shield className="mr-2 inline size-4" aria-hidden /> Restriction d’écriture sur le serveur</summary>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          Ce réglage réserve les modifications sur le serveur à un seul navigateur désigné. Pour la saisie sans réseau, utilisez l’accueil hors ligne.
        </p>
        {isError ? (
          <Button variant="outline" onClick={() => void refetch()}>Recharger le réglage</Button>
        ) : config ? (
          <div className="space-y-3">
            <p className="text-sm">{config.isOnlineMode ? "Écriture autorisée aux appareils habilités." : `Appareil désigné · ${config.masterDeviceName || "Sans nom"}`}</p>
            <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
              event.preventDefault();
              if (window.confirm("Réserver l’écriture sur le serveur à cet appareil ?")) update.mutate(false);
            }}>
              <label className="flex flex-col gap-1 text-sm">
                Nom de cet appareil
                <Input required maxLength={80} value={deviceName} onChange={event => setDeviceName(event.target.value)} />
              </label>
              <Button type="submit" variant="outline" disabled={update.isPending || !deviceName.trim()}>
                {config.isOnlineMode ? "Restreindre à cet appareil" : "Désigner cet appareil"}
              </Button>
              {!config.isOnlineMode && (
                <Button type="button" variant="outline" disabled={update.isPending} onClick={() => update.mutate(true)}>Lever la restriction</Button>
              )}
            </form>
            {update.isError && <p role="alert" className="text-sm text-destructive">Impossible d’enregistrer le réglage. Vérifiez votre accès au serveur et réessayez.</p>}
          </div>
        ) : <p role="status" className="text-sm text-muted-foreground">Chargement du réglage…</p>}
      </details>
    </div>
  );
}
