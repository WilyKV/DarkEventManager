import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "Zomb'in The Dark",
        short_name: "ZombDark",
        description:
          "Système de gestion pour l'événement Zomb'in The Dark — zombies, survivants, boutique et repas",
        theme_color: "#d6dae1",
        background_color: "#d6dae1",
        display: "standalone",
        id: "/",
        scope: "/",
        start_url: "/",
        lang: "fr",
        shortcuts: [
          { name: "Accueil zombie", url: "/zombie" },
          { name: "Accueil zombie hors ligne", url: "/zombie/hors-ligne" },
        ],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
        suppressWarnings: true,
      },
      workbox: {
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 32 * 1024 * 1024,
        importScripts: ["/legacy-pwa-upgrade.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}", "accueil-zombies/*.{mp4,m4a,ttf}"],
        directoryIndex: null,
        navigateFallback: null,
        runtimeCaching: [{
          // Online navigation needs the current response headers, even for server-only releases.
          urlPattern: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate"
            && !/^\/(?:api|ws)(?:\/|$)/.test(url.pathname),
          handler: "NetworkOnly",
          options: {
            precacheFallback: { fallbackURL: "/index.html" },
          },
        }],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
