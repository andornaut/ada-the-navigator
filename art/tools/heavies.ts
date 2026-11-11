// Galaxy one heavies (frigate and capital): hull frames, per-hardpoint state sprites, shared
// aimed turret tops, `{craft}-hardpoints.json` and `{craft}-jets.json`. Hardpoint positions come
// only from Gameplay's catalog export, tools/enemy-hardpoints.json; each hardpoint model is drawn
// around its own origin. Contract: art/heavies.md.
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
  top?: { name: string; z: number; parts: HeavyPart[]; muzzles: Point[] };
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
  hardpoints: { id: string; model: Model }[];
};

// Offsets input: tools/enemy-hardpoints.json, which Tech exports from Gameplay's catalog.
// `offset` is [x, y] in fractions of hull width; `order` is the catalog order.
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

// A deck turret: a fixed collar and an aimed top (head, amber barrels, hatch). Destroyed: a low
// scorched stump with a breach, no top.
function turret(name: string, r: number, deck: number, barrels: 1 | 2): Model {
  const mount = deck + 1.5;
  const crown = deck + 4;
  const head: Plan = [
    [-r, -r * 0.35],
    [-r * 0.45, -r],
    [r * 0.45, -r],
    [r, -r * 0.35],
    [r, r * 0.55],
    [r * 0.5, r],
    [-r * 0.5, r],
    [-r, r * 0.55],
  ];
  const offsets = barrels === 2 ? [-r * 0.36, r * 0.36] : [0];
  const w = barrels === 2 ? r * 0.22 : r * 0.32;
  const length = barrels === 2 ? r * 2.5 : r * 2.8;
  const collar = ring(0, 0, r * 0.85, 8, Math.PI / 8);
  const stump = { key: "stump", z: deck + 1.6 };
  return {
    role: "turret",
    z: deck,
    intact: [{ plan: collar, z0: deck, z1: mount, top: turretTop, side: coralRear }],
    destroyed: [
      { plan: collar, z0: deck, z1: stump.z, top: scorch, side: scorchSide, key: stump.key },
      ...wreck(0, 0, r, deck, stump, true),
    ],
    top: {
      name,
      z: mount,
      parts: [
        { plan: head, z0: mount, z1: crown, top: turretTop, side: coralRear, key: "head" },
        ...offsets.map((dx): HeavyPart => ({
          plan: box(dx - w, -length, dx + w, -r * 0.4),
          z0: crown - 2,
          z1: crown + 0.6,
          top: amber,
          side: amberSide,
        })),
        // The hatch on the turret top reads the aim at small sizes.
        {
          plan: box(-r * 0.3, r * 0.15, r * 0.3, r * 0.6),
          z0: crown,
          z1: crown,
          top: visor,
          side: visor,
          on: "head",
        },
      ],
      muzzles: offsets.map((dx): Point => [dx, -length, crown - 0.7]),
    },
  };
}

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
    // Salvage plates: a dorsal spine ahead of the engine block and two sponson patches.
    { plan: box(-8, -6, 8, 32), z0: FRIGATE_Z, z1: FRIGATE_Z + 1.5, top: plate, side: coralSide },
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
    ...insignia(0, -36, 9, FRIGATE_Z),
  ],
  hardpoints: [
    { id: "engine", model: frigateEngine },
    { id: "port", model: turret("gun", 12, FRIGATE_Z, 1) },
    { id: "starboard", model: turret("gun", 12, FRIGATE_Z, 1) },
  ],
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
function nacelle(port: boolean): Model {
  const side = (plan: Plan) => (port ? flipX(plan) : plan);
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
    jets: { mouths: [[0, 30]], width: 12, z: 6 },
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
  hardpoints: [
    { id: "command", model: command },
    { id: "engine-left", model: nacelle(true) },
    { id: "engine-right", model: nacelle(false) },
    // Bolt and missile turrets share one design and one top set.
    ...["weapon-left", "weapon-right", "weapon-rear-left", "weapon-rear-right"].map((id) => ({
      id,
      model: turret("turret", 12, CAPITAL_Z, 2),
    })),
  ],
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
    hardpoints: [
      {
        id: "turret",
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

// Each art hardpoint at its catalog origin, in catalog order. Ids and roles must match exactly.
export function place(input: Offsets, craft: HeavyCraft): Placed[] {
  const entry = input.archetypes[craft.name];
  if (!entry) {
    throw new Error(`offsets: no ${craft.name} entry`);
  }
  const art = craft.hardpoints.map(({ id }) => id).toSorted();
  const given = entry.hardpoints.map(({ id }) => id).toSorted();
  if (art.join() !== given.join()) {
    throw new Error(
      `offsets: ${craft.name} hardpoints ${given.join()} differ from art ${art.join()}`,
    );
  }
  return entry.hardpoints
    .toSorted((a, b) => a.order - b.order)
    .map(({ id, offset, role }) => {
      const { model } = craft.hardpoints.find((hardpoint) => hardpoint.id === id)!;
      if (role !== model.role) {
        throw new Error(`offsets: ${craft.name} ${id} is ${role}, art draws ${model.role}`);
      }
      return { id, model, origin: planOffset(entry.sizeRatio, offset) };
    });
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

function svg(size: number, pivotZ: number, title: string, list: readonly Face[]): string {
  const c = size / 2;
  const polygons = list.map(({ color, points }) => {
    const projected = points.map((point) => {
      const [x, y] = projectAt(c, c + pivotZ, point);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
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

type Entry = Record<string, unknown> & { id: string };

// Every file for one craft (name to content) and its manifest entries.
export function build(
  craft: HeavyCraft,
  placed: readonly Placed[],
): { files: Map<string, string>; entries: Entry[] } {
  const { frame, hullTop, name, title } = craft;
  const files = new Map<string, string>();
  const entries: Entry[] = [];
  const sprite = (file: string, size: number, fields: Record<string, unknown>) => {
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
      files.set(`${name}-${yaw}.svg`, svg(frame, 0, `${title} ${yaw} idle`, list));
    }
    entries.push(...hullEntries(name, frame));
    files.set(
      `${name}-jets.json`,
      jetsFile(frame, (yaw) => jetMouths(frame, yaw, placed)),
    );
  }

  for (const { id, model, origin } of placed) {
    // Base sprites render in hull coordinates so shading matches the composed frame exactly.
    const pivot = (yaw: number) => rotate(ENEMY_HEADINGS, yaw, [origin[0], origin[1], model.z]);
    const lists = states(model).map((state) => {
      const parts = translate(origin, state === "intact" ? model.intact : model.destroyed!);
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
    for (const { byYaw, state } of lists) {
      for (const yaw of yaws) {
        const file = `${name}-${id}-${state}-${yaw}`;
        files.set(`${file}.svg`, svg(size, 0, `${title} ${id} ${state} ${yaw}`, byYaw[yaw]!));
        sprite(file, size, { facing: `world-${yaw}`, directionIndex: yaw, hardpoint: id, state });
      }
    }
  }

  for (const top of sharedTops(craft.name, placed)) {
    const byAim = yaws.map((aim) =>
      partOrder(aim, hullTop, top.parts).flatMap((part) => faces(aim, part)),
    );
    const topSize = spriteSize(top.z, byAim);
    for (const aim of yaws) {
      const file = `${name}-${top.name}-top-${aim}`;
      files.set(`${file}.svg`, svg(topSize, top.z, `${title} ${top.name} top ${aim}`, byAim[aim]!));
      sprite(file, topSize, { facing: `world-${aim}`, aimIndex: aim, top: top.name });
    }
  }

  files.set(`${name}-hardpoints.json`, hardpointsFile(craft, placed));
  return { files, entries };
}

const minus = ([x, y, z]: Point, [px, py, pz]: Point): Point => [x - px, y - py, z - pz];

// One entry per top design, in first-use order; designs sharing a name must be identical.
export function sharedTops(craft: string, placed: readonly Placed[]): NonNullable<Model["top"]>[] {
  const tops = new Map<string, NonNullable<Model["top"]>>();
  for (const { id, model } of placed) {
    if (!model.top) {
      continue;
    }
    const seen = tops.get(model.top.name);
    if (seen && JSON.stringify(seen) !== JSON.stringify(model.top)) {
      throw new Error(`${craft} ${id}: top ${model.top.name} differs from its shared design`);
    }
    tops.set(model.top.name, model.top);
  }
  return [...tops.values()];
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
// per-aim muzzles relative to each shared top's pivot.
export function hardpointsFile(craft: HeavyCraft, placed: readonly Placed[]): string {
  return json({
    version: 1,
    archetype: craft.name,
    frame: craft.frame,
    hardpoints: placed.map(({ id, model }) => ({
      id,
      role: model.role,
      states: states(model),
      top: model.top?.name ?? null,
    })),
    headings: yaws.map((yaw) => ({
      index: yaw,
      order: layerOrder(yaw, craft, placed),
      hardpoints: placed.map(({ id, model, origin }) => ({
        id,
        anchor: hardpointAnchor(craft.frame, yaw, origin, model.z),
        ...(model.top ? { pivot: hardpointAnchor(craft.frame, yaw, origin, model.top.z) } : {}),
      })),
    })),
    tops: Object.fromEntries(
      sharedTops(craft.name, placed).map((top) => [
        top.name,
        yaws.map((aim) => ({
          index: aim,
          muzzles: top.muzzles.map((muzzle) => relative(aim, top.z, muzzle)),
        })),
      ]),
    ),
  });
}

// Manifest ids this tool owns: every `enemy-{craft}-` entry of the crafts it draws.
const owns = (id: string) => heavies.some(({ name }) => id.startsWith(`enemy-${name}-`));

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
  const results = heavies.map((craft) => build(craft, place(offsets, craft)));
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
    replaceEntries(owns, entries);
  } else {
    writeFileSync(`${dir}manifest-entries.json`, json(entries));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
