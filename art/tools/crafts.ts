import { industrialRetaliators } from "./retaliator-models.ts";
import { normalizeCraft, sizeReceipts } from "./enemy-size.ts";
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
  // Paint on a loose panel, in fractions of its plan bounds so it follows scaling and breakup.
  topDetail?: { color: string; plan: Plan };
  loose?: true;
  decal?: true;
  // Part of an aimed turret top: heavies.ts draws it as its own sprite set.
  turret?: true;
  muzzle?: true;
};
export type Craft = {
  name: string;
  title: string;
  variant?: "cargo" | "mining";
  frame: number;
  parts: Part[];
  mouths: [number, number][];
  mouthWidth: number;
  mouthZ?: number;
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

const sourceCrafts: Craft[] = [
  {
    // Short seed hull with hooked jaws around the central Laser.
    name: "swarm",
    title: "Swarm",
    frame: 80,
    parts: [
      {
        plan: mirror([
          [0, -8],
          [7, -8],
          [6.5, -13],
          [4, -17],
          [8.5, -18],
          [12.5, -12],
          [14, -3],
          [9.5, 10],
          [5, 16],
        ]),
        z0: 0,
        z1: 3.5,
        top: "#629483",
        side: "#355b63",
        rear: "#233940",
      },
      {
        plan: mirror([
          [0, -7],
          [2.7, -4],
          [4.7, 2],
          [2.6, 7],
        ]),
        z0: 3.5,
        z1: 6,
        top: visor,
        side: visorSide,
        loose: true,
      },
      {
        plan: box(-2.4, -16, 2.4, -5),
        z0: 3.5,
        z1: 5.7,
        top: amber,
        side: amberSide,
      },
      ...insignia(0, 11, 3.5, 3.5),
    ],
    mouths: [[0, 16]],
    mouthWidth: 4,
    cuts: [-90, -10, 80, 170],
  },
  {
    // Armoured twin booms carry the MultiLaser pair ahead of a recessed central bridge.
    name: "fighter",
    title: "Fighter",
    frame: 96,
    parts: [
      {
        plan: mirror([
          [0, -15],
          [4, -11],
          [4, -2],
          [10, -5],
          [10, -24],
          [15, -29],
          [20, -25],
          [21, 9],
          [16, 18],
          [5, 18],
          [3, 8],
          [0, 6],
        ]),
        z0: 0,
        z1: 5,
        top: "#405785",
        side: "#2e4065",
        rear: "#202a44",
      },
      ...[-1, 1].flatMap((side): Part[] => {
        const armour: Plan = [
          [11, -20],
          [18, -17],
          [19, 5],
          [15, 13],
          [7, 13],
          [8, 5],
          [12, 0],
        ];
        const plan = armour.map(([x, y]) => [side * x, y] as const);
        const face: Plan = [
          [12.5, -16],
          [16.2, -14],
          [17.6, 4.2],
          [14.3, 10.4],
          [10, 10.4],
          [11.6, 4],
          [13.3, -1],
        ];
        return [
          {
            plan,
            z0: 5,
            z1: 7.5,
            top: "#4c64a0",
            side: "#4c64a0",
          },
          {
            plan: face.map(([x, y]) => [side * x, y] as const),
            z0: 7.5,
            z1: 7.5,
            top: "#718bd0",
            side: "#718bd0",
            decal: true,
          },
          {
            plan: box(side * 15 - 2.8, -34, side * 15 + 2.8, -14),
            z0: 2.5,
            z1: 6.5,
            top: "#374b73",
            side: "#263755",
          },
          {
            plan: box(side * 15 - 2.4, -34, side * 15 + 2.4, -26),
            z0: 6.5,
            z1: 6.7,
            top: "#718bd0",
            side: "#4c64a0",
            topDetail: {
              color: "#d5e0eb",
              plan: [
                [0.28, 0.24],
                [0.72, 0.24],
                [0.78, 0.46],
                [0.64, 0.66],
                [0.36, 0.66],
                [0.22, 0.46],
              ],
            },
          },
        ];
      }),
      {
        plan: box(-2.7, -9, 2.7, 4),
        z0: 5,
        z1: 7,
        top: "#374b73",
        side: "#2e4065",
        loose: true,
        topDetail: {
          color: "#405785",
          plan: [
            [0.5, 0.15],
            [0.82, 0.35],
            [0.7, 0.84],
            [0.3, 0.84],
            [0.18, 0.35],
          ],
        },
      },
      ...insignia(11, 15, 2.8, 5),
    ],
    mouths: [
      [-8, 18],
      [8, 18],
    ],
    mouthWidth: 4,
    cuts: [-90, -25, 55, 125, 205],
  },
  {
    // A bone prow and one Phaser emitter lead swept violet engine pods.
    name: "interceptor",
    title: "Interceptor",
    frame: 88,
    parts: [
      {
        plan: mirror([
          [0, -31],
          [8, -10],
          [5, 3],
          [12, 8],
          [19.5, 18],
          [17, 22],
          [8, 16],
          [4, 14],
          [3.5, 22],
        ]),
        z0: 0,
        z1: 3,
        top: "#514575",
        side: "#342d58",
        rear: "#282644",
      },
      {
        plan: mirror([
          [0, -31],
          [7.6, -10],
          [4.5, 3],
          [3.5, 11],
          [0, 15],
        ]),
        z0: 3,
        z1: 5.5,
        top: "#f1e5c9",
        side: "#514575",
        loose: true,
        topDetail: {
          // The narrow Phaser trace opens into the angled housing.
          color: "#474582",
          plan: [
            [0.5, 0.15],
            [0.57, 0.26],
            [0.57, 0.33],
            [0.65, 0.39],
            [0.59, 0.49],
            [0.41, 0.49],
            [0.35, 0.39],
            [0.43, 0.33],
            [0.43, 0.26],
          ],
        },
      },
      {
        plan: [
          [0, -34],
          [2.5, -24],
          [0, -17],
          [-2.5, -24],
        ],
        z0: 1.5,
        z1: 6,
        top: "#a9d9ff",
        side: "#596ccc",
        loose: true,
      },
      {
        plan: mirror([
          [0, -10],
          [3.7, -7],
          [2.7, 2],
          [0, 7],
        ]),
        z0: 5.5,
        z1: 7,
        top: "#474582",
        side: visorSide,
      },
      ...[-1, 1].flatMap((side): Part[] => {
        const nacelle: Plan = [
          [12, -1],
          [18, 5],
          [21.44, 19],
          [18, 25],
          [13, 19],
          [10, 9],
        ];
        const stripe: Plan = [
          [14, 7],
          [17, 10],
          [19, 19],
          [16, 16],
        ];
        const lamp: Plan = [
          [16.05, 12.5],
          [17.05, 13.65],
          [17.85, 16.6],
          [16.7, 15.5],
        ];
        return [
          {
            plan: nacelle.map(([x, y]) => [side * x, y] as const),
            z0: 0.5,
            z1: 4.5,
            top: "#8170cc",
            side: "#4d427d",
          },
          {
            plan: stripe.map(([x, y]) => [side * x, y] as const),
            z0: 4.5,
            z1: 5.2,
            top: "#8170cc",
            side: "#4d427d",
          },
          {
            plan: lamp.map(([x, y]) => [side * x, y] as const),
            z0: 5.2,
            z1: 5.2,
            top: "#a9d9ff",
            side: "#a9d9ff",
            decal: true,
          },
        ];
      }),
      ...insignia(0, 18, 3, 3),
    ],
    mouths: [[0, 22]],
    mouthWidth: 6,
    cuts: [-90, -20, 70, 110, 200],
  },
  {
    // Broad industrial workshop slab with three missile launch tubes.
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
      // Existing three launch tips retain the authored spread angles.
      ...[-0.2, 0, 0.2].map((angle): Part => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const r = (x: number, y: number) => [x * c - y * s, x * s + y * c] as const;
        return {
          plan: [r(-3.6, -6), r(3.6, -6), r(3.6, -24), r(-3.6, -24)],
          z0: 9,
          z1: 11.5,
          top: visor,
          side: visorSide,
          loose: true,
          turret: true,
          muzzle: true,
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

const industrial = industrialRetaliators(
  { box, dark: visor, insignia, plate, rear: coralRear, side: coralSide },
  sourceCrafts.find(({ name }) => name === "retaliator")!,
);
export const retaliatorVariants = {
  cargo: normalizeCraft(industrial.cargo),
  mining: normalizeCraft(industrial.mining),
};
export const crafts: Craft[] = sourceCrafts.map((craft) =>
  craft.name === "retaliator" ? retaliatorVariants.cargo : normalizeCraft(craft),
);

export const INDUSTRIAL_STEMS = {
  cargo: "retaliatorCargoHauler",
  mining: "retaliatorMiningFreighter",
} as const;
export const enemyArchetype = (name: string): string =>
  Object.values(INDUSTRIAL_STEMS).some((stem) => stem === name) ? "retaliator" : name;
export const industrialCrafts: Craft[] = Object.entries(INDUSTRIAL_STEMS).map(([variant, name]) => {
  const source = retaliatorVariants[variant as keyof typeof retaliatorVariants];
  sizeReceipts.set(name, sizeReceipts.get(`retaliator:${variant}`)!);
  return { ...source, name };
});
// Aimed launchers are separate physical layers rather than baked into the hull.
export const exportCrafts = [...crafts, ...industrialCrafts].map((craft) => ({
  ...craft,
  parts: craft.parts.filter((part) => !part.turret),
}));

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
  if (part.topDetail) {
    const xs = plan.map(([x]) => x);
    const ys = plan.map(([, y]) => y);
    const left = Math.min(...xs);
    const front = Math.min(...ys);
    const width = Math.max(...xs) - left;
    const length = Math.max(...ys) - front;
    const detail = part.topDetail.plan.map(
      ([x, y]) => [left + x * width, front + y * length] as const,
    );
    result.push({ color: part.topDetail.color, points: top(detail) });
  }
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
export const gadgetJets: JetColors = {
  outer: ["#b8644c", "#f0a07c"],
  core: ["#d68b72", "#ffe2c8"],
};

// Family speed jets (version 1): Tech draws outer and core triangles per mouth behind the frame.
// `extra` fields follow the jets data in the same file; `heading` fields follow each heading's
// mouths.
export function jetsFile(
  frame: number,
  mouths: (yaw: number) => JetMouth[],
  colors: JetColors = gadgetJets,
  extra: Readonly<Record<string, unknown>> = {},
  heading: (yaw: number) => Readonly<Record<string, unknown>> = () => ({}),
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
      ...heading(yaw),
    })),
    ...extra,
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
    archetype: enemyArchetype(name),
  }));
}
