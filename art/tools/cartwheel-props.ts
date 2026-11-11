// Cartwheel props: traveling debris (a bent hull plate tumbling through 8 frames), the ore
// nugget cargo piece, and the two stranded craft a tow job brings home (the ore pod and the stuck
// hauler) at sixteen headings, with the tow line spec. Writes SVGs, the nugget sheet and
// debris.json and tow.json to public/art/cartwheel/, and the root manifest entries and links.
// Usage: node art/tools/cartwheel-props.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

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
import { linkData, replaceEntries } from "./manifest.ts";
import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
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

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const dir = `${art}cartwheel/`;
mkdirSync(dir, { recursive: true });

const palette = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const cartwheel = (
  JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
    galaxies: {
      id: string;
      tint: { chroma: number; hue: number };
      colors: Record<string, string>;
    }[];
  }
).galaxies.find(({ id }) => id === "cartwheel")!;

// World light, from above and screen-left of the viewer (ship.ts LIGHT).
const LIGHT = unit([-0.25, 0.45, 1]);
// Same-colour seam stroke in frame px: hides anti-aliasing cracks between facets.
const SEAM = 1.2;

type Face = { color: string; points: Point[] };

function unit([x, y, z]: Point): Point {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normal(points: readonly Point[]): Point {
  let [nx, ny, nz] = [0, 0, 0];
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

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
  writeFileSync(
    path,
    await format(json(value), { ...(await resolveConfig(path)), filepath: path }),
  );
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
    // Miner A with its power off: dark glass, dim lights, no jets, listing to port, nose down.
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
// Contour outside the silhouette, in display px.
const CONTOUR = 1.5;
const TUMBLE_FRAMES = 8;
const TUMBLE_AXIS = unit([0.4, 1, 0.6]);
const DEBRIS_SCALE = 1.25;

// Body ramp, lit to shadow: the galaxy's environmentDetail lightness lifted by these steps, at
// the galaxy tint hue with BODY_CHROMA times its chroma: muted field matter, never the neutral
// stone of harmless rocks.
const BODY_LIFT = [0.2, 0.15, 0.1, 0.06, 0.03] as const;
const BODY_CHROMA = 1.3;

function bodyRamp(environmentDetail: string, chroma: number, hue: number): string[] {
  const [L] = toOklab(rgb(environmentDetail));
  const r = (hue * Math.PI) / 180;
  return BODY_LIFT.map((d) =>
    hex(
      fromOklab(L + d, chroma * BODY_CHROMA * Math.cos(r), chroma * BODY_CHROMA * Math.sin(r)),
    ).toUpperCase(),
  );
}
const BODY = bodyRamp(
  cartwheel.colors.environmentDetail!,
  cartwheel.tint.chroma,
  cartwheel.tint.hue,
);

type Solid = { faces: Point[][]; accent?: boolean }[];

// A closed prism from a plan polygon (counterclockwise), z0 to z1.
function prism(plan: readonly (readonly [number, number])[], z0: number, z1: number): Point[][] {
  const out: Point[][] = [
    plan.map(([x, y]): Point => [x, y, z1]),
    plan.map(([x, y]): Point => [x, y, z0]).toReversed(),
  ];
  for (const [i, a] of plan.entries()) {
    const b = plan[(i + 1) % plan.length]!;
    out.push([
      [a[0], a[1], z0],
      [b[0], b[1], z0],
      [b[0], b[1], z1],
      [a[0], a[1], z1],
    ]);
  }
  return out;
}

const ccw = (plan: [number, number][]) => {
  const a = plan.reduce((s, p, i) => {
    const q = plan[(i + 1) % plan.length]!;
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  return a > 0 ? plan : plan.toReversed();
};

// Design A: a bent hull plate, torn on one edge, folded along a rib.
function bentPlate(): Solid {
  const left = ccw([
    [-30, -14],
    [-4, -16],
    [-2, 14],
    [-22, 18],
    [-27, 9],
    [-34, 6],
  ]);
  const right = ccw([
    [-2, -16],
    [22, -12],
    [30, -2],
    [24, 4],
    [28, 12],
    [0, 14],
  ]);
  const fold = (faces: Point[][], a: number): Point[][] =>
    faces.map((f) =>
      f.map(([x, y, z]): Point =>
        x > -2 ? [-2 + (x + 2) * Math.cos(a), y, z + (x + 2) * Math.sin(a)] : [x, y, z],
      ),
    );
  return [
    { faces: prism(left, -2.5, 2.5) },
    { faces: fold(prism(right, -2.5, 2.5), 0.55) },
    {
      faces: prism(
        ccw([
          [-5, -17],
          [1, -17],
          [1, 15],
          [-5, 15],
        ]),
        2.5,
        6.5,
      ),
      accent: true,
    },
  ];
}

function turn(axis: Point, angle: number, [x, y, z]: Point): Point {
  const [u, v, w] = axis;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = u * x + v * y + w * z;
  return [
    u * d * (1 - c) + x * c + (-w * y + v * z) * s,
    v * d * (1 - c) + y * c + (w * x - u * z) * s,
    w * d * (1 - c) + z * c + (-v * x + u * y) * s,
  ];
}

// Facets take a body tone by the light; the rib sits one tone deeper.
function debrisTone(face: readonly Point[], accent: boolean): string {
  const l = dot(unit(normal(face)), LIGHT);
  const steps = [0.9, 0.7, 0.45, 0.15];
  const i = steps.findIndex((s) => l >= s);
  return BODY[Math.min(BODY.length - 1, (i < 0 ? BODY.length - 1 : i) + (accent ? 1 : 0))]!;
}

function exportDebris(id: string, title: string, solid: Solid) {
  const frames = Array.from({ length: TUMBLE_FRAMES }, (_, k) =>
    solid.flatMap(({ accent, faces }) =>
      faces.map((f) => ({
        accent: accent ?? false,
        face: f.map((p) => {
          const q = turn(TUMBLE_AXIS, (k * 2 * Math.PI) / TUMBLE_FRAMES, p);
          return [q[0] * DEBRIS_SCALE, q[1] * DEBRIS_SCALE, q[2] * DEBRIS_SCALE] as Point;
        }),
      })),
    ),
  );
  // Contour stroke in frame px: twice the contour, half of it outside the silhouette.
  const stroke = (2 * CONTOUR) / DISPLAY_SCALE;
  const all = frames.flat().flatMap(({ face }) => face.map((p) => projectAt(0, 0, p)));
  const pad = Math.ceil(stroke / 2) + 3;
  const half = Math.ceil(Math.max(...all.map(([x]) => Math.abs(x)))) + pad;
  const top = Math.ceil(-Math.min(...all.map(([, y]) => y))) + pad;
  const w = half * 2;
  const h = top + Math.ceil(Math.max(...all.map(([, y]) => y))) + pad;
  const files = frames.map((faces, k) => {
    const visible = faces
      .filter(({ face }) => facesViewer(face))
      .toSorted((a, b) => depth(b.face) - depth(a.face))
      .map(({ accent, face }) => ({
        fill: debrisTone(face, accent),
        pts: face.map((p) => projectAt(half, top, p)),
      }));
    // Coral contour: every visible face stroked wide in coral underneath, then the faces.
    const under = visible.map(
      ({ pts }) =>
        `  <polygon fill="${CORAL}" stroke="${CORAL}" stroke-width="${stroke.toFixed(2)}" stroke-linejoin="round" points="${points(pts)}"/>`,
    );
    const body = visible.map(
      ({ fill, pts }) =>
        `  <polygon fill="${fill}" stroke="${fill}" stroke-width="${SEAM}" stroke-linejoin="round" points="${points(pts)}"/>`,
    );
    const file = `${id}-${k}`;
    writeFileSync(`${dir}${file}.svg`, svg(`${title} ${k}`, w, h, [...under, ...body]));
    const drawn = visible.flatMap(({ pts }) => pts);
    const xs = drawn.map(([x]) => x);
    const ys = drawn.map(([, y]) => y);
    const outside = stroke / 2;
    return {
      file,
      bounds: [
        r2(Math.min(...xs) - outside),
        r2(Math.min(...ys) - outside),
        r2(Math.max(...xs) + outside),
        r2(Math.max(...ys) + outside),
      ],
      reach: Math.max(...drawn.map(([x, y]) => Math.hypot(x - half, y - top))) + outside,
    };
  });
  const pivot = { x: 0.5, y: Math.round((top / h) * 1e5) / 1e5 };
  const entries = files.map(({ file }, k) => ({
    id: file,
    path: `/art/cartwheel/${file}.svg`,
    width: w,
    height: h,
    displayWidth: w * DISPLAY_SCALE,
    displayHeight: h * DISPLAY_SCALE,
    facing: "front",
    tumbleIndex: k,
    pivot,
    debris: id,
  }));
  const data = {
    id,
    frame: { width: w, height: h },
    display: { width: w * DISPLAY_SCALE, height: h * DISPLAY_SCALE },
    pivot: [pivot.x, pivot.y],
    radius: r2(Math.max(...files.map(({ reach }) => reach))),
    frames: files.map(({ bounds, file }) => ({ file: `/art/cartwheel/${file}.svg`, bounds })),
  };
  return { data, entries };
}

// ------------------------------------------------------------------ ore nugget

// 11 by 11 ore nugget, pixel art: "W" highlight, "L" light, "M" body, "S" shade, "D" deep.
const NUGGET_PALETTE: Readonly<Record<string, string>> = {
  W: "d2f7f2",
  L: "9ee5dd",
  M: "65c9bf",
  S: "3e9189",
  D: "2f6f69",
};
const NUGGET = [
  "...........",
  "....LL.....",
  "...LWMM....",
  "..LWWMMS...",
  ".LWWMMMSS..",
  ".LWMMMSSSD.",
  "..MMMSSSSD.",
  "..MMSSSDD..",
  "...SSDDD...",
  "....DD.....",
  "...........",
];
const nuggetFrame = (rows: readonly string[]): Frame =>
  rows.map((row) => [...row].map((cell) => NUGGET_PALETTE[cell] ?? null));

// ------------------------------------------------------------------ main

const debris = exportDebris("cartwheel-debris", "Cartwheel debris", bentPlate());
const craft = CRAFT.map(exportCraft);

await writeSpriteSheet(
  { data: `${dir}ore-nugget.json`, sheet: `${dir}ore-nugget.png` },
  { key: "ore-nugget" },
  [["rest", [nuggetFrame(NUGGET)], 100]],
);
const nuggetData = `${dir}ore-nugget.json`;
writeFileSync(
  nuggetData,
  await format(readFileSync(nuggetData, "utf8"), {
    ...(await resolveConfig(nuggetData)),
    filepath: nuggetData,
  }),
);
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

// Direction mark, logical px: three coral dashes trailing a traveling debris piece. Dash i is
// centred `behind` px past the edge of its frame's drawn bounds along the reverse velocity and
// `side` px to the left of travel.
const MARKS = {
  color: CORAL,
  width: 2,
  dashes: [
    { length: 9, alpha: 0.95, behind: 7.5, side: -3 },
    { length: 6, alpha: 0.7, behind: 14.5, side: 3 },
    { length: 4, alpha: 0.45, behind: 21.5, side: 0 },
  ],
};

await writeJson(`${dir}debris.json`, {
  version: 1,
  displayScale: DISPLAY_SCALE,
  body: BODY,
  contour: { color: CORAL, width: CONTOUR },
  tumble: { frames: TUMBLE_FRAMES, degPerSecond: [60, 120] },
  marks: MARKS,
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

const owned =
  /^cartwheel-debris-\d+$|^craft-stranded-hauler-\d+$|^craft-stranded-ore-pod-\d+-[ab]$|^ore-nugget$/;
replaceEntries(
  (id) => owned.test(id),
  [nugget, ...debris.entries, ...craft.flatMap(({ entries }) => entries)],
);

// The root manifest names the debris and tow data next to the other data files.
linkData({ cartwheelDebris: "/art/cartwheel/debris.json", tow: "/art/cartwheel/tow.json" });
