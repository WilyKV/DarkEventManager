import { useLayoutEffect } from "react";
import { useHistoryState } from "wouter/use-browser-location";

type AppHistoryState = { darkEventDepth?: number } | null;

export function useTrackAppHistory() {
  useLayoutEffect(() => {
    let depth = (window.history.state as AppHistoryState)?.darkEventDepth ?? 0;
    const markEntry = () => {
      const state = window.history.state as AppHistoryState;
      if (state?.darkEventDepth !== depth) {
        window.history.replaceState({ ...state, darkEventDepth: depth }, "");
      }
    };
    const pushed = () => {
      depth += 1;
      markEntry();
    };
    const popped = () => {
      depth = (window.history.state as AppHistoryState)?.darkEventDepth ?? 0;
      markEntry();
    };
    markEntry();
    // Wouter emits these events for History API navigation within the app.
    window.addEventListener("pushState", pushed);
    window.addEventListener("replaceState", markEntry);
    window.addEventListener("popstate", popped);
    return () => {
      window.removeEventListener("pushState", pushed);
      window.removeEventListener("replaceState", markEntry);
      window.removeEventListener("popstate", popped);
    };
  }, []);
}

export function useCanGoBack() {
  return (useHistoryState<AppHistoryState>()?.darkEventDepth ?? 0) > 0;
}
