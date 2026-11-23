// Cartwheel's claim jumpers: the shared drone and heavy models recoloured into rust, steel and
// ember, plus the turret platform, a fixed wheel deck in the heavies export. Contract:
// art/heavies.md (Cartwheel claim jumpers).
// Usage: node art/tools/claim-jumpers.ts [--offsets <file.json>]
import { claimStationPaint } from "./claim-station-paint.ts";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { PLATFORM_SIGNATURE } from "../../src/data/enemySignatures.ts";

import {
  amber,
  amberSide,
  box,
  coral,
  coralRear,
  coralSide,
  exportCrafts as crafts,
  gadgetJets,
  hullEntries,
  ink,
  insignia,
  type JetColors,
  type Plan,
  plate,
  turretTop,
  visor,
  visorSide,
} from "./crafts.ts";
import { shards } from "./shard-geometry.ts";
import { installedShardPacks, linkShardPacks } from "./shard-palette-pack.ts";
import { restrainHeavyHull } from "./heavy-restraint.ts";
import { heavySurface } from "./heavy-surface.ts";
import { svgText } from "./svg-text.ts";
import {
  packInstalledIndustrialHulls,
  packInstalledIndustrialTurrets,
} from "./industrial-sheets.ts";
import { jets, packInstalledSmallHullSheets, silhouettes, svg } from "./enemies.ts";
import {
  ADA_WIDTH,
  build,
  burn,
  ember as wreckEmber,
  type HeavyCraft,
  type HeavyPart,
  heavies,
  industrialHeavies,
  packInstalledHeavyParts,
  type Model,
  place,
  PLATFORM_FILL,
  PLATFORM_TIERS,
  readOffsets,
  ring,
  scorch,
  scorchSide,
  wreck,
} from "./heavies.ts";
import { normalizeHeavy } from "./enemy-size.ts";
import {
  craftIds,
  mergeEntries,
  mergeSidecars,
  sidecarCopies,
  sidecarsIn,
  storedAt,
  writeOnce,
} from "./manifest.ts";
import { ENEMY_HEADINGS } from "./projection.ts";
import { isIndustrialHullColor } from "./retaliator-models.ts";

// ---------------------------------------------------------------- palette

// Rust hulls, warm steel plates, ember guns and lights. Rust is darker and yellower than coral;
// ember is far more saturated than player amber.
export const claim = {
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
export const swap: Readonly<Record<string, string>> = {
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

// Speed jets, slow to fast: a dark ember tail opening to ember, round an ember core that runs
// to a near-white hot centre (OKLab L 0.95, C 0.03, warm).
export const claimJets: JetColors = {
  outer: [claim.emberSide, claim.ember],
  core: [claim.ember, "#ffebda"],
};
// Gadget's jet colour to claim jet colour, ramp stop by ramp stop.
const jetSwap: Readonly<Record<string, string>> = Object.fromEntries(
  (["outer", "core"] as const).flatMap((layer) =>
    gadgetJets[layer].map((color, i) => [color, claimJets[layer][i]!]),
  ),
);
const jetFamily = new Set<string>([...claimJets.outer, ...claimJets.core]);

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

// An SVG or shards file in the claim-jumper palette.
export const recolour = (file: string, text: string) =>
  claimStationPaint(file, swapColours(swap, family, file, text));
// A jets file in the claim jet colours; shape, lengths and anchors are unchanged.
export const recolourJets = (file: string, text: string) =>
  swapColours(jetSwap, jetFamily, file, text);

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

// ---------------------------------------------------------------- export

type Entry = Record<string, unknown> & { id: string; path?: string };

const PATH = "/art/cartwheel/enemies/";
const PREFIX = "enemy-claim-";

// A coral family entry as its claim-jumper entry: its own id and path, tagged with the family.
const claimEntry = (entry: Entry): Entry => ({
  ...entry,
  id: `${PREFIX}${entry.id.slice("enemy-".length)}`,
  path: `${PATH}${entry.path!.slice("/art/enemies/".length)}`,
  family: "claim",
});

// The platform hull never turns: one frame for every seeded facing.
const fixedHull = (entry: Entry): Entry => {
  const kept = Object.entries(entry).filter(([key]) => key !== "directionIndex");
  return {
    ...Object.fromEntries(kept),
    id: `${PREFIX}platform`,
    path: `${PATH}platform.svg`,
    facing: "fixed",
    family: "claim",
  };
};

async function main() {
  const packs = installedShardPacks();
  const args = process.argv.slice(2);
  const at = args.indexOf("--offsets");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const offsetsPath = at === -1 ? `${root}tools/enemy-hardpoints.json` : args[at + 1]!;
  const offsets = readOffsets(JSON.parse(readFileSync(offsetsPath, "utf8")));

  const files = new Map<string, string>();
  const entries: Entry[] = [];
  for (const craft of crafts) {
    const traced = silhouettes(craft);
    for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
      files.set(`${craft.name}-${yaw}.svg`, svg(craft, yaw, traced[yaw]!.tips));
    }
    files.set(
      `${craft.name}-jets.json`,
      jets(craft, (yaw) => traced[yaw]!.collision),
    );
    if (!packs.has(craft.name)) files.set(`${craft.name}-shards.json`, shards(craft));
    entries.push(...hullEntries(craft.name, craft.frame).map(claimEntry));
  }
  for (const craft of [...heavies, ...industrialHeavies]) {
    const styled = restrainHeavyHull(craft);
    const result = build(styled, place(offsets, styled));
    for (const [file, content] of result.files) {
      files.set(file, content);
    }
    entries.push(...result.entries.map(claimEntry));
  }
  const styledPlatform = restrainHeavyHull(platform, { platformPaint: claim });
  const built = build(styledPlatform, place(offsets, styledPlatform));
  const turning = /^platform-\d+$/;
  for (const [file, content] of built.files) {
    if (file === "platform-0.svg") {
      files.set("platform.svg", content);
    } else if (!turning.test(file.replace(/\.svg$/, "")) && file !== "platform-jets.json") {
      files.set(file, content);
    }
  }
  for (const entry of built.entries) {
    if (entry.id === "enemy-platform-0") {
      entries.push(fixedHull(entry));
    } else if (!/^enemy-platform-\d+$/.test(entry.id)) {
      entries.push(claimEntry(entry));
    }
  }

  const dir = `${root}public/art/cartwheel/enemies/`;
  mkdirSync(dir, { recursive: true });
  const texts = new Map<string, string>();
  for (const [file, content] of files) {
    const path = `${dir}${file}`;
    // Hardpoint layouts carry no colour.
    const drawn = file.endsWith(".svg") || file.endsWith("-shards.json");
    const text = file.endsWith("-jets.json")
      ? recolourJets(file, content)
      : drawn
        ? (heavySurface("cartwheel", file, content) ?? recolour(file, content))
        : content;
    // JSON goes through the project's Prettier settings so the files stay Prettier-clean.
    texts.set(
      file,
      file.endsWith(".json")
        ? await format(text, { ...(await resolveConfig(path)), filepath: path })
        : file.endsWith(".svg")
          ? svgText(text)
          : text,
    );
  }
  // The shared heavies' layouts are the coral ones in /art/enemies/, and a craft drawn like
  // another (the cargo hauler is the retaliator) uses that craft's files.
  const shared = [...heavies, ...industrialHeavies].map(({ name }) => name);
  const heavy = packInstalledHeavyParts("cartwheel", texts, entries);
  const small = packInstalledSmallHullSheets("cartwheel", texts, heavy.outputEntries);
  const turrets = packInstalledIndustrialTurrets("cartwheel", texts, small);
  const outputEntries = packInstalledIndustrialHulls("cartwheel", texts, turrets);
  const paths = writeOnce(PATH, sidecarCopies("core", "hardpoints", shared), texts);
  // In Cartwheel's manifest after the hub and buoy, before the story craft.
  // Only these crafts' ids; hostile-station-export.ts writes `enemy-claim-hostileStation-`.
  mergeEntries(
    "cartwheel",
    craftIds(
      PREFIX,
      [...crafts, ...heavies, ...industrialHeavies, platform].map(({ name }) => name),
    ),
    outputEntries.map((entry) => storedAt(paths, entry)),
    (id) => id.startsWith("craft-"),
  );
  const names = new Set(
    [...crafts, ...heavies, ...industrialHeavies, platform].map(({ name }) => name),
  );
  linkShardPacks(paths, packs);
  mergeSidecars("cartwheel", (craft) => names.has(craft), sidecarsIn(paths));
  console.log(`${files.size} files, ${entries.length} entries; offsets from ${offsetsPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
