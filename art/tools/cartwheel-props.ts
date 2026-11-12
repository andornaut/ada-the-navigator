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
  type Facing,
  hauler,
  HAULER_LEVELS,
  HAULER_TOW,
  orePod,
  type Part,
  type Plan,
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
import {
  depth,
  ENEMY_HEADINGS,
  facesViewer,
  json,
  type Point,
  projectAt,
  rotate,
  round,
} from "./projection.ts";
import { traceGrid, withCollision } from "./silhouette.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";

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

type Face = { color: string; points: Point[] };

// The viewBox stays in frame px; the intrinsic size is the display size, so the frame
// rasterizes at the size it is drawn.
function svg(title: string, w: number, h: number, polygons: readonly string[]): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * DISPLAY_SCALE}" height="${h * DISPLAY_SCALE}" viewBox="0 0 ${w} ${h}">`,
    `  <title>${title}</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

const points = (list: readonly (readonly [number, number])[]) =>
  list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

// JSON goes through the project's Prettier settings so the files stay Prettier-clean.
async function writeJson(path: string, value: unknown): Promise<void> {
  writeFileSync(path, json(value));
  await prettify(path);
}

// ------------------------------------------------------------------ solids

// Every face of an extruded part in local units: bottom, sides, top, each wound outward.
// Rear-facing walls (behind the centre, running across the craft) take the rear shade, as in
// crafts.ts.
function partFaces(part: Part): Face[] {
  const at = (plan: Plan, z: number) => plan.map(([x, y]): Point => [x, y, z]);
  const plan = facesViewer(at(part.plan, part.z1)) ? part.plan : part.plan.toReversed();
  const faces: Face[] = [{ color: part.side, points: at(plan, part.z0).toReversed() }];
  for (const [i, a] of plan.entries()) {
    const b = plan[(i + 1) % plan.length]!;
    const rear =
      part.rear !== undefined &&
      (a[1] + b[1]) / 2 > 0 &&
      Math.abs(a[1] - b[1]) < Math.abs(a[0] - b[0]);
    faces.push({
      color: rear ? part.rear! : part.side,
      points: [
        [b[0], b[1], part.z1],
        [a[0], a[1], part.z1],
        [a[0], a[1], part.z0],
        [b[0], b[1], part.z0],
      ],
    });
  }
  faces.push({ color: part.top, points: at(plan, part.z1) });
  return faces;
}

// A craft pose: local tilt (roll about the forward axis, then pitch, radians), the heading and the
// model scale. Heading k faces world angle k * 22.5 degrees, as for the enemies.
type Pose = { roll: number; pitch: number; yaw: number; scale: number };

function posed({ pitch, roll, scale, yaw }: Pose, [x, y, z]: Point): Point {
  const [x1, z1] = [
    x * Math.cos(roll) + z * Math.sin(roll),
    -x * Math.sin(roll) + z * Math.cos(roll),
  ];
  const [y2, z2] = [
    y * Math.cos(pitch) - z1 * Math.sin(pitch),
    y * Math.sin(pitch) + z1 * Math.cos(pitch),
  ];
  const [rx, ry, rz] = rotate(ENEMY_HEADINGS, yaw, [x1 * scale, y2 * scale, z2 * scale]);
  return [rx, ry, rz];
}

// A craft-local wall normal faces the viewer when its posed normal leans toward the view.
const facingAt =
  (pose: Pose): Facing =>
  (nx, ny) => {
    const [wx, wy] = rotate(ENEMY_HEADINGS, pose.yaw, [nx, ny, 0]);
    return wx + wy > 0.3;
  };

// Groups draw far to near by their first part's centre; groups based at or above a level
// (hull top, cab top) draw after those below it. Parts in a group keep list order.
function craftFaces(groups: readonly Part[][], levels: readonly number[], pose: Pose): Face[] {
  return groups
    .map((group) => {
      const first = group[0]!;
      const centre = first.plan.map(([x, y]) => posed(pose, [x, y, (first.z0 + first.z1) / 2]));
      const layer = levels.filter((level) => first.z0 >= level).length;
      return { depth: depth(centre), group, layer };
    })
    .sort((a, b) => a.layer - b.layer || b.depth - a.depth)
    .flatMap(({ group }) =>
      group.flatMap(partFaces).map(({ color, points: list }) => ({
        color,
        points: list.map((p) => posed(pose, p)),
      })),
    )
    .filter(({ points: list }) => facesViewer(list));
}

interface CraftSpec {
  id: string;
  title: string;
  scale: number;
  roll: number;
  pitch: number;
  levels: readonly number[];
  tow: readonly [number, number, number];
  // Frame names and the model for each; one name for a craft without a blink.
  frames: readonly { name: string; build: (facing: Facing) => Part[][] }[];
}

const DEG = Math.PI / 180;

const CRAFT: readonly CraftSpec[] = [
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
const BLINK_MS = 700;

function exportCraft(spec: CraftSpec) {
  const poses = Array.from({ length: ENEMY_HEADINGS }, (_, yaw): Pose => ({
    pitch: spec.pitch,
    roll: spec.roll,
    scale: spec.scale,
    yaw,
  }));
  const drawn = poses.map((pose) =>
    spec.frames.map(({ build, name }) => ({
      faces: craftFaces(build(facingAt(pose)), spec.levels, pose),
      name,
    })),
  );
  // The smallest square frame, a multiple of 16 px, holding every heading with 4 px padding
  // around a centred pivot, as for the story craft.
  const reach = Math.max(
    ...drawn
      .flat()
      .flatMap(({ faces }) => faces.flatMap((f) => f.points.map((p) => projectAt(0, 0, p))))
      .map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))),
  );
  const size = Math.ceil((2 * (reach + 4)) / 16) * 16;
  const c = size / 2;
  const entries = [];
  const headings = [];
  for (const [yaw, frames] of drawn.entries()) {
    for (const { faces, name } of frames) {
      const file = name ? `${spec.id}-${yaw}-${name}` : `${spec.id}-${yaw}`;
      const polygons = faces.map(
        ({ color, points: list }) =>
          `  <polygon fill="${color}" points="${points(list.map((p) => projectAt(c, c, p)))}"/>`,
      );
      writeFileSync(
        `${dir}${file}.svg`,
        svg(`${spec.title} ${yaw}${name ? ` ${name}` : ""}`, size, size, polygons),
      );
      entries.push({
        id: `craft-${file}`,
        path: `/art/cartwheel/${file}.svg`,
        width: size,
        height: size,
        displayWidth: size * DISPLAY_SCALE,
        displayHeight: size * DISPLAY_SCALE,
        facing: `world-${yaw}`,
        directionIndex: yaw,
        pivot: { x: 0.5, y: 0.5 },
        ...(name ? { blink: name, frameMs: BLINK_MS } : {}),
        craft: spec.id,
      });
    }
    const [tx, ty] = projectAt(c, c, posed(poses[yaw]!, spec.tow));
    headings.push({ index: yaw, tow: [round(tx), round(ty)] });
  }
  const data = {
    id: spec.id,
    frame: size,
    display: size * DISPLAY_SCALE,
    ...(spec.frames.length > 1
      ? { blink: spec.frames.map(({ name }) => name), frameMs: BLINK_MS }
      : {}),
    headings,
  };
  return { data, entries };
}

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
const craft = CRAFT.map(exportCraft);

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
linkData("cartwheel", { cartwheelDebris: "/art/cartwheel/debris.json" });
