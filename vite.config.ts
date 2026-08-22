import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Chapman Budget",
        short_name: "Budget",
        description: "Household budgeting, bills, savings, and debt payoff",
        theme_color: "#1f6f5b",
        background_color: "#f4f7f5",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,json,webmanifest}"],
        navigateFallback: "index.html",
        runtimeCaching: [],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
