import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { precachePlugin as kitPrecachePlugin } from "@andornaut/game-kit/web/pwa/vite/precachePlugin";
import type { Plugin } from "vite";

import { CACHE_POLICY } from "./cachePolicy.ts";
import { FILE_READ_CONCURRENCY, mapBounded } from "./mapBounded.ts";
import { ART_DIRECTORY, artUrls, PREVIEW_DIRECTORY, previewUrls } from "./precacheArt.ts";

// The kit's precache plugin with the game's cache policy, building /sw.js from
// serviceWorkerSource (serviceWorker.ts) to precache the game page at pageHtmlFile and what it
// loads. The game loads its art at runtime rather than linking it, and the kit precaches only
// build output beyond the page's links, so a first plugin emits every file artUrls lists from
// public/art/, and every preview in public/previews/, into the build output at its own path, for
// the kit's to name.
export function precachePlugin(pageHtmlFile: string, serviceWorkerSource: string): Plugin[] {
  let urls: string[] = [];
  const emitArt: Plugin = {
    apply: "build",
    async generateBundle() {
      const { publicDir } = this.environment.config;
      // A directory not there yet (the previews before their first capture) lists nothing.
      const listed = async (directory: string) => {
        const root = join(publicDir, directory);
        const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(
          (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? [] : Promise.reject(error)),
        );
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"));
      };
      urls = [
        ...artUrls(await listed(ART_DIRECTORY)),
        ...previewUrls(await listed(PREVIEW_DIRECTORY)),
      ];
      const files = await mapBounded(
        FILE_READ_CONCURRENCY,
        async (url) => [url, await readFile(join(publicDir, url))] as const,
        urls,
      );
      for (const [url, source] of files) {
        this.emitFile({ fileName: url.slice(1), source, type: "asset" });
      }
    },
    name: "ada-the-navigator-precache-art",
  };
  return [
    emitArt,
    kitPrecachePlugin({
      hashedFiles: () => ({ sounds: {}, urls }),
      pageHtmlFile,
      policy: CACHE_POLICY,
      serviceWorkerSource,
    }),
  ];
}
