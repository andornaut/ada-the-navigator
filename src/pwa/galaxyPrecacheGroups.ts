import type { HashedFiles } from "@andornaut/game-kit/build/precachePlugin";
import type { PrecacheGroups } from "@andornaut/game-kit/runtime/web/pwa/precacheGroups";

import { ECONOMY } from "../data/economy.ts";
import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import {
  enemyHardpointsPath,
  enemyJetsPath,
  enemyShardsPath,
  GALAXY_FAMILIES,
  galaxyFamily,
} from "../game/enemyArt.ts";
import { readQuantumJump } from "../game/quantumJump.ts";
import { readShipMaterialPalettes, readShipMaterials } from "../game/shipMaterials.ts";
import { galaxyDownloadGroups } from "./galaxyDownloads.ts";

type Context = { readonly readJson: (normalizedUrl: string) => unknown };
type Fields = Record<string, unknown>;
type Audit = {
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly groups: PrecacheGroups;
  readonly uncertain: readonly {
    readonly from: string;
    readonly reference: string;
    readonly reason: "missing-url" | "unreadable-json" | "relative-reference";
  }[];
};
const CORE = "/art/manifest.json";
const BASE = "";
const FILE =
  /\.(?:json|webmanifest|svg|png|webp|avif|jpe?g|gif|woff2?|ttf|otf|ogg|mp3|m4a|wav|aac|css|js|wasm)(?:[?#].*)?$/i;
const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;

type JsonPath = readonly (string | number)[];
const location = (document: string, path: JsonPath) => JSON.stringify([document, path]);

function generatedReferences(
  context: {
    readonly available: ReadonlySet<string>;
    readonly normalize: (from: string, reference: string) => string | undefined;
    readonly read: (url: string) => unknown;
  },
  root: Fields | undefined,
) {
  const bindings = new Map<string, string>();
  const metadata: string[] = [];
  if (typeof root?.shipMaterials !== "string" || typeof root.quantumJump !== "string") {
    return { bindings, metadata };
  }
  const materialUrl = context.normalize(CORE, root.shipMaterials);
  const jumpUrl = context.normalize(CORE, root.quantumJump);
  if (
    !materialUrl ||
    !jumpUrl ||
    !context.available.has(materialUrl) ||
    !context.available.has(jumpUrl)
  ) {
    return { bindings, metadata };
  }
  const jump = readQuantumJump(context.read(jumpUrl));
  if (!jump) {
    return { bindings, metadata };
  }
  const materialData = context.read(materialUrl);
  const materials = readShipMaterials(
    { poses: jump.warp.poses.map(({ id }) => id), warpHeading: jump.warp.heading },
    materialData,
  );
  const palettePath = fields(materialData)?.palettePath;
  const paletteUrl =
    typeof palettePath === "string" ? context.normalize(materialUrl, palettePath) : undefined;
  if (!materials || !paletteUrl || !context.available.has(paletteUrl)) {
    return { bindings, metadata };
  }
  const palettes = readShipMaterialPalettes(ECONOMY.paintOrder, context.read(paletteUrl));
  if (
    !palettes ||
    !jump.warp.poses.every(
      (pose) =>
        Object.keys(pose.paths).length === palettes.size &&
        Object.keys(pose.paths).every((paint) => palettes.has(paint)),
    )
  ) {
    return { bindings, metadata };
  }
  metadata.push(materialUrl, paletteUrl, jumpUrl);
  if (Array.isArray(root.assets)) {
    root.assets.forEach((value, index) => {
      const asset = fields(value);
      const heading = asset?.directionIndex;
      const paint = asset?.paint === undefined ? ECONOMY.defaultPaint : asset.paint;
      if (
        !asset ||
        typeof heading !== "number" ||
        !Number.isInteger(heading) ||
        typeof paint !== "string" ||
        !palettes.has(paint) ||
        !materials.headings.has(heading)
      ) {
        return;
      }
      const expectedId = asset.paint === undefined ? "ship" : `ship-${paint}-${heading}`;
      if (asset.id === expectedId && typeof asset.path === "string") {
        bindings.set(location(CORE, ["assets", index, "path"]), asset.path);
      }
    });
  }
  jump.warp.poses.forEach((pose, index) => {
    if (materials.poses.has(pose.id)) {
      for (const [paint, path] of Object.entries(pose.paths)) {
        bindings.set(location(jumpUrl, ["warp", "poses", index, "paths", paint]), path);
      }
    }
  });
  return { bindings, metadata };
}

function partition(context: Context, files: HashedFiles): Audit {
  const available = new Set([...files.urls, ...Object.values(files.sounds).flat()]);
  const graph = new Map<string, Set<string>>();
  const owners = new Map<string, Set<string>>();
  const documents = new Map<string, unknown>();
  const ids = new Map<string, Set<string>>();
  const uncertain: {
    from: string;
    reference: string;
    reason: "missing-url" | "unreadable-json" | "relative-reference";
  }[] = [];
  const failed = new Set<string>();
  const normalize = (from: string, reference: string) => {
    try {
      const url = new URL(reference, `https://precache.invalid${from}`);
      return url.origin === "https://precache.invalid"
        ? url.pathname.replace(/%7B/gi, "{").replace(/%7D/gi, "}")
        : undefined;
    } catch {
      return undefined;
    }
  };
  const read = (url: string) => {
    if (!documents.has(url)) {
      try {
        documents.set(url, context.readJson(url));
      } catch {
        documents.set(url, undefined);
      }
      if (documents.get(url) === undefined) {
        failed.add(url);
        uncertain.push({ from: url, reason: "unreadable-json", reference: url });
      }
    }
    return documents.get(url);
  };
  const edge = (from: string, to: string) => {
    if (!available.has(from) || !available.has(to)) {
      return;
    }
    const next = graph.get(from) ?? new Set<string>();
    next.add(to);
    graph.set(from, next);
  };
  const root = available.has(CORE) ? fields(read(CORE)) : undefined;
  const generated = generatedReferences({ available, normalize, read }, root);
  const galaxyPaths = fields(root?.galaxies);
  const manifests = new Map<string, string>();
  for (const galaxy of GALAXY_NUMBERS.map((id) => GALAXY_ID[id])) {
    const path = galaxyPaths?.[galaxy];
    const url = typeof path === "string" ? normalize(CORE, path) : undefined;
    if (url && available.has(url)) {
      manifests.set(galaxy, url);
      read(url);
    }
  }
  const boundaries = new Set(manifests.values());
  const assetRows = (value: unknown): Fields[] => {
    const assets = fields(value)?.assets;
    return Array.isArray(assets)
      ? assets.flatMap((asset) => {
          const row = fields(asset);
          return row ? [row] : [];
        })
      : [];
  };
  for (const url of [CORE, ...boundaries]) {
    for (const asset of assetRows(documents.get(url))) {
      if (typeof asset.id !== "string" || typeof asset.path !== "string") {
        continue;
      }
      const target = normalize(url, asset.path);
      if (target && available.has(target)) {
        const targets = ids.get(asset.id) ?? new Set<string>();
        targets.add(target);
        ids.set(asset.id, targets);
      }
    }
  }
  const reference = (from: string, path: JsonPath, value: string) => {
    const targets = ids.get(value);
    if (targets) {
      for (const to of targets) {
        edge(from, to);
      }
      return;
    }
    if (!FILE.test(value)) {
      return;
    }
    const url = normalize(from, value);
    if (!url) {
      failed.add(from);
      uncertain.push({ from, reason: "missing-url", reference: value });
      return;
    }
    if (/\{[^{}]+\}/.test(url)) {
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`^${escaped.replace(/\\\{[^{}]+\\\}/g, "[^/]+")}$`);
      for (const physical of available) {
        if (pattern.test(physical)) {
          edge(from, physical);
        }
      }
    } else if (available.has(url)) {
      edge(from, url);
    } else if (generated.bindings.get(location(from, path)) === value) {
      for (const dependency of generated.metadata) {
        if (dependency !== from) {
          edge(from, dependency);
        }
      }
    } else {
      failed.add(from);
      uncertain.push({
        from,
        reason: /^(?:\/|[a-z][a-z0-9+.-]*:)/i.test(value) ? "missing-url" : "relative-reference",
        reference: value,
      });
    }
  };
  const scan = (from: string, path: JsonPath, value: unknown, skipGalaxyMap = false): void => {
    if (typeof value === "string") {
      reference(from, path, value);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => scan(from, [...path, index], item));
    } else {
      const object = fields(value);
      if (object) {
        for (const [key, item] of Object.entries(object)) {
          if (!skipGalaxyMap || key !== "galaxies") {
            scan(from, [...path, key], item);
          }
        }
      }
    }
  };
  for (const url of available) {
    if (!/\.(?:json|webmanifest)$/.test(url)) {
      continue;
    }
    const value = read(url);
    scan(url, [], value, url === CORE);
    // These are the loader's canonical sidecar paths, not directory ownership rules.
    for (const asset of assetRows(value)) {
      const name = typeof asset.archetype === "string" ? asset.archetype : asset.craft;
      if (typeof name !== "string" || typeof asset.path !== "string") {
        continue;
      }
      for (const path of [enemyJetsPath, enemyHardpointsPath, enemyShardsPath]) {
        const to = normalize(url, path(name, { path: asset.path }));
        if (to && available.has(to)) {
          edge(url, to);
          const hull = normalize(url, asset.path);
          if (hull) {
            edge(hull, to);
          }
        }
      }
    }
  }
  const visit = (owner: string, start: string) => {
    const pending = [start];
    while (pending.length) {
      const url = pending.pop()!;
      if (!available.has(url)) {
        continue;
      }
      const claimed = owners.get(url) ?? new Set<string>();
      if (claimed.has(owner)) {
        continue;
      }
      claimed.add(owner);
      owners.set(url, claimed);
      // A shared source manifest is metadata. Its unrelated world's assets stay optional.
      if (owner === BASE && boundaries.has(url)) {
        continue;
      }
      pending.push(...(graph.get(url) ?? []));
    }
  };
  for (const [galaxy, url] of manifests) {
    visit(galaxy, url);
  }
  visit(BASE, CORE);
  // The public sound map identifies codecs, not per-galaxy ownership. Keep every variant.
  for (const url of Object.values(files.sounds).flat()) {
    visit(BASE, url);
  }
  // Only the published runtime selector can establish a cross-galaxy family dependency.
  for (const consumer of manifests.keys()) {
    for (const family of GALAXY_FAMILIES) {
      for (const archetype of family.wired) {
        const selected = galaxyFamily(consumer, archetype);
        const source = selected && manifests.get(selected.galaxy);
        if (!selected || selected.galaxy === consumer || !source) {
          continue;
        }
        visit(BASE, source);
        for (const asset of assetRows(documents.get(source))) {
          if (
            asset.family !== selected.family ||
            asset.archetype !== archetype ||
            typeof asset.path !== "string"
          ) {
            continue;
          }
          visit(BASE, normalize(source, asset.path) ?? "");
          for (const path of [enemyJetsPath, enemyHardpointsPath, enemyShardsPath]) {
            visit(BASE, normalize(source, path(archetype, { path: asset.path })) ?? "");
          }
        }
      }
    }
  }
  for (const url of available) {
    const claimed = owners.get(url);
    if (!claimed || claimed.size > 1 || failed.has(url)) {
      visit(BASE, url);
    }
  }
  const urls = Object.fromEntries(
    GALAXY_NUMBERS.map((id) => {
      const galaxy = GALAXY_ID[id];
      return [
        galaxy,
        [...available]
          .filter((url) => owners.get(url)?.size === 1 && owners.get(url)?.has(galaxy))
          .sort(),
      ];
    }),
  );
  return {
    edges: [...graph.keys()]
      .sort()
      .flatMap((from) => [...graph.get(from)!].sort().map((to) => ({ from, to }))),
    groups: { initial: galaxyDownloadGroups([]), urls } satisfies PrecacheGroups,
    uncertain: [
      ...new Map(
        uncertain.map((entry) => [
          JSON.stringify([entry.from, entry.reference, entry.reason]),
          entry,
        ]),
      ).entries(),
    ]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, entry]) => entry),
  };
}

/** Optional groups partition discovered physical URLs; everything unassigned is mandatory base. */
export function galaxyPrecacheGroups(context: Context, files: HashedFiles): PrecacheGroups {
  return partition(context, files).groups;
}

/** The same partition with deterministic physical reference edges and unresolved input facts. */
export function galaxyPrecacheGroupAudit(context: Context, files: HashedFiles): Audit {
  return partition(context, files);
}
