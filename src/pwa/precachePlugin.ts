import { createHash } from "node:crypto";
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

const UPDATE_ART_BUCKETS: Readonly<Record<string, number>> = {
  andromeda: 4,
  asteroids: 2,
  cartwheel: 3,
  core: 3,
  enemies: 4,
  needle: 2,
  phantom: 2,
  whales: 4,
};

// Keep build outputs in stable groups when only their content hashes change.
function updateGroup(url: string): string {
  if (url.startsWith("/previews/")) {
    return "preview";
  }
  if (url.startsWith("/assets/art/app-icon/")) {
    return "app-icons";
  }
  const parts = url.split("/").filter(Boolean);
  if (parts[0] !== "art") {
    const stableName = url.replace(/-[A-Za-z0-9_-]{8}(?=\.[^.]+$)/u, "");
    return `entry:${createHash("sha256").update(stableName).digest("hex").slice(0, 16)}`;
  }
  const area = parts.length > 2 ? parts[1]! : "core";
  const bucketCount = UPDATE_ART_BUCKETS[area] ?? 1;
  const bucket = createHash("sha256").update(url).digest().readUInt32BE() % bucketCount;
  return `art:${area}:${bucket}`;
}

// The landing page and play shell use these before a service worker controls the page.
const DIRECT_ART = new Set([
  "/art/portraits/ada.png",
  "/art/ui/fonts/adaui/AdaUI-Bold.woff2",
  "/art/ui/fonts/adaui/AdaUI-Regular.woff2",
  "/art/ui/icons/icons-16x16.svg",
]);

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
  let deferredOutputs = new Set<string>();
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
    async generateBundle(_options, bundle) {
      const { publicDir } = this.environment.config;
      // Keep the static dependencies of both HTML entry points. The game itself loads
      // after the install, so dynamic imports and their own dependencies can be archived.
      const direct = new Set<string>();
      const pending = Object.values(bundle).flatMap((file) =>
        file.type === "chunk" && file.isEntry ? [file.fileName] : [],
      );
      for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
        const file = bundle[name];
        if (!file || direct.has(name)) {
          continue;
        }
        direct.add(name);
        if (file.type === "chunk") {
          pending.push(
            ...file.imports,
            ...(file.viteMetadata?.importedAssets ?? []),
            ...(file.viteMetadata?.importedCss ?? []),
          );
        }
      }
      deferredOutputs = new Set(
        Object.keys(bundle).filter(
          (name) =>
            name.startsWith("assets/") &&
            !name.startsWith("assets/art/app-icon/") &&
            !direct.has(name),
        ),
      );
      this.emitFile({
        fileName: "site.css",
        source: await readFile(join(publicDir, "site.css")),
        type: "asset",
      });
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
      groupedFirstInstall: {
        archiveOnly: (url) =>
          deferredOutputs.has(url.slice(1)) ||
          ((url.startsWith("/art/") || url.startsWith("/previews/")) && !DIRECT_ART.has(url)),
      },
      hashedFiles: (bundleFile) => {
        emitted = bundleFile;
        return { sounds: {}, urls };
      },
      pageHtmlFile,
      policy: CACHE_POLICY,
      serviceWorkerSource,
      updateGroup,
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
