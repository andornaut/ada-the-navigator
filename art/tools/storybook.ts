// Environment-only storybook dioramas and overnight rock-glow overlays on the shared
// 960 by 540 logical canvas at 2x. Characters use the established story-panel portraits.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { blankImage } from "@andornaut/art-kit/rgbaImage";

import {
  box,
  type Canvas,
  type Decal,
  DESIGN,
  type Face,
  frustum,
  gable,
  octagon,
  onX,
  onY,
  onZ,
  type Point,
  prism,
  R3,
  render,
  rgb,
  type RgbaImage,
  Scene,
  slab,
  TREATMENT,
  treatmentD,
} from "./diorama.ts";
import { editManifest, readManifest } from "./manifest.ts";
import { fromOklab, hex, toOklab } from "./oklab.ts";
import { writePng } from "./paint.ts";
import { json } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

export const CANVAS: Canvas = { width: 960, height: 540, density: 2 };

type Palette = Readonly<Record<string, string>> & { back: readonly [string, string] };
type Builder = (P: Palette) => Scene;

const W = DESIGN.width;

// Scale and pivot so a room spans the frame width with its back corner's wall top near the top.
function fitted(nx: number, ny: number, wall: number, topY = 12): Scene {
  const k = (W - 120) / ((nx + ny) * R3);
  return new Scene(k, [W / 2 - ((nx - ny) * R3 * k) / 2, topY + wall * k]);
}

// A 24-unit square lot centred under the frame top.
const island = () => new Scene(14.5, [W / 2, 30]);

const flat = (points: readonly Point[], z: number): Face =>
  points.map(([x, y]): Point => [x, y, z]);

function tree(s: Scene, P: Palette, x: number, y: number, h = 3.2, r = 2.2) {
  const key = x + y;
  s.solid(box(x - 0.35, x + 0.35, y - 0.35, y + 0.35, 0, h), P.trunk!, 2, key);
  s.solid(frustum(x, y, r, r * 1.08, 8, h - 0.4, h + 1.4, 0.39), P.crown!, 2, key + 0.2);
  s.solid(frustum(x, y, r * 1.08, r * 0.55, 8, h + 1.4, h + 2.8, 0.39), P.crown!, 2, key + 0.3);
}

/* Grandma's house and garden */

const GARDEN: Palette = {
  back: ["#bfe0e8", "#d9ecd6"],
  grass: "#86c46f",
  earth: "#9b6b45",
  wall: "#f0d7a8",
  roof: "#d06a55",
  door: "#8a5a3c",
  glass: "#8ec9e6",
  frame: "#fbf3e2",
  fence: "#f3ecdc",
  bed: "#b07a4c",
  soil: "#7a5236",
  plant: "#5fae55",
  bloom1: "#ef7f8f",
  bloom2: "#f6c85a",
  bloom3: "#a98ad8",
  crown: "#6fb85e",
  trunk: "#8a5f3e",
  path: "#e2cfa4",
  can: "#7fa7d9",
  chimney: "#b85a48",
  // Andromeda's potting table, the seedling tray and its pots, the spill and the trowel.
  bench: "#cfa77a",
  tray: "#4f6a5a",
  pot: "#d9825b",
  potsoil: "#6a4630",
  spill: "#6e4a30",
  sprout: "#7cc95a",
  sackbag: "#c9a978",
  trowel: "#9aa6b4",
  handle: "#b8553f",
};

// Andromeda's seedling tray on the potting table by the house: spilled (the opening and the
// resolution) or replanted (the closing).
type TrayState = "spilled" | "replanted";

const POTS_X = [7.6, 8.56, 9.52, 10.48];
const POTS_Y = [9.15, 10.1];
const TABLE = { x0: 6.8, x1: 11.05, y0: 8.35, y1: 11.2, z: 2.3 };

// A seedling: a short stem and a two-lobed crown of leaves.
function seedling(s: Scene, P: Palette, [x, y, z]: Point, key: number, h = 0.5) {
  s.solid(prism(x, y, 0.06, 5, z, z + h * 0.8), P.sprout!, 2, key);
  s.solid(
    lump([x - 0.14, y + 0.14], [0.25, 0.14], z + h * 0.68, z + h, 0.6, -0.78),
    P.sprout!,
    2,
    key + 0.001,
  );
  s.solid(
    lump([x + 0.14, y - 0.14], [0.25, 0.14], z + h * 0.72, z + h * 1.04, 0.6, -0.78),
    P.sprout!,
    2,
    key + 0.002,
  );
}

// A seedling knocked flat: stem and leaves lying on a surface at z, pointing along (dx, dy).
function fallen(
  s: Scene,
  P: Palette,
  [x, y, z]: Point,
  [dx, dy]: readonly [number, number],
  key: number,
) {
  s.solid(
    rod([x, y, z + 0.05], [x + dx * 0.4, y + dy * 0.4, z + 0.05], 0.045, 5),
    P.sprout!,
    2,
    key,
  );
  s.solid(
    lump([x + dx * 0.55, y + dy * 0.55], [0.3, 0.18], z, z + 0.14, 0.7, Math.atan2(dy, dx)),
    P.sprout!,
    2,
    key + 0.001,
  );
  // A clump of soil still on the roots.
  s.solid(lump([x, y], [0.2, 0.16], z, z + 0.16, 0.6), P.potsoil!, 2, key + 0.002);
}

function pottingTable(s: Scene, P: Palette, state: TrayState) {
  const { x0, x1, y0, y1, z } = TABLE;
  const base = 19;
  // Legs, a low shelf, then the top.
  for (const [lx, ly] of [
    [x0 + 0.15, y0 + 0.15],
    [x1 - 0.45, y0 + 0.15],
    [x0 + 0.15, y1 - 0.45],
    [x1 - 0.45, y1 - 0.45],
  ] as const) {
    s.solid(
      box(lx, lx + 0.3, ly, ly + 0.3, 0, z - 0.22),
      P.bench!,
      2,
      base + (lx - x0) * 0.01 + (ly - y0) * 0.01,
    );
  }
  s.solid(box(x0 + 0.3, x1 - 0.3, y0 + 0.3, y1 - 0.3, 0.5, 0.68), P.bench!, 2, base + 0.05);
  const top: Decal[] = [];
  if (state === "spilled") {
    // Loose soil across the table top in front of the tray, where the elbow swept it.
    for (const [cx, cy, r, sy, rot] of [
      [8.1, 10.95, 0.55, 0.42, 0.1],
      [9.3, 10.98, 0.42, 0.38, 0.5],
      [10.5, 10.7, 0.45, 0.6, 0.2],
      [7.15, 10.7, 0.3, 0.7, 0.9],
      [10.8, 8.75, 0.28, 0.8, 0.3],
    ] as const) {
      top.push([flat(octagon(cx, cy, r, 0, 9, rot, sy), z + 0.001), P.spill!]);
    }
  }
  s.solid(box(x0, x1, y0, y1, z - 0.22, z), P.bench!, 2, base + 0.1, top);
  // The tray: a shallow green tray with eight terracotta pots.
  const tz = z + 0.2;
  s.solid(box(7.05, 11.0 - 0.07, 8.62, 10.62, z, tz), P.tray!, 2, base + 0.2);
  const jitter: Record<string, readonly [number, number]> =
    state === "spilled"
      ? {
          "0,1": [0.08, 0.06],
          "1,1": [-0.06, 0.1],
          "2,0": [0.08, -0.04],
          "3,1": [0.05, 0.1],
          "2,1": [-0.05, 0.04],
        }
      : {};
  // After the spill the front row lost soil and three seedlings, which lie on the table and the
  // grass; the pots are pushed back into the tray a little crooked.
  const empty = state === "spilled" ? new Set(["1,1", "2,1", "3,1"]) : new Set<string>();
  const low = state === "spilled" ? new Set(["0,1", "1,1", "2,1", "3,1"]) : new Set<string>();
  for (const [j, py] of POTS_Y.entries()) {
    for (const [i, px] of POTS_X.entries()) {
      const id = `${i},${j}`;
      const [jx, jy] = jitter[id] ?? [0, 0];
      const [cx, cy] = [px + jx, py + jy];
      const key = base + 0.3 + j * 0.1 + i * 0.01;
      const rim = tz + 0.62;
      s.solid(frustum(cx, cy, 0.33, 0.43, 8, tz, rim, 0.2), P.pot!, 2, key, [
        [flat(octagon(cx, cy, 0.36, 0, 8, 0.2), rim + 0.001), low.has(id) ? "#b86a48" : P.potsoil!],
        ...(low.has(id)
          ? [[flat(octagon(cx, cy, 0.26, 0, 8, 0.2), rim + 0.002), P.potsoil!] as Decal]
          : []),
      ]);
      if (!empty.has(id)) {
        const lean = state === "spilled" && j === 1 ? 0.14 : 0;
        seedling(s, P, [cx + lean, cy + lean, rim], key + 0.005, state === "replanted" ? 0.8 : 0.7);
      }
    }
  }
  if (state === "spilled") {
    // Heaps of soil on the table edge, two seedlings knocked onto the table, one onto the grass,
    // and soil scattered on the grass below.
    s.solid(lump([8.1, 10.95], [0.38, 0.22], z, z + 0.16, 0.5), P.spill!, 2, base + 0.55);
    s.solid(lump([10.5, 10.75], [0.3, 0.22], z, z + 0.13, 0.5), P.spill!, 2, base + 0.56);
    fallen(s, P, [8.9, 10.95, z], [0.85, 0.5], base + 0.6);
    fallen(s, P, [10.0, 10.9, z], [0.9, -0.4], base + 0.61);
    for (const [cx, cy, r, sy, rot] of [
      [9.3, 11.95, 0.95, 0.5, 0.25],
      [10.7, 11.7, 0.5, 0.6, 0.1],
      [7.9, 11.75, 0.45, 0.55, 0.5],
      [8.7, 12.6, 0.22, 0.8, 0.0],
      [10.1, 12.55, 0.18, 0.8, 0.0],
    ] as const) {
      s.solid([flat(octagon(cx, cy, r, 0, 9, rot, sy), 0.002)], P.spill!, 1, 2.1 + cx * 0.001);
    }
    fallen(s, P, [9.4, 12.05, 0], [0.7, 0.7], 22.6);
  } else {
    // Replanted: the trowel on the table, the potting-soil sack beside it.
    s.solid(box(9.4, 10.35, 10.82, 11.06, z, z + 0.06), P.trowel!, 2, base + 0.62);
    s.solid(box(10.35, 10.95, 10.86, 11.02, z, z + 0.11), P.handle!, 2, base + 0.63);
    s.solid(lump([7.9, 12.05], [0.7, 0.5], 0, 1.35, 0.82, 0.2), P.sackbag!, 2, 22.0);
    s.solid(lump([7.9, 12.05], [0.58, 0.41], 1.35, 1.6, 0.6, 0.2), P.sackbag!, 2, 22.01, [
      [flat(octagon(7.9, 12.05, 0.14, 0, 8, 0.3), 1.601), P.potsoil!],
    ]);
  }
}

// The house sits at the left corner and the beds beside it toward the right, so the beds' rows
// (the scene's subject) fit the strip above the story panel.
function garden(P: Palette, tray?: TrayState): Scene {
  const n = 24;
  const s = island();
  s.solid(box(0, n, 0, n, -1.4, 0), P.earth!, 0, 0);
  s.solid([onZ(0, 0, n, 0, n)], P.grass!, 0, 1, [
    [onZ(0.001, 8.5, 12.5, 15.8, 17.2), P.path!],
    [onZ(0.001, 11.1, 12.5, 9.0, 15.8), P.path!],
  ]);
  s.solid(box(1.5, 8.5, 13, 20, 0, 6), P.wall!, 2, 22, [
    [onX(8.501, 15.4, 17.6, 0, 3.6), P.frame!],
    [onX(8.502, 15.6, 17.4, 0, 3.4), P.door!],
    [onX(8.501, 13.6, 15.0, 2.0, 4.2), P.frame!],
    [onX(8.502, 13.8, 14.8, 2.2, 4.0), P.glass!],
    [onY(20.001, 3.0, 6.0, 2.0, 4.2), P.frame!],
    [onY(20.002, 3.2, 5.8, 2.2, 4.0), P.glass!],
  ]);
  s.solid(gable(1.0, 9.0, 12.5, 20.5, 6, 9.4), P.roof!, 2, 22.5);
  s.solid(box(3.0, 4.0, 14.5, 15.5, 7.0, 10.4), P.chimney!, 2, 22.2);
  for (let i = 0; i < 15; i++) {
    const x = 6 + i * 1.2;
    s.solid(box(x, x + 0.3, 0.2, 0.5, 0, 2.0), P.fence!, 2, x + 0.5);
  }
  s.solid(box(6, n - 0.2, 0.25, 0.42, 0.7, 0.95), P.fence!, 2, 6.2);
  s.solid(box(6, n - 0.2, 0.25, 0.42, 1.45, 1.7), P.fence!, 2, 6.3);
  for (let i = 0; i < 6; i++) {
    const y = 6 + i * 1.2;
    s.solid(box(0.2, 0.5, y, y + 0.3, 0, 2.0), P.fence!, 2, y + 0.5);
  }
  s.solid(box(0.25, 0.42, 6, 12.6, 0.7, 0.95), P.fence!, 2, 6.2);
  s.solid(box(0.25, 0.42, 6, 12.6, 1.45, 1.7), P.fence!, 2, 6.3);
  for (const y0 of [3.6, 6.6]) {
    s.solid(box(11.3, 16.1, y0, y0 + 2.2, 0, 0.8), P.bed!, 2, 11.3 + y0, [
      [onZ(0.801, 11.55, 15.85, y0 + 0.25, y0 + 1.95), P.soil!],
    ]);
    for (let i = 0; i < 4; i++) {
      const x = 12.2 + i * 1.2;
      const key = x + y0 + 1.5;
      s.solid(frustum(x, y0 + 1.1, 0.55, 0.35, 6, 0.8, 1.9), P.plant!, 2, key);
      s.solid(prism(x, y0 + 1.1, 0.28, 6, 1.9, 2.15), P[`bloom${(i % 3) + 1}`]!, 2, key + 0.1);
    }
  }
  s.solid(box(5.0, 5.7, 5.0, 5.7, 0, 3.2), P.trunk!, 2, 8);
  s.solid(frustum(5.35, 5.35, 2.2, 2.4, 8, 2.8, 4.6, 0.39), P.crown!, 2, 8.2);
  s.solid(frustum(5.35, 5.35, 2.4, 1.2, 8, 4.6, 6.0, 0.39), P.crown!, 2, 8.3);
  s.solid(box(10.3, 11.1, 6.0, 6.7, 0, 0.8), P.can!, 2, 17);
  if (tray) pottingTable(s, P, tray);
  return s;
}

/* Community garden lot */

const LOT: Palette = {
  back: ["#d3dfe6", "#dfe6dc"],
  earth: "#9c7350",
  ground: "#cfae82",
  patch: "#a9c98b",
  post: "#a3adbb",
  wire: "#bac2cd",
  bed: "#b07a4c",
  soil: "#7d5a3e",
  sprout: "#7fbf62",
  shed: "#b49ad6",
  shedroof: "#9b80c4",
  shedtrim: "#ece4f4",
  bin: "#6f9a7a",
  bag: "#a8825a",
  can: "#7fa7d9",
  weed: "#93bd76",
};

function lot(P: Palette): Scene {
  const n = 24;
  const s = island();
  s.solid(box(0, n, 0, n, -1.4, 0), P.earth!, 0, 0);
  const patches = [
    [3, 4, 1.6],
    [12, 15, 2.0],
    [19, 9, 1.4],
    [6, 19, 1.8],
    [16, 2.5, 1.2],
  ].map(([cx, cy, r]): Decal => [flat(octagon(cx!, cy!, r!, 0, 8, 0.39, 0.7), 0.001), P.patch!]);
  s.solid([onZ(0, 0, n, 0, n)], P.ground!, 0, 1, patches);
  // Chain-link fence on both back edges: posts, top rail and two wires.
  for (let x = 2; x < n; x += 2) s.solid(box(x, x + 0.22, 0.2, 0.42, 0, 2.6), P.post!, 2, x + 0.5);
  for (let y = 2; y < n; y += 2) s.solid(box(0.2, 0.42, y, y + 0.22, 0, 2.6), P.post!, 2, y + 0.5);
  for (const z of [2.45, 1.6, 0.8]) {
    const colour = z > 2 ? P.post! : P.wire!;
    s.solid(box(0.3, n, 0.27, 0.35, z, z + 0.12), colour, 2, 0.6);
    s.solid(box(0.27, 0.35, 0.3, n, z, z + 0.12), colour, 2, 0.6);
  }
  s.solid(box(1.2, 5.2, 9.5, 14.5, 0, 4.0), P.shed!, 2, 16, [
    [onX(5.201, 11.0, 13.0, 0, 3.2), P.shedroof!],
    [onX(5.202, 11.2, 12.8, 2.2, 2.9), P.shedtrim!],
  ]);
  s.solid(gable(0.9, 5.5, 9.2, 14.8, 4.0, 5.6), P.shedroof!, 2, 16.5);
  // Raised beds: one sprouting, two still empty.
  for (const [x0, y0, sprouts] of [
    [8, 3, true],
    [8, 7, false],
    [15, 4.5, false],
  ] as const) {
    s.solid(box(x0, x0 + 6, y0, y0 + 2.2, 0, 0.8), P.bed!, 2, x0 + y0 + 4, [
      [onZ(0.801, x0 + 0.25, x0 + 5.75, y0 + 0.25, y0 + 1.95), P.soil!],
    ]);
    if (!sprouts) continue;
    for (let j = 0; j < 5; j++) {
      const x = x0 + 0.9 + j * 1.1;
      s.solid(frustum(x, y0 + 1.1, 0.25, 0.12, 5, 0.8, 1.4), P.sprout!, 2, x0 + y0 + 5 + j * 0.01);
    }
  }
  s.solid(box(17.5, 19.5, 10.5, 12.5, 0, 2.0), P.bin!, 2, 30);
  s.solid(box(13.5, 15.0, 11.0, 12.0, 0, 0.7), P.bag!, 2, 26);
  s.solid(box(13.0, 13.8, 9.6, 10.3, 0, 0.8), P.can!, 2, 23);
  for (const [cx, cy] of [
    [6.5, 3.5],
    [21, 7.5],
    [10.5, 13.5],
    [4.2, 17.5],
  ] as const) {
    for (const dx of [-0.4, 0, 0.4]) {
      s.solid(frustum(cx + dx, cy, 0.22, 0.05, 5, 0, 0.9), P.weed!, 2, cx + cy + dx);
    }
  }
  return s;
}

/* Ada's room */

const ROOM: Palette = {
  back: ["#d9d2e6", "#cfc5de"],
  floor: "#d9b98f",
  plank: "#cfac80",
  slab: "#b99a76",
  wall: "#e6d6ea",
  trim: "#f6eef6",
  glass: "#9fd0e8",
  curtain: "#eaa9bd",
  poster: "#f2d49a",
  star: "#b9a2e0",
  desk: "#c99a6a",
  drawer: "#bb8c5e",
  lamp: "#8fb2dc",
  shade: "#f4cf7a",
  chair: "#b48ad0",
  bed: "#b8875e",
  blanket: "#8fb0e2",
  pillow: "#f7f0f4",
  shelf: "#c99a6a",
  pebble1: "#c7a593",
  pebble2: "#a9bfd3",
  pebble3: "#d8a3a0",
  rug: "#e7b7a8",
  rock: "#93877e",
  glowline: "#53d1c2",
  glow: "#96ecde",
  cloth: "#ef9fa8",
  // Needle's recorder (dark brown, ivory rings) and its song sheet on the desk.
  recorder: "#7a4a32",
  joint: "#efe4c8",
  sheet: "#fbf7ee",
  staff: "#8c86a0",
};

// The rock on the desk, in model units.
export const ROCK: Point = [3.0, 1.4, 3.05];

// The rock's glow: radius in model units and peak alpha.
interface RockGlow {
  peak: number;
  radius: number;
}

// The polished rock's glow at amount g: 0 the faint pattern, 1 fills the room.
const glowAmount = (g: number): RockGlow => ({
  peak: 150 + Math.trunc(g * 105),
  radius: 1.4 + g * 16,
});

interface RoomOptions {
  // Without a glow the rock is unpolished.
  glow?: RockGlow;
  // The night window: the moon and stars on the glass.
  moon?: boolean;
  // Needle's recorder on its song sheet at the desk's left end.
  recorder?: boolean;
  // Canvas rows to raise the whole room by, so its subject band ends by row 293.
  lift?: number;
}

// Design px per logical canvas px (the canvas is the design frame at 360 / 390).
const DESIGN_PER_LOGICAL = DESIGN.height / 360;
// Needle's scenes rise 7 rows, so the desk's recorder and rock and the stage end by row 293 and
// clear the strip above a story panel at Gameplay's longest page.
const NEEDLE_LIFT = 7;

// The doorway in the left wall of Ada's room, beside the bed's head, in model units: Dad looks
// in through it on Needle's practice page.
const DOORWAY = { y0: 4.05, y1: 6.25, z1: 6.0 };

// The recorder lying on the desk, mouthpiece to the left, along screen-horizontal (x - y).
function recorder(
  s: Scene,
  P: Palette,
  z: number,
  key: number,
  from: Point,
  dir: readonly [number, number],
) {
  const [ux, uy] = dir;
  const at = (t: number, dz = 0): Point => [from[0] + ux * t, from[1] + uy * t, z + 0.085 + dz];
  const r = 0.1;
  s.solid(rod(at(0), at(0.32), r * 0.95, 8, r * 1.1), P.recorder!, 2, key);
  s.solid(rod(at(0.32), at(0.4), r * 1.18, 8), P.joint!, 2, key + 0.001);
  s.solid(rod(at(0.4), at(1.12), r, 8), P.recorder!, 2, key + 0.002);
  s.solid(rod(at(1.12), at(1.2), r * 1.15, 8), P.joint!, 2, key + 0.003);
  s.solid(rod(at(1.2), at(1.42), r * 1.05, 8, r * 1.3), P.recorder!, 2, key + 0.004);
}

function room(
  P: Palette,
  { glow, moon, recorder: withRecorder, lift = 0 }: RoomOptions = {},
): Scene {
  const [nx, ny, wall] = [16, 12, 7];
  const s = fitted(nx, ny, wall, 12 - lift * DESIGN_PER_LOGICAL);
  s.solid(box(0, nx, 0, ny, -0.8, 0), P.slab!, 0, 0);
  const planks: Decal[] = [1, 2, 3, 4, 5, 6, 7].map((j) => [
    onZ(0.001, 0, nx, j * 1.5, j * 1.5 + 0.08),
    P.plank!,
  ]);
  planks.push([flat(octagon(8.5, 7.5, 2.6, 0, 8, 0.39, 0.7), 0.002), P.rug!]);
  s.solid([onZ(0, 0, nx, 0, ny)], P.floor!, 0, 1, planks);
  const right: Decal[] = [
    [onY(0.001, 8.0, 12.6, 2.6, 5.8), P.trim!],
    [onY(0.002, 8.3, 12.3, 2.9, 5.5), P.glass!],
  ];
  if (moon) {
    right.push([discOnY(0.0025, 11.3, 4.75, 0.42), P.moon!]);
    for (const [sx, sz, r] of STARS) {
      right.push([onY(0.0026, sx - r, sx + r, sz - r, sz + r), P.starlight!]);
    }
  }
  right.push(
    [onY(0.003, 10.2, 10.4, 2.9, 5.5), P.trim!],
    [onY(0.004, 7.4, 8.4, 2.2, 6.2), P.curtain!],
    [onY(0.004, 12.2, 13.2, 2.2, 6.2), P.curtain!],
    [onY(0.002, 1.2, 3.6, 3.6, 6.2), P.poster!],
  );
  for (const [sx, sz] of [
    [1.8, 5.4],
    [2.9, 4.6],
    [2.0, 4.2],
  ] as const) {
    right.push([onY(0.003, sx - 0.18, sx + 0.18, sz - 0.18, sz + 0.18), P.star!]);
  }
  s.solid(box(-0.6, nx, -0.6, 0, 0, wall), P.wall!, 1, 0, right);
  s.solid(box(-0.6, 0, 0, ny, 0, wall), P.wall!, 1, 0.5);
  // The doorway beside the bed's head, open onto the landing: its frame in the desk's wood, the
  // landing in the lamp shade's colour (lit by day, dark at night), its floor in drawer wood.
  const { y0, y1, z1 } = DOORWAY;
  s.solid(box(-0.02, 0.012, y0 - 0.22, y1 + 0.22, 0, z1 + 0.22), P.desk!, 1, 0.6);
  s.solid(box(-0.03, 0.02, y0, y1, 0, z1), P.shade!, 1, 0.61, [
    [onX(0.021, y0, y1, 0, 0.8), P.drawer!],
  ]);
  // Shelf of collected rocks on the left wall, between the corner and the doorway.
  s.solid(box(0, 0.9, 1.0, 5.0, 4.2, 4.4), P.shelf!, 2, 2);
  ["pebble1", "pebble2", "pebble3", "pebble1"].forEach((c, i) => {
    s.solid(frustum(0.45, 1.6 + i * 0.95, 0.32, 0.22, 6, 4.4, 4.75), P[c]!, 2, 2.1 + i * 0.01);
  });
  // Bed along the left wall.
  s.solid(box(0, 3.6, 6.6, 7.0, 0, 2.8), P.bed!, 2, 6.8);
  s.solid(box(0, 3.6, 7.0, 11.8, 0, 1.2), P.bed!, 2, 9.4);
  s.solid(box(0, 3.6, 7.0, 11.8, 1.2, 1.8), P.blanket!, 2, 9.6);
  s.solid(box(0.4, 3.2, 7.2, 8.4, 1.8, 2.2), P.pillow!, 2, 9.8);
  // Desk against the right wall, chair, lamp and the rock.
  s.solid(box(1.2, 1.5, 0.2, 2.6, 0, 2.3), P.drawer!, 2, 3.0);
  s.solid(box(4.6, 6.6, 0.2, 2.6, 0, 2.3), P.drawer!, 2, 5.5, [
    [onY(2.601, 4.9, 6.3, 1.5, 1.6), P.desk!],
  ]);
  const desk: Decal[] = [];
  if (withRecorder) {
    // The song sheet, turned a little on the desk, with two staves.
    const sheet = (u0: number, u1: number, v0: number, v1: number, z: number): Face => {
      const [cx, cy, a] = [1.95, 1.55, -0.25];
      return [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ].map(([u, v]): Point => [
        cx + u! * Math.cos(a) - v! * Math.sin(a),
        cy + u! * Math.sin(a) + v! * Math.cos(a),
        z,
      ]);
    };
    desk.push([sheet(-0.75, 0.75, -0.55, 0.55, 2.601), P.sheet!]);
    for (const v of [-0.32, -0.22, -0.12, 0.12, 0.22, 0.32]) {
      desk.push([sheet(-0.62, 0.62, v - 0.018, v + 0.018, 2.602), P.staff!]);
    }
  }
  s.solid(box(1.0, 6.8, 0, 2.8, 2.3, 2.6), P.desk!, 2, 6.0, desk);
  if (withRecorder) recorder(s, P, 2.6, 6.05, [1.15, 2.2, 0], [Math.SQRT1_2, -Math.SQRT1_2]);
  s.solid(frustum(6.0, 0.9, 0.38, 0.38, 8, 2.6, 2.75), P.lamp!, 2, 6.6);
  s.solid(box(5.95, 6.05, 0.85, 0.95, 2.75, 3.8), P.lamp!, 2, 6.7);
  s.solid(frustum(6.0, 0.9, 0.62, 0.32, 8, 3.6, 4.2), P.shade!, 2, 6.8);
  s.solid(box(4.0, 5.0, 1.8, 2.5, 2.6, 2.65), P.cloth!, 2, 6.4);
  const [rx, ry, rz] = ROCK;
  const line: Decal[] = glow
    ? [[flat(octagon(rx, ry, 0.22, 0, 8, 0.2), rz + 0.001), P.glowline!]]
    : [];
  s.solid(frustum(rx, ry, 0.62, 0.42, 8, 2.6, rz, 0.2), P.rock!, 2, 6.5, line);
  if (glow) {
    s.glows.push({ at: ROCK, colour: rgb(P.glow!), peak: glow.peak, radius: glow.radius });
  }
  s.solid(box(2.0, 3.6, 3.2, 4.8, 1.3, 1.5), P.chair!, 2, 7.4);
  for (const [cx, cy] of [
    [2.1, 3.3],
    [3.4, 3.3],
    [2.1, 4.6],
    [3.4, 4.6],
  ] as const) {
    s.solid(box(cx, cx + 0.15, cy, cy + 0.15, 0, 1.3), P.chair!, 2, 7.3);
  }
  s.solid(box(2.0, 3.6, 4.6, 4.8, 1.5, 3.2), P.chair!, 2, 7.6);
  return s;
}

/* Ada's room overnight: moonlight, rock glow and morning sunlight */

type Colours = Readonly<Record<string, string>>;

// An Oklab grade: L' = l0 + l1 L, chroma scaled by c, then shifted by (da, db).
type Grade = readonly [l0: number, l1: number, c: number, da: number, db: number];

function graded([l0, l1, c, da, db]: Grade, colours: Colours): Record<string, string> {
  return Object.fromEntries(
    Object.entries(colours).map(([key, value]) => {
      const [L, a, b] = toOklab(rgb(value));
      return [key, hex(fromOklab(l0 + l1 * L, a * c + da, b * c + db))];
    }),
  );
}

// The room's colours the grades change: all but its backdrop and the rock's glow colours.
const KEPT = { glow: ROOM.glow!, glowline: ROOM.glowline! };
const ROOM_SOLIDS: Colours = Object.fromEntries(
  Object.entries(ROOM).filter(
    (pair): pair is [string, string] => pair[0] !== "back" && !(pair[0] in KEPT),
  ),
);

// Moonlight: dark, desaturated and blue; the lamp is off and the rock keeps its teal.
const NIGHT_GRADE: Grade = [0.08, 0.42, 0.5, -0.012, -0.075];
const NIGHT: Palette = {
  ...graded(NIGHT_GRADE, ROOM_SOLIDS),
  ...KEPT,
  back: ["#1d2452", "#2a2f5e"],
  haze: "#585c8c",
  glass: "#16245e",
  moon: "#f1ecd6",
  moonlight: "#b9c9f2",
  shade: "#6c6a72",
  starlight: "#e8e6ff",
};

// Early sun: warm and a little more saturated.
const MORNING_GRADE: Grade = [0.02, 0.99, 1.1, 0.014, 0.05];
const MORNING: Palette = {
  ...graded(MORNING_GRADE, ROOM_SOLIDS),
  ...KEPT,
  back: ["#f6d9b4", "#efcfb4"],
  glass: "#fad98a",
  sun: "#ffdf96",
  sunlight: "#ffe2a0",
};

// Stars on the night glass, as (x, z, half size) on the window wall.
const STARS = [
  [8.8, 5.05, 0.07],
  [9.5, 3.6, 0.06],
  [9.9, 4.7, 0.08],
  [8.9, 3.25, 0.05],
  [11.0, 3.4, 0.07],
  [11.85, 3.95, 0.05],
  [10.75, 5.2, 0.05],
] as const;

// A disc decal on the window wall (the moon).
const discOnY = (y: number, cx: number, cz: number, r: number, n = 12): Face =>
  Array.from({ length: n }, (_, i): Point => {
    const a = (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
  });

// A convex lump: an elliptical ring at z0 tapering by t to a smaller ring at z1, its rx axis
// turned by rot in the floor plane.
function lump(
  [cx, cy]: readonly [number, number],
  [rx, ry]: readonly [number, number],
  z0: number,
  z1: number,
  t = 0.72,
  rot = 0,
): Face[] {
  const n = 10;
  const ringAt = (k: number, z: number) =>
    Array.from({ length: n }, (_, i): Point => {
      const a = 0.31 + (2 * Math.PI * i) / n;
      const [u, v] = [k * rx * Math.cos(a), k * ry * Math.sin(a)];
      return [
        cx + u * Math.cos(rot) - v * Math.sin(rot),
        cy + u * Math.sin(rot) + v * Math.cos(rot),
        z,
      ];
    });
  const a = ringAt(1, z0);
  const b = ringAt(t, z1);
  return [b, a, ...a.map((p, i) => [p, a[(i + 1) % n]!, b[(i + 1) % n]!, b[i]!])];
}

// A cylinder of n sides and radius r (tapering to r1) from a to b at any angle: stems, the
// recorder.
function rod(a: Point, b: Point, r: number, n = 8, r1 = r): Face[] {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0]!, d[1]!, d[2]!);
  const u = d.map((v) => v / len);
  const ref = Math.abs(u[2]!) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cross = (p: number[], q: number[]) => [
    p[1]! * q[2]! - p[2]! * q[1]!,
    p[2]! * q[0]! - p[0]! * q[2]!,
    p[0]! * q[1]! - p[1]! * q[0]!,
  ];
  const e1 = cross(u, ref);
  const l1 = Math.hypot(e1[0]!, e1[1]!, e1[2]!);
  const v1 = e1.map((v) => v / l1);
  const v2 = cross(u, v1);
  const ringAt = (c: Point, rr: number) =>
    Array.from({ length: n }, (_, i): Point => {
      const t = 0.2 + (2 * Math.PI * i) / n;
      const at = (j: number) => c[j]! + rr * (Math.cos(t) * v1[j]! + Math.sin(t) * v2[j]!);
      return [at(0), at(1), at(2)];
    });
  const A = ringAt(a, r);
  const B = ringAt(b, r1);
  return [B, A, ...A.map((p, i) => [p, A[(i + 1) % n]!, B[(i + 1) % n]!, B[i]!])];
}

// pane to that patch as one hull. Panes split at the mullion.
const PANES = [
  [8.3, 10.2],
  [10.4, 12.3],
] as const;
const PANE_Z = [2.9, 5.5] as const;

function paneLight(d: Point): Face[] {
  const [z0, z1] = PANE_Z;
  const hit = (x: number, z: number): Point => {
    const t = -z / d[2];
    const k = Math.min(1, 12 / (d[1] * t));
    return [x + d[0] * t * k, d[1] * t * k, 0.003];
  };
  return PANES.map(([x0, x1]) => [hit(x0, z0), hit(x1, z0), hit(x1, z1), hit(x0, z1)]);
}

function paneBeam(d: Point): Face[] {
  const [z0, z1] = PANE_Z;
  const floor = paneLight(d);
  return PANES.map(([x0, x1], i) => [
    [x0, 0.003, z0],
    [x1, 0.003, z0],
    [x1, 0.003, z1],
    [x0, 0.003, z1],
    ...floor[i]!,
  ]);
}

const WINDOW: Point = [10.3, 0.05, 4.2];
const MOON_LIGHT: Point = [0.25, 1, -1.6];
const SUN_LIGHT: Point = [-0.42, 1, -0.42];

// The rock's glow through the night, and at the top of its breath.
const NIGHT_GLOW: RockGlow = { peak: 170, radius: 3.0 };
const BREATH_GLOW: RockGlow = { peak: 215, radius: 3.8 };

// Night: moonlight through the window, a faint beam and its patch on the floor.
function night(P: Palette, glow: RockGlow): Scene {
  const s = room(P, {
    glow,
    moon: true,
  });
  const colour = rgb(P.moonlight!);
  s.glows.unshift({ at: WINDOW, colour, peak: 70, radius: 3.4 });
  s.lights.push(
    { alpha: 0.07, colour, hull: true, quads: paneBeam(MOON_LIGHT), soft: 5.7 },
    { alpha: 0.26, colour, quads: paneLight(MOON_LIGHT), soft: 3.0 },
  );
  return s;
}

// Morning: low sun, a long soft beam and bright patches across the floor, the rock's faint glow
// as by day, with the bed and pillow unoccupied.
function morning(P: Palette): Scene {
  const s = room(P, {
    glow: glowAmount(0),
  });
  s.glows.unshift({ at: WINDOW, colour: rgb(P.sun!), peak: 80, radius: 3.0 });
  const colour = rgb(P.sunlight!);
  s.lights.push(
    {
      alpha: 0.22,
      colour,
      fade: { amount: 0.6, from: [10, 0, 4], to: [5.5, 12, 0] },
      hull: true,
      quads: paneBeam(SUN_LIGHT),
      soft: 6.8,
    },
    {
      alpha: 0.75,
      colour,
      fade: { amount: 0.55, from: [8.5, 7, 0], to: [5.5, 12, 0] },
      quads: paneLight(SUN_LIGHT),
      soft: 3.5,
    },
  );
  return s;
}

/* School hallway */

const HALL: Palette = {
  back: ["#c7d3e6", "#a9b8d2"],
  floor: "#d8c29c",
  tile: "#c9ae84",
  slab: "#b89a72",
  wall: "#f1e3c6",
  wains: "#8fc1b8",
  locker: "#5fb3a6",
  vent: "#3f8a80",
  handle: "#d9efe9",
  door: "#a8795a",
  glass: "#94cde6",
  frame: "#f6ecd9",
  board: "#c58f5a",
  cork: "#d8a873",
  paper1: "#fff4d6",
  paper2: "#f2a6a6",
  paper3: "#a6c8f2",
  paper4: "#bfe3a0",
  bench: "#7d8fc0",
};

function hallway(P: Palette): Scene {
  const [nx, ny, wall] = [18, 14, 7];
  const s = fitted(nx, ny, wall);
  s.solid(box(0, nx, 0, ny, -0.8, 0), P.slab!, 0, 0);
  const tiles: Decal[] = [];
  for (let i = 0; i < nx / 2; i++) {
    for (let j = 0; j < ny / 2; j++) {
      if ((i + j) % 2) tiles.push([onZ(0.001, i * 2, i * 2 + 2, j * 2, j * 2 + 2), P.tile!]);
    }
  }
  s.solid([onZ(0, 0, nx, 0, ny)], P.floor!, 0, 1, tiles);
  // Back walls: the right wall runs along x, the left along y.
  s.solid(box(-0.6, nx, -0.6, 0, 0, wall), P.wall!, 1, 0, [
    [onY(0.001, 0, nx, 0, 1.6), P.wains!],
    [onY(0.002, 1.2, 4.4, 0, 5.4), P.frame!],
    [onY(0.003, 1.5, 4.1, 0, 5.1), P.door!],
    [onY(0.004, 2.1, 3.5, 3.0, 4.6), P.glass!],
  ]);
  const left: Decal[] = [
    [onX(0.001, 0, ny, 0, 1.6), P.wains!],
    // The notice board beside the near door, its rows 184..290 above the story panel.
    [onX(0.002, 4.4, 8.0, 3.2, 5.8), P.board!],
    [onX(0.003, 4.6, 7.8, 3.4, 5.6), P.cork!],
  ];
  for (const [y0, z0, c] of [
    [4.8, 4.4, "paper1"],
    [5.55, 3.7, "paper3"],
    [6.3, 4.5, "paper2"],
    [7.05, 3.8, "paper4"],
  ] as const) {
    left.push([onX(0.004, y0, y0 + 0.6, z0, z0 + 1.0), P[c]!]);
  }
  left.push(
    [onX(0.002, 8.4, 11.6, 0, 5.4), P.frame!],
    [onX(0.003, 8.7, 11.3, 0, 5.1), P.door!],
    [onX(0.004, 9.3, 10.7, 3.0, 4.6), P.glass!],
  );
  s.solid(box(-0.6, 0, 0, ny, 0, wall), P.wall!, 1, 0.5, left);
  // Lockers against the right wall.
  for (let x = 5.4; x + 1.3 <= nx - 0.2; x += 1.36) {
    const decals: Decal[] = [4.6, 4.85, 5.1].map((z) => [
      onY(1.101, x + 0.25, x + 1.05, z, z + 0.12),
      P.vent!,
    ]);
    decals.push([onY(1.102, x + 0.95, x + 1.1, 2.6, 3.4), P.handle!]);
    s.solid(box(x, x + 1.3, 0, 1.1, 0, 5.6), P.locker!, 2, x, decals);
  }
  s.solid(box(1.0, 1.8, 2.0, 7.5, 0, 1.4), P.bench!, 2);
  return s;
}

/* Schoolyard */

const YARD: Palette = {
  back: ["#cfe0ea", "#dde6e4"],
  earth: "#8f8478",
  asphalt: "#b6aebf",
  paint: "#f3ead2",
  brick: "#d48f7e",
  mortar: "#c98576",
  roof: "#b97a6c",
  win: "#a6d2e6",
  trim: "#f6ece0",
  door: "#8f6fb0",
  post: "#7fa0d6",
  deck: "#e9b85f",
  slide: "#f2c95c",
  bars: "#ea8f84",
  fence: "#a8b0be",
  trunk: "#8a5f3e",
  crown: "#79bb67",
};

function schoolyard(P: Palette): Scene {
  const n = 24;
  const s = island();
  s.solid(box(0, n, 0, n, -1.4, 0), P.earth!, 0, 0);
  const paint: Decal[] = [];
  // Hopscotch runs left to right across the screen.
  for (let i = 0; i < 6; i++) {
    const [x, y] = [8.5 + 1.25 * i, 17.5 - 1.25 * i];
    paint.push([onZ(0.001, x, x + 1.1, y, y + 1.1), P.paint!]);
    paint.push([onZ(0.002, x + 0.1, x + 1.0, y + 0.1, y + 1.0), P.asphalt!]);
  }
  paint.push([onZ(0.001, 9.0, 21.0, 8.4, 8.55), P.paint!]);
  s.solid([onZ(0, 0, n, 0, n)], P.asphalt!, 0, 1, paint);
  // School along the left edge, windows and door on its +x face.
  let deco: Decal[] = [];
  for (let y = 7; y < 22; y += 3) {
    for (const z0 of [1.2, 3.2]) {
      deco.push([onX(6.501, y, y + 1.8, z0, z0 + 1.3), P.trim!]);
      deco.push([onX(6.502, y + 0.15, y + 1.65, z0 + 0.15, z0 + 1.15), P.win!]);
    }
  }
  deco = deco.filter(([[p]]) => !(p![1] >= 12 && p![1] <= 14.9 && p![2] < 2.6));
  deco.push([onX(6.501, 12.2, 14.8, 0, 2.6), P.trim!], [onX(6.502, 12.4, 14.6, 0, 2.4), P.door!]);
  for (let z = 1; z < 5; z++) deco.push([onY(23.001, 0.5, 6.5, z - 0.04, z), P.mortar!]);
  s.solid(box(0.5, 6.5, 6.0, 23.0, 0, 4.8), P.brick!, 2, 12, deco);
  s.solid(box(0.3, 6.7, 5.8, 23.2, 4.8, 5.2), P.roof!, 2, 12.1);
  // Play structure beside the school's door: posts, deck, roof, climbing bars, and the slide
  // toward the back of the lot, so the whole structure fits rows 170..276.
  const [px0, py0] = [8.5, 9.0];
  for (const [cx, cy] of [
    [px0, py0],
    [px0 + 2.8, py0],
    [px0, py0 + 2.8],
    [px0 + 2.8, py0 + 2.8],
  ] as const) {
    s.solid(box(cx, cx + 0.25, cy, cy + 0.25, 0, 4.4), P.post!, 2, cx + cy);
  }
  s.solid(box(px0 - 0.1, px0 + 3.2, py0 - 0.1, py0 + 3.2, 2.6, 2.95), P.deck!, 2, px0 + py0 + 3);
  s.solid(gable(px0 - 0.3, px0 + 3.4, py0 - 0.3, py0 + 3.4, 4.4, 5.6), P.bars!, 2, px0 + py0 + 3.5);
  const ramp: Face = [
    [px0 + 0.8, py0 - 0.1, 2.95],
    [px0 + 0.8, py0 - 4.1, 0.2],
    [px0 + 2.2, py0 - 4.1, 0.2],
    [px0 + 2.2, py0 - 0.1, 2.95],
  ];
  s.solid(slab(ramp, 0.25), P.slide!, 2, px0 + py0 - 3);
  for (const z of [0.8, 1.6, 2.4]) {
    s.solid(box(px0, px0 + 3.0, py0 + 3.2, py0 + 3.35, z, z + 0.14), P.bars!, 2, px0 + py0 + 3.2);
  }
  for (const cx of [px0, px0 + 3.0]) {
    s.solid(box(cx, cx + 0.14, py0 + 3.2, py0 + 3.35, 0, 2.6), P.bars!, 2, px0 + py0 + 3.3);
  }
  for (let x = 8; x < n; x += 2) s.solid(box(x, x + 0.22, 0.2, 0.42, 0, 2.2), P.fence!, 2, x + 0.5);
  s.solid(box(8, n, 0.27, 0.35, 2.05, 2.2), P.fence!, 2, 8.6);
  tree(s, P, 21.0, 2.6);
  return s;
}

/* Front door at home */

const DOOR: Palette = {
  back: ["#e6dccd", "#dcd0c0"],
  floor: "#d6b48e",
  plank: "#c9a57e",
  slab: "#b5966f",
  wall: "#efdcc0",
  wains: "#e4c9a6",
  trim: "#f8efe0",
  door: "#a98bc4",
  panel: "#b89ad0",
  glass: "#a8d4e8",
  knob: "#f2cf74",
  mat: "#c9a46f",
  rail: "#b98d63",
  coat1: "#f0c95e",
  coat2: "#86ade0",
  leash: "#ec8e6a",
  rack: "#c49a6c",
  shoe1: "#93acd6",
  shoe2: "#e79a92",
  pot: "#d49272",
  leaf: "#8cc47a",
  pic: "#bfe0cf",
  hill: "#9cc98b",
  bowl: "#7fa7d9",
};

function frontDoor(P: Palette): Scene {
  const [nx, ny, wall] = [16, 12, 7];
  const s = fitted(nx, ny, wall);
  s.solid(box(0, nx, 0, ny, -0.8, 0), P.slab!, 0, 0);
  const deco: Decal[] = [1, 2, 3, 4, 5, 6, 7].map((j) => [
    onZ(0.001, 0, nx, j * 1.5, j * 1.5 + 0.08),
    P.plank!,
  ]);
  deco.push([onZ(0.002, 0.1, 2.3, 4.8, 8.6), P.mat!]);
  s.solid([onZ(0, 0, nx, 0, ny)], P.floor!, 0, 1, deco);
  s.solid(box(-0.6, nx, -0.6, 0, 0, wall), P.wall!, 1, 0, [
    [onY(0.001, 0, nx, 0, 2.0), P.wains!],
    [onY(0.002, 0.6, 5.2, 4.7, 4.95), P.rail!],
    [onY(0.002, 8.0, 11.4, 3.6, 5.8), P.trim!],
    [onY(0.003, 8.2, 11.2, 3.8, 5.6), P.pic!],
    [onY(0.004, 8.2, 11.2, 3.8, 4.6), P.hill!],
  ]);
  s.solid(box(-0.6, 0, 0, ny, 0, wall), P.wall!, 1, 0.5, [
    [onX(0.001, 0, ny, 0, 2.0), P.wains!],
    [onX(0.002, 4.6, 8.8, 0, 6.0), P.trim!],
    [onX(0.003, 4.9, 8.5, 0, 5.7), P.door!],
    [onX(0.004, 5.6, 7.8, 4.0, 5.2), P.glass!],
    [onX(0.004, 5.4, 8.0, 0.6, 1.8), P.panel!],
    [onX(0.004, 5.4, 8.0, 2.2, 3.6), P.panel!],
    [onX(0.005, 8.0, 8.25, 2.6, 2.85), P.knob!],
  ]);
  // Coats and the lead on the hooks, near the corner by the door, inside rows 175..280.
  s.solid(box(1.0, 2.2, 0, 0.5, 2.8, 4.8), P.coat1!, 2, 1.5);
  s.solid(box(2.6, 3.8, 0, 0.5, 3.0, 4.8), P.coat2!, 2, 3.0);
  s.solid(box(4.4, 4.55, 0, 0.15, 3.4, 4.8), P.leash!, 2, 5.0);
  s.solid(box(4.15, 4.8, 0, 0.15, 3.0, 3.4), P.leash!, 2, 5.1);
  // Shoe rack, plant and the dog's bowl.
  s.solid(box(1.0, 5.0, 0, 1.4, 0, 1.0), P.rack!, 2, 1.0);
  ["shoe1", "shoe2", "shoe1"].forEach((c, i) => {
    s.solid(box(1.3 + i * 1.25, 2.3 + i * 1.25, 0.3, 1.2, 1.0, 1.35), P[c]!, 2, 1.2 + i * 0.01);
  });
  s.solid(frustum(6.8, 1.1, 0.7, 0.9, 8, 0, 1.4), P.pot!, 2, 7.5);
  s.solid(frustum(6.8, 1.1, 1.0, 1.2, 8, 1.4, 2.4, 0.39), P.leaf!, 2, 7.7);
  s.solid(frustum(6.8, 1.1, 1.2, 0.55, 8, 2.4, 3.2, 0.39), P.leaf!, 2, 7.8);
  s.solid(frustum(2.6, 3.6, 0.55, 0.7, 8, 0, 0.32), P.bowl!, 2, 6);
  return s;
}

/* The kitchen at home: Cartwheel's dinner, Dad at the table */

const KITCHEN: Palette = {
  back: ["#e9dccb", "#e1d2c2"],
  floor: "#e6c69c",
  tile: "#d9b487",
  slab: "#bc9a72",
  wall: "#f6e2b8",
  trim: "#fbf1dc",
  splash: "#e3efe9",
  cabinet: "#93c2b0",
  cabdoor: "#a9d2c2",
  knob: "#f2cf74",
  counter: "#d8b086",
  oven: "#6f7f9a",
  hob: "#4a5470",
  pot: "#d0605a",
  lid: "#e88a7c",
  sink: "#c7d0dc",
  tap: "#9aa6b4",
  glass: "#b8c6ec",
  dusk: "#f3c7a0",
  curtain: "#f1ad7f",
  fridge: "#f4efe6",
  handle: "#b8c2d2",
  drawing: "#fee761",
  drawing2: "#53d1c2",
  shelf: "#c99a6a",
  jar1: "#f2cf74",
  jar2: "#e7a08c",
  jar3: "#9cc98b",
  clock: "#fbf7ee",
  hands: "#5a6988",
  cloth: "#ef9b84",
  hem: "#f7c6b4",
  plate: "#fbf7ee",
  rim: "#d9dfe8",
  pasta: "#f2cf74",
  sauce: "#d0605a",
  salad: "#8cc47a",
  bowl: "#8fb2dc",
  jug: "#a9c8ec",
  cup: "#f6d06e",
  chair: "#c48a5a",
  seat: "#d9a06e",
  catbowl: "#b48ad0",
  lamp: "#ffe2a0",
};

// The round table near the back corner.
const DINNER_TABLE = { cx: 4.3, cy: 4.3, r: 1.75, z: 2.4 };
const DINNER_FAR: Point = [
  DINNER_TABLE.cx - DINNER_TABLE.r * Math.SQRT1_2,
  DINNER_TABLE.cy - DINNER_TABLE.r * Math.SQRT1_2,
  DINNER_TABLE.z,
];
const DAD_SEAT: Point = [
  DINNER_TABLE.cx - 2.35 * Math.SQRT1_2,
  DINNER_TABLE.cy - 2.35 * Math.SQRT1_2,
  DINNER_TABLE.z,
];
// The kitchen rises 88 rows, so the table's near edge ends on row 293 and the table clears
// the strip above a story panel at Gameplay's longest page.
const KITCHEN_LIFT = 88;

function kitchenChair(
  s: Scene,
  P: Palette,
  x: number,
  y: number,
  back: "-x" | "+x" | "+y",
  key: number,
) {
  s.solid(box(x - 0.6, x + 0.6, y - 0.6, y + 0.6, 1.25, 1.45), P.seat!, 2, key);
  for (const [dx, dy] of [
    [-0.5, -0.5],
    [0.38, -0.5],
    [-0.5, 0.38],
    [0.38, 0.38],
  ] as const) {
    s.solid(box(x + dx, x + dx + 0.12, y + dy, y + dy + 0.12, 0, 1.25), P.chair!, 2, key - 0.01);
  }
  const panel =
    back === "-x"
      ? box(x - 0.6, x - 0.45, y - 0.6, y + 0.6, 1.45, 3.1)
      : back === "+x"
        ? box(x + 0.45, x + 0.6, y - 0.6, y + 0.6, 1.45, 3.1)
        : box(x - 0.6, x + 0.6, y + 0.45, y + 0.6, 1.45, 3.1);
  s.solid(panel, P.chair!, 2, back === "-x" ? key - 0.02 : key + 0.02);
}

function plate(s: Scene, P: Palette, x: number, y: number, key: number, food = true) {
  const z = DINNER_TABLE.z;
  s.solid(frustum(x, y, 0.42, 0.5, 12, z, z + 0.06), P.plate!, 2, key, [
    [flat(octagon(x, y, 0.36, 0, 12), z + 0.061), P.rim!],
    [flat(octagon(x, y, 0.33, 0, 12), z + 0.062), P.plate!],
    ...(food
      ? ([
          [flat(octagon(x, y, 0.22, 0, 10, 0.2, 0.8), z + 0.063), P.pasta!],
          [flat(octagon(x + 0.03, y - 0.02, 0.1, 0, 8), z + 0.064), P.sauce!],
        ] as Decal[])
      : []),
  ]);
}

// A disc on a wall facing +x (the clock).
const discOnX = (x: number, cy: number, cz: number, r: number, n = 14): Face =>
  Array.from({ length: n }, (_, i): Point => {
    const a = (2 * Math.PI * i) / n;
    return [x, cy + r * Math.cos(a), cz + r * Math.sin(a)];
  });

// A cozy kitchen: sage cabinets, the hob with a pot on it and the sink under a dusk window along
// the right wall; a round clock, a shelf of jars and the fridge with Ada's drawing on the left;
// checked tiles, two cat bowls, and supper on a cloth-covered round table under a warm lamp glow.
function kitchen(P: Palette): Scene {
  const [nx, ny, wall] = [16, 12, 7];
  const s = fitted(nx, ny, wall, 12 - KITCHEN_LIFT * DESIGN_PER_LOGICAL);
  s.solid(box(0, nx, 0, ny, -0.8, 0), P.slab!, 0, 0);
  const tiles: Decal[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if ((i + j) % 2 === 0) {
        tiles.push([onZ(0.001, i + 0.03, i + 0.97, j + 0.03, j + 0.97), P.tile!]);
      }
    }
  }
  s.solid([onZ(0, 0, nx, 0, ny)], P.floor!, 0, 1, tiles);
  s.solid(box(-0.6, nx, -0.6, 0, 0, wall), P.wall!, 1, 0, [
    [onY(0.001, 6.8, 13.9, 2.8, 3.9), P.splash!],
    [onY(0.002, 9.9, 13.3, 3.9, 6.0), P.trim!],
    [onY(0.003, 10.15, 13.05, 4.15, 5.75), P.glass!],
    [onY(0.0035, 10.15, 13.05, 4.15, 4.7), P.dusk!],
    [onY(0.004, 11.55, 11.65, 4.15, 5.75), P.trim!],
    [onY(0.005, 9.5, 10.2, 3.9, 6.2), P.curtain!],
    [onY(0.005, 13.0, 13.7, 3.9, 6.2), P.curtain!],
  ]);
  s.solid(box(-0.6, 0, 0, ny, 0, wall), P.wall!, 1, 0.5, [
    [discOnX(0.001, 6.1, 5.2, 0.62), P.shelf!],
    [discOnX(0.002, 6.1, 5.2, 0.5), P.clock!],
    [onX(0.003, 6.06, 6.14, 5.2, 5.58), P.hands!],
    [onX(0.003, 6.06, 6.4, 5.16, 5.24), P.hands!],
  ]);
  s.solid(box(0, 0.8, 1.2, 4.4, 4.5, 4.7), P.shelf!, 2, 1.5);
  ["jar1", "jar2", "jar3"].forEach((c, i) => {
    s.solid(frustum(0.4, 1.8 + i * 1.0, 0.3, 0.26, 8, 4.7, 5.3), P[c]!, 2, 1.6 + i * 0.01);
    s.solid(frustum(0.4, 1.8 + i * 1.0, 0.3, 0.3, 8, 5.3, 5.42), P.shelf!, 2, 1.65 + i * 0.01);
  });
  s.solid(box(0, 2.3, 8.8, 11.2, 0, 5.7), P.fridge!, 2, 10.5, [
    [onX(2.301, 9.0, 11.0, 3.65, 3.72), P.handle!],
    [onX(2.302, 10.5, 10.62, 2.2, 3.4), P.handle!],
    [onX(2.302, 10.5, 10.62, 4.0, 5.2), P.handle!],
    [onX(2.303, 9.3, 10.2, 4.1, 5.1), P.drawing!],
    [onX(2.304, 9.5, 9.8, 4.4, 4.7), P.drawing2!],
    [onY(11.201, 0.2, 2.1, 0.2, 5.5), P.fridge!],
  ]);
  // The counter run: cabinets, the oven and hob, the sink and its tap, a pot on the hob.
  const fronts: Decal[] = [];
  for (const [x0, x1] of [
    [7.0, 8.4],
    [10.6, 12.0],
    [12.2, 13.6],
  ] as const) {
    fronts.push([onY(2.201, x0 + 0.12, x1 - 0.12, 0.25, 2.2), P.cabdoor!]);
    fronts.push([onY(2.202, x1 - 0.42, x1 - 0.3, 1.7, 2.0), P.knob!]);
  }
  fronts.push([onY(2.201, 8.6, 10.4, 0.25, 1.9), P.oven!]);
  fronts.push([onY(2.202, 8.8, 10.2, 1.95, 2.05), P.handle!]);
  s.solid(box(6.8, 13.8, 0, 2.2, 0, 2.5), P.cabinet!, 2, 4.0, fronts);
  s.solid(box(6.7, 13.9, 0, 2.35, 2.5, 2.75), P.counter!, 2, 4.1, [
    [flat(octagon(9.0, 1.1, 0.42, 0, 10), 2.751), P.hob!],
    [flat(octagon(10.0, 1.4, 0.36, 0, 10), 2.751), P.hob!],
    [onZ(2.751, 11.0, 13.0, 0.4, 1.8), P.sink!],
  ]);
  s.solid(box(11.85, 12.05, 0.2, 0.4, 2.75, 3.5), P.tap!, 2, 4.2);
  s.solid(box(11.85, 12.05, 0.2, 0.95, 3.4, 3.55), P.tap!, 2, 4.21);
  s.solid(frustum(9.0, 1.1, 0.48, 0.48, 10, 2.75, 3.35), P.pot!, 2, 4.3);
  s.solid(frustum(9.0, 1.1, 0.5, 0.22, 10, 3.35, 3.55), P.lid!, 2, 4.31);
  s.solid(box(6.8, 9.4, 0, 1.1, 4.3, 6.2), P.cabinet!, 2, 3.0, [
    [onY(1.101, 6.95, 8.05, 4.45, 6.05), P.cabdoor!],
    [onY(1.101, 8.15, 9.25, 4.45, 6.05), P.cabdoor!],
  ]);
  for (const [x, y] of [
    [14.6, 2.9],
    [15.4, 3.5],
  ] as const) {
    s.solid(frustum(x, y, 0.3, 0.38, 10, 0, 0.22), P.catbowl!, 2, 4.5);
  }
  // The far chair precedes the table and supper in painter order.
  kitchenChair(s, P, DAD_SEAT[0] - 0.15, DAD_SEAT[1] - 0.15, "-x", 5.0);
  const { cx, cy, r, z } = DINNER_TABLE;
  s.solid(frustum(cx, cy, r * 1.12, r * 1.02, 16, 0.9, z), P.cloth!, 2, 6.0);
  s.solid(frustum(cx, cy, r * 1.02, r * 1.02, 16, z - 0.02, z), P.cloth!, 2, 6.01, [
    [flat(octagon(cx, cy, r * 0.82, 0, 16), z + 0.001), P.hem!],
    [flat(octagon(cx, cy, r * 0.78, 0, 16), z + 0.002), P.cloth!],
  ]);
  plate(s, P, DINNER_FAR[0] + 0.55, DINNER_FAR[1] + 0.55, 6.1);
  plate(s, P, cx - 0.1, cy + 1.05, 6.11);
  plate(s, P, cx + 1.05, cy - 0.1, 6.115, false);
  s.solid(frustum(cx + 0.2, cy + 0.2, 0.35, 0.55, 12, z, z + 0.35), P.bowl!, 2, 6.12, [
    [flat(octagon(cx + 0.2, cy + 0.2, 0.46, 0, 12, 0.3, 1), z + 0.351), P.salad!],
  ]);
  s.solid(frustum(cx + 0.9, cy - 0.85, 0.22, 0.18, 10, z, z + 0.7), P.jug!, 2, 6.13);
  s.solid(frustum(cx - 0.95, cy + 0.35, 0.13, 0.15, 8, z, z + 0.3), P.cup!, 2, 6.14);
  s.solid(frustum(cx + 0.4, cy + 1.15, 0.13, 0.15, 8, z, z + 0.3), P.cup!, 2, 6.15);
  kitchenChair(s, P, cx, cy + 2.35, "+y", 7.0);
  kitchenChair(s, P, cx + 2.35, cy, "+x", 7.1);
  s.glows.push({ at: [cx, cy, 5.6], colour: rgb(P.lamp!), peak: 70, radius: 3.4 });
  return s;
}

/* Park with the dig spot */

const PARK: Palette = {
  back: ["#cfe4e8", "#dfeadb"],
  earth: "#9b6b45",
  grass: "#8cc777",
  path: "#e8d3a2",
  pond: "#8fc8de",
  pondlight: "#b6dcea",
  trunk: "#8a5f3e",
  crown: "#6fb85e",
  bench: "#c08a5a",
  dirt: "#a5764e",
  hole: "#7f5a3c",
  rock: "#93877e",
  flower1: "#ef8fa0",
  flower2: "#f4cf6a",
  trowel: "#9fb0c4",
};

function park(P: Palette): Scene {
  const n = 24;
  const s = island();
  s.solid(box(0, n, 0, n, -1.4, 0), P.earth!, 0, 0);
  s.solid([onZ(0, 0, n, 0, n)], P.grass!, 0, 1, [
    [flat(octagon(5.0, 15.0, 3.4, 0, 10, 0.3, 0.8), 0.001), P.pond!],
    [flat(octagon(4.4, 14.4, 1.4, 0, 10, 0.3, 0.6), 0.002), P.pondlight!],
    [
      [
        [3.5, 21.5, 0.001],
        [20.5, 4.5, 0.001],
        [21.9, 5.9, 0.001],
        [4.9, 22.9, 0.001],
      ],
      P.path!,
    ],
  ]);
  tree(s, P, 5.0, 6.5);
  tree(s, P, 10.0, 4.2, 3.6, 2.4);
  tree(s, P, 19.5, 13.5, 3.0, 2.0);
  // Bench by the pond.
  s.solid(box(9.0, 9.9, 12.5, 16.0, 0.9, 1.1), P.bench!, 2, 23.0);
  s.solid(box(9.0, 9.2, 12.5, 16.0, 1.1, 2.1), P.bench!, 2, 22.9);
  for (const cy of [12.7, 15.6]) s.solid(box(9.2, 9.8, cy, cy + 0.2, 0, 0.9), P.bench!, 2, 22.8);
  // The dig spot and the unusual rock.
  const [dx, dy] = [16.0, 4.0];
  s.solid(frustum(dx, dy, 1.5, 1.0, 8, 0, 0.35, 0.39), P.dirt!, 2, 19.5, [
    [flat(octagon(dx, dy, 0.7, 0), 0.351), P.hole!],
  ]);
  s.solid(frustum(dx + 0.2, dy + 0.1, 0.6, 0.4, 8, 0.25, 0.85, 0.2), P.rock!, 2, 20.0);
  s.solid(box(17.8, 18.0, 5.4, 6.6, 0, 0.12), P.trowel!, 2, 23.5);
  s.solid(box(17.7, 18.1, 6.6, 7.2, 0, 0.18), P.bench!, 2, 24.2);
  [
    [8, 9],
    [13, 9.5],
    [21, 6],
    [2.5, 10],
    [13, 15],
    [21.5, 10],
    [7.5, 20],
  ].forEach(([x, y], i) => {
    s.solid(prism(x!, y!, 0.22, 6, 0, 0.45), P[`flower${(i % 2) + 1}`]!, 2, x! + y!);
  });
  return s;
}

/* School concert hall */

const CONCERT: Palette = {
  back: ["#d8cde0", "#cbbfd2"],
  floor: "#d7ad7c",
  board: "#c99d6c",
  slab: "#b48c62",
  wall: "#efe2cf",
  wains: "#b88a62",
  stage: "#c7925e",
  stageboard: "#b98552",
  skirt: "#7c5a96",
  curtain: "#c95a66",
  fold: "#ad4555",
  valance: "#a63e4f",
  window: "#a9d2ea",
  frame: "#f8efe0",
  door: "#9c7356",
  chair: "#6f93cf",
  chairleg: "#4d5f86",
  stand: "#3d4466",
  paper: "#fbf6ea",
  piano: "#34303f",
  keys: "#f6f2ea",
  riser: "#9f7a5c",
  spot: "#fff0c2",
  lamp: "#f6d98c",
  banner: "#7fb7a8",
  note: "#fbf6ea",
};

// The hall's scale (design px per model unit), and the spotlight's centre on the stage top,
// lighting the empty stage.
const CONCERT_K = 19.5;
const CONCERT_SPOT: Point = [4.9, 3.3, 1.7];

// Curtain pleats as alternating vertical stripes on a back wall face.
function pleats(
  on: "x" | "y",
  a0: number,
  a1: number,
  z0: number,
  z1: number,
  P: Palette,
  eps: number,
): Decal[] {
  const out: Decal[] = [];
  const w = 0.55;
  for (let a = a0; a + w <= a1 + 1e-6; a += w * 2) {
    out.push([on === "y" ? onY(eps, a, a + w, z0, z1) : onX(eps, a, a + w, z0, z1), P.fold!]);
  }
  return out;
}

function musicStand(
  s: Scene,
  P: Palette,
  [x, y, z]: Point,
  key: number,
  facing: "viewer" | "away" = "viewer",
) {
  s.solid(box(x - 0.05, x + 0.05, y - 0.05, y + 0.05, z, z + 2.3), P.stand!, 2, key);
  s.solid([flat(octagon(x, y, 0.38, 0, 3, 0.5), z + 0.02)], P.stand!, 2, key - 0.01);
  // The desk tilts back from the player: a thin slab facing the player.
  const sgn = facing === "viewer" ? -1 : 1;
  const half = 0.55;
  const t = 0.35 * sgn;
  const quad: Point[] = [
    [x - half * Math.SQRT1_2 + t * 0.5, y + half * Math.SQRT1_2 + t * 0.5, z + 2.0],
    [x + half * Math.SQRT1_2 + t * 0.5, y - half * Math.SQRT1_2 + t * 0.5, z + 2.0],
    [x + half * Math.SQRT1_2 - t * 0.2, y - half * Math.SQRT1_2 - t * 0.2, z + 2.85],
    [x - half * Math.SQRT1_2 - t * 0.2, y + half * Math.SQRT1_2 - t * 0.2, z + 2.85],
  ];
  const off = (p: Point, dz: number, dd: number): Point => [p[0] + dd, p[1] + dd, p[2] + dz];
  const front = quad.map((p) => off(p, 0, 0.04));
  s.solid(
    [
      quad,
      front.slice().reverse(),
      ...quad.map((p, i) => [p, quad[(i + 1) % 4]!, front[(i + 1) % 4]!, front[i]!]),
    ],
    facing === "viewer" ? P.stand! : P.paper!,
    2,
    key + 0.01,
  );
}

function chair(s: Scene, P: Palette, x: number, y: number, facing: "-y" | "-x", key: number) {
  // Seat 0.9 square at 1.0; the back on the side away from the stage.
  s.solid(box(x, x + 0.9, y, y + 0.9, 0.95, 1.1), P.chair!, 2, key);
  if (facing === "-y")
    s.solid(box(x, x + 0.9, y + 0.78, y + 0.9, 1.1, 2.15), P.chair!, 2, key + 0.002);
  else s.solid(box(x + 0.78, x + 0.9, y, y + 0.9, 1.1, 2.15), P.chair!, 2, key + 0.002);
  for (const [lx, ly] of [
    [x + 0.05, y + 0.05],
    [x + 0.75, y + 0.05],
    [x + 0.05, y + 0.75],
    [x + 0.75, y + 0.75],
  ] as const) {
    s.solid(box(lx, lx + 0.1, ly, ly + 0.1, 0, 0.95), P.chairleg!, 2, key - 0.001);
  }
}

function piano(s: Scene, P: Palette, x0: number, y0: number, z: number, key: number) {
  // An upright piano against the left wall, keyboard facing +x.
  s.solid(box(x0, x0 + 1.0, y0, y0 + 2.6, z, z + 2.9), P.piano!, 2, key);
  s.solid(box(x0 + 1.0, x0 + 1.55, y0, y0 + 2.6, z + 1.55, z + 1.75), P.piano!, 2, key + 0.01, [
    [onZ(z + 1.751, x0 + 1.02, x0 + 1.5, y0 + 0.1, y0 + 2.5), P.keys!],
  ]);
  s.solid(box(x0 + 1.0, x0 + 1.15, y0, y0 + 2.6, z, z + 1.55), P.piano!, 2, key + 0.005);
}

// The stage seen from the hall: a corner stage with curtains on both back walls, risers, music
// stands, an upright piano and a spotlight; rows of chairs on the hall floor face it.
function concertHall(P: Palette): Scene {
  const [nx, ny, wall] = [22, 18, 8];
  const k = CONCERT_K;
  const s = new Scene(k, [
    W / 2 - ((nx - ny) * R3 * k) / 2 + 30,
    6 - NEEDLE_LIFT * DESIGN_PER_LOGICAL + wall * k,
  ]);
  s.solid(box(0, nx, 0, ny, -0.8, 0), P.slab!, 0, 0);
  const boards: Decal[] = [];
  for (let j = 1; j < ny / 1.5; j++)
    boards.push([onZ(0.001, 0, nx, j * 1.5, j * 1.5 + 0.07), P.board!]);
  s.solid([onZ(0, 0, nx, 0, ny)], P.floor!, 0, 1, boards);
  const [sx, sy, sz] = [11.5, 8.0, 1.7];
  // Right wall (along x): curtains behind the stage, then tall windows.
  const right: Decal[] = [
    [onY(0.001, 0, nx, 0, 1.4), P.wains!],
    [onY(0.002, 0, sx, sz, wall - 0.9), P.curtain!],
    ...pleats("y", 0.3, sx - 0.3, sz, wall - 0.9, P, 0.003),
    [onY(0.004, 0, sx, wall - 1.4, wall - 0.6), P.valance!],
  ];
  for (const wx of [13.2, 17.2]) {
    right.push(
      [onY(0.002, wx, wx + 2.6, 2.4, 6.8), P.frame!],
      [onY(0.003, wx + 0.2, wx + 2.4, 2.6, 6.6), P.window!],
    );
    right.push([onY(0.004, wx + 1.22, wx + 1.38, 2.6, 6.6), P.frame!]);
  }
  s.solid(box(-0.6, nx, -0.6, 0, 0, wall), P.wall!, 1, 0, right);
  // Left wall (along y): curtains behind the stage, a banner with notes, double doors.
  const left: Decal[] = [
    [onX(0.001, 0, ny, 0, 1.4), P.wains!],
    [onX(0.002, 0, sy, sz, wall - 0.9), P.curtain!],
    ...pleats("x", 0.3, sy - 0.3, sz, wall - 0.9, P, 0.003),
    [onX(0.004, 0, sy, wall - 1.4, wall - 0.6), P.valance!],
    [onX(0.002, 9.4, 13.8, 0, 4.6), P.frame!],
    [onX(0.003, 9.6, 11.55, 0, 4.4), P.door!],
    [onX(0.003, 11.65, 13.6, 0, 4.4), P.door!],
    [onX(0.004, 10.0, 11.1, 2.6, 3.8), P.window!],
    [onX(0.004, 12.1, 13.2, 2.6, 3.8), P.window!],
    [onX(0.002, 14.6, 17.4, 4.4, 6.4), P.banner!],
  ];
  for (const [ny0, nz0] of [
    [15.1, 5.0],
    [16.0, 5.5],
    [16.8, 4.9],
  ] as const) {
    left.push(
      [onX(0.003, ny0, ny0 + 0.32, nz0, nz0 + 0.28), P.note!],
      [onX(0.003, ny0 + 0.24, ny0 + 0.32, nz0, nz0 + 0.8), P.note!],
    );
  }
  s.solid(box(-0.6, 0, 0, ny, 0, wall), P.wall!, 1, 0.5, left);
  // Stage: a raised corner platform, boards on top, a plum skirt.
  const top: Decal[] = [];
  for (let j = 1; j < sy / 1.2; j++)
    top.push([onZ(sz + 0.001, 0, sx, j * 1.2, j * 1.2 + 0.06), P.stageboard!]);
  s.solid(box(0, sx, 0, sy, 0, sz), P.stage!, 1, 1, [
    ...top,
    [onX(sx + 0.001, 0, sy, 0, sz - 0.18), P.skirt!],
    [onY(sy + 0.001, 0, sx, 0, sz - 0.18), P.skirt!],
  ]);
  // Steps at the stage's left front.
  s.solid(box(1.2, 3.2, sy, sy + 0.7, 0, sz * 0.66), P.stage!, 2, 9.5);
  s.solid(box(1.2, 3.2, sy + 0.7, sy + 1.4, 0, sz * 0.33), P.stage!, 2, 10.2);
  // Risers along the back curtains, music stands facing the hall, the piano at the left.
  s.solid(box(0, sx - 0.5, 0, 1.6, sz, sz + 0.5), P.riser!, 2, 2.5);
  s.solid(box(0, 1.6, 0, sy - 0.5, sz, sz + 0.5), P.riser!, 2, 2.6);
  piano(s, P, 1.7, 3.6, sz, 6.0);
  for (const mx of [6.0, 7.9, 9.8]) musicStand(s, P, [mx, 0.9, sz + 0.5], mx + 0.9);
  // The spotlight at centre stage.
  const spot = CONCERT_SPOT;
  s.lights.push({
    alpha: 0.55,
    colour: rgb(P.spot!),
    quads: [flat(octagon(spot[0], spot[1], 1.9, 0, 12, 0, 0.75), sz + 0.01)],
    soft: 2.5,
  });
  s.lights.push({
    alpha: 0.12,
    colour: rgb(P.spot!),
    hull: true,
    quads: [
      [
        ...flat(octagon(spot[0], spot[1], 1.9, 0, 12, 0, 0.75), sz + 0.01),
        ...flat(octagon(spot[0] - 1.5, spot[1] - 1.5, 0.35, 0, 8), wall + 3),
      ],
    ],
    soft: 4,
  });
  // Wall lamps between the windows.
  for (const lx of [16.4]) {
    s.solid(box(lx - 0.25, lx + 0.25, 0, 0.3, 4.6, 5.2), P.lamp!, 2, 0.6);
    s.glows.push({ at: [lx, 0.3, 4.9], colour: rgb(P.lamp!), peak: 90, radius: 1.3 });
  }
  // Rows of chairs facing the stage.
  for (const [r, cy] of [10.0, 12.0, 14.0, 16.0].entries()) {
    for (let cx = 0.8 + (r % 2) * 0.3; cx + 0.9 < sx - 0.2; cx += 1.4)
      chair(s, P, cx, cy, "-y", cx + cy + 1);
  }
  for (const [r, cx] of [13.6, 15.6, 17.6, 19.6].entries()) {
    for (let cy = 0.8 + (r % 2) * 0.3; cy + 0.9 < sy - 0.2; cy += 1.4)
      chair(s, P, cx, cy, "-x", cx + cy + 1);
  }
  return s;
}

/* Rock glow transition: the rock's glow washes Ada's room, then the ship from outside */

// Glow amounts of the transition frames; 1 is the approved full wash.
const GLOW = [1 / 3, 2 / 3, 1] as const;

// Each step cross-fades from the previous image to its background over fadeMs, then holds;
// fadeMs 0 is a cut. The aboard backdrop is aboard.ts's `aboard`.
const step = (background: string, fadeMs: number, holdMs: number) => ({
  background,
  fadeMs,
  holdMs,
});
// The glow from a room to the aboard backdrop, which every aboard page shares, standing or
// seated. Needle boards from the recorder room, whose frames keep the recorder on the desk.
const rockGlow = (room = "story-ada-room") => ({
  from: room,
  steps: [
    step(`${room}-glow-1`, 160, 0),
    step(`${room}-glow-2`, 160, 0),
    step(`${room}-glow-3`, 200, 240),
    step("aboard", 0, 0),
  ],
  reducedMotion: [step("aboard", 400, 0)],
});
export const TRANSITION = {
  version: 1,
  rockGlow: rockGlow(),
  rockGlowRecorder: rockGlow("story-ada-room-recorder"),
};

/* Outputs */

// The scene's subject band in canvas logical px: the rows its key objects span. The story page
// offsets the background so the band centres in the strip above the story panel
// (art/layout.md "Storybook page").
interface Subject {
  top: number;
  bottom: number;
}

interface Background {
  id: string;
  palette: Palette;
  build: Builder;
  subject: Subject;
}

const band = (top: number, bottom: number): Subject => ({ top, bottom });
// The rock on Ada's desk, shared by every room background with the desk in view.
const DESK_ROCK = band(255, 300);

// Compatibility aliases keep story background keys and run placement stable.
interface Composite {
  id: string;
  base: string;
}
const COMPOSITES: readonly Composite[] = [
  { id: "story-front-door-mom", base: "story-front-door" },
  { id: "story-ada-room-recorder-dad", base: "story-ada-room-recorder" },
  { id: "story-ada-room-unpolished-cats", base: "story-ada-room-unpolished" },
  { id: "story-ada-room-morning-cats", base: "story-ada-room-morning" },
];

// Scene order follows the story; the overnight recharge follows the chapters' scenes.
export const BACKGROUNDS: readonly Background[] = [
  // The dig spot and rock, the bench and the pond.
  { id: "story-park", palette: PARK, build: park, subject: band(220, 285) },
  { id: "story-ada-room-unpolished", palette: ROOM, build: (P) => room(P), subject: DESK_ROCK },
  {
    id: "story-ada-room",
    palette: ROOM,
    build: (P) => room(P, { glow: glowAmount(0) }),
    subject: DESK_ROCK,
  },
  ...GLOW.map((glow, i) => ({
    id: `story-ada-room-glow-${i + 1}`,
    palette: ROOM,
    build: (P: Palette) => room(P, { glow: glowAmount(glow) }),
    subject: DESK_ROCK,
  })),
  // The raised beds in bloom beside the house.
  { id: "story-grandma-garden", palette: GARDEN, build: garden, subject: band(199, 285) },
  // The sprouting bed, the two empty beds and the shed.
  { id: "story-community-garden", palette: LOT, build: lot, subject: band(180, 290) },
  // The play structure beside the school's door.
  { id: "story-schoolyard", palette: YARD, build: schoolyard, subject: band(168, 278) },
  // The notice board beside the near door.
  { id: "story-school-hallway", palette: HALL, build: hallway, subject: band(184, 290) },
  // Cartwheel's dinner: the table set for supper; preserve the story run's subject band.
  {
    id: "story-kitchen",
    palette: KITCHEN,
    build: kitchen,
    subject: band(146, 293),
  },
  // The coats and Penny's lead on their hooks by the door.
  { id: "story-front-door", palette: DOOR, build: frontDoor, subject: band(175, 280) },
  // Needle: the recorder and the rock on Ada's desk.
  {
    id: "story-ada-room-recorder",
    palette: ROOM,
    build: (P) => room(P, { glow: glowAmount(0), lift: NEEDLE_LIFT, recorder: true }),
    subject: band(248, 293),
  },
  ...GLOW.map((glow, i) => ({
    id: `story-ada-room-recorder-glow-${i + 1}`,
    palette: ROOM,
    build: (P: Palette) => room(P, { glow: glowAmount(glow), lift: NEEDLE_LIFT, recorder: true }),
    subject: band(248, 293),
  })),
  // Needle's closing: the stage and its spotlight.
  {
    id: "story-concert-hall",
    palette: CONCERT,
    build: concertHall,
    subject: band(188, 293),
  },
  // Andromeda: the seedling tray on the potting table, spilled, then replanted.
  {
    id: "story-grandma-garden-spilled",
    palette: GARDEN,
    build: (P) => garden(P, "spilled"),
    subject: band(176, 285),
  },
  {
    id: "story-grandma-garden-replanted",
    palette: GARDEN,
    build: (P) => garden(P, "replanted"),
    subject: band(176, 285),
  },
  // The rock's glow on the desk.
  {
    id: "story-ada-room-night",
    palette: NIGHT,
    build: (P) => night(P, NIGHT_GLOW),
    subject: band(250, 300),
  },
  // Morning sunlight on the empty bed and the rock; preserve the story run's subject band.
  {
    id: "story-ada-room-morning",
    palette: MORNING,
    build: morning,
    subject: band(255, 348),
  },
];

const subjectOf = (id: string) => BACKGROUNDS.find((background) => background.id === id)!.subject;

export function paint(palette: Palette, scene: Scene) {
  return treatmentD(CANVAS, palette.haze ?? TREATMENT.haze, render(CANVAS, palette.back, scene));
}

const storyPath = (id: string) => `/art/story/${id.replace(/^story-/, "")}.png`;

export const entry = (id: string, subject = subjectOf(id)) => ({
  id,
  path: storyPath(id),
  width: CANVAS.width * CANVAS.density,
  height: CANVAS.height * CANVAS.density,
  displayWidth: CANVAS.width,
  displayHeight: CANVAS.height,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  subject,
});

// An environment alias shares its base image, subject band and run placement.
const compositeEntry = ({ id, base }: Composite) => ({
  ...entry(id, subjectOf(base)),
  path: storyPath(base),
  base,
});

/* Overnight overlay: the rock's breath over the unoccupied night room */

// The pixels where `top` differs from `base`, grown by GROW px and cropped with PAD px more to
// an even box on the 2x canvas: opaque inside the grown difference, clear outside it. Drawn
// over `base` at `at` (logical px, top-left corner) it reproduces `top` exactly.
const GROW = 2;
const PAD = 6;

interface Overlay {
  at: { x: number; y: number };
  image: RgbaImage;
}

function overlay(base: RgbaImage, top: RgbaImage): Overlay {
  const { height, width } = top;
  const grown = new Uint8Array(width * height);
  let [x0, y0, x1, y1] = [width, height, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if ([0, 1, 2].every((ch) => base.data[i + ch] === top.data[i + ch])) continue;
      for (let j = Math.max(0, y - GROW); j <= Math.min(height - 1, y + GROW); j++) {
        grown.fill(1, j * width + Math.max(0, x - GROW), j * width + Math.min(width, x + GROW + 1));
      }
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  }
  const even = (v: number) => v - (v % 2);
  const left = even(Math.max(0, x0 - GROW - PAD));
  const upper = even(Math.max(0, y0 - GROW - PAD));
  const right = Math.min(width, even(x1 + GROW + PAD + 2));
  const lower = Math.min(height, even(y1 + GROW + PAD + 2));
  const image = blankImage(right - left, lower - upper);
  for (let y = upper; y < lower; y++) {
    for (let x = left; x < right; x++) {
      const from = (y * width + x) * 4;
      const to = ((y - upper) * image.width + x - left) * 4;
      image.data.set(top.data.subarray(from, from + 3), to);
      image.data[to + 3] = grown[y * width + x] ? 255 : 0;
    }
  }
  return { at: { x: left / CANVAS.density, y: upper / CANVAS.density }, image };
}

const SLEEP = "story-ada-room-sleep";
const SLEEP_GLOW = "story-ada-room-sleep-glow";
const OVERLAYS = [SLEEP_GLOW] as const;

// The rock's peak glow over the same unoccupied night room.
function overnightOverlays(): Record<(typeof OVERLAYS)[number], Overlay> {
  const base = paint(NIGHT, night(NIGHT, NIGHT_GLOW));
  const breath = paint(NIGHT, night(NIGHT, BREATH_GLOW));
  return { [SLEEP_GLOW]: overlay(base, breath) };
}

const overlayEntry = (id: string, { at, image }: Overlay) => ({
  id,
  path: storyPath(id),
  width: image.width,
  height: image.height,
  displayWidth: image.width / CANVAS.density,
  displayHeight: image.height / CANVAS.density,
  facing: "front",
  pivot: { x: 0, y: 0 },
  at,
});

// The sleep scene shares the night page's environment and run placement.
const sleepEntry = () => ({
  ...entry(SLEEP, subjectOf("story-ada-room-night")),
  path: storyPath("story-ada-room-night"),
  base: "story-ada-room-night",
});

// The overnight sleep scene, from the night page to the morning page, its steps in order:
// `overlay` fades that overlay in over fadeMs (0 shows it at once), then holds for holdMs;
// `breath` runs that overlay's alpha (1 - cos(2 pi t / ms)) / 2 over ms, 0 at both ends and 1
// midway; `background` cross-fades the whole picture to that background over fadeMs, then holds.
type Step =
  | { overlay: string; fadeMs: number; holdMs: number }
  | { breath: string; ms: number }
  | { background: string; fadeMs: number; holdMs: number };

const stepMs = (steps: readonly Step[]) =>
  steps.reduce((sum, step) => sum + ("ms" in step ? step.ms : step.fadeMs + step.holdMs), 0);

// Keep the existing morning page key as an environment-only alias.
const MORNING_PAGE = "story-ada-room-morning-cats";

function overnight(at: (id: string) => Overlay["at"]) {
  const steps: Step[] = [
    { background: "story-ada-room-night", fadeMs: 0, holdMs: 400 },
    { breath: SLEEP_GLOW, ms: 1500 },
    { background: MORNING_PAGE, fadeMs: 600, holdMs: 0 },
  ];
  const reducedMotion: Step[] = [
    { background: "story-ada-room-night", fadeMs: 0, holdMs: 2000 },
    { background: MORNING_PAGE, fadeMs: 400, holdMs: 0 },
  ];
  return {
    version: 1,
    overnight: {
      from: "story-ada-room-night",
      sleep: SLEEP,
      to: MORNING_PAGE,
      overlays: Object.fromEntries(OVERLAYS.map((id) => [id, { at: at(id) }])),
      steps,
      durationMs: stepMs(steps),
      reducedMotion,
      reducedMotionMs: stepMs(reducedMotion),
    },
  };
}

// Root manifest groups after the ship and portraits, in order; the story group leads.
const LATER = ["title-", "aboard", "stardust", "holodisk", "quantum-jump", "station-", "enemy-"];

export function placeStoryEntries(entries: readonly { id: string }[]) {
  editManifest("core", (manifest) => {
    const kept = manifest.assets.filter(({ id }) => !id.startsWith("story-"));
    const next = kept.findIndex(({ id }) => LATER.some((prefix) => id.startsWith(prefix)));
    const at = next === -1 ? kept.length : next;
    manifest.assets = [...kept.slice(0, at), ...entries, ...kept.slice(at)];
    manifest.storyTransition = "/art/story-transition.json";
    manifest.storyOvernight = "/art/story-overnight.json";
  });
}

const file = (id: string) => `${art}${storyPath(id).slice("/art/".length)}`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2];
  for (const { build, id, palette } of BACKGROUNDS) {
    if (only && only !== id) continue;
    writePng(file(id), paint(palette, build(palette)), true);
  }
  // The overlays rebuild with the night background; other single-id runs keep their entries.
  const rebuild = !only || only === "story-ada-room-night" || OVERLAYS.some((id) => id === only);
  let overlays: { at: Overlay["at"]; id: string }[];
  if (rebuild) {
    const glow = overnightOverlays();
    for (const id of OVERLAYS) writePng(file(id), glow[id].image);
    overlays = OVERLAYS.map((id) => overlayEntry(id, glow[id]));
  } else {
    const assets = readManifest("core").assets as { at: Overlay["at"]; id: string }[];
    overlays = OVERLAYS.map((id) => assets.find((asset) => asset.id === id)!);
  }
  placeStoryEntries([
    ...BACKGROUNDS.flatMap(({ id }) =>
      id === "story-ada-room-night"
        ? [entry(id), sleepEntry(), ...overlays]
        : [entry(id), ...COMPOSITES.filter(({ base }) => base === id).map(compositeEntry)],
    ),
  ]);
  writeFileSync(`${art}story-transition.json`, json(TRANSITION));
  const at = (id: string) => overlays.find((asset) => asset.id === id)!.at;
  writeFileSync(`${art}story-overnight.json`, json(overnight(at)));
}
