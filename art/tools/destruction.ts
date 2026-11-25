import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { coral, coralRear, exportCrafts as crafts } from "./crafts.ts";
import { recolour } from "./claim-jumpers.ts";
import { recolourGarnet } from "./garnet-drones.ts";
import { recolourNeedle } from "./needle-drones.ts";
import { shardPalettePack } from "./shard-palette-pack.ts";
import { sizeReceipts } from "./enemy-size.ts";
import { fleetCrafts } from "./fleet.ts";
import { FLEET_FAMILIES, FLEET_PAINT } from "./fleet-models.ts";
import { stageRows } from "./polish-rows.ts";
import { svgText } from "./svg-text.ts";
import { mergeSidecars, readManifest, type Sidecars } from "./manifest.ts";
import { json, round } from "./projection.ts";
import { halfSpan, shards } from "./shard-geometry.ts";

export { shards };

const output = fileURLToPath(new URL("../../public/art/enemies/", import.meta.url));

// Approved timings: fighter 450 ms (frame 96) and retaliator 600 ms (frame 192); swarm and
// interceptor interpolate linearly by frame size, rounded to 10 ms.
const byFrame = (frame: number, at96: number, at192: number) =>
  Math.round((at96 + ((at192 - at96) * (frame - 96)) / 96) / 10) * 10;
// Pickup spread radius in world units: 19.2 at frame 96 and 33.6 at frame 192.
const spread = (frame: number, at96: number, at192: number) =>
  round(at96 + ((at192 - at96) * (frame - 96)) / 96);

const REDUCED_COOL = 0.6;
const FLASH_SIZE = 80;

// Multiply tint that cools the coral hull top toward the rear shade like the shard lerp.
function reducedTint(): string {
  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const target = channels(coralRear);
  return `#${channels(coral)
    .map((c, i) => Math.round((255 * (c + (target[i]! - c) * REDUCED_COOL)) / c))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}
const FLASH_CORE = 0.28 / 0.55;

// Four-point star: astroid outline, squashed to 0.8 height, pale outer and white core.
function flash(): string {
  const star = (radius: number) =>
    Array.from({ length: 32 }, (_, i) => {
      const theta = (2 * Math.PI * i) / 32;
      const [c, s] = [Math.cos(theta), Math.sin(theta)];
      const r = radius / (Math.sqrt(Math.abs(c)) + Math.sqrt(Math.abs(s))) ** 2;
      return `${(FLASH_SIZE / 2 + r * c).toFixed(2)},${(FLASH_SIZE * 0.4 + r * s * 0.8).toFixed(2)}`;
    }).join(" ");
  const height = FLASH_SIZE * 0.8;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FLASH_SIZE}" height="${height}" viewBox="0 0 ${FLASH_SIZE} ${height}">`,
    "  <title>Destruction flash</title>",
    `  <polygon fill="#ffe2c8" points="${star(FLASH_SIZE / 2)}"/>`,
    `  <polygon fill="#ffffff" points="${star((FLASH_SIZE / 2) * FLASH_CORE)}"/>`,
    "</svg>",
    "",
  ].join("\n");
}

// The enemy fleet's craft, by the archetype each replaces: its frame and half span size that
// archetype's flash, timings and spread.
const fleet = new Map(fleetCrafts().map((craft) => [craft.archetype, craft]));

function spec(): string {
  const archetypes = Object.fromEntries(
    crafts.map((craft) => {
      const redesigned = fleet.get(craft.name);
      const sourceFrame = redesigned?.frame ?? sizeReceipts.get(craft.name)!.frameBefore;
      const reduced = byFrame(sourceFrame, 360, 450);
      return [
        craft.name,
        {
          durationMs: byFrame(sourceFrame, 450, 600),
          releaseMs: byFrame(sourceFrame, 150, 190),
          flashWidth: round((redesigned?.halfSpan ?? halfSpan(craft)) * 1.98),
          spread: spread(sourceFrame, 19.2, 33.6),
          reduced: {
            durationMs: reduced,
            releaseMs: Math.round((reduced * 2) / 3 / 10) * 10,
            spread: spread(sourceFrame, 7.68, 13.44),
          },
        },
      ];
    }),
  );
  return json({
    version: 1,
    shards: {
      ease: 2.4,
      shrink: 0.65,
      cool: { color: "#7f4b3d", amount: 0.55 },
      fade: { from: 0.3, exponent: 1.3 },
      fleckFadeEnd: 0.6,
    },
    flash: {
      path: "/art/enemies/destruction-flash.svg",
      width: FLASH_SIZE,
      height: FLASH_SIZE * 0.8,
      phases: [
        { fromMs: 0, toMs: 20, scale: 1, alpha: round(235 / 255) },
        { fromMs: 20, toMs: 80, scale: 0.55, alpha: round(150 / 255) },
      ],
    },
    pickups: { settleMs: 110, radius: [0.6, 1], angleJitter: 0.3, squash: 0.8 },
    reduced: { shrink: 0.8, cool: REDUCED_COOL, tint: reducedTint() },
    archetypes,
  });
}

// Long point lists wrap the way Prettier fills them, so the files stay Prettier-clean.
export async function writeJson(path: string, text: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(text, { ...options, filepath: path }));
}

// The crafts whose shards this producer writes, each with its shards path: every craft but those
// whose core sidecar names the enemy fleet's pack (art/tools/fleet.ts writes those). A craft
// keeps the packed file its manifests select.
function ownShards(): Map<string, string> {
  const installed = (readManifest("core").sidecars ?? {}) as Sidecars;
  const own = new Map<string, string>();
  for (const { name } of crafts) {
    const path = installed[name]?.shards;
    const packed = `/art/enemies/${name}-shards-packed.json`;
    if (path === undefined || path === `/art/enemies/${name}-shards.json`) {
      own.set(name, `/art/enemies/${name}-shards.json`);
    } else if (path === packed) {
      own.set(name, packed);
    }
  }
  return own;
}

async function main() {
  const own = ownShards();
  for (const craft of crafts) {
    const path = own.get(craft.name);
    if (path === undefined) continue;
    const file = `${craft.name}-shards.json`;
    const core = shards(craft);
    if (path.endsWith("-shards-packed.json")) {
      const pack = shardPalettePack(core, {
        garnet: recolourGarnet(file, core),
        claim: recolour(file, core),
        needle: recolourNeedle(file, core),
      });
      await writeJson(`${output}${craft.name}-shards-packed.json`, pack);
    } else {
      await writeJson(output + file, core);
    }
  }
  await writeJson(`${output}destruction.json`, spec());
  // The staged shard look (art/destruction.md, Flat look): each family's shards cool toward its
  // own darkest hull tone, and the fade holds in steps.
  stageRows("effects-destruction", {
    file: "/art/enemies/destruction.json",
    shards: {
      cool: {
        amount: 0.55,
        families: Object.fromEntries(
          FLEET_FAMILIES.map((family) => [family, FLEET_PAINT[family].hull[2]]),
        ),
      },
      fade: {
        steps: [
          { from: 0, alpha: 1 },
          { from: 0.55, alpha: 0.6 },
          { from: 0.8, alpha: 0.3 },
        ],
      },
    },
  });
  writeFileSync(`${output}destruction-flash.svg`, svgText(flash()));
  // The coral shards it owns; enemies.ts and heavies.ts write these crafts' other sidecars.
  mergeSidecars(
    "core",
    (craft, kind) => kind === "shards" && own.has(craft),
    Object.fromEntries([...own].map(([name, shards]) => [name, { shards }])),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
