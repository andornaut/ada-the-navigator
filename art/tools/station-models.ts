// Station models (art/station-redesign.md): each structure is one set of connected solids in
// mesh space, authored in display px at game scale with the fixed view's axes (+x and +y run
// down the screen to the right and left, +z up). Angles are degrees in plan from +x toward +y.
import { shade } from "./fleet-models.ts";
import type { Point } from "./projection.ts";
import {
  type Mesh,
  meshDome,
  meshExtrude,
  meshLoft,
  meshRing,
  meshScale,
  meshSpiral,
  meshTube,
  type Tones,
} from "./solid.ts";

type Plan = readonly (readonly [number, number])[];
type XY = readonly [number, number];

const RADIAN = Math.PI / 180;
const ORIGIN: XY = [0, 0];

const mat = (top: string, mid?: string, dark?: string): Tones => [
  top,
  mid ?? shade(top, 0.76),
  dark ?? shade(top, 0.56),
];
// A lamp tone: it keeps its colour on lit and left faces when lit, and is a dull dark tone when
// dim.
const lamp = (colour: string, lit: boolean): Tones =>
  lit ? [colour, colour, shade(colour, 0.85)] : mat(shade(colour, 0.42));

const pol = (r: number, degrees: number): XY => [
  r * Math.cos(degrees * RADIAN),
  r * Math.sin(degrees * RADIAN),
];

// ------------------------------------------------------------------ solids

// Drum, frustum or cone on the vertical through `c`, radius r0 at z0 and r1 at z1.
function drum(
  mesh: Mesh,
  c: XY,
  z0: number,
  z1: number,
  r0: number,
  r1: number,
  tones: Tones,
  sides = 48,
): void {
  meshTube(mesh, [c[0], c[1], z0], [c[0], c[1], z1], r0, r1, tones, sides);
}

const cyl = (mesh: Mesh, c: XY, z0: number, z1: number, r: number, tones: Tones, sides = 48) =>
  drum(mesh, c, z0, z1, r, r, tones, sides);

// A band proud of a drum of radius r.
const band = (mesh: Mesh, c: XY, z0: number, z1: number, r: number, tones: Tones, sides = 48) =>
  cyl(mesh, c, z0, z1, r + 0.5, tones, sides);

// Vertical extrusion of a plan from z0 to z1.
function prism(mesh: Mesh, plan: Plan, z0: number, z1: number, tones: Tones): void {
  meshExtrude(
    mesh,
    plan.map(([x, y]): Point => [x, y, z0]),
    [0, 0, z1 - z0],
    tones,
  );
}

// Box centred on `c` with half sizes `along` on the direction at `degrees` and `across` it.
function block(
  mesh: Mesh,
  c: XY,
  degrees: number,
  along: number,
  across: number,
  z0: number,
  z1: number,
  tones: Tones,
): void {
  const [ex, ey] = pol(1, degrees);
  const corner = (u: number, v: number): XY => [c[0] + ex * u - ey * v, c[1] + ey * u + ex * v];
  prism(
    mesh,
    [
      corner(-along, -across),
      corner(along, -across),
      corner(along, across),
      corner(-along, across),
    ],
    z0,
    z1,
    tones,
  );
}

// Radial box about `c` from radius r0 to r1 at `degrees`, w wide.
function bar(
  mesh: Mesh,
  c: XY,
  degrees: number,
  r0: number,
  r1: number,
  w: number,
  z0: number,
  z1: number,
  tones: Tones,
): void {
  const [ex, ey] = pol((r0 + r1) / 2, degrees);
  block(mesh, [c[0] + ex, c[1] + ey], degrees, (r1 - r0) / 2, w / 2, z0, z1, tones);
}

// A tapered arm from radius r0 (half width w0) to r1 (half width w1) about `c`.
function taper(
  mesh: Mesh,
  c: XY,
  degrees: number,
  r0: number,
  r1: number,
  w0: number,
  w1: number,
  z0: number,
  z1: number,
  tones: Tones,
): void {
  const [ex, ey] = pol(1, degrees);
  const at = (r: number, v: number): XY => [c[0] + ex * r - ey * v, c[1] + ey * r + ex * v];
  prism(mesh, [at(r0, -w0), at(r1, -w1), at(r1, w1), at(r0, w0)], z0, z1, tones);
}

// Thick tapered cap with a lamp on it.
function finial(mesh: Mesh, c: XY, z: number, tones: Tones, tip: Tones, r = 4.2, h = 7): void {
  drum(mesh, c, z, z + h, r, r * 0.55, tones, 16);
  cyl(mesh, c, z + h, z + h + 2, r * 0.55, tip, 16);
}

export const scaled = (mesh: Mesh, k: number): Mesh => meshScale(mesh, [k, k, k]);

// The face group of a project's solid, which its overlay frame draws without the body.
export const PROJECT = 1;
const project = (mesh: Mesh, from: number): Mesh =>
  mesh.map((face, i) => (i < from ? face : { ...face, group: PROJECT }));

// ------------------------------------------------------------------ Sunflower

const GOLD = mat("#f2a51f", "#c98212", "#a66a0c");
const SEED = mat("#6a4630", "#4b3020", "#35211a");
const CREAM = "#fff4d6";

// Thick petal slab with a raised inner pad.
function petal(
  mesh: Mesh,
  a: number,
  inner: number,
  reach: number,
  half: number,
  z0: number,
  z1: number,
): void {
  const mid = reach * 0.71;
  prism(
    mesh,
    [
      pol(inner, a - half * 0.8),
      pol(mid, a - half),
      pol(reach, a),
      pol(mid, a + half),
      pol(inner, a + half * 0.8),
    ],
    z0,
    z1,
    GOLD,
  );
  prism(
    mesh,
    [
      pol(inner, a - half * 0.5),
      pol(mid * 0.95, a - half * 0.58),
      pol(reach * 0.84, a),
      pol(mid * 0.95, a + half * 0.58),
      pol(inner, a + half * 0.5),
    ],
    z1,
    z1 + 2.6,
    GOLD,
  );
}

export type Flower = {
  petals?: number;
  reach?: number;
  disc?: number;
  stalk?: number;
  bulb?: boolean;
  angles?: readonly number[];
  half?: number;
  // The workshop crane's angle and the greenhouse ring.
  boom?: number;
  greenhouse?: boolean;
};

// Petal slabs round a seed disc on a stalk.
export function flower(lit: boolean, options: Flower = {}): Mesh {
  const { petals = 8, reach = 76, disc = 31, stalk = 86, bulb = true, half = 15 } = options;
  const cream = lamp(CREAM, lit);
  const mesh: Mesh = [];
  drum(mesh, ORIGIN, -8, -8 - stalk, disc * 0.5, 7, SEED, 32);
  cyl(mesh, ORIGIN, -15, -8, disc * 0.68, SEED);
  if (bulb) meshDome(mesh, [0, 0, -12 - stalk], 11, SEED, { full: true, sides: 20, bands: 5 });
  cyl(mesh, ORIGIN, -8, 9, disc, SEED);
  band(mesh, ORIGIN, 1.5, 5, disc, cream);
  const angles =
    options.angles ?? Array.from({ length: petals }, (_, i) => 22.5 + (i * 360) / petals);
  for (const a of angles) petal(mesh, a, disc - 7, reach, half, -7, 0);
  cyl(mesh, ORIGIN, 9, 12, disc * 0.6, SEED);
  meshDome(mesh, [0, 0, 12], disc * 0.46, cream);
  const body = mesh.length;
  if (options.boom !== undefined) {
    // workshopCrane: a thick tapered boom with a lifting drum.
    const end = pol(reach + 12, options.boom);
    taper(mesh, ORIGIN, options.boom, disc - 4, reach + 12, 8, 5, -6, 2, SEED);
    cyl(mesh, end, -9, 6, 9, SEED, 24);
    cyl(mesh, end, 6, 8, 5.5, cream, 20);
  }
  if (options.greenhouse) {
    // greenhouseRing: a ring joining the petal tips, a dome between each pair.
    meshRing(mesh, ORIGIN, -7, -1, reach + 8, reach - 3, SEED);
    for (let i = 0; i < petals; i++) {
      const c = pol(reach + 2.5, (i * 360) / petals);
      cyl(mesh, c, -1, 1, 8.5, SEED, 20);
      meshDome(mesh, [c[0], c[1], 1], 7, cream, { sides: 16, bands: 5 });
    }
  }
  return project(mesh, body);
}

const LEAF = mat("#f2b31c", "#c48a10", "#a8700c");
const PEG = mat("#5a3f2e", "#3f2b20", "#2d1e16");

export type LeafFlower = {
  leaves?: number;
  reach?: number;
  peg?: number;
  angles?: readonly number[];
  tall?: number;
  foot?: number;
};

// Leaf petals round a peg: each leaf is a lens between two arcs, with a raised inner pad.
export function leafFlower(lit: boolean, options: LeafFlower = {}): Mesh {
  const { leaves = 8, reach = 73, peg = 27, tall = 20, foot = 18 } = options;
  const cream = lamp("#fff2d0", lit);
  const mesh: Mesh = [];
  cyl(mesh, ORIGIN, -14, tall, peg, PEG);
  const root = peg - 6;
  const leaf = (a: number, from: number, to: number, z0: number, z1: number) => {
    const half = (to - from) / 2;
    const radius = half * 1.31;
    const off = Math.sqrt(radius * radius - half * half);
    const span = Math.asin(half / radius);
    const [ex, ey] = pol(1, a);
    const plan: XY[] = [];
    for (const side of [1, -1]) {
      for (let j = 0; j < 12; j++) {
        const t = -span + (2 * span * j) / 12;
        const u = from + half - side * radius * Math.sin(t);
        const v = -side * (radius * Math.cos(t) - off);
        plan.push([ex * u - ey * v, ey * u + ex * v]);
      }
    }
    prism(mesh, plan, z0, z1, LEAF);
  };
  const angles =
    options.angles ?? Array.from({ length: leaves }, (_, i) => 22.5 + (i * 360) / leaves);
  for (const a of angles) {
    leaf(a, root, reach, -1, 5);
    leaf(a, root + 4, reach - (reach - root) * 0.3, 5, 7.6);
  }
  cyl(mesh, ORIGIN, tall, tall + 3, peg * 0.5, cream);
  band(mesh, ORIGIN, tall - 10, tall - 6.5, peg, cream);
  cyl(mesh, ORIGIN, -3, 9, peg + 3, PEG);
  drum(mesh, ORIGIN, -14, -14 - foot, peg * 0.66, 9, PEG, 32);
  return mesh;
}

// ------------------------------------------------------------------ Cartwheel

const RIM = mat("#f3ece1", "#b9b0ae", "#8d8590");
const HUB = mat("#465066", "#333a4c", "#272c3a");

// (z0, outer, inner, spokes, hub radius) per wheel, bottom first.
type Wheel = readonly [z0: number, outer: number, inner: number, spokes: number, hub: number];
export const HUB_WHEELS: readonly Wheel[] = [
  [-28, 68, 54, 6, 19],
  [28, 42, 31, 3, 12],
];

export type Wheels = {
  // The arc of the large wheel's rim left open, in degrees, and the docking bay's angle.
  gap?: readonly [number, number];
  bay?: number;
};

// A large wheel under a smaller one, heavy hubs, a tapered axle and a dock collar.
export function wheels(lit: boolean, options: Wheels = {}): Mesh {
  const cap = lamp("#c22b40", lit);
  const mesh: Mesh = [];
  const specs = HUB_WHEELS;
  const big = specs[0]!;
  const [low, high] = [specs[0]![0], specs.at(-1)![0] + 8];
  for (const wheel of specs) {
    const [z0, outer, inner, spokes, hub] = wheel;
    const z1 = z0 + 8;
    const open = wheel === big ? options.gap : undefined;
    meshRing(mesh, ORIGIN, z0, z1, outer, inner, RIM, 64, open);
    meshRing(mesh, ORIGIN, z0 + 2.4, z0 + 5.6, outer + 0.5, outer - 1.5, HUB, 64, open);
    cyl(mesh, ORIGIN, z0 - 3, z1 + 3, hub, HUB, 32);
    for (let k = 0; k < spokes; k++) {
      const a = (k * 360) / spokes + 30;
      if (open && open[0] < a % 360 && a % 360 < open[1]) continue;
      bar(mesh, ORIGIN, a, hub - 1, inner + 1, 6.5, z0 + 1.5, z1 - 1.5, HUB);
      bar(mesh, ORIGIN, a, inner - 4, inner + 0.5, 10.5, z0 + 0.8, z1 - 0.8, HUB);
    }
  }
  for (const [i, lower] of specs.slice(0, -1).entries()) {
    const upper = specs[i + 1]!;
    drum(mesh, ORIGIN, lower[0] + 11, upper[0] - 3, lower[4] * 0.72, upper[4] * 0.8, HUB, 32);
  }
  const top = specs.at(-1)![4];
  cyl(mesh, ORIGIN, high + 3, high + 6, top * 0.8, cap, 32);
  finial(mesh, ORIGIN, high + 6, HUB, cap, top * 0.5, 6);
  const bottom = big[4];
  cyl(mesh, ORIGIN, low - 13, low - 3, bottom * 1.25, RIM, 40);
  band(mesh, ORIGIN, low - 9.6, low - 6.4, bottom * 1.25, cap, 40);
  drum(mesh, ORIGIN, low - 13, low - 27, bottom * 0.9, bottom * 0.4, HUB, 28);
  const body = mesh.length;
  if (options.bay !== undefined) {
    // dockingBay: a berth drum on a thick arm off the rim wall.
    const [z0, outer] = big;
    taper(mesh, ORIGIN, options.bay, outer - 3, outer + 16, 9, 6, z0 + 0.5, z0 + 7.5, HUB);
    const c = pol(outer + 24, options.bay);
    cyl(mesh, c, z0 - 1, z0 + 9, 13, RIM, 28);
    cyl(mesh, c, z0 + 9, z0 + 10.5, 8, cap, 24);
  }
  return project(mesh, body);
}

// ------------------------------------------------------------------ Whirlpool

const ARM = mat("#f6f1e4", "#c9c3b0", "#a39c88");
const CORE = mat("#2a6676", "#1c4a57", "#123842");

// Two ramps wind out of a core drum's wall.
export function whirl(lit: boolean): Mesh {
  const [arms, sweep, r0, r1, w0, w1, core, top, stalk] = [2, 270, 21, 83, 16, 11, 24, 24, 66];
  const coral = lamp("#ff6f4e", lit);
  const mesh: Mesh = [];
  // Along the ramp, by degrees travelled.
  const radius = (t: number) => r0 + ((r1 - r0) * t) / sweep;
  const width = (t: number) => w0 + ((w1 - w0) * t) / sweep;
  const deck = (t: number) => 15 - (11 * t) / sweep;
  cyl(mesh, ORIGIN, -8, top, core, CORE);
  drum(mesh, ORIGIN, -8, -8 - stalk, core * 0.66, 6, CORE, 32);
  cyl(mesh, ORIGIN, -14, -8, core * 0.8, CORE);
  for (let i = 0; i < arms; i++) {
    const turn = 20 + (i * 360) / arms;
    meshSpiral(mesh, turn, 0, sweep, { radius, width, top: deck, bottom: () => -5 }, ARM);
    const end = pol(radius(sweep), turn + sweep);
    cyl(mesh, end, -7, deck(sweep) + 3, 8.5, CORE, 24);
    cyl(mesh, end, deck(sweep) + 3, deck(sweep) + 4.5, 5, coral, 20);
    // One lamp band along the ramp's outer wall.
    meshSpiral(
      mesh,
      turn,
      62,
      sweep - 8,
      {
        radius: (t) => radius(t) + width(t) / 2,
        width: () => 1,
        top: (t) => deck(t) - 2.2,
        bottom: (t) => deck(t) - 4.8,
      },
      coral,
    );
  }
  cyl(mesh, ORIGIN, top, top + 3, core * 0.6, CORE);
  meshDome(mesh, [0, 0, top + 3], core * 0.46, coral);
  return mesh;
}

// ------------------------------------------------------------------ Needle

const HULL = mat("#3a3f63", "#282c49", "#1b1d30");
const BONE = mat("#f3ecdd", "#c6bca5", "#a0957c");
// The needle's axis: level, and level on the screen.
const AXIS: XY = [Math.SQRT1_2, -Math.SQRT1_2];

export type Needle = {
  length?: number;
  eyes?: readonly number[];
  outer?: number;
  inner?: number;
};

// A round needle through its eye, or through two smaller eyes.
export function needle(lit: boolean, options: Needle = {}): Mesh {
  const { length = 128, eyes = [0], outer = 43, inner = 32 } = options;
  const [r, tip] = [9.5, 3.4];
  const red = lamp("#d7263d", lit);
  const mesh: Mesh = [];
  const half = Math.max(...eyes.map(Math.abs)) + 26;
  const on = (s: number, c: XY = ORIGIN): Point => [c[0] + AXIS[0] * s, c[1] + AXIS[1] * s, 0];
  const girth = (s: number) =>
    Math.abs(s) > half ? tip + ((r - tip) * (length - Math.abs(s))) / (length - half) : r;
  meshTube(mesh, on(-half), on(half), r, r, HULL, 24);
  for (const s of [1, -1]) {
    // A thick taper to a blunt end, one thread winding and a lamp cap.
    meshTube(mesh, on(s * half), on(s * length), r, tip, HULL, 24);
    const wind = half + 22;
    meshTube(mesh, on(s * wind), on(s * (wind + 8)), girth(wind) + 1, girth(wind + 8) + 1, red, 24);
    meshTube(
      mesh,
      on(s * (length - 9)),
      on(s * (length + 1)),
      girth(length - 9) + 0.6,
      tip + 0.6,
      red,
      16,
    );
  }
  for (const eye of eyes) {
    const c: XY = [AXIS[0] * eye, AXIS[1] * eye];
    meshRing(mesh, c, -6, 6, outer, inner, BONE);
    meshRing(mesh, c, -1.7, 1.7, outer + 0.5, outer - 1.5, HULL);
    for (const a of [45, 225]) bar(mesh, c, a, r - 2, inner + 1, 7, -3.5, 3.5, HULL);
    for (const s of [1, -1]) {
      meshTube(mesh, on(s * (inner - 3), c), on(s * (outer + 4), c), r + 3, r + 3, BONE, 24);
    }
    cyl(mesh, c, 0, r + 2, 7, HULL, 24);
    finial(mesh, c, r + 2, HULL, red, 5, 6);
  }
  return mesh;
}

// ------------------------------------------------------------------ Andromeda

const BODY = mat("#f4ead3", "#cfc2a4", "#a99c80");
const INDIGO = mat("#34376f", "#25275a", "#1a1b3c");

export type Saucer = {
  reach?: number;
  bulge?: readonly [number, number, number];
  turret?: readonly [number, number];
  keel?: number;
  school?: boolean;
};

// Thick lens: rim deck, stepped upper and lower tiers, bulge, turret and keel.
export function saucer(lit: boolean, options: Saucer = {}): Mesh {
  const { reach = 80, bulge = [44, 28, 14], turret = [15, 9], keel = 54 } = options;
  const gold = lamp("#ffc43d", lit);
  const mesh: Mesh = [];
  cyl(mesh, ORIGIN, -5, 5, reach, BODY, 72);
  band(mesh, ORIGIN, -1.7, 1.7, reach, INDIGO, 72);
  cyl(mesh, ORIGIN, 5, 9, reach * 0.76, BODY, 64);
  cyl(mesh, ORIGIN, -9, -5, reach * 0.7, BODY, 64);
  const [b0, b1, bh] = bulge;
  drum(mesh, ORIGIN, 9, 9 + bh, b0, b1, BODY);
  const [tr, th] = turret;
  const zt = 9 + bh;
  cyl(mesh, ORIGIN, zt, zt + th, tr, INDIGO);
  band(mesh, ORIGIN, zt + th * 0.3, zt + th * 0.7, tr, gold, 32);
  cyl(mesh, ORIGIN, zt + th, zt + th + 2.5, tr * 0.62, gold, 24);
  drum(mesh, ORIGIN, -9, -25, b0 * 0.9, 17, BODY);
  if (keel) {
    drum(mesh, ORIGIN, -25, -25 - keel, 14, 6, INDIGO, 32);
    cyl(mesh, ORIGIN, -31, -25, 18, INDIGO);
  }
  const body = mesh.length;
  if (options.school) {
    // courierSchool: a small saucer docked on a thick spur off the rim deck.
    taper(mesh, ORIGIN, 135, reach - 4, reach + 14, 7, 5, -4, 3, INDIGO);
    const c = pol(reach + 24, 135);
    cyl(mesh, c, -5, 4, 16, BODY, 32);
    cyl(mesh, c, 4, 8, 10, BODY, 24);
    cyl(mesh, c, 8, 12, 5.5, INDIGO, 20);
    cyl(mesh, c, 12, 14, 3.6, gold, 16);
  }
  return project(mesh, body);
}

// ------------------------------------------------------------------ Phantom

const PALE = mat("#f0e9f8", "#c3b6d8", "#a596bf");
const VIOLET = mat("#a292c8", "#7e6ea8", "#5f5088");

type Tier = readonly [z0: number, tones: "pale" | "violet"];
export type Twin = {
  arms?: number;
  reach?: number;
  tiers?: readonly Tier[];
  turn?: number;
  notch?: number;
  tip?: number;
  keel?: number;
  // The arm of the top slab that ends short, or carries the lamp collar over its old break.
  cracked?: number;
  mended?: number;
  // Degrees each tier turns from the one below, and whether arm tips carry lamp blocks.
  twist?: number;
  tips?: boolean;
  // The slab tones and the lamp colour, and the light in mesh space for a model drawn turned.
  paint?: { pale: Tones; violet: Tones; lamp: string };
  light?: Point;
};

// Thick tapered arm slab with a raised ridge tier and a lamp block at the tip.
function arm(
  mesh: Mesh,
  a: number,
  spread: number,
  reach: number,
  notch: number,
  tip: number,
  z0: number,
  z1: number,
  tones: Tones,
  light: Tones | undefined,
  cut: number,
  collar: boolean,
): void {
  const end = reach * cut;
  const w = cut === 1 ? tip : tip + ((spread * notch) / reach) * (1 - cut) * 0.9;
  prism(
    mesh,
    [ORIGIN, pol(notch, a - spread), pol(end, a - w), pol(end, a + w), pol(notch, a + spread)],
    z0,
    z1,
    tones,
  );
  prism(
    mesh,
    [
      ORIGIN,
      pol(notch * 0.62, a - spread),
      pol(end * 0.8, a - w * 0.5),
      pol(end * 0.8, a + w * 0.5),
      pol(notch * 0.62, a + spread),
    ],
    z1,
    z1 + 3.2,
    tones,
  );
  const mid = (z0 + z1) / 2;
  const tall = (z1 - z0) / 2;
  if (cut === 1 && light) {
    const hw = reach * Math.sin(tip * RADIAN);
    block(
      mesh,
      pol(reach - 3, a),
      a,
      3.6,
      hw + 0.8,
      mid + 1 - tall - 1.6,
      mid + 1 + tall + 1.6,
      light,
    );
  }
  if (collar && light) {
    const hw = reach * 0.5 * Math.sin((tip + ((spread * notch) / reach) * 0.45) * RADIAN);
    block(
      mesh,
      pol(reach * 0.5, a),
      a,
      3.4,
      hw + 1.6,
      mid + 0.8 - tall - 2.2,
      mid + 0.8 + tall + 2.2,
      light,
    );
  }
}

// Tri-arm slabs echoed down a spindle.
export function twin(lit: boolean, options: Twin = {}): Mesh {
  const {
    arms = 3,
    reach = 88,
    tiers = [
      [-40, "violet"],
      [16, "pale"],
    ],
    turn = 45,
    notch = 20,
    tip = 4,
    keel = 0,
    twist = 0,
    tips = true,
    paint = { pale: PALE, violet: VIOLET, lamp: "#62f0c4" },
  } = options;
  const mint = lamp(paint.lamp, lit);
  const stem = paint.violet;
  const mesh: Mesh = [];
  const levels = tiers.map(([z]) => z);
  const [low, high] = [Math.min(...levels), Math.max(...levels)];
  for (const [tier, [z0, tones]] of tiers.entries()) {
    for (let k = 0; k < arms; k++) {
      const top = z0 === high;
      arm(
        mesh,
        turn + twist * tier + (k * 360) / arms,
        180 / arms,
        reach,
        notch,
        tip,
        z0,
        z0 + 12,
        tones === "pale" ? paint.pale : stem,
        tips ? mint : undefined,
        top && options.cracked === k ? 0.52 : 1,
        top && options.mended === k,
      );
    }
  }
  cyl(mesh, ORIGIN, low + 12, high, 10, stem);
  for (const z of levels.slice(1)) cyl(mesh, ORIGIN, z - 5, z, 15, stem);
  for (const z of levels.slice(0, -1)) cyl(mesh, ORIGIN, z + 12, z + 20, 15, stem);
  if (levels.length > 1) {
    const mid = (low + 12 + high) / 2 + 4;
    band(mesh, ORIGIN, mid - 2.2, mid + 2.2, 10, mint, 32);
  }
  cyl(mesh, ORIGIN, high + 12, high + 17.5, 13, stem);
  meshDome(mesh, [0, 0, high + 17.5], 10, mint, { ...(options.light && { light: options.light }) });
  if (keel) drum(mesh, ORIGIN, low, low - keel, 11, 4.5, stem, 20);
  return mesh;
}

// ------------------------------------------------------------------ hostile stations

// A hostile structure at heading 0: forward +x, port +y. `mounts` are the deck points its weapon
// bases stand on, in `fill` order.
export type Hostile = { hull: Mesh; mounts: { id: string; at: Point }[] };

const CLAIM_RIM = mat("#b4532a", "#8a3b1c", "#632a15");
const CLAIM_HUB = mat("#3a2f33", "#2a2125", "#1d171a");
const GARNET = mat("#8e2437", "#6b1a29", "#4a121d");
const GARNET_DARK = mat("#2b2230", "#1f1823", "#151019");
const CORAL = mat("#e8705f", "#b9503f", "#8c3a2e");
const MAROON = mat("#6e3a45", "#522a33", "#3a1d24");

// A regular plan of `sides` corners, the first at `corner` degrees.
const ngon = (sides: number, r: number, corner: number, z?: number) =>
  Array.from({ length: sides }, (_, i) => {
    const [x, y] = pol(r, corner + (i * 360) / sides);
    return z === undefined ? ([x, y] as const) : ([x, y, z] as const);
  });
// A deck of `sides` flat walls, and a keel tapering between two such sections.
const deck = (
  mesh: Mesh,
  sides: number,
  r: number,
  corner: number,
  z0: number,
  z1: number,
  tones: Tones,
) => prism(mesh, ngon(sides, r, corner) as Plan, z0, z1, tones);
function keel(
  mesh: Mesh,
  sides: number,
  corner: number,
  z0: number,
  r0: number,
  z1: number,
  r1: number,
  tones: Tones,
): void {
  meshLoft(
    mesh,
    [ngon(sides, r0, corner, z0) as Point[], ngon(sides, r1, corner, z1) as Point[]],
    tones,
    "curved",
  );
}
const weapons = (at: (i: number) => Point) =>
  Array.from({ length: 8 }, (_, i) => ({ id: `weapon-${i}`, at: at(i) }));

// Claim: one open eight-sided wheel over a solid eight-sided deck with four broad blades on its
// flats. The eight mounts stand on the wheel's corners.
export function hostileClaim(): Hostile {
  const amber = lamp("#ffb02e", true);
  const hull: Mesh = [];
  deck(hull, 8, 62, 22.5, -30, -16, CLAIM_HUB);
  deck(hull, 8, 44, 22.5, -16, -12, CLAIM_RIM);
  const flat = 62 * Math.cos(Math.PI / 8);
  for (let j = 0; j < 4; j++) {
    const a = j * 90;
    prism(
      hull,
      [pol(flat - 6, a - 20), pol(flat + 17, a - 7), pol(flat + 17, a + 7), pol(flat - 6, a + 20)],
      -28,
      -18,
      CLAIM_RIM,
    );
  }
  cyl(hull, ORIGIN, -12, 30, 17, CLAIM_HUB, 32);
  meshRing(hull, ORIGIN, 8, 20, 72, 54, CLAIM_RIM, 8);
  for (let j = 0; j < 4; j++) {
    bar(hull, ORIGIN, j * 90, 16, 54 * Math.cos(Math.PI / 8) + 1, 9, 10, 18, CLAIM_HUB);
  }
  cyl(hull, ORIGIN, 30, 34, 12, amber, 28);
  finial(hull, ORIGIN, 34, CLAIM_HUB, amber, 7, 6);
  keel(hull, 8, 22.5, -30, 30, -44, 12, CLAIM_HUB);
  return { hull, mounts: weapons((i) => [...pol(63.5, 22.5 + i * 45), 20]) };
}

// Garnet: two six-sided decks, the lower one larger and turned 30 degrees. Six mounts stand on
// the upper deck's corners and two on opposite corners of the lower deck.
export function hostileGarnet(): Hostile {
  const amber = lamp("#ffb02e", true);
  const hull: Mesh = [];
  deck(hull, 6, 96, 0, -18, -7, GARNET);
  cyl(hull, ORIGIN, -7, 3, 46, GARNET_DARK, 40);
  deck(hull, 6, 80, 30, 3, 14, GARNET);
  deck(hull, 6, 80.5, 30, 6.5, 10.5, GARNET_DARK);
  deck(hull, 6, 56, 30, 14, 19, GARNET);
  drum(hull, ORIGIN, 19, 32, 40, 26, GARNET, 40);
  cyl(hull, ORIGIN, 32, 42, 16, GARNET_DARK);
  band(hull, ORIGIN, 35, 39, 16, amber, 32);
  cyl(hull, ORIGIN, 42, 45, 10, amber, 24);
  drum(hull, ORIGIN, -18, -36, 60, 20, GARNET, 40);
  drum(hull, ORIGIN, -36, -78, 16, 7, GARNET_DARK, 32);
  return {
    hull,
    mounts: weapons((i) =>
      i < 6 ? [...pol(69, 30 + i * 60), 14] : [...pol(86, i === 6 ? 0 : 180), -7],
    ),
  };
}

// Coral: four arms over four, turned 45 degrees, with lamps on the hub only. Four mounts stand on
// the upper arm tips and four on the lower. `light` is the light in mesh space.
export function hostileCoral(light?: Point): Hostile {
  const hull = twin(true, {
    arms: 4,
    tiers: [
      [-40, "violet"],
      [16, "pale"],
    ],
    turn: 0,
    twist: 45,
    reach: 96,
    notch: 20,
    tip: 7.5,
    keel: 24,
    tips: false,
    paint: { pale: CORAL, violet: MAROON, lamp: "#ffd27a" },
    ...(light && { light }),
  });
  return {
    hull,
    mounts: weapons((i) =>
      i < 4 ? [...pol(86, 45 + i * 90), 28] : [...pol(86, (i - 4) * 90), -28],
    ),
  };
}

// Claim turret platform: one open eight-sided wheel on a heavy hub, with port, starboard and aft
// mounts on its corners.
export function hostilePlatform(): Hostile {
  const amber = lamp("#ffb02e", true);
  const hull: Mesh = [];
  meshRing(hull, ORIGIN, 0, 10, 64, 46, CLAIM_RIM, 8);
  cyl(hull, ORIGIN, -6, 14, 18, CLAIM_HUB, 28);
  for (let j = 0; j < 4; j++) {
    bar(hull, ORIGIN, j * 90, 17, 46 * Math.cos(Math.PI / 8) + 1, 9, 2, 8, CLAIM_HUB);
  }
  cyl(hull, ORIGIN, 14, 17, 11, amber, 24);
  drum(hull, ORIGIN, -6, -22, 15, 6, CLAIM_HUB, 20);
  const at = (degrees: number): Point => [...pol(55, degrees), 10];
  return {
    hull,
    mounts: [
      { id: "port", at: at(112.5) },
      { id: "starboard", at: at(-67.5) },
      { id: "aft", at: at(202.5) },
    ],
  };
}
