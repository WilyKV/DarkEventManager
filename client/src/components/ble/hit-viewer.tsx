import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CheckCircle2, XCircle, AlertTriangle, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function HitViewer() {
  const [filterValidated, setFilterValidated] = useState<string>("all");
  const [searchBeacon, setSearchBeacon] = useState("");

  const { data: hits = [], isLoading } = useQuery({
    queryKey: ["/api/ble/hits"],
    queryFn: async () => {
      const res = await fetch("/api/ble/hits");
      if (!res.ok) throw new Error("Failed to fetch hits");
      return res.json();
    },
  });

  const filteredHits = hits.filter((hit: any) => {
    const matchValidation =
      filterValidated === "all" ||
      (filterValidated === "validated" && hit.validated) ||
      (filterValidated === "rejected" && !hit.validated);

    const matchBeacon =
      !searchBeacon ||
      hit.beaconId?.toString().includes(searchBeacon) ||
      hit.scannerId?.toString().includes(searchBeacon);

    return matchValidation && matchBeacon;
  });

  const getValidationBadge = (hit: any) => {
    if (hit.validated) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Validé
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Rejeté
        </Badge>
      );
    }
  };

  const getScoreBadge = (score: number | null) => {
    if (!score) return null;
    const variant =
      score >= 80 ? "default" : score >= 50 ? "secondary" : "destructive";
    return <Badge variant={variant}>{score}/100</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Filtrer par validation</Label>
          <Select value={filterValidated} onValueChange={setFilterValidated}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les hits</SelectItem>
              <SelectItem value="validated">Validés seulement</SelectItem>
              <SelectItem value="rejected">Rejetés seulement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Rechercher Beacon/Scanner ID</Label>
          <Input
            value={searchBeacon}
            onChange={(e) => setSearchBeacon(e.target.value)}
            placeholder="Ex: 5"
          />
        </div>

        <div className="space-y-2">
          <Label>Total</Label>
          <div className="flex items-center h-10 px-3 border rounded-md bg-muted">
            <Zap className="mr-2 h-4 w-4 text-yellow-500" />
            <span className="font-semibold">{filteredHits.length} hit(s)</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : filteredHits.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Aucun hit trouvé avec ces filtres
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Beacon</TableHead>
                <TableHead>Scanner</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>RSSI</TableHead>
                <TableHead>Durée prox.</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHits.map((hit: any) => (
                <TableRow key={hit.id}>
                  <TableCell className="font-mono text-xs">#{hit.id}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Beacon #{hit.beaconId}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Scanner #{hit.scannerId}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(hit.hitTimestamp), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {hit.rssi} dBm
                  </TableCell>
                  <TableCell className="text-sm">
                    {hit.proximityDuration
                      ? `${(hit.proximityDuration / 1000).toFixed(1)}s`
                      : "N/A"}
                  </TableCell>
                  <TableCell>{getValidationBadge(hit)}</TableCell>
                  <TableCell>{getScoreBadge(hit.validationScore)}</TableCell>
                  <TableCell>
                    {hit.validationFlags && Array.isArray(hit.validationFlags) && hit.validationFlags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {hit.validationFlags.map((flag: any, idx: number) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs"
                            title={flag.message}
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {flag.type}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
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
