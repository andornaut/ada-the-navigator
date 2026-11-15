import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import {
  type HashedFiles,
  precachePlugin as kitPrecachePlugin,
} from "@andornaut/game-kit/build/precachePlugin";
import type { PrecacheGroups } from "@andornaut/game-kit/runtime/web/pwa/precacheGroups";
import type { Plugin } from "vite";

import { CACHE_POLICY } from "./cachePolicy.ts";
import { FILE_READ_CONCURRENCY, mapBounded } from "./mapBounded.ts";
import { ART_DIRECTORY, artUrls, PREVIEW_DIRECTORY, previewUrls } from "./precacheArt.ts";

interface PrecachePluginOptions {
  // The game page's file name in the build output, which is its path under Vite's root, e.g.
  // "play/index.html".
  pageHtmlFile: string;
  readonly buildId?: string | undefined;
  readonly groups?: (
    context: { readonly readJson: (url: string) => unknown },
    files: HashedFiles,
  ) => PrecacheGroups;
  // The service worker's entry module (serviceWorker.ts), as an absolute path.
  serviceWorkerSource: string;
}

// The kit's precache plugin with the game's cache policy, building /sw.js from
// serviceWorkerSource (serviceWorker.ts) to precache the game page at pageHtmlFile and what it
// loads. The game loads its art at runtime rather than linking it, and the kit precaches only
// build output beyond the page's links, so a first plugin emits every file artUrls lists from
// public/art/, and every preview in public/previews/, into the build output at its own path, for
// the kit's to name.
export function precachePlugin({
  buildId,
  groups,
  pageHtmlFile,
  serviceWorkerSource,
}: PrecachePluginOptions): Plugin[] {
  let urls: string[] = [];
  let emitted: ((url: string) => Uint8Array | undefined) | undefined;
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
      ...(groups === undefined
        ? {}
        : {
            buildId,
            groups: (files) =>
              groups(
                {
                  readJson(url) {
                    const source = emitted?.(url);
                    if (!source) {
                      throw new Error(`Grouped precache JSON is not emitted: ${url}`);
                    }
                    return JSON.parse(new TextDecoder().decode(source));
                  },
                },
                files,
              ),
          }),
      hashedFiles: (bundleFile) => {
        emitted = bundleFile;
        return { sounds: {}, urls };
      },
      pageHtmlFile,
      policy: CACHE_POLICY,
      serviceWorkerSource,
    }),
  ];
}
