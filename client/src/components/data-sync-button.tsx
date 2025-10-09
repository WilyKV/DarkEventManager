import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Upload, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataSyncButtonProps {
  module: "participants" | "timeslots" | "squads" | "shop" | "meals" | "all";
  type?: "zombie" | "survivant" | "staff";
  title: string;
  description: string;
}

export function DataSyncButton({ module, type, title, description }: DataSyncButtonProps) {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      // In a real implementation, this would send data via WebSocket
      // For now, we'll simulate the sync process

      // Get device ID from localStorage
      const deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        throw new Error("Device ID not found. Please configure sync mode first.");
      }

      // Check if we're in offline mode
      const syncConfigRes = await fetch('/api/sync/config');
      if (!syncConfigRes.ok) {
        throw new Error("Failed to fetch sync configuration");
      }
      const syncConfig = await syncConfigRes.json();

      if (syncConfig.isOnlineMode) {
        throw new Error("Offline mode is not enabled. Please enable it in Configuration first.");
      }

      if (syncConfig.masterDeviceId === deviceId) {
        throw new Error("This device is the master. No need to sync to itself.");
      }

      // Fetch data to sync
      let endpoint = "";
      if (module === "all") {
        endpoint = type ? `/api/participants?type=${type}` : "/api/participants";
      } else if (module === "participants") {
        endpoint = type ? `/api/participants?type=${type}` : "/api/participants";
      } else if (module === "timeslots") {
        endpoint = type ? `/api/time-slots?type=${type}` : "/api/time-slots";
      } else if (module === "squads") {
        endpoint = type ? `/api/squads?type=${type}` : "/api/squads";
      } else if (module === "shop") {
        endpoint = "/api/shop-items";
      } else if (module === "meals") {
        endpoint = "/api/meal-items";
      }

      const dataRes = await fetch(endpoint);
      if (!dataRes.ok) {
        throw new Error("Failed to fetch data to sync");
      }
      const data = await dataRes.json();

      // In a real WebSocket implementation, we would send this data
      // via the WebSocket connection to the master device
      // For now, we'll show a success message

      setSyncResult({
        success: true,
        message: `${data.length} éléments prêts à être synchronisés. La fonctionnalité WebSocket complète sera implémentée prochainement.`
      });

      toast({
        title: "Synchronisation en cours",
        description: `Préparation de ${data.length} éléments pour la synchronisation...`,
      });

    } catch (error) {
      console.error("Sync error:", error);
      setSyncResult({
        success: false,
        message: error instanceof Error ? error.message : "Une erreur est survenue"
      });

      toast({
        title: "Erreur de synchronisation",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncResult && (
          <Alert variant={syncResult.success ? "default" : "destructive"}>
            {syncResult.success ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{syncResult.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            size="lg"
            className="w-full gap-2"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Synchronisation en cours...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Synchroniser vers l'appareil maître
              </>
            )}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            Assurez-vous d'être connecté à l'appareil maître via la section Configuration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
