import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Download, Upload } from "lucide-react";
import {
  eventBackupPath, eventBackupExtension, eventBackupMaxBytes, eventBackupPassphraseMax, eventBackupPassphraseMin,
  type EventBackupSummary,
} from "@shared/event-backup";
import { formatEventDay } from "@shared/event-day";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const dialogClass = "w-[calc(100%-1.25rem)] rounded-xl p-4 sm:p-6";

async function sendFile(action: "verify" | "restore", file: File, passphrase: string) {
  const data = new FormData();
  data.append("file", file);
  data.append("passphrase", passphrase);
  const deviceId = localStorage.getItem("deviceId");
  const response = await fetch(`${eventBackupPath}/${action}`, {
    method: "POST", body: data, headers: deviceId ? { "X-Device-ID": deviceId } : undefined,
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => undefined);
    throw new Error(problem?.message ?? "Le serveur n’a pas pu traiter la sauvegarde.");
  }
  return await response.json() as EventBackupSummary;
}

export function EventBackupManager() {
  const client = useQueryClient();
  const { checkSession } = useAuth();
  const { toast } = useToast();
  const [exportPhrase, setExportPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [restorePhrase, setRestorePhrase] = useState("");
  const [file, setFile] = useState<File>();
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const download = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `${eventBackupPath}/export`, { passphrase: exportPhrase });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `darkevent-${new Date().toISOString().slice(0, 10)}${eventBackupExtension}`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onSuccess: () => {
      setDownloaded(true);
      setExportPhrase("");
      setConfirmation("");
    },
  });
  const verification = useMutation({
    mutationFn: ({ file, phrase }: { file: File; phrase: string }) => sendFile("verify", file, phrase),
  });
  const restore = useMutation({
    mutationFn: ({ file, phrase }: { file: File; phrase: string }) => sendFile("restore", file, phrase),
    onSuccess: () => {
      setConfirmRestore(false);
      client.clear();
      toast({ title: "Sauvegarde restaurée", description: "Reconnectez-vous avec un compte de la sauvegarde." });
      void checkSession();
    },
  });

  const checking = verification.isPending || restore.isPending;
  const tooLarge = file !== undefined && file.size >= eventBackupMaxBytes;
  const summary = verification.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Archive className="size-5" aria-hidden /> Sauvegarde complète</CardTitle>
        <CardDescription>La sauvegarde chiffrée contient les comptes, les participants, les squads, les horaires et consignes, les réglages et l’historique des achats.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        <form className="min-w-0 space-y-3 rounded-lg border p-3" onSubmit={event => { event.preventDefault(); download.mutate(); }}>
          <h3 className="font-semibold">Télécharger une sauvegarde</h3>
          <p className="text-sm text-muted-foreground">Envoyez d’abord les accueils saisis hors ligne. Gardez le fichier et sa phrase pour pouvoir le rouvrir.</p>
          <label className="block space-y-1 text-sm font-medium">Phrase de sauvegarde
            <Input type="password" autoComplete="new-password" required minLength={eventBackupPassphraseMin} maxLength={eventBackupPassphraseMax}
              value={exportPhrase} onChange={event => { setExportPhrase(event.target.value); setDownloaded(false); }} />
          </label>
          <label className="block space-y-1 text-sm font-medium">Confirmer la phrase de sauvegarde
            <Input type="password" autoComplete="new-password" required maxLength={eventBackupPassphraseMax}
              value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          </label>
          <Button type="submit" className="w-full whitespace-normal" loading={download.isPending}
            disabled={exportPhrase.length < eventBackupPassphraseMin || exportPhrase !== confirmation}>
            <Download /> Télécharger la sauvegarde
          </Button>
          {downloaded && <p role="status" className="text-sm text-muted-foreground">Téléchargement lancé. Vérifiez le fichier ici avant de réinitialiser.</p>}
          {download.isError && <p role="alert" className="text-sm text-destructive">
            {download.error.message.startsWith("413:") ? "La sauvegarde est trop volumineuse pour ce téléchargement." : "Impossible de télécharger la sauvegarde."}
          </p>}
        </form>

        <form className="min-w-0 space-y-3 rounded-lg border p-3" onSubmit={event => {
          event.preventDefault();
          if (file && !tooLarge) verification.mutate({ file, phrase: restorePhrase });
        }}>
          <h3 className="font-semibold">Restaurer une sauvegarde</h3>
          <label className="block space-y-1 text-sm font-medium">Fichier de sauvegarde
            <Input type="file" accept={eventBackupExtension} className="min-w-0"
              disabled={checking} required onChange={event => { setFile(event.target.files?.[0]); verification.reset(); restore.reset(); }} />
          </label>
          <label className="block space-y-1 text-sm font-medium">Phrase du fichier
            <Input type="password" autoComplete="off" disabled={checking} minLength={eventBackupPassphraseMin} maxLength={eventBackupPassphraseMax} required
              value={restorePhrase} onChange={event => { setRestorePhrase(event.target.value); verification.reset(); restore.reset(); }} />
          </label>
          <Button type="submit" variant="outline" loading={verification.isPending} disabled={!file || tooLarge || restorePhrase.length < eventBackupPassphraseMin || restore.isPending}>
            Vérifier le fichier
          </Button>
          {tooLarge && <p role="alert" className="text-sm text-destructive">Ce fichier dépasse la taille prise en charge.</p>}
          {verification.isError && <p role="alert" className="text-sm text-destructive">{verification.error.message}</p>}
          {summary && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
              <p role="status" className="font-medium">Sauvegarde vérifiée</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                <dt>Comptes</dt><dd>{summary.users}</dd>
                <dt>Fiches</dt><dd>{summary.participants}</dd>
                <dt>Squads</dt><dd>{summary.squads}</dd>
                <dt>Créneaux</dt><dd>{summary.timeSlots}</dd>
              </dl>
              {summary.eventDay && <p className="capitalize">Événement du {formatEventDay(summary.eventDay)}</p>}
              <Button type="button" variant="outline" className="w-full whitespace-normal" onClick={() => setConfirmRestore(true)}>
                <Upload /> Restaurer cette sauvegarde
              </Button>
            </div>
          )}
        </form>
      </CardContent>

      <AlertDialog open={confirmRestore} onOpenChange={open => { if (!restore.isPending) setConfirmRestore(open); }}>
        <AlertDialogContent className={dialogClass}>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer cette sauvegarde ?</AlertDialogTitle>
            <AlertDialogDescription>Les données et les comptes en place seront remplacés par ceux du fichier. Reconnectez-vous ensuite avec un compte de cette sauvegarde.</AlertDialogDescription>
          </AlertDialogHeader>
          {restore.isError && <p role="alert" className="text-sm text-destructive">{restore.error.message}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restore.isPending}>Annuler</AlertDialogCancel>
            <Button type="button" variant="destructive" loading={restore.isPending} onClick={() => {
              if (file && summary) restore.mutate({ file, phrase: restorePhrase });
            }}>Confirmer la restauration</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
