import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { depth, facesViewer, json, type Point, projectAt, round } from "./projection.ts";

type Plan = readonly (readonly [number, number])[];
type Part = { plan: Plan; z0: number; z1: number; top: string; side: string };

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
// Frame px to logical display px, shared with Ada and the enemies.
const DISPLAY_SCALE = 0.4375;
const BLINK_MS = 700;
const PAD = 4;

const lavender = "#c4afcc";
const lavenderSide = "#8f7c9c";
const lavenderDark = "#6f5f7d";
const spoke = "#b5a2c0";
const hub = "#dccfe2";
const hubSide = "#a08cad";
const cream = "#efe4cf";
const creamSide = "#bfae94";
const craneTop = "#d9cbb1";
const glass = "#7fd6cc";
const glassSide = "#4fa59d";
const glassCap = "#c4efe8";
const blue = "#70ace8";
const blueSide = "#5687ba";
const blueDim = "#3f5878";
const blueDimSide = "#33475f";
const warm = "#ffe9b8";
const mouth = "#1e1a26";
const mouthInner = "#35304a";

const R_IN = 54;
const R_OUT = 65;
// The dock axis (+x, +y) projects straight down the screen.
const DOCK = Math.PI / 4;
const DOCK_FACE = 88;
const DOCK_MOUTH = 31;

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

// Small protruding window boxes on each wall of a convex plan whose outward normal passes `visible`.
function wallWindows(
  visible: (nx: number, ny: number) => boolean,
  z0: number,
  z1: number,
  count: number,
  width: number,
  plan: Plan,
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
      out.push({ plan: pane, z0, z1, top: warm, side: warm });
    }
  }
  return out;
}

// Groups draw far to near by their first part; parts inside a group keep list order.
function model(lit: boolean): Part[][] {
  const groups: Part[][] = [];
  const segments = 24;
  for (let i = 0; i < segments; i++) {
    const [a0, a1] = [(2 * Math.PI * i) / segments, (2 * Math.PI * (i + 1)) / segments];
    const plan: Plan = [
      [R_OUT * Math.cos(a0), R_OUT * Math.sin(a0)],
      [R_OUT * Math.cos(a1), R_OUT * Math.sin(a1)],
      [R_IN * Math.cos(a1), R_IN * Math.sin(a1)],
      [R_IN * Math.cos(a0), R_IN * Math.sin(a0)],
    ];
    const ring: Part[] = [{ plan, z0: 0, z1: 7, top: lavender, side: lavenderSide }];
    if (i % 2 === 0) {
      ring.push(...wallWindows((nx, ny) => nx + ny > 0.9, 2.5, 4.5, 1, 2.4, plan));
    }
    groups.push(ring);
  }

  // Four spokes on the screen diagonals, clear of the dock axis.
  for (const degrees of [0, 90, 180, 270]) {
    const a = (degrees * Math.PI) / 180;
    const mid = (21 + R_IN) / 2;
    const plan = orientedBox(mid * Math.cos(a), mid * Math.sin(a), a, R_IN - 21 + 2, 6);
    groups.push([{ plan, z0: 2, z1: 5.5, top: spoke, side: lavenderDark }]);
  }

  // Hub: tall octagon with windows, cream cap, mast and beacon.
  const facing = (nx: number, ny: number) => nx + ny > 0.3;
  const hubPlan = ngon(8, 23, 0, 0, Math.PI / 8);
  groups.push([
    { plan: hubPlan, z0: 0, z1: 18, top: hub, side: hubSide },
    ...wallWindows(facing, 9, 13, 2, 3.2, hubPlan),
    { plan: ngon(8, 13, 0, 0, Math.PI / 8), z0: 18, z1: 23, top: cream, side: creamSide },
    { plan: box(-1.3, -1.3, 1.3, 1.3), z0: 23, z1: 38, top: hub, side: hubSide },
    {
      plan: box(-2.4, -2.4, 2.4, 2.4),
      z0: 38,
      z1: 41.5,
      top: lit ? blue : blueDim,
      side: lit ? blueSide : blueDimSide,
    },
  ]);

  // Greenhouses: stepped glass domes on the ring.
  const ringMid = (R_IN + R_OUT) / 2;
  for (const degrees of [135, 315, 245]) {
    const a = (degrees * Math.PI) / 180;
    const [cx, cy] = [ringMid * Math.cos(a), ringMid * Math.sin(a)];
    groups.push([
      { plan: ngon(6, 10.5, cx, cy), z0: 7, z1: 9.5, top: lavender, side: lavenderSide },
      { plan: ngon(6, 9, cx, cy), z0: 9.5, z1: 15, top: glass, side: glassSide },
      { plan: ngon(6, 5, cx, cy), z0: 15, z1: 18, top: glassCap, side: glass },
    ]);
  }

  // Workshop: cream block with lit windows and a crane rail.
  const w = (205 * Math.PI) / 180;
  const [wx, wy] = [ringMid * Math.cos(w), ringMid * Math.sin(w)];
  const workshop = orientedBox(wx, wy, w + Math.PI / 2, 24, 15);
  groups.push([
    { plan: workshop, z0: 7, z1: 17, top: cream, side: creamSide },
    ...wallWindows(facing, 11, 14, 3, 2.6, workshop),
    {
      plan: orientedBox(wx, wy, w + Math.PI / 2, 24, 4),
      z0: 17,
      z1: 19,
      top: craneTop,
      side: creamSide,
    },
  ]);

  // Dock: arm toward the viewer, cream collar, dark mouth, lit floor and blue frame lights.
  const [ux, uy] = [Math.cos(DOCK), Math.sin(DOCK)];
  const [vx, vy] = [-uy, ux];
  const at = (distance: number, across: number) =>
    [ux * distance + vx * across, uy * distance + vy * across] as const;
  const armMid = (R_OUT - 2 + 80) / 2;
  const arm = orientedBox(...at(armMid, 0), DOCK, 80 - (R_OUT - 2), 20);
  const frameLight = lit ? blue : blueDim;
  groups.push([
    { plan: arm, z0: 1, z1: 11, top: hub, side: hubSide },
    ...wallWindows((nx, ny) => nx + ny > -0.2 && Math.abs(nx - ny) > 0.5, 5, 8, 2, 2.6, arm),
    { plan: orientedBox(...at(84, 0), DOCK, 8, 42), z0: -3, z1: 20, top: cream, side: creamSide },
    {
      plan: orientedBox(...at(DOCK_FACE + 0.3, 0), DOCK, 0.6, DOCK_MOUTH),
      z0: 0,
      z1: 16,
      top: mouth,
      side: mouth,
    },
    {
      plan: orientedBox(...at(DOCK_FACE + 0.6, 0), DOCK, 0.6, 22),
      z0: 3.5,
      z1: 12.5,
      top: mouthInner,
      side: mouthInner,
    },
    {
      plan: orientedBox(...at(DOCK_FACE + 0.9, 0), DOCK, 0.6, 24),
      z0: 0.6,
      z1: 2.2,
      top: warm,
      side: warm,
    },
    ...[-1, 1].flatMap((side) =>
      [1.5, 14.5].map((z): Part => ({
        plan: orientedBox(...at(DOCK_FACE + 0.9, side * 18.5), DOCK, 1.4, 3.6),
        z0: z - 1.8,
        z1: z + 1.8,
        top: frameLight,
        side: frameLight,
      })),
    ),
  ]);

  // Approach-light pairs in front of the mouth blink opposite the frame lights.
  const approach = lit ? blueDim : blue;
  groups.push(
    [
      [102, 10],
      [118, 7],
    ].flatMap(([distance, across]) =>
      [-1, 1].map((side): Part => {
        const [lx, ly] = at(distance!, side * across!);
        return {
          plan: box(lx - 2, ly - 2, lx + 2, ly + 2),
          z0: 5,
          z1: 7.5,
          top: approach,
          side: approach,
        };
      }),
    ),
  );
  return groups;
}

// Visible sides in plan order, then the top.
function faces(part: Part): { color: string; points: Point[] }[] {
  const top = (plan: Plan) => plan.map(([x, y]): Point => [x, y, part.z1]);
  const plan = facesViewer(top(part.plan)) ? part.plan : part.plan.toReversed();
  const result: { color: string; points: Point[] }[] = [];
  for (const [i, a] of plan.entries()) {
    const b = plan[(i + 1) % plan.length]!;
    const points: Point[] = [
      [b[0], b[1], part.z1],
      [a[0], a[1], part.z1],
      [a[0], a[1], part.z0],
      [b[0], b[1], part.z0],
    ];
    if (facesViewer(points)) {
      result.push({ color: part.side, points });
    }
  }
  result.push({ color: part.top, points: top(plan) });
  return result;
}

function polygons(lit: boolean) {
  const centre = (part: Part) => part.plan.map(([x, y]): Point => [x, y, (part.z0 + part.z1) / 2]);
  return model(lit)
    .map((group) => ({ group, depth: depth(centre(group[0]!)) }))
    .sort((a, b) => b.depth - a.depth)
    .flatMap(({ group }) => group.flatMap(faces));
}

// Frame bounds over both blink frames, with the pivot (hub base) on the vertical centre line.
const all = [...polygons(true), ...polygons(false)].flatMap(({ points }) => points);
const xs = all.map((point) => projectAt(0, 0, point)[0]);
const ys = all.map((point) => projectAt(0, 0, point)[1]);
const halfWidth = Math.ceil(Math.max(-Math.min(...xs), Math.max(...xs)) + PAD);
const above = Math.ceil(-Math.min(...ys) + PAD);
const width = halfWidth * 2;
// Extra rows below keep the normalized pivot an exact five-decimal value.
let height = above + Math.ceil(Math.max(...ys) + PAD);
while ((above * 100000) % height !== 0) {
  height++;
}

function svg(frame: "a" | "b"): string {
  const shapes = polygons(frame === "a").map(({ color, points }) => {
    const projected = points.map((point) => {
      const [x, y] = projectAt(halfWidth, above, point);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <title>Station ${frame.toUpperCase()}</title>`,
    ...shapes,
    "</svg>",
    "",
  ].join("\n");
}

// Dock entrance: the mouth's centre on the z = 0 plane, opening toward screen-down.
const [entranceX, entranceY] = projectAt(halfWidth, above, [
  Math.cos(DOCK) * DOCK_FACE,
  Math.sin(DOCK) * DOCK_FACE,
  0,
]);
const dock = {
  x: round(entranceX),
  y: round(entranceY),
  outward: [0, 1],
  width: round((DOCK_MOUTH * Math.sqrt(3)) / Math.SQRT2),
};

const entries = (["a", "b"] as const).map((frame) => ({
  id: `station-${frame}`,
  path: `/art/station-${frame}.svg`,
  width,
  height,
  displayWidth: round(width * DISPLAY_SCALE),
  displayHeight: round(height * DISPLAY_SCALE),
  facing: "fixed",
  pivot: { x: 0.5, y: above / height },
  frameMs: BLINK_MS,
  dock,
}));

for (const frame of ["a", "b"] as const) {
  writeFileSync(`${art}station-${frame}.svg`, svg(frame));
}

// Station entries sit before the enemy entries, which enemies.ts keeps last.
const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { assets: { id: string }[] };
const kept = manifest.assets.filter(({ id }) => !id.startsWith("station-"));
const enemies = kept.findIndex(({ id }) => id.startsWith("enemy-"));
const insert = enemies === -1 ? kept.length : enemies;
manifest.assets = [...kept.slice(0, insert), ...entries, ...kept.slice(insert)];
writeFileSync(manifestPath, json(manifest));
