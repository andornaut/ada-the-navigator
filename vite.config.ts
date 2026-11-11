import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

import { sitePageInputs, sitePages } from "./src/tools/site-pages.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [sitePages(), cloudflare()],
  build: {
    // Phaser's renderer is a single engine dependency shared by the starter.
    chunkSizeWarningLimit: 1600,
    rolldownOptions: { input: sitePageInputs(root) },
  },
});
