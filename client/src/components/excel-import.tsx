import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExcelImportProps {
  type: "zombie" | "survivant";
}

export function ExcelImport({ type }: ExcelImportProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const response = await fetch("/api/participants/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de l'import");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all participant and time slot queries regardless of type
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === "/api/participants" || key === "/api/time-slots";
        }
      });
      toast({
        title: "Import réussi",
        description: `${data.count} participants importés avec succès`,
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur d'import",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleImport = () => {
    if (file) {
      importMutation.mutate(file);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-primary" />
          <h3 className="text-lg font-semibold">Import Excel</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="excel-upload"
              data-testid="input-excel-file"
            />
            <label htmlFor="excel-upload">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-select-file"
              >
                <Upload className="w-4 h-4" />
                {file ? file.name : "Sélectionner un fichier Excel"}
              </Button>
            </label>
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || importMutation.isPending}
            className="gap-2"
            data-testid="button-import-excel"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Import...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Importer
              </>
            )}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Format attendu: Prénom, Nom, Créneau (colonnes A, B, C)
        </p>
      </div>
    </Card>
  );
}
