import { gameViteConfig } from "@andornaut/game-kit/web/build/vite/gameConfig";

import type * as ConfigModules from "./src/tools/vite-config-modules.ts";

// The landing page at / and the game at /play/, from pages/. sitePages, on the dev server only,
// redirects /play to /play/. hashedIconsPlugin writes each icon under a content-hashed name in
// /assets/ and points the built pages and /manifest.webmanifest there (ICONS in src/pwa/icons.ts).
// precachePlugin writes /sw.js, the service worker that precaches the game for offline play.
export default gameViteConfig<typeof ConfigModules>({
  // The Phaser chunk alone is about 1.37 MB minified, so the 500 kB default always warns. Set just
  // above it so that growth in Phaser or game code still warns.
  chunkSizeWarningLimit: 1400,
  configModules: "src/tools/vite-config-modules.ts",
  pages: {
    main: "pages/index.html",
    play: "pages/play/index.html",
  },
  plugins: (modules, repoPath) => [
    modules.sitePages(),
    modules.hashedIconsPlugin({ icons: modules.ICONS }),
    ...modules.precachePlugin("play/index.html", repoPath("src/pwa/serviceWorker.ts")),
  ],
  previewHost: undefined,
  repoRoot: import.meta.dirname,
  testTimeout: 10_000,
}).then((config) => ({
  ...config,
  test: {
    ...config.test,
    maxWorkers: 4,
    setupFiles: ["src/test-setup.ts"],
  },
}));
