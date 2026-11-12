// Node types for this config file only, so browser code type-checks without Node globals.
/// <reference types="node" />

import { gameViteConfig } from "@andornaut/game-kit/web/build/vite/gameConfig";

import type * as ConfigModules from "./src/tools/vite-config-modules.ts";

// The landing page at / and the game at /play/, from pages/.
// homePagePlugin fills the landing page's copy (src/data/home-copy.ts).
// sitePages, on the dev server only, redirects /play to /play/.
// phaserBuildPlugin, in a build only, bundles Phaser from its source without the namespaces the
// game does not use and without the Canvas renderer (PHASER_BUILD in src/tools/phaser-build.ts).
// uiStylePlugin serves the HTML interface's stylesheet as the CSS module virtual:ada-ui.css, so
// the build links it as a file the CSP's style-src 'self' allows.
// hashedIconsPlugin writes each icon under a content-hashed name in /assets/ and points the built
// pages and /manifest.webmanifest there (ICONS in src/pwa/icons.ts); webManifestPlugin then fills
// the manifest's description, before precachePlugin reads it.
// precachePlugin writes /sw.js, the service worker that precaches the game for offline play.
// securityHeadersPlugin writes /_headers, the response headers with each page's CSP.
export default gameViteConfig<typeof ConfigModules>({
  // The trimmed Phaser chunk alone is about 1 MB minified, so the 500 kB default always warns.
  // Set just above it so that growth in Phaser or game code still warns.
  chunkSizeWarningLimit: 1100,
  configModules: "src/tools/vite-config-modules.ts",
  pages: {
    main: "pages/index.html",
    play: "pages/play/index.html",
  },
  plugins: (modules, repoPath) => [
    modules.homePagePlugin(),
    modules.sitePages(),
    modules.phaserBuildPlugin(modules.PHASER_BUILD),
    modules.uiStylePlugin({ source: repoPath("src/ui/stylesheet.ts") }),
    modules.hashedIconsPlugin({ icons: modules.ICONS }),
    modules.webManifestPlugin(),
    ...modules.precachePlugin({
      pageHtmlFile: "play/index.html",
      serviceWorkerSource: repoPath("src/pwa/serviceWorker.ts"),
    }),
    modules.securityHeadersPlugin(),
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
