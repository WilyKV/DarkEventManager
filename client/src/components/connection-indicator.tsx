import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface SyncConfig {
  isOnlineMode: boolean;
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const setTrue = () => setOnline(true);
    const setFalse = () => setOnline(false);
    window.addEventListener("online", setTrue);
    window.addEventListener("offline", setFalse);
    return () => {
      window.removeEventListener("online", setTrue);
      window.removeEventListener("offline", setFalse);
    };
  }, []);

  return online;
}

export function ConnectionIndicator() {
  const isOnline = useOnlineStatus();

  const { data: config } = useQuery<SyncConfig>({
    queryKey: ["/api/sync/config"],
    queryFn: async () => {
      const res = await fetch("/api/sync/config");
      if (!res.ok) throw new Error("sync config unavailable");
      return res.json() as Promise<SyncConfig>;
    },
    retry: false,
    staleTime: 30_000,
  });

  if (!isOnline) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
        <span className="hidden sm:inline">Déconnecté</span>
      </span>
    );
  }

  if (config && !config.isOnlineMode) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
        <span className="hidden sm:inline">Hors ligne — maître</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
      <span className="hidden sm:inline">En ligne</span>
    </span>
  );
}
