// Friendly object models (art/friendly-redesign.md): each object is one set of connected solids
// in view space (the projection's x, y and up z), authored in model units and scaled to its
// display size by the producer. An object's frames share one scale and one frame.
import { shade } from "./fleet-models.ts";
import type { Point } from "./projection.ts";
import {
  type Mesh,
  meshBar,
  meshBlock,
  meshCapped,
  meshDome,
  meshExtrude,
  meshHoop,
  meshLoft,
  meshPlace,
  meshRing,
  meshSpiral,
  meshTube,
  type Tones,
} from "./solid.ts";

export const mat = (top: string, left = shade(top, 0.76), right = shade(top, 0.56)): Tones => [
  top,
  left,
  right,
];
// A lamp keeps its colour on lit and left faces.
export const glow = (colour: string): Tones => [colour, colour, shade(colour, 0.85)];

const polar = (radius: number, degrees: number): [number, number] => [
  radius * Math.cos((degrees * Math.PI) / 180),
  radius * Math.sin((degrees * Math.PI) / 180),
];
const UP: Point = [0, 0, 1];
// Screen right and toward the viewer, on the world plane.
const RIGHT: Point = [Math.SQRT1_2, -Math.SQRT1_2, 0];
const NEAR: Point = [Math.SQRT1_2, Math.SQRT1_2, 0];
const along = (axis: Point, k: number, lift = 0): Point => [
  axis[0] * k,
  axis[1] * k,
  axis[2] * k + lift,
];

// Upright cylinder or frustum on the vertical axis through (x, y): radius `r` at z1 and `r0` at
// z0 (`r` when omitted).
function drum(
  mesh: Mesh,
  [x, y]: readonly [number, number],
  z0: number,
  z1: number,
  r: number,
  tones: Tones,
  sides = 48,
  r0 = r,
): void {
  meshTube(mesh, [x, y, z0], [x, y, z1], r0, r, tones, sides);
}
// Vertical extrusion of a plan between two heights.
function prism(
  mesh: Mesh,
  plan: readonly (readonly [number, number])[],
  z0: number,
  z1: number,
  tones: Tones,
): void {
  meshExtrude(
    mesh,
    plan.map(([x, y]): Point => [x, y, z0]),
    [0, 0, z1 - z0],
    tones,
  );
}
const O = [0, 0] as const;

// ------------------------------------------------------------------ palettes

const INK = mat("#3a3448", "#2a2536", "#181425");
const SUNFLOWER = {
  gold: mat("#f2a51f", "#c98212", "#a66a0c"),
  seed: mat("#6a4630", "#4b3020", "#35211a"),
  cream: mat("#fff4d6"),
  rib: mat("#b8700f"),
  dim: mat("#c9a45a", "#a8843e", "#86682c"),
};
const CARTWHEEL = {
  rim: mat("#f3ece1", "#b9b0ae", "#8d8590"),
  hub: mat("#465066", "#333a4c", "#272c3a"),
  cap: glow("#c22b40"),
  dim: glow("#7a3a48"),
};
const WHIRLPOOL = {
  arm: mat("#f6f1e4", "#c9c3b0", "#a39c88"),
  core: mat("#2a6676", "#1c4a57", "#123842"),
  lamp: glow("#ff6f4e"),
  dim: glow("#b0624e"),
  rib: mat("#b5ae9a"),
};
const ANDROMEDA = {
  body: mat("#f4ead3", "#cfc2a4", "#a99c80"),
  trim: mat("#34376f", "#25275a", "#1a1b3c"),
  lamp: glow("#ffc43d"),
  dim: glow("#8f8a6a"),
  dark: glow("#2a2d48"),
  standby: glow("#6f78b8"),
  pilot: glow("#70ace8"),
  pilotDim: glow("#3f5878"),
};
const NEEDLE = {
  body: mat("#f3ecdd", "#c6bca5", "#a0957c"),
  trim: mat("#3a3f63", "#282c49", "#1b1d30"),
  lamp: glow("#d7263d"),
  dim: glow("#7a4450"),
};
const SURVEY = {
  body: mat("#efeaf4", "#c4afcc", "#9a86a6"),
  trim: mat("#4a4358", "#352f41", "#25202e"),
  pontoon: mat("#c4afcc", "#9a86a6", "#7a6886"),
  lamp: glow("#65c9bf"),
  dim: glow("#3f7f7a"),
};
const HOLO = {
  body: mat("#ffffff", "#d9dff0", "#a3aacb"),
  trim: mat("#4a4358", "#352f41", "#25202e"),
  lamp: glow("#e868c8"),
  dim: glow("#a83a96"),
};
const STARDUST = mat("#fff2cc", "#f4d98a", "#c8a24e");
const ORE = mat("#b07850", "#8a5a3c", "#5e3c28");
const AMMO = mat("#b4e67e", "#8fd14f", "#5e9a2e");
const AMBER = mat("#ffd998", "#f0bd68", "#b98838");
const GLINT = mat("#ffffff", "#e3d6ea", "#c4afcc");
const CACHE = {
  body: mat("#a99dba", "#7a6f8c", "#544a66"),
  lit: glow("#f0ddf8"),
  low: glow("#c4afcc"),
};
const WRECK = {
  lower: mat("#5c6b84", "#44506a", "#2f384c"),
  upper: mat("#e4e8ee", "#b4bbc8", "#868e9e"),
  hold: mat("#231f30", "#1b1826", "#14121c"),
};

// ------------------------------------------------------------------ galaxy beacons, buoys, lamps

// Salvage beacon: one bud on a stalk, four petals and one lamp.
function salvageBeacon(lit: boolean): Mesh {
  const { gold, seed, rib } = SUNFLOWER;
  const lamp = lit ? SUNFLOWER.cream : SUNFLOWER.dim;
  const [reach, disc, stalk, half] = [25, 16, 70, 26];
  const mesh: Mesh = [];
  meshTube(mesh, [0, 0, -6], [0, 0, -6 - stalk], disc * 0.48, 6, seed, 32);
  drum(mesh, O, -12, -6, disc * 0.65, seed);
  drum(mesh, O, -6 - stalk * 0.52, -6 - stalk * 0.45, disc * 0.44, seed);
  drum(mesh, O, -6, 9, disc, seed);
  drum(mesh, O, 1, 4, disc + 0.5, lamp);
  for (let i = 0; i < 4; i++) {
    const a = 22.5 + i * 90;
    const mid = reach * 0.71;
    prism(
      mesh,
      [
        polar(disc - 7, a - half * 0.8),
        polar(mid, a - half),
        polar(reach, a),
        polar(mid, a + half),
        polar(disc - 7, a + half * 0.8),
      ],
      -5,
      0,
      gold,
    );
    const [x, y] = polar(1, a);
    meshBlock(
      mesh,
      [x * mid, y * mid, 0.4],
      [[-y, x, 0], [x, y, 0], UP],
      [mid * Math.tan((half * Math.PI) / 180) - 0.8, 0.9, 0.5],
      rib,
    );
  }
  drum(mesh, O, 9, 11, disc * 0.55, seed);
  meshDome(mesh, [0, 0, 11], disc * 0.45, lamp);
  return mesh;
}

// Model angles of the mooring buoy's three arms and the radius and height of their cleats.
export const MOORING_ARMS = [0, 120, 240] as const;
export const MOORING_CLEAT = { radius: 35, height: 7 } as const;

// Mooring buoy: one small wheel on its axle, three spokes ending in mooring cleats, one lamp.
function mooringBuoy(lit: boolean): Mesh {
  const { rim, hub } = CARTWHEEL;
  const [outer, inner, core] = [32, 24, 9];
  const mesh: Mesh = [];
  drum(mesh, O, -8, 18, 7, hub, 32);
  meshRing(mesh, O, 0, 8, outer, inner, rim);
  meshRing(mesh, O, 2.6, 5.4, outer + 0.5, outer - 1.5, hub);
  drum(mesh, O, -2, 10, core, hub, 32);
  for (const a of MOORING_ARMS) {
    meshBar(mesh, a, core - 1, inner + 1, 6, 2, 6, hub);
    meshBar(mesh, a, inner - 4, inner + 0.5, 10, 1, 7, hub);
    drum(mesh, polar(MOORING_CLEAT.radius, a), 1, MOORING_CLEAT.height, 4.2, hub, 12);
  }
  meshTube(mesh, [0, 0, -8], [0, 0, -20], 7, 2, hub, 20);
  drum(mesh, O, 10, 30, 10.5, hub, 24);
  meshDome(mesh, [0, 0, 30], 9, lit ? CARTWHEEL.cap : CARTWHEEL.dim);
  return mesh;
}

// The Whirlpool family: ramps wind out of a core drum on a keel, each ending in a float, with
// one lamp on the drum. With `climb` the ramp climbs the drum by that height instead of
// spreading.
function whirl(
  lit: boolean,
  shape: {
    arms: number;
    sweep: number;
    radius: readonly [number, number];
    width: readonly [number, number];
    drum: number;
    top: number;
    keel: number;
    climb?: number;
  },
): Mesh {
  const { arm, core, rib } = WHIRLPOOL;
  const lamp = lit ? WHIRLPOOL.lamp : WHIRLPOOL.dim;
  const { arms, sweep, climb = 0 } = shape;
  const radius = (t: number) => shape.radius[0] + ((shape.radius[1] - shape.radius[0]) * t) / sweep;
  const width = (t: number) => shape.width[0] + ((shape.width[1] - shape.width[0]) * t) / sweep;
  const top = (t: number) => (climb ? -2 + (climb * t) / sweep : 15 - (11 * t) / sweep);
  const bottom = (t: number) => (climb ? top(t) - 6 : -5);
  const band = climb ? 1.2 : 0;
  const mesh: Mesh = [];
  drum(mesh, O, -8, shape.top, shape.drum, core);
  meshTube(mesh, [0, 0, -8], [0, 0, -8 - shape.keel], shape.drum * 0.66, 4, core, 32);
  drum(mesh, O, -14, -8, shape.drum * 0.8, core);
  for (let i = 0; i < arms; i++) {
    const turn = 20 + (i * 360) / arms;
    meshSpiral(mesh, turn, 0, sweep, { radius, width, top, bottom }, arm);
    drum(
      mesh,
      polar(radius(sweep), turn + sweep),
      bottom(sweep) - 2,
      top(sweep) + 3,
      8.5,
      core,
      24,
    );
    // One lamp band along the ramp's outer edge.
    meshSpiral(
      mesh,
      turn,
      62,
      sweep - 8,
      {
        radius: (t) => radius(t) + width(t) / 2,
        width: () => 1,
        top: (t) => top(t) - 2.2 + band,
        bottom: (t) => top(t) - 4.6 + band,
      },
      lamp,
    );
    const ribs = Math.max(1, Math.round(sweep / 110));
    for (let j = 1; j <= ribs; j++) {
      const t = 40 + ((sweep - 60) * j) / (ribs + 1);
      meshBar(
        mesh,
        turn + t,
        radius(t) - width(t) / 2 - 0.6,
        radius(t) + width(t) / 2 + 0.7,
        2.2,
        bottom(t) - 0.2,
        top(t) + 0.8,
        rib,
      );
    }
  }
  drum(mesh, O, shape.top, shape.top + 2, shape.drum * 0.58, core);
  meshDome(mesh, [0, 0, shape.top + 2], shape.drum * 0.46, lamp);
  return mesh;
}

// Current-map buoy: a drum, one spiral arm, one lamp.
const currentBuoy = (lit: boolean) =>
  whirl(lit, {
    arms: 1,
    sweep: 300,
    radius: [14, 34],
    width: [11, 7],
    drum: 15,
    top: 22,
    keel: 44,
  });
// Nursery beacon: one arm climbs a tall drum in under one turn.
const nurseryBeacon = (lit: boolean) =>
  whirl(lit, {
    arms: 1,
    sweep: 320,
    radius: [25, 25],
    width: [13, 13],
    drum: 18,
    top: 46,
    keel: 44,
    climb: 30,
  });
// Quiet crossing marker: a low drum with two short arms opening to either side, one lamp.
const quietCrossing = (lit: boolean) =>
  whirl(lit, {
    arms: 2,
    sweep: 115,
    radius: [17, 60],
    width: [14, 10],
    drum: 14,
    top: 13,
    keel: 14,
  });

export type GuideLamp = "lit" | "dim" | "dark" | "standby";

// Guide beacon: a saucer float carrying a stout tower in tiers and one large lamp. The dented
// beacon's lamp house sits knocked off the tower's axis; the relit one carries a repair collar
// in place of the trim band.
export function guideBeacon(
  lamp: GuideLamp,
  state: "sound" | "dented" | "repaired" = "sound",
): Mesh {
  const { body, trim } = ANDROMEDA;
  const mesh: Mesh = [];
  drum(mesh, O, 0, 5, 20, body, 40);
  meshTube(mesh, [0, 0, 0], [0, 0, -16], 10, 3, trim, 20);
  meshTube(mesh, [0, 0, 5], [0, 0, 32], 9, 6.5, body, 24);
  if (state === "repaired") drum(mesh, O, 14, 22, 8.6, body, 24);
  else drum(mesh, O, 16, 20, 8.4, trim, 24);
  const off: readonly [number, number] = state === "dented" ? [2.5, -2.5] : O;
  drum(mesh, off, 32, 34, 9.5, body, 24);
  drum(mesh, off, 34, 44, 7, ANDROMEDA[lamp === "lit" ? "lamp" : lamp], 24);
  meshTube(mesh, [...off, 44], [...off, 49], 8.6, 3.5, trim, 24);
  return mesh;
}

// Spare beacon: a guide beacon at 0.7 held upright in a slate cradle on a small pad, with one
// standby light on the pad.
function spareBeacon(lit: boolean): Mesh {
  const { body, trim } = ANDROMEDA;
  const mesh: Mesh = [];
  drum(mesh, O, -3, 2, 24, body, 40);
  meshTube(mesh, [0, 0, -3], [0, 0, -14], 12, 3, trim, 20);
  drum(mesh, O, 2, 10, 16, trim, 32);
  mesh.push(...meshPlace(guideBeacon("standby"), 0, 0.7, [0, 0, 9]));
  drum(mesh, polar(19.5, -45), 2, 5, 3.2, lit ? ANDROMEDA.pilot : ANDROMEDA.pilotDim, 12);
  return mesh;
}

// Route exchange: a small saucer in two tiers with one upturned dish and a lamp.
function routeExchange(lit: boolean): Mesh {
  const { body, trim } = ANDROMEDA;
  const mesh: Mesh = [];
  drum(mesh, O, 0, 5, 20, body, 40);
  drum(mesh, O, 1.6, 3.4, 20.6, trim, 40);
  meshTube(mesh, [0, 0, 0], [0, 0, -12], 9, 3, trim, 20);
  meshTube(mesh, [0, 0, 5], [0, 0, 12], 5, 13, body, 28, { cap1: trim });
  drum(mesh, O, 12, 16, 3.4, lit ? ANDROMEDA.lamp : ANDROMEDA.dim, 16);
  return mesh;
}

// Channel lamp: a short stout needle stood on end through one small eye, one lamp band.
function channelLamp(lit: boolean): Mesh {
  const { body, trim } = NEEDLE;
  const mesh: Mesh = [];
  meshTube(mesh, [0, 0, -4], [0, 0, -30], 7, 2.5, trim, 20);
  drum(mesh, O, -4, 4, 7, trim, 20);
  meshRing(mesh, O, -3, 3, 20, 13, body, 40);
  for (const a of [45, 135, 225, 315]) meshBar(mesh, a, 6, 14, 6, -2, 2, trim);
  meshTube(mesh, [0, 0, 4], [0, 0, 30], 7, 3, trim, 20);
  drum(mesh, O, 8, 14, 6.9, lit ? NEEDLE.lamp : NEEDLE.dim, 20);
  return mesh;
}

// Practice berth: one eye ring laid flat on a short blunt needle, a stout hub tower, one lamp.
function practiceBerth(lit: boolean): Mesh {
  const { body, trim } = NEEDLE;
  const mesh: Mesh = [];
  meshRing(mesh, O, -4, 4, 30, 21, body, 48);
  meshTube(mesh, along(RIGHT, -28), along(RIGHT, 28), 8, 8, trim, 20);
  for (const s of [1, -1]) {
    meshTube(mesh, along(RIGHT, s * 28), along(RIGHT, s * 38), 8, 4.5, trim, 20);
  }
  meshTube(mesh, [0, 0, -4], [0, 0, -22], 10, 3.5, trim, 24);
  drum(mesh, O, -4, 14, 11, trim, 24);
  drum(mesh, O, 14, 22, 9, lit ? NEEDLE.lamp : NEEDLE.dim, 24);
  meshTube(mesh, [0, 0, 22], [0, 0, 28], 10.5, 5, trim, 24);
  return mesh;
}

// ------------------------------------------------------------------ ring gate

// Display px per world unit across the screen: the game draws a world offset (x, y) at
// (x - y, (x + y) / 2) and the art projection at ((x - y) * sqrt(3) / 2, (x + y) / 2 - z), so
// this factor makes a model's width across the screen exact.
export const WORLD_UNIT = 2 / Math.sqrt(3);
// Gameplay's gate: the opening a pass goes through, and the rim's radii and depth along the
// axis, in world units.
export const GATE_OPENING = 66;
export const GATE_RIM = { inner: 33, outer: 40, depth: 7 } as const;
// The gate's axis on the world plane, in degrees, per orientation.
export const GATE_AXES = [0, 22.5, 45, 67.5, 90] as const;
// The collar's reach from the gate's centre, in model units beyond the rim's outer radius.
const COLLAR_REACH = 4.2;
export const GATE_COLLAR = GATE_RIM.outer + COLLAR_REACH / WORLD_UNIT;
export const GATE_LAMP = { lit: NEEDLE.lamp[0], dark: "#4a4358" } as const;
// The rim's and its band's flat tones: top, left wall, right wall.
export const NEEDLE_GATE_TONES = { rim: NEEDLE.body, band: NEEDLE.trim } as const;
export type GateLayer = "back" | "front";

// The normal of the plane through the gate's centre that parts its front layer from its back
// layer: the view direction projected onto the ring's plane, so the rule holds at every axis.
export function gateSplit(axisDegrees: number): Point {
  const [x, y] = polar(1, axisDegrees);
  const share = x + y;
  const n: Point = [1 - x * share, 1 - y * share, 1];
  const length = Math.hypot(...n);
  return [n[0] / length, n[1] / length, n[2] / length];
}

// Ring gate: one slim eye ring on edge with a navy band round its rim, and at each side a blunt
// needle collar carrying one lamp band. Model units are display px. With `layer`, only that half
// is built, each solid closed over the cut.
export function ringGate(axisDegrees: number, lit: boolean, layer?: GateLayer): Mesh {
  const { body, trim } = NEEDLE;
  const lamp = glow(lit ? GATE_LAMP.lit : GATE_LAMP.dark);
  const [x, y] = polar(1, axisDegrees);
  const axis: Point = [x, y, 0];
  const side: Point = [-y, x, 0];
  const [inner, outer, depth] = [
    GATE_RIM.inner * WORLD_UNIT,
    GATE_RIM.outer * WORLD_UNIT,
    GATE_RIM.depth * WORLD_UNIT,
  ];
  const split = gateSplit(axisDegrees);
  const toward = layer === undefined ? undefined : layer === "front" ? split : along(split, -1);
  const mesh: Mesh = [];
  meshHoop(mesh, [0, 0, 0], axis, outer, inner, depth, body, 64, toward);
  meshHoop(mesh, [0, 0, 0], axis, outer + 0.7, outer - 2.6, 2.6, trim, 64, toward);
  for (const s of [1, -1]) {
    const parts = [
      [inner + 1.5, outer + 2.4, 7.2, 7.2, trim],
      [outer + 2.4, outer + COLLAR_REACH, 7.2, 5.4, trim],
      [outer - 2.2, outer + 0.6, 7.9, 7.9, lamp],
    ] as const;
    for (const [from, to, r0, r1, tones] of parts) {
      const solid: Mesh = [];
      meshTube(solid, along(side, s * from), along(side, s * to), r0, r1, tones, 18);
      mesh.push(...(toward ? meshCapped(solid, [0, 0, 0], toward, tones) : solid));
    }
  }
  return mesh;
}

// ------------------------------------------------------------------ landmarks

// Survey beacon: a tripod buoy in tiers, three pontoon drums on thick arms round a stepped
// core, one lamp.
function surveyBeacon(lit: boolean): Mesh {
  const { body, trim, pontoon } = SURVEY;
  const mesh: Mesh = [];
  meshTube(mesh, [0, 0, -6], [0, 0, -26], 13, 4, trim, 24);
  drum(mesh, O, -6, 6, 20, body, 36);
  drum(mesh, O, 6, 16, 13, body, 28);
  drum(mesh, O, 16, 19, 15, trim, 28);
  meshDome(mesh, [0, 0, 19], 10, lit ? SURVEY.lamp : SURVEY.dim);
  for (let k = 0; k < 3; k++) {
    const a = 30 + k * 120;
    meshBar(mesh, a, 16, 40, 13, -4.5, 4.5, trim);
    drum(mesh, polar(43, a), -8, 9, 12, pontoon, 24);
    drum(mesh, polar(43, a), 9, 11.5, 8, trim, 20);
  }
  return mesh;
}

// Wreck: a derelict freighter snapped on one diagonal break. The stern half lies open, its hold
// one dark void running to the break; the bow half has swung away and touches at one corner.
function wreck(): Mesh {
  const { lower, upper, hold } = WRECK;
  const aft: Mesh = [];
  prism(
    aft,
    [
      [-66, -22],
      [2, -22],
      [20, 22],
      [-66, 22],
    ],
    0,
    14,
    lower,
  );
  prism(
    aft,
    [
      [-62, -18],
      [0, -18],
      [15, 18],
      [-62, 18],
    ],
    14,
    24,
    upper,
  );
  prism(
    aft,
    [
      [-42, -12],
      [3.2, -12],
      [13.2, 12],
      [-42, 12],
    ],
    6,
    24.6,
    hold,
  );
  prism(
    aft,
    [
      [-80, -24],
      [-60, -24],
      [-60, 24],
      [-80, 24],
    ],
    -1,
    28,
    lower,
  );
  for (const s of [1, -1]) {
    meshTube(aft, [-85, s * 11, 13], [-78, s * 11, 13], 8, 8, hold, 14);
  }
  const fore: Mesh = [];
  prism(
    fore,
    [
      [0, -22],
      [58, -22],
      [96, -10],
      [96, 10],
      [70, 22],
      [18, 22],
    ],
    0,
    14,
    lower,
  );
  prism(
    fore,
    [
      [4, -18],
      [56, -18],
      [86, -9],
      [86, 9],
      [68, 18],
      [19, 18],
    ],
    14,
    24,
    upper,
  );
  prism(
    fore,
    [
      [36, -14],
      [58, -14],
      [74, -7],
      [74, 7],
      [60, 14],
      [42, 14],
    ],
    24,
    34,
    upper,
  );
  prism(
    fore,
    [
      [59.5, -11.5],
      [75.5, -5.5],
      [75.5, 5.5],
      [59.5, 11.5],
    ],
    26,
    32,
    hold,
  );
  prism(
    fore,
    [
      [1.5, -12],
      [22, -12],
      [32, 12],
      [11.5, 12],
    ],
    6,
    24.6,
    hold,
  );
  // The bow half turns about its near stern corner.
  const swing = -24;
  const [cx, cy] = [
    22 * Math.sin((swing * Math.PI) / 180),
    -22 * Math.cos((swing * Math.PI) / 180),
  ];
  return [...aft, ...meshPlace(fore, swing, 1, [4 - cx, -22 - cy, 0])];
}

// ------------------------------------------------------------------ pickups and caches

// A crystal of two pyramids on a square girdle, turned `turn` degrees about its axis.
function crystal(tones: Tones, radius: number, height: number, turn = 0): Mesh {
  const mesh: Mesh = [];
  const square = (r: number, z: number) =>
    [0, 1, 2, 3].map((i): Point => [...polar(r, 45 + turn + 90 * i), z]);
  for (const s of [1, -1]) meshLoft(mesh, [square(radius, 0), square(0.05, s * height)], tones);
  return mesh;
}

// A twinkle: the crystal turns an eighth, then a quarter of a facet, as its tones catch the
// light, and turns back. Frames in strip order: rest, glint 1, glint 2, glint 1.
const TWINKLE = [
  [0, 0],
  [22.5, 1],
  [45, 2],
  [22.5, 1],
] as const;
const twinkle = (tones: readonly [Tones, Tones, Tones], radius: number, height: number) =>
  TWINKLE.map(([turn, level]) => crystal(tones[level], radius, height, turn));

// Stardust: one eight-faced crystal.
const stardust = () =>
  twinkle([STARDUST, ["#ffffff", "#fff2cc", "#f4d98a"], ["#ffffff", "#fffbe9", "#fff2cc"]], 6, 8);
// Lost item glint: one slim crystal.
const huntGlint = () =>
  twinkle([GLINT, ["#ffffff", "#f1eaf4", "#e3d6ea"], ["#ffffff", "#ffffff", "#f1eaf4"]], 4.5, 9);

// Ore: a squat six-sided crystal with a bevelled crown.
function oreNugget(): Mesh {
  const mesh: Mesh = [];
  meshTube(mesh, [0, 0, -4], [0, 0, 2], 6.5, 6.5, ORE, 6, { kind: "flat" });
  meshTube(mesh, [0, 0, 2], [0, 0, 5.5], 6.5, 3.4, ORE, 6, { kind: "flat" });
  return mesh;
}

// A chamfered box section at station `l`: half breadth, bottom, top and chamfer.
function section(l: number, half: number, bottom: number, top: number, chamfer: number): Point[] {
  const c = Math.min(chamfer, half * 0.8, (top - bottom) * 0.45);
  return [
    [l, -half, bottom + c * 0.5],
    [l, -half + c * 0.5, bottom],
    [l, half - c * 0.5, bottom],
    [l, half, bottom + c * 0.5],
    [l, half, top - c],
    [l, half - c, top],
    [l, -half + c, top],
    [l, -half, top - c],
  ];
}

// Ammo pack: a chamfered crate with one dark band. Its glint crosses the crate in three frames:
// the top, the top and the lit side, then the lit side alone.
const AMMO_GLINT: readonly Tones[] = [
  AMMO,
  ["#ffffff", AMMO[1], AMMO[2]],
  ["#ffffff", AMMO[0], AMMO[2]],
  [AMMO[0], AMMO[0], AMMO[2]],
];
function ammoPack(tones: Tones): Mesh {
  const mesh: Mesh = [];
  meshLoft(mesh, [section(-7, 5, -4.5, 4.5, 1.6), section(7, 5, -4.5, 4.5, 1.6)], tones);
  meshLoft(mesh, [section(-1.6, 5.4, -4.9, 4.9, 1.7), section(1.6, 5.4, -4.9, 4.9, 1.7)], INK);
  return mesh;
}

// Upgrade pickup: two chevron blocks, as deep as they are tall, facing the viewer. The climbing
// light lights the lower block, then the upper.
const AMBER_LIT: Tones = ["#ffffff", "#ffe9c0", "#f0bd68"];
function upgradeChevrons(lit?: "lower" | "upper"): Mesh {
  const mesh: Mesh = [];
  const chevron = [
    [-8, 0],
    [0, 6],
    [8, 0],
    [8, -4.4],
    [0, 1.6],
    [-8, -4.4],
  ] as const;
  for (const [name, z] of [
    ["lower", 0],
    ["upper", 7],
  ] as const) {
    meshExtrude(
      mesh,
      chevron.map(([x, y]): Point => {
        const across = along(RIGHT, x, z + y);
        return [across[0] - NEAR[0] * 3, across[1] - NEAR[1] * 3, across[2]];
      }),
      along(NEAR, 6),
      lit === name ? AMBER_LIT : AMBER,
    );
  }
  return mesh;
}

// Holodisk: one thick disc on edge: pearl rim, hologram face, dark hub. It faces the viewer at
// rest and turns `turn` degrees about its upright diameter.
function holodisk(turn = 0): Mesh {
  const mesh: Mesh = [];
  const axis: Point = [...polar(1, 45 + turn), 0];
  const disc = (half: number, radius: number, tones: Tones, sides: number) =>
    meshTube(mesh, along(axis, -half), along(axis, half), radius, radius, tones, sides, {
      kind: "flat",
    });
  disc(2.2, 8, HOLO.body, 32);
  disc(2.6, 6.2, HOLO.lamp, 32);
  disc(3, 2.2, INK, 16);
  return mesh;
}
// The turn's frames in strip order: rest, turn 1, edge-on, turn 2.
const HOLODISK_TURN = [0, 50, 90, 130] as const;

// Holodisk waypoint beacon: a keel, a pearl dish tier, a dark collar and one hologram lamp.
function holodiskBeacon(lit: boolean): Mesh {
  const mesh: Mesh = [];
  meshTube(mesh, [0, 0, -4], [0, 0, -15], 7, 2.5, HOLO.trim, 24);
  drum(mesh, O, -4, 0, 13, HOLO.body, 36);
  drum(mesh, O, 0, 3, 8, HOLO.trim, 24);
  meshDome(mesh, [0, 0, 3], 6, lit ? HOLO.lamp : HOLO.dim);
  return mesh;
}

// Discovery cache: one six-sided vault, tapered at foot and crown, with a single band that is
// dark while the cache is hidden.
function discoveryCache(band: Tones): Mesh {
  const mesh: Mesh = [];
  const tier = (z0: number, z1: number, r0: number, r1: number, tones: Tones) =>
    meshTube(mesh, [0, 0, z0], [0, 0, z1], r0, r1, tones, 6, { kind: "flat" });
  tier(-12, -7, 6.5, 9.5, CACHE.body);
  tier(-7, 5, 9.5, 9.5, CACHE.body);
  tier(5, 11, 9.5, 5, CACHE.body);
  tier(-1.5, 2, 10, 10, band);
  return mesh;
}

// ------------------------------------------------------------------ roster

export type FriendlyManifest =
  "core" | "sunflower" | "cartwheel" | "whirlpool" | "andromeda" | "needle";
// How an object's frame is placed about it: `ground` puts the model origin at the pivot, with
// the frame symmetric across it; `centre` centres the drawn extents on a square frame.
export type FriendlyObject = {
  key: string;
  name: string;
  manifest: FriendlyManifest;
  sheet: "pickups" | "landmarks" | "beacons";
  // The display px box the first frame's drawn extents fit, keeping proportion.
  fit: readonly [number, number];
  pivot: "ground" | "centre";
  // A frame's `row` adds to the object's.
  frames: readonly {
    id: string;
    title: string;
    mesh: Mesh;
    row?: Readonly<Record<string, unknown>>;
  }[];
  // Fields the manifest rows keep, beyond id, path, size and pivot.
  row: Readonly<Record<string, unknown>>;
  // Convex collision parts ship for objects Ada collects.
  collision?: boolean;
  // The frames are one manifest row: a strip in one nested root, left to right, indexed by the
  // row's `frames` names as the shipped strips are. The row takes the first frame's id.
  strip?: true;
};

const blink = (id: string, name: string, model: (lit: boolean) => Mesh) => [
  { id: `${id}-a`, title: `${name} A`, mesh: model(true) },
  { id: `${id}-b`, title: `${name} B`, mesh: model(false) },
];

// The twinkle's frames and loop, as the shipped Stardust and lost item strips define them: the
// strip's fourth frame repeats glint 1.
const GLINT_LOOP = {
  frames: { rest: 0, glint1: 1, glint2: 2 },
  loop: [
    { frame: 0, name: "rest", ms: 420 },
    { frame: 1, name: "glint1", ms: 60 },
    { frame: 2, name: "glint2", ms: 80 },
    { frame: 3, name: "glint1", ms: 60 },
  ],
} as const;

export function friendlyObjects(): FriendlyObject[] {
  const pickup = { manifest: "core", sheet: "pickups", pivot: "centre", collision: true } as const;
  const strip = { ...pickup, strip: true } as const;
  // The frames of a strip: the first takes the row's id.
  const frames = (id: string, name: string, meshes: readonly Mesh[]) =>
    meshes.map((mesh, index) => ({
      id: index === 0 ? id : `${id}-${index}`,
      title: `${name} ${index}`,
      mesh,
    }));
  const beacon = { sheet: "beacons", pivot: "ground" } as const;
  const front = { facing: "front" };
  const fixed = { facing: "fixed" };
  return [
    {
      ...strip,
      key: "stardust",
      name: "Stardust",
      fit: [14, 14],
      frames: frames("stardust", "Stardust", stardust()),
      row: { ...front, ...GLINT_LOOP },
    },
    {
      ...strip,
      key: "oreNugget",
      name: "Ore",
      fit: [14, 14],
      frames: frames("ore-nugget", "Ore", [oreNugget()]),
      row: { ...front, frames: { rest: 0 } },
    },
    {
      ...strip,
      key: "ammoPack",
      name: "Ammo pack",
      fit: [16, 16],
      frames: frames("ammo-pack", "Ammo pack", AMMO_GLINT.map(ammoPack)),
      row: {
        ...front,
        frames: { rest: 0, glint1: 1, glint2: 2, glint3: 3 },
        loop: [
          { frame: 0, name: "rest", ms: 1100 },
          { frame: 1, name: "glint1", ms: 70 },
          { frame: 2, name: "glint2", ms: 70 },
          { frame: 3, name: "glint3", ms: 70 },
        ],
      },
    },
    {
      ...strip,
      key: "upgradeChevrons",
      name: "Upgrade pickup",
      fit: [16, 16],
      frames: frames("upgrade-chevron", "Upgrade pickup", [
        upgradeChevrons(),
        upgradeChevrons("lower"),
        upgradeChevrons("upper"),
      ]),
      row: {
        ...fixed,
        frames: { rest: 0, lower: 1, upper: 2 },
        climb: [{ ms: 900 }, { ms: 120, lit: "lower" }, { ms: 120, lit: "upper" }],
      },
    },
    {
      ...strip,
      key: "huntGlint",
      name: "Lost item glint",
      fit: [15, 15],
      frames: frames("hunt-glint", "Lost item glint", huntGlint()),
      row: { ...front, ...GLINT_LOOP },
    },
    {
      ...strip,
      key: "holodisk",
      name: "Holodisk",
      fit: [16, 16],
      frames: frames("holodisk", "Holodisk", HOLODISK_TURN.map(holodisk)),
      row: {
        ...front,
        frames: { rest: 0, turn1: 1, edge: 2, turn2: 3 },
        loop: [
          { frame: 0, name: "rest", ms: 600 },
          { frame: 1, name: "turn1", ms: 70 },
          { frame: 2, name: "edge", ms: 70 },
          { frame: 3, name: "turn2", ms: 70 },
        ],
      },
    },
    {
      ...pickup,
      key: "holodiskBeacon",
      name: "Holodisk waypoint beacon",
      fit: [28, 28],
      collision: false,
      frames: blink("holodisk-beacon", "Holodisk waypoint beacon", holodiskBeacon),
      row: { ...front, frameMs: 600 },
    },
    {
      ...pickup,
      key: "discoveryCache",
      name: "Discovery cache",
      fit: [31, 31],
      frames: [
        ["lit-a", "lit A", CACHE.lit] as const,
        ["lit-b", "lit B", CACHE.low] as const,
        ["hidden", "hidden", INK] as const,
      ].map(([id, title, band]) => ({
        id: `discovery-cache-${id}`,
        title: `Discovery cache ${title}`,
        mesh: discoveryCache(band),
        row: id === "hidden" ? {} : { frameMs: 500 },
      })),
      row: front,
    },
    {
      key: "surveyBeacon",
      name: "Survey beacon",
      manifest: "core",
      sheet: "landmarks",
      pivot: "centre",
      fit: [108, 67.5],
      frames: blink("landmark-beacon", "Survey beacon", surveyBeacon),
      row: { ...fixed, frameMs: 700 },
    },
    {
      key: "wreck",
      name: "Wreck",
      manifest: "core",
      sheet: "landmarks",
      pivot: "centre",
      fit: [189, 113.4],
      frames: [{ id: "landmark-wreck", title: "Wreck", mesh: wreck() }],
      row: fixed,
    },
    {
      ...beacon,
      key: "salvageBeacon",
      name: "Salvage beacon",
      manifest: "sunflower",
      fit: [18.4, 36.8],
      frames: blink("outpost-salvagers-beacon", "Salvage beacon", salvageBeacon),
      row: { ...fixed, frameMs: 700, outpost: "salvagers", project: "salvageBeacons" },
    },
    {
      ...beacon,
      key: "mooringBuoy",
      name: "Mooring buoy",
      manifest: "cartwheel",
      fit: [42, 42],
      frames: blink("mooring-buoy", "Mooring buoy", mooringBuoy),
      row: { ...fixed, frameMs: 700 },
    },
    {
      ...beacon,
      key: "currentBuoy",
      name: "Current-map buoy",
      manifest: "whirlpool",
      fit: [31.5, 42],
      frames: blink("whirlpool-current-buoy", "Current-map buoy", currentBuoy),
      row: { ...fixed, project: "currentBuoys" },
    },
    {
      ...beacon,
      key: "nurseryBeacon",
      name: "Nursery beacon",
      manifest: "whirlpool",
      fit: [50.8, 71],
      frames: blink("whirlpool-nursery-beacon", "Nursery beacon", nurseryBeacon),
      row: { ...fixed, frameMs: 1400, project: "nurseryBeacon" },
    },
    {
      ...beacon,
      key: "quietCrossing",
      name: "Quiet crossing marker",
      manifest: "whirlpool",
      fit: [63.7, 27.3],
      frames: blink("whirlpool-quiet-crossing", "Quiet crossing marker", quietCrossing),
      row: { ...fixed, frameMs: 1000, project: "quietCrossing" },
    },
    {
      ...beacon,
      key: "guideBeacon",
      name: "Guide beacon",
      manifest: "andromeda",
      fit: [47.3, 63],
      frames: [
        ["lit-a", "lit A", "lit", guideBeacon("lit")] as const,
        ["lit-b", "lit B", "lit", guideBeacon("dim")] as const,
        ["relit-a", "relit A", "relit", guideBeacon("lit", "repaired")] as const,
        ["relit-b", "relit B", "relit", guideBeacon("dim", "repaired")] as const,
        ["dented", "dented", "dented", guideBeacon("dark", "dented")] as const,
      ].map(([id, title, state, mesh]) => ({
        id: `beacon-guide-${id}`,
        title: `Guide beacon ${title}`,
        mesh,
        row: state === "dented" ? { state } : { frameMs: 700, state },
      })),
      row: { ...fixed, beacon: "guide" },
    },
    {
      ...beacon,
      key: "spareBeacon",
      name: "Spare beacon",
      manifest: "andromeda",
      fit: [40, 48],
      frames: blink("beacon-guide-spare", "Spare beacon", spareBeacon),
      row: { ...fixed, frameMs: 700, overlay: true, beacon: "guide", project: "spareBeacon" },
    },
    {
      ...beacon,
      key: "routeExchange",
      name: "Route exchange",
      manifest: "andromeda",
      fit: [33.6, 33.6],
      frames: blink("andromeda-route-exchange", "Route exchange", routeExchange),
      row: { ...fixed, frameMs: 700, project: "routeExchange" },
    },
    {
      ...beacon,
      key: "channelLamp",
      name: "Channel lamp",
      manifest: "needle",
      fit: [21, 28],
      frames: blink("needle-lamp", "Channel lamp", channelLamp),
      row: { ...fixed, frameMs: 700, project: "channelLights" },
    },
    {
      ...beacon,
      key: "practiceBerth",
      name: "Practice berth",
      manifest: "needle",
      fit: [35, 28],
      frames: blink("needle-practice-berth", "Practice berth", practiceBerth),
      row: { ...fixed, frameMs: 700, project: "practiceBerth" },
    },
  ];
}
