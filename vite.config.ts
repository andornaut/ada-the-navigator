import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hashedIconsPlugin } from "@andornaut/game-kit/web/pwa/vite/hashedIconsPlugin";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

import { ICONS } from "./src/pwa/icons.ts";
import { precachePlugin } from "./src/pwa/precachePlugin.ts";
import { sitePageInputs, sitePages } from "./src/tools/site-pages.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // hashedIconsPlugin writes each icon under a content-hashed name in /assets/ and points the built
  // pages and /manifest.webmanifest there (ICONS in src/pwa/icons.ts). precachePlugin runs after
  // sitePages has moved the game page to play/index.html, and writes /sw.js, the service worker
  // that precaches the game for offline play.
  plugins: [
    sitePages(),
    cloudflare(),
    hashedIconsPlugin({ icons: ICONS }),
    ...precachePlugin("play/index.html", resolve(root, "src/pwa/serviceWorker.ts")),
  ],
  build: {
    // Phaser's renderer is a single engine dependency shared by the starter.
    chunkSizeWarningLimit: 1600,
    rolldownOptions: { input: sitePageInputs(root) },
  },
});
