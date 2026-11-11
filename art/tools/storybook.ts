// Storybook backgrounds: seven isometric Earth dioramas with treatment d, on the shared
// 960 by 540 logical canvas at 2x.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  Scene,
  slab,
  treatmentD,
  writePng,
} from "./diorama.ts";
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
};

// The house sits at the left corner and the beds at the right, along one screen-horizontal
// band, so both stay above the story panel.
function garden(P: Palette): Scene {
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
  for (const y0 of [2.4, 5.8]) {
    s.solid(box(12.5, 21.5, y0, y0 + 2.2, 0, 0.8), P.bed!, 2, 12.5 + y0, [
      [onZ(0.801, 12.75, 21.25, y0 + 0.25, y0 + 1.95), P.soil!],
    ]);
    for (let i = 0; i < 6; i++) {
      const x = 13.4 + i * 1.6;
      const key = x + y0 + 1.5;
      s.solid(frustum(x, y0 + 1.1, 0.55, 0.35, 6, 0.8, 1.9), P.plant!, 2, key);
      s.solid(prism(x, y0 + 1.1, 0.28, 6, 1.9, 2.15), P[`bloom${(i % 3) + 1}`]!, 2, key + 0.1);
    }
  }
  s.solid(box(5.0, 5.7, 5.0, 5.7, 0, 3.2), P.trunk!, 2, 8);
  s.solid(frustum(5.35, 5.35, 2.2, 2.4, 8, 2.8, 4.6, 0.39), P.crown!, 2, 8.2);
  s.solid(frustum(5.35, 5.35, 2.4, 1.2, 8, 4.6, 6.0, 0.39), P.crown!, 2, 8.3);
  s.solid(box(11.2, 12.0, 6.0, 6.7, 0, 0.8), P.can!, 2, 18);
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
};

// The rock on the desk, in model units.
export const ROCK: Point = [3.0, 1.4, 3.05];

// glow: undefined draws the unpolished rock; 0 the faint polished pattern; 1 fills the room.
function room(P: Palette, glow?: number): Scene {
  const [nx, ny, wall] = [16, 12, 7];
  const s = fitted(nx, ny, wall);
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
    [onY(0.003, 10.2, 10.4, 2.9, 5.5), P.trim!],
    [onY(0.004, 7.4, 8.4, 2.2, 6.2), P.curtain!],
    [onY(0.004, 12.2, 13.2, 2.2, 6.2), P.curtain!],
    [onY(0.002, 1.2, 3.6, 3.6, 6.2), P.poster!],
  ];
  for (const [sx, sz] of [
    [1.8, 5.4],
    [2.9, 4.6],
    [2.0, 4.2],
  ] as const) {
    right.push([onY(0.003, sx - 0.18, sx + 0.18, sz - 0.18, sz + 0.18), P.star!]);
  }
  s.solid(box(-0.6, nx, -0.6, 0, 0, wall), P.wall!, 1, 0, right);
  s.solid(box(-0.6, 0, 0, ny, 0, wall), P.wall!, 1, 0.5);
  // Shelf of collected rocks on the left wall.
  s.solid(box(0, 0.9, 2.2, 6.2, 4.2, 4.4), P.shelf!, 2, 2);
  ["pebble1", "pebble2", "pebble3", "pebble1"].forEach((c, i) => {
    s.solid(frustum(0.45, 2.8 + i * 0.95, 0.32, 0.22, 6, 4.4, 4.75), P[c]!, 2, 2.1 + i * 0.01);
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
  s.solid(box(1.0, 6.8, 0, 2.8, 2.3, 2.6), P.desk!, 2, 6.0);
  s.solid(frustum(6.0, 0.9, 0.38, 0.38, 8, 2.6, 2.75), P.lamp!, 2, 6.6);
  s.solid(box(5.95, 6.05, 0.85, 0.95, 2.75, 3.8), P.lamp!, 2, 6.7);
  s.solid(frustum(6.0, 0.9, 0.62, 0.32, 8, 3.6, 4.2), P.shade!, 2, 6.8);
  s.solid(box(4.0, 5.0, 1.8, 2.5, 2.6, 2.65), P.cloth!, 2, 6.4);
  const [rx, ry, rz] = ROCK;
  const line: Decal[] =
    glow === undefined ? [] : [[flat(octagon(rx, ry, 0.22, 0, 8, 0.2), rz + 0.001), P.glowline!]];
  s.solid(frustum(rx, ry, 0.62, 0.42, 8, 2.6, rz, 0.2), P.rock!, 2, 6.5, line);
  if (glow !== undefined) {
    s.glows.push({
      at: ROCK,
      colour: rgb(P.glow!),
      peak: 150 + Math.trunc(glow * 105),
      radius: 1.4 + glow * 16,
    });
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
    [onX(0.002, 1.2, 6.6, 2.4, 5.8), P.board!],
    [onX(0.003, 1.4, 6.4, 2.6, 5.6), P.cork!],
  ];
  for (const [y0, z0, c] of [
    [1.8, 4.0, "paper1"],
    [2.9, 3.0, "paper3"],
    [4.0, 4.2, "paper2"],
    [5.1, 3.2, "paper4"],
  ] as const) {
    left.push([onX(0.004, y0, y0 + 0.9, z0, z0 + 1.2), P[c]!]);
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
  // Play structure: posts, deck, roof, slide and climbing bars.
  for (const [cx, cy] of [
    [13, 5],
    [15.8, 5],
    [13, 7.8],
    [15.8, 7.8],
  ] as const) {
    s.solid(box(cx, cx + 0.25, cy, cy + 0.25, 0, 4.8), P.post!, 2, cx + cy);
  }
  s.solid(box(12.9, 16.2, 4.9, 8.2, 2.6, 2.95), P.deck!, 2, 21.0);
  s.solid(gable(12.7, 16.4, 4.7, 8.4, 4.8, 6.0), P.bars!, 2, 21.5);
  const ramp: Face = [
    [16.2, 5.8, 2.95],
    [20.2, 5.8, 0.2],
    [20.2, 7.2, 0.2],
    [16.2, 7.2, 2.95],
  ];
  s.solid(slab(ramp, 0.25), P.slide!, 2, 24);
  for (const z of [0.8, 1.6, 2.4])
    s.solid(box(13.0, 16.0, 8.2, 8.35, z, z + 0.14), P.bars!, 2, 21.2);
  for (const cx of [13.0, 16.0]) s.solid(box(cx, cx + 0.14, 8.2, 8.35, 0, 2.6), P.bars!, 2, 21.3);
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
    [onY(0.002, 0.8, 6.4, 4.7, 4.95), P.rail!],
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
  // Coats and the lead on the hooks.
  s.solid(box(1.2, 2.6, 0, 0.5, 2.2, 4.8), P.coat1!, 2, 1.5);
  s.solid(box(3.0, 4.3, 0, 0.5, 2.6, 4.8), P.coat2!, 2, 3.0);
  s.solid(box(5.2, 5.35, 0, 0.15, 3.1, 4.8), P.leash!, 2, 5.0);
  s.solid(box(4.95, 5.6, 0, 0.15, 2.6, 3.1), P.leash!, 2, 5.1);
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

/* Outputs */

interface Background {
  id: string;
  palette: Palette;
  build: Builder;
}

// Scene order follows the story.
export const BACKGROUNDS: readonly Background[] = [
  { id: "story-park", palette: PARK, build: park },
  { id: "story-ada-room-unpolished", palette: ROOM, build: (P) => room(P) },
  { id: "story-ada-room", palette: ROOM, build: (P) => room(P, 0) },
  { id: "story-grandma-garden", palette: GARDEN, build: garden },
  { id: "story-community-garden", palette: LOT, build: lot },
  { id: "story-schoolyard", palette: YARD, build: schoolyard },
  { id: "story-school-hallway", palette: HALL, build: hallway },
  { id: "story-front-door", palette: DOOR, build: frontDoor },
];

export const roomGlow = (glow: number) => room(ROOM, glow);

export function paint(palette: Palette, scene: Scene) {
  return treatmentD(CANVAS, render(CANVAS, palette.back, scene));
}

export const entry = (id: string) => ({
  id,
  path: `/art/story/${id.replace(/^story-/, "")}.png`,
  width: CANVAS.width * CANVAS.density,
  height: CANVAS.height * CANVAS.density,
  displayWidth: CANVAS.width,
  displayHeight: CANVAS.height,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
});

// Root manifest groups after the ship and portraits, in order; the story group leads.
const LATER = ["cockpit", "stardust", "holodisk", "quantum-jump", "station-", "enemy-"];

export function placeStoryEntries(entries: readonly { id: string }[]) {
  const path = `${art}manifest.json`;
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { assets: { id: string }[] };
  const kept = manifest.assets.filter(({ id }) => !id.startsWith("story-"));
  const next = kept.findIndex(({ id }) => LATER.some((prefix) => id.startsWith(prefix)));
  const at = next === -1 ? kept.length : next;
  manifest.assets = [...kept.slice(0, at), ...entries, ...kept.slice(at)];
  writeFileSync(path, json(manifest));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2];
  for (const { build, id, palette } of BACKGROUNDS) {
    if (only && only !== id) continue;
    writePng(`${art}${entry(id).path.slice("/art/".length)}`, paint(palette, build(palette)));
  }
  placeStoryEntries(BACKGROUNDS.map(({ id }) => entry(id)));
}
