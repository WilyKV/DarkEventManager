/// <reference types="vite-plugin-pwa/client" />
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Earlier versions cached API responses, including data tied to staff sessions.
if ("caches" in window) {
  const clearLegacyApiCache = () => { void caches.delete("api-cache").catch(() => {}); };
  clearLegacyApiCache();
  navigator.serviceWorker?.addEventListener("controllerchange", clearLegacyApiCache);
}

// Force dark mode
document.documentElement.classList.add('dark');
document.body.classList.add('dark');

createRoot(document.getElementById("root")!).render(<App />);
