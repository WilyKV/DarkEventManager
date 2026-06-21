/// <reference types="vite-plugin-pwa/client" />
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

// Register service worker
registerSW({ immediate: true });

// Force dark mode
document.documentElement.classList.add('dark');
document.body.classList.add('dark');

createRoot(document.getElementById("root")!).render(<App />);
