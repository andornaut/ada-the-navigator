import {
  depth,
  ENEMY_HEADINGS,
  facesViewer,
  json,
  type Point,
  rotate,
  round,
} from "./projection.ts";

// Sector one enemy models, shared by the frame and destruction exports.
export type Plan = readonly (readonly [number, number])[];
// `loose` parts break off as their own destruction shard; others ride on the hull wedge they sit in.
// `decal` parts are flat paint on the hull top: they draw right after the hull and split along
// the destruction wedge cuts with it.
export type Part = {
  plan: Plan;
  z0: number;
  z1: number;
  top: string;
  side: string;
  rear?: string;
  loose?: true;
  decal?: true;
  // Part of an aimed turret top: heavies.ts draws it as its own sprite set.
  turret?: true;
};
export type Craft = {
  name: string;
  title: string;
  frame: number;
  parts: Part[];
  mouths: [number, number][];
  mouthWidth: number;
  // Destruction wedge cut angles in degrees, plan atan2(y, x); forward is -90.
  cuts: number[];
};
export type Face = { color: string; points: Point[] };

export const coral = "#d68b72";
export const coralSide = "#a8654f";
export const coralRear = "#7f4b3d";
export const plate = "#e6a890";
export const amber = "#f0bd68";
export const amberSide = "#b98a40";
export const visor = "#2a2433";
export const visorSide = "#1e1a26";

export const mirror = (half: Plan): Plan => [
  ...half,
  ...half.toReversed().map(([x, y]) => [-x, y] as const),
];
export const box = (x0: number, y0: number, x1: number, y1: number): Plan => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

export const ink = "#181425";
export const turretTop = "#c27a62";

// General Gadget's insignia: a horseshoe claw opening forward (negative y), prong tips hooked
// inward, closing on an amber disc. Unit outline of the right half from the rear centre.
const CLAW_HALF: Plan = [
  [0, 1],
  [0.5, 0.87],
  [0.87, 0.5],
  [1, 0],
  [1, -0.6],
  [0.78, -1],
  [0.2, -0.92],
  [0.36, -0.68],
  [0.5, -0.45],
  [0.5, 0],
  [0.44, 0.25],
  [0.25, 0.44],
  [0, 0.5],
];
const CLAW_DISC = { y: -0.2, r: 0.26, sides: 12 };

// One closed outline: the outer right edge, the inner edge round the opening, the outer left edge.
function clawPlan(cx: number, cy: number, r: number): Plan {
  const half = CLAW_HALF.map(([x, y]) => [cx + x * r, cy + y * r] as const);
  const flip = ([x, y]: readonly [number, number]) => [2 * cx - x, y] as const;
  const [outer, inner] = [half.slice(0, 7), half.slice(7)];
  return [
    ...outer,
    ...inner,
    ...inner.slice(0, -1).toReversed().map(flip),
    ...outer.slice(1).toReversed().map(flip),
  ];
}

// The mark at plan centre (cx, cy) with radius r, flat on the hull top at height z.
export function insignia(cx: number, cy: number, r: number, z: number): Part[] {
  const disc: Plan = Array.from({ length: CLAW_DISC.sides }, (_, i) => {
    const a = (i / CLAW_DISC.sides) * 2 * Math.PI;
    const radius = CLAW_DISC.r * r;
    return [cx + radius * Math.cos(a), cy + CLAW_DISC.y * r + radius * Math.sin(a)] as const;
  });
  return [
    { plan: clawPlan(cx, cy, r), z0: z, z1: z, top: ink, side: ink, decal: true },
    { plan: disc, z0: z, z1: z, top: amber, side: amber, decal: true },
  ];
}

export const crafts: Craft[] = [
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
      { plan: box(-3.2, -6, 3.2, 0), z0: 3, z1: 4.5, top: amber, side: amberSide, loose: true },
      // Insignia on bare hull top.
      ...insignia(0, 6.5, 5.5, 3),
    ],
    mouths: [[0, 16]],
    mouthWidth: 4,
    cuts: [-90, -10, 80, 170],
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
      { plan: box(-3.5, -9, 3.5, -3), z0: 4, z1: 6, top: visor, side: visorSide, loose: true },
      { plan: box(-17.5, -34, -14.5, -24), z0: 2, z1: 5, top: amber, side: amberSide },
      { plan: box(14.5, -34, 17.5, -24), z0: 2, z1: 5, top: amber, side: amberSide },
      // Insignia on bare hull top.
      ...insignia(7.5, 3.5, 5.2, 4),
    ],
    mouths: [
      [-8, 18],
      [8, 18],
    ],
    mouthWidth: 4,
    cuts: [-90, -25, 55, 125, 205],
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
      { plan: box(-2.5, -6, 2.5, 4), z0: 3.5, z1: 5.5, top: visor, side: visorSide, loose: true },
      { plan: box(-1, -30, 1, -14), z0: 1.5, z1: 3, top: amber, side: amberSide, loose: true },
      // Insignia on bare hull top.
      ...insignia(0, 10, 4.6, 3.5),
    ],
    mouths: [[0, 16]],
    mouthWidth: 6,
    cuts: [-90, -20, 70, 110, 200],
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
        top: turretTop,
        side: coralRear,
        loose: true,
        turret: true,
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
          loose: true,
          turret: true,
        };
      }),
      // Insignia on bare hull top.
      ...insignia(0, 20.5, 7, 7),
    ],
    mouths: [
      [-22, 28],
      [0, 28],
      [22, 28],
    ],
    mouthWidth: 8,
    cuts: [-90, -35, 20, 90, 160, 215],
  },
];

// Visible sides in plan order, then the top. Rear-facing hull edges use the rear shade.
export function faces(yaw: number, part: Part): Face[] {
  const top = (plan: Plan) => plan.map(([x, y]) => rotate(ENEMY_HEADINGS, yaw, [x, y, part.z1]));
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
    ).map((point) => rotate(ENEMY_HEADINGS, yaw, point));
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

// Decals draw after the hull and the parts beside it; parts resting on the hull top (the first
// part) draw after the decals. Otherwise parts draw far to near, and equal depths draw lower
// tops first.
export function drawOrder(yaw: number, hullTop: number, parts: readonly Part[]): Part[] {
  return parts
    .map((part) => ({
      part,
      depth: depth(
        part.plan.map(([x, y]) => rotate(ENEMY_HEADINGS, yaw, [x, y, (part.z0 + part.z1) / 2])),
      ),
      layer: part.decal ? 1 : part.z0 >= hullTop ? 2 : 0,
    }))
    .sort((a, b) => a.layer - b.layer || b.depth - a.depth || a.part.z1 - b.part.z1)
    .map(({ part }) => part);
}

// Frame px to Ada's logical display px: 42 / 96.
export const DISPLAY_SCALE = 0.4375;

// One jet mouth in frame px; `hardpoint` names the engine hardpoint that drives it.
export type JetMouth = {
  anchor: [number, number];
  axis: [number, number];
  half: [number, number];
  hardpoint?: string;
};

// Outer and core colour ramps, slow to fast.
export type JetColors = { outer: [string, string]; core: [string, string] };
const gadgetJets: JetColors = { outer: ["#b8644c", "#f0a07c"], core: ["#d68b72", "#ffe2c8"] };

// Family speed jets (version 1): Tech draws outer and core triangles per mouth behind the frame.
export function jetsFile(
  frame: number,
  mouths: (yaw: number) => JetMouth[],
  colors: JetColors = gadgetJets,
): string {
  const scale = Math.sqrt(frame / 96);
  return json({
    version: 1,
    frame,
    length: { base: round(6 * scale), scale: round(24 * scale), exponent: 2 },
    layers: [
      { name: "outer", colors: colors.outer, width: 1.6, length: 1 },
      { name: "core", colors: colors.core, width: 0.8, length: 0.55 },
    ],
    headings: Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => ({
      index: yaw,
      mouths: mouths(yaw),
    })),
  });
}

// Root manifest entries for a sixteen-heading hull set, `enemy-{name}-{index}`.
export function hullEntries(name: string, frame: number) {
  const display = frame * DISPLAY_SCALE;
  return Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => ({
    id: `enemy-${name}-${yaw}`,
    path: `/art/enemies/${name}-${yaw}.svg`,
    width: frame,
    height: frame,
    displayWidth: display,
    displayHeight: display,
    facing: `world-${yaw}`,
    directionIndex: yaw,
    pivot: { x: 0.5, y: 0.5 },
    archetype: name,
  }));
}
