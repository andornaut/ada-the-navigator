import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { replaceEntries } from "./manifest.ts";
import { SVG_DECIMALS, svgText } from "./svg-text.ts";
import { writeProjects } from "./projects.ts";
import { depth, facesViewer, type Point, projectAt, round } from "./projection.ts";

type Plan = readonly (readonly [number, number])[];
type Part = { plan: Plan; cap?: Plan; z0: number; z1: number; top: string; side: string };

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const output = `${art}outposts/`;
// Frame px to logical display px, shared with Ada, the enemies and the station; outposts and their
// project frames draw at the destination scale (art/destinations.md).
const DISPLAY_SCALE = 0.4375;
const DESTINATION_SCALE = 1.5;
const OUTPOST_GROWTH = 1.4;
const BLINK_MS = 700;
const PAD = 4;

// Station family shared by every outpost.
const cream = "#efe4cf";
const creamSide = "#bfae94";
const warm = "#ffe9b8";

// The dock axis (+x, +y) projects straight down the screen.
const DOCK = Math.PI / 4;

const box = (x0: number, y0: number, x1: number, y1: number): Plan => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

function ngon(n: number, r: number, cx = 0, cy = 0, phase = 0): Plan {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
}

// Box centred at (cx, cy); `along` runs in direction `angle`.
function orientedBox(cx: number, cy: number, angle: number, along: number, across: number): Plan {
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  const [vx, vy] = [-uy, ux];
  return (
    [
      [-along / 2, -across / 2],
      [along / 2, -across / 2],
      [along / 2, across / 2],
      [-along / 2, across / 2],
    ] as const
  ).map(([a, b]) => [cx + ux * a + vx * b, cy + uy * a + vy * b] as const);
}

// Small protruding panes on each wall of a convex plan whose outward normal passes `visible`.
function wallWindows(
  visible: (nx: number, ny: number) => boolean,
  z0: number,
  z1: number,
  count: number,
  width: number,
  plan: Plan,
  color = warm,
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
    if (!visible(nx, ny)) {
      continue;
    }
    for (let k = 0; k < count; k++) {
      const f = (k + 1) / (count + 1);
      const [px, py] = [a[0] + ex * f + nx * 0.3, a[1] + ey * f + ny * 0.3];
      const pane = orientedBox(px, py, Math.atan2(ey, ex), width, 0.6);
      out.push({ plan: pane, z0, z1, top: color, side: color });
    }
  }
  return out;
}

const facing = (nx: number, ny: number) => nx + ny > 0.3;
// Plan point `distance` along the dock axis and `across` to its side.
const at = (distance: number, across: number) =>
  [
    Math.cos(DOCK) * distance - Math.sin(DOCK) * across,
    Math.sin(DOCK) * distance + Math.cos(DOCK) * across,
  ] as const;

function dome(
  cx: number,
  cy: number,
  r: number,
  base: number,
  glass: string,
  glassSide: string,
  cap: string,
): Part[] {
  const tiers = [
    [1, 0.0, 0.32],
    [0.86, 0.32, 0.6],
    [0.64, 0.6, 0.82],
    [0.36, 0.82, 0.96],
  ] as const;
  const h = r * 1.05;
  return tiers.map(([k, a, b], i): Part => ({
    plan: ngon(12, r * k, cx, cy, Math.PI / 12),
    z0: base + h * a,
    z1: base + h * b,
    top: i === tiers.length - 1 ? cap : glass,
    side: glassSide,
  }));
}

type Outpost = {
  build: (lit: boolean) => Part[][];
  // Dock face and pivot distances along the dock axis, in model units.
  face: number;
  pivot: number;
  mouthWidth: number;
  // A replacement frame pair names its outpost role and the project that shows it.
  outpost?: string;
  project?: string;
  title?: string;
  frame?: FixedFrame;
};

// Growers: leaf-green planters radiating like a sunflower head around glass domes.
const leaf = "#9ccc5a";
const leafSide = "#6c9a3a";
const leafDark = "#3d705e";
const podFrame = "#637985";
const podSide = "#3b5260";
const growersGlass = "#c9ecb4";
const growersGlassSide = "#8fbf78";
const growersGlassCap = "#eefbe2";
const bloom = "#f6d76b";
const bloomSide = "#c9a94a";
const bloomDim = "#8a7a3e";
const bloomDimSide = "#6d6131";
const GROWERS_FACE = 62;

function growers(lit: boolean): Part[][] {
  const groups: Part[][] = [];
  // Seven pressurised hydroponics modules radiate from the central habitat.
  for (let i = 1; i < 8; i++) {
    const a = ((45 + i * 45) * Math.PI) / 180;
    const mid = 36;
    const plan = orientedBox(mid * Math.cos(a), mid * Math.sin(a), a, 30, 13);
    const bed = orientedBox(mid * Math.cos(a), mid * Math.sin(a), a, 26, 9.5);
    const parts: Part[] = [
      { plan, z0: 0, z1: 4, top: podFrame, side: podSide },
      { plan: bed, z0: 4, z1: 6.5, top: leafDark, side: leafSide },
    ];
    // Three illuminated growth chambers along the module.
    for (const t of [-8, 0, 8]) {
      const [tx, ty] = [(mid + t) * Math.cos(a), (mid + t) * Math.sin(a)];
      parts.push({ plan: ngon(6, 2.6, tx, ty), z0: 5.5, z1: 8, top: growersGlass, side: leafDark });
    }
    // A nutrient line beside each row of growth chambers.
    const sx = mid * Math.cos(a) - 3.75 * Math.sin(a);
    const sy = mid * Math.sin(a) + 3.75 * Math.cos(a);
    parts.push({
      plan: orientedBox(sx, sy, a, 19, 1.6),
      z0: 6.5,
      z1: 7.05,
      top: growersGlassCap,
      side: leafSide,
    });
    // Tip lamp, lit in frame A.
    const [lx, ly] = [(mid + 16.5) * Math.cos(a), (mid + 16.5) * Math.sin(a)];
    const lamp = lit ? bloom : bloomDim;
    parts.push({
      plan: box(lx - 1.8, ly - 1.8, lx + 1.8, ly + 1.8),
      z0: 1.5,
      z1: 4.5,
      top: lamp,
      side: lamp,
    });
    groups.push(parts);
  }
  // Round deck under the domes.
  const deck = ngon(16, 25, 0, 0, Math.PI / 16);
  groups.push([
    { plan: deck, z0: 0, z1: 6, top: cream, side: creamSide },
    ...wallWindows(facing, 2, 4, 1, 2.6, deck),
  ]);
  // Two small back domes, then the big central dome.
  groups.push(dome(-13, 18, 9, 5, growersGlass, growersGlassSide, growersGlassCap));
  groups.push(dome(18, -13, 9, 5, growersGlass, growersGlassSide, growersGlassCap));
  groups.push([
    ...dome(2, 2, 15, 6, growersGlass, growersGlassSide, growersGlassCap),
    // Plant mass behind the glass: a leaf band on the lower tier.
    ...wallWindows(
      (nx, ny) => nx + ny > 0.2,
      8,
      10.5,
      1,
      5,
      ngon(12, 15.3, 2, 2, Math.PI / 12),
      leaf,
    ),
  ]);
  // Beacon: a sunflower-yellow lamp on a short mast above the big dome.
  groups.push([
    { plan: box(1.2, 1.2, 2.8, 2.8), z0: 21, z1: 27, top: cream, side: creamSide },
    {
      plan: box(0, 0, 4, 4),
      z0: 27,
      z1: 30,
      top: lit ? bloom : bloomDim,
      side: lit ? bloomSide : bloomDimSide,
    },
  ]);
  // A low navigation strip is inset into the habitat's forward rim.
  groups.push([
    { plan: orientedBox(...at(23, 0), DOCK, 7, 17), z0: 1, z1: 6, top: podFrame, side: podSide },
    {
      plan: orientedBox(...at(25, 0), DOCK, 3, 11),
      z0: 6,
      z1: 6.5,
      top: lit ? bloom : bloomDim,
      side: bloomDimSide,
    },
  ]);
  return groups;
}

// Workshop: a free-flying repair rig with articulated manipulators and an open work area.
const yellowDark = "#8c7428";
const rigPlate = { top: "#899fbd", side: "#43546f" };
const rigDark = { top: "#5b718d", side: "#323d57" };
const coolingMetal = { top: "#9fcbc1", side: "#527c83" };
const WORKSHOP_FACE = 44;
const WORKSHOP_PIVOT = 20;

function armLink(
  start: readonly [number, number],
  end: readonly [number, number],
  z0: number,
  z1: number,
  width: number,
  material: Pick<Part, "top" | "side">,
): Part {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  return {
    plan: orientedBox(
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      Math.atan2(dy, dx),
      Math.hypot(dx, dy) + 1,
      width,
    ),
    z0,
    z1,
    ...material,
  };
}

function manipulator(
  base: readonly [number, number],
  elbow: readonly [number, number],
  tip: readonly [number, number],
  height: number,
  lit: boolean,
  taper = 1,
): Part[] {
  const [x, y] = base;
  const [ex, ey] = elbow;
  const [tx, ty] = tip;
  const lamp = lit ? warm : yellowDark;
  return [
    { plan: ngon(8, 9, x, y), z0: 1, z1: 11, ...rigDark },
    {
      plan: ngon(6, 6, x, y),
      cap: ngon(6, 6 * taper, x, y),
      z0: 11,
      z1: height,
      ...rigPlate,
    },
    armLink(base, elbow, height - 6, height, 7, coolingMetal),
    { plan: ngon(8, 5, ex, ey), z0: height - 10, z1: height + 2, ...rigDark },
    armLink(elbow, tip, height - 10, height - 5, 5, rigPlate),
    { plan: ngon(8, 2.8, ex, ey), z0: height + 2, z1: height + 2.8, ...coolingMetal },
    { plan: ngon(6, 4, tx, ty), z0: height - 14, z1: height - 5, ...coolingMetal },
    {
      plan: ngon(4, 2.1, tx, ty),
      z0: height - 16,
      z1: height - 14,
      top: lamp,
      side: lamp,
    },
  ];
}

function workshop(lit: boolean): Part[][] {
  const core = at(WORKSHOP_PIVOT, 0);
  const port = at(8, -46);
  const starboard = at(-2, 40);
  const stern = at(-9, 8);
  const tank = at(WORKSHOP_PIVOT + 4, 28);
  const bus = ngon(6, 15, ...core, DOCK);
  const groups: Part[][] = [
    [
      armLink(port, core, 2, 9, 8, rigPlate),
      armLink(port, stern, 4, 10, 4, rigDark),
      armLink(stern, starboard, 3, 11, 5, rigDark),
      armLink(starboard, core, 2, 9, 8, rigPlate),
    ],
    [
      { plan: ngon(8, 11, ...stern), z0: 0, z1: 17, ...coolingMetal },
      { plan: ngon(6, 8, ...stern), z0: 17, z1: 21, ...rigPlate },
    ],
    [
      { plan: bus, z0: 0, z1: 12, ...rigDark },
      { plan: ngon(6, 12, ...core, DOCK), z0: 12, z1: 17, ...rigPlate },
      ...wallWindows(facing, 4, 7, 2, 2.5, bus, lit ? warm : yellowDark),
    ],
    [
      armLink(core, tank, 4, 8, 5, rigDark),
      { plan: ngon(8, 6, ...tank), z0: 3, z1: 14, ...coolingMetal },
      { plan: ngon(8, 4.5, ...tank), z0: 14, z1: 16, ...rigPlate },
    ],
    manipulator(port, at(-8, -25), at(2, -13), 49, lit, 0.72),
    manipulator(starboard, at(-12, 24), at(2, 12), 41, lit),
  ];
  return groups;
}

// Salvagers: a patched hull, scrap stacks and a periwinkle electromagnet grabber.
const steel = "#b8bfc9";
const steelSide = "#7f8794";
const slate = "#8d9bb0";
const slateSide = "#5f6b7e";
const olive = "#aaa883";
const oliveSide = "#76755a";
const rust = "#b49a7c";
const rustSide = "#7f6b55";
const dark = "#6e7482";
const darkSide = "#4f5462";
const magnet = "#8f9cf0";
const magnetSide = "#6370c0";
const magnetDim = "#4a5080";
const magnetDimSide = "#383d63";
const SALVAGERS_FACE = 54;

// Tilted plates piled in shrinking tiers with mismatched colours.
function scrapStack(cx: number, cy: number, seed: number, tiers: number): Part[] {
  const colors = [
    [steel, steelSide],
    [olive, oliveSide],
    [slate, slateSide],
    [rust, rustSide],
    [dark, darkSide],
    [cream, creamSide],
  ] as const;
  const out: Part[] = [];
  let z = 0;
  for (let t = 0; t < tiers; t++) {
    const [top, side] = colors[(seed + t * 2) % colors.length]!;
    const size = 15 - t * 3;
    const angle = seed * 0.7 + t * 0.55;
    const h = 3 + ((seed + t) % 2) * 1.5;
    out.push({
      plan: orientedBox(cx + (t % 2) * 1.5, cy - t, angle, size * 1.2, size),
      z0: z,
      z1: z + h,
      top,
      side,
    });
    z += h;
  }
  return out;
}

function salvagers(lit: boolean): Part[][] {
  const groups: Part[][] = [];
  const signal = lit ? magnet : magnetDim;
  const signalSide = lit ? magnetSide : magnetDimSide;
  groups.push(scrapStack(-30, -4, 1, 4));
  groups.push(scrapStack(-28, 24, 4, 3));
  // Grabber arm on a turret at the back right, reaching screen-right over a stack.
  const [tx, ty] = [10, -24];
  const armAngle = -Math.PI / 4 + 0.15;
  const reach = 32;
  const [ex, ey] = [tx + Math.cos(armAngle) * reach, ty + Math.sin(armAngle) * reach];
  groups.push(scrapStack(ex - 1, ey + 2, 2, 3));
  groups.push([
    { plan: ngon(8, 6, tx, ty, Math.PI / 8), z0: 0, z1: 24, top: slate, side: slateSide },
    { plan: ngon(8, 7, tx, ty, Math.PI / 8), z0: 23, z1: 28, top: magnet, side: magnetSide },
    {
      plan: orientedBox(
        tx + Math.cos(armAngle) * (reach / 2),
        ty + Math.sin(armAngle) * (reach / 2),
        armAngle,
        reach + 6,
        5.5,
      ),
      z0: 23.5,
      z1: 28.5,
      top: magnet,
      side: magnetSide,
    },
    {
      plan: box(ex - 0.6, ey - 0.6, ex + 0.6, ey + 0.6),
      z0: 19,
      z1: 24,
      top: darkSide,
      side: darkSide,
    },
  ]);
  // Electromagnet disc holding a plate; the plate leads so the group draws after the stack.
  groups.push([
    { plan: orientedBox(ex, ey, 0.4, 11, 8), z0: 13.5, z1: 15.5, top: rust, side: rustSide },
    { plan: ngon(8, 7, ex, ey, Math.PI / 8), z0: 15.5, z1: 19.5, top: signal, side: signalSide },
  ]);
  // Patched hull: three mismatched modules.
  const hull = orientedBox(8, 6, 0.25, 34, 26);
  groups.push([
    { plan: hull, z0: 0, z1: 14, top: steel, side: steelSide },
    { plan: orientedBox(2, 0, 0.25, 12, 10), z0: 14, z1: 14.8, top: olive, side: oliveSide },
    { plan: orientedBox(15, 12, 0.6, 10, 8), z0: 14, z1: 14.8, top: rust, side: rustSide },
    { plan: orientedBox(16, -1, 0.1, 8, 7), z0: 14, z1: 14.8, top: slate, side: slateSide },
    ...wallWindows(facing, 6, 9, 2, 2.6, hull),
    ...[0, 3, 6].map((rib) => ({
      plan: orientedBox(8 + rib, 6 + rib * 0.25, 0.25, 1.2, 5),
      z0: 14.8,
      z1: 15.25,
      top: darkSide,
      side: darkSide,
    })),
  ]);
  const tank = ngon(8, 9, -14, 8, Math.PI / 8);
  groups.push([
    { plan: tank, z0: 0, z1: 18, top: olive, side: oliveSide },
    { plan: ngon(8, 6, -14, 8, Math.PI / 8), z0: 18, z1: 20, top: slate, side: slateSide },
    ...wallWindows(facing, 11, 13.5, 1, 2.6, tank),
  ]);
  // Antenna with a periwinkle beacon on the tank.
  groups.push([
    { plan: box(-14.6, 7.4, -13.4, 8.6), z0: 20, z1: 32, top: dark, side: darkSide },
    { plan: box(-16, 6, -12, 10), z0: 32, z1: 35, top: signal, side: signalSide },
  ]);
  return groups;
}

// Community project world changes (art/projects.md).
const rad = (degrees: number) => (degrees * Math.PI) / 180;

function annulusSegment(a0: number, a1: number, inner: number, outer: number): Plan {
  return [
    [outer * Math.cos(a0), outer * Math.sin(a0)],
    [outer * Math.cos(a1), outer * Math.sin(a1)],
    [inner * Math.cos(a1), inner * Math.sin(a1)],
    [inner * Math.cos(a0), inner * Math.sin(a0)],
  ];
}

// Greenhouse ring around the growers' deck centre: 32 walkway segments with a glass tube and a
// leaf seam, and eight domes, one between each pair of planter tips. The walkway skips the dock
// gap between the two domes beside the dock axis (45 degrees).
const RING_INNER = 61.5;
const RING_OUTER = 69.5;
const RING_BASE = 3;
const RING_DOMES = [15, 75, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
const RING_GAP = [15, 75] as const;
const RING_SEGMENTS = 32;

function greenhouseRing(lit: boolean): Part[][] {
  const groups: Part[][] = [];
  const step = 360 / RING_SEGMENTS;
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const [d0, d1] = [i * step + step / 2, (i + 1) * step + step / 2];
    const mid = (d0 + d1) / 2;
    if (mid > RING_GAP[0] && mid < RING_GAP[1]) {
      continue;
    }
    const [a0, a1] = [rad(d0), rad(d1)];
    groups.push([
      {
        plan: annulusSegment(a0, a1, RING_INNER, RING_OUTER),
        z0: 0,
        z1: RING_BASE,
        top: cream,
        side: creamSide,
      },
      {
        plan: annulusSegment(a0, a1, 63, 68),
        z0: RING_BASE,
        z1: 5.5,
        top: growersGlass,
        side: growersGlassSide,
      },
      { plan: annulusSegment(a0, a1, 64.7, 66.3), z0: 5.5, z1: 6.1, top: leaf, side: leafSide },
    ]);
  }
  const lamp = lit ? bloom : bloomDim;
  const lampSide = lit ? bloomSide : bloomDimSide;
  const r = (RING_INNER + RING_OUTER) / 2;
  for (const d of RING_DOMES) {
    const [cx, cy] = [r * Math.cos(rad(d)), r * Math.sin(rad(d))];
    groups.push([
      {
        plan: ngon(12, 9.2, cx, cy, Math.PI / 12),
        z0: 0,
        z1: RING_BASE + 0.5,
        top: cream,
        side: creamSide,
      },
      ...dome(cx, cy, 8, RING_BASE + 0.5, growersGlass, growersGlassSide, growersGlassCap),
      {
        plan: box(cx - 1.3, cy - 1.3, cx + 1.3, cy + 1.3),
        z0: RING_BASE + 8.9,
        z1: RING_BASE + 11,
        top: lamp,
        side: lampSide,
      },
    ]);
  }
  return groups;
}

const growersRing = (lit: boolean): Part[][] => [...growers(lit), ...greenhouseRing(lit)];

// The paid project adds an independent articulated service arm beside the rig.
function gantry(lit: boolean): Part[][] {
  const base = at(33, 5);
  return [
    [armLink(at(WORKSHOP_PIVOT, 0), base, 2, 7, 7, rigDark)],
    manipulator(base, at(26, 3), at(11, -2), 40, lit),
  ];
}

// Salvage beacon: a periwinkle lamp on a mast over a slate float, centred on its float.
function salvageBeacon(lit: boolean): Part[][] {
  return [
    [
      { plan: ngon(6, 5), z0: 0, z1: 3, top: slate, side: slateSide },
      { plan: box(-0.7, -0.7, 0.7, 0.7), z0: 3, z1: 15, top: dark, side: darkSide },
      {
        plan: box(-2.2, -2.2, 2.2, 2.2),
        z0: 15,
        z1: 18.5,
        top: lit ? magnet : magnetDim,
        side: lit ? magnetSide : magnetDimSide,
      },
    ],
  ];
}

// Three beacons in clear space around the salvagers' yard, as (degrees, radius) from the pivot:
// behind the back stack, left of the front stack and right of the dock, away from the magnet.
// Neighbours blink opposite: phase 0 lights in frame A, phase 1 in frame B.
const SALVAGE_BEACONS = [
  [200, 70],
  [125, 66],
  [0, 64],
] as const;

// Visible sides in plan order, then the top.
function faces(part: Part): { color: string; points: Point[] }[] {
  const top = (plan: Plan) => plan.map(([x, y]): Point => [x, y, part.z1]);
  const forward = facesViewer(top(part.plan));
  const plan = forward ? part.plan : part.plan.toReversed();
  const cap = part.cap ? (forward ? part.cap : part.cap.toReversed()) : plan;
  const result: { color: string; points: Point[] }[] = [];
  for (const [i, a] of plan.entries()) {
    const next = (i + 1) % plan.length;
    const b = plan[next]!;
    const [ax, ay] = cap[i]!;
    const [bx, by] = cap[next]!;
    const points: Point[] = [
      [bx, by, part.z1],
      [ax, ay, part.z1],
      [a[0], a[1], part.z0],
      [b[0], b[1], part.z0],
    ];
    if (facesViewer(points)) {
      result.push({ color: part.side, points });
    }
  }
  result.push({ color: part.top, points: top(cap) });
  return result;
}

// Groups draw far to near by their first part; parts inside a group keep list order.
function polygons(groups: Part[][]) {
  const centre = (part: Part) => part.plan.map(([x, y]): Point => [x, y, (part.z0 + part.z1) / 2]);
  return groups
    .map((group) => ({ group, depth: depth(centre(group[0]!)) }))
    .sort((a, b) => b.depth - a.depth)
    .flatMap(({ group }) => group.flatMap(faces));
}

const outposts: Readonly<Record<string, Outpost>> = {
  growers: {
    build: growers,
    face: GROWERS_FACE,
    pivot: 0,
    mouthWidth: 26,
    frame: { width: 144, height: 120, above: 48 },
  },
  // The growers with the greenhouse ring: the same pivot and dock entrance in a larger frame.
  "growers-ring": {
    build: growersRing,
    face: GROWERS_FACE,
    pivot: 0,
    mouthWidth: 26,
    outpost: "growers",
    project: "greenhouseRing",
    frame: { width: 180, height: 140, above: 63 },
    title: "Growers outpost with the greenhouse ring",
  },
  // The replacement rig keeps the established frame, interaction offset and world pivot.
  workshop: {
    build: workshop,
    face: WORKSHOP_FACE,
    pivot: WORKSHOP_PIVOT,
    mouthWidth: 24,
    frame: { width: 170, height: 120, above: 81 },
  },
  salvagers: {
    build: salvagers,
    face: SALVAGERS_FACE,
    pivot: 0,
    mouthWidth: 26,
    frame: { width: 168, height: 110, above: 44 },
  },
};

type Polygons = ReturnType<typeof polygons>;
type FixedFrame = { width: number; height: number; above: number };

// Writes both blink frames around the world-plane model point `pivot` and returns the frame
// geometry. The pivot sits on the vertical centre line at an exact five-decimal height.
function writeFrames(
  name: string,
  title: string,
  [px, py]: readonly [number, number],
  frames: { a: Polygons; b: Polygons },
  fixed?: FixedFrame,
) {
  const local = ([x, y, z]: Point): Point => [x - px, y - py, z];
  // Frame bounds over both blink frames.
  const all = [...frames.a, ...frames.b].flatMap(({ points }) => points.map(local));
  const xs = all.map((point) => projectAt(0, 0, point)[0]);
  const ys = all.map((point) => projectAt(0, 0, point)[1]);
  const halfWidth = fixed
    ? fixed.width / 2
    : Math.ceil(Math.max(-Math.min(...xs), Math.max(...xs)) + PAD);
  const above = fixed?.above ?? Math.ceil(-Math.min(...ys) + PAD);
  const width = halfWidth * 2;
  // Extra rows below keep the normalized pivot an exact five-decimal value.
  let height = fixed?.height ?? above + Math.ceil(Math.max(...ys) + PAD);
  while ((above * 100000) % height !== 0) {
    height++;
  }

  if (
    fixed &&
    all.some((point) => {
      const [x, y] = projectAt(halfWidth, above, point);
      return x < 2 || x > width - 2 || y < 2 || y > height - 2;
    })
  ) {
    throw new Error(`${name}: replacement clipped by its fixed frame`);
  }
  for (const frame of ["a", "b"] as const) {
    const shapes = frames[frame].map(({ color, points }) => {
      const projected = points.map((point) => {
        const [x, y] = projectAt(halfWidth, above, local(point));
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      });
      return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
    });
    writeFileSync(
      `${output}${name}-${frame}.svg`,
      svgText(
        [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
          `  <title>${title} ${frame.toUpperCase()}</title>`,
          ...shapes,
          "</svg>",
          "",
        ].join("\n"),
        SVG_DECIMALS.outposts,
      ),
    );
  }
  return { above, halfWidth, height, local, width };
}

// Manifest fields shared by outpost frames and overlays.
function frameEntries(name: string, width: number, height: number, above: number) {
  return (["a", "b"] as const).map((frame) => ({
    id: `outpost-${name}-${frame}`,
    path: `/art/outposts/${name}-${frame}.svg`,
    width,
    height,
    displayWidth: round(width * DISPLAY_SCALE * DESTINATION_SCALE * OUTPOST_GROWTH),
    displayHeight: round(height * DISPLAY_SCALE * DESTINATION_SCALE * OUTPOST_GROWTH),
    facing: "fixed",
    pivot: { x: 0.5, y: above / height },
    frameMs: BLINK_MS,
  }));
}

function entries(
  name: string,
  { build, face, pivot, mouthWidth, outpost, project, title, frame }: Outpost,
) {
  const role = outpost ?? name;
  const frames = { a: polygons(build(true)), b: polygons(build(false)) };
  // The pivot lies on the dock axis on the world plane.
  const { above, halfWidth, height, local, width } = writeFrames(
    name,
    title ?? `${name[0]!.toUpperCase()}${name.slice(1)} outpost`,
    at(pivot, 0),
    frames,
    frame,
  );

  // Dock entrance: the mouth's centre on the z = 0 plane, opening toward screen-down.
  const [entranceX, entranceY] = projectAt(halfWidth, above, local([...at(face, 0), 0]));
  const dock = {
    x: round(entranceX),
    y: round(entranceY),
    outward: [0, 1],
    width: round((mouthWidth * Math.sqrt(3)) / Math.SQRT2),
  };
  return frameEntries(name, width, height, above).map((entry) => ({
    ...entry,
    dock,
    outpost: role,
    ...(project ? { project } : {}),
  }));
}

// A project sprite drawn at anchors around its outpost's pivot, in the outpost's blink.
type Overlay = {
  build: (lit: boolean) => Part[][];
  outpost: string;
  project: string;
  title: string;
  // The sprite's pivot, a world-plane model point.
  pivot: readonly [number, number];
  frame?: FixedFrame;
  // Each copy's pivot as a model point, whether it draws behind or in front of the outpost, and
  // its blink phase: 0 shows frame A while the outpost shows A, 1 shows B.
  anchors: readonly { at: readonly [number, number]; layer: "behind" | "front"; phase: 0 | 1 }[];
};

// Each outpost's pivot as a model point, matching `outposts`.
const pivots: Readonly<Record<string, readonly [number, number]>> = {
  growers: at(0, 0),
  workshop: at(WORKSHOP_PIVOT, 0),
  salvagers: at(0, 0),
};

const overlays: Readonly<Record<string, Overlay>> = {
  // The project arm draws over the underlying rig.
  "workshop-crane": {
    build: gantry,
    outpost: "workshop",
    project: "workshopCrane",
    frame: { width: 134, height: 80, above: 61 },
    title: "Workshop crane",
    pivot: at(WORKSHOP_PIVOT, 0),
    anchors: [{ at: at(WORKSHOP_PIVOT, 0), layer: "front", phase: 0 }],
  },
  // One beacon at each yard anchor; beacons farther than the pivot draw behind the outpost.
  "salvagers-beacon": {
    build: salvageBeacon,
    outpost: "salvagers",
    project: "salvageBeacons",
    title: "Salvage beacon",
    pivot: [0, 0],
    anchors: SALVAGE_BEACONS.map(([degrees, radius], k) => {
      const point = [radius * Math.cos(rad(degrees)), radius * Math.sin(rad(degrees))] as const;
      return {
        at: point,
        layer: point[0] + point[1] < 0 ? "behind" : "front",
        phase: k % 2 === 0 ? 0 : 1,
      };
    }),
  },
};

function overlayEntries(name: string, { build, outpost, pivot, project, title, frame }: Overlay) {
  const frames = { a: polygons(build(true)), b: polygons(build(false)) };
  const { above, height, width } = writeFrames(name, title, pivot, frames, frame);
  return frameEntries(name, width, height, above).map((entry) => ({
    ...entry,
    outpost,
    project,
  }));
}

// Frame px from the outpost's pivot to a world-plane model point.
function offset(outpost: string, [x, y]: readonly [number, number]) {
  const [px, py] = pivots[outpost]!;
  const [sx, sy] = projectAt(0, 0, [x - px, y - py, 0]);
  return { x: round(sx), y: round(sy) };
}

mkdirSync(output, { recursive: true });
const manifestEntries = [
  ...Object.entries(outposts).flatMap(([name, outpost]) => entries(name, outpost)),
  ...Object.entries(overlays).flatMap(([name, overlay]) => overlayEntries(name, overlay)),
];

// Sunflower's outposts and their project entries, in Sunflower's manifest.
const own = new RegExp(
  `^outpost-(${[...Object.keys(outposts), ...Object.keys(overlays)].join("|")})-[ab]$`,
);
replaceEntries("sunflower", (id) => own.test(id), manifestEntries);

// World changes keyed by Gameplay's project id: a replacement frame pair for the outpost, or an
// overlay at anchors offset from the outpost's pivot in frame px.
const replacements = Object.entries(outposts).flatMap(([name, { outpost, project }]) =>
  outpost && project
    ? [
        [
          project,
          {
            outpost,
            kind: "replace",
            frames: [`outpost-${name}-a`, `outpost-${name}-b`],
            replaces: [`outpost-${outpost}-a`, `outpost-${outpost}-b`],
          },
        ] as const,
      ]
    : [],
);
const placed = Object.entries(overlays).map(
  ([name, { anchors, outpost, project }]) =>
    [
      project,
      {
        outpost,
        kind: "overlay",
        frames: [`outpost-${name}-a`, `outpost-${name}-b`],
        anchors: anchors.map(({ at: point, layer, phase }) => ({
          ...offset(outpost, point),
          layer,
          phase,
        })),
      },
    ] as const,
);
writeProjects(Object.fromEntries([...replacements, ...placed]));
