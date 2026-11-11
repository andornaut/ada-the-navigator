import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  anchor,
  depth,
  facesViewer,
  HEADINGS,
  json,
  type Point,
  project,
  rotate,
  round,
  vector,
} from "./projection.ts";

type Plan = readonly (readonly [number, number])[];
type Part = { plan: Plan; z0: number; z1: number; top: string; side: string; rear?: string };
type Craft = {
  name: string;
  title: string;
  frame: number;
  parts: Part[];
  mouths: [number, number][];
  mouthWidth: number;
};
type Face = { color: string; points: Point[] };

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const output = `${art}enemies/`;
// Frame px to Ada's logical display px: 42 / 96.
const DISPLAY_SCALE = 0.4375;
const MOUTH_Z = 2;

const coral = "#d68b72";
const coralSide = "#a8654f";
const coralRear = "#7f4b3d";
const plate = "#e6a890";
const amber = "#f0bd68";
const amberSide = "#b98a40";
const visor = "#2a2433";
const visorSide = "#1e1a26";

const mirror = (half: Plan): Plan => [
  ...half,
  ...half.toReversed().map(([x, y]) => [-x, y] as const),
];
const box = (x0: number, y0: number, x1: number, y1: number): Plan => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

const crafts: Craft[] = [
  {
    // Small beetle with forward mandibles.
    name: "swarm",
    title: "Swarm",
    frame: 80,
    parts: [
      {
        plan: mirror([
          [0, -10],
          [5, -20],
          [9.5, -19],
          [14, -4],
          [12.5, 10],
          [4.5, 16],
        ]),
        z0: 0,
        z1: 3,
        top: coral,
        side: coralSide,
        rear: coralRear,
      },
      { plan: box(-3.2, -6, 3.2, 0), z0: 3, z1: 4.5, top: amber, side: amberSide },
    ],
    mouths: [[0, 16]],
    mouthWidth: 4,
  },
  {
    // Baseline salvager: horseshoe pincers with a gun at each claw tip.
    name: "fighter",
    title: "Fighter",
    frame: 96,
    parts: [
      {
        plan: mirror([
          [0, -10],
          [7, -13],
          [11, -29],
          [19, -26],
          [21, 4],
          [12, 16],
          [5, 20],
        ]),
        z0: 0,
        z1: 4,
        top: coral,
        side: coralSide,
        rear: coralRear,
      },
      { plan: box(-12, -2, -3, 10), z0: 4, z1: 5, top: plate, side: coralSide },
      { plan: box(-3.5, -9, 3.5, -3), z0: 4, z1: 6, top: visor, side: visorSide },
      { plan: box(-17.5, -34, -14.5, -24), z0: 2, z1: 5, top: amber, side: amberSide },
      { plan: box(14.5, -34, 17.5, -24), z0: 2, z1: 5, top: amber, side: amberSide },
    ],
    mouths: [
      [-8, 18],
      [8, 18],
    ],
    mouthWidth: 4,
  },
  {
    // Long narrow needle with twin forward tines.
    name: "interceptor",
    title: "Interceptor",
    frame: 88,
    parts: [
      {
        plan: mirror([
          [1.5, -12],
          [3.5, -30],
          [6, -30],
          [6, -6],
          [10, 10],
          [5, 16],
        ]),
        z0: 0,
        z1: 3.5,
        top: coral,
        side: coralSide,
        rear: coralRear,
      },
      { plan: box(-2.5, -6, 2.5, 4), z0: 3.5, z1: 5.5, top: visor, side: visorSide },
      { plan: box(-1, -30, 1, -14), z0: 1.5, z1: 3, top: amber, side: amberSide },
    ],
    mouths: [[0, 16]],
    mouthWidth: 6,
  },
  {
    // Broad heavy workshop slab with a three-barrel turret.
    name: "retaliator",
    title: "Retaliator",
    frame: 192,
    parts: [
      {
        plan: mirror([
          [0, -20],
          [14, -20],
          [24, -32],
          [40, -26],
          [43, 10],
          [32, 28],
        ]),
        z0: 0,
        z1: 7,
        top: coral,
        side: coralSide,
        rear: coralRear,
      },
      { plan: box(-38, -18, -26, 18), z0: 7, z1: 8.5, top: plate, side: coralSide },
      { plan: box(26, -18, 38, 18), z0: 7, z1: 8.5, top: plate, side: coralSide },
      {
        plan: [
          [-9, -4],
          [0, -10],
          [9, -4],
          [9, 7],
          [0, 12],
          [-9, 7],
        ],
        z0: 7,
        z1: 11,
        top: "#c27a62",
        side: coralRear,
      },
      // Barrels follow the gameplay spread angles -0.2, 0 and 0.2 radians.
      ...[-0.2, 0, 0.2].map((angle): Part => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const r = (x: number, y: number) => [x * c - y * s, x * s + y * c] as const;
        return {
          plan: [r(-2.2, -6), r(2.2, -6), r(2.2, -40), r(-2.2, -40)],
          z0: 9,
          z1: 11.5,
          top: amber,
          side: amberSide,
        };
      }),
    ],
    mouths: [
      [-22, 28],
      [0, 28],
      [22, 28],
    ],
    mouthWidth: 8,
  },
];

// Visible sides in plan order, then the top. Rear-facing hull edges use the rear shade.
function faces(yaw: number, part: Part): Face[] {
  const top = (plan: Plan) => plan.map(([x, y]) => rotate(yaw, [x, y, part.z1]));
  // Orient the plan so its top faces up.
  const plan = facesViewer(top(part.plan)) ? part.plan : part.plan.toReversed();
  const result: Face[] = [];
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i]!;
    const b = plan[(i + 1) % plan.length]!;
    const points = (
      [
        [b[0], b[1], part.z1],
        [a[0], a[1], part.z1],
        [a[0], a[1], part.z0],
        [b[0], b[1], part.z0],
      ] as const
    ).map((point) => rotate(yaw, point));
    if (facesViewer(points)) {
      const rear =
        part.rear !== undefined &&
        (a[1] + b[1]) / 2 > 0 &&
        Math.abs(a[1] - b[1]) < Math.abs(a[0] - b[0]);
      result.push({ color: rear ? part.rear! : part.side, points });
    }
  }
  result.push({ color: part.top, points: top(plan) });
  return result;
}

// Parts resting on the hull top draw after the hull. Otherwise parts draw far to near,
// and equal depths draw lower tops first.
function svg(craft: Craft, yaw: number): string {
  const centre = craft.frame / 2;
  const hullTop = craft.parts[0]!.z1;
  const polygons = craft.parts
    .map((part) => ({
      part,
      depth: depth(part.plan.map(([x, y]) => rotate(yaw, [x, y, (part.z0 + part.z1) / 2]))),
      raised: part.z0 >= hullTop ? 1 : 0,
    }))
    .sort((a, b) => a.raised - b.raised || b.depth - a.depth || a.part.z1 - b.part.z1)
    .flatMap(({ part }) => faces(yaw, part))
    .map(({ color, points }) => {
      const projected = points.map((point) => project(centre, point));
      return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
    });
  const size = craft.frame;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `  <title>${craft.title} ${yaw} idle</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

// Speed jets: Tech draws outer and core triangles per mouth behind the idle frame.
function jets(craft: Craft): string {
  const centre = craft.frame / 2;
  const scale = Math.sqrt(craft.frame / 96);
  const half = craft.mouthWidth / 2;
  const headings = Array.from({ length: HEADINGS }, (_, yaw) => ({
    index: yaw,
    mouths: craft.mouths.map(([x, y]) => ({
      anchor: anchor(centre, yaw, [x, y, MOUTH_Z]),
      axis: vector(yaw, [0, 1, 0]),
      half: vector(yaw, [-half, 0, 0]),
    })),
  }));
  return json({
    version: 1,
    frame: craft.frame,
    length: { base: round(6 * scale), scale: round(24 * scale), exponent: 2 },
    layers: [
      { name: "outer", colors: ["#b8644c", "#f0a07c"], width: 1.6, length: 1 },
      { name: "core", colors: ["#d68b72", "#ffe2c8"], width: 0.8, length: 0.55 },
    ],
    headings,
  });
}

function manifestEntries(craft: Craft) {
  const display = craft.frame * DISPLAY_SCALE;
  return Array.from({ length: HEADINGS }, (_, yaw) => ({
    id: `enemy-${craft.name}-${yaw}`,
    path: `/art/enemies/${craft.name}-${yaw}.svg`,
    width: craft.frame,
    height: craft.frame,
    displayWidth: display,
    displayHeight: display,
    facing: `world-${yaw}`,
    directionIndex: yaw,
    pivot: { x: 0.5, y: 0.5 },
    archetype: craft.name,
  }));
}

mkdirSync(output, { recursive: true });
for (const craft of crafts) {
  writeFileSync(`${output}${craft.name}-jets.json`, jets(craft));
  for (let yaw = 0; yaw < HEADINGS; yaw++) {
    writeFileSync(`${output}${craft.name}-${yaw}.svg`, svg(craft, yaw));
  }
}

// Enemy entries follow the other assets, whose order is unchanged.
const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { assets: { id: string }[] };
manifest.assets = [
  ...manifest.assets.filter(({ id }) => !id.startsWith("enemy-")),
  ...crafts.flatMap(manifestEntries),
];
writeFileSync(manifestPath, json(manifest));
