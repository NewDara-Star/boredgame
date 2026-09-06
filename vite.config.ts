import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new deploy's service worker takes over on the next load -- no "update
      // available" prompt, no stale app served from cache after a push.
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "BoredGame",
        short_name: "BoredGame",
        description: "Quick head-to-head word and board games -- trivia, picto, ball sort and more.",
        theme_color: "#FF2E88",
        background_color: "#FBF4E6",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/contact/],
        cleanupOutdatedCaches: true,
        // The generated SW imports the push + notificationclick handlers so
        // precaching (above) and Web Push live in one service worker.
        importScripts: ["/push-sw.js"],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // Split by how often it changes, not by size. React and the router are
        // the same bytes for a year at a time, so a cached copy survives every
        // deploy; app code does not. Supabase and framer-motion are separated
        // because a page that needs neither should not wait for both.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
