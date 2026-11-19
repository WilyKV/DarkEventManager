import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { liveQueryPrefixes, matchesQueryPrefix, type LiveScope } from "@shared/live-updates";

type LiveState = "connecting" | "live" | "unavailable" | "offline";
const LiveContext = createContext<LiveState>("connecting");

export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveState>("connecting");

  useEffect(() => {
    if (!userId || !online) {
      setStatus("connecting");
      return;
    }

    let stopped = false;
    let retryDelay = 1_000;
    let retryTimer: number | undefined;
    let connectionTimeout: number | undefined;
    let socket: WebSocket | undefined;
    let request: AbortController | undefined;

    function invalidate(scope: LiveScope) {
      void queryClient.invalidateQueries({
        predicate: ({ queryKey }) => {
          const [key] = queryKey;
          return typeof key === "string" && liveQueryPrefixes[scope].some(prefix => matchesQueryPrefix(key, prefix));
        },
      });
    }

    function retry() {
      if (stopped) return;
      setStatus("unavailable");
      retryTimer = window.setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    }

    async function connect() {
      socket = undefined;
      const controller = new AbortController();
      request = controller;
      connectionTimeout = window.setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await fetch("/api/sync/live-token", { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          if (!stopped) setStatus("unavailable");
          return;
        }
        if (!response.ok) throw new Error("Live token unavailable");
        const { token } = await response.json();
        if (stopped) return;
        if (typeof token !== "string") throw new Error("Invalid live token");

        const url = new URL("/ws", window.location.href);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(url);
        socket = ws;
        ws.addEventListener("open", () => {
          if (!stopped) ws.send(JSON.stringify({ type: "watch", token }));
        });
        ws.addEventListener("message", event => {
          if (stopped || socket !== ws) return;
          try {
            const message = JSON.parse(event.data);
            if (message.type === "watching") {
              window.clearTimeout(connectionTimeout);
              setStatus("live");
              retryDelay = 1_000;
              invalidate("all");
            } else if (message.type === "changed" && Object.prototype.hasOwnProperty.call(liveQueryPrefixes, message.scope)) {
              invalidate(message.scope as LiveScope);
            }
          } catch {
            // Ignore unrecognized messages.
          }
        });
        ws.addEventListener("close", () => {
          window.clearTimeout(connectionTimeout);
          retry();
        });
        window.clearTimeout(connectionTimeout);
        connectionTimeout = window.setTimeout(() => ws.close(), 8_000);
      } catch {
        retry();
      } finally {
        if (!socket) window.clearTimeout(connectionTimeout);
      }
    }

    setStatus("connecting");
    void connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(connectionTimeout);
      request?.abort();
      socket?.close();
    };
  }, [userId, online, queryClient]);

  return <LiveContext.Provider value={online ? status : "offline"}>{children}</LiveContext.Provider>;
}

export function useLiveStatus() {
  return useContext(LiveContext);
}
