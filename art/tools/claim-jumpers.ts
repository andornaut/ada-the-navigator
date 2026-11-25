// The Claim turret platform model the enemy size test checks for its span, mounts and tiers, in
// the claim jumpers' rust, steel and ember. It ships no art: the hostile station producer draws
// the platform's hull and bases and the enemy fleet producer its gun top. Contract:
// art/heavies.md (Turret platform).
import { PLATFORM_SIGNATURE } from "../../src/data/enemySignatures.ts";

import { box, insignia, type Plan } from "./crafts.ts";
import { normalizeHeavy } from "./enemy-size.ts";
import {
  ADA_WIDTH,
  type HeavyCraft,
  type HeavyPart,
  type Model,
  PLATFORM_FILL,
  PLATFORM_TIERS,
  ring,
  wreck,
} from "./heavies.ts";

// Rust deck, warm steel plates, ember guns and lights, and a darker soot so wrecks read on rust.
const claim = {
  rust: "#bd7042",
  rustSide: "#924e28",
  rustRear: "#703921",
  rustDeep: "#7d4427",
  steel: "#b5a998",
  steelSide: "#85786a",
  ember: "#fa6d38",
  emberSide: "#bc4524",
  visor: "#2b1d1c",
  scorch: "#452f28",
  scorchSide: "#33211b",
} as const;

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
  // The steel hopper hub with Archie's claw on its rust cap.
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
