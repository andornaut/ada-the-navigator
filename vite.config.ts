import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare()],
  build: {
    // Phaser's renderer is a single engine dependency shared by the starter.
    chunkSizeWarningLimit: 1600,
  },
});
