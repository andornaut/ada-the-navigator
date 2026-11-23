import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import {
  type HashedFiles,
  precachePlugin as kitPrecachePlugin,
} from "@andornaut/game-kit/build/precachePlugin";
import type { Plugin } from "vite";

import { CACHE_POLICY } from "./cachePolicy.ts";
import { FILE_READ_CONCURRENCY, mapBounded } from "./mapBounded.ts";
import { ART_DIRECTORY, artUrls, PREVIEW_DIRECTORY, previewUrls } from "./precacheArt.ts";

// Decoded bytes per envelope. Use the lower end of Game Kit's transport trial range.
const PACK_MAX_BYTES = 1536 * 1024;

interface PrecachePluginOptions {
  // The game page's file name in the build output, which is its path under Vite's root, e.g.
  // "play/index.html".
  pageHtmlFile: string;
  readonly buildId?: string | undefined;
  // The service worker's entry module (serviceWorker.ts), as an absolute path.
  serviceWorkerSource: string;
}

// The kit's precache plugin with the game's cache policy, building /sw.js (the router) from
// serviceWorkerSource (serviceWorker.ts) and writing the build's manifest and pointer under
// /.game-kit/. The manifest lists the game page at pageHtmlFile, what it loads, and the art and
// previews: the game loads its art at runtime rather than linking it, so a first plugin emits
// every file artUrls lists from public/art/, and every preview in public/previews/, into the
// build output at its own path, for the kit's to name. The complete build installs before first
// play.
export function precachePlugin({
  buildId,
  pageHtmlFile,
  serviceWorkerSource,
}: PrecachePluginOptions): Plugin[] {
  let urls: string[] = [];
  let emitted: ((url: string) => Uint8Array | undefined) | undefined;
  const readJson = (url: string): unknown => {
    const source = emitted?.(url);
    if (!source) {
      throw new Error(`Boot JSON is not emitted: ${url}`);
    }
    return JSON.parse(new TextDecoder().decode(source));
  };
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
      boot: (files) => bootUrls(readJson, files),
      buildId,
      hashedFiles: (bundleFile) => {
        emitted = bundleFile;
        return { sounds: {}, urls };
      },
      packs: { maxBytes: PACK_MAX_BYTES },
      pageHtmlFile,
      policy: CACHE_POLICY,
      serviceWorkerSource,
      wholeBuild: true,
    }),
  ];
}

// The core art manifest, which the game reads at boot with the asset paths it names.
const CORE_MANIFEST = "/art/manifest.json";

// The files the game reads while booting after install, which weight the boot share of the one
// loading bar: the build output under /assets/, the core art manifest and the files it names.
// Core holds the boot set and the shared files (art/README.md); a few of its entries load on
// demand, so the weight is close rather than exact.
export function bootUrls(
  readJson: (url: string) => unknown,
  files: HashedFiles,
): readonly string[] {
  const listed = new Set(files.urls);
  const core = readJson(CORE_MANIFEST) as { readonly assets?: readonly { path?: unknown }[] };
  const named = (core.assets ?? []).flatMap(({ path }) =>
    typeof path === "string" && listed.has(path) ? [path] : [],
  );
  const output = files.urls.filter((url) => url.startsWith(CACHE_POLICY.hashedAssetPrefix));
  return [...new Set([...output, CORE_MANIFEST, ...named])].sort();
}
