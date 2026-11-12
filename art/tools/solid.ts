// Solid-model helpers for the station family: the station, the outposts and Cartwheel's
// destinations and craft. Parts are extruded plans; groups draw far to near.
import { depth, facesViewer, type Point } from "./projection.ts";

export type Plan = readonly (readonly [number, number])[];
// `rear` shades side walls facing the plan's +y (a craft's tail) instead of `side`.
export type Part = { plan: Plan; z0: number; z1: number; top: string; side: string; rear?: string };
export type Face = { color: string; points: Point[] };
// Maps a model point to the drawn orientation (a heading rotation, or none for fixed art).
export type View = (point: Point) => Point;

// Frame px to logical display px, shared with Ada, the enemies and the station.
export const DISPLAY_SCALE = 0.4375;
// Places Ada visits draw larger than the ships, so they read at a glance (art/destinations.md):
// stations, outposts, settlements and quest points by DESTINATION_SCALE, and the Cartwheel hub,
// already built at about 1.55 times the outposts' proportions, by HUB_SCALE. Their display size is
// frame * DISPLAY_SCALE * scale; frame px values (pivots, docks, berths) are unchanged.
export const DESTINATION_SCALE = 1.5;
export const HUB_SCALE = 1.25;
export const BLINK_MS = 700;

// Station family.
export const cream = "#efe4cf";
export const creamSide = "#bfae94";
export const blue = "#70ace8";
export const blueDim = "#3f5878";
export const warm = "#ffe9b8";
export const mouth = "#1e1a26";
export const mouthInner = "#35304a";

// The dock axis (+x, +y) projects straight down the screen.
export const DOCK = Math.PI / 4;

export const box = (x0: number, y0: number, x1: number, y1: number): Plan => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

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
export function orientedBox(
  cx: number,
  cy: number,
  angle: number,
  along: number,
  across: number,
): Plan {
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
// The same on the dock axis.
export const at = (distance: number, across: number) => along(DOCK, distance, across);

// Fixed art: a wall faces the viewer when its outward normal leans toward the dock axis.
export const facing = (nx: number, ny: number) => nx + ny > 0.3;

// Small protruding panes on each wall of a convex plan whose outward normal passes `visible`.
export function wallWindows(
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

// Dock collar with a dark mouth, lit floor and four blue corner lights, as on the station.
// `angle` is the dock's outward axis and `offset` shifts it sideways.
export function dockCollar(
  lit: boolean,
  face: number,
  mouthWidth: number,
  collarWidth: number,
  collarTop: string,
  collarSide: string,
  height: number,
  angle = DOCK,
  offset = 0,
): Part[] {
  const p = (distance: number, across: number) => along(angle, distance, across + offset);
  const frameLight = lit ? blue : blueDim;
  const half = mouthWidth / 2 + 3;
  return [
    {
      plan: orientedBox(...p(face - 4, 0), angle, 8, collarWidth),
      z0: -3,
      z1: height + 4,
      top: collarTop,
      side: collarSide,
    },
    {
      plan: orientedBox(...p(face + 0.3, 0), angle, 0.6, mouthWidth),
      z0: 0,
      z1: height,
      top: mouth,
      side: mouth,
    },
    {
      plan: orientedBox(...p(face + 0.6, 0), angle, 0.6, mouthWidth * 0.71),
      z0: 3.5,
      z1: height - 3.5,
      top: mouthInner,
      side: mouthInner,
    },
    {
      plan: orientedBox(...p(face + 0.9, 0), angle, 0.6, mouthWidth * 0.77),
      z0: 0.6,
      z1: 2.2,
      top: warm,
      side: warm,
    },
    ...[-1, 1].flatMap((side) =>
      [1.5, height - 1.5].map((z): Part => ({
        plan: orientedBox(...p(face + 0.9, side * half), angle, 1.4, 3.6),
        z0: z - 1.8,
        z1: z + 1.8,
        top: frameLight,
        side: frameLight,
      })),
    ),
  ];
}

// A closed collar where a dock mouth was: the collar block with no mouth, floor or corner lights,
// and two warm windows on its face, so the hull reads as finished. `angle` is the collar's outward
// axis and `offset` shifts it sideways, as for dockCollar.
export function closedCollar(
  lit: boolean,
  face: number,
  collarWidth: number,
  collarTop: string,
  collarSide: string,
  height: number,
  angle = DOCK,
  offset = 0,
): Part[] {
  const p = (distance: number, across: number) => along(angle, distance, across + offset);
  const window = lit ? warm : "#a08f78";
  return [
    {
      plan: orientedBox(...p(face - 4, 0), angle, 8, collarWidth),
      z0: -3,
      z1: height + 4,
      top: collarTop,
      side: collarSide,
    },
    ...[-1, 1].map((side): Part => ({
      plan: orientedBox(
        ...p(face + 0.3, side * collarWidth * 0.22),
        angle,
        0.6,
        collarWidth * 0.22,
      ),
      z0: height * 0.4,
      z1: height * 0.75,
      top: window,
      side: window,
    })),
  ];
}

// Visible sides in plan order, then the top. Without `view` the points are the model's own.
export function faces(part: Part, view?: View): Face[] {
  const place = (point: Point) => (view ? view(point) : point);
  const top = (plan: Plan) => plan.map(([x, y]) => place([x, y, part.z1]));
  // Orient the plan so its top faces up.
  const plan = facesViewer(top(part.plan)) ? part.plan : part.plan.toReversed();
  const result: Face[] = [];
  for (const [i, a] of plan.entries()) {
    const b = plan[(i + 1) % plan.length]!;
    const points = (
      [
        [b[0], b[1], part.z1],
        [a[0], a[1], part.z1],
        [a[0], a[1], part.z0],
        [b[0], b[1], part.z0],
      ] as Point[]
    ).map(place);
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

// Groups draw far to near by their first part; parts inside a group keep list order. With
// `levels`, a group whose first part rests on a level (base at or above it) draws after every
// group below that level, as parts on a rotating craft's hull top must.
export function polygons(groups: Part[][], view?: View, levels: readonly number[] = []): Face[] {
  const place = (point: Point) => (view ? view(point) : point);
  const centre = (part: Part) => part.plan.map(([x, y]) => place([x, y, (part.z0 + part.z1) / 2]));
  const level = (part: Part) => levels.filter((z) => part.z0 >= z).length;
  return groups
    .map((group) => ({ group, depth: depth(centre(group[0]!)), level: level(group[0]!) }))
    .sort((a, b) => a.level - b.level || b.depth - a.depth)
    .flatMap(({ group }) => group.flatMap((part) => faces(part, view)));
}
