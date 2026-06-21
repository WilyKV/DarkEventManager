import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, User, KeyRound, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

const visitorSchema = z.object({
  secretCode: z.string().length(5, "Le code doit contenir exactement 5 caractères"),
  firstLetterLastName: z.string().length(1, "Une seule lettre requise").regex(/^[A-Za-z]$/, "Doit être une lettre"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type VisitorFormData = z.infer<typeof visitorSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { checkSession, user, visitor, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("staff");

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/overview");
    } else if (!isLoading && visitor) {
      setLocation("/visitor");
    }
  }, [user, visitor, isLoading, setLocation]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const visitorForm = useForm<VisitorFormData>({
    resolver: zodResolver(visitorSchema),
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur de connexion");
      }

      return res.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${data.user.username}`,
      });
      
      // Parse roles pour redirection automatique
      let roles: string[] = [];
      try {
        roles = JSON.parse(data.user.roles || '[]');
      } catch {
        roles = [];
      }
      
      // Si l'utilisateur n'a qu'un seul rôle, rediriger automatiquement vers sa section
      if (roles.length === 1) {
        const roleToPage: Record<string, string> = {
          'zombie': '/zombie',
          'survivant': '/survivant',
          'staff': '/staff',
          'repas': '/repas',
          'boutique': '/boutique',
        };
        
        const targetPage = roleToPage[roles[0]];
        if (targetPage) {
          window.location.href = targetPage;
          return;
        }
      }
      
      // Sinon, rediriger vers l'overview
      window.location.href = "/overview";
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur de connexion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const visitorMutation = useMutation({
    mutationFn: async (data: VisitorFormData) => {
      const res = await fetch("/api/auth/login-visitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Code invalide");
      }

      return res.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${data.participant.firstName} ${data.participant.lastName}`,
      });
      // Force page reload to ensure session is properly loaded
      window.location.href = "/visitor";
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur de connexion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogin = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const handleVisitorLogin = (data: VisitorFormData) => {
    visitorMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
              src="https://zombinthedark.fr/wp-content/uploads/2020/11/Logo_ZITD_plat_blanc-1-300x105.png"
              alt="Zomb'in The Dark Logo"
              className="w-[300px] h-auto mx-auto"
            />
          <p className="text-slate-300">Gestion d'événement Zombie/Survivant</p>
        </div>

        <Card className="shadow-2xl border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              Connexion
            </CardTitle>
            <CardDescription>
              Connectez-vous pour accéder à l'application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="staff" className="gap-2">
                  <User className="w-4 h-4" />
                  Staff
                </TabsTrigger>
                <TabsTrigger value="visitor" className="gap-2">
                  <KeyRound className="w-4 h-4" />
                  Visiteur
                </TabsTrigger>
              </TabsList>

              {/* Staff/Admin Login */}
              <TabsContent value="staff">
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Nom d'utilisateur</Label>
                    <Input
                      id="username"
                      {...loginForm.register("username")}
                      placeholder="admin"
                      autoComplete="username"
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-sm text-destructive">
                        {loginForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      {...loginForm.register("password")}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Connexion..." : "Se connecter"}
                  </Button>
                </form>

                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Par défaut : <strong>admin</strong> / <strong>admin123</strong>
                  </AlertDescription>
                </Alert>
              </TabsContent>

              {/* Visitor Login */}
              <TabsContent value="visitor">
                <form onSubmit={visitorForm.handleSubmit(handleVisitorLogin)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="secretCode">Code secret (5 chiffres)</Label>
                    <Input
                      id="secretCode"
                      {...visitorForm.register("secretCode")}
                      placeholder="12345"
                      maxLength={5}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                    {visitorForm.formState.errors.secretCode && (
                      <p className="text-sm text-destructive">
                        {visitorForm.formState.errors.secretCode.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firstLetterLastName">Première lettre de votre nom</Label>
                    <Input
                      id="firstLetterLastName"
                      {...visitorForm.register("firstLetterLastName")}
                      placeholder="A"
                      maxLength={1}
                      className="text-center text-2xl uppercase font-mono"
                      onChange={(e) => {
                        e.target.value = e.target.value.toUpperCase();
                        visitorForm.setValue("firstLetterLastName", e.target.value);
                      }}
                    />
                    {visitorForm.formState.errors.firstLetterLastName && (
                      <p className="text-sm text-destructive">
                        {visitorForm.formState.errors.firstLetterLastName.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={visitorMutation.isPending}
                  >
                    {visitorMutation.isPending ? "Connexion..." : "Accéder à mon profil"}
                  </Button>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Utilisez le code à 5 chiffres et la première lettre de votre nom que vous avez reçu lors de votre inscription
                    </AlertDescription>
                  </Alert>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
