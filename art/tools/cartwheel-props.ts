// Cartwheel props: traveling debris (a bent hull plate tumbling through 8 frames), the ore
// nugget pickup, and the two stranded craft a tow job brings home (the ore pod and the stuck
// hauler) at sixteen headings, with the tow line spec. Writes SVGs, the nugget sheet and
// debris.json and tow.json to public/art/cartwheel/, and their core and Cartwheel manifest
// entries and links.
// Usage: node art/tools/cartwheel-props.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";

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
  bentPlate,
  bodyRamp,
  CONTOUR,
  exportDebris,
  MARK_DASHES,
  MARK_WIDTH,
  TUMBLE_DEG_PER_SECOND,
  TUMBLE_FRAMES,
  unit,
} from "./debris.ts";
import { linkData, replaceEntries } from "./manifest.ts";
import { ORE_PALETTE, rimmed } from "./ore.ts";
import { json } from "./projection.ts";
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
const TUMBLE_AXIS = unit([0.4, 1, 0.6]);
const DEBRIS_SCALE = 1.25;
const BODY = bodyRamp(
  cartwheel.colors.environmentDetail!,
  cartwheel.tint.chroma,
  cartwheel.tint.hue,
);

// ------------------------------------------------------------------ ore nugget

// 11 by 11 ore nugget, pixel art: a chunky lumpy rock, lit from the upper left and pitted, in ore's
// palette (art/tools/ore.ts); its outline takes the rust rim.
const NUGGET = rimmed([
  "...........",
  "...LLM.....",
  "..LLMMMS...",
  ".LLMMSMMS..",
  ".LMMMMMMSD.",
  "..MSMMMSSD.",
  ".LMMMSMMSDD",
  ".MMMMMMSSDD",
  "..SMMSSSDD.",
  "...SDSDDD..",
  "....DD.....",
]);
const nuggetFrame = (rows: readonly string[]): Frame =>
  rows.map((row) => [...row].map((cell) => ORE_PALETTE[cell] ?? null));

// ------------------------------------------------------------------ main

const debris = exportDebris(dir, "/art/cartwheel/", BODY, CORAL, {
  id: "cartwheel-debris",
  title: "Cartwheel debris",
  solid: bentPlate(),
  axis: TUMBLE_AXIS,
  scale: DEBRIS_SCALE,
});
const craft = CRAFT.map((spec) => exportStranded(spec, dir, "/art/cartwheel/"));

await writeSprites(
  { data: `${dir}ore-nugget.json`, sheet: `${dir}ore-nugget.png` },
  { key: "ore-nugget" },
  [["rest", [nuggetFrame(NUGGET)], 100]],
);
const nuggetData = `${dir}ore-nugget.json`;
// The frame's drawn silhouette, in frame px.
const nuggetText = withCollision(readFileSync(nuggetData, "utf8"), [
  traceGrid("ore-nugget", nuggetFrame(NUGGET)).collision,
]);
writeFileSync(nuggetData, nuggetText);
await prettify(nuggetData);
const nugget = {
  id: "ore-nugget",
  path: "/art/cartwheel/ore-nugget.png",
  width: 11,
  height: 11,
  displayWidth: 11,
  displayHeight: 11,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  frameWidth: 11,
  frameHeight: 11,
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

// The nugget and the tow line serve every galaxy's cargo and rescues, so they are core; the
// debris and stranded craft are Cartwheel's.
replaceEntries("core", (id) => id === "ore-nugget", [nugget]);
const owned =
  /^cartwheel-debris-\d+$|^craft-stranded-hauler-\d+$|^craft-stranded-ore-pod-\d+-[ab]$/;
replaceEntries("cartwheel", (id) => owned.test(id), [
  ...debris.entries,
  ...craft.flatMap(({ entries }) => entries),
]);
linkData("core", { tow: "/art/cartwheel/tow.json" });
linkData("cartwheel", {
  cartwheelDebris: "/art/cartwheel/debris.json",
  tow: "/art/cartwheel/tow.json",
});
