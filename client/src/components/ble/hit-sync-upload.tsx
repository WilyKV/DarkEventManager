import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Upload, FileJson, CheckCircle2, XCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

export function HitSyncUpload() {
  const { toast } = useToast();
  const [selectedScanner, setSelectedScanner] = useState("");
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const { data: scanners = [] } = useQuery({
    queryKey: ["/api/ble/scanners"],
    queryFn: async () => {
      const res = await fetch("/api/ble/scanners");
      if (!res.ok) throw new Error("Failed to fetch scanners");
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ scannerId, hits }: { scannerId: number; hits: any[] }) => {
      const res = await fetch("/api/ble/hits/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scannerId, hits }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to sync hits");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ble/hits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ble/scanners"] });
      setUploadResult(data);
      toast({
        title: "Synchronisation réussie",
        description: `${data.synced} hits validés, ${data.rejected} rejetés`,
      });
      setJsonFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de synchronisation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        setJsonFile(file);
        setUploadResult(null);
      } else {
        toast({
          title: "Format invalide",
          description: "Veuillez sélectionner un fichier JSON",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!jsonFile || !selectedScanner) return;

    try {
      const text = await jsonFile.text();
      const data = JSON.parse(text);

      // Validate JSON structure
      if (!Array.isArray(data.hits)) {
        throw new Error("Le fichier JSON doit contenir un tableau 'hits'");
      }

      syncMutation.mutate({
        scannerId: parseInt(selectedScanner),
        hits: data.hits,
      });
    } catch (error: any) {
      toast({
        title: "Erreur de parsing JSON",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p className="font-medium">Format JSON attendu :</p>
            <pre className="bg-white dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">
{`{
  "scannerId": 1,
  "hits": [
    {
      "beaconId": 5,
      "scannerId": 1,
      "hitTimestamp": "2024-01-15T18:30:00Z",
      "rssi": -55,
      "proximityDuration": 3500
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Scanner ESP32</Label>
          <Select value={selectedScanner} onValueChange={setSelectedScanner}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un scanner" />
            </SelectTrigger>
            <SelectContent>
              {scanners.map((scanner: any) => (
                <SelectItem key={scanner.id} value={scanner.id.toString()}>
                  {scanner.name || scanner.hardwareId} ({scanner.hitCount || 0} hits stockés)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Fichier JSON</Label>
          <div className="flex gap-2">
            <Input
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {jsonFile && (
              <Badge variant="outline" className="shrink-0">
                <FileJson className="mr-1 h-3 w-3" />
                {jsonFile.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Button
        onClick={handleUpload}
        disabled={!jsonFile || !selectedScanner || syncMutation.isPending}
        className="w-full"
      >
        <Upload className="mr-2 h-4 w-4" />
        {syncMutation.isPending ? "Synchronisation..." : "Synchroniser les hits"}
      </Button>

      {uploadResult && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="font-semibold">Résultat de la synchronisation</div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Reçus</div>
                <div className="text-2xl font-bold">{uploadResult.synced + uploadResult.rejected}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Validés
                </div>
                <div className="text-2xl font-bold text-green-600">{uploadResult.synced}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Rejetés
                </div>
                <div className="text-2xl font-bold text-red-600">{uploadResult.rejected}</div>
              </div>
            </div>
            <Badge>Session #{uploadResult.syncSessionId}</Badge>
          </div>
        </Card>
      )}
    </div>
  );
}
