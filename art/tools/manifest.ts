import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { json } from "./projection.ts";

const path = fileURLToPath(new URL("../../public/art/manifest.json", import.meta.url));

// Root manifest groups after the ship and portraits, in order. A generator replaces its own
// group in place, so each group stays contiguous and independent of the others.
const GROUPS = ["cockpit", "holodisk", "quantum-jump", "stardust", "station-", "enemy-"] as const;

export function placeEntries(group: (typeof GROUPS)[number], entries: readonly { id: string }[]) {
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { assets: { id: string }[] };
  const kept = manifest.assets.filter(({ id }) => !id.startsWith(group));
  const later = GROUPS.slice(GROUPS.indexOf(group) + 1);
  const next = kept.findIndex(({ id }) => later.some((prefix) => id.startsWith(prefix)));
  const at = next === -1 ? kept.length : next;
  manifest.assets = [...kept.slice(0, at), ...entries, ...kept.slice(at)];
  writeFileSync(path, json(manifest));
}
