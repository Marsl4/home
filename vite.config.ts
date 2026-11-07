import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Name des GitHub-Repositorys = Teil der Web-Adresse: https://<name>.github.io/home/
const GITHUB_PAGES_PATH = "/home/";

export default defineConfig(({ command, isPreview }) => ({
  // Beim Entwickeln (npm run dev) läuft die App unter "/", gebaut (online + npm run preview) unter "/home/".
  base: command === "build" || isPreview ? GITHUB_PAGES_PATH : "/",
  plugins: [
    react(),
    // Macht die App installierbar (Icon, eigenes Fenster) und offline nutzbar.
    VitePWA({
      registerType: "autoUpdate", // neue Versionen werden beim nächsten Öffnen automatisch geladen
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Home",
        short_name: "Home",
        description: "Notizen, Uni, PDFs und ToDos an einem Ort",
        lang: "de",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Alles für den Offline-Betrieb speichern, auch die großen Dateien (Editor, PDF-Leser).
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
}));
