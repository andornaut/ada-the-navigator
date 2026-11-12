import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import { JOB_GLYPHS } from "./job-glyphs.ts";
import { json } from "./projection.ts";

// The job board's row icons (art/shop-icons.md "Job icons"): one icon-job-<type> sheet per job
// type, cream for offers and the held job, the disabled text colour for busy rows. The same grids
// are the Map's job glyphs (art/tools/map-icons.ts).
const CREAM = "ead4aa";
const DISABLED = "9a96ad";
const ui = fileURLToPath(new URL("../../public/art/ui/", import.meta.url));

interface Sprite {
  readonly json: string;
  readonly key: string;
  readonly once: readonly string[];
  readonly png: string;
}

function frame(rows: readonly string[], colour: string): Frame {
  return rows.map((row) => [...row].map((cell) => (cell === "#" ? colour : null)));
}

// Written JSON goes through the project's Prettier settings so the files stay Prettier-clean.
async function prettify(file: string): Promise<void> {
  const options = await resolveConfig(file);
  writeFileSync(file, await format(readFileSync(file, "utf8"), { ...options, filepath: file }));
}

const keys: string[] = [];
for (const [type, rows] of Object.entries(JOB_GLYPHS)) {
  if (rows.length !== 20 || rows.some((row) => row.length !== 20 || /[^#.]/.test(row))) {
    throw new Error(`${type}: the glyph must be 20 rows of 20 "#" or "." cells`);
  }
  const key = `icon-job-${type}`;
  await writeSpriteSheet(
    { data: `${ui}sprites/${key}.json`, sheet: `${ui}sprites/${key}.png` },
    { key },
    [
      ["normal", [frame(rows, CREAM)], 100],
      ["disabled", [frame(rows, DISABLED)], 100],
    ],
  );
  await prettify(`${ui}sprites/${key}.json`);
  keys.push(key);
}

// Register the sheets in the UI subset manifest, sorted by key.
const manifestPath = `${ui}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { sprites: Sprite[] };
const owned = new Set(keys);
manifest.sprites = [
  ...manifest.sprites.filter(({ key }) => !owned.has(key)),
  ...keys.map((key) => ({ key, png: `sprites/${key}.png`, json: `sprites/${key}.json`, once: [] })),
].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
writeFileSync(manifestPath, json(manifest));
await prettify(manifestPath);
