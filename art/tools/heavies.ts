// Heavies (frigate, capital and Archie's capital): hull frames, per-hardpoint state sprites and
// capped plates, shared aimed turret tops, `{craft}-hardpoints.json` with the mount tiers and
// `{craft}-jets.json`. Art's layout holds every hardpoint and weapon mount position; the catalog
// export, tools/enemy-hardpoints.json, must agree wherever it lists one. Each hardpoint model is
// drawn around its own origin. Contract: art/heavies.md.
// Usage: node art/tools/heavies.ts [--offsets <file.json>] [--out <dir>]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";
import { format, resolveConfig } from "prettier";

import {
  HEAVY_SIGNATURES,
  HOSTILE_STATION_SIGNATURE,
  PLATFORM_SIGNATURE,
  hostileStationSignatureTiers,
  platformSignatureTiers,
  type SignatureTier,
} from "../../src/data/enemySignatures.ts";

import {
  amber,
  amberSide,
  box,
  coral,
  coralRear,
  coralSide,
  crafts,
  industrialCrafts,
  enemyArchetype,
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
import { traceEnemyFills } from "./enemy-outline.ts";
import { restrainHeavyHull } from "./heavy-restraint.ts";
import { svgText } from "./svg-text.ts";
import { ADA_MODEL_SPAN, enemySizeRatio, normalizeHeavy, sizeReceipts } from "./enemy-size.ts";
import {
  GALAXIES,
  mergeEntries,
  mergeSidecars,
  type ManifestFile,
  readManifest,
  type SidecarKind,
  sidecarsIn,
  storedAt,
  writeOnce,
} from "./manifest.ts";
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
import { type Fill, strictlyConvex, type V2 } from "./silhouette.ts";

// Model units per Ada width, derived from the existing source wing corners.
export const ADA_WIDTH = ADA_MODEL_SPAN;

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
  | "scattershot"
  | "ringBurst"
  | "mineLayer";
export type Top = { name: string; z: number; parts: HeavyPart[]; muzzles: Point[] };
// A weapon's top design on one heavy class, and how it aims: at its target, or fixed aft of
// the hull heading.
export type Weapon = { top: Top; aim: "target" | "aft" };
// One position tier: the first `armed` mounts in fill order carry weapons; the rest are capped.
export type Tier = { positions: [number, number]; armed: number };
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
  // A fixed front Laser's shot origin around the origin, with its absolute height. It fires
  // along the hull heading only.
  muzzle?: Point;
};

export type HeavyCraft = {
  name: string;
  title: string;
  frame: number;
  // "enemies": art/tools/enemies.ts draws the hull frames and jets; this tool adds hardpoints.
  source: "heavies" | "enemies";
  // Hull parts without hardpoints, model units; the first part is the hull slab.
  hull: HeavyPart[];
  hullTop: number;
  // Hull width in Ada widths: `offset` fractions scale by it.
  sizeRatio: number;
  // Art's hardpoint layout, in output order. `offset` is [x, y] in fractions of hull width in
  // the hull's local frame (-y forward, +x starboard).
  hardpoints: { id: string; offset: [number, number]; model: Model }[];
  // The hull never turns: frame 0 is the hull layer for every heading.
  fixed?: true;
  // Weapon mounts filled by position tier: the fill order, the tiers, and each weapon a mount
  // can hold with its top. Every mount carries every weapon's top.
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

// Heavy Missile: a broad plate face over a dark launcher housing.
function rail(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 4];
  return {
    name: "rail",
    z: mount,
    parts: [
      { ...head(turretHead(r), mount, crown), top: coralRear, side: visorSide },
      {
        plan: box(-r * 0.34, -r * 1.9, r * 0.34, r * 0.5),
        z0: crown - 1,
        z1: crown + 2,
        top: plate,
        side: visorSide,
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
        top: plate,
        side: visorSide,
      },
      {
        plan: box(-r * 0.34, -r * 1.2, r * 0.34, -r * 0.95),
        z0: crown + 2,
        z1: crown + 2,
        top: coral,
        side: coral,
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

// Charged Lance: continuous bright rails flanking a dark charge crystal.
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
      { ...head(turretHead(r), mount, crown + 0.5), top: coralRear, side: visorSide },
      { plan: rail, z0: crown - 1.5, z1: crown + 1, top: plate, side: plate },
      { plan: flipX(rail), z0: crown - 1.5, z1: crown + 1, top: plate, side: plate },
      {
        plan: [
          [0, -r * 2.7],
          [r * 0.24, -r * 1.7],
          [0, -r * 0.7],
          [-r * 0.24, -r * 1.7],
        ],
        z0: crown - 1,
        z1: crown + 1.5,
        top: visor,
        side: visorSide,
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

// Mine Layer: an aft-facing hopper with two dark square cells and a recessed chute.
function hopper(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 4.5];
  return {
    name: "hopper",
    z: mount,
    parts: [
      { ...head(box(-r * 0.85, -r * 0.8, r * 0.85, r * 0.8), mount, crown), top: plate },
      {
        plan: box(-r * 0.42, r * 0.8, r * 0.42, r * 1.35),
        z0: mount,
        z1: crown - 1,
        top: visor,
        side: visorSide,
      },
      ...[-0.42, 0.42].map((x) =>
        hatch(r, crown, box((x - 0.35) * r, -0.57 * r, (x + 0.35) * r, 0.13 * r)),
      ),
    ],
    muzzles: [[0, r * 1.35, mount + 1]],
  };
}

// Scattershot point defense: a squat wedge head, wide at the front, carrying a dark fan-shaped
// breech with five short amber barrels across the forward arc, so the close spread reads before
// it fires.
function spread(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 4];
  const angles = [-0.6, -0.3, 0, 0.3, 0.6].map((d) => -Math.PI / 2 + d);
  const reach = r * 1.75;
  const arc = (radius: number) =>
    Array.from({ length: 7 }, (_, i) => {
      const a = -Math.PI / 2 - 0.75 + (i * 1.5) / 6;
      return [Math.cos(a) * radius, Math.sin(a) * radius] as const;
    });
  return {
    name: "spread",
    z: mount,
    parts: [
      head(
        [
          [-r * 0.55, r * 0.7],
          [-r * 0.9, -r * 0.45],
          [r * 0.9, -r * 0.45],
          [r * 0.55, r * 0.7],
        ],
        mount,
        crown,
      ),
      {
        plan: [...arc(r * 0.45), ...arc(r * 1.45).toReversed()],
        z0: crown - 2,
        z1: crown - 0.5,
        top: coralRear,
        side: coralRear,
      },
      ...angles.map((a): HeavyPart => ({
        plan: spoke(a, r * 0.62, reach, r * 0.12),
        z0: crown - 1.5,
        z1: crown + 0.3,
        top: amber,
        side: amberSide,
      })),
      hatch(r, crown, box(-r * 0.3, r * 0.1, r * 0.3, r * 0.5)),
    ],
    muzzles: angles.map((a): Point => [Math.cos(a) * reach, Math.sin(a) * reach, crown - 0.6]),
  };
}

// Multi-Laser: three long thin amber barrels fanned from one origin on the turret head, as the
// player glyph's three bolts fan from one point.
function triple(r: number, deck: number): Top {
  const [mount, crown] = [deck + 1.5, deck + 4];
  const angles = [-0.22, 0, 0.22].map((d) => -Math.PI / 2 + d);
  const reach = r * 2.7;
  return {
    name: "triple",
    z: mount,
    parts: [
      head(turretHead(r), mount, crown),
      ...angles.map((a): HeavyPart => ({
        plan: spoke(a, r * 0.3, reach, r * 0.12),
        z0: crown - 2,
        z1: crown + 0.6,
        top: amber,
        side: amberSide,
      })),
      hatch(r, crown),
    ],
    muzzles: angles.map((a): Point => [Math.cos(a) * reach, Math.sin(a) * reach, crown - 0.7]),
  };
}

// The weapons a heavy's mounts can hold (gameplay/ships.md "Enemy weapons"): one top per
// weapon, the same design on every mount and class, so the weapon reads from its turret.
const FRIGATE_POOL: WeaponKind[] = [
  HEAVY_SIGNATURES.frigate.weapon,
  HEAVY_SIGNATURES.frigate.remaining,
];
const CAPITAL_POOL: WeaponKind[] = [
  HEAVY_SIGNATURES.capital.lance.weapon,
  HEAVY_SIGNATURES.capital.mine.weapon,
  HEAVY_SIGNATURES.capital.remaining,
];

// The weapon table for a class: each weapon in its pool with its top and aim.
export function weapons(
  deck: number,
  pool: readonly WeaponKind[],
): Partial<Record<WeaponKind, Weapon>> {
  const aimed = (top: Top): Weapon => ({ aim: "target", top });
  const all: Record<WeaponKind, () => Weapon> = {
    laser: () => aimed(barrelTop("gun", 12, deck, 1)),
    multiLaser: () => aimed(triple(12, deck)),
    rapidMissile: () => aimed(pod(12, deck)),
    heavyMissile: () => aimed(rail(12, deck)),
    scattershot: () => aimed(spread(12, deck)),
    phaser: () => aimed(dish(12, deck)),
    chargedLance: () => aimed(lance(12, deck)),
    ringBurst: () => aimed(dome(12, deck)),
    mineLayer: () => ({ aim: "aft", top: hopper(12, deck) }),
  };
  return Object.fromEntries(pool.map((kind) => [kind, all[kind]()]));
}

// Position tiers 1-2, 3-4 and 5-6: the Heavies table's weapon count per position
// (gameplay/ships.md "Difficulty"). Which weapon each armed mount carries is the ship's own.
const tiers = (counts: readonly [number, number, number]): Tier[] =>
  (
    [
      [1, 2],
      [3, 4],
      [5, 6],
    ] as const
  ).map((positions, i) => ({
    armed: counts[i]!,
    positions: [...positions],
  }));
const FRIGATE_FILL = ["port", "starboard", "spine", "bow"];
const FRIGATE_TIERS = tiers([2, 3, 4]);
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
const CAPITAL_TIERS = tiers([4, 6, 8]);
// A mount some tier leaves unarmed carries a capped plate.
const cappable = (fill: readonly string[], tiers: readonly Tier[], id: string) =>
  tiers.some(({ armed }) => fill.indexOf(id) >= armed);

// Frigate: a wide hammerhead ahead of two outboard launch decks and a compact stern.
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
      ...[-1, 1].map((side) => {
        const facet: Plan = [
          [12, -12],
          [20, -7],
          [20, 9],
          [16, 12],
          [17, -5],
        ];
        return {
          plan: side < 0 ? flipX(facet) : facet,
          z0: FRIGATE_Z + 6,
          z1: FRIGATE_Z + 6,
          top: coralSide,
          side: coralSide,
        };
      }),
      ...[-13, 13].map((x) => ({
        plan: box(x - 5, 7, x + 5, 10),
        z0: FRIGATE_Z + 6,
        z1: FRIGATE_Z + 6,
        top: coralRear,
        side: coralRear,
      })),
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

export const frigate: HeavyCraft = normalizeHeavy({
  name: "frigate",
  title: "Frigate",
  frame: 432,
  source: "heavies",
  hullTop: FRIGATE_Z,
  hull: [
    {
      plan: mirror([
        [16, -82],
        [40, -79],
        [61, -65],
        [65, -51],
        [53, -39],
        [30, -36],
        [29, -22],
        [59, -19],
        [70, -8],
        [70, 11],
        [57, 23],
        [30, 28],
        [28, 56],
        [25, 68.5],
      ]),
      z0: 0,
      z1: FRIGATE_Z,
      top: coral,
      side: coralSide,
      rear: coralRear,
    },
    {
      plan: [
        [-60, -53],
        [-51, -66],
        [-17, -75],
        [17, -75],
        [51, -66],
        [60, -53],
        [48, -49],
        [-48, -49],
      ],
      z0: FRIGATE_Z,
      z1: FRIGATE_Z + 3,
      top: coralSide,
      side: coralRear,
      key: "hammerhead",
    },
    ...[-1, 1].flatMap((side): HeavyPart[] => {
      const facet: Plan = [
        [10, -73],
        [18, -73],
        [43, -66],
        [54, -57],
        [40, -64],
        [17, -70],
      ];
      return [
        {
          plan: side < 0 ? flipX(facet) : facet,
          z0: FRIGATE_Z + 3,
          z1: FRIGATE_Z + 3,
          on: "hammerhead",
          top: coral,
          side: coral,
        },
      ];
    }),
    // Tapered deck recesses run inward from the sponsons toward the centreline.
    ...[-1, 1].map((side): HeavyPart => {
      const recess: Plan = [
        [27, -12],
        [51, -14],
        [62, -5],
        [60, 7],
        [52, 13],
        [30, 17],
        [42, 10],
        [41, -5],
      ];
      return {
        plan: side < 0 ? flipX(recess) : recess,
        z0: FRIGATE_Z,
        z1: FRIGATE_Z,
        top: coralSide,
        side: coralSide,
      };
    }),
    {
      plan: box(-7, -22, 7, -12),
      z0: FRIGATE_Z,
      z1: FRIGATE_Z + 2.5,
      top: coralRear,
      side: coralSide,
    },
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
      model: mountBase(12, FRIGATE_Z, cappable(FRIGATE_FILL, FRIGATE_TIERS, id)),
    })),
  ],
  mounts: {
    fill: FRIGATE_FILL,
    tiers: FRIGATE_TIERS,
    weapons: weapons(FRIGATE_Z, FRIGATE_POOL),
  },
});

// Capital: a long armoured keel with eight turret stations and two stern nacelles.
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
function nacelle(deck: "faceted" | "plated", port: boolean, scale = 1): Model {
  const scaled = (plan: Plan): Plan => plan.map(([x, y]) => [x * scale, y * scale] as const);
  const side = (plan: Plan) => (port ? flipX(scaled(plan)) : scaled(plan));
  const z1 = 15;
  const wreckZ = 9;
  const cowling: Plan = [
    [-3, -22],
    [4, -19],
    [8, -11],
    [8, 16],
    [4, 24],
    [-5, 22],
    [-8, 14],
    [-8, -11],
  ];
  const deckFaces =
    deck === "faceted"
      ? [
          { plan: cowling, top: coralSide },
          {
            plan: [
              [-7, -11],
              [-3, -17],
              [-4, 14],
              [-6, 17],
            ] as Plan,
            top: coral,
          },
          { plan: box(-4, 16, 4, 19), top: coralRear },
        ]
      : [
          { plan: box(-7, -18, 7, 16), top: plate },
          { plan: box(-5, 20, 5, 26), top: visor },
        ];
  return {
    role: "engine",
    z: z1,
    intact: [
      { plan: side(POD), z0: 0, z1, top: coral, side: coralSide, rear: coralRear, key: "pod" },
      ...hosted(
        "pod",
        deckFaces.map(({ plan, top }) => ({
          plan: side(plan),
          z0: z1,
          z1,
          top,
          side: top,
        })),
      ),
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

export const capital: HeavyCraft = normalizeHeavy({
  name: "capital",
  title: "Capital",
  frame: 480,
  source: "heavies",
  hullTop: CAPITAL_Z,
  hull: [
    {
      plan: mirror([
        [17, -161],
        [30, -145],
        [39, -112],
        [49, -92],
        [88, -79],
        [98, -66],
        [98, -46],
        [72, -29],
        [74, -12],
        [108, 3],
        [108, 31],
        [88, 48],
        [63, 57],
        [41, 57],
        [38, 106],
        [30, 138],
        [14, 138],
        [10, 129],
      ]),
      z0: 0,
      z1: CAPITAL_Z,
      top: coralSide,
      side: coralRear,
      rear: visorSide,
    },
    {
      plan: mirror([
        [11, -154],
        [23, -142],
        [28, -114],
        [15, -103],
        [11, -30],
      ]),
      z0: CAPITAL_Z,
      z1: CAPITAL_Z + 11,
      top: coral,
      side: coralRear,
      key: "keel",
    },
    {
      plan: mirror([
        [0, -146],
        [6, -146],
        [10, -141],
        [8, -116],
        [4, -112],
        [0, -112],
      ]),
      on: "keel",
      z0: CAPITAL_Z + 11,
      z1: CAPITAL_Z + 11,
      top: plate,
      side: plate,
    },
    // Paired shoulder armour leaves the port lance collar clear at deck height.
    ...[-1, 1].map((side): HeavyPart => {
      const panel: Plan = [
        [44, -88],
        [82, -75],
        [84, -65],
        [46, -72],
      ];
      return {
        plan: side < 0 ? flipX(panel) : panel,
        z0: CAPITAL_Z,
        z1: CAPITAL_Z + 4,
        top: plate,
        side: coralRear,
      };
    }),
    {
      plan: box(-89, -60, -61, -44),
      z0: CAPITAL_Z,
      z1: CAPITAL_Z,
      top: visor,
      side: visorSide,
    },
    ...[-1, 1].map((side): HeavyPart => {
      const panel: Plan = [
        [43, 2],
        [69, 10],
        [68, 32],
        [40, 43],
      ];
      return {
        plan: side < 0 ? flipX(panel) : panel,
        z0: CAPITAL_Z,
        z1: CAPITAL_Z + 6,
        top: coral,
        side: coralRear,
      };
    }),
    // Stern rails frame the aft deck and leave a clear channel behind the starboard hopper.
    ...[-35, 29].map((x): HeavyPart => ({
      plan: box(x, 79, x + 6, 116),
      z0: CAPITAL_Z,
      z1: CAPITAL_Z + 6,
      top: coral,
      side: coralRear,
    })),
    {
      plan: [
        [16, 73],
        [24, 73],
        [27, 83],
        [24, 120],
        [19, 129],
        [12, 122],
        [13, 84],
      ],
      key: "mine-recess",
      z0: CAPITAL_Z,
      z1: CAPITAL_Z,
      top: coralRear,
      side: coralRear,
    },
  ],
  sizeRatio: 5,
  // Weapons fill pairs: shoulders, wings, forward deck, stern deck.
  hardpoints: [
    { id: "command", offset: [0, 0], model: command },
    { id: "engine-left", offset: [-0.25, 0.4], model: nacelle("faceted", true) },
    { id: "engine-right", offset: [0.25, 0.4], model: nacelle("faceted", false) },
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
    weapons: weapons(CAPITAL_Z, CAPITAL_POOL),
  },
});

// The eight capital-class weapon mounts in fill order, from the port offset of each pair.
function mounts(deck: number, pairs: readonly (readonly [number, number])[]) {
  return CAPITAL_FILL.map((id, i) => {
    const [x, y] = pairs[Math.floor(i / 2)]!;
    return {
      id,
      offset: [i % 2 === 0 ? x : -x, y] as [number, number],
      model: mountBase(12, deck, cappable(CAPITAL_FILL, CAPITAL_TIERS, id)),
    };
  });
}

// Archie: Admiral Archie's own capital in Phantom. A serrated claw hull with a raised dorsal
// ridge; the command tower carries two stepped ear fins. The capital's mounts and tiers.
const ARCHIE_Z = 12;
const ARCHIE_TOWER: Plan = [
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
const archieCommand: Model = (() => {
  const top = ARCHIE_Z + 16;
  const wreckTop = ARCHIE_Z + 9;
  return {
    role: "command",
    z: top,
    intact: [
      {
        plan: ARCHIE_TOWER,
        z0: ARCHIE_Z,
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
        plan: ARCHIE_TOWER,
        z0: ARCHIE_Z,
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
      ...wreck(-6, 4, 10, ARCHIE_Z, { key: "wreck", z: wreckTop }, true),
    ],
  };
})();

// A fixed front Laser's flush port on a prong: a bright emitter panel in a thin dark rim on the
// deck, its forward face the emitter. Destroyed: a scorched stump with a breach and one ember, as
// a destroyed mount.
const archiePort: Model = (() => {
  const rim = { key: "port", z: ARCHIE_Z + 1.2 };
  const stump = { key: "stump", z: ARCHIE_Z + 0.5 };
  return {
    role: "turret",
    z: ARCHIE_Z,
    intact: [
      {
        plan: box(-5, -6, 5, 6),
        z0: ARCHIE_Z,
        z1: rim.z,
        top: visor,
        side: visorSide,
        key: rim.key,
      },
      {
        plan: box(-3.6, -6.4, 3.6, 4.6),
        z0: ARCHIE_Z + 0.3,
        z1: ARCHIE_Z + 1.4,
        top: amber,
        side: amberSide,
        on: rim.key,
      },
    ],
    destroyed: [
      {
        plan: box(-5, -6, 5, 4),
        z0: ARCHIE_Z,
        z1: stump.z,
        top: scorch,
        side: scorchSide,
        key: stump.key,
      },
      ...wreck(0, -1, 4.5, ARCHIE_Z, stump, true),
    ],
    muzzle: [0, -6.4, ARCHIE_Z + 0.85],
  };
})();

export const archie: HeavyCraft = normalizeHeavy({
  name: "archie",
  title: "Archie",
  frame: 560,
  source: "heavies",
  hullTop: ARCHIE_Z,
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
      z1: ARCHIE_Z,
      top: coral,
      side: coralSide,
      rear: coralRear,
    },
    // Chamfered wing panels sit proud of the deck before the dorsal ridge.
    ...[-1, 1].map((side): HeavyPart => {
      const panel: Plan = [
        [60, 20],
        [68, 14],
        [82, 17],
        [86, 23],
        [79, 34],
        [65, 36],
      ];
      return {
        plan: side < 0 ? flipX(panel) : panel,
        z0: ARCHIE_Z,
        z1: ARCHIE_Z + 1,
        top: coral,
        side: coralSide,
      };
    }),
    { plan: box(-5, 30, 5, 78), z0: ARCHIE_Z, z1: ARCHIE_Z + 3, top: coralRear, side: coralSide },
    ...insignia(0, -36, 8, ARCHIE_Z),
  ],
  sizeRatio: 5,
  hardpoints: [
    { id: "command", offset: [0, 0], model: archieCommand },
    { id: "engine-left", offset: [-0.27, 0.44], model: nacelle("plated", true, 1.1) },
    { id: "engine-right", offset: [0.27, 0.44], model: nacelle("plated", false, 1.1) },
    ...mounts(ARCHIE_Z, [
      [-0.36, -0.3],
      [-0.44, 0.1],
      [-0.16, -0.48],
      [-0.11, 0.33],
    ]),
    // The fixed front Lasers: one port on each prong, behind its tip.
    { id: "prow-left", offset: [-0.13, -0.6], model: archiePort },
    { id: "prow-right", offset: [0.13, -0.6], model: archiePort },
  ],
  mounts: {
    fill: CAPITAL_FILL,
    tiers: CAPITAL_TIERS,
    weapons: weapons(ARCHIE_Z, CAPITAL_POOL),
  },
});

// Retaliator: its gun is the hull weapon's aim mount, not a hardpoint. Held out of the export
// until Tech supplies the mount offset; enemies.ts then draws the hull frames without the
// `turret` parts, and this top aims independently of the hull.
export function retaliatorCraft(
  source = crafts.find(({ name }) => name === "retaliator")!,
): HeavyCraft {
  const deck = source.parts[0]!.z1;
  const factor = sizeReceipts.get(
    source.variant ? `retaliator:${source.variant}` : "retaliator",
  )!.factor;
  const mount = deck + 1.5 * factor;
  const parts = source.parts.filter((part) => part.turret);
  const barrels = parts.filter((part) => part.muzzle);
  // Barrel tips: the midpoint of each barrel's far edge, at mid height.
  const muzzles = barrels.map(({ plan, z0, z1 }): Point => {
    const [a, b] = [plan[2]!, plan[3]!];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (z0 + z1) / 2];
  });
  // The head sits on the fixed collar.
  const top = parts.map((part) => (part.top === turretTop ? { ...part, z0: mount } : part));
  return {
    name: source.name,
    title: source.title,
    frame: source.frame,
    source: "enemies",
    hullTop: deck,
    hull: source.parts.filter((part) => !part.turret),
    sizeRatio: enemySizeRatio("retaliator"),
    hardpoints: [
      {
        id: "turret",
        offset: [0, 0],
        model: {
          role: "turret",
          z: deck,
          intact: [
            {
              plan: ring(0, 0, 7.5 * factor, 8, Math.PI / 8),
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
  if (!craft.mounts?.fill.includes(id)) return [];
  return Object.values(craft.mounts.weapons).map((weapon) => weapon!.top);
}

// The pivot height of a hardpoint's tops; every top a mount carries shares it.
function topZ(craft: HeavyCraft, id: string, model: Model): number | undefined {
  const zs = new Set(topsOf(craft, id, model).map(({ z }) => z));
  if (zs.size > 1) throw new Error(`${craft.name} ${id}: tops at different heights`);
  return [...zs][0];
}

// The one top a hardpoint always carries, or null: a weapon mount's top is its ship's weapon.
function fixedTop(model: Model): string | null {
  return model.top?.name ?? null;
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
function svgPolygons(fills: readonly Fill[]): string[] {
  return fills.map(({ color, points }) => {
    const projected = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);
    return `  <polygon fill="${color}" points="${projected.join(" ")}"/>`;
  });
}

function svgFrame(size: number, title: string, content: readonly string[]): string {
  // The viewBox stays in frame px; the intrinsic size is the display size, so browsers
  // rasterize the frame at the size it is drawn.
  const display = size * DISPLAY_SCALE;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${display}" height="${display}" viewBox="0 0 ${size} ${size}">`,
    `  <title>${title}</title>`,
    ...content,
    "</svg>",
    "",
  ].join("\n");
}

function svg(size: number, title: string, list: readonly Fill[], tips: readonly Fill[]): string {
  return svgFrame(size, title, svgPolygons([...tips, ...list]));
}

// ---------------------------------------------------------------- export

const yaws = Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => yaw);

// Douglas-Peucker tolerances for the drawn silhouettes, in frame px: each sprite takes the first
// that passes the checks. Only the destroyed deck turret stump at heading 7, whose ragged scorch
// paint the cell grid quantizes, needs 0.3. The small prow Laser ports take the fleet's part
// tolerances.
const SILHOUETTE_TOLERANCES = [0.4, 0.3];
const PORT_TOLERANCES = [0.4, 0.3, 0.2, 0.1];

// One sprite drawn and traced: the SVG and its drawn silhouette in sprite frame px.
function sprite(
  id: string,
  size: number,
  pivotZ: number,
  list: readonly Face[],
  tolerances: readonly number[] = SILHOUETTE_TOLERANCES,
): { svg: string; collision: V2[][] } {
  const drawn = fills(size, pivotZ, list);
  const { collision, tips } = traceEnemyFills(id, drawn, [size, size], tolerances);
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
      archetype: enemyArchetype(name),
    });
  };

  if (craft.source === "heavies") {
    for (const yaw of yaws) {
      const list = partOrder(yaw, hullTop, craft.hull).flatMap((part) => faces(yaw, part));
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
        const base = sprite(
          `${title} ${id} ${state} ${yaw}`,
          size,
          0,
          byYaw[yaw]!,
          model.muzzle ? PORT_TOLERANCES : SILHOUETTE_TOLERANCES,
        );
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

  const layout = hardpointsFile(craft, placed, collision);
  checkMounts(craft, JSON.parse(layout) as MountLayout);
  files.set(`${name}-hardpoints.json`, layout);
  return { files, entries };
}

const minus = ([x, y, z]: Point, [px, py, pz]: Point): Point => [x - px, y - py, z - pz];

// The catalog's armed mounts per position band, in fill order (gameplay/ships.md "Difficulty").
export const PLATFORM_FILL = [...PLATFORM_SIGNATURE.fill];
export const STATION_FILL = [...HOSTILE_STATION_SIGNATURE.fill];
const producerTiers = (source: readonly SignatureTier[]): Tier[] =>
  source.map(({ mounts, positions }) => ({
    positions: [...positions],
    armed: Object.values(mounts).filter((mount) => mount?.armed).length,
  }));
export const PLATFORM_TIERS = producerTiers(platformSignatureTiers());
export const STATION_TIERS = producerTiers(hostileStationSignatureTiers());
const ARMED: Readonly<Record<string, { fill: readonly string[]; tiers: readonly Tier[] }>> = {
  frigate: { fill: FRIGATE_FILL, tiers: FRIGATE_TIERS },
  capital: { fill: CAPITAL_FILL, tiers: CAPITAL_TIERS },
  archie: { fill: CAPITAL_FILL, tiers: CAPITAL_TIERS },
  platform: { fill: PLATFORM_FILL, tiers: PLATFORM_TIERS },
  hostileStation: { fill: STATION_FILL, tiers: STATION_TIERS },
};

type MountLayout = {
  weaponTops?: Record<string, { top: string; aim: string }>;
  tiers?: { positions: number[]; mounts: Record<string, { armed: true } | null> }[];
  headings: { hardpoints: { id: string; pivot?: number[] }[] }[];
  tops: Record<string, { index: number; muzzles: unknown[]; collision?: unknown[] }[]>;
};

// Fails unless a mount heavy's hardpoints file gives every pooled weapon a top with all 16 aims,
// each with a muzzle and collision; arms the catalog's mounts in fill order in each position
// band; and pivots every armed mount at every heading.
export function checkMounts(craft: HeavyCraft, layout: MountLayout): void {
  if (!craft.mounts) return;
  const fail = (why: string) => {
    throw new Error(`${craft.name} hardpoints: ${why}`);
  };
  const expected = ARMED[craft.name];
  if (!expected) fail("no catalog mount counts");
  const pool = Object.keys(craft.mounts.weapons);
  const weaponTops = layout.weaponTops ?? {};
  if (JSON.stringify(Object.keys(weaponTops)) !== JSON.stringify(pool)) fail("weaponTops != pool");
  for (const [kind, { aim, top }] of Object.entries(weaponTops)) {
    if (aim !== "target" && aim !== "aft") fail(`${kind} aim ${aim}`);
    const aims = layout.tops[top];
    if (!aims || aims.length !== ENEMY_HEADINGS) fail(`${kind} top ${top} lacks 16 aims`);
    aims!.forEach(({ collision, index, muzzles }, i) => {
      if (index !== i || !muzzles.length || !collision?.length) fail(`${top} aim ${i} incomplete`);
    });
  }
  const bands = (layout.tiers ?? []).map(({ positions }) => positions.join("-"));
  const expectedBands = expected!.tiers.map(({ positions }) => positions.join("-"));
  if (bands.join() !== expectedBands.join()) fail(`position bands ${bands.join()}`);
  if (JSON.stringify(craft.mounts.fill) !== JSON.stringify(expected!.fill)) fail("fill order");
  for (const id of expected!.fill) {
    const mount = craft.hardpoints.find((part) => part.id === id);
    if (!mount || mount.model.role !== "turret") fail(`${id} must be a weapon hardpoint`);
    const unused = expected!.tiers.some(({ armed }) => expected!.fill.indexOf(id) >= armed);
    if (unused && !mount!.model.capped) fail(`${id} lacks its unused capped state`);
  }
  if (
    (craft.name === "platform" || craft.name === "hostileStation") &&
    craft.hardpoints.some(({ model }) => model.role !== "turret")
  ) {
    fail("all parts must be weapon hardpoints");
  }
  const armedIds = new Set<string>();
  layout.tiers!.forEach(({ mounts }, i) => {
    const armed = Object.entries(mounts)
      .filter(([, mount]) => mount?.armed === true)
      .map(([id]) => id);
    if (armed.join() !== expected!.fill.slice(0, expected!.tiers[i]!.armed).join()) {
      fail(`band ${bands[i]} arms ${armed.join()}`);
    }
    armed.forEach((id) => armedIds.add(id));
  });
  for (const [k, heading] of layout.headings.entries()) {
    for (const id of armedIds) {
      const pivot = heading.hardpoints.find((part) => part.id === id)?.pivot;
      if (!pivot || pivot.length !== 2) fail(`${id} has no pivot at heading ${k}`);
    }
  }
}

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

// The drawn hull in frame px, as the fleet's hardpoints files give it: `length` fore and aft over
// the hull and its intact engines and command tower, `width` the hull's span of `sizeRatio` Ada
// widths, and `radius`, the larger of half the length and half the width.
function hullSize(craft: HeavyCraft, placed: readonly Placed[]) {
  const stations = [
    ...craft.hull.flatMap(({ plan }) => plan.map(([, y]) => y)),
    ...placed
      .filter(({ model }) => model.role !== "turret")
      .flatMap(({ model, origin }) =>
        model.intact.flatMap(({ plan }) => plan.map(([, y]) => y + origin[1])),
      ),
  ];
  const length = Math.max(...stations) - Math.min(...stations);
  const width = craft.sizeRatio * ADA_WIDTH;
  return { length: round(length), width: round(width), radius: round(Math.max(length, width) / 2) };
}

// `{craft}-hardpoints.json` version 1: the drawn hull's size, ids, each hardpoint's `offset` from
// the hull pivot in frame px (x to starboard, y aft), per-heading anchors, pivots and layer order,
// and per-aim muzzles relative to each shared top's pivot. `collision` adds the drawn
// silhouettes: the hull's and each base's per heading, and each top's per aim.
export function hardpointsFile(
  craft: HeavyCraft,
  placed: readonly Placed[],
  collision?: Collision,
): string {
  return json({
    version: 1,
    archetype: enemyArchetype(craft.name),
    frame: craft.frame,
    hull: hullSize(craft, placed),
    hardpoints: placed.map(({ id, model, origin }) => ({
      id,
      role: model.role,
      states: states(model),
      top: fixedTop(model),
      ...(model.muzzle ? { aim: "facing" } : {}),
      ...(craft.mounts ? { capped: model.capped !== undefined } : {}),
      offset: [round(origin[0]), round(origin[1])],
    })),
    ...(craft.mounts
      ? {
          fill: craft.mounts.fill,
          weaponTops: Object.fromEntries(
            Object.entries(craft.mounts.weapons).map(([kind, weapon]) => [
              kind,
              { top: weapon!.top.name, aim: weapon!.aim },
            ]),
          ),
          tiers: craft.mounts.tiers.map(({ armed, positions }) => ({
            positions,
            mounts: Object.fromEntries(
              craft.mounts!.fill.map((id, i) => [id, i < armed ? { armed: true } : null]),
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
          ...(model.muzzle
            ? {
                muzzles: [
                  hardpointAnchor(
                    craft.frame,
                    yaw,
                    [origin[0] + model.muzzle[0], origin[1] + model.muzzle[1]],
                    model.muzzle[2],
                  ),
                ],
              }
            : {}),
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

// The industrial retaliator models, which the enemy size test checks.
export const industrialHeavies = [
  retaliatorCraft(),
  ...industrialCrafts.map((source) => retaliatorCraft(source)),
];
// The enemy fleet producer (art/tools/fleet.ts) draws the frigates, capitals and retaliators; this
// tool draws Archie's own capital.
const drawn: HeavyCraft[] = [archie];

// Manifest ids this tool owns: every `enemy-{craft}-` entry of the crafts it draws.
const owns = (id: string) =>
  drawn.some(
    ({ name, source }) =>
      id.startsWith(`enemy-${name}-`) &&
      (source !== "enemies" || !new RegExp(`^enemy-${name}-\\d+$`).test(id)),
  );

// Sidecars this tool owns: every drawn craft's hardpoints, and the jets of the hulls it draws
// (enemies.ts writes the others' jets).
const ownsSidecar = (craft: string, kind: SidecarKind) =>
  drawn.some(
    ({ name, source }) =>
      name === craft && (kind === "hardpoints" || (kind === "jets" && source === "heavies")),
  );

const PART_GROUPS = { archie: 33 } as const;
type SheetCraft = keyof typeof PART_GROUPS;
type HeadingSelection = { craft: SheetCraft; section: "part" | "hull" };

// Use the checked Frigate viewport as the ceiling for hull sheet XML.
const HULL_SHEET_EDGE = 1728;

type HeavySheetTarget = { manifest: ManifestFile; prefix: string; directory: string };

const corePartTarget = {
  manifest: "core",
  prefix: "enemy-",
  directory: "/art/enemies/",
} satisfies HeavySheetTarget;

const batchSheetPrefix = (craft: SheetCraft) => `${craft}-parts-batch-`;

// Keep raw cells square and separate by size within a single family/archetype load batch.
function comparePartMembers(a: Entry, b: Entry): number {
  const left = a.id.slice(0, a.id.lastIndexOf("-"));
  const right = b.id.slice(0, b.id.lastIndexOf("-"));
  if (left !== right) return left < right ? -1 : 1;
  return Number(a.aimIndex ?? a.directionIndex) - Number(b.aimIndex ?? b.directionIndex);
}

export function heavyPartPageLayout(craft: SheetCraft, entries: readonly Entry[]) {
  const bySize = new Map<number, Entry[]>();
  for (const row of entries) {
    const width = row.width;
    if (
      typeof width !== "number" ||
      !Number.isInteger(width) ||
      width < 1 ||
      width > HULL_SHEET_EDGE ||
      row.height !== width
    ) {
      throw new Error(`Invalid ${craft} part cell: ${row.id}`);
    }
    const members = bySize.get(width) ?? [];
    members.push(row);
    bySize.set(width, members);
  }

  return [...bySize]
    .sort(([a], [b]) => a - b)
    .flatMap(([size, members]) => {
      const capacity = Math.floor(HULL_SHEET_EDGE / size) ** 2;
      members.sort(comparePartMembers);
      const pages = [];
      for (let first = 0; first < members.length; first += capacity) {
        const rows = members.slice(first, first + capacity);
        const width = Math.ceil(Math.sqrt(rows.length)) * size;
        const file = `${batchSheetPrefix(craft)}${size}-${first / capacity + 1}.svg`;
        const layout = packAtlas(
          { compare: () => 0, extrude: 0, maxSize: HULL_SHEET_EDGE, widths: [width] },
          [{ rectangles: rows.map(() => ({ width: size, height: size })), value: file }],
        )?.pages[0];
        const positions = layout?.placed[0]?.at;
        if (!layout || positions?.length !== rows.length) {
          throw new Error(`Cannot pack ${file}`);
        }
        pages.push({
          file,
          width,
          height: layout.height,
          members: rows.map((row, index) => ({ row, ...positions[index]! })),
        });
      }
      return pages;
    });
}

// Pack the canonical standalone roots after SVG formatting, as in the enemy hull sheets.
// Raw-sized cells leave room for each root's smaller intrinsic display dimensions.
function heavyHeadingSheets(
  target: HeavySheetTarget,
  selection: HeadingSelection,
  text: (file: string) => string | undefined,
  entries: readonly Entry[],
) {
  const { manifest, prefix, directory } = target;
  const { craft, section } = selection;
  const expectedGroups = selection.section === "part" ? PART_GROUPS[selection.craft] : 1;
  const part = (entry: Entry) => entry.hardpoint !== undefined || entry.top !== undefined;
  const owns = (entry: Entry) => entry.archetype === craft && part(entry) === (section === "part");
  const installed: Entry[] = readManifest(manifest).assets;
  const current = installed.filter(owns);
  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  const packed = current.filter(({ svgSheet }) => svgSheet === true).length;
  const batch =
    section === "part" &&
    installed.some(
      ({ path }) =>
        typeof path === "string" && path.startsWith(directory + batchSheetPrefix(craft)),
    );
  if (!batch && packed === 0) return undefined;

  const selected = entries.filter(owns);
  const groups = new Map<string, Entry[]>();
  for (const entry of selected) {
    const { id } = entry;
    const stem = id.slice(prefix.length);
    if (!id.startsWith(prefix) || !stem.startsWith(`${craft}-`) || !/^[\w-]+-\d+$/u.test(stem)) {
      throw new Error(`Invalid ${craft} ${section} id in ${manifest}: ${id}`);
    }
    const group = id.slice(prefix.length, id.lastIndexOf("-"));
    if (section === "hull" && group !== craft) {
      throw new Error(`Invalid ${craft} hull group in ${manifest}: ${group}`);
    }
    const members = groups.get(group) ?? [];
    members.push(entry);
    groups.set(group, members);
  }
  if (
    groups.size !== expectedGroups ||
    selected.length !== expectedGroups * ENEMY_HEADINGS ||
    current.length !== selected.length ||
    currentById.size !== current.length ||
    (packed !== 0 && packed !== selected.length)
  ) {
    throw new Error(
      `${manifest} must own ${expectedGroups} complete ${craft} ${section} groups, all standalone or all sheets`,
    );
  }

  const sheets = new Map<string, string>();
  const replacements = new Map<string, Entry>();
  const retired = new Set<string>();
  const ownedPaths = new Set<string>();
  const finish = () => {
    const manifestNames: ManifestFile[] = ["core", ...GALAXIES];
    const allAssets: Entry[] = manifestNames.flatMap((name) => readManifest(name).assets);
    const referrer = allAssets.find(
      ({ id, path }) => !replacements.has(id) && typeof path === "string" && ownedPaths.has(path),
    );
    if (referrer) {
      throw new Error(`${craft} ${section} packing would replace art used by ${referrer.id}`);
    }
    return { sheets, replacements, retired };
  };

  if (batch) {
    for (const [group, members] of groups) {
      const size = members[0]!.width;
      if (
        members.length !== ENEMY_HEADINGS ||
        members.some(
          (row, heading) =>
            row.id !== `${prefix}${group}-${heading}` ||
            (row.aimIndex ?? row.directionIndex) !== heading ||
            row.width !== size ||
            row.height !== size,
        )
      ) {
        throw new Error(`Invalid ${manifest} ${craft} part group: ${group}`);
      }
      ownedPaths.add(`${directory}${group}-sheet.svg`);
    }
    for (const page of heavyPartPageLayout(craft, selected)) {
      const path = directory + page.file;
      ownedPaths.add(path);
      const roots = page.members.map(({ row, x, y }) => {
        const file = `${row.id.slice(prefix.length)}.svg`;
        const source = text(file);
        const standalone = source?.trimEnd();
        const root = `<svg xmlns="http://www.w3.org/2000/svg" width="${row.displayWidth}" height="${row.displayHeight}" viewBox="0 0 ${row.width} ${row.height}">`;
        const replacement = { ...row, path, svgSheet: true };
        if (
          row.path !== directory + file ||
          !standalone?.startsWith(root) ||
          !standalone.endsWith("</svg>") ||
          !isDeepStrictEqual(currentById.get(row.id), replacement)
        ) {
          throw new Error(`Invalid ${manifest} ${craft} part batch selection or source: ${row.id}`);
        }
        retired.add(file);
        ownedPaths.add(directory + file);
        replacements.set(row.id, replacement);
        return `<svg id="${row.id}" x="${x}" y="${y}" ${standalone.slice("<svg ".length)}`;
      });
      const { width, height } = page;
      sheets.set(
        page.file,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${roots.join("")}</svg>\n`,
      );
    }
    return finish();
  }

  for (const [group, members] of groups) {
    const size = Number(members[0]!.width);
    const columns = section === "hull" ? Math.min(4, Math.floor(HULL_SHEET_EDGE / size)) : 4;
    if (!Number.isInteger(size) || size <= 0 || columns < 1 || members.length !== ENEMY_HEADINGS) {
      throw new Error(`Invalid ${craft} ${section} group: ${group}`);
    }
    const capacity = columns * columns;
    const wide = size * columns;
    for (let first = 0; first < members.length; first += capacity) {
      const page = members.slice(first, first + capacity);
      const layout = packAtlas({ compare: () => 0, extrude: 0, maxSize: wide, widths: [wide] }, [
        { rectangles: page.map(() => ({ width: size, height: size })), value: group },
      ])?.pages[0];
      if (!layout) throw new Error(`Cannot pack ${craft} ${section} group: ${group}`);
      const sheet =
        first === 0 ? `${group}-sheet.svg` : `${group}-sheet-${first / capacity + 1}.svg`;
      const path = directory + sheet;
      ownedPaths.add(path);
      const roots = page.map((row, index) => {
        const heading = first + index;
        const id = `${prefix}${group}-${heading}`;
        const file = `${group}-${heading}.svg`;
        const source = text(file);
        const standalone = source?.trimEnd();
        const root = `<svg xmlns="http://www.w3.org/2000/svg" width="${row.displayWidth ?? size}" height="${row.displayHeight ?? size}" viewBox="0 0 ${size} ${size}">`;
        if (
          row.id !== id ||
          (row.aimIndex ?? row.directionIndex) !== heading ||
          row.width !== size ||
          row.height !== size ||
          !standalone?.startsWith(root) ||
          !standalone.endsWith("</svg>")
        ) {
          throw new Error(`Invalid ${craft} ${section} frame: ${id}`);
        }
        const oldPath = directory + file;
        const currentRow = currentById.get(id);
        if (
          !currentRow ||
          row.path !== (row.svgSheet === true ? path : oldPath) ||
          currentRow.path !== (packed ? path : oldPath) ||
          (!packed && !isDeepStrictEqual(currentRow, row))
        ) {
          throw new Error(`${manifest} does not own the expected frame: ${id}`);
        }
        retired.add(file);
        ownedPaths.add(oldPath);
        replacements.set(id, { ...row, path, svgSheet: true });
        const { x, y } = layout.placed[0]!.at[index]!;
        return `<svg id="${id}" x="${x}" y="${y}" ${standalone.slice("<svg ".length)}`;
      });
      sheets.set(
        sheet,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${layout.height}" viewBox="0 0 ${wide} ${layout.height}">${roots.join("")}</svg>\n`,
      );
    }
  }
  return finish();
}

type HeavyPack = ReturnType<typeof heavyHeadingSheets>;

function applyHeavySheets(
  files: Map<string, string>,
  entries: readonly Entry[],
  pack: HeavyPack,
): readonly Entry[] {
  if (!pack) return entries;
  for (const file of pack.retired) files.delete(file);
  for (const [file, text] of pack.sheets) files.set(file, text);
  return entries.map((entry) => pack.replacements.get(entry.id) ?? entry);
}

/** Keep installed part and hull sheets and exclude their loose frames from an ordinary export. */
function packInstalledHeavyParts(files: Map<string, string>, entries: readonly Entry[]) {
  const text = (file: string) => files.get(file);
  const parts = heavyHeadingSheets(
    corePartTarget,
    { craft: "archie", section: "part" },
    text,
    entries,
  );
  const hull = heavyHeadingSheets(
    corePartTarget,
    { craft: "archie", section: "hull" },
    text,
    entries,
  );
  return applyHeavySheets(files, applyHeavySheets(files, entries, parts), hull);
}

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
  const results = drawn.map((craft) => {
    const styled = restrainHeavyHull(craft);
    return build(styled, place(offsets, styled));
  });
  mkdirSync(dir, { recursive: true });
  const files = new Map<string, string>();
  const entries: Entry[] = [];
  for (const result of results) {
    for (const [file, content] of result.files) {
      const path = `${dir}${file}`;
      // JSON goes through the project's Prettier settings so the files stay Prettier-clean, and SVG
      // through svgText.
      const text = file.endsWith(".json")
        ? await format(content, { ...(await resolveConfig(path)), filepath: path })
        : file.endsWith(".svg")
          ? svgText(content)
          : content;
      files.set(file, text);
    }
    entries.push(...result.entries);
  }
  if (out === undefined) {
    const outputEntries = packInstalledHeavyParts(files, entries);
    const paths = writeOnce("/art/enemies/", new Map(), files);
    mergeEntries(
      "core",
      owns,
      outputEntries.map((entry) => storedAt(paths, entry)),
    );
    mergeSidecars("core", ownsSidecar, sidecarsIn(paths));
  } else {
    for (const [file, text] of files) {
      writeFileSync(`${dir}${file}`, text);
    }
    writeFileSync(`${dir}manifest-entries.json`, json(entries));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
