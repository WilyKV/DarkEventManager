import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExcelExportProps {
  type: "zombie" | "survivant" | "staff" | "boutique" | "repas" | "badge";
  module?: "participants" | "time-slots" | "squads" | "items" | "all";
}

export function ExcelExport({ type, module = "participants" }: ExcelExportProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let endpoint = '';
      let filename = `${type}`;

      // Gestion des types spéciaux (boutique, repas, badge)
      if (type === 'boutique') {
        endpoint = `/api/export/shop-items`;
        filename = `boutique_articles`;
      } else if (type === 'repas') {
        endpoint = `/api/export/meal-items`;
        filename = `repas_articles`;
      } else if (type === 'badge') {
        endpoint = `/api/export/participants?badge=true`;
        filename = `badges_participants`;
      } else {
        // Gestion des types classiques (zombie, survivant, staff)
        endpoint = `/api/export/participants?type=${type}`;
        
        if (module === 'time-slots') {
          endpoint = `/api/export/time-slots?type=${type}`;
          filename = `${type}_creneaux`;
        } else if (module === 'squads') {
          // Staff n'a pas de squads
          if (type === 'staff') {
            toast({
              title: "Non disponible",
              description: "Les membres du staff n'ont pas de squads",
              variant: "destructive",
            });
            setIsExporting(false);
            return;
          }
          endpoint = `/api/export/squads?type=${type}`;
          filename = `${type}_squads`;
        } else if (module === 'all') {
          endpoint = `/api/export/all-data?type=${type}`;
          filename = `${type}_complet`;
        } else {
          filename = `${type}_participants`;
        }
      }

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: `Export réussi pour ${getModuleLabel()}`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getModuleLabel = () => {
    if (type === 'boutique') return 'Articles boutique';
    if (type === 'repas') return 'Articles repas';
    if (type === 'badge') return 'Badges participants';
    
    switch (module) {
      case 'time-slots': return 'Créneaux horaires';
      case 'squads': return 'Squads';
      case 'all': return 'Toutes les données';
      default: return 'Participants';
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-primary" />
          <h3 className="text-lg font-semibold">Export Excel - {getModuleLabel()}</h3>
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full gap-2"
          data-testid="button-export-excel"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Export...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Exporter
            </>
          )}
        </Button>

        <p className="text-sm text-muted-foreground">
          Le fichier sera téléchargé au format Excel (.xlsx)
        </p>
      </div>
    </Card>
  );
}
