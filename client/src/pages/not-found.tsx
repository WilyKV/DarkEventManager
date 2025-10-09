import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skull } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center gap-4">
            <Skull className="h-16 w-16 text-primary" />
            <h1 className="text-3xl font-display text-primary">404</h1>
            <p className="text-muted-foreground">
              Cette page n'existe pas ou a été dévorée par les zombies...
            </p>
            <Link href="/">
              <Button className="mt-4">Retour à l'accueil</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
