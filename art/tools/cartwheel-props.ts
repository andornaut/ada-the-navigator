// Cartwheel props: traveling debris (a wheel-rim segment tumbling through 8 frames), the ore
// nugget pickup, and the two stranded craft a tow job brings home (the ore pod and the stuck
// hauler) at sixteen headings, with the tow line spec. Writes SVGs, the nugget sheet and
// debris.json and tow.json to public/art/cartwheel/, and their core and Cartwheel manifest
// entries and links.
// Usage: node art/tools/cartwheel-props.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  hauler,
  HAULER_LEVELS,
  HAULER_TOW,
  orePod,
  POD_TOW,
  steelDarkSide,
} from "./cartwheel-craft.ts";
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
import { linkData, readManifest, replaceEntries } from "./manifest.ts";
import { stageRows } from "./polish-rows.ts";
import { json } from "./projection.ts";
import { ORE_PICKUP, PICKUP_SIZE } from "./resource-glyphs.ts";
import { traceGrid, withCollision } from "./silhouette.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";
import { type CraftSpec as StrandedSpec, exportStranded } from "./stranded.ts";

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

const DEG = Math.PI / 180;

const CRAFT: readonly StrandedSpec[] = [
  {
    id: "stranded-ore-pod",
    title: "Stranded ore pod",
    scale: 1.6,
    roll: 0,
    pitch: 0,
    levels: [11],
    tow: POD_TOW,
    frames: [
      { name: "a", build: () => orePod(true) },
      { name: "b", build: () => orePod(false) },
    ],
  },
  {
    // The tri-hull miner with its power off: dark glass, dim lights, no jets, listing to port, nose down.
    id: "stranded-hauler",
    title: "Stuck hauler",
    scale: 1,
    roll: -12 * DEG,
    pitch: -5 * DEG,
    levels: HAULER_LEVELS,
    tow: HAULER_TOW,
    frames: [{ name: "", build: (facing) => hauler({ powered: false }, facing) }],
  },
];
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
const installed = readManifest("cartwheel").assets;
const craft = CRAFT.map((spec) => exportStranded(installed, spec, dir, "/art/cartwheel/"));

await writeSprites(
  { data: `${dir}ore-nugget.json`, sheet: `${dir}ore-nugget.png` },
  { key: "ore-nugget" },
  [["rest", [ORE_PICKUP], 100]],
);
const nuggetData = `${dir}ore-nugget.json`;
// The frame's drawn silhouette, in frame px.
const nuggetText = withCollision(readFileSync(nuggetData, "utf8"), [
  traceGrid("ore-nugget", ORE_PICKUP).collision,
]);
writeFileSync(nuggetData, nuggetText);
await prettify(nuggetData);
const nugget = {
  id: "ore-nugget",
  path: "/art/cartwheel/ore-nugget.png",
  width: PICKUP_SIZE,
  height: PICKUP_SIZE,
  displayWidth: PICKUP_SIZE,
  displayHeight: PICKUP_SIZE,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  frameWidth: PICKUP_SIZE,
  frameHeight: PICKUP_SIZE,
  frames: { rest: 0 },
};

await writeJson(`${dir}debris.json`, {
  version: 1,
  displayScale: DISPLAY_SCALE,
  body: BODY,
  contour: { color: CORAL, width: CONTOUR },
  tumble: { frames: TUMBLE_FRAMES, degPerSecond: TUMBLE_DEG_PER_SECOND },
  marks: { color: CORAL, width: MARK_WIDTH, dashes: MARK_DASHES },
  debris: [debris.data],
});

// Tow line, logical px: a steel cable from Ada's pivot to the craft's tow point.
await writeJson(`${dir}tow.json`, {
  version: 1,
  displayScale: DISPLAY_SCALE,
  line: {
    layers: [
      { name: "outer", color: steelDarkSide.toUpperCase(), width: 2.5 },
      { name: "core", color: "#B8BFC9", width: 1.2 },
    ],
    beads: { color: steelDarkSide.toUpperCase(), radius: 0.9, spacing: 12, start: 6 },
    cap: [
      { color: steelDarkSide.toUpperCase(), radius: 1.8 },
      { color: "#B8BFC9", radius: 0.8 },
    ],
  },
  craft: craft.map(({ data }) => data),
});

// The staged tow line (art/cartwheel-props.md, Tow line): a wider cable and one clamp block at
// the craft end, with no beads and no cap. It replaces `line` whole.
stageRows("effects-tow", {
  file: "/art/cartwheel/tow.json",
  line: {
    layers: [
      { name: "outer", color: steelDarkSide.toUpperCase(), width: 3 },
      { name: "core", color: "#B8BFC9", width: 1.4 },
    ],
    // The light-field ink stroke under the cable.
    lightInk: 4.2,
    // A block at the tow point: `before` px along the line toward Ada to `after` px past the
    // point and `across` px wide, with a lit band `face.depth` px deep on its screen-upper edge.
    clamp: {
      color: steelDarkSide.toUpperCase(),
      before: 3.2,
      after: 2.6,
      across: 5.2,
      face: { color: "#B8BFC9", depth: 2.2 },
    },
  },
});

// The nugget and the tow line serve every galaxy's cargo and rescues, so they are core; the
// debris and stranded craft are Cartwheel's.
replaceEntries("core", (id) => id === "ore-nugget", [nugget]);
const owned =
  /^cartwheel-debris-\d+$|^craft-stranded-hauler-\d+$|^craft-stranded-ore-pod-\d+-[ab]$/;
replaceEntries("cartwheel", (id) => owned.test(id), [
  ...writeDebrisFrames("cartwheel", debris.entries, debrisSvg),
  ...craft.flatMap(({ entries }) => entries),
]);
linkData("core", { tow: "/art/cartwheel/tow.json" });
linkData("cartwheel", {
  cartwheelDebris: "/art/cartwheel/debris.json",
  tow: "/art/cartwheel/tow.json",
});
