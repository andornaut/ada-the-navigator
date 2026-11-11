// Cartwheel's small craft models in craft-local units (forward is -y, +x to starboard, +z up),
// for sixteen-heading exports: the miner A hauler, the story miner's geometry with its power on
// or off, and the ore pod. Models are groups of extruded parts; a renderer sorts the groups far
// to near and draws each group's parts in list order.
import { box, type Part, type Plan } from "./crafts.ts";

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
export const ore = "#65c9bf";
export const oreLit = "#a5ece4";
export const oreSide = "#3f9890";
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

// ---------------------------------------------------------------- miner A: hauler

// The story miner's geometry (art-cartwheel `miner`, sixteen headings at scale 1), so the
// stranded hauler is the same craft. Plans are written in (u forward, v across) through FWD.
const FWD = -Math.PI / 2;
const uv = (u: number, v: number) => along(FWD, u, v);
const craftPlan = (local: Plan) => orientedPlan(0, 0, FWD, local);
const craftBox = (u: number, v: number, length: number, width: number) =>
  orientedBox(...uv(u, v), FWD, length, width);
const sandRear = "#8a7656";

// A light cube of side `size` centred at (x, y) from z0.
const lamp = (x: number, y: number, z0: number, size: number, color: string): Part =>
  light(x, y, size / 2, z0, z0 + size, color);

export type HaulerState = {
  // Power on: warm cab glass, blue running and mast lights. Off: dark glass and dim lights.
  powered: boolean;
};

// Heights parts rest on (hull top, then cab top): groups based there draw after those below.
export const HAULER_LEVELS = [16.5, 28.5] as const;

// Miner A: a sand hauler with a forward cab, dark cradle rails and two open bins of ore teal.
export function hauler({ powered }: HaulerState, facing: Facing): Part[][] {
  const lit = powered ? blue : blueDim;
  const hull = craftPlan([
    [-39, -13.5],
    [21, -13.5],
    [34.5, -7.5],
    [34.5, 7.5],
    [21, 13.5],
    [-39, 13.5],
  ]);
  const cab = craftBox(21, 0, 18, 21);
  const groups: Part[][] = [
    [{ plan: craftBox(-43.5, 0, 9, 21), z0: 4.5, z1: 16.5, top: steelDark, side: steelDarkSide }],
    [
      { plan: hull, z0: 3, z1: 16.5, top: sand, side: sandSide, rear: sandRear },
      ...wallWindows(facing, 8, 11, 4, 2.6, hull, steelDark),
      // Side hatches: a dark door on each flank.
      ...wallWindows(
        (nx, ny) => facing(nx, ny) && Math.abs(nx) > 0.9,
        5,
        14,
        1,
        7,
        craftPlan(box(-17, -13.5, 3, 13.5)),
        mouth,
      ),
    ],
    [
      { plan: cab, z0: 16.5, z1: 28.5, top: sandCap, side: sandSide, rear: sandRear },
      ...wallWindows(facing, 21, 24.5, 1, 9, cab, powered ? warm : glassOff),
    ],
  ];
  for (const v of [-11.25, 11.25]) {
    groups.push([
      { plan: craftBox(-16.5, v, 42, 3), z0: 16.5, z1: 21, top: steelDark, side: steelDarkSide },
    ]);
  }
  for (const u of [-27, -7.5]) {
    const [bx, by] = uv(u, 0);
    groups.push([
      { plan: craftBox(u, 0, 16.5, 19.5), z0: 16.5, z1: 28.5, top: steelDark, side: steelDarkSide },
      { plan: craftBox(u, 0, 13.5, 16.5), z0: 27.6, z1: 28.5, top: ore, side: ore },
      {
        plan: orientedBox(bx - 1.5, by + 1.5, FWD + 0.5, 5, 3.6),
        z0: 28.5,
        z1: 31,
        top: oreLit,
        side: ore,
      },
      {
        plan: orientedBox(bx + 3, by - 2, FWD - 0.4, 3.6, 2.8),
        z0: 28.5,
        z1: 30.2,
        top: oreLit,
        side: ore,
      },
      {
        plan: orientedBox(bx - 3.5, by - 3, FWD + 1.2, 3, 2.4),
        z0: 28.5,
        z1: 29.8,
        top: oreLit,
        side: ore,
      },
    ]);
  }
  // Running lights at the tail corners and a mast light over the cab.
  groups.push([-1, 1].map((s) => lamp(...uv(-38, s * 14.4), 10, 2.8, lit)));
  const [mx, my] = uv(23, 0);
  groups.push([
    {
      plan: box(mx - 0.8, my - 0.8, mx + 0.8, my + 0.8),
      z0: 28.5,
      z1: 34.5,
      top: steelDark,
      side: steelDarkSide,
    },
    light(mx, my, 2, 34.5, 37.5, lit),
  ]);
  return groups;
}

// The hauler's tow point: the nose tip at mid hull height.
export const HAULER_TOW = [0, -34.5, 9.75] as const;

// ---------------------------------------------------------------- ore pod

// A sealed cream cargo capsule with an ore teal band, a mast light that blinks while it waits
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
