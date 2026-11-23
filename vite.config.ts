// Node types for this config file only, so browser code type-checks without Node globals.
/// <reference types="node" />

import { gameViteConfig } from "@andornaut/game-kit/build/gameConfig";
import type { ConfigEnv } from "vite";

import type * as ConfigModules from "./src/tools/viteConfigModules.ts";
import { downloadSizeAssetsPlugin } from "./tools/download-size-assets.mjs";

// The landing page at / and the game at /play/, from pages/.
// homePagePlugin fills the landing page's copy (src/data/homeCopy.ts).
// sitePages, on the dev server only, redirects /play to /play/.
// phaserBuildPlugin, in a build only, bundles Phaser from its source without the namespaces the
// game does not use and without the Canvas renderer (PHASER_BUILD in src/tools/phaserBuild.ts).
// uiStylePlugin serves the HTML interface's stylesheet as the CSS module virtual:ada-ui.css, so
// the build links it as a file the CSP's style-src 'self' allows.
// hashedIconsPlugin writes each icon under a content-hashed name in /assets/ and points the built
// pages and /manifest.webmanifest there (ICONS in src/pwa/icons.ts); webManifestPlugin then fills
// the manifest's description, before precachePlugin reads it.
// precachePlugin writes /sw.js, the router service worker, and the build manifest and pointer
// under /.game-kit/ that the page installs from.
// securityHeadersPlugin writes /_headers, the response headers with each page's CSP.
export default ({ command }: ConfigEnv) =>
  gameViteConfig<typeof ConfigModules>({
    // The trimmed Phaser chunk alone is about 1 MB minified, so the 500 kB default always warns.
    // Set just above it so that growth in Phaser or game code still warns.
    chunkSizeWarningLimit: 1100,
    configModules: "src/tools/viteConfigModules.ts",
    pages: {
      main: "pages/index.html",
      play: "pages/play/index.html",
    },
    plugins: (modules, repoPath, metadata) => [
      modules.homePagePlugin(),
      modules.sitePages(),
      modules.phaserBuildPlugin(modules.PHASER_BUILD),
      modules.uiStylePlugin({ source: repoPath("src/ui/stylesheet.ts") }),
      modules.hashedIconsPlugin({ icons: modules.ICONS }),
      modules.webManifestPlugin(),
      ...modules.precachePlugin({
        ...(command === "build" ? { buildId: metadata.buildId } : {}),
        pageHtmlFile: "play/index.html",
        serviceWorkerSource: repoPath("src/pwa/serviceWorker.ts"),
      }),
      downloadSizeAssetsPlugin(),
      modules.securityHeadersPlugin(),
    ],
    previewHost: undefined,
    repoRoot: import.meta.dirname,
    testTimeout: 10_000,
  }).then((config) => ({
    ...config,
    // The precache producer owns emitted public assets. A second public copy would
    // expose original files selected for the grouped archives.
    build: { ...config.build, copyPublicDir: false },
    test: {
      ...config.test,
      maxWorkers: 4,
      setupFiles: ["src/testSetup.ts"],
    },
  }));
