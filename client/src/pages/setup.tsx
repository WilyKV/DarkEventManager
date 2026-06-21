import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ChevronLeft, ChevronRight, Skull, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { ExcelImport } from "@/components/excel-import";

// ---------------------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------------------

const adminSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "La confirmation est requise"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type AdminFormData = z.infer<typeof adminSchema>;

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 4;

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (password.length === 0) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 20, label: "Très faible", color: "bg-red-500" };
  if (score === 2) return { score: 40, label: "Faible", color: "bg-orange-500" };
  if (score === 3) return { score: 60, label: "Correct", color: "bg-yellow-500" };
  if (score === 4) return { score: 80, label: "Fort", color: "bg-lime-500" };
  return { score: 100, label: "Très fort", color: "bg-green-500" };
}

// ---------------------------------------------------------------------------
// Étape 1 — Bienvenue
// ---------------------------------------------------------------------------

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-900/40 border border-emerald-700">
        <Skull className="w-10 h-10 text-emerald-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-emerald-400 mb-2">Bienvenue dans DarkEventManager</h2>
        <p className="text-zinc-400 max-w-sm">
          Configurons votre événement en quelques étapes. Cela ne prendra que quelques minutes.
        </p>
      </div>
      <Button onClick={onNext} className="bg-emerald-700 hover:bg-emerald-600 text-white px-8">
        Commencer
        <ChevronRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 2 — Créer l'administrateur
// ---------------------------------------------------------------------------

function StepAdmin({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [, setLocation] = useLocation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdminFormData>({ resolver: zodResolver(adminSchema) });

  const passwordValue = watch("password", "");
  const strength = getPasswordStrength(passwordValue);

  const initMutation = useMutation({
    mutationFn: async (data: AdminFormData) => {
      const res = await fetch("/api/auth/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.username, password: data.password }),
      });
      if (res.status === 403) {
        setAlreadyExists(true);
        throw new Error("admin_exists");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Erreur lors de la création de l'admin");
      }
      return res.json();
    },
    onSuccess: () => {
      setServerError(null);
      onNext();
    },
    onError: (err: Error) => {
      if (err.message !== "admin_exists") {
        setServerError(err.message);
      }
    },
  });

  if (alreadyExists) {
    return (
      <div className="flex flex-col gap-6">
        <Alert variant="destructive" className="border-red-800 bg-red-950/40">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Un administrateur existe déjà. La configuration a déjà été effectuée.
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <ChevronLeft className="mr-2 w-4 h-4" />
            Retour
          </Button>
          <Button onClick={() => setLocation("/login")} className="bg-emerald-700 hover:bg-emerald-600 text-white">
            Aller à la connexion
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((data) => initMutation.mutate(data))} className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-emerald-400 mb-1">Créer le compte administrateur</h2>
        <p className="text-zinc-400 text-sm">Ce compte aura tous les droits sur l'application.</p>
      </div>

      {serverError && (
        <Alert variant="destructive" className="border-red-800 bg-red-950/40">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username" className="text-zinc-300">Nom d'utilisateur</Label>
        <Input
          id="username"
          {...register("username")}
          className="bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-emerald-600"
          placeholder="admin"
        />
        {errors.username && <p className="text-red-400 text-xs">{errors.username.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-zinc-300">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          {...register("password")}
          className="bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-emerald-600"
          placeholder="••••••••"
        />
        {passwordValue.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="h-1.5 w-full bg-zinc-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${strength.color}`}
                style={{ width: `${strength.score}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400">{strength.label}</p>
          </div>
        )}
        {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword" className="text-zinc-300">Confirmer le mot de passe</Label>
        <Input
          id="confirmPassword"
          type="password"
          {...register("confirmPassword")}
          className="bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-emerald-600"
          placeholder="••••••••"
        />
        {errors.confirmPassword && (
          <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <ChevronLeft className="mr-2 w-4 h-4" />
          Retour
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || initMutation.isPending}
          className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white"
        >
          {initMutation.isPending ? "Création..." : "Suivant"}
          <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Étape 3 — Mode de fonctionnement
// ---------------------------------------------------------------------------

type SyncMode = "online" | "offline";

function StepSyncMode({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<SyncMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const applyMode = async () => {
    if (!selected) {
      setError("Veuillez sélectionner un mode.");
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/sync/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnlineMode: selected === "online" }),
      });
      if (!res.ok) {
        // L'endpoint nécessite auth admin ; on continue quand même
        // (le mode pourra être changé plus tard dans les paramètres)
      }
    } catch {
      // Silencieux : le mode peut être modifié après connexion
    } finally {
      setApplying(false);
      onNext();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-emerald-400 mb-1">Mode de fonctionnement</h2>
        <p className="text-zinc-400 text-sm">
          Comment sera utilisée l'application pendant l'événement ?
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="border-red-800 bg-red-950/40">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => { setSelected("online"); setError(null); }}
          className={`flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
            selected === "online"
              ? "border-emerald-500 bg-emerald-900/30"
              : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
          }`}
        >
          <Wifi className={`w-8 h-8 ${selected === "online" ? "text-emerald-400" : "text-zinc-400"}`} />
          <div>
            <p className="font-semibold text-zinc-100">En ligne</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Plusieurs appareils se synchronisent en temps réel. Idéal si votre réseau est stable.
            </p>
          </div>
          {selected === "online" && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 self-end" />
          )}
        </button>

        <button
          type="button"
          onClick={() => { setSelected("offline"); setError(null); }}
          className={`flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors cursor-pointer ${
            selected === "offline"
              ? "border-emerald-500 bg-emerald-900/30"
              : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
          }`}
        >
          <WifiOff className={`w-8 h-8 ${selected === "offline" ? "text-emerald-400" : "text-zinc-400"}`} />
          <div>
            <p className="font-semibold text-zinc-100">Hors ligne</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Un seul appareil maître gère les données. Adapté sans connexion réseau fiable.
            </p>
          </div>
          {selected === "offline" && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 self-end" />
          )}
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Ce choix peut être modifié ultérieurement dans les paramètres de synchronisation.
      </p>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <ChevronLeft className="mr-2 w-4 h-4" />
          Retour
        </Button>
        <Button
          type="button"
          onClick={applyMode}
          disabled={applying}
          className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white"
        >
          {applying ? "Application..." : "Suivant"}
          <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 4 — Import participants
// ---------------------------------------------------------------------------

function StepImport({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-emerald-400 mb-1">Importer les participants</h2>
        <p className="text-zinc-400 text-sm">
          Importez votre liste depuis un fichier Excel ou passez cette étape pour le faire plus tard.
        </p>
      </div>

      <ExcelImport type="zombie" module="all" />

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <ChevronLeft className="mr-2 w-4 h-4" />
          Retour
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onNext}
          className="flex-1 border-zinc-600 text-zinc-300 hover:bg-zinc-800"
        >
          Je le ferai plus tard
          <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Écran final
// ---------------------------------------------------------------------------

function StepDone() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-900/40 border border-emerald-700">
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-emerald-400 mb-2">Tout est prêt !</h2>
        <p className="text-zinc-400 max-w-sm">
          Votre événement est configuré. Connectez-vous pour commencer à gérer vos participants.
        </p>
      </div>
      <Button
        onClick={() => setLocation("/login")}
        className="bg-emerald-700 hover:bg-emerald-600 text-white px-8"
      >
        Accéder à l'application
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal : SetupPage
// ---------------------------------------------------------------------------

export default function SetupPage() {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();

  const progressPercent = step > TOTAL_STEPS ? 100 : ((step - 1) / TOTAL_STEPS) * 100;

  const goNext = () => {
    if (step === TOTAL_STEPS) {
      // Invalide le cache setup/status pour que l'app sache que le setup est fait
      queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
    }
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const stepLabels = ["Bienvenue", "Administrateur", "Mode", "Participants"];

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Card className="bg-zinc-900 border-zinc-700 shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="text-zinc-100 text-sm font-medium">
                {step <= TOTAL_STEPS ? `Étape ${step} sur ${TOTAL_STEPS} — ${stepLabels[step - 1]}` : "Configuration terminée"}
              </CardTitle>
              <div className="flex gap-1">
                {stepLabels.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx + 1 < step
                        ? "bg-emerald-500"
                        : idx + 1 === step
                        ? "bg-emerald-400"
                        : "bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            </div>
            <Progress
              value={progressPercent}
              className="h-1.5 bg-zinc-800 [&>[data-slot=progress-indicator]]:bg-emerald-500"
            />
          </CardHeader>

          <CardContent className="pt-2 pb-6">
            {step === 1 && <StepWelcome onNext={goNext} />}
            {step === 2 && <StepAdmin onNext={goNext} onBack={goBack} />}
            {step === 3 && <StepSyncMode onNext={goNext} onBack={goBack} />}
            {step === 4 && <StepImport onNext={goNext} onBack={goBack} />}
            {step > TOTAL_STEPS && <StepDone />}
          </CardContent>
        </Card>

        <CardDescription className="text-center text-zinc-600 text-xs mt-4">
          DarkEventManager — Zomb'in The Dark
        </CardDescription>
      </div>
    </div>
  );
}
