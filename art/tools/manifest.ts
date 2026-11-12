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

// Links data files from a manifest by key, after its existing links.
export function linkData(file: ManifestFile, links: Readonly<Record<string, string>>) {
  editManifest(file, (manifest) => Object.assign(manifest, links));
}
