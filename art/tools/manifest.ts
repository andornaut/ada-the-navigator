import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { json } from "./projection.ts";

// The galaxies with art, by their stable galaxy id. Each galaxy's manifest holds the entries and
// data links that only that galaxy uses; the core manifest holds the rest and maps each galaxy id
// to its galaxy's manifest under `galaxies`. Route order is the game's, not the manifest's. A
// placeholder galaxy's manifest holds only its placeholder backdrop until its art is built.
export const GALAXIES = [
  "sunflower",
  "cartwheel",
  "whirlpool",
  "andromeda",
  "needle",
  "phantom",
] as const;

export type ManifestFile = "core" | (typeof GALAXIES)[number];

interface Manifest {
  assets: { id: string }[];
  [key: string]: unknown;
}

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const FILES: readonly ManifestFile[] = ["core", ...GALAXIES];

/** A manifest's public path. */
export function manifestUrl(file: ManifestFile): string {
  return file === "core" ? "/art/manifest.json" : `/art/${file}/manifest.json`;
}

const filePath = (file: ManifestFile) => `${art}${manifestUrl(file).slice("/art/".length)}`;

function read(file: ManifestFile): string {
  const path = filePath(file);
  if (!existsSync(path)) {
    throw new Error(`${manifestUrl(file)} is missing`);
  }
  return readFileSync(path, "utf8");
}

export function readManifest(file: ManifestFile): Manifest {
  return JSON.parse(read(file)) as Manifest;
}

// The core map names every galaxy's manifest, and no id is in two manifests.
function check(manifests: ReadonlyMap<ManifestFile, Manifest>) {
  const map = (manifests.get("core")!.galaxies ?? {}) as Record<string, unknown>;
  for (const galaxy of GALAXIES) {
    if (map[galaxy] !== manifestUrl(galaxy)) {
      throw new Error(`core manifest galaxies.${galaxy} must be ${manifestUrl(galaxy)}`);
    }
  }
  const known: readonly string[] = GALAXIES;
  const extra = Object.keys(map).filter((galaxy) => !known.includes(galaxy));
  if (extra.length > 0) {
    throw new Error(`core manifest galaxies has unknown galaxies ${extra.join(", ")}`);
  }
  const seen = new Map<string, ManifestFile>();
  for (const [file, { assets }] of manifests) {
    for (const { id } of assets) {
      const other = seen.get(id);
      if (other !== undefined) {
        throw new Error(`${id} is in both ${manifestUrl(other)} and ${manifestUrl(file)}`);
      }
      seen.set(id, file);
    }
  }
}

// Applies `edit` to one manifest, checks the whole set and writes that file only when its text
// changes, so reruns leave every manifest byte-identical.
export function editManifest(file: ManifestFile, edit: (manifest: Manifest) => void) {
  const text = read(file);
  const manifests = new Map(FILES.map((name) => [name, readManifest(name)]));
  edit(manifests.get(file)!);
  check(manifests);
  const next = json(manifests.get(file));
  if (next !== text) {
    writeFileSync(filePath(file), next);
  }
}

// Manifest groups after the ship and portraits, in order. A generator replaces its own group
// in place, so each group stays contiguous and independent of the others.
const GROUPS = [
  "aboard",
  "route-",
  "holodisk",
  "quantum-jump",
  "stardust",
  "station-",
  "enemy-",
  "whale-",
  "whirlpool-",
] as const;

export function placeEntries(
  file: ManifestFile,
  group: (typeof GROUPS)[number],
  entries: readonly { id: string }[],
) {
  editManifest(file, (manifest) => {
    const kept = manifest.assets.filter(({ id }) => !id.startsWith(group));
    const later = GROUPS.slice(GROUPS.indexOf(group) + 1);
    const next = kept.findIndex(({ id }) => later.some((prefix) => id.startsWith(prefix)));
    const at = next === -1 ? kept.length : next;
    manifest.assets = [...kept.slice(0, at), ...entries, ...kept.slice(at)];
  });
}

// Replaces the entries `owns` selects at the position of the first of them. Without any, they
// go before the first other entry `placeBefore` selects, or last. Generators sharing a group
// (`enemy-`, `craft-`) keep their own entries in place.
export function replaceEntries(
  file: ManifestFile,
  owns: (id: string) => boolean,
  entries: readonly { id: string }[],
  placeBefore: (id: string) => boolean = () => false,
) {
  editManifest(file, (manifest) => {
    const first = manifest.assets.findIndex(({ id }) => owns(id));
    const next = manifest.assets.findIndex(({ id }) => !owns(id) && placeBefore(id));
    const at = first !== -1 ? first : next !== -1 ? next : manifest.assets.length;
    const before = manifest.assets.slice(0, at);
    const after = manifest.assets.slice(at).filter(({ id }) => !owns(id));
    manifest.assets = [...before, ...entries, ...after];
  });
}

// Like replaceEntries, but each owned entry the generator still writes keeps its position, so
// generators whose entries interleave with another's (the enemy families) rerun byte-identically.
// Owned entries it no longer writes are dropped; a new entry goes after the one written before
// it, else where replaceEntries would put the group. Every written id must be owned.
export function mergeEntries(
  file: ManifestFile,
  owns: (id: string) => boolean,
  entries: readonly { id: string }[],
  placeBefore: (id: string) => boolean = () => false,
) {
  const unowned = entries.filter(({ id }) => !owns(id)).map(({ id }) => id);
  if (unowned.length > 0) {
    throw new Error(`${manifestUrl(file)}: ${unowned.join(", ")} not owned by its generator`);
  }
  const written = new Map(entries.map((entry) => [entry.id, entry]));
  editManifest(file, (manifest) => {
    const first = manifest.assets.findIndex(({ id }) => owns(id));
    const assets = manifest.assets
      .filter(({ id }) => !owns(id) || written.has(id))
      .map((entry) => written.get(entry.id) ?? entry);
    const next = assets.findIndex(({ id }) => !owns(id) && placeBefore(id));
    let at = first !== -1 ? first : next !== -1 ? next : assets.length;
    for (const entry of entries) {
      const index = assets.findIndex(({ id }) => id === entry.id);
      if (index === -1) {
        assets.splice(at, 0, entry);
        at += 1;
      } else {
        at = index + 1;
      }
    }
    manifest.assets = assets;
  });
}

// Selects the ids of the named crafts under `prefix`: `{prefix}{name}` and `{prefix}{name}-...`,
// so `enemy-claim-retaliator-` never selects `enemy-claim-retaliatorCargoHauler-`.
export const craftIds =
  (prefix: string, names: readonly string[]) =>
  (id: string): boolean =>
    names.some((name) => id === prefix + name || id.startsWith(`${prefix}${name}-`));

// Links data files from a manifest by key, after its existing links.
export function linkData(file: ManifestFile, links: Readonly<Record<string, string>>) {
  editManifest(file, (manifest) => Object.assign(manifest, links));
}

// The data files a craft's frames use, by kind. The loader reads them from each manifest's
// `sidecars` map, keyed by craft (the enemy frame key or the story craft name).
export const SIDECAR_KINDS = ["jets", "hardpoints", "shards"] as const;
export type SidecarKind = (typeof SIDECAR_KINDS)[number];
export type Sidecars = Record<string, Partial<Record<SidecarKind, string>>>;

const SIDECAR_FILE = /^([a-zA-Z0-9]+)-(jets|hardpoints|shards)\.json$/;

/** The sidecars among `files` (file names written to the public folder `dir`). */
export function sidecarsIn(dir: string, files: Iterable<string>): Sidecars {
  const sidecars: Sidecars = {};
  for (const file of files) {
    const match = SIDECAR_FILE.exec(file);
    if (match) {
      (sidecars[match[1]!] ??= {})[match[2] as SidecarKind] = `${dir}${file}`;
    }
  }
  return sidecars;
}

// Sets the sidecar paths `owns` selects by craft and kind and keeps every other one, so each
// generator updates only its own. Owned paths it no longer writes are dropped. Crafts sort by
// name and kinds follow SIDECAR_KINDS, so the map is the same whichever generator ran last.
// Every written path must be owned and exist.
export function mergeSidecars(
  file: ManifestFile,
  owns: (craft: string, kind: SidecarKind) => boolean,
  sidecars: Readonly<Sidecars>,
) {
  const written = Object.entries(sidecars).flatMap(([craft, kinds]) =>
    Object.entries(kinds).map(([kind, path]) => ({ craft, kind: kind as SidecarKind, path })),
  );
  const unowned = written.filter(({ craft, kind }) => !owns(craft, kind));
  if (unowned.length > 0) {
    const names = unowned.map(({ craft, kind }) => `${craft}.${kind}`);
    throw new Error(
      `${manifestUrl(file)}: sidecars ${names.join(", ")} not owned by its generator`,
    );
  }
  const missing = written.filter(({ path }) => !existsSync(`${art}${path.slice("/art/".length)}`));
  if (missing.length > 0) {
    throw new Error(`${manifestUrl(file)}: ${missing.map(({ path }) => path).join(", ")} missing`);
  }
  editManifest(file, (manifest) => {
    const merged: Sidecars = {};
    const kept = Object.entries((manifest.sidecars ?? {}) as Sidecars);
    for (const [craft, kinds] of kept) {
      for (const [kind, path] of Object.entries(kinds) as [SidecarKind, string][]) {
        if (!owns(craft, kind)) {
          (merged[craft] ??= {})[kind] = path;
        }
      }
    }
    for (const { craft, kind, path } of written) {
      (merged[craft] ??= {})[kind] = path;
    }
    const crafts = Object.keys(merged).sort();
    if (crafts.length === 0) {
      delete manifest.sidecars;
      return;
    }
    manifest.sidecars = Object.fromEntries(
      crafts.map((craft) => [
        craft,
        Object.fromEntries(
          SIDECAR_KINDS.flatMap((kind) =>
            merged[craft]![kind] ? [[kind, merged[craft]![kind]]] : [],
          ),
        ),
      ]),
    );
  });
}
