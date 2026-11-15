// Ada's ship model: the one hull, canopy, mouths and paint every ship drawing derives from. It
// has no side effects; ship.ts writes the sprite frames and contracts, and other generators
// (the quantum jump, the app icon) import it rather than copying the geometry.
import { oklchToSrgb } from "@andornaut/art-kit/build/colour";

import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { facesViewer, type Point, projectAt, rotate, round, SHIP_HEADINGS } from "./projection.ts";
import type { V2 } from "./silhouette.ts";
import {
  convexParts,
  ordered,
  outside,
  partition,
  plane,
  planarTriangles,
  split,
  type Surface,
  type Tree,
  type Plane as CutPlane,
} from "./ship-surface.ts";

// Material-tagged solid facets retain local geometry before clipping and depth ordering.
type Face = {
  color: string;
  layer: number;
  points: Point[];
  part?: string;
  silhouette?: boolean;
  twoSided?: boolean;
  opening?: boolean;
  canopyFace?: boolean;
  collarFace?: boolean;
};

// Hull and glazing materials retain their authored references; engine surfaces derive from them.
// Flame materials are independent of the housing and opening.
export interface Paint {
  readonly canopyRoof: string;
  readonly canopySides: string;
  readonly engineHousing: string;
  readonly engineOpening: string;
  readonly frontSides: string;
  readonly rearSides: string;
  // Hull top.
  readonly top: string;
  readonly skirt: string;
}

export interface Scheme {
  readonly id: string;
  readonly name: string;
  readonly paint: Paint;
}

export const ENGINE_MATERIAL_RELATIONSHIPS = {
  referenceWall: "#1767b3",
  referenceOpening: "#86deff",
  housingLightnessLift: 0.055,
  housingChromaRatio: 0.92,
} as const;

/** Openings share Classic's luminous reference while retaining paint-derived hues. */
export function engineMaterials(base: string) {
  const reference = ENGINE_MATERIAL_RELATIONSHIPS;
  const [wallL, wallA, wallB] = toOklab(rgb(reference.referenceWall));
  const [openingL, openingA, openingB] = toOklab(rgb(reference.referenceOpening));
  const [L, a, b] = toOklab(rgb(base));
  const chroma = Math.hypot(a, b),
    hue = Math.atan2(b, a);
  const colour = (lightness: number, C: number, h: number) =>
    hex(fromOklab(Math.min(1, Math.max(0, lightness)), C * Math.cos(h), C * Math.sin(h)));
  const engineHousing = colour(
    L + reference.housingLightnessLift,
    chroma * reference.housingChromaRatio,
    hue,
  );
  const referenceHousing = colour(
    wallL + reference.housingLightnessLift,
    Math.hypot(wallA, wallB) * reference.housingChromaRatio,
    Math.atan2(wallB, wallA),
  );
  const housingL = toOklab(rgb(engineHousing))[0];
  const referenceHousingL = toOklab(rgb(referenceHousing))[0];
  const headroom = (openingL - referenceHousingL) / (1 - referenceHousingL);
  const openingHue = Math.atan2(openingB, openingA) + hue - Math.atan2(wallB, wallA);
  return {
    engineHousing,
    engineOpening:
      base === reference.referenceWall
        ? reference.referenceOpening
        : hex(
            oklchToSrgb([
              Math.max(openingL, housingL + (1 - housingL) * headroom),
              Math.hypot(openingA, openingB),
              (openingHue * 180) / Math.PI,
            ]),
          ),
  };
}

const CLASSIC = {
  canopyRoof: "#2585d0",
  canopySides: "#1767b3",
  ...engineMaterials("#1767b3"),
  frontSides: "#929ca3",
  rearSides: "#28558a",
  skirt: "#abbfce",
  top: "#ffffff",
} as const;
// Purchased paints retain their authored facet ratios independently of Classic.
const PALETTE_RATIOS = {
  frontSides: "#b2bec6",
  rearSides: "#647d8d",
  skirt: "#abbfce",
} as const;
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (hex: string) =>
  channels(hex)
    .map(linear)
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i]!, 0);
function tone(top: string, reference: string): string {
  const factor = luminance(reference);
  return (
    "#" +
    channels(top)
      .map(linear)
      .map((c) => {
        const v = c * factor;
        return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}
function painted(
  id: string,
  name: string,
  top: string,
  canopyRoof: string,
  canopySides: string,
): Scheme {
  return {
    id,
    name,
    paint: {
      top,
      canopyRoof,
      canopySides,
      ...engineMaterials(canopySides),
      frontSides: tone(top, PALETTE_RATIOS.frontSides),
      rearSides: tone(top, PALETTE_RATIOS.rearSides),
      skirt: tone(top, PALETTE_RATIOS.skirt),
    },
  };
}
export const SCHEMES: readonly Scheme[] = [
  { id: "classic", name: "Classic", paint: CLASSIC },
  painted("cobalt", "Cobalt", "#6f9ff0", "#eef5ff", "#b4c8e6"),
  painted("seafoam", "Seafoam", "#d4f6ea", "#14697a", "#0d4c59"),
  painted("graphite", "Crimson", "#d96b73", "#382a32", "#251d24"),
  painted("iris", "Iris", "#d9ccff", "#3a2b8c", "#271c66"),
  painted("amber", "Amber", "#f4b665", "#24577b", "#173a57"),
];
export const classic = SCHEMES[0]!;
// UP projects straight up.
export const UP = (SHIP_HEADINGS * 225) / 360;
// Frame and display size in px.
export const FRAME = 96;
export const DISPLAY = 42;

// A pose: the sprite's heading (`yaw`, of SHIP_HEADINGS, fractional allowed) and authored thrust flag,
// plus, for drawings beyond the sprite frames, a bank (`roll`, degrees about the hull's forward
// axis, positive lowering the starboard wing on screen), a `stretch` along the hull's length
// and a `squash` across it, all about the pivot and applied before the heading turn. The
// sprite frames use the bare heading, so their numbers are exactly the heading rotation's.
export interface Pose {
  readonly roll?: number;
  readonly squash?: number;
  readonly stretch?: number;
  readonly thrust?: boolean;
  readonly yaw: number;
}

const rigid = (pose: Pose) => pose.stretch === undefined && pose.squash === undefined;

// A local point (or direction) in world space for this pose.
function place(pose: Pose, [x, y, z]: Point): Point {
  if (rigid(pose) && !pose.roll) {
    return rotate(SHIP_HEADINGS, pose.yaw, [x, y, z]);
  }
  const [k, q] = [pose.stretch ?? 1, pose.squash ?? 1];
  const r = ((pose.roll ?? 0) * Math.PI) / 180;
  const [sx, sz] = [x * q, z * q];
  return rotate(SHIP_HEADINGS, pose.yaw, [
    sx * Math.cos(r) - sz * Math.sin(r),
    y * k,
    sx * Math.sin(r) + sz * Math.cos(r),
  ]);
}

// Swapping plan axes reverses winding; reverse to retain upward-facing tops.
function plan(z: number, points: readonly (readonly [number, number])[]): Point[] {
  return points.map(([x, y]): Point => [y * 0.32, x * 0.32, z]).toReversed();
}

// Hull: a pyramid on the swept delta plan. The frames, speed jets and nose all derive from
// the model definitions in this module, so a model swap regenerates them together.
const HULL = {
  // Plan outline: nose, wing tip, rear notch, tail, notch, wing tip.
  plan: [
    [-100, 0],
    [64, -67],
    [49, -17],
    [76, 0],
    [49, 17],
    [64, 67],
  ],
  // Vertical edge strip round the plan; the upper faces start at its top.
  skirt: 1.2,
  // The ridge runs low from the nose to the shoulder at the canopy's rear edge, then
  // climbs steeply to the rear-centre apex. Local (x, y, z).
  shoulder: [0, 6, 9.5],
  apex: [0, 17, 15],
  // Rear faces lean forward from the skirt top, degrees from horizontal.
  lean: 76,
} as const;

// A plane as n . p = d.
type Plane = { readonly d: number; readonly n: Point };

const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function through(p: Point, q: Point, r: Point): Plane {
  const n = cross(minus(q, p), minus(r, p));
  return { d: dot(n, p), n };
}

// The rear-facing plane that rises from plan edge a-b at the lean.
function leaning(a: Point, b: Point): Plane {
  const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
  // The plan perpendicular that points rearward (positive Y).
  const sign = Math.sign(ex) / Math.hypot(ex, ey);
  const lean = (HULL.lean * Math.PI) / 180;
  const n: Point = [-ey * sign * Math.sin(lean), ex * sign * Math.sin(lean), Math.cos(lean)];
  return { d: dot(n, a), n };
}

// The point common to three planes.
function meet(p: Plane, q: Plane, r: Plane): Point {
  const [qr, rp, pq] = [cross(q.n, r.n), cross(r.n, p.n), cross(p.n, q.n)];
  const det = dot(p.n, qr);
  const at = (i: number) => (p.d * qr[i]! + q.d * rp[i]! + r.d * pq[i]!) / det;
  return [at(0), at(1), at(2)];
}

// Named hull vertices. The swept plan's notches lie ahead of the apex, so the rear is
// split into planar faces: a wall leaning up from each wing's trailing edge, and a tail
// side from each notch up to the apex and down the single tail ridge to the tail tip.
// A wing's corner is where its wall, its steep face and its tail side meet.
function vertices() {
  const [tipR, notchR, tail, notchL, tipL, nose] = plan(HULL.skirt, HULL.plan) as [
    Point,
    Point,
    Point,
    Point,
    Point,
    Point,
  ];
  const { apex, shoulder } = HULL;
  const corner = (tip: Point, notch: Point) =>
    meet(through(shoulder, tip, apex), leaning(tip, notch), through(notch, tail, apex));
  const rightCorner = corner(tipR, notchR);
  return {
    apex,
    cornerL: [-rightCorner[0], rightCorner[1], rightCorner[2]] as Point,
    cornerR: rightCorner,
    nose,
    notchL,
    notchR,
    shoulder,
    tail,
    tipL,
    tipR,
  };
}

// Upper faces, each a planar polygon wound to face up: per side the wing face, which
// carries the canopy, then the steep face, the wall, which holds the mouth, and the tail
// side, which rise behind the canopy.
type Part = "side" | "steep" | "wall" | "wing";

function upperFaces(): { part: Part; points: Point[] }[] {
  const v = vertices();
  const up = (points: Point[]) => (normal(points)[2] < 0 ? points.toReversed() : points);
  const sides = [
    [v.tipL, v.notchL, v.cornerL],
    [v.tipR, v.notchR, v.cornerR],
  ] as const;
  const faces = (part: Part, pick: (side: (typeof sides)[number]) => Point[]) =>
    sides.map((side) => ({ part, points: up(pick(side)) }));
  return [
    ...faces("wing", ([tip]) => [v.nose, tip, v.shoulder]),
    ...faces("steep", ([tip, , corner]) => [v.shoulder, tip, corner, v.apex]),
    ...faces("wall", ([tip, notch, corner]) => [tip, notch, corner]),
    ...faces("side", ([, notch, corner]) => [notch, v.tail, v.apex, corner]),
  ];
}

// Wing roof height under the canopy: the lower of the two wing planes.
function roof(x: number, y: number): number {
  const v = vertices();
  const height = ({ d, n }: Plane) => (d - n[0] * x - n[1] * y) / n[2];
  return Math.min(
    height(through(v.nose, v.tipL, v.shoulder)),
    height(through(v.nose, v.shoulder, v.tipR)),
  );
}

// Nose: the midpoint of the plan's forward-most vertices at the skirt top (local forward
// is negative Y).
export function nose(): Point {
  const hull = plan(HULL.skirt, HULL.plan);
  const front = Math.min(...hull.map(([, y]) => y));
  const tip = hull.filter(([, y]) => y === front);
  const mean = (axis: number) => tip.reduce((sum, point) => sum + point[axis]!, 0) / tip.length;
  return [mean(0), mean(1), mean(2)];
}

// Engine mouths on the wing walls: |x| from inner to outer, z from the skirt top up by
// low and high, the top kept 0.6 under the wall's top edge.
const MOUTHS = { inner: 9.5, outer: 15, low: 0.3, high: 2.6 };

// Mouth quad on the sign side's wall, lifted 0.03 off it, wound outward: outer low,
// inner low, inner high, outer high.
function mouthBase(sign: number): Point[] {
  const v = vertices();
  const [tip, notch, corner] =
    sign === 1 ? [v.tipR, v.notchR, v.cornerR] : [v.tipL, v.notchL, v.cornerL];
  const { d, n } = leaning(tip, notch);
  const at = (x: number, z: number): Point => [x, (d - n[0] * x - n[2] * z) / n[1] + 0.03, z];
  const edge = (x: number) => tip[2] + ((corner[2] - tip[2]) * (x - tip[0])) / (corner[0] - tip[0]);
  const { high, inner, low, outer } = MOUTHS;
  const z0 = HULL.skirt + low;
  const top = (x: number) => Math.min(HULL.skirt + high, edge(x) - 0.6);
  const quad = [
    at(sign * outer, z0),
    at(sign * inner, z0),
    at(sign * inner, top(sign * inner)),
    at(sign * outer, top(sign * outer)),
  ];
  return sign === 1 ? quad : quad.toReversed();
}

export const ENGINE_OPENING_SCALE = 1.25;

/** The luminous aperture grows about its existing centre, independently of jet hardpoints. */
export function engineOpeningGeometry(sign: number) {
  const original = mouthBase(sign);
  const centre = original.reduce<Point>(
    (sum, point) =>
      point.map((value, index) => sum[index]! + value / original.length) as unknown as Point,
    [0, 0, 0],
  );
  const points = original.map(
    (point) =>
      point.map(
        (value, index) => centre[index]! + (value - centre[index]!) * ENGINE_OPENING_SCALE,
      ) as unknown as Point,
  );
  const v = vertices();
  const housing = sign < 0 ? [v.tipL, v.notchL, v.cornerL] : [v.tipR, v.notchR, v.cornerR];
  return { original, points, centre, housing, linearScale: ENGINE_OPENING_SCALE };
}

function mouth(sign: number): Point[] {
  return engineOpeningGeometry(sign).points;
}

/** A near wing attaches at the visible skirt bottom; equal-depth wings share that choice. */
export function jetAttachmentForPose(pose: Pose, sign: number) {
  const { tipL, tipR, notchL, notchR } = vertices();
  const tips = [tipL, tipR];
  const depths = tips.map((tip) => {
    const [x, y, z] = place(pose, tip);
    return x + y + z;
  });
  const index = sign < 0 ? 0 : 1;
  const near = depths[index]! >= depths[1 - index]! - 1e-9;
  const tip = tips[index]!,
    notch = sign < 0 ? notchL : notchR;
  const z = near ? 0 : HULL.skirt;
  return { corner: [tip[0], tip[1], z] as Point, notch: [notch[0], notch[1], z] as Point, near };
}

export function jetAttachment(yaw: number, sign: number) {
  return jetAttachmentForPose({ yaw }, sign);
}

/** Project the same forward hardpoints through ordinary, banked or stretched ship poses. */
export function forwardJetMouths(pivot: number, pose: Pose) {
  const projected = (centre: number, point: Point) =>
    projectAt(centre, centre, place(pose, point)).map(round) as [number, number];
  return [-1, 1].map((sign) => {
    const { middle, half } = mouthAxis(sign);
    const { corner } = jetAttachmentForPose(pose, sign);
    return {
      anchor: projected(pivot, middle),
      axis: projected(0, [0, 1, 0]),
      half: projected(0, half),
      outerCorner: projected(pivot, corner),
      coreOutboard: true as const,
    };
  });
}

/** Retro exhaust points forward and outward, retaining the true rear wall's plane. */
export function retroMouthAxis(sign: number): {
  axis: Point;
  corner: Point;
  half: Point;
  rearNormal: Point;
} {
  const { tipL, tipR, notchL, notchR } = vertices();
  const tip = sign < 0 ? tipL : tipR;
  const notch = sign < 0 ? notchL : notchR;
  const halfWidth = (MOUTHS.outer - MOUTHS.inner) / 2;
  const angle = (10 * Math.PI) / 180;
  const slope = (tip[1] - notch[1]) / (tip[0] - notch[0]);
  return {
    axis: [sign * Math.sin(angle), -Math.cos(angle), 0],
    corner: tip,
    half: [sign * halfWidth, 0, 0],
    rearNormal: [-slope, 1, 0],
  };
}

// Mouth middle and half width along its base, outer minus inner over two.
export function mouthAxis(sign: number): { half: Point; middle: Point } {
  const quad = mouthBase(sign);
  const [outerLow, innerLow] = sign === 1 ? [quad[0]!, quad[1]!] : [quad[3]!, quad[2]!];
  const middle = quad.reduce<Point>(
    (sum, [x, y, z]) => [sum[0] + x / 4, sum[1] + y / 4, sum[2] + z / 4],
    [0, 0, 0],
  );
  const half: Point = [(outerLow[0] - innerLow[0]) / 2, (outerLow[1] - innerLow[1]) / 2, 0];
  return { half, middle };
}

// Stable materials follow the physical facet role, not the viewing direction.
function shade(paint: Paint, upper: readonly { part: Part; points: Point[] }[]) {
  return new Map(
    upper.map(({ part }, i) => [
      i,
      part === "wing"
        ? paint.top
        : part === "steep"
          ? paint.frontSides
          : part === "wall"
            ? paint.engineHousing
            : paint.rearSides,
    ]),
  );
}

function model(pose: Pose, paint: Paint): Face[] {
  const faces: Face[] = [];
  const outline = plan(HULL.skirt, HULL.plan);
  // One fixed skirt material surrounds the hull.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[(i + 1) % outline.length]!;
    const b = outline[i]!;
    faces.push({
      color: paint.skirt,
      layer: 2,
      points: [a, b, [b[0], b[1], 0], [a[0], a[1], 0]],
    });
  }
  const upper = upperFaces();
  const color = shade(paint, upper);
  const rear = place(pose, [0, 1, 0]);
  const tailLayer = rear[0] + rear[1] > 0 ? 6 : 3;
  for (const [i, { part, points }] of upper.entries()) {
    const layer = part === "wing" ? 3 : tailLayer;
    faces.push({
      color: color.get(i) ?? paint.rearSides,
      layer,
      points,
      part: part,
      opening: true,
    });
  }
  for (const sign of [-1, 1]) {
    faces.push({
      color: paint.engineOpening,
      layer: 6.5,
      points: mouth(sign),
      part: `mouth-${sign}`,
    });
  }
  canopy(faces, paint);
  closeOpening(faces, paint);
  return faces;
}

const turned = (pose: Pose, points: readonly Point[]) => points.map((point) => place(pose, point));

// Newell normal of a polygon, unnormalized.
function normal(points: readonly Point[]): Point {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Closed opaque canopy sampled from the continuous upper and lower profiles.
const CANOPY = { a: 9, b: 9, centre: -3, segments: 48 };

function canopy(faces: Face[], paint: Paint): void {
  const { a, b, centre, segments } = CANOPY;
  const rings = Array.from({ length: 13 }, (_, i) => i * 7.5);

  const at = (u: number, v: number, deform = true): Point => {
    const theta = (u / segments) * 2 * Math.PI;
    const phi = (v * Math.PI) / 180;
    const x = a * Math.cos(phi) * Math.cos(theta);
    const y = centre + b * Math.cos(phi) * Math.sin(theta);
    const base = canopyBase(x, y) + hoodSeat(x, y),
      t = (y - centre) / b;
    const across = Math.sqrt(Math.max(0, 1 - t * t));
    if (across < 1e-7) return [x, y, y > centre ? 9.5 : roof(0, centre - b)];
    const top = continuousUpper(y);
    const fraction = Math.min(1, Math.sin(phi) / across);
    const lower = Math.max(0, Math.min(1, (0.65 - fraction) / 0.65));
    const lowerWeight = lower * lower * lower * (10 - 15 * lower + 6 * lower * lower);
    return [
      x,
      y,
      base + (top - base) * fraction + (deform ? (lowerEnvelope(y) - base) * lowerWeight : 0),
    ];
  };

  // One closed surface removes overlapping shell/closure materials.
  const rim = [
    ...Array.from({ length: segments }, (_, u) => at(u, 0)),
    ...Array.from({ length: segments }, (_, u) => rings.slice(1).map((v) => at(u, v))).flat(),
  ];
  const seed = [0, segments / 4, segments / 2, (segments * 3) / 4];
  const inside: Point = [0, 0, 0].map((_, j) =>
    seed.reduce((v, i) => v + rim[i]![j]! / 4, 0),
  ) as unknown as Point;
  let closure = [
    [seed[0]!, seed[1]!, seed[2]!],
    [seed[0]!, seed[3]!, seed[1]!],
    [seed[0]!, seed[2]!, seed[3]!],
    [seed[1]!, seed[3]!, seed[2]!],
  ];
  const orient = (f: number[]) =>
    dot(normal(f.map((i) => rim[i]!)), minus(rim[f[0]!]!, inside)) < 0 ? f.toReversed() : f;
  closure = closure.map(orient);
  for (let i = 0; i < rim.length; i++) {
    if (seed.includes(i)) continue;
    const seen = closure.filter(
      (f) => dot(normal(f.map((j) => rim[j]!)), minus(rim[i]!, rim[f[0]!]!)) > 1e-8,
    );
    if (!seen.length) continue;
    const edges = new Map<string, number[]>();
    for (const f of seen)
      for (let k = 0; k < 3; k++) {
        const a = f[k]!,
          b = f[(k + 1) % 3]!,
          key = [a, b].sort((a, b) => a - b).join(",");
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [a, b]);
      }
    closure = closure.filter((f) => !seen.includes(f));
    for (const edge of edges.values()) closure.push(orient([...edge, i]));
  }
  canopyClosedPlanes = closure.map((f) => {
    const points = f.map((i) => rim[i]!),
      n = normal(points);
    return { n, d: dot(n, points[0]!) };
  });
  const rimDepth = 0.18;
  for (const f of closure) {
    const vertices = f.map((i) => rim[i]!);
    const roof: Point[] = [],
      edge: Point[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i]!,
        b = vertices[(i + 1) % vertices.length]!;
      const da = a[2] - lowerEnvelope(a[1]) - rimDepth,
        db = b[2] - lowerEnvelope(b[1]) - rimDepth;
      if (da >= 0) roof.push(a);
      if (da <= 0) edge.push(a);
      if (da * db < 0) {
        const t = da / (da - db);
        const p: Point = [
          a[0] + t * (b[0] - a[0]),
          a[1] + t * (b[1] - a[1]),
          a[2] + t * (b[2] - a[2]),
        ];
        roof.push(p);
        edge.push(p);
      }
    }
    if (roof.length >= 3)
      faces.push({ color: paint.canopyRoof, layer: 5, canopyFace: true, points: roof });
    if (edge.length >= 3)
      faces.push({ color: paint.canopySides, layer: 5, canopyFace: true, points: edge });
  }
}

// Canopy highlight: the roof colour mixed 45 percent toward white.
export function highlight(roof: string): string {
  const channels = [1, 3, 5].map((i) => Number.parseInt(roof.slice(i, i + 2), 16));
  return `#${channels
    .map((c) =>
      Math.round(c + (255 - c) * 0.45)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// Preserve the original canopy coordinates while the surrounding roof becomes slightly higher.
function referenceCanopyRoof(x: number, y: number): number {
  const v = vertices(),
    shoulder: Point = [0, 6, 7.5];
  const height = ({ d, n }: Plane) => (d - n[0] * x - n[1] * y) / n[2];
  return Math.min(
    height(through(v.nose, v.tipL, shoulder)),
    height(through(v.nose, shoulder, v.tipR)),
  );
}

// Connect the raised roof's opening to the unchanged original canopy base.
function closeOpening(faces: Face[], paint: Paint): void {
  const wingColors = shade(paint, upperFaces());
  const ring = Array.from({ length: 48 }, (_, i) => {
    const a = (i * Math.PI) / 24,
      x = 9 * Math.cos(a),
      y = -3 + 9 * Math.sin(a);
    const outerX = Math.sign(x) * openingWidth(y, Math.abs(x));
    return {
      upper: [outerX, y, roof(outerX, y)] as Point,
      lower: [x, y, canopyBase(x, y) + hoodSeat(x, y) - rearUndersideDrop(y)] as Point,
    };
  });
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!,
      b = ring[(i + 1) % ring.length]!;
    faces.push({
      color: wingColors.get(a.upper[0] + b.upper[0] < 0 ? 0 : 1) ?? paint.frontSides,
      layer: 4,
      part: "collar",
      collarFace: true,
      points: [a.upper, b.upper, b.lower, a.lower],
      twoSided: true,
    });
  }
}

// The existing front stays unchanged; the rear base closes into the locked kink.
function canopyBase(x: number, y: number): number {
  const t = Math.max(0, Math.min(1, (y + 3) / 9)),
    blend = t * t * (3 - 2 * t);
  return referenceCanopyRoof(x, y) + 2 * blend;
}

// One cubic Bezier spans the whole crown, with a rounded front and horizontal rear contact.
function continuousUpper(y: number): number {
  const z0 = roof(0, -12);
  let low = 0,
    high = 1;
  for (let i = 0; i < 28; i++) {
    const t = (low + high) / 2,
      u = 1 - t;
    const py = -12 * u * u * u - 8.027496906094033 * u * u * t + 15.6 * u * t * t + 6 * t * t * t;
    if (py < y) low = t;
    else high = t;
  }
  const t = (low + high) / 2,
    u = 1 - t;
  return z0 * u * u * u + 3 * 13 * u * u * t + 3 * 9.5 * u * t * t + 9.5 * t * t * t;
}

// The underside and opening collar retain their C2 hood seating. The upper crown
// uses one Bezier from the exact hood endpoint, with no localized height blend.
function hoodSeat(x: number, y: number): number {
  const t = Math.max(0, Math.min(1, (y + 12) / 4));
  const weight = 1 - t * t * t * (10 - 15 * t + 6 * t * t);
  return (roof(x, y) - canopyBase(x, y)) * weight;
}

// The lower rear gains fullness; C2-zero ends preserve both contacts and the front.
function lowerEnvelope(y: number): number {
  const t = Math.max(0, Math.min(1, (y + 12) / 18)),
    u = 2 * t - 1;
  return roof(0, -12) * (1 - t) + 9.5 * t - 5.7 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 + 0.3 * u);
}
function rearUndersideDrop(y: number): number {
  const u = (y + 3) / 9,
    x = 9 * Math.sqrt(Math.max(0, 1 - u * u));
  return canopyBase(x, y) + hoodSeat(x, y) - lowerEnvelope(y);
}

// The interior aperture follows the lowered glazing depth, leaving the outer wing edge intact.
function openingWidth(y: number, oldWidth: number): number {
  const lower = lowerEnvelope(y);
  const slope = roof(0, y) - roof(1, y);
  const depthWidth = (roof(0, y) - lower + 0.16) / slope;
  const wingEdge = (21.44 * (y + 32)) / 52.48;
  return Math.max(oldWidth, Math.min(wingEdge - 0.65, depthWidth));
}
const apertureRing = Array.from({ length: 48 }, (_, i) => {
  const a = (i * Math.PI) / 24,
    x = 9 * Math.cos(a),
    y = -3 + 9 * Math.sin(a);
  return [Math.sign(x) * openingWidth(y, Math.abs(x)), y];
});
let canopyClosedPlanes: { n: Point; d: number }[] = [];

const openingVolumes = convexParts(apertureRing as [number, number][]).map((ids) => {
  const points = ids.map((i) => apertureRing[i]!);
  const area = points.reduce((s, a, i) => {
      const b = points[(i + 1) % points.length]!;
      return s + a[0]! * b[1]! - b[0]! * a[1]!;
    }, 0),
    sign = area > 0 ? 1 : -1;
  const boundaries: CutPlane[] = points.map((a, i) => {
    const b = points[(i + 1) % points.length]!,
      dx = b[0]! - a[0]!,
      dy = b[1]! - a[1]!,
      length = Math.hypot(dx, dy),
      normal: Point = [(sign * dy) / length, (-sign * dx) / length, 0];
    return { normal, distance: normal[0] * a[0]! + normal[1] * a[1]! };
  });
  return {
    boundaries,
    x0: Math.min(...points.map((p) => p[0]!)),
    x1: Math.max(...points.map((p) => p[0]!)),
    y0: Math.min(...points.map((p) => p[1]!)),
    y1: Math.max(...points.map((p) => p[1]!)),
  };
});
const prepared = new Map<string, { surfaces: Surface[]; tree: Tree | null }>();
function geometry(paint: Paint) {
  const key = JSON.stringify(paint);
  const existing = prepared.get(key);
  if (existing) return existing;
  const faces = model({ yaw: 0 }, paint);
  const bodyPlanes = canopyClosedPlanes.map(({ n, d }) => {
    const length = Math.hypot(...n);
    return { normal: n.map((c) => c / length) as unknown as Point, distance: d / length };
  });
  const surfaces: Surface[] = [];
  for (const face of faces) {
    if (face.silhouette) continue;
    let pieces = planarTriangles({
      color: face.color,
      points: face.points,
      ...(face.part === undefined ? {} : { kind: face.part }),
      ...(face.twoSided === undefined ? {} : { twoSided: face.twoSided }),
    });
    if (face.opening)
      for (const opening of openingVolumes)
        pieces = pieces.flatMap((piece) => {
          const xs = piece.points.map((p) => p[0]),
            ys = piece.points.map((p) => p[1]);
          if (
            Math.max(...xs) < opening.x0 ||
            Math.min(...xs) > opening.x1 ||
            Math.max(...ys) < opening.y0 ||
            Math.min(...ys) > opening.y1
          )
            return [piece];
          return outside(opening.boundaries, piece);
        });
    if (face.collarFace) pieces = pieces.flatMap((piece) => outside(bodyPlanes, piece));
    surfaces.push(...pieces);
  }
  const value = { surfaces, tree: partition(surfaces) };
  prepared.set(key, value);
  return value;
}
function viewer(pose: Pose): Point {
  const origin = place(pose, [0, 0, 0]);
  const basis = ([0, 1, 2] as const).map((i) => {
    const p = place(pose, [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0]);
    return p.map((c, j) => c - origin[j]!) as unknown as Point;
  });
  const determinant = dot(basis[0]!, cross(basis[1]!, basis[2]!));
  return [
    dot(cross(basis[1]!, basis[2]!), [1, 1, 1]) / determinant,
    dot(cross(basis[2]!, basis[0]!), [1, 1, 1]) / determinant,
    dot(cross(basis[0]!, basis[1]!), [1, 1, 1]) / determinant,
  ];
}
/** The raised luminous surface stays inside its actual housing even at grazing angles. */
function visibleOutline(pivot: number, pose: Pose, surface: Surface): V2[] {
  const points = turned(pose, surface.points as Point[]);
  if (!surface.twoSided && !facesViewer(points)) return [];
  let projected: Point[] = points.map((p) => {
    const [x, y] = projectAt(pivot, pivot, p);
    return [x, y, 0];
  });
  const sign = surface.kind === "mouth--1" ? -1 : surface.kind === "mouth-1" ? 1 : undefined;
  if (sign !== undefined) {
    const housing = turned(pose, engineOpeningGeometry(sign).housing).map((p) =>
      projectAt(pivot, pivot, p),
    );
    const area = housing.reduce((sum, a, i) => {
      const b = housing[(i + 1) % housing.length]!;
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    const winding = area > 0 ? 1 : -1;
    for (const [i, a] of housing.entries()) {
      const b = housing[(i + 1) % housing.length]!;
      const normal: Point = [winding * (b[1] - a[1]), winding * (a[0] - b[0]), 0];
      projected = split({ normal, distance: normal[0] * a[0] + normal[1] * a[1] }, projected).back;
      if (projected.length < 3) return [];
    }
  }
  return projected.map(([x, y]) => [x, y]);
}

/** Visible vector fragments, geometrically clipped and ordered at their actual depths. */
export function drawn(pivot: number, paint: Paint, pose: Pose): { color: string; outline: V2[] }[] {
  return ordered(viewer(pose), geometry(paint).tree).flatMap((surface) => {
    const outline = visibleOutline(pivot, pose, surface);
    return outline.length < 3 ? [] : [{ color: surface.color, outline }];
  });
}
/** Surfaces nearer than the horizontal exhaust plane, in the same frame as jet anchors. */
export function mouthOccluders(
  bounds: { length: number; width: number },
  sign: number,
  yaw: number,
  pivot = FRAME / 2,
  station?: { middle: Point; half: Point },
): V2[][] {
  const { middle, half } = station ?? mouthAxis(sign);
  const corners = [
    [-bounds.width, 0],
    [bounds.width, 0],
    [bounds.width, bounds.length],
    [-bounds.width, bounds.length],
  ].map(([w, l]) =>
    projectAt(
      pivot,
      pivot,
      place({ yaw }, [middle[0] + w! * half[0], middle[1] + w! * half[1] + l!, middle[2]]),
    ),
  );
  const sign2 =
    corners.reduce((s, a, i) => {
      const b = corners[(i + 1) % 4]!;
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) > 0
      ? 1
      : -1;
  const limits: CutPlane[] = corners.map((a, i) => {
    const b = corners[(i + 1) % 4]!,
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      n = Math.hypot(dx, dy),
      normal: Point = [(sign2 * dy) / n, (-sign2 * dx) / n, 0];
    return { normal, distance: normal[0] * a[0] + normal[1] * a[1] };
  });
  const boundary: CutPlane = { normal: [0, 0, 1], distance: middle[2] };
  return geometry(classic.paint).surfaces.flatMap((surface) => {
    if (!station && surface.kind === `mouth-${sign}`) return [];
    const points = split(boundary, surface.points).front;
    if (points.length < 3 || !plane(points)) return [];
    let projected = visibleOutline(pivot, { yaw }, { ...surface, points }).map(([x, y]): Point => [
      x,
      y,
      0,
    ]);
    if (projected.length < 3) return [];
    for (const limit of limits) {
      projected = split(limit, projected).back;
      if (projected.length < 3) return [];
    }
    if (!plane(projected)) return [];
    return [projected.map((p) => [Number(p[0].toFixed(4)), Number(p[1].toFixed(4))] as V2)];
  });
}
