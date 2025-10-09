import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Wand2 } from "lucide-react";

interface TestDataGeneratorProps {
  type: "zombie" | "survivant";
}

export function TestDataGenerator({ type }: TestDataGeneratorProps) {
  const { toast } = useToast();
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);

  const firstNames = [
    "Jean", "Marie", "Pierre", "Sophie", "Luc", "Alice", "Thomas", "Emma",
    "Nicolas", "Julie", "Antoine", "Camille", "Maxime", "Laura", "Hugo"
  ];

  const lastNames = [
    "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit",
    "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel"
  ];

  const generateTestData = async () => {
    setGenerating(true);

    try {
      const participants = [];

      for (let i = 0; i < count; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@test.fr`;

        const response = await fetch("/api/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            type,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create participant ${i + 1}`);
        }

        participants.push(await response.json());
      }

      toast({
        title: "Données de test générées",
        description: `${count} ${type}s créés avec succès.`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer les données de test.",
        variant: "destructive",
      });
      console.error("Test data generation error:", error);
    } finally {
      setGenerating(false);
      // Refresh data
      window.location.reload();
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Wand2 className="w-4 h-4" />
          Générateur de données de test
        </CardTitle>
        <CardDescription className="text-xs">
          Créer rapidement des participants pour tester l'application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Nombre de {type}s à créer</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            className="mt-1"
          />
        </div>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={generateTestData}
          disabled={generating}
        >
          <Wand2 className="w-4 h-4" />
          {generating ? "Génération..." : `Générer ${count} ${type}s`}
        </Button>
        <p className="text-xs text-muted-foreground">
          ⚠️ Mode développement uniquement
        </p>
      </CardContent>
    </Card>
  );
}
