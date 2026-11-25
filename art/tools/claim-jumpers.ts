// Cartwheel's claim jumper palette, the recolour from the coral family that the destruction
// producer applies to claim shards, and the turret platform model the enemy size test checks. The
// enemy fleet producer draws Cartwheel's craft and the platform's gun top, and the hostile station
// producer the platform's hull and bases. Contract: art/heavies.md (Cartwheel claim jumpers).
import { PLATFORM_SIGNATURE } from "../../src/data/enemySignatures.ts";

import {
  amber,
  amberSide,
  box,
  coral,
  coralRear,
  coralSide,
  ink,
  insignia,
  type Plan,
  plate,
  turretTop,
  visor,
  visorSide,
} from "./crafts.ts";
import { normalizeHeavy } from "./enemy-size.ts";
import {
  ADA_WIDTH,
  burn,
  ember as wreckEmber,
  type HeavyCraft,
  type HeavyPart,
  type Model,
  PLATFORM_FILL,
  PLATFORM_TIERS,
  ring,
  scorch,
  scorchSide,
  wreck,
} from "./heavies.ts";
import { isIndustrialHullColor } from "./retaliator-models.ts";

// ---------------------------------------------------------------- palette

// Rust hulls, warm steel plates, ember guns and lights. Rust is darker and yellower than coral;
// ember is far more saturated than player amber.
const claim = {
  rust: "#bd7042",
  rustSide: "#924e28",
  rustRear: "#703921",
  rustDeep: "#7d4427",
  steel: "#b5a998",
  steelSide: "#85786a",
  turretTop: "#a95e30",
  ember: "#fa6d38",
  emberSide: "#bc4524",
  visor: "#2b1d1c",
  visorSide: "#1f1514",
  // A darker soot than the coral scorch, so wrecks read on rust.
  scorch: "#452f28",
  scorchSide: "#33211b",
  burn: "#613e30",
} as const;

// Small craft: dark fighter oxide and the interceptor's bone, violet and blue.
const smallCraftSwap = {
  "#282644": "#342937",
  "#342d58": "#493a4e",
  "#35252e": "#37251e",
  "#38242f": "#3c271f",
  "#474582": "#4c4672",
  "#4b3038": "#523326",
  "#4d427d": "#554571",
  "#514575": "#5e4960",
  "#55313a": "#633927",
  "#596ccc": "#5f6aba",
  "#78443f": "#82492f",
  "#8170cc": "#8c70b0",
  "#a9d9ff": "#b4d9f2",
  "#bcaac1": "#c2adab",
  "#f1e5c9": "#eee1c6",
} satisfies Readonly<Record<`#${string}`, `#${string}`>>;

// Cool hull materials authored on the swarm and fighter.
const swarmFighterSwap = {
  "#202a44": "#26372f",
  "#233940": "#384639",
  "#263755": "#2c4038",
  "#2e4065": "#2e473f",
  "#355b63": "#53624f",
  "#374b73": "#39584d",
  "#405785": "#415e53",
  "#4c64a0": "#537263",
  "#629483": "#858b69",
  "#718bd0": "#7c9b85",
  "#d5e0eb": "#c5d9ca",
} satisfies Readonly<Record<`#${string}`, `#${string}`>>;

// Coral family colour to claim-jumper colour, applied to every drawn file.
const swap: Readonly<Record<string, string>> = {
  ...smallCraftSwap,
  ...swarmFighterSwap,
  [coral]: claim.rust,
  [coralSide]: claim.rustSide,
  [coralRear]: claim.rustRear,
  [plate]: claim.steel,
  [amber]: claim.ember,
  [amberSide]: claim.emberSide,
  [turretTop]: claim.turretTop,
  [visor]: claim.visor,
  [visorSide]: claim.visorSide,
  [scorch]: claim.scorch,
  [scorchSide]: claim.scorchSide,
  [burn]: claim.burn,
};

// Gadget's claw ink and the wreck ember stay as in the coral family.
const family = new Set<string>([
  ...Object.values(claim),
  ...Object.values(smallCraftSwap),
  ...Object.values(swarmFighterSwap),
  ink,
  wreckEmber,
]);

// Swaps every coral colour in a file through `map` and fails on any colour outside `allowed`,
// so a new coral colour cannot slip through unmapped.
function swapColours(
  map: Readonly<Record<string, string>>,
  allowed: ReadonlySet<string>,
  file: string,
  text: string,
): string {
  const result = text.replace(/#[0-9a-f]{6}\b/gi, (color) => map[color.toLowerCase()] ?? color);
  for (const color of result.match(/#[0-9a-f]{6}\b/gi) ?? []) {
    const hex = color.toLowerCase();
    if (!allowed.has(hex) && !isIndustrialHullColor(file, hex)) {
      throw new Error(`${file}: ${color} is not a claim-jumper colour`);
    }
  }
  return result;
}

// A shards file in the claim-jumper palette.
export const recolour = (file: string, text: string) => swapColours(swap, family, file, text);

// ---------------------------------------------------------------- turret platform

// The wheel is 3 Ada widths across, so the hit circle matches the size ratio.
const SIZE = 3;
const R = (SIZE * ADA_WIDTH) / 2;
const DECK = 6;
const RIM = 9.5;
const HUB = 13;
// The turret rail, inner and outer radius: every seeded facing puts both turrets on it. The dark
// track lets the steel turret heads stand off the deck.
const RAIL = [24, 50] as const;
const TEETH = 16;

// A sector of the annulus r0..r1 between angles a0..a1 (radians).
function sector(r0: number, r1: number, a0: number, a1: number, steps: number): Plan {
  const outer = Array.from({ length: steps + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / steps;
    return [r1 * Math.cos(a), r1 * Math.sin(a)] as const;
  });
  const inner = outer.map(([x, y]) => [(x * r0) / r1, (y * r0) / r1] as const).toReversed();
  return [...outer, ...inner];
}

// Steel teeth round the rim.
const teeth = Array.from({ length: TEETH }, (_, i): HeavyPart => {
  const a = (i / TEETH) * 2 * Math.PI;
  const half = (Math.PI / TEETH) * 0.62;
  return {
    plan: sector(R - 8.5, R, a - half, a + half, 2),
    z0: DECK,
    z1: RIM,
    top: claim.steel,
    side: claim.steelSide,
  };
});
// Ember work lights on every other tooth.
const lights = Array.from({ length: TEETH / 2 }, (_, i): HeavyPart => {
  const a = ((2 * i + 1) / TEETH) * 2 * Math.PI;
  return {
    plan: ring((R - 4.2) * Math.cos(a), (R - 4.2) * Math.sin(a), 1.7, 6),
    z0: RIM,
    z1: RIM + 0.6,
    top: claim.ember,
    side: claim.emberSide,
  };
});
// Eight spokes painted on the deck, hub to rim.
const spokes = Array.from({ length: 8 }, (_, i): HeavyPart => {
  const a = (i / 8) * 2 * Math.PI + Math.PI / 8;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const w = 3.2;
  return {
    plan: [
      [18 * c - w * s, 18 * s + w * c],
      [(R - 9) * c - w * s, (R - 9) * s + w * c],
      [(R - 9) * c + w * s, (R - 9) * s - w * c],
      [18 * c + w * s, 18 * s - w * c],
    ],
    z0: DECK,
    z1: DECK,
    top: claim.rustDeep,
    side: claim.rustDeep,
    decal: true,
  };
});
const paint = (r: number, color: string): HeavyPart => ({
  plan: ring(0, 0, r, 32),
  z0: DECK,
  z1: DECK,
  top: color,
  side: color,
  decal: true,
});

const platformHull: HeavyPart[] = [
  // The deck slab: a 32-sided wheel.
  {
    plan: ring(0, 0, R, 32, Math.PI / 32),
    z0: 0,
    z1: DECK,
    top: claim.rust,
    side: claim.rustSide,
    rear: claim.rustRear,
  },
  ...spokes,
  // The rail: a dark rust track between two steel edge lines, the deck showing inside it.
  paint(RAIL[1], claim.steelSide),
  paint(RAIL[1] - 1.8, claim.rustRear),
  paint(RAIL[0] + 1.8, claim.steelSide),
  paint(RAIL[0], claim.rust),
  ...teeth,
  ...lights,
  // The steel hopper hub with Gadget's claw on its rust cap.
  {
    plan: ring(0, 0, 19, 16, Math.PI / 16),
    z0: DECK,
    z1: HUB,
    top: claim.steel,
    side: claim.steelSide,
  },
  {
    plan: ring(0, 0, 13, 16, Math.PI / 16),
    z0: HUB,
    z1: HUB,
    top: claim.rustSide,
    side: claim.rustSide,
  },
  ...insignia(0, 0, 10, HUB).map(({ plan, side, top }) => ({ plan, side, top, z0: HUB, z1: HUB })),
];

// The platform gun: a broad steel mount pad on the rail, a fixed collar and an aimed top with a
// squat steel head, twin ember barrels and a soot hatch. Destroyed: a scorched stump and breach.
function platformTurret(): Model {
  const r = 15;
  const pad = DECK + 1;
  const mount = DECK + 2.5;
  const crown = DECK + 6;
  const head: Plan = [
    [-r, -r * 0.2],
    [-r * 0.6, -r],
    [r * 0.6, -r],
    [r, -r * 0.2],
    [r, r * 0.6],
    [r * 0.6, r],
    [-r * 0.6, r],
    [-r, r * 0.6],
  ];
  const offsets = [-r * 0.4, r * 0.4];
  const w = r * 0.2;
  const length = r * 2.35;
  const padPlan = ring(0, 0, r * 1.25, 8, Math.PI / 8);
  const collar = ring(0, 0, r * 0.88, 8, Math.PI / 8);
  const stump = { key: "stump", z: DECK + 2.2 };
  return {
    role: "turret",
    capped: [{ plan: padPlan, z0: DECK, z1: pad, top: claim.steelSide, side: claim.rustRear }],
    z: DECK,
    intact: [
      { plan: padPlan, z0: DECK, z1: pad, top: claim.steelSide, side: claim.rustRear },
      { plan: collar, z0: pad, z1: mount, top: claim.rustRear, side: claim.rustRear },
    ],
    destroyed: [
      { plan: padPlan, z0: DECK, z1: pad, top: claim.scorchSide, side: claim.scorchSide },
      {
        plan: collar,
        z0: pad,
        z1: stump.z,
        top: claim.scorch,
        side: claim.scorchSide,
        key: stump.key,
      },
      ...wreck(0, 0, r, DECK, stump, true),
    ],
    top: {
      name: "turret",
      z: mount,
      parts: [
        { plan: head, z0: mount, z1: crown, top: claim.steel, side: claim.steelSide, key: "head" },
        ...offsets.map((dx): HeavyPart => ({
          plan: box(dx - w, -length, dx + w, -r * 0.5),
          z0: crown - 2.6,
          z1: crown + 0.4,
          top: claim.ember,
          side: claim.emberSide,
        })),
        {
          plan: box(-r * 0.32, r * 0.2, r * 0.32, r * 0.62),
          z0: crown,
          z1: crown,
          top: claim.visor,
          side: claim.visor,
          on: "head",
        },
      ],
      muzzles: offsets.map((dx) => [dx, -length, crown - 1.1] as const),
    },
  };
}

export const platform: HeavyCraft = normalizeHeavy({
  name: "platform",
  title: "Platform",
  frame: 176,
  source: "heavies",
  hullTop: DECK,
  hull: platformHull,
  sizeRatio: 3,
  hardpoints: PLATFORM_FILL.map((id, index) => {
    const model = platformTurret();
    delete model.top;
    const offsets: [number, number][] = [
      [-0.29, 0],
      [0.29, 0],
      [0, 0.29],
    ];
    return { id, offset: offsets[index]!, model };
  }),
  mounts: {
    fill: PLATFORM_FILL,
    tiers: PLATFORM_TIERS,
    weapons: { [PLATFORM_SIGNATURE.weapon]: { top: platformTurret().top!, aim: "target" } },
  },
  fixed: true,
});
