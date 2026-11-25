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
// The mesh primitives every producer builds from. Angles are degrees in plan from +x toward +y.
//
// | Primitive     | Solid                                                                  |
// | ------------- | ---------------------------------------------------------------------- |
// | `meshFace`    | One planar polygon, convex or concave                                  |
// | `meshBox`     | Axis-aligned box between two corners                                   |
// | `meshBlock`   | Box in any unit frame, by centre and half sizes                        |
// | `meshBar`     | Radial box about a vertical axis                                       |
// | `meshExtrude` | Planar polygon swept along a vector                                    |
// | `meshLoft`    | Skin through convex sections, capped                                   |
// | `meshTube`    | Cylinder, frustum or cone on any axis; `phase` turns its facets        |
// | `meshRing`    | Level ring of rectangular section, whole or open over a `gap` arc      |
// | `meshHoop`    | Ring about any axis, whole or the half `toward` a direction            |
// | `meshDome`    | Hemisphere or sphere cut on the terminator of a `light` in mesh space  |
// | `meshBall`    | Ellipsoid cut on the terminator, with its own `terminator` share       |
// | `meshSpiral`  | Band winding about the vertical axis                                   |
// | `meshScale`   | The mesh scaled per axis about the origin                              |
// | `meshPlace`   | The mesh turned about the vertical axis, scaled and moved              |
// | `meshClip`    | The part of each face on one side of a plane through the origin (open) |
// | `meshCapped`  | The half of a convex solid on one side of any plane, closed by a cap   |
// General solids for the enemy fleet: closed meshes of planar faces, which art/tools/visible.ts
// resolves face against face by exact depth, so interpenetrating solids occlude correctly.
// Mesh space is forward +x, port +y, up +z.

// Flat tones of one material: tops, walls facing the light (screen left) and walls facing away.
export type Tones = readonly [top: string, left: string, right: string];
// How a face picks its tone: `flat` and `curved` by its view normal (`curved` keeps the top tone
// for level caps only), `round` by the light, in two tones. `lit` and `shade` are the two sides
// of a round surface split on the light terminator.
export type FaceKind = "flat" | "curved" | "round" | "lit" | "shade";

// The one light, from the upper left, in view space.
export const LIGHT: Point = (() => {
  const light = [-0.2, 0.5, 0.84] as const;
  const length = Math.hypot(...light);
  return [light[0] / length, light[1] / length, light[2] / length];
})();
// A round surface is lit where its unit normal's share of the light exceeds this.
export const TERMINATOR = 0.42;
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
// `cap1` tone the end discs and `phase` turns the facets about the axis, in degrees.
export function meshTube(
  mesh: Mesh,
  p0: Point,
  p1: Point,
  r0: number,
  r1: number,
  tones: Tones,
  sides = 48,
  caps: { cap0?: Tones; cap1?: Tones; kind?: FaceKind; phase?: number } = {},
): void {
  const axis = unit(sub(p1, p0));
  const kind = caps.kind ?? (Math.abs(axis[2]) > 0.999 ? "curved" : "round");
  const e1 = unit(cross(axis, Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const e2 = cross(axis, e1);
  const ring = (centre: Point, radius: number) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (2 * Math.PI * (i + 0.5)) / sides + ((caps.phase ?? 0) * Math.PI) / 180;
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

// ------------------------------------------------------------------ rings, domes and placement

const polar = (radius: number, degrees: number): readonly [number, number] => [
  radius * Math.cos((degrees * Math.PI) / 180),
  radius * Math.sin((degrees * Math.PI) / 180),
];

// Box centred at `centre` with half sizes along the unit frame `ex`, `ey`, `ez`.
export function meshBlock(
  mesh: Mesh,
  centre: Point,
  frame: readonly [Point, Point, Point],
  half: Point,
  tones: Tones,
): void {
  const [ex, ey, ez] = frame;
  const sides = [
    [ex, half[0], ey, half[1], ez, half[2]],
    [ey, half[1], ez, half[2], ex, half[0]],
    [ez, half[2], ex, half[0], ey, half[1]],
  ] as const;
  for (const [axis, s, u, su, w, sw] of sides) {
    for (const sign of [1, -1]) {
      const o = add(centre, mul(axis, sign * s));
      meshFace(
        mesh,
        [
          add(o, add(mul(u, su), mul(w, sw))),
          add(o, add(mul(u, -su), mul(w, sw))),
          add(o, add(mul(u, -su), mul(w, -sw))),
          add(o, add(mul(u, su), mul(w, -sw))),
        ],
        mul(axis, sign),
        tones,
      );
    }
  }
}

// Radial box about the vertical axis through (cx, cy): from radius r0 to r1 at `degrees`,
// `width` wide, between heights z0 and z1.
export function meshBar(
  mesh: Mesh,
  degrees: number,
  r0: number,
  r1: number,
  width: number,
  z0: number,
  z1: number,
  tones: Tones,
  [cx, cy]: readonly [number, number] = [0, 0],
): void {
  const [x, y] = polar(1, degrees);
  const middle = (r0 + r1) / 2;
  meshBlock(
    mesh,
    [cx + x * middle, cy + y * middle, (z0 + z1) / 2],
    [
      [x, y, 0],
      [-y, x, 0],
      [0, 0, 1],
    ],
    [(r1 - r0) / 2, width / 2, (z1 - z0) / 2],
    tones,
  );
}

// Ring of rectangular section about the vertical axis through (cx, cy). `gap` leaves the arc
// from its first to its second angle (degrees) open, with a flat end face on each side of the
// opening.
export function meshRing(
  mesh: Mesh,
  [cx, cy]: readonly [number, number],
  z0: number,
  z1: number,
  outer: number,
  inner: number,
  tones: Tones,
  sides = 64,
  gap?: readonly [number, number],
): void {
  const span = gap ? 360 - (gap[1] - gap[0]) : 360;
  const count = gap ? Math.max(4, Math.round((sides * span) / 360)) : sides;
  // A whole ring's facets start half a facet round; an open ring's start on the opening's edge.
  const angle = (i: number) => (gap ? gap[1] + (span * i) / count : (360 * (i + 0.5)) / sides);
  const at = (radius: number, i: number, z: number): Point => {
    const [x, y] = polar(radius, angle(gap ? i : i % sides));
    return [cx + x, cy + y, z];
  };
  for (let i = 0; i < count; i++) {
    const j = i + 1;
    const [x, y] = polar(1, (angle(i) + angle(i + 1)) / 2);
    const out: Point = [x, y, 0];
    meshFace(
      mesh,
      [at(inner, i, z1), at(outer, i, z1), at(outer, j, z1), at(inner, j, z1)],
      [0, 0, 1],
      tones,
    );
    meshFace(
      mesh,
      [at(inner, i, z0), at(outer, i, z0), at(outer, j, z0), at(inner, j, z0)],
      [0, 0, -1],
      tones,
    );
    meshFace(
      mesh,
      [at(outer, i, z0), at(outer, j, z0), at(outer, j, z1), at(outer, i, z1)],
      out,
      tones,
      "curved",
    );
    meshFace(
      mesh,
      [at(inner, i, z0), at(inner, j, z0), at(inner, j, z1), at(inner, i, z1)],
      mul(out, -1),
      tones,
      "curved",
    );
  }
  if (!gap) return;
  for (const [i, side] of [
    [0, -1],
    [count, 1],
  ] as const) {
    const [x, y] = polar(1, angle(i));
    meshFace(
      mesh,
      [at(inner, i, z0), at(outer, i, z0), at(outer, i, z1), at(inner, i, z1)],
      [-y * side, x * side, 0],
      tones,
    );
  }
}

// Ring of rectangular section about any axis: radii `outer` and `inner`, `thick` along the
// axis. With `toward`, a vector in the ring's plane, only the half ring on that side is built,
// closed by its two end caps.
export function meshHoop(
  mesh: Mesh,
  centre: Point,
  axis: Point,
  outer: number,
  inner: number,
  thick: number,
  tones: Tones,
  sides = 40,
  toward?: Point,
): void {
  const ax = unit(axis);
  const e1 = unit(cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const e2 = cross(ax, e1);
  const h = mul(ax, thick / 2);
  const start =
    toward === undefined ? 0 : Math.atan2(dot(toward, e2), dot(toward, e1)) - Math.PI / 2;
  const span = toward === undefined ? 2 * Math.PI : Math.PI;
  const steps = toward === undefined ? sides : Math.floor(sides / 2);
  const directions = Array.from({ length: steps + 1 }, (_, i) => {
    const a = start + (span * i) / steps;
    return add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
  });
  const at = (d: Point, radius: number, side: number) =>
    add(add(centre, mul(d, radius)), mul(h, side));
  for (const [i, d0] of directions.slice(0, -1).entries()) {
    const d1 = directions[i + 1]!;
    const out = add(d0, d1);
    meshFace(
      mesh,
      [at(d0, outer, -1), at(d1, outer, -1), at(d1, outer, 1), at(d0, outer, 1)],
      out,
      tones,
    );
    meshFace(
      mesh,
      [at(d0, inner, -1), at(d1, inner, -1), at(d1, inner, 1), at(d0, inner, 1)],
      mul(out, -1),
      tones,
    );
    meshFace(
      mesh,
      [at(d0, inner, 1), at(d0, outer, 1), at(d1, outer, 1), at(d1, inner, 1)],
      ax,
      tones,
    );
    meshFace(
      mesh,
      [at(d0, inner, -1), at(d0, outer, -1), at(d1, outer, -1), at(d1, inner, -1)],
      mul(ax, -1),
      tones,
    );
  }
  if (toward !== undefined) {
    for (const d of [directions[0]!, directions.at(-1)!]) {
      meshFace(
        mesh,
        [at(d, inner, -1), at(d, outer, -1), at(d, outer, 1), at(d, inner, 1)],
        mul(toward, -1),
        tones,
      );
    }
  }
}

// Hemisphere on the level plane through `centre`, or a full sphere. Each facet is split on the
// light terminator, so its two tones meet on a true curve. `light` is the light in mesh space:
// a model drawn turned passes the light turned back by its heading.
export function meshDome(
  mesh: Mesh,
  centre: Point,
  radius: number,
  tones: Tones,
  options: { sides?: number; bands?: number; full?: boolean; light?: Point } = {},
): void {
  const { sides = 28, bands = 7, full = false, light = LIGHT } = options;
  const steps = bands * (full ? 2 : 1);
  const latitude = (i: number) => (full ? -90 : 0) + ((full ? 180 : 90) * i) / steps;
  const at = (lat: number, lon: number): Point => {
    const [a, b] = [(lat * Math.PI) / 180, (lon * Math.PI) / 180];
    return add(
      centre,
      mul([Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)], radius),
    );
  };
  const limit = TERMINATOR * radius;
  for (let i = 0; i < steps; i++) {
    const [la0, la1] = [latitude(i), latitude(i + 1)];
    for (let j = 0; j < sides; j++) {
      const [lo0, lo1] = [(360 * j) / sides, (360 * (j + 1)) / sides];
      let facet = [at(la0, lo0), at(la0, lo1), at(la1, lo1), at(la1, lo0)];
      if (la1 > 89.9) facet = facet.slice(0, 3);
      if (la0 < -89.9) facet = facet.slice(1);
      const hint = sub(mean(facet), centre);
      for (const [sign, kind] of [
        [1, "lit"],
        [-1, "shade"],
      ] as const) {
        const part: Point[] = [];
        for (const [k, a] of facet.entries()) {
          const b = facet[(k + 1) % facet.length]!;
          const da = sign * (dot(sub(a, centre), light) - limit);
          const db = sign * (dot(sub(b, centre), light) - limit);
          if (da >= 0) part.push(a);
          if (da > 0 !== db > 0 && Math.abs(da - db) > 1e-12) {
            part.push(add(a, mul(sub(b, a), da / (da - db))));
          }
        }
        if (part.length >= 3) meshFace(mesh, part, hint, tones, kind);
      }
    }
  }
}

// Ellipsoid with radii `radii` about `centre`, in two flat tones that meet where the unit
// normal's share of the light equals `terminator`. `light` is the light in mesh space, as for
// meshDome.
export function meshBall(
  mesh: Mesh,
  centre: Point,
  radii: Point,
  tones: Tones,
  options: { sides?: number; bands?: number; light?: Point; terminator?: number } = {},
): void {
  const { sides = 24, bands = 12, light = LIGHT, terminator = 0.3 } = options;
  const at = (lat: number, lon: number): Point => {
    const [a, b] = [(lat * Math.PI) / 180, (lon * Math.PI) / 180];
    return [
      centre[0] + radii[0] * Math.cos(a) * Math.cos(b),
      centre[1] + radii[1] * Math.cos(a) * Math.sin(b),
      centre[2] + radii[2] * Math.sin(a),
    ];
  };
  const outward = (p: Point, power: number): Point => [
    (p[0] - centre[0]) / radii[0] ** power,
    (p[1] - centre[1]) / radii[1] ** power,
    (p[2] - centre[2]) / radii[2] ** power,
  ];
  const lit = (p: Point) => dot(unit(outward(p, 2)), light) - terminator;
  for (let i = 0; i < bands; i++) {
    const [la0, la1] = [-90 + (180 * i) / bands, -90 + (180 * (i + 1)) / bands];
    for (let j = 0; j < sides; j++) {
      const [lo0, lo1] = [(360 * j) / sides, (360 * (j + 1)) / sides];
      let facet = [at(la0, lo0), at(la0, lo1), at(la1, lo1), at(la1, lo0)];
      if (i === bands - 1) facet = facet.slice(0, 3);
      if (i === 0) facet = facet.slice(1);
      const hint = outward(mean(facet), 1);
      for (const [sign, kind] of [
        [1, "lit"],
        [-1, "shade"],
      ] as const) {
        const part: Point[] = [];
        for (const [k, a] of facet.entries()) {
          const b = facet[(k + 1) % facet.length]!;
          const [da, db] = [sign * lit(a), sign * lit(b)];
          if (da >= 0) part.push(a);
          if (da > 0 !== db > 0 && Math.abs(da - db) > 1e-12) {
            part.push(add(a, mul(sub(b, a), da / (da - db))));
          }
        }
        if (part.length >= 3) meshFace(mesh, part, hint, tones, kind);
      }
    }
  }
}

// Spiral band about the vertical axis. The functions take the angle travelled in degrees from
// `from` to `to` and give the band's centre radius, width, top and bottom; `turn` is the angle
// the band starts at.
export function meshSpiral(
  mesh: Mesh,
  turn: number,
  from: number,
  to: number,
  shape: {
    radius: (travelled: number) => number;
    width: (travelled: number) => number;
    top: (travelled: number) => number;
    bottom: (travelled: number) => number;
  },
  tones: Tones,
  step = 5,
): void {
  const count = Math.max(1, Math.round((to - from) / step));
  const stations = Array.from({ length: count + 1 }, (_, i) => {
    const travelled = from + ((to - from) * i) / count;
    const [x, y] = polar(1, turn + travelled);
    const d: Point = [x, y, 0];
    const [r, w] = [shape.radius(travelled), shape.width(travelled)];
    const [t, b] = [shape.top(travelled), shape.bottom(travelled)];
    const corner = (radius: number, z: number): Point => [x * radius, y * radius, z];
    return {
      d,
      innerTop: corner(r - w / 2, t),
      outerTop: corner(r + w / 2, t),
      innerBottom: corner(r - w / 2, b),
      outerBottom: corner(r + w / 2, b),
    };
  });
  const up: Point = [0, 0, 1];
  for (const [i, s0] of stations.slice(0, -1).entries()) {
    const s1 = stations[i + 1]!;
    const out = add(s0.d, s1.d);
    meshFace(mesh, [s0.innerTop, s0.outerTop, s1.outerTop], up, tones);
    meshFace(mesh, [s0.innerTop, s1.outerTop, s1.innerTop], up, tones);
    meshFace(
      mesh,
      [s0.outerBottom, s1.outerBottom, s1.outerTop, s0.outerTop],
      out,
      tones,
      "curved",
    );
    meshFace(
      mesh,
      [s0.innerBottom, s1.innerBottom, s1.innerTop, s0.innerTop],
      mul(out, -1),
      tones,
      "curved",
    );
  }
  const end = stations.at(-1)!;
  meshFace(
    mesh,
    [end.innerBottom, end.outerBottom, end.outerTop, end.innerTop],
    [-end.d[1], end.d[0], 0],
    tones,
  );
}

// The mesh turned `degrees` about the vertical axis, scaled by `k` and moved by `offset`.
export function meshPlace(mesh: Mesh, degrees = 0, k = 1, offset: Point = [0, 0, 0]): Mesh {
  const [c, s] = polar(1, degrees);
  const turn = ([x, y, z]: Point): Point => [x * c - y * s, x * s + y * c, z];
  return mesh.map((face) => ({
    ...face,
    points: face.points.map((p) => add(mul(turn(p), k), offset)),
    normal: turn(face.normal),
  }));
}

// The half of a convex solid on the side of the plane through `point` that `inward` points to,
// closed by a cap over the cut.
export function meshCapped(mesh: Mesh, point: Point, inward: Point, tones: Tones): Mesh {
  const n = unit(inward);
  const out: Mesh = [];
  const cut: Point[] = [];
  for (const face of mesh) {
    const points: Point[] = [];
    for (const [i, p] of face.points.entries()) {
      const q = face.points[(i + 1) % face.points.length]!;
      const [sp, sq] = [dot(sub(p, point), n), dot(sub(q, point), n)];
      if (sp >= 0) points.push(p);
      if (sp >= 0 !== sq >= 0) points.push(add(p, mul(sub(q, p), sp / (sp - sq))));
    }
    if (points.length < 3 || norm(newell(points)) <= 1e-9) continue;
    out.push({ ...face, points });
    cut.push(...points.filter((p) => Math.abs(dot(sub(p, point), n)) < 1e-6));
  }
  if (cut.length < 3) return out;
  // The cut's convex hull in the plane, by monotone chain.
  const u = unit(cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const v = cross(n, u);
  const flat = cut
    .map((p) => [dot(sub(p, point), u), dot(sub(p, point), v)] as const)
    .toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (
    o: readonly [number, number],
    a: readonly [number, number],
    b: readonly [number, number],
  ) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (points: readonly (readonly [number, number])[]) => {
    const hull: (readonly [number, number])[] = [];
    for (const p of points) {
      while (hull.length >= 2 && turn(hull.at(-2)!, hull.at(-1)!, p) <= 1e-9) hull.pop();
      hull.push(p);
    }
    return hull.slice(0, -1);
  };
  const hull = [...chain(flat), ...chain(flat.toReversed())];
  if (hull.length >= 3) {
    meshFace(
      out,
      hull.map(([x, y]) => add(point, add(mul(u, x), mul(v, y)))),
      mul(n, -1),
      tones,
    );
  }
  return out;
}
