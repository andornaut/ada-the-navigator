import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { json } from "./projection.ts";

const path = fileURLToPath(new URL("../../public/art/manifest.json", import.meta.url));

// Root manifest groups after the ship and portraits, in order. A generator replaces its own
// group in place, so each group stays contiguous and independent of the others.
const GROUPS = [
  "cockpit",
  "holodisk",
  "quantum-jump",
  "stardust",
  "station-",
  "enemy-",
  "whale-",
  "whirlpool-",
] as const;

export function placeEntries(group: (typeof GROUPS)[number], entries: readonly { id: string }[]) {
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { assets: { id: string }[] };
  const kept = manifest.assets.filter(({ id }) => !id.startsWith(group));
  const later = GROUPS.slice(GROUPS.indexOf(group) + 1);
  const next = kept.findIndex(({ id }) => later.some((prefix) => id.startsWith(prefix)));
  const at = next === -1 ? kept.length : next;
  manifest.assets = [...kept.slice(0, at), ...entries, ...kept.slice(at)];
  writeFileSync(path, json(manifest));
}

// Replaces the entries `owns` selects at the position of the first of them. Without any, they
// go before the first other entry `placeBefore` selects, or last. Generators sharing a group
// (`enemy-`, `outpost-`) keep their own entries in place.
export function replaceEntries(
  owns: (id: string) => boolean,
  entries: readonly { id: string }[],
  placeBefore: (id: string) => boolean = () => false,
) {
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { assets: { id: string }[] };
  const first = manifest.assets.findIndex(({ id }) => owns(id));
  const next = manifest.assets.findIndex(({ id }) => !owns(id) && placeBefore(id));
  const at = first !== -1 ? first : next !== -1 ? next : manifest.assets.length;
  const before = manifest.assets.slice(0, at);
  const after = manifest.assets.slice(at).filter(({ id }) => !owns(id));
  manifest.assets = [...before, ...entries, ...after];
  writeFileSync(path, json(manifest));
}

// Links data files from the root manifest by key, after the existing links. Rewrites the
// manifest only when a link is missing or differs, so reruns leave it byte-identical.
export function linkData(links: Readonly<Record<string, string>>) {
  const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  if (Object.entries(links).some(([key, url]) => manifest[key] !== url)) {
    writeFileSync(path, json({ ...manifest, ...links }));
  }
}
