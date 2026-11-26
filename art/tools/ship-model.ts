// Ada's ship model: the one hull, canopy, mouths and paint every ship drawing derives from. It
// has no side effects; ship.ts writes the sprite frames and contracts, and other generators
// (the quantum jump, the app icon) import it rather than copying the geometry.
import { oklchToSrgb } from "@andornaut/art-kit/build/colour";

import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { facesViewer, type Point, projectAt, rotate, round, SHIP_HEADINGS } from "./projection.ts";
import { paintRegions } from "./ship-paths.ts";
import type { V2 } from "./silhouette.ts";
import {
  ordered,
  partition,
  planarTriangles,
  split,
  type Surface,
  type Tree,
} from "./ship-surface.ts";

// Material slots in ship-paint.json and ship-materials.json. Hull, tail and accent each have a
// lit top, a turned top and a left and right wall tone; the light picks the tone per view.
export const PAINT_SLOTS = [
  "top",
  "topTurned",
  "wallLeft",
  "wallRight",
  "tailLeft",
  "tailRight",
  "accent",
  "accentTurned",
  "accentLeft",
  "accentRight",
  "skirt",
  "canopyHighlight",
  "canopyRoof",
  "canopyShade",
  "engineOpening",
] as const;
export type PaintSlot = (typeof PAINT_SLOTS)[number];
export type Paint = Readonly<Record<PaintSlot, string>>;

export interface Scheme {
  // The authored glazing reference the canopy shade and the engine opening derive from.
  readonly canopySides: string;
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
export function engineOpening(base: string): string {
  const reference = ENGINE_MATERIAL_RELATIONSHIPS;
  if (base === reference.referenceWall) return reference.referenceOpening;
  const [wallL, wallA, wallB] = toOklab(rgb(reference.referenceWall));
  const [openingL, openingA, openingB] = toOklab(rgb(reference.referenceOpening));
  const [L, a, b] = toOklab(rgb(base));
  const chroma = Math.hypot(a, b),
    hue = Math.atan2(b, a);
  const lifted = (lightness: number, C: number, h: number) =>
    toOklab(
      rgb(
        hex(
          fromOklab(
            Math.min(1, Math.max(0, lightness + reference.housingLightnessLift)),
            C * reference.housingChromaRatio * Math.cos(h),
            C * reference.housingChromaRatio * Math.sin(h),
          ),
        ),
      ),
    )[0];
  const housingL = lifted(L, chroma, hue);
  const referenceHousingL = lifted(wallL, Math.hypot(wallA, wallB), Math.atan2(wallB, wallA));
  const headroom = (openingL - referenceHousingL) / (1 - referenceHousingL);
  const openingHue = Math.atan2(openingB, openingA) + hue - Math.atan2(wallB, wallA);
  return hex(
    oklchToSrgb([
      Math.max(openingL, housingL + (1 - housingL) * headroom),
      Math.hypot(openingA, openingB),
      (openingHue * 180) / Math.PI,
    ]),
  );
}

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (hex: string) =>
  channels(hex)
    .map(linear)
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i]!, 0);
// The colour scaled in linear light by a factor.
function scaled(top: string, factor: number): string {
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
// Tone steps below a top colour, each the sRGB level of a neutral grey whose linear luminance
// scales the top: the turned top, the left and right walls and the tail block's two sides.
export const TONE_STEPS = {
  turned: 0.95,
  wallLeft: 0.78,
  wallRight: 0.62,
  tailLeft: 0.48,
  tailRight: 0.33,
} as const;
const step = (top: string, level: number) => scaled(top, linear(level));
// The skirt keeps its fixed linear-luminance reference under every top.
const SKIRT_REFERENCE = "#abbfce";

// A per-channel sRGB mix, t of the way from a to b.
function mix(a: string, b: string, t: number): string {
  const [p, q] = [a, b].map((c) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16)));
  return `#${p!
    .map((c, i) =>
      Math.round(c + (q![i]! - c) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
// Canopy highlight: the roof colour mixed 45 percent toward white.
export const highlight = (roof: string) => mix(roof, "#ffffff", 0.45);
// Canopy shade: 45 percent of the way from the roof to the glazing reference.
export const shade = (roof: string, sides: string) => mix(roof, sides, 0.45);

function accentTones(accent: string) {
  return {
    accent,
    accentTurned: step(accent, TONE_STEPS.turned),
    accentLeft: step(accent, TONE_STEPS.wallLeft),
    accentRight: step(accent, TONE_STEPS.wallRight),
  };
}
function glazing(canopyRoof: string, canopySides: string) {
  return {
    canopyHighlight: highlight(canopyRoof),
    canopyRoof,
    canopyShade: shade(canopyRoof, canopySides),
    engineOpening: engineOpening(canopySides),
  };
}
// Classic's hull and tail tones are authored; its accent tones derive like every paint's.
const CLASSIC: Scheme = {
  id: "classic",
  name: "Classic",
  canopySides: "#1767b3",
  paint: {
    top: "#ffffff",
    topTurned: "#ebf1f7",
    wallLeft: "#b4c4d6",
    wallRight: "#8497ae",
    tailLeft: "#6d829d",
    tailRight: "#445a76",
    skirt: SKIRT_REFERENCE,
    ...accentTones("#2456b8"),
    ...glazing("#2585d0", "#1767b3"),
  },
};
function painted(
  id: string,
  name: string,
  top: string,
  accent: string,
  canopyRoof: string,
  canopySides: string,
): Scheme {
  return {
    id,
    name,
    canopySides,
    paint: {
      top,
      topTurned: step(top, TONE_STEPS.turned),
      wallLeft: step(top, TONE_STEPS.wallLeft),
      wallRight: step(top, TONE_STEPS.wallRight),
      tailLeft: step(top, TONE_STEPS.tailLeft),
      tailRight: step(top, TONE_STEPS.tailRight),
      skirt: scaled(top, luminance(SKIRT_REFERENCE)),
      ...accentTones(accent),
      ...glazing(canopyRoof, canopySides),
    },
  };
}
export const SCHEMES: readonly Scheme[] = [
  CLASSIC,
  painted("cobalt", "Cobalt", "#6f9ff0", "#16245c", "#eef5ff", "#b4c8e6"),
  painted("seafoam", "Seafoam", "#d4f6ea", "#f07a5a", "#14697a", "#0d4c59"),
  painted("graphite", "Crimson", "#d96b73", "#f6efe6", "#382a32", "#251d24"),
  painted("iris", "Iris", "#d9ccff", "#e0489f", "#3a2b8c", "#271c66"),
  painted("amber", "Amber", "#f4b665", "#12233a", "#24577b", "#173a57"),
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
  // The ridge runs low from the nose through `ridge` to the shoulder, which sits on it `gap`
  // behind the canopy's rear edge, so no tail face covers the canopy in any view or jump pose;
  // from there the ridge climbs steeply to the rear-centre apex. Local (x, y, z).
  ridge: [0, 6, 9.5],
  gap: 2,
  apex: [0, 17, 16.5],
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
  const { apex, ridge } = HULL;
  // The shoulder: the ridge line from the nose through `ridge`, `gap` behind the canopy's rear
  // edge.
  const rear = CANOPY.centre + CANOPY.along + HULL.gap;
  const t = (rear - nose[1]) / (ridge[1] - nose[1]);
  const shoulder: Point = [0, rear, nose[2] + (ridge[2] - nose[2]) * t];
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

/** The named hull vertices, local. */
export const shipVertices = () => vertices();

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Point): Point => {
  const length = Math.hypot(...a);
  return [a[0] / length, a[1] / length, a[2] / length];
};
const add = (a: Point, b: Point, t = 1): Point => [
  a[0] + b[0] * t,
  a[1] + b[1] * t,
  a[2] + b[2] * t,
];

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
// The polygon wound so its normal points along the hint.
const facing = (hint: Point, points: Point[]) =>
  dot(normal(points), hint) < 0 ? points.toReversed() : points;

// A face's material. The three shells take a tone from the light per view; glass takes its
// bands from the smooth canopy surface; the skirt and the mouths are flat.
type Material = "accent" | "engineOpening" | "glass" | "hull" | "skirt" | "tail";
type Face = { material: Material; part?: string; points: Point[] };

// The wing tip caps: everything outboard of the chord at this |x|, parallel to the hull axis,
// which is the outer 28 percent of the 21.44 unit half span.
export const TIP_CAP_X = 15.4;

// A polygon cut at the cap chords: the part inboard of both, and the parts outboard.
function capSplit(points: readonly Point[]): { caps: Point[][]; inboard: Point[] } {
  const right = split({ normal: [1, 0, 0], distance: TIP_CAP_X }, points);
  const left = split({ normal: [-1, 0, 0], distance: TIP_CAP_X }, right.back);
  return { caps: [right.front, left.front], inboard: left.back };
}

// Upper faces, each a planar polygon wound to face up. Per side: the wing top, which carries
// the canopy; the steep face and the rear wall, which holds the mouth; and the tail side.
// The tail block is both tail sides and the steep faces inboard of the notch.
function upperFaces(): Face[] {
  const v = vertices();
  const up = (points: Point[]) => facing([0, 0, 1], points);
  const faces: Face[] = [];
  for (const [tip, notch, corner] of [
    [v.tipL, v.notchL, v.cornerL],
    [v.tipR, v.notchR, v.cornerR],
  ] as const) {
    const wing = capSplit(up([v.nose, tip, v.shoulder]));
    faces.push({ material: "hull", part: "wing", points: wing.inboard });
    for (const points of wing.caps) faces.push({ material: "accent", part: "cap", points });
    const steep = up([v.shoulder, tip, corner, v.apex]);
    const outboard = split(
      { normal: [Math.sign(tip[0]), 0, 0], distance: Math.abs(notch[0]) },
      steep,
    );
    // The steep face reaches the wing tip, so its sliver outboard of the cap chord is cap too.
    const steepOutboard = capSplit(outboard.front);
    faces.push({ material: "hull", part: "steep", points: steepOutboard.inboard });
    for (const points of steepOutboard.caps)
      faces.push({ material: "accent", part: "cap", points });
    faces.push({ material: "tail", part: "block", points: outboard.back });
    const wall = capSplit(up([tip, notch, corner]));
    faces.push({ material: "hull", part: "wall", points: wall.inboard });
    for (const points of wall.caps) faces.push({ material: "accent", part: "cap", points });
    faces.push({ material: "tail", part: "block", points: up([notch, v.tail, v.apex, corner]) });
  }
  return faces.filter(({ points }) => points.length >= 3);
}

// The ridge height at local y: the wing planes at x = 0, continued aft of the shoulder.
function ridge(y: number): number {
  const v = vertices();
  const { d, n } = through(v.nose, v.shoulder, v.tipR);
  return (d - n[1] * y) / n[2];
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

// Engine mouths: one plain rectangle on each rear wall, |x| from inner to outer, from low to
// high up the wall above the skirt top, kept `inset` inside the wall's edges and lifted
// `lift` off it. No frame.
const MOUTHS = { inner: 8.8, outer: 15.7, low: 0.3, high: 2.8, inset: 0.35, lift: 0.05 };

function wallOf(sign: number): [Point, Point, Point] {
  const v = vertices();
  return sign < 0 ? [v.tipL, v.notchL, v.cornerL] : [v.tipR, v.notchR, v.cornerR];
}

// Mouth polygon on the sign side's wall, wound outward.
function mouth(sign: number): Point[] {
  const [tip, notch, corner] = wallOf(sign);
  const along = unit(minus(notch, tip));
  let out = unit(cross(along, minus(corner, tip)));
  if (out[1] < 0) out = [-out[0], -out[1], -out[2]];
  let rise = cross(out, along);
  if (rise[2] < 0) rise = [-rise[0], -rise[1], -rise[2]];
  const length = Math.hypot(...minus(notch, tip));
  const at = (x: number) => (Math.abs(x - Math.abs(tip[0])) / Math.abs(notch[0] - tip[0])) * length;
  const { high, inner, inset, lift, low, outer } = MOUTHS;
  let rect: Point[] = [
    [at(outer), low, 0],
    [at(inner), low, 0],
    [at(inner), high, 0],
    [at(outer), high, 0],
  ];
  // The wall triangle in its own plane, wound counterclockwise.
  const wall: Point[] = [
    [0, 0, 0],
    [length, 0, 0],
    [dot(minus(corner, tip), along), dot(minus(corner, tip), rise), 0],
  ];
  for (const [i, a] of wall.entries()) {
    const b = wall[(i + 1) % wall.length]!;
    const edge = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const inward: Point = [-(b[1] - a[1]) / edge, (b[0] - a[0]) / edge, 0];
    rect = split({ normal: inward, distance: dot(inward, a) + inset }, rect).front;
  }
  return facing(
    out,
    rect.map(([x, y]) => add(add(add(tip, along, x), rise, y), out, lift)),
  );
}

// Forward plumes lie in the exhaust plane through the mouth centres, rooted `clear` behind the
// wall at the centre of each mouth.
const PLUME = { clear: 0.1, height: 1 };

/** The forward plume's root on the sign side: the mouth centre, local. */
export function plumeRoot(sign: number): Point {
  const [tip, notch] = wallOf(sign);
  const { d, n } = leaning(tip, notch);
  const x = (sign * (MOUTHS.inner + MOUTHS.outer)) / 2;
  const z = HULL.skirt + PLUME.height;
  return [x, (d - n[0] * x - n[2] * z) / n[1] + PLUME.clear, z];
}

// Reverse plumes aim this many degrees outboard of forward.
export const RETRO = { angle: 10 } as const;

/** Reverse exhaust: its wing tip, its forward and outboard axis and its side, local. */
export function retroMouthAxis(sign: number): { axis: Point; corner: Point; side: Point } {
  const { tipL, tipR } = vertices();
  const angle = (RETRO.angle * Math.PI) / 180;
  return {
    axis: [sign * Math.sin(angle), -Math.cos(angle), 0],
    corner: sign < 0 ? tipL : tipR,
    side: [sign * Math.cos(angle), Math.sin(angle), 0],
  };
}

/**
 * A reverse plume's root, local: the plume's widest outboard flank leaves from the wing tip, and
 * the root slides forward along the axis until its inboard corner reaches the trailing edge, so
 * none of it shows behind the wing. The nearer wing's plume lies at the skirt bottom and the
 * farther wing's at the skirt top. `halfWidth` is the outer layer's half width and `rootShare`
 * the profile's width at the root.
 */
export function retroRoot(
  pose: Pose,
  plume: { halfWidth: number; rootShare: number },
  sign: number,
): Point {
  const v = vertices();
  const { axis, corner: tip, side } = retroMouthAxis(sign);
  const notch = sign < 0 ? v.notchL : v.notchR;
  const widest = add(tip, side, -plume.halfWidth);
  const inboard = add(widest, side, -plume.halfWidth * plume.rootShare);
  // How far a point lies behind the trailing edge, along local y.
  const slope = (tip[1] - notch[1]) / (Math.abs(tip[0]) - Math.abs(notch[0]));
  const behind = (p: Point) => p[1] - (tip[1] + slope * (sign * p[0] - Math.abs(tip[0])));
  const slide = Math.max(0, behind(inboard) / -(axis[1] - slope * sign * axis[0]));
  const [x, y] = add(widest, axis, slide);
  const depth = (p: Point) => {
    const [wx, wy, wz] = place(pose, p);
    return wx + wy + wz;
  };
  const near = depth(tip) >= depth(sign < 0 ? v.tipR : v.tipL) - 1e-9;
  return [x, y, near ? 0 : HULL.skirt];
}

/** Project the forward plume roots through ordinary, banked or stretched ship poses. */
/**
 * Each forward mouth's projected plume root, axis and round-flame side vector, port then
 * starboard, without the occluders: the geometry `forwardJetMouths` publishes.
 */
export function forwardJetMouthGeometry(pivot: number, pose: Pose) {
  const projected = (centre: number, point: Point) =>
    projectAt(centre, centre, place(pose, point)).map(round) as [number, number];
  return [-1, 1].map((sign) => ({
    anchor: projected(pivot, plumeRoot(sign)),
    axis: projected(0, [0, 1, 0]),
    half: plumeSide(pose, [0, 1, 0], [sign, 0, 0]),
  }));
}

export function forwardJetMouths(
  pivot: number,
  pose: Pose,
  reach: { halfWidth: number; length: number },
) {
  return forwardJetMouthGeometry(pivot, pose).map((mouth, index) => ({
    ...mouth,
    occluders: plumeOccluders(pivot, pose, plumeRoot(index === 0 ? -1 : 1), reach, mouth.half),
  }));
}

/**
 * Plumes that start on the bottom edge of each lit engine mouth, for the start screen: aimed
 * straight back as in flight, each root on the midpoint of its mouth's bottom edge and its start
 * line along that edge. `half` runs along the projected edge, pointing outboard, at the length
 * that keeps the flight plume's width across the axis, so the start line may pass the edge's
 * ends.
 */
export function mouthEdgeJetMouths(
  pivot: number,
  pose: Pose,
  reach: { halfWidth: number; length: number },
) {
  const projected = (centre: number, point: Point) =>
    projectAt(centre, centre, place(pose, point)).map(round) as [number, number];
  return [-1, 1].map((sign) => {
    // The bottom edge's ends: the mouth's lowest points farthest apart.
    const points = mouth(sign);
    const low = Math.min(...points.map((p) => p[2]));
    const edge = points.filter((p) => p[2] - low < 1e-9).toSorted((p, q) => p[0] - q[0]);
    const [a, b] = [edge[0]!, edge.at(-1)!];
    const root: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    let along = unit(minus(b, a));
    if (sign * along[0] < 0) along = [-along[0], -along[1], -along[2]];
    const line = projectAt(0, 0, minus(place(pose, along), place(pose, [0, 0, 0])));
    const axis = projectAt(0, 0, minus(place(pose, [0, 1, 0]), place(pose, [0, 0, 0])));
    const flight = plumeSide(pose, [0, 1, 0], [sign, 0, 0]);
    // The edge's share across the axis, so its component across matches the flight half.
    const across =
      Math.abs(line[0] * axis[1] - line[1] * axis[0]) / Math.hypot(...line) / Math.hypot(...axis);
    const scale = Math.hypot(...flight) / across / Math.hypot(...line);
    const half = [round(line[0] * scale), round(line[1] * scale)] as [number, number];
    return {
      anchor: projected(pivot, root),
      axis: projected(0, [0, 1, 0]),
      half,
      occluders: plumeOccluders(pivot, pose, root, reach, half),
    };
  });
}

/**
 * The projected vector across a plume per ship unit of half width. A plume is a round flame
 * about its axis, so it shows its silhouette: across the projected axis, as wide as its round
 * section projects. It points to the side of local `side`.
 */
export function plumeSide(pose: Pose, axis: Point, side: Point): [number, number] {
  const origin = place(pose, [0, 0, 0]);
  const along = unit(minus(place(pose, axis), origin));
  const [ax, ay] = projectAt(0, 0, along);
  const length = Math.hypot(ax, ay);
  let n: [number, number] = [-ay / length, ax / length];
  const [sx, sy] = projectAt(0, 0, minus(place(pose, side), origin));
  if (n[0] * sx + n[1] * sy < 0) n = [-n[0], -n[1]];
  // A world offset u moves the screen point along n by back . u; over a round section about the
  // axis (u perpendicular to it) that peaks at the length of back's part across the axis.
  const back: Point = [
    (n[0] * Math.sqrt(3)) / 2 + n[1] / 2,
    (-n[0] * Math.sqrt(3)) / 2 + n[1] / 2,
    -n[1],
  ];
  const width = Math.hypot(...add(back, along, -dot(back, along))) * (pose.squash ?? 1);
  return [round(n[0] * width), round(n[1] * width)];
}

// The light, fixed in the view: from the upper left, in world axes with the viewer at +(1, 1, 1).
export const LIGHT: Point = unit([-0.2, 0.5, 0.84]);
// A shell face is a top when its normal's z is above TOP; a top is lit when it meets the light
// at LIT or more; other faces are left walls when they face screen left.
const SHELL = { lit: 0.6, top: 0.6 };
const SHELL_SLOTS = {
  accent: ["accent", "accentTurned", "accentLeft", "accentRight"],
  hull: ["top", "topTurned", "wallLeft", "wallRight"],
  tail: ["top", "topTurned", "tailLeft", "tailRight"],
} as const;

function shellSlot(material: keyof typeof SHELL_SLOTS, world: Point): PaintSlot {
  const [lit, turnedTop, left, right] = SHELL_SLOTS[material];
  if (world[2] > SHELL.top) return dot(world, LIGHT) >= SHELL.lit ? lit : turnedTop;
  return world[1] >= world[0] ? left : right;
}

function model(): Face[] {
  const faces: Face[] = [];
  const outline = plan(HULL.skirt, HULL.plan);
  // The skirt surrounds the hull; its parts on the tip caps take the accent.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[(i + 1) % outline.length]!;
    const b = outline[i]!;
    const { caps, inboard } = capSplit([a, b, [b[0], b[1], 0], [a[0], a[1], 0]]);
    faces.push({ material: "skirt", points: inboard });
    for (const points of caps) faces.push({ material: "accent", part: "cap", points });
  }
  faces.push(...upperFaces());
  for (const sign of [-1, 1]) {
    faces.push({ material: "engineOpening", part: `mouth-${sign}`, points: mouth(sign) });
  }
  faces.push(...canopy());
  return faces.filter(({ points }) => points.length >= 3);
}

const turned = (pose: Pose, points: readonly Point[]) => points.map((point) => place(pose, point));

// The canopy: a closed bubble on an elliptical plan, semi-axes `across` and `along` the hull,
// centred at local y `centre`, its crown `crown` above the ridge. It sits `base` above the
// ridge on a saddle that falls `saddle` of the wing's slope across the hull, and carries its
// own lower envelope `lip` deep, so its outline does not follow the roof crease. The lip's
// bottom stays 0.1 above the ridge at the canopy's tips, so no wing top cuts the outline.
export const CANOPY = {
  across: 8.8,
  along: 10,
  centre: -3,
  crown: 4.4,
  base: 0.6,
  lip: 0.5,
  saddle: 0.62,
  segments: 72,
  rings: 14,
  // Inside this radius the crown is one planar polygon.
  flat: 0.3,
};
// Glass bands by the smooth surface normal's meeting with the light.
const GLASS = { highlight: 0.93, shade: 0.36 };

// The wing top's fall per unit across the hull.
function wingFall(): number {
  const v = vertices();
  const { n } = through(v.nose, v.shoulder, v.tipR);
  return n[0] / n[2];
}

// The bubble surface at plan angle a (0 forward, a quarter turn to +x) and radius r of 1.
function bubble(a: number, r: number): Point {
  const { across, along, base, centre, crown, saddle } = CANOPY;
  const x = across * r * Math.sin(a);
  const y = centre - along * r * Math.cos(a);
  const soft = wingFall() * saddle * across * (x / across) ** 2;
  return [x, y, ridge(y) - soft + base + crown * Math.sqrt(Math.max(0, 1 - r * r))];
}

// The smooth bubble's outward normal above local (x, y); the lip takes the rim's.
function bubbleNormal([x, y]: Point, lip: boolean): Point {
  const { across, along, centre, crown, saddle } = CANOPY;
  const [u, v] = [x / across, (y - centre) / along];
  const inside = 1 - u * u - v * v;
  if (lip || inside < 0.002) return unit([u / across, v / along, 0]);
  const fall = crown / Math.sqrt(inside);
  const zx = -2 * wingFall() * saddle * u - (fall * u) / across;
  const zy = ridge(1) - ridge(0) - (fall * v) / along;
  return unit([-zx, -zy, 1]);
}

function canopy(): Face[] {
  const { centre, flat, lip, rings, segments } = CANOPY;
  const faces: Face[] = [];
  const radius = (ring: number) => flat + ((1 - flat) * (ring - 1)) / (rings - 1);
  // The crown ring lies in one plane, so the crown is an exact planar face.
  const level = Array.from({ length: 8 }, (_, i) => bubble((i * Math.PI) / 4, flat)[2]).reduce(
    (sum, z) => sum + z / 8,
    0,
  );
  const [fore, aft] = [bubble(0, flat), bubble(Math.PI, flat)];
  const slope = (aft[2] - fore[2]) / (aft[1] - fore[1]);
  const at = (segment: number, ring: number): Point => {
    const p = bubble((2 * Math.PI * (segment % segments)) / segments, radius(ring));
    return ring === 1 ? [p[0], p[1], level + slope * (p[1] - centre)] : p;
  };
  const up: Point = [0, 0, 1];
  faces.push({
    material: "glass",
    part: "bubble",
    points: facing(
      up,
      Array.from({ length: segments }, (_, i) => at(i, 1)),
    ),
  });
  for (let i = 0; i < segments; i++) {
    for (let ring = 1; ring < rings; ring++) {
      const q = [at(i, ring), at(i + 1, ring), at(i + 1, ring + 1), at(i, ring + 1)] as const;
      for (const points of [
        [q[0], q[1], q[2]],
        [q[0], q[2], q[3]],
      ])
        faces.push({ material: "glass", part: "bubble", points: facing(up, points) });
    }
    const [a, b] = [at(i, rings), at(i + 1, rings)];
    const out: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - centre, 0];
    faces.push({
      material: "glass",
      part: "lip",
      points: facing(out, [a, b, [b[0], b[1], b[2] - lip], [a[0], a[1], a[2] - lip]]),
    });
  }
  return faces;
}

let prepared: { surfaces: Surface[]; tree: Tree | null } | undefined;
// The solid is the same under every paint: surfaces carry their material in `color`.
function geometry() {
  prepared ??= (() => {
    const surfaces = model().flatMap((face) =>
      planarTriangles({
        color: face.material,
        points: face.points,
        ...(face.part === undefined ? {} : { kind: face.part }),
      }),
    );
    return { surfaces, tree: partition(surfaces) };
  })();
  return prepared;
}

// The pose's linear map as the images of the local axes.
function basis(pose: Pose): [Point, Point, Point] {
  const origin = place(pose, [0, 0, 0]);
  return ([0, 1, 2] as const).map((i) =>
    minus(place(pose, [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0]), origin),
  ) as [Point, Point, Point];
}
function viewer(pose: Pose): Point {
  const b = basis(pose);
  const determinant = dot(b[0], cross(b[1], b[2]));
  return [
    dot(cross(b[1], b[2]), [1, 1, 1]) / determinant,
    dot(cross(b[2], b[0]), [1, 1, 1]) / determinant,
    dot(cross(b[0], b[1]), [1, 1, 1]) / determinant,
  ];
}
// A local surface normal in world axes for this pose.
function worldNormal(pose: Pose, n: Point): Point {
  const b = basis(pose);
  const [c0, c1, c2] = [cross(b[1], b[2]), cross(b[2], b[0]), cross(b[0], b[1])];
  return unit([
    c0[0] * n[0] + c1[0] * n[1] + c2[0] * n[2],
    c0[1] * n[0] + c1[1] * n[1] + c2[1] * n[2],
    c0[2] * n[0] + c1[2] * n[1] + c2[2] * n[2],
  ]);
}

// A polygon with a value per vertex, cut where the linear value crosses the threshold.
type Valued = { points: Point[]; values: number[] };
function cut({ points, values }: Valued, threshold: number): { above: Valued; below: Valued } {
  const above: Valued = { points: [], values: [] };
  const below: Valued = { points: [], values: [] };
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    const [da, db] = [values[i]! - threshold, values[(i + 1) % points.length]! - threshold];
    const target = da >= 0 ? above : below;
    target.points.push(a);
    target.values.push(values[i]!);
    if (da >= 0 !== db >= 0) {
      const p = add(a, minus(b, a), da / (da - db));
      for (const side of [above, below]) {
        side.points.push(p);
        side.values.push(threshold);
      }
    }
  }
  return { above, below };
}

// A glass fragment in its flat bands for this pose: highlight, roof and shade.
function glassBands(pose: Pose, surface: Surface): { points: Point[]; slot: PaintSlot }[] {
  const lip = surface.kind === "lip";
  const values = surface.points.map((p) => dot(worldNormal(pose, bubbleNormal(p, lip)), LIGHT));
  const bands: { points: Point[]; slot: PaintSlot }[] = [];
  for (let i = 1; i + 1 < surface.points.length; i++) {
    const ids = [0, i, i + 1];
    const high = cut(
      { points: ids.map((id) => surface.points[id]!), values: ids.map((id) => values[id]!) },
      GLASS.highlight,
    );
    const low = cut(high.below, GLASS.shade);
    bands.push(
      { points: high.above.points, slot: "canopyHighlight" },
      { points: low.above.points, slot: "canopyRoof" },
      { points: low.below.points, slot: "canopyShade" },
    );
  }
  return bands.filter(({ points }) => points.length >= 3);
}

// A surface's fragments with their paint slots for this pose.
function toned(pose: Pose, surface: Surface): { points: readonly Point[]; slot: PaintSlot }[] {
  const material = surface.color as Material;
  if (material === "glass") return glassBands(pose, surface);
  if (material === "skirt" || material === "engineOpening") {
    return [{ points: surface.points, slot: material }];
  }
  const world = unit(normal(turned(pose, surface.points)));
  return [{ points: surface.points, slot: shellSlot(material, world) }];
}

/** The raised luminous surface stays inside its actual wall even at grazing angles. */
function visibleOutline(
  pivot: number,
  pose: Pose,
  kind: string | undefined,
  local: readonly Point[],
): V2[] {
  const points = turned(pose, local);
  if (!facesViewer(points)) return [];
  let projected: Point[] = points.map((p) => {
    const [x, y] = projectAt(pivot, pivot, p);
    return [x, y, 0];
  });
  const sign = kind === "mouth--1" ? -1 : kind === "mouth-1" ? 1 : undefined;
  if (sign !== undefined) {
    const housing = turned(pose, wallOf(sign)).map((p) => projectAt(pivot, pivot, p));
    const area = housing.reduce((sum, a, i) => {
      const b = housing[(i + 1) % housing.length]!;
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    const winding = area > 0 ? 1 : -1;
    for (const [i, a] of housing.entries()) {
      const b = housing[(i + 1) % housing.length]!;
      const edge: Point = [winding * (b[1] - a[1]), winding * (a[0] - b[0]), 0];
      projected = split(
        { normal: edge, distance: edge[0] * a[0] + edge[1] * a[1] },
        projected,
      ).back;
      if (projected.length < 3) return [];
    }
  }
  return projected.map(([x, y]) => [x, y]);
}

const fragments = new Map<string, { outline: V2[]; slot: PaintSlot }[]>();
// Visible fragments with their slots for a pose, shared by every paint.
function slotted(pivot: number, pose: Pose) {
  const key = JSON.stringify([
    pivot,
    pose.yaw,
    pose.roll ?? 0,
    pose.stretch ?? 1,
    pose.squash ?? 1,
  ]);
  let value = fragments.get(key);
  if (!value) {
    value = ordered(viewer(pose), geometry().tree).flatMap((surface) =>
      toned(pose, surface).flatMap(({ points, slot }) => {
        const outline = visibleOutline(pivot, pose, surface.kind, points);
        return outline.length < 3 ? [] : [{ outline, slot }];
      }),
    );
    fragments.set(key, value);
  }
  return value;
}

/** The visible fragments in draw order with their model part and paint slot, for checks. */
export function drawnParts(
  pivot: number,
  pose: Pose,
): { outline: V2[]; part: string; slot: PaintSlot }[] {
  return ordered(viewer(pose), geometry().tree).flatMap((surface) =>
    toned(pose, surface).flatMap(({ points, slot }) => {
      const outline = visibleOutline(pivot, pose, surface.kind, points);
      return outline.length < 3 ? [] : [{ outline, part: surface.kind ?? surface.color, slot }];
    }),
  );
}

/** Visible vector fragments, geometrically clipped and ordered at their actual depths. */
export function drawn(pivot: number, paint: Paint, pose: Pose): { color: string; outline: V2[] }[] {
  return slotted(pivot, pose).map(({ outline, slot }) => ({ color: paint[slot], outline }));
}

/**
 * The plane a plume's depth is taken on: it holds the plume's axis through `root` and faces the
 * viewer, so a flame with volume is as near as its centre line. Local axes, front toward the
 * viewer.
 */
function plumeDepthPlane(
  pose: Pose,
  root: Point,
  axis: Point,
): { distance: number; normal: Point } {
  const b = basis(pose);
  const world = minus(place(pose, axis), place(pose, [0, 0, 0]));
  const view: Point = [1, 1, 1];
  let n = cross(world, cross(world, view));
  if (dot(n, view) < 0) n = [-n[0], -n[1], -n[2]];
  const normal: Point = [dot(b[0], n), dot(b[1], n), dot(b[2], n)];
  return { distance: dot(normal, root), normal };
}

/**
 * The hull nearer than a forward plume, as outlines in the frame of the jet anchors: every
 * visible surface in front of the plume's depth plane, inside its widest and longest reach.
 */
export function plumeOccluders(
  pivot: number,
  pose: Pose,
  root: Point,
  reach: { halfWidth: number; length: number },
  half: readonly [number, number],
): V2[][] {
  const anchor = projectAt(pivot, pivot, place(pose, root));
  const axis = projectAt(0, 0, minus(place(pose, [0, 1, 0]), place(pose, [0, 0, 0])));
  const corners = [
    [-reach.halfWidth, 0],
    [reach.halfWidth, 0],
    [reach.halfWidth, reach.length],
    [-reach.halfWidth, reach.length],
  ].map(([w, l]): [number, number] => [
    anchor[0] + half[0] * w! + axis[0] * l!,
    anchor[1] + half[1] * w! + axis[1] * l!,
  ]);
  const winding =
    corners.reduce((s, a, i) => {
      const b = corners[(i + 1) % 4]!;
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) > 0
      ? 1
      : -1;
  const limits = corners.map((a, i) => {
    const b = corners[(i + 1) % 4]!;
    const edge: Point = [winding * (b[1] - a[1]), winding * (a[0] - b[0]), 0];
    return { normal: edge, distance: edge[0] * a[0] + edge[1] * a[1] };
  });
  const depth = plumeDepthPlane(pose, root, [0, 1, 0]);
  const fragments = ordered(viewer(pose), geometry().tree).flatMap((surface) => {
    const above = split(depth, surface.points).front;
    if (above.length < 3) return [];
    let projected = visibleOutline(pivot, pose, surface.kind, above).map(([x, y]): Point => [
      x,
      y,
      0,
    ]);
    for (const limit of limits) {
      if (projected.length < 3) return [];
      projected = split(limit, projected).back;
    }
    const outline = projected.map(([x, y]): V2 => [x, y]);
    return outline.length < 3 ? [] : [{ color: "hull", outline }];
  });
  return paintRegions(fragments).flatMap(({ loops }) =>
    loops.map((loop) => loop.map(([x, y]): V2 => [Number(x.toFixed(4)), Number(y.toFixed(4))])),
  );
}
