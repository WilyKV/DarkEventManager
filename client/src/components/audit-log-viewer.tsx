import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface AuditLog {
  id: number;
  userId: number | null;
  username: string;
  action: string;
  tableName: string;
  recordId: number | null;
  recordData: string | null;
  changes: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
  user?: {
    id: number;
    username: string;
    role: string;
  } | null;
}

export function AuditLogViewer() {
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", { 
      tableName: tableFilter !== "all" ? tableFilter : undefined,
      action: actionFilter !== "all" ? actionFilter : undefined,
      limit: 100 
    }],
  });

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      CREATE: "default",
      UPDATE: "secondary",
      DELETE: "destructive",
    };
    return <Badge variant={variants[action] || "default"}>{action}</Badge>;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'medium'
    });
  };

  const formatTableName = (tableName: string) => {
    const names: Record<string, string> = {
      participants: "Participants",
      time_slots: "Créneaux",
      squads: "Squads",
      shop_items: "Articles Boutique",
      meal_items: "Articles Repas",
      purchases: "Achats Boutique",
      meal_purchases: "Achats Repas",
    };
    return names[tableName] || tableName;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des Actions</CardTitle>
        <CardDescription>
          Suivi de toutes les opérations effectuées dans l'administration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrer par table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les tables</SelectItem>
              <SelectItem value="participants">Participants</SelectItem>
              <SelectItem value="time_slots">Créneaux</SelectItem>
              <SelectItem value="squads">Squads</SelectItem>
              <SelectItem value="shop_items">Articles Boutique</SelectItem>
              <SelectItem value="meal_items">Articles Repas</SelectItem>
              <SelectItem value="purchases">Achats Boutique</SelectItem>
              <SelectItem value="meal_purchases">Achats Repas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filtrer par action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              <SelectItem value="CREATE">CREATE</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Heure</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>ID Enregistrement</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.username}</span>
                          {log.user && (
                            <span className="text-xs text-muted-foreground">
                              {log.user.role}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>{formatTableName(log.tableName)}</TableCell>
                      <TableCell className="font-mono">
                        {log.recordId || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.ipAddress || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Aucun log d'audit trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
