import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Vite ist der Entwicklungs-Server und Bundler:
// "npm run dev" startet die App lokal, "npm run build" erzeugt die fertigen Dateien.
//
// VitePWA macht die App installierbar (Homescreen auf dem iPhone) und legt einen
// Service Worker an, der die App-Dateien zwischenspeichert. Dadurch startet die
// App auch OFFLINE und ohne laufenden Dev-Server. Der Lernstand wird davon
// unabhängig über Supabase + localStorage synchronisiert.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate", // neue Version automatisch im Hintergrund laden
      includeAssets: ["apple-touch-icon.png", "favicon-32x32.png"],
      manifest: {
        name: "Hanzi-Lern-App",
        short_name: "Hanzi",
        description:
          "Chinesische Vokabeln und Schriftzeichen lernen (Kaishi! Lek 1–6 + Radikale)",
        lang: "de",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#059669",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // App-Shell (JS/CSS/HTML/Schriften/Bilder) für den Offline-Start cachen.
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
      },
    }),
  ],
});
