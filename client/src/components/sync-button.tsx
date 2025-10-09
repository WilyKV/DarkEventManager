import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SyncButtonProps {
  title?: string;
  description?: string;
}

export function SyncButton({ 
  title = "Synchronisation des données", 
  description = "Synchroniser les données avec l'appareil maître" 
}: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    setLastSyncStatus('idle');

    try {
      // Appel API de synchronisation
      const response = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          timestamp: new Date().toISOString(),
          source: 'manual'
        })
      });

      if (!response.ok) {
        throw new Error('Échec de la synchronisation');
      }

      const result = await response.json();
      
      setLastSyncStatus('success');
      toast({
        title: "Synchronisation réussie",
        description: `Les données ont été synchronisées avec succès. ${result.syncedItems || 0} éléments mis à jour.`,
      });
    } catch (error) {
      setLastSyncStatus('error');
      toast({
        title: "Erreur de synchronisation",
        description: error instanceof Error ? error.message : "Une erreur s'est produite lors de la synchronisation",
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
          <RefreshCw className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Button 
            onClick={handleSync} 
            disabled={isSyncing}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Synchronisation en cours...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Lancer la synchronisation
              </>
            )}
          </Button>
        </div>

        {lastSyncStatus === 'success' && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Dernière synchronisation réussie</span>
          </div>
        )}

        {lastSyncStatus === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            <span>Échec de la dernière synchronisation</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-4">
          <p>
            Ce bouton déclenche une synchronisation manuelle des données avec l'appareil maître.
            Toutes les données locales seront envoyées et les données distantes seront récupérées.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
