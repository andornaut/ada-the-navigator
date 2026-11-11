import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

import { precachePlugin } from "./src/pwa/precachePlugin.ts";
import { sitePageInputs, sitePages } from "./src/tools/site-pages.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // precachePlugin runs after sitePages has moved the game page to play/index.html, and writes
  // /sw.js, the service worker that precaches the game for offline play.
  plugins: [
    sitePages(),
    cloudflare(),
    ...precachePlugin("play/index.html", resolve(root, "src/pwa/serviceWorker.ts")),
  ],
  build: {
    // Phaser's renderer is a single engine dependency shared by the starter.
    chunkSizeWarningLimit: 1600,
    rolldownOptions: { input: sitePageInputs(root) },
  },
});
