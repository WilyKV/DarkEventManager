import { useState, useEffect } from "react";
import { db } from "@/db/event-store";

const POLL_INTERVAL_MS = 5_000;

export function SyncPendingBadge() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const pending = await db.events.filter((e) => e.syncedAt === null).count();
        if (!cancelled) setCount(pending);
      } catch {
        // Dexie unavailable — stay at 0
      }
    }

    // Initial fetch
    fetchCount();

    // Polling fallback
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
        <span className="hidden sm:inline">À jour</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
      <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
        {count > 99 ? "99+" : count}
      </span>
      <span className="hidden sm:inline">en attente</span>
    </span>
  );
}
