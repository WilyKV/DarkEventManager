import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, Loader2, CheckCircle2, XCircle, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

export function SyncPushPullButtons() {
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [lastPushStatus, setLastPushStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastPullStatus, setLastPullStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();
  const { user } = useAuth();

  const handlePush = async () => {
    setIsPushing(true);
    setLastPushStatus('idle');

    try {
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Échec de l\'envoi');
      }

      const result = await response.json();
      
      setLastPushStatus('success');
      toast({
        title: "Envoi réussi",
        description: `${result.count || 0} élément(s) envoyé(s) vers le serveur maître.`,
      });
    } catch (error) {
      setLastPushStatus('error');
      toast({
        title: "Erreur d'envoi",
        description: error instanceof Error ? error.message : "Impossible d'envoyer les données",
        variant: "destructive",
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    setLastPullStatus('idle');

    try {
      const response = await fetch('/api/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Échec de la récupération');
      }

      const result = await response.json();
      
      setLastPullStatus('success');
      toast({
        title: "Récupération réussie",
        description: `${result.count || 0} élément(s) récupéré(s) depuis le serveur maître.`,
      });

      // Recharger la page pour afficher les nouvelles données
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setLastPullStatus('error');
      toast({
        title: "Erreur de récupération",
        description: error instanceof Error ? error.message : "Impossible de récupérer les données",
        variant: "destructive",
      });
    } finally {
      setIsPulling(false);
    }
  };

  const getRoleDescription = () => {
    switch (user?.role) {
      case 'zombie':
      case 'survivant':
        return 'Synchronise vos achats personnels uniquement';
      case 'staff':
        return 'Synchronise les check-in/check-out des participants';
      case 'boutique':
        return 'Synchronise les produits et stocks de la boutique';
      case 'repas':
        return 'Synchronise les produits et stocks des repas';
      case 'admin':
        return 'Synchronise toutes les données de l\'événement';
      default:
        return 'Synchronise vos données avec le serveur maître';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUp className="w-5 h-5 text-blue-500" />
          <ArrowDown className="w-5 h-5 text-green-500" />
          Synchronisation WiFi
        </CardTitle>
        <CardDescription>
          {getRoleDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Push Button */}
          <div className="flex-1">
            <Button
              onClick={handlePush}
              disabled={isPushing || isPulling}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              {isPushing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Envoyer vers maître
                </>
              )}
            </Button>
            {lastPushStatus === 'success' && (
              <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Envoi réussi
              </div>
            )}
            {lastPushStatus === 'error' && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                <XCircle className="w-4 h-4" />
                Échec de l'envoi
              </div>
            )}
          </div>

          {/* Pull Button */}
          <div className="flex-1">
            <Button
              onClick={handlePull}
              disabled={isPushing || isPulling}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {isPulling ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Récupération...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Récupérer du maître
                </>
              )}
            </Button>
            {lastPullStatus === 'success' && (
              <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Récupération réussie
              </div>
            )}
            {lastPullStatus === 'error' && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                <XCircle className="w-4 h-4" />
                Échec de la récupération
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
          <p className="font-semibold mb-1">Mode de synchronisation :</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Push (Envoyer)</strong> : Envoie vos modifications locales vers le serveur maître</li>
            <li><strong>Pull (Récupérer)</strong> : Récupère les dernières données depuis le serveur maître</li>
          </ul>
          <p className="mt-2 text-xs">
            ⚠️ Effectuez un Pull avant de travailler et un Push après vos modifications
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
