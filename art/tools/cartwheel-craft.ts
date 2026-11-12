// Cartwheel's small craft models in craft-local units (forward is -y, +x to starboard, +z up),
// for sixteen-heading exports: the tri-hull miner with its power on or off, and the ore pod. Models are groups of extruded parts; a renderer sorts the groups far
// to near and draws each group's parts in list order.
import { box, type Part, type Plan } from "./crafts.ts";
import { ORE_SOLID } from "./ore.ts";
import { craftBox, craftPlan, cube, hcyl, part, pill, scaleGroups } from "./hull-shapes.ts";

export type { Part, Plan };

// Station family and Cartwheel accents.
export const cream = "#efe4cf";
export const creamSide = "#bfae94";
export const blue = "#70ace8";
export const blueDim = "#3f5878";
export const warm = "#ffe9b8";
export const mouth = "#1e1a26";
export const mouthInner = "#35304a";
// Unlit window glass on a craft with its power off.
export const glassOff = "#2a2433";
export const ore = ORE_SOLID.top;
export const oreLit = ORE_SOLID.lit;
export const oreSide = ORE_SOLID.side;
export const steelDark = "#6e7482";
export const steelDarkSide = "#4f5462";
export const sand = "#dcc49a";
export const sandSide = "#a8916a";
export const sandCap = "#efe0c2";

// Whether a wall whose outward plan normal is (nx, ny), craft-local, faces the viewer at the
// heading being drawn. Wall details (windows, hatches) are added only on facing walls, so they
// never draw over the hull from behind.
export type Facing = (nx: number, ny: number) => boolean;

export function ngon(n: number, r: number, cx = 0, cy = 0, phase = 0): Plan {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
}

// A local plan (u along `angle`, v across) placed at (cx, cy).
export function orientedPlan(cx: number, cy: number, angle: number, local: Plan): Plan {
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  const [vx, vy] = [-uy, ux];
  return local.map(([a, b]) => [cx + ux * a + vx * b, cy + uy * a + vy * b] as const);
}

// Box centred at (cx, cy); `along` runs in direction `angle`.
export function orientedBox(cx: number, cy: number, angle: number, along: number, across: number) {
  return orientedPlan(cx, cy, angle, [
    [-along / 2, -across / 2],
    [along / 2, -across / 2],
    [along / 2, across / 2],
    [-along / 2, across / 2],
  ]);
}

// Plan point `distance` along an axis at `angle` and `across` to its side.
export const along = (angle: number, distance: number, across: number) =>
  [
    Math.cos(angle) * distance - Math.sin(angle) * across,
    Math.sin(angle) * distance + Math.cos(angle) * across,
  ] as const;

// Stacked n-gon tiers: a rounded profile (domes, tanks, capsules).
export function tiers(
  cx: number,
  cy: number,
  r: number,
  base: number,
  steps: readonly (readonly [number, number, number])[],
  top: string,
  side: string,
  cap = top,
  n = 12,
): Part[] {
  return steps.map(([k, z0, z1], i): Part => ({
    plan: ngon(n, r * k, cx, cy, Math.PI / n),
    z0: base + z0,
    z1: base + z1,
    top: i === steps.length - 1 ? cap : top,
    side,
  }));
}

// Small protruding panes on each facing wall of a convex plan.
export function wallWindows(
  facing: Facing,
  z0: number,
  z1: number,
  count: number,
  width: number,
  plan: Plan,
  color: string,
): Part[] {
  const out: Part[] = [];
  const cx = plan.reduce((sum, [x]) => sum + x, 0) / plan.length;
  const cy = plan.reduce((sum, [, y]) => sum + y, 0) / plan.length;
  for (const [i, a] of plan.entries()) {
    const b = plan[(i + 1) % plan.length]!;
    const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
    const length = Math.hypot(ex, ey);
    let [nx, ny] = [ey / length, -ex / length];
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) {
      [nx, ny] = [-nx, -ny];
    }
    if (!facing(nx, ny)) continue;
    for (let k = 0; k < count; k++) {
      const f = (k + 1) / (count + 1);
      const [px, py] = [a[0] + ex * f + nx * 0.3, a[1] + ey * f + ny * 0.3];
      const pane = orientedBox(px, py, Math.atan2(ey, ex), width, 0.6);
      out.push({ plan: pane, z0, z1, top: color, side: color });
    }
  }
  return out;
}

const light = (x: number, y: number, r: number, z0: number, z1: number, color: string): Part => ({
  plan: box(x - r, y - r, x + r, y + r),
  z0,
  z1,
  top: color,
  side: color,
});

// ---------------------------------------------------------------- miner: tri-hull hauler

// The story miner's geometry (art-cartwheel `miner`), so the stranded hauler is the same craft:
// a sand keel with a stepped drill head and a forward cab between two outrigger hulls carrying
// open ore bins, joined by dark cross beams, with an engine on each hull. Written in design units
// (u forward, v across) and built at HAULER_SCALE.
export const HAULER_SCALE = 1.3;
const sandRear = "#8a7656";
const beamSide = "#3e4250";
const drillSteel = "#b8bfc9";
const drillSteelSide = "#8a919c";
const drillSteelDark = "#9aa1ad";

export type HaulerState = {
  // Power on: warm cab glass, blue running and mast lights. Off: dark glass and dim lights.
  powered: boolean;
};

// Heights parts rest on (keel deck, then deck plating): groups based there draw after those below.
export const HAULER_LEVELS = [10, 10.8].map((z) => z * HAULER_SCALE);

// Jet mouths (u, v, z) at the three engine faces, keel first, and their width.
export const HAULER_MOUTHS = (
  [
    [-35.2, 0, 6],
    [-30.2, -15, 4.8],
    [-30.2, 15, 4.8],
  ] as const
).map(([u, v, z]) => [u * HAULER_SCALE, v * HAULER_SCALE, z * HAULER_SCALE] as const);
export const HAULER_MOUTH_WIDTH = 4.4 * HAULER_SCALE;

export function hauler({ powered }: HaulerState, facing: Facing): Part[][] {
  const lit = powered ? blue : blueDim;
  const cab = craftPlan([
    [10, -5],
    [18, -5],
    [21, -3],
    [21, 3],
    [18, 5],
    [10, 5],
  ]);
  const steel = { side: steelDarkSide, front: "flat", back: "flat" } as const;
  const groups: Part[][] = [
    ...[-1, 1].map((s) => [part(craftBox(-28, s * 15, 4, 6), 2.6, 7, steelDark, steelDarkSide)]),
    [part(craftBox(-33, 0, 4, 8), 3, 9, steelDark, steelDarkSide)],
    ...[-12, 4].map((u) => [part(craftBox(u, 0, 3, 30), 4, 6.5, steelDarkSide, beamSide)]),
    ...[-1, 1].map((s) => [
      part(pill(-26, 14, s * 15, 4.2, "blunt", "flat"), 1.5, 7, sand, sandSide, sandRear),
      part(craftBox(-7, s * 15, 26, 7.2), 7, 9.6, steelDark, steelDarkSide),
      part(craftBox(-7, s * 15, 24, 5.6), 9.6, 9.6, ore, oreSide),
      part(craftBox(-7, s * 15, 1, 7.2), 9.6, 10.4, steelDark, steelDarkSide),
      cube(-14, s * 15 - 1, 9.6, 1.6, oreLit),
      cube(-2, s * 15 + 1, 9.6, 1.4, oreLit),
      cube(12.6, s * 15, 7, 1.3, lit),
    ]),
    [part(pill(-31, 26, 0, 5.2, "blunt", "flat"), 2, 10, sand, sandSide, sandRear)],
    [part(craftBox(-10, 0, 30, 7), 10, 10.8, sandCap, sandSide)],
    hcyl(26, 29, 0, 6, 4.4, { top: steelDark, ...steel }),
    hcyl(29, 32, 0, 6, 3.4, { top: drillSteel, ...steel, side: drillSteelSide }),
    hcyl(32, 34.5, 0, 6, 2.2, { top: drillSteelDark, ...steel, side: drillSteelSide }),
    hcyl(34.5, 36.5, 0, 6, 1.1, {
      top: drillSteel,
      ...steel,
      side: drillSteelSide,
      front: "point",
    }),
    [
      part(cab, 10, 16, sandCap, sandSide, sandRear),
      ...wallWindows(facing, 11.6, 14.4, 2, 2.4, cab, powered ? warm : glassOff),
    ],
    [part(craftBox(14, 0, 0.9, 0.9), 16, 20, steelDark, steelDark), cube(14, 0, 20, 2.2, lit)],
  ];
  return scaleGroups(HAULER_SCALE, groups);
}

// The hauler's tow point: the drill tip at mid keel height.
export const HAULER_TOW = [0, -36.5 * HAULER_SCALE, 6 * HAULER_SCALE] as const;

// ---------------------------------------------------------------- ore pod

// A sealed cream cargo capsule with an ore band, a mast light that blinks while it waits
// and a steel tow lug forward, from the approved mock-up's pod. Pod units (the export scales it).
export function orePod(lit: boolean): Part[][] {
  return [
    [
      ...tiers(
        0,
        0,
        7,
        0,
        [
          [0.7, 0, 2],
          [1, 2, 9],
          [0.7, 9, 11],
        ],
        cream,
        creamSide,
        cream,
        10,
      ),
      { plan: ngon(10, 7.3, 0, 0, Math.PI / 10), z0: 4.5, z1: 6.5, top: ore, side: oreSide },
    ],
    [{ plan: box(-1.2, -9.4, 1.2, -6.6), z0: 4.6, z1: 6.4, top: steelDark, side: steelDarkSide }],
    [
      { plan: box(-1.6, -1.6, 1.6, 1.6), z0: 11, z1: 13, top: steelDark, side: steelDarkSide },
      light(0, 0, 1.2, 13, 15, lit ? blue : blueDim),
    ],
  ];
}

// The pod's tow point: the lug's forward face, pod units.
export const POD_TOW = [0, -9.4, 5.5] as const;
