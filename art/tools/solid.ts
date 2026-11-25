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

// ------------------------------------------------------------------ meshes
// General solids for the enemy fleet: closed meshes of planar faces, which art/tools/visible.ts
// resolves face against face by exact depth, so interpenetrating solids occlude correctly.
// Mesh space is forward +x, port +y, up +z.

// Flat tones of one material: tops, walls facing the light (screen left) and walls facing away.
export type Tones = readonly [top: string, left: string, right: string];
// How a face picks its tone: `flat` and `curved` by its view normal (`curved` keeps the top tone
// for level caps only), `round` by the light, in two tones.
export type FaceKind = "flat" | "curved" | "round";
// A convex planar polygon with its outward unit normal. `group` names the destruction shard
// the face belongs to.
export type MeshFace = {
  points: Point[];
  normal: Point;
  tones: Tones;
  kind: FaceKind;
  group?: number;
};
export type Mesh = MeshFace[];

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Point, k: number): Point => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Point) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Point): Point => mul(a, 1 / norm(a));
const mean = (points: readonly Point[]): Point =>
  mul(
    points.reduce((sum, p) => add(sum, p), [0, 0, 0] as Point),
    1 / points.length,
  );

// Newell normal of a planar polygon, unnormalised.
function newell(points: readonly Point[]): Point {
  let n: Point = [0, 0, 0];
  for (const [i, a] of points.entries()) {
    n = add(n, cross(a, points[(i + 1) % points.length]!));
  }
  return n;
}

// A planar polygon as convex pieces: itself when convex, else ear-clipped triangles.
function convexPieces(points: readonly Point[], normal: Point): Point[][] {
  const turn = (a: Point, b: Point, c: Point) => dot(cross(sub(b, a), sub(c, b)), normal);
  const ring = points.filter((p, i) => norm(sub(p, points[(i + 1) % points.length]!)) > 1e-9);
  if (ring.length < 3) return [];
  const convex = ring.every(
    (p, i) => turn(p, ring[(i + 1) % ring.length]!, ring[(i + 2) % ring.length]!) >= -1e-9,
  );
  if (convex) return [ring];
  const rest = [...ring];
  const pieces: Point[][] = [];
  while (rest.length > 3) {
    const ear = rest.findIndex((b, i) => {
      const a = rest[(i + rest.length - 1) % rest.length]!;
      const c = rest[(i + 1) % rest.length]!;
      if (turn(a, b, c) <= 1e-12) return false;
      return rest.every(
        (p) =>
          p === a ||
          p === b ||
          p === c ||
          turn(a, b, p) < -1e-12 ||
          turn(b, c, p) < -1e-12 ||
          turn(c, a, p) < -1e-12,
      );
    });
    if (ear === -1) throw new Error("A mesh face is not a simple polygon");
    pieces.push([
      rest[(ear + rest.length - 1) % rest.length]!,
      rest[ear]!,
      rest[(ear + 1) % rest.length]!,
    ]);
    rest.splice(ear, 1);
  }
  pieces.push(rest);
  return pieces;
}

// Adds a planar polygon whose outward side is the side `hint` points to.
export function meshFace(
  mesh: Mesh,
  points: readonly Point[],
  hint: Point,
  tones: Tones,
  kind: FaceKind = "flat",
): void {
  let normal = newell(points);
  if (norm(normal) < 1e-9) return;
  normal = unit(normal);
  let ring = [...points];
  if (dot(normal, hint) < 0) {
    normal = mul(normal, -1);
    ring = ring.toReversed();
  }
  for (const piece of convexPieces(ring, normal)) {
    mesh.push({ points: piece, normal, tones, kind });
  }
}

// Axis-aligned box between two corners.
export function meshBox(mesh: Mesh, a: Point, b: Point, tones: Tones): void {
  const lo = a.map((v, i) => Math.min(v, b[i]!));
  const hi = a.map((v, i) => Math.max(v, b[i]!));
  const corner = (i: number, j: number, k: number): Point => [
    i ? hi[0]! : lo[0]!,
    j ? hi[1]! : lo[1]!,
    k ? hi[2]! : lo[2]!,
  ];
  for (const s of [0, 1]) {
    const out = s ? 1 : -1;
    meshFace(
      mesh,
      [corner(s, 0, 0), corner(s, 1, 0), corner(s, 1, 1), corner(s, 0, 1)],
      [out, 0, 0],
      tones,
    );
    meshFace(
      mesh,
      [corner(0, s, 0), corner(1, s, 0), corner(1, s, 1), corner(0, s, 1)],
      [0, out, 0],
      tones,
    );
    meshFace(
      mesh,
      [corner(0, 0, s), corner(1, 0, s), corner(1, 1, s), corner(0, 1, s)],
      [0, 0, out],
      tones,
    );
  }
}

// A planar polygon, convex or concave, swept along `sweep`.
export function meshExtrude(
  mesh: Mesh,
  points: readonly Point[],
  sweep: Point,
  tones: Tones,
  kind: FaceKind = "flat",
): void {
  let ring = [...points];
  let normal = newell(ring);
  if (dot(normal, sweep) < 0) {
    ring = ring.toReversed();
    normal = mul(normal, -1);
  }
  normal = unit(normal);
  meshFace(mesh, ring, mul(sweep, -1), tones);
  meshFace(
    mesh,
    ring.map((p) => add(p, sweep)),
    sweep,
    tones,
  );
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length]!;
    if (norm(sub(b, a)) < 1e-9) continue;
    meshFace(mesh, [a, b, add(b, sweep), add(a, sweep)], cross(sub(b, a), normal), tones, kind);
  }
}

// Skin between successive convex sections with equal point counts, capped at both ends.
export function meshLoft(
  mesh: Mesh,
  sections: readonly (readonly Point[])[],
  tones: Tones,
  kind: FaceKind = "flat",
): void {
  for (const [s, s0] of sections.slice(0, -1).entries()) {
    const s1 = sections[s + 1]!;
    const [c0, c1] = [mean(s0), mean(s1)];
    const axis = unit(sub(c1, c0));
    const middle = mul(add(c0, c1), 0.5);
    for (let i = 0; i < s0.length; i++) {
      const j = (i + 1) % s0.length;
      const quad = [s0[i]!, s0[j]!, s1[j]!, s1[i]!] as const;
      const out = sub(mean(quad), middle);
      const hint = sub(out, mul(axis, dot(out, axis)));
      const first = cross(sub(quad[1], quad[0]), sub(quad[3], quad[0]));
      const second = cross(sub(quad[2], quad[1]), sub(quad[2], quad[3]));
      const n = norm(first) > norm(second) ? first : second;
      const flat =
        norm(n) < 1e-9 ||
        (Math.abs(dot(unit(n), sub(quad[2], quad[0]))) < 1e-6 &&
          Math.abs(dot(unit(n), sub(quad[3], quad[1]))) < 1e-6);
      if (flat) {
        meshFace(mesh, quad, hint, tones, kind);
      } else {
        meshFace(mesh, [quad[0], quad[1], quad[2]], hint, tones, kind);
        meshFace(mesh, [quad[0], quad[2], quad[3]], hint, tones, kind);
      }
    }
  }
  const [first, last] = [sections[0]!, sections.at(-1)!];
  meshFace(mesh, first, sub(mean(first), mean(sections[1]!)), tones);
  meshFace(mesh, last, sub(mean(last), mean(sections.at(-2)!)), tones);
}

// Cylinder, frustum or cone from p0 to p1 with radii r0 and r1, in `sides` facets. `cap0` and
// `cap1` tone the end discs.
export function meshTube(
  mesh: Mesh,
  p0: Point,
  p1: Point,
  r0: number,
  r1: number,
  tones: Tones,
  sides = 48,
  caps: { cap0?: Tones; cap1?: Tones; kind?: FaceKind } = {},
): void {
  const axis = unit(sub(p1, p0));
  const kind = caps.kind ?? (Math.abs(axis[2]) > 0.999 ? "curved" : "round");
  const e1 = unit(cross(axis, Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const e2 = cross(axis, e1);
  const ring = (centre: Point, radius: number) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (2 * Math.PI * (i + 0.5)) / sides;
      return add(centre, add(mul(e1, radius * Math.cos(a)), mul(e2, radius * Math.sin(a))));
    });
  const [ring0, ring1] = [ring(p0, r0), ring(p1, r1)];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const middle = mul(add(add(ring0[i]!, ring0[j]!), add(ring1[i]!, ring1[j]!)), 0.25);
    const onAxis = add(p0, mul(axis, dot(sub(middle, p0), axis)));
    const facet =
      r0 < 1e-6
        ? [ring0[i]!, ring1[j]!, ring1[i]!]
        : r1 < 1e-6
          ? [ring0[i]!, ring0[j]!, ring1[i]!]
          : [ring0[i]!, ring0[j]!, ring1[j]!, ring1[i]!];
    meshFace(mesh, facet, sub(middle, onAxis), tones, kind);
  }
  if (r0 > 1e-6) meshFace(mesh, ring0, mul(axis, -1), caps.cap0 ?? tones);
  if (r1 > 1e-6) meshFace(mesh, ring1, axis, caps.cap1 ?? tones);
}

// The mesh scaled by (kx, ky, kz) about the origin.
export function meshScale(mesh: Mesh, [kx, ky, kz]: Point): Mesh {
  return mesh.map((face) => ({
    ...face,
    points: face.points.map(([x, y, z]): Point => [x * kx, y * ky, z * kz]),
    normal: unit([face.normal[0] / kx, face.normal[1] / ky, face.normal[2] / kz]),
  }));
}

// Keeps the part of each face on the side of the plane through the origin that `inward` points
// to; clipped faces stay convex.
export function meshClip(mesh: Mesh, inward: Point): Mesh {
  const out: Mesh = [];
  for (const face of mesh) {
    const points: Point[] = [];
    for (const [i, p] of face.points.entries()) {
      const q = face.points[(i + 1) % face.points.length]!;
      const [sp, sq] = [dot(p, inward), dot(q, inward)];
      if (sp >= 0) points.push(p);
      if (sp >= 0 !== sq >= 0) points.push(add(p, mul(sub(q, p), sp / (sp - sq))));
    }
    if (points.length >= 3 && norm(newell(points)) > 1e-9) out.push({ ...face, points });
  }
  return out;
}
