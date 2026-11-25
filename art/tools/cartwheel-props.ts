// Cartwheel's traveling debris: a wheel-rim segment tumbling through 8 frames. Writes its sheet
// and debris.json to public/art/cartwheel/, and its Cartwheel manifest entries and link. The ore
// nugget, the stranded craft and the tow line are friendly objects (art/tools/friendly.ts).
// Usage: node art/tools/cartwheel-props.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DISPLAY_SCALE } from "./crafts.ts";
import {
  bodyRamp,
  CONTOUR,
  debrisPaint,
  exportDebris,
  MARK_DASHES,
  MARK_WIDTH,
  rimSegment,
  TUMBLE_DEG_PER_SECOND,
  TUMBLE_FRAMES,
} from "./debris.ts";
import { writeDebrisFrames } from "./debris-sheets.ts";
import { linkData, mergeEntries } from "./manifest.ts";
import { json } from "./projection.ts";
import { prettify } from "./sprite-sheet.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const dir = `${art}cartwheel/`;
mkdirSync(dir, { recursive: true });

const palette = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const cartwheel = (
  JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
    galaxies: Record<
      string,
      { tint: { chroma: number; hue: number }; colors: Record<string, string> }
    >;
  }
).galaxies.cartwheel!;

// JSON goes through the project's Prettier settings so the files stay Prettier-clean.
async function writeJson(path: string, value: unknown): Promise<void> {
  writeFileSync(path, json(value));
  await prettify(path);
}

// ------------------------------------------------------------------ debris

const CORAL = palette.colors.obstacle!;
const BODY = bodyRamp(
  cartwheel.colors.environmentDetail!,
  cartwheel.tint.chroma,
  cartwheel.tint.hue,
);

// ------------------------------------------------------------------ main

const debrisSvg = new Map<string, string>();
const debris = exportDebris(
  dir,
  "/art/cartwheel/",
  CORAL,
  {
    id: "cartwheel-debris",
    title: "Cartwheel debris",
    mesh: rimSegment(debrisPaint(BODY)),
    scale: 0.8,
    frame: { width: 118, height: 115, top: 58 },
  },
  (file, svg) => debrisSvg.set(`${file}.svg`, svg),
);
await writeJson(`${dir}debris.json`, {
  version: 1,
  displayScale: DISPLAY_SCALE,
  body: BODY,
  contour: { color: CORAL, width: CONTOUR },
  tumble: { frames: TUMBLE_FRAMES, degPerSecond: TUMBLE_DEG_PER_SECOND },
  marks: { color: CORAL, width: MARK_WIDTH, dashes: MARK_DASHES },
  debris: [debris.data],
});

// The debris rows keep their places in Cartwheel's manifest.
mergeEntries(
  "cartwheel",
  (id) => /^cartwheel-debris-\d+$/.test(id),
  writeDebrisFrames("cartwheel", debris.entries, debrisSvg),
);
linkData("cartwheel", { cartwheelDebris: "/art/cartwheel/debris.json" });
