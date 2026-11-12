// Heavies (frigate, capital and Gadget's capital): hull frames, per-hardpoint state sprites and
// capped plates, shared aimed turret tops, `{craft}-hardpoints.json` with the mount tiers and
// `{craft}-jets.json`. Art's layout holds every hardpoint and weapon mount position; the catalog
// export, tools/enemy-hardpoints.json, must agree wherever it lists one. Each hardpoint model is
// drawn around its own origin. Contract: art/heavies.md.
// Usage: node art/tools/heavies.ts [--offsets <file.json>] [--out <dir>]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import {
  amber,
  amberSide,
  box,
  coral,
  coralRear,
  coralSide,
  crafts,
  DISPLAY_SCALE,
  drawOrder,
  type Face,
  faces,
  hullEntries,
  ink,
  insignia,
  type JetMouth,
  jetsFile,
  mirror,
  type Part,
  type Plan,
  plate,
  turretTop,
  visor,
  visorSide,
} from "./crafts.ts";
import { replaceEntries } from "./manifest.ts";
import {
  anchor,
  depth,
  ENEMY_HEADINGS,
  json,
  type Point,
  projectAt,
  rotate,
  round,
  vector,
} from "./projection.ts";
import { type Fill, strictlyConvex, traceFills, type V2 } from "./silhouette.ts";

// Model units per Ada width: Ada's 42.88-unit wingspan.
export const ADA_WIDTH = 42.88;

// Destroyed hardpoints: scorched metal, a dark breach and one ember.
export const scorch = "#5c3a31";
export const scorchSide = "#42291f";
// Flat scorch paint on the coral hull around a wreck.
export const burn = "#6e4436";
export const breach = visorSide;
export const ember = "#f0a07c";

export type Role = "command" | "engine" | "turret";
export type State = "intact" | "destroyed";
// A weapon mount the position tier leaves unused draws its capped plate.
export type SpriteState = State | "capped";
// Gameplay's weapon kinds (gameplay/ships.md "Enemy weapons").
export type WeaponKind =
  | "laser"
  | "multiLaser"
  | "rapidMissile"
  | "heavyMissile"
  | "phaser"
  | "chargedLance"
  | "ringBurst"
  | "mineLayer";
export type Top = { name: string; z: number; parts: HeavyPart[]; muzzles: Point[] };
// A weapon's top design on one heavy class, and how it aims: at its target, or fixed aft of
// the hull heading.
export type Weapon = { top: Top; aim: "target" | "aft" };
// One position tier: the weapon on every mount, or null for a capped plate.
export type Tier = { positions: [number, number]; mounts: Record<string, WeaponKind | null> };
// `key` names a host part; a part with `on` draws straight after its host.
export type HeavyPart = Part & { key?: string; on?: string };

// One hardpoint's drawing around its origin, with absolute heights.
export type Model = {
  role: Role;
  // Height of the sprite anchor, model units.
  z: number;
  intact: HeavyPart[];
  // Absent: the hardpoint is not destructible (the retaliator turret).
  destroyed?: HeavyPart[];
  // The aimed top at aim 0 (forward is negative Y), drawn by world aim with its pivot at height z.
  // Hardpoints whose tops share a `name` share one sprite set, so their parts must be identical.
  // A weapon mount on a tiered heavy has none: its tier's weapon supplies it.
  top?: Top;
  // The capped plate a weapon mount shows when its tier leaves it unused.
  capped?: HeavyPart[];
  // Engine jet mouths around the origin.
  jets?: { mouths: [number, number][]; width: number; z: number };
};

export type HeavyCraft = {
  name: string;
  title: string;
  frame: number;
  // "enemies": art/tools/enemies.ts draws the hull frames and jets; this tool adds hardpoints.
  source: "heavies" | "enemies";
  // Hull parts without hardpoints, model units; the first part is the hull slab.
  hull: Part[];
  hullTop: number;
  // Hull width in Ada widths: `offset` fractions scale by it.
  sizeRatio: number;
  // Art's hardpoint layout, in output order. `offset` is [x, y] in fractions of hull width in
  // the hull's local frame (-y forward, +x starboard).
  hardpoints: { id: string; offset: [number, number]; model: Model }[];
  // The hull never turns: frame 0 is the hull layer for every heading.
  fixed?: true;
  // Weapon mounts filled by position tier: the fill order, the tiers and each weapon's top.
  mounts?: { fill: string[]; tiers: Tier[]; weapons: Partial<Record<WeaponKind, Weapon>> };
};

// Offsets input: tools/enemy-hardpoints.json, which Tech exports from Gameplay's catalog. Every
// hardpoint it lists must match Art's id, role and offset; Art may carry mounts it does not list
// yet. `offset` is [x, y] in fractions of hull width; `order` is the catalog order.
export type InputHardpoint = { id: string; role: Role; offset: [number, number]; order: number };
export type InputCraft = { sizeRatio: number; hardpoints: InputHardpoint[] };
export type Offsets = { version: 1; archetypes: Record<string, InputCraft> };

export const ring = (cx: number, cy: number, r: number, sides: number, phase = 0): Plan =>
  Array.from({ length: sides }, (_, i) => {
    const a = phase + (i / sides) * 2 * Math.PI;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
// A ragged star outline for scorch paint and breaches; fixed radii keep frames stable.
const RAGGED = [1, 0.62, 0.95, 0.55, 0.88, 0.7, 1, 0.5, 0.9, 0.66];
export const ragged = (cx: number, cy: number, r: number, phase: number): Plan =>
  RAGGED.map((k, i) => {
    const a = phase + (i / RAGGED.length) * 2 * Math.PI;
    return [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)] as const;
  });
const shift = (dx: number, dy: number, plan: Plan): Plan =>
  plan.map(([x, y]) => [x + dx, y + dy] as const);
const flipX = (plan: Plan): Plan => plan.map(([x, y]) => [-x, y] as const).toReversed();
// Flat parts hosted on a raised part instead of the hull top.
const hosted = (key: string, parts: readonly Part[]): HeavyPart[] =>
  parts.map(({ plan, side, top, z0, z1 }) => ({ plan, side, top, z0, z1, on: key }));

// Wreck dressing: optional hull scorch paint, then a breach and an ember on the host's top.
export function wreck(
  cx: number,
  cy: number,
  r: number,
  hullZ: number,
  host: { key: string; z: number },
  scorchHull: boolean,
): HeavyPart[] {
  const { key, z } = host;
  const paint: HeavyPart[] = scorchHull
    ? [
        {
          plan: ragged(cx, cy, r * 1.55, 0.3),
          z0: hullZ,
          z1: hullZ,
          top: burn,
          side: burn,
          decal: true,
        },
      ]
    : [];
  return [
    ...paint,
    { plan: ragged(cx, cy, r * 0.62, 1.1), z0: z, z1: z, top: breach, side: breach, on: key },
    {
      plan: box(cx - r * 0.14, cy - r * 0.1, cx + r * 0.14, cy + r * 0.18),
      z0: z,
      z1: z,
      top: ember,
      side: ember,
      on: key,
    },
  ];
}

// A deck weapon mount's base: a fixed collar; destroyed, a low scorched stump with a breach.
// `capped` adds the plate the mount shows when its position tier leaves it unused: a low plate
// disc with a dark seam ring and four bolts, no hardpoint.
function mountBase(r: number, deck: number, capped = false): Model {
  const mount = deck + 1.5;
  const collar = ring(0, 0, r * 0.85, 8, Math.PI / 8);
  const stump = { key: "stump", z: deck + 1.6 };
  const bolt = (i: number): Plan => {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const [x, y] = [Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62];
    return box(x - 1, y - 1, x + 1, y + 1);
  };
  return {
    role: "turret",
    z: deck,
    intact: [{ plan: collar, z0: deck, z1: mount, top: turretTop, side: coralRear }],
    destroyed: [
      { plan: collar, z0: deck, z1: stump.z, top: scorch, side: scorchSide, key: stump.key },
      ...wreck(0, 0, r, deck, stump, true),
    ],
    ...(capped
      ? {
          capped: [
            {
              plan: ring(0, 0, r * 0.9, 8, Math.PI / 8),
              z0: deck,
              z1: deck + 0.8,
              top: plate,
              side: coralSide,
              key: "cap",
            },
            ...hosted(
              "cap",
              [
                { plan: ring(0, 0, r * 0.45, 8, Math.PI / 8), z0: deck + 0.8, z1: deck + 0.8 },
                ...[0, 1, 2, 3].map((i) => ({ plan: bolt(i), z0: deck + 0.8, z1: deck + 0.8 })),
              ].map((part) => ({ ...part, top: coralRear, side: coralRear })),
            ),
          ],
        }
      : {}),
  };
}

const turretHead = (r: number): Plan => [
  [-r, -r * 0.35],
  [-r * 0.45, -r],
  [r * 0.45, -r],
  [r, -r * 0.35],
  [r, r * 0.55],
  [r * 0.5, r],
  [-r * 0.5, r],
  [-r, r * 0.55],
];

// The hatch on a turret top reads the aim at small sizes.
const hatch = (r: number, z: number, plan: Plan = box(-r * 0.3, r * 0.15, r * 0.3, r * 0.6)) => ({
  plan,
  z0: z,
  z1: z,
  top: visor,
  side: visor,
  on: "head",
});

// The barrel top: head, amber barrels, hatch. Frigate `gun` has one barrel, capital `turret` two.
function barrelTop(name: string, r: number, deck: number, barrels: 1 | 2): Top {
  const mount = deck + 1.5;
  const crown = deck + 4;
  const offsets = barrels === 2 ? [-r * 0.36, r * 0.36] : [0];
  const w = barrels === 2 ? r * 0.22 : r * 0.32;
  const length = barrels === 2 ? r * 2.5 : r * 2.8;
  return {
    name,
    z: mount,
    parts: [
      { plan: turretHead(r), z0: mount, z1: crown, top: turretTop, side: coralRear, key: "head" },
      ...offsets.map((dx): HeavyPart => ({
        plan: box(dx - w, -length, dx + w, -r * 0.4),
        z0: crown - 2,
        z1: crown + 0.6,
        top: amber,
        side: amberSide,
      })),
      hatch(r, crown),
    ],
    muzzles: offsets.map((dx): Point => [dx, -length, crown - 0.7]),
  };
}

// A top's head on the collar, from `mount` to `z1`.
const head = (plan: Plan, mount: number, z1: number): HeavyPart => ({
  plan,
  z0: mount,
  z1,
  top: turretTop,
  side: coralRear,
  key: "head",
});

// A quad along angle a from radius r0 to r1, 2w wide.
function spoke(a: number, r0: number, r1: number, w: number): Plan {
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return [
    [c * r0 - s * w, s * r0 + c * w],
    [c * r1 - s * w, s * r1 + c * w],
    [c * r1 + s * w, s * r1 - c * w],
    [c * r0 + s * w, s * r0 - c * w],
  ];
}

// Rapid Missile: a squared pod with four amber missile caps.
function pod(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 5];
  const tubes = [-0.38, 0.38].flatMap((x) => [-0.5, 0.05].map((y) => [x * r, y * r] as const));
  return {
    name: "pod",
    z: mount,
    parts: [
      head(box(-r * 0.85, -r * 0.95, r * 0.85, r * 0.9), mount, crown),
      ...tubes.map(([x, y]): HeavyPart => ({
        plan: box(x - r * 0.24, y - r * 0.24, x + r * 0.24, y + r * 0.24),
        z0: crown,
        z1: crown + 0.8,
        top: amber,
        side: amberSide,
        on: "head",
      })),
      hatch(r, crown, box(-r * 0.5, r * 0.5, r * 0.5, r * 0.78)),
    ],
    muzzles: tubes.map(([x, y]): Point => [x, y - r * 0.3, crown + 0.4]),
  };
}

// Heavy Missile: one plate missile on a rail with an amber warhead and band.
function rail(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 4];
  return {
    name: "rail",
    z: mount,
    parts: [
      head(turretHead(r), mount, crown),
      {
        plan: box(-r * 0.34, -r * 1.9, r * 0.34, r * 0.5),
        z0: crown - 1,
        z1: crown + 2,
        top: plate,
        side: coralSide,
        key: "body",
      },
      {
        plan: [
          [-r * 0.34, -r * 1.9],
          [0, -r * 2.6],
          [r * 0.34, -r * 1.9],
        ],
        z0: crown - 1,
        z1: crown + 2,
        top: amber,
        side: amberSide,
      },
      {
        plan: box(-r * 0.34, -r * 1.2, r * 0.34, -r * 0.95),
        z0: crown + 2,
        z1: crown + 2,
        top: amber,
        side: amber,
        on: "body",
      },
      hatch(r, crown),
    ],
    muzzles: [[0, -r * 2.6, crown + 0.5]],
  };
}

// Phaser: a round emitter dish with a dark lens and one long thin amber emitter.
function dish(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 4];
  return {
    name: "dish",
    z: mount,
    parts: [
      head(ring(0, 0, r, 12), mount, crown + 0.5),
      {
        plan: box(-r * 0.13, -r * 3.1, r * 0.13, -r * 0.5),
        z0: crown - 1,
        z1: crown,
        top: amber,
        side: amberSide,
      },
      { ...hatch(r, crown + 0.5, ring(0, -r * 0.15, r * 0.5, 12)) },
      { ...hatch(r, crown + 0.5, ring(0, -r * 0.15, r * 0.22, 12)), top: amber, side: amber },
    ],
    muzzles: [[0, -r * 3.1, crown - 0.5]],
  };
}

// Charged lance: twin plate rails like the prow tines and an amber charge crystal between them.
function lance(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 4];
  const rail: Plan = [
    [-r * 0.66, -r * 0.4],
    [-r * 0.6, -r * 3.3],
    [-r * 0.34, -r * 3.0],
    [-r * 0.34, -r * 0.4],
  ];
  return {
    name: "lance",
    z: mount,
    parts: [
      head(turretHead(r), mount, crown + 0.5),
      { plan: rail, z0: crown - 1.5, z1: crown + 1, top: plate, side: coralSide },
      { plan: flipX(rail), z0: crown - 1.5, z1: crown + 1, top: plate, side: coralSide },
      {
        plan: [
          [0, -r * 2.7],
          [r * 0.24, -r * 1.7],
          [0, -r * 0.7],
          [-r * 0.24, -r * 1.7],
        ],
        z0: crown - 1,
        z1: crown + 1.5,
        top: amber,
        side: amberSide,
      },
      hatch(r, crown + 0.5),
    ],
    muzzles: [[0, -r * 3.2, crown]],
  };
}

// Ring burst: a twelve-sided dome with eight amber studs round its rim, one per bolt.
function dome(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 4];
  const angles = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return {
    name: "dome",
    z: mount,
    parts: [
      head(ring(0, 0, r * 0.95, 12), mount, crown + 1),
      ...angles.map((a): HeavyPart => ({
        plan: spoke(a, r * 0.8, r * 1.3, r * 0.14),
        z0: crown - 0.5,
        z1: crown + 0.5,
        top: amber,
        side: amberSide,
      })),
      hatch(r, crown + 1, ring(0, 0, r * 0.4, 8, Math.PI / 8)),
    ],
    muzzles: angles.map((a): Point => [Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, crown]),
  };
}

// Mine layer: a hopper with two amber mines ready on top and a dark chute at the rear. It does
// not aim: it faces aft.
function hopper(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 4.5];
  return {
    name: "hopper",
    z: mount,
    parts: [
      head(box(-r * 0.85, -r * 0.8, r * 0.85, r * 0.8), mount, crown),
      {
        plan: box(-r * 0.42, r * 0.8, r * 0.42, r * 1.35),
        z0: mount,
        z1: crown - 1,
        top: visor,
        side: visorSide,
      },
      ...[-0.38, 0.38].map((x): HeavyPart => ({
        ...hatch(r, crown, ring(x * r, -r * 0.2, r * 0.3, 8, Math.PI / 8)),
        top: amber,
        side: amber,
      })),
    ],
    muzzles: [[0, r * 1.35, mount + 1]],
  };
}

// The weapon table for a class whose Laser top is `laser`.
function weapons(deck: number, laser: Top): Partial<Record<WeaponKind, Weapon>> {
  const aimed = (top: Top): Weapon => ({ aim: "target", top });
  return {
    laser: aimed(laser),
    multiLaser: aimed(barrelTop("turret", 12, deck, 2)),
    rapidMissile: aimed(pod(12, deck)),
    heavyMissile: aimed(rail(12, deck)),
    phaser: aimed(dish(12, deck)),
    chargedLance: aimed(lance(12, deck)),
    ringBurst: aimed(dome(12, deck)),
    mineLayer: { aim: "aft", top: hopper(12, deck) },
  };
}

// Position tiers 1-2, 3-4 and 5-6 (gameplay/ships.md "Enemy weapons").
const tier = (positions: [number, number], mounts: Tier["mounts"]): Tier => ({
  mounts,
  positions,
});
const FRIGATE_TIERS: Tier[] = [
  tier([1, 2], { port: "laser", starboard: "laser", spine: null, bow: null }),
  tier([3, 4], { port: "laser", starboard: "laser", spine: "rapidMissile", bow: null }),
  tier([5, 6], { port: "laser", starboard: "laser", spine: "rapidMissile", bow: "chargedLance" }),
];
const CAPITAL_FILL = [
  "weapon-left",
  "weapon-right",
  "weapon-rear-left",
  "weapon-rear-right",
  "claw-left",
  "claw-right",
  "stern-left",
  "stern-right",
];
const capitalTier = (positions: [number, number], kinds: (WeaponKind | null)[]): Tier =>
  tier(positions, Object.fromEntries(CAPITAL_FILL.map((id, i) => [id, kinds[i] ?? null])));
const CAPITAL_TIERS: Tier[] = [
  capitalTier([1, 2], ["laser", "laser", "multiLaser", "multiLaser"]),
  capitalTier(
    [3, 4],
    ["laser", "laser", "multiLaser", "multiLaser", "rapidMissile", "heavyMissile"],
  ),
  capitalTier(
    [5, 6],
    [
      "laser",
      "laser",
      "rapidMissile",
      "rapidMissile",
      "phaser",
      "heavyMissile",
      "ringBurst",
      "mineLayer",
    ],
  ),
];
// Mounts that some tier leaves unused carry a capped plate.
const cappable = (tiers: readonly Tier[], id: string) =>
  tiers.some((t) => (t.mounts[id] ?? null) === null);

// Frigate: a long hunter with twin prow tines, broadside guns and a stern engine block.
const FRIGATE_Z = 8;
const frigateEngine: Model = {
  role: "engine",
  z: FRIGATE_Z + 6,
  intact: [
    {
      plan: box(-24, -17, 24, 17),
      z0: FRIGATE_Z,
      z1: FRIGATE_Z + 6,
      top: coral,
      side: coralSide,
      rear: coralRear,
      key: "block",
    },
    ...hosted("block", [
      { plan: box(-20, -9, -6, 11), z0: FRIGATE_Z + 6, z1: FRIGATE_Z + 6, top: plate, side: plate },
      { plan: box(6, -9, 20, 11), z0: FRIGATE_Z + 6, z1: FRIGATE_Z + 6, top: plate, side: plate },
    ]),
  ],
  destroyed: [
    {
      plan: [
        [-24, -17],
        [24, -17],
        [24, 17],
        [10, 17],
        [4, 7],
        [-6, 17],
        [-24, 17],
      ],
      z0: FRIGATE_Z,
      z1: FRIGATE_Z + 3.5,
      top: scorch,
      side: scorchSide,
      rear: scorchSide,
      key: "wreck",
    },
    ...wreck(0, -1, 13, FRIGATE_Z, { key: "wreck", z: FRIGATE_Z + 3.5 }, true),
  ],
  // One engine hardpoint drives both mouths.
  jets: {
    mouths: [
      [-13, 17],
      [13, 17],
    ],
    width: 10,
    z: FRIGATE_Z + 3,
  },
};

export const frigate: HeavyCraft = {
  name: "frigate",
  title: "Frigate",
  frame: 384,
  source: "heavies",
  hullTop: FRIGATE_Z,
  hull: [
    {
      plan: mirror([
        [0, -50],
        [5, -58],
        [8, -98],
        [13, -114],
        [22, -106],
        [26, -62],
        [30, -34],
        [44, -16],
        [66, -6],
        [70, 14],
        [62, 30],
        [38, 36],
        [30, 52],
        [27, 68.5],
      ]),
      z0: 0,
      z1: FRIGATE_Z,
      top: coral,
      side: coralSide,
      rear: coralRear,
    },
    // Salvage plates: a dorsal spine under the spine mount and two sponson patches.
    { plan: box(-8, -6, 8, 14), z0: FRIGATE_Z, z1: FRIGATE_Z + 1.5, top: plate, side: coralSide },
    { plan: box(-60, 20, -44, 28), z0: FRIGATE_Z, z1: FRIGATE_Z + 1, top: plate, side: coralSide },
    { plan: box(44, 20, 60, 28), z0: FRIGATE_Z, z1: FRIGATE_Z + 1, top: plate, side: coralSide },
    {
      plan: box(-7, -22, 7, -12),
      z0: FRIGATE_Z,
      z1: FRIGATE_Z + 2.5,
      top: visor,
      side: visorSide,
      loose: true,
    },
    // On bare deck between the spine plate and the engine block.
    ...insignia(0, 25, 7, FRIGATE_Z),
  ],
  sizeRatio: 4,
  // Weapons fill the sponson pair, then the centreline spine, then the centreline bow.
  hardpoints: [
    { id: "engine", offset: [0, 0.3], model: frigateEngine },
    ...(
      [
        ["port", [-0.3, 0]],
        ["starboard", [0.3, 0]],
        ["spine", [0, 0.025]],
        ["bow", [0, -0.22]],
      ] as const
    ).map(([id, offset]) => ({
      id,
      offset: [...offset] as [number, number],
      model: mountBase(12, FRIGATE_Z, cappable(FRIGATE_TIERS, id)),
    })),
  ],
  mounts: {
    fill: ["port", "starboard", "spine", "bow"],
    tiers: FRIGATE_TIERS,
    weapons: weapons(FRIGATE_Z, barrelTop("gun", 12, FRIGATE_Z, 1)),
  },
};

// Capital: a broad flagship with a great claw prow, a command tower, two stern nacelles and
// four deck turrets.
const CAPITAL_Z = 12;
const TOWER: Plan = [
  [-14, -23],
  [14, -23],
  [22, -11],
  [22, 13],
  [12, 23],
  [-12, 23],
  [-22, 13],
  [-22, -11],
];
const command: Model = {
  role: "command",
  z: CAPITAL_Z + 13,
  intact: [
    {
      plan: TOWER,
      z0: CAPITAL_Z,
      z1: CAPITAL_Z + 13,
      top: coral,
      side: coralSide,
      rear: coralRear,
      key: "tower",
    },
    {
      plan: box(-12, -21, 12, -14),
      z0: CAPITAL_Z + 13,
      z1: CAPITAL_Z + 15.5,
      top: visor,
      side: visorSide,
    },
    ...hosted("tower", insignia(0, 4, 13, CAPITAL_Z + 13)),
  ],
  destroyed: [
    {
      plan: TOWER,
      z0: CAPITAL_Z,
      z1: CAPITAL_Z + 8,
      top: scorch,
      side: scorchSide,
      rear: scorchSide,
      key: "wreck",
    },
    // Broken visor, then the claw mark with its amber disc gone out.
    {
      plan: [
        [-12, -21],
        [-2, -21],
        [1, -17],
        [5, -21],
        [12, -21],
        [12, -14],
        [-12, -14],
      ],
      z0: CAPITAL_Z + 8,
      z1: CAPITAL_Z + 9,
      top: breach,
      side: breach,
    },
    ...hosted("wreck", insignia(0, 4, 13, CAPITAL_Z + 8)).map((part, i): HeavyPart => ({
      ...part,
      top: i === 0 ? ink : scorchSide,
    })),
    ...wreck(10, -5, 9, CAPITAL_Z, { key: "wreck", z: CAPITAL_Z + 8 }, true),
  ],
};

// Starboard nacelle pod around its origin; the port pod mirrors it.
const POD: Plan = [
  [-11, -30],
  [7, -30],
  [13, -20],
  [13, 24],
  [9, 30],
  [-9, 30],
  [-13, 24],
  [-13, -20],
];
const POD_BROKEN: Plan = [
  [-11, -30],
  [7, -30],
  [13, -20],
  [13, 8],
  [7, 16],
  [9, 30],
  [-3, 22],
  [-9, 30],
  [-13, 24],
  [-13, -20],
];
function nacelle(port: boolean, scale = 1): Model {
  const scaled = (plan: Plan): Plan => plan.map(([x, y]) => [x * scale, y * scale] as const);
  const side = (plan: Plan) => (port ? flipX(scaled(plan)) : scaled(plan));
  const z1 = 15;
  const wreckZ = 9;
  return {
    role: "engine",
    z: z1,
    intact: [
      { plan: side(POD), z0: 0, z1, top: coral, side: coralSide, rear: coralRear, key: "pod" },
      ...hosted("pod", [
        { plan: side(box(-7, -18, 7, 16)), z0: z1, z1, top: plate, side: plate },
        { plan: side(box(-5, 20, 5, 26)), z0: z1, z1, top: visor, side: visor },
      ]),
    ],
    destroyed: [
      {
        plan: side(POD_BROKEN),
        z0: 0,
        z1: wreckZ,
        top: scorch,
        side: scorchSide,
        rear: scorchSide,
        key: "wreck",
      },
      // The pod stands beside the hull, so no hull scorch paint.
      ...wreck(0, -2, 11, wreckZ, { key: "wreck", z: wreckZ }, false),
    ],
    jets: { mouths: [[0, 30 * scale]], width: 12, z: 6 },
  };
}

export const capital: HeavyCraft = {
  name: "capital",
  title: "Capital",
  frame: 480,
  source: "heavies",
  hullTop: CAPITAL_Z,
  hull: [
    {
      plan: mirror([
        [0, -40],
        [12, -50],
        [17, -90],
        [12, -106],
        [22, -120],
        [44, -110],
        [58, -86],
        [84, -80],
        [94, -66],
        [98, -40],
        [108, 6],
        [104, 40],
        [70, 50],
        [60, 55.5],
        [43, 55.5],
        [40.5, 66],
        [38, 84],
        [0, 90],
      ]),
      z0: 0,
      z1: CAPITAL_Z,
      top: coral,
      side: coralSide,
      rear: coralRear,
    },
    // Salvage plates: a keel strip ahead of the tower and two wing patches inboard of the turrets.
    { plan: box(-8, -38, 8, -27), z0: CAPITAL_Z, z1: CAPITAL_Z + 1.5, top: plate, side: coralSide },
    { plan: box(-74, 14, -52, 34), z0: CAPITAL_Z, z1: CAPITAL_Z + 1, top: plate, side: coralSide },
    { plan: box(52, 14, 74, 34), z0: CAPITAL_Z, z1: CAPITAL_Z + 1, top: plate, side: coralSide },
  ],
  sizeRatio: 5,
  // Weapons fill pairs: shoulders, wings, claw arms, stern deck.
  hardpoints: [
    { id: "command", offset: [0, 0], model: command },
    { id: "engine-left", offset: [-0.25, 0.4], model: nacelle(true) },
    { id: "engine-right", offset: [0.25, 0.4], model: nacelle(false) },
    ...mounts(CAPITAL_Z, [
      [-0.35, -0.3],
      [-0.42, 0.08],
      [-0.15, -0.45],
      [-0.1, 0.31],
    ]),
  ],
  mounts: {
    fill: CAPITAL_FILL,
    tiers: CAPITAL_TIERS,
    weapons: weapons(CAPITAL_Z, barrelTop("turret", 12, CAPITAL_Z, 2)),
  },
};

// The eight capital-class weapon mounts in fill order, from the port offset of each pair.
function mounts(deck: number, pairs: readonly (readonly [number, number])[]) {
  return CAPITAL_FILL.map((id, i) => {
    const [x, y] = pairs[Math.floor(i / 2)]!;
    return {
      id,
      offset: [i % 2 === 0 ? x : -x, y] as [number, number],
      model: mountBase(12, deck, cappable(CAPITAL_TIERS, id)),
    };
  });
}

// Gadget: General Gadget's own capital in Black Eye. A serrated claw hull with a raised dorsal
// ridge; the command tower carries two stepped ear fins. The capital's mounts and tiers.
const GADGET_Z = 12;
const GADGET_TOWER: Plan = [
  [-16, -26],
  [16, -26],
  [25, -12],
  [25, 15],
  [14, 26],
  [-14, 26],
  [-25, 15],
  [-25, -12],
];
// A stepped fin rising to a point: three shrinking prisms read a pointed ear in the iso view,
// the middle step plate-coloured like an inner ear.
function ear(base: Plan, z: number, height: number): HeavyPart[] {
  const cx = base.reduce((sum, [x]) => sum + x, 0) / base.length;
  const cy = base.reduce((sum, [, y]) => sum + y, 0) / base.length;
  return [1, 0.62, 0.28].map((k, i) => ({
    plan: base.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as const),
    z0: z + (i * height) / 3,
    z1: z + ((i + 1) * height) / 3,
    top: i === 1 ? plate : coral,
    side: coralSide,
    rear: coralRear,
  }));
}
const EAR: Plan = [
  [27, 18],
  [6, 24],
  [22, -4],
];
const gadgetCommand: Model = (() => {
  const top = GADGET_Z + 16;
  const wreckTop = GADGET_Z + 9;
  return {
    role: "command",
    z: top,
    intact: [
      {
        plan: GADGET_TOWER,
        z0: GADGET_Z,
        z1: top,
        top: coral,
        side: coralSide,
        rear: coralRear,
        key: "tower",
      },
      { plan: box(-14, -24, 14, -16), z0: top, z1: top + 2.5, top: visor, side: visorSide },
      ...ear(flipX(EAR), top, 18),
      ...ear(EAR, top, 18),
    ],
    destroyed: [
      {
        plan: GADGET_TOWER,
        z0: GADGET_Z,
        z1: wreckTop,
        top: scorch,
        side: scorchSide,
        rear: scorchSide,
        key: "wreck",
      },
      // The ears' stumps and the broken visor.
      ...[flipX(EAR), EAR].map((plan): HeavyPart => ({
        plan,
        z0: wreckTop,
        z1: wreckTop + 3,
        top: scorch,
        side: scorchSide,
      })),
      {
        plan: [
          [-14, -24],
          [-3, -24],
          [0, -20],
          [4, -24],
          [14, -24],
          [14, -16],
          [-14, -16],
        ],
        z0: wreckTop,
        z1: wreckTop + 1,
        top: breach,
        side: breach,
      },
      ...wreck(-6, 4, 10, GADGET_Z, { key: "wreck", z: wreckTop }, true),
    ],
  };
})();

export const gadget: HeavyCraft = {
  name: "gadget",
  title: "Gadget",
  frame: 560,
  source: "heavies",
  hullTop: GADGET_Z,
  hull: [
    {
      plan: mirror([
        [0, -46],
        [10, -56],
        [16, -100],
        [10, -118],
        [26, -142],
        [44, -130],
        [52, -112],
        [62, -94],
        [90, -88],
        [102, -72],
        [108, -46],
        [124, -32],
        [114, -16],
        [122, 6],
        [112, 26],
        [118, 44],
        [80, 60],
        [64, 64],
        [46, 64],
        [44, 76],
        [40, 96],
        [0, 104],
      ]),
      z0: 0,
      z1: GADGET_Z,
      top: coral,
      side: coralSide,
      rear: coralRear,
    },
    // Two wing patches and a raised dorsal ridge from the tower to the stern.
    { plan: box(-86, 14, -60, 36), z0: GADGET_Z, z1: GADGET_Z + 1, top: plate, side: coralSide },
    { plan: box(60, 14, 86, 36), z0: GADGET_Z, z1: GADGET_Z + 1, top: plate, side: coralSide },
    { plan: box(-5, 30, 5, 78), z0: GADGET_Z, z1: GADGET_Z + 3, top: coralRear, side: coralSide },
    ...insignia(0, -36, 8, GADGET_Z),
  ],
  sizeRatio: 5,
  hardpoints: [
    { id: "command", offset: [0, 0], model: gadgetCommand },
    { id: "engine-left", offset: [-0.27, 0.44], model: nacelle(true, 1.1) },
    { id: "engine-right", offset: [0.27, 0.44], model: nacelle(false, 1.1) },
    ...mounts(GADGET_Z, [
      [-0.36, -0.3],
      [-0.44, 0.1],
      [-0.16, -0.48],
      [-0.11, 0.33],
    ]),
  ],
  mounts: {
    fill: CAPITAL_FILL,
    tiers: CAPITAL_TIERS,
    weapons: weapons(GADGET_Z, barrelTop("turret", 12, GADGET_Z, 2)),
  },
};

// Retaliator: its gun is the hull weapon's aim mount, not a hardpoint. Held out of the export
// until Tech supplies the mount offset; enemies.ts then draws the hull frames without the
// `turret` parts, and this top aims independently of the hull.
export function retaliatorCraft(): HeavyCraft {
  const source = crafts.find(({ name }) => name === "retaliator")!;
  const deck = source.parts[0]!.z1;
  const mount = deck + 1.5;
  const parts = source.parts.filter((part) => part.turret);
  const barrels = parts.filter((part) => part.top === amber);
  // Barrel tips: the midpoint of each barrel's far edge, at mid height.
  const muzzles = barrels.map(({ plan, z0, z1 }): Point => {
    const [a, b] = [plan[2]!, plan[3]!];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (z0 + z1) / 2];
  });
  // The head sits on the fixed collar.
  const top = parts.map((part) => (part.top === turretTop ? { ...part, z0: mount } : part));
  return {
    name: "retaliator",
    title: "Retaliator",
    frame: source.frame,
    source: "enemies",
    hullTop: deck,
    hull: source.parts.filter((part) => !part.turret),
    sizeRatio: 2,
    hardpoints: [
      {
        id: "turret",
        offset: [0, 0],
        model: {
          role: "turret",
          z: deck,
          intact: [
            {
              plan: ring(0, 0, 7.5, 8, Math.PI / 8),
              z0: deck,
              z1: mount,
              top: turretTop,
              side: coralRear,
            },
          ],
          top: { name: "turret", z: mount, parts: top, muzzles },
        },
      },
    ],
  };
}

export const heavies: HeavyCraft[] = [frigate, capital];

// ---------------------------------------------------------------- offsets input

const ROLES: readonly Role[] = ["command", "engine", "turret"];
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// Validates a parsed tools/enemy-hardpoints.json; throws on the first problem.
export function readOffsets(value: unknown): Offsets {
  const root = value as Partial<Offsets> | null;
  if (!root || root.version !== 1 || typeof root.archetypes !== "object" || !root.archetypes) {
    throw new Error("offsets: expected { version: 1, archetypes: { ... } }");
  }
  for (const [name, craft] of Object.entries(root.archetypes)) {
    if (!finite(craft.sizeRatio) || craft.sizeRatio <= 0 || !Array.isArray(craft.hardpoints)) {
      throw new Error(`offsets: ${name} needs a positive sizeRatio and a hardpoints list`);
    }
    for (const { id, offset, order, role } of craft.hardpoints) {
      const point = Array.isArray(offset) && offset.length === 2 && offset.every(finite);
      if (typeof id !== "string" || !ROLES.includes(role) || !point || !finite(order)) {
        throw new Error(`offsets: ${name} hardpoint ${String(id)} needs id, role, offset, order`);
      }
    }
  }
  return { version: 1, archetypes: root.archetypes };
}

// Catalog offset (fractions of hull width, -y forward, +x starboard) to plan model units.
export function planOffset(sizeRatio: number, [x, y]: readonly [number, number]): [number, number] {
  const width = sizeRatio * ADA_WIDTH;
  return [x * width, y * width];
}

export type Placed = { id: string; model: Model; origin: [number, number] };

// Each art hardpoint at its origin, in Art's order. Every hardpoint the catalog export lists for
// the craft must exist in Art with the same role and offset, and the export's size ratio must
// match; Art's mounts the export does not list yet are kept.
export function place(input: Offsets, craft: HeavyCraft): Placed[] {
  const entry = input.archetypes[craft.name];
  if (entry && entry.sizeRatio !== craft.sizeRatio) {
    throw new Error(`offsets: ${craft.name} sizeRatio ${entry.sizeRatio}, art ${craft.sizeRatio}`);
  }
  for (const { id, offset, role } of entry?.hardpoints ?? []) {
    const art = craft.hardpoints.find((hardpoint) => hardpoint.id === id);
    if (!art) {
      throw new Error(`offsets: ${craft.name} hardpoint ${id} is not in the art`);
    }
    if (role !== art.model.role) {
      throw new Error(`offsets: ${craft.name} ${id} is ${role}, art draws ${art.model.role}`);
    }
    if (offset[0] !== art.offset[0] || offset[1] !== art.offset[1]) {
      throw new Error(`offsets: ${craft.name} ${id} at ${offset.join()}, art ${art.offset.join()}`);
    }
  }
  return craft.hardpoints.map(({ id, model, offset }) => ({
    id,
    model,
    origin: planOffset(craft.sizeRatio, offset),
  }));
}

// ---------------------------------------------------------------- projection and order

// Frame px of a point relative to its pivot (0, 0, pivotZ), after rotation to `yaw`.
export function relative(yaw: number, pivotZ: number, point: Point): [number, number] {
  const [x, y] = projectAt(0, pivotZ, rotate(ENEMY_HEADINGS, yaw, point));
  return [round(x), round(y)];
}

// Hull frame px of a hardpoint's origin at height z.
export function hardpointAnchor(
  frame: number,
  yaw: number,
  origin: readonly [number, number],
  z: number,
): [number, number] {
  return anchor(ENEMY_HEADINGS, frame / 2, yaw, [origin[0], origin[1], z]);
}

export function states(model: Model): State[] {
  return model.destroyed ? ["intact", "destroyed"] : ["intact"];
}

// Every sprite state a hardpoint draws: its states, then its capped plate.
function spriteStates(model: Model): SpriteState[] {
  return [...states(model), ...(model.capped ? (["capped"] as const) : [])];
}

const stateParts = (model: Model, state: SpriteState): HeavyPart[] =>
  state === "intact" ? model.intact : state === "destroyed" ? model.destroyed! : model.capped!;

// The top designs a hardpoint can carry: its own, or its tiers' weapons'.
function topsOf(craft: HeavyCraft, id: string, model: Model): Top[] {
  if (model.top) return [model.top];
  const kinds = (craft.mounts?.tiers ?? []).map((tier) => tier.mounts[id] ?? null);
  return kinds.flatMap((kind) => (kind ? [craft.mounts!.weapons[kind]!.top] : []));
}

// The pivot height of a hardpoint's tops; every top a mount carries shares it.
function topZ(craft: HeavyCraft, id: string, model: Model): number | undefined {
  const zs = new Set(topsOf(craft, id, model).map(({ z }) => z));
  if (zs.size > 1) throw new Error(`${craft.name} ${id}: tops at different heights`);
  return [...zs][0];
}

// The one top a hardpoint carries at every tier, or null when it varies or can be capped.
function fixedTop(craft: HeavyCraft, id: string, model: Model): string | null {
  if (model.top) return model.top.name;
  const kinds = (craft.mounts?.tiers ?? []).map((tier) => tier.mounts[id] ?? null);
  const names = new Set(kinds.map((kind) => (kind ? craft.mounts!.weapons[kind]!.top.name : null)));
  return names.size === 1 && !names.has(null) ? [...names][0]! : null;
}

// Layer order for one heading: hardpoints whose intact base rests on the hull top draw after the
// hull; the others sort with the hull far to near. Ties draw the lower base first, then by id.
export function layerOrder(yaw: number, craft: HeavyCraft, placed: readonly Placed[]): string[] {
  const slab = craft.hull[0]!;
  const hull = {
    id: "hull",
    above: false,
    depth: depth(
      slab.plan.map(([x, y]) => rotate(ENEMY_HEADINGS, yaw, [x, y, (slab.z0 + slab.z1) / 2])),
    ),
    base: slab.z0,
  };
  const layers = placed.map(({ id, model, origin: [x, y] }) => {
    const base = Math.min(...model.intact.map(({ z0 }) => z0));
    return {
      id,
      above: base >= craft.hullTop,
      depth: depth([rotate(ENEMY_HEADINGS, yaw, [x, y, model.z])]),
      base,
    };
  });
  return [hull, ...layers]
    .toSorted(
      (a, b) =>
        Number(a.above) - Number(b.above) ||
        b.depth - a.depth ||
        a.base - b.base ||
        a.id.localeCompare(b.id),
    )
    .map(({ id }) => id);
}

// Part order within one sprite: the shared rule, with each hosted part straight after its host.
export function partOrder(yaw: number, hullTop: number, parts: readonly HeavyPart[]): HeavyPart[] {
  const loose = parts.filter((part) => part.on === undefined);
  const sorted = drawOrder(yaw, hullTop, loose) as HeavyPart[];
  return sorted.flatMap((part) => [
    part,
    ...parts.filter((decal) => part.key !== undefined && decal.on === part.key),
  ]);
}

const translate = (origin: readonly [number, number], parts: readonly HeavyPart[]): HeavyPart[] =>
  parts.map((part) => ({ ...part, plan: shift(origin[0], origin[1], part.plan) }));

// Square frame px, a multiple of 8, holding every face around the pivot (0, 0, pivotZ).
export function spriteSize(pivotZ: number, sets: readonly (readonly Face[])[]): number {
  let extent = 0;
  for (const set of sets) {
    for (const { points } of set) {
      for (const point of points) {
        const [x, y] = projectAt(0, pivotZ, point);
        extent = Math.max(extent, Math.abs(x), Math.abs(y));
      }
    }
  }
  return Math.ceil((2 * extent + 2) / 8) * 8;
}

// A sprite's faces as fills in frame px, rounded as the SVG writes them.
function fills(size: number, pivotZ: number, list: readonly Face[]): Fill[] {
  const c = size / 2;
  return list.map(({ color, points }) => ({
    color,
    points: points.map((point) => {
      const [x, y] = projectAt(c, c + pivotZ, point);
      return [Number(x.toFixed(2)), Number(y.toFixed(2))] as V2;
    }),
  }));
}

// `tips` fill notch tips under the faces, as the drawn silhouette cuts them.
function svg(size: number, title: string, list: readonly Fill[], tips: readonly Fill[]): string {
  const polygons = [...tips, ...list].map(({ color, points }) => {
    const projected = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);
    return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
  });
  // The viewBox stays in frame px; the intrinsic size is the display size, so browsers
  // rasterize the frame at the size it is drawn.
  const display = size * DISPLAY_SCALE;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${display}" height="${display}" viewBox="0 0 ${size} ${size}">`,
    `  <title>${title}</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------- export

const yaws = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => yaw);

// Douglas-Peucker tolerances for the drawn silhouettes, in frame px: each sprite takes the first
// that passes the checks. Only the destroyed deck turret stump at heading 7, whose ragged scorch
// paint the cell grid quantizes, needs 0.3.
const SILHOUETTE_TOLERANCES = [0.4, 0.3];

// One sprite drawn and traced: the SVG and its drawn silhouette in sprite frame px.
function sprite(
  id: string,
  size: number,
  pivotZ: number,
  list: readonly Face[],
): { svg: string; collision: V2[][] } {
  const drawn = fills(size, pivotZ, list);
  const { collision, tips } = traceFills(id, drawn, [size, size], SILHOUETTE_TOLERANCES);
  return { collision, svg: svg(size, id, drawn, tips) };
}

// Parts moved by (dx, dy) and rounded to 0.01 frame px, still strictly convex.
function offset(id: string, dx: number, dy: number, parts: readonly V2[][]): V2[][] {
  const moved = parts.map((part) =>
    part.map(
      ([x, y]) => [Math.round((x + dx) * 100) / 100, Math.round((y + dy) * 100) / 100] as V2,
    ),
  );
  if (!moved.every(strictlyConvex)) throw new Error(`${id}: an offset part is not convex`);
  return moved;
}

// Drawn silhouettes for the hardpoints file: the hull layer per heading in hull frame px, each
// hardpoint base per heading and state in hull frame px, and each top per aim relative to its
// pivot.
export type Collision = {
  hull: V2[][][];
  bases: Map<string, Partial<Record<SpriteState, V2[][][]>>>;
  tops: Map<string, V2[][][]>;
};

type Entry = Record<string, unknown> & { id: string };

// Every file for one craft (name to content) and its manifest entries.
export function build(
  craft: HeavyCraft,
  placed: readonly Placed[],
): { files: Map<string, string>; entries: Entry[] } {
  const { frame, hullTop, name, title } = craft;
  const files = new Map<string, string>();
  const entries: Entry[] = [];
  const collision: Collision = { bases: new Map(), hull: [], tops: new Map() };
  const entry = (file: string, size: number, fields: Record<string, unknown>) => {
    const display = size * DISPLAY_SCALE;
    entries.push({
      id: `enemy-${file}`,
      path: `/art/enemies/${file}.svg`,
      width: size,
      height: size,
      displayWidth: display,
      displayHeight: display,
      ...fields,
      pivot: { x: 0.5, y: 0.5 },
      archetype: name,
    });
  };

  if (craft.source === "heavies") {
    for (const yaw of yaws) {
      const list = drawOrder(yaw, hullTop, craft.hull).flatMap((part) => faces(yaw, part));
      const hull = sprite(`${title} ${yaw} idle`, frame, 0, list);
      files.set(`${name}-${yaw}.svg`, hull.svg);
      collision.hull.push(hull.collision);
    }
    if (craft.fixed) collision.hull = yaws.map(() => collision.hull[0]!);
    entries.push(...hullEntries(name, frame));
    files.set(
      `${name}-jets.json`,
      jetsFile(frame, (yaw) => jetMouths(frame, yaw, placed)),
    );
  }

  for (const { id, model, origin } of placed) {
    // Base sprites render in hull coordinates so shading matches the composed frame exactly.
    const pivot = (yaw: number) => rotate(ENEMY_HEADINGS, yaw, [origin[0], origin[1], model.z]);
    const lists = spriteStates(model).map((state) => {
      const parts = translate(origin, stateParts(model, state));
      return {
        state,
        byYaw: yaws.map((yaw) =>
          partOrder(yaw, hullTop, parts)
            .flatMap((part) => faces(yaw, part))
            .map(({ color, points }) => ({
              color,
              points: points.map((p) => minus(p, pivot(yaw))),
            })),
        ),
      };
    });
    const size = spriteSize(
      0,
      lists.flatMap(({ byYaw }) => byYaw),
    );
    const bases: Partial<Record<SpriteState, V2[][][]>> = {};
    for (const { byYaw, state } of lists) {
      bases[state] = [];
      for (const yaw of yaws) {
        const file = `${name}-${id}-${state}-${yaw}`;
        const base = sprite(`${title} ${id} ${state} ${yaw}`, size, 0, byYaw[yaw]!);
        files.set(`${file}.svg`, base.svg);
        // The sprite centre sits on the anchor in the hull frame.
        const [ax, ay] = hardpointAnchor(frame, yaw, origin, model.z);
        bases[state].push(offset(file, ax - size / 2, ay - size / 2, base.collision));
        entry(file, size, { facing: `world-${yaw}`, directionIndex: yaw, hardpoint: id, state });
      }
    }
    collision.bases.set(id, bases);
  }

  for (const top of sharedTops(craft, placed)) {
    const byAim = yaws.map((aim) =>
      partOrder(aim, hullTop, top.parts).flatMap((part) => faces(aim, part)),
    );
    const topSize = spriteSize(top.z, byAim);
    const traced: V2[][][] = [];
    for (const aim of yaws) {
      const file = `${name}-${top.name}-top-${aim}`;
      const drawn = sprite(`${title} ${top.name} top ${aim}`, topSize, top.z, byAim[aim]!);
      files.set(`${file}.svg`, drawn.svg);
      // The pivot is the sprite centre.
      traced.push(offset(file, -topSize / 2, -topSize / 2, drawn.collision));
      entry(file, topSize, { facing: `world-${aim}`, aimIndex: aim, top: top.name });
    }
    collision.tops.set(top.name, traced);
  }

  files.set(`${name}-hardpoints.json`, hardpointsFile(craft, placed, collision));
  return { files, entries };
}

const minus = ([x, y, z]: Point, [px, py, pz]: Point): Point => [x - px, y - py, z - pz];

// One entry per top design, in first-use order (hardpoints, then tiers); designs sharing a name
// must be identical.
export function sharedTops(craft: HeavyCraft, placed: readonly Placed[]): Top[] {
  const tops = new Map<string, Top>();
  for (const { id, model } of placed) {
    for (const top of topsOf(craft, id, model)) {
      const seen = tops.get(top.name);
      if (seen && JSON.stringify(seen) !== JSON.stringify(top)) {
        throw new Error(`${craft.name} ${id}: top ${top.name} differs from its shared design`);
      }
      tops.set(top.name, top);
    }
  }
  return [...tops.values()];
}

// The Disabled banner's centre in hull frame px: the pivot x and the centre y of the hull
// layer's drawn bounds at that heading.
function banner(frame: number, hull: readonly V2[][] | undefined): [number, number] | undefined {
  if (!hull) return undefined;
  const ys = hull.flat().map(([, y]) => y);
  return [frame / 2, Math.round(((Math.min(...ys) + Math.max(...ys)) / 2) * 100) / 100];
}

// Engine jet mouths for one heading, each tagged with its engine hardpoint.
export function jetMouths(frame: number, yaw: number, placed: readonly Placed[]): JetMouth[] {
  return placed.flatMap(({ id, model, origin: [ox, oy] }) =>
    (model.jets?.mouths ?? []).map(([x, y]) => ({
      anchor: anchor(ENEMY_HEADINGS, frame / 2, yaw, [ox + x, oy + y, model.jets!.z]),
      axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
      half: vector(ENEMY_HEADINGS, yaw, [-model.jets!.width / 2, 0, 0]),
      hardpoint: id,
    })),
  );
}

// `{craft}-hardpoints.json` version 1: ids, per-heading anchors, pivots and layer order, and
// per-aim muzzles relative to each shared top's pivot. `collision` adds the drawn silhouettes:
// the hull's and each base's per heading, and each top's per aim.
export function hardpointsFile(
  craft: HeavyCraft,
  placed: readonly Placed[],
  collision?: Collision,
): string {
  return json({
    version: 1,
    archetype: craft.name,
    frame: craft.frame,
    hardpoints: placed.map(({ id, model }) => ({
      id,
      role: model.role,
      states: states(model),
      top: fixedTop(craft, id, model),
      ...(craft.mounts ? { capped: model.capped !== undefined } : {}),
    })),
    ...(craft.mounts
      ? {
          fill: craft.mounts.fill,
          tiers: craft.mounts.tiers.map(({ mounts, positions }) => ({
            positions,
            mounts: Object.fromEntries(
              craft.mounts!.fill.map((id) => {
                const kind = mounts[id] ?? null;
                const weapon = kind ? craft.mounts!.weapons[kind]! : undefined;
                return [
                  id,
                  weapon ? { weapon: kind, top: weapon.top.name, aim: weapon.aim } : null,
                ];
              }),
            ),
          })),
        }
      : {}),
    headings: yaws.map((yaw) => ({
      index: yaw,
      order: layerOrder(yaw, craft, placed),
      hardpoints: placed.map(({ id, model, origin }) => {
        const bases = collision?.bases.get(id);
        const z = topZ(craft, id, model);
        return {
          id,
          anchor: hardpointAnchor(craft.frame, yaw, origin, model.z),
          ...(z === undefined ? {} : { pivot: hardpointAnchor(craft.frame, yaw, origin, z) }),
          ...(bases
            ? {
                collision: Object.fromEntries(
                  spriteStates(model).map((state) => [state, bases[state]![yaw]!]),
                ),
              }
            : {}),
        };
      }),
      ...(collision?.hull[yaw] ? { collision: collision.hull[yaw] } : {}),
      ...(collision?.hull[yaw] ? { banner: banner(craft.frame, collision.hull[yaw]) } : {}),
    })),
    tops: Object.fromEntries(
      sharedTops(craft, placed).map((top) => [
        top.name,
        yaws.map((aim) => ({
          index: aim,
          muzzles: top.muzzles.map((muzzle) => relative(aim, top.z, muzzle)),
          ...(collision?.tops.get(top.name)
            ? { collision: collision.tops.get(top.name)![aim]! }
            : {}),
        })),
      ]),
    ),
  });
}

// The coral heavies, which Cartwheel's claim family recolours, and Gadget's own capital.
const drawn: HeavyCraft[] = [...heavies, gadget];

// Manifest ids this tool owns: every `enemy-{craft}-` entry of the crafts it draws.
const owns = (id: string) => drawn.some(({ name }) => id.startsWith(`enemy-${name}-`));

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const at = args.indexOf(name);
    return at === -1 ? undefined : args[at + 1];
  };
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const offsetsPath = flag("--offsets") ?? `${root}tools/enemy-hardpoints.json`;
  const out = flag("--out");
  const offsets = readOffsets(JSON.parse(readFileSync(offsetsPath, "utf8")));
  const dir = out === undefined ? `${root}public/art/enemies/` : `${out}/`;
  // Every craft is placed before anything is written, so a mismatch writes nothing.
  const results = drawn.map((craft) => build(craft, place(offsets, craft)));
  mkdirSync(dir, { recursive: true });
  const entries: Entry[] = [];
  for (const result of results) {
    for (const [file, content] of result.files) {
      const path = `${dir}${file}`;
      // JSON goes through the project's Prettier settings so the files stay Prettier-clean.
      const text = file.endsWith(".json")
        ? await format(content, { ...(await resolveConfig(path)), filepath: path })
        : content;
      writeFileSync(path, text);
    }
    entries.push(...result.entries);
  }
  if (out === undefined) {
    replaceEntries("core", owns, entries);
  } else {
    writeFileSync(`${dir}manifest-entries.json`, json(entries));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
