import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Phaser's renderer is a single engine dependency shared by the starter.
    chunkSizeWarningLimit: 1600,
  },
});
