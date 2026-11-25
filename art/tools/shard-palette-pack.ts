import { isDeepStrictEqual } from "node:util";

import { fleetArchetypes, type ManifestFile, readManifest, type Sidecars } from "./manifest.ts";

const bodies = [
  "fighter",
  "interceptor",
  "retaliator",
  "retaliatorCargoHauler",
  "retaliatorMiningFreighter",
  "swarm",
] as const;
const manifests = ["core", "andromeda", "cartwheel", "needle"] as const satisfies ManifestFile[];
const families = ["garnet", "claim", "needle"] as const;
type Family = (typeof families)[number];

const pathFor = (body: string) => `/art/enemies/${body}-shards-packed.json`;

/**
 * The optional format is selected as a unit across the six bodies and all four manifests. The
 * enemy fleet's bodies carry the fleet's own packs (art/tools/fleet.ts) and are left out.
 */
export function installedShardPacks(): ReadonlyMap<string, string> {
  const fleet = fleetArchetypes("core");
  const own = bodies.filter((body) => !fleet.has(body));
  const selections = manifests.map((name) => (readManifest(name).sidecars ?? {}) as Sidecars);
  if (
    !selections.some((sidecars) =>
      own.some((body) => sidecars[body]?.shards?.endsWith("-shards-packed.json")),
    )
  ) {
    return new Map();
  }

  for (const [index, sidecars] of selections.entries()) {
    for (const body of own) {
      if (sidecars[body]?.shards !== pathFor(body)) {
        throw new Error(`Incomplete shard palette selection: ${manifests[index]} / ${body}`);
      }
    }
  }
  return new Map(own.map((body) => [body, pathFor(body)]));
}

/** Restore the selected shard sidecar keys after the regular family writer emits its other files. */
export function linkShardPacks(paths: Map<string, string>, packs: ReadonlyMap<string, string>) {
  for (const [body, path] of packs) paths.set(`${body}-shards.json`, path);
}

type Body = {
  version: number;
  archetype: string;
  headings: { shards: { polygons: { color: string; points: number[] }[] }[] }[];
};

function paletteFor(core: Body, tinted: Body, family: Family): Record<string, string> {
  const colours = new Map<string, string>();
  const neutral = {
    ...tinted,
    headings: tinted.headings.map((heading, yaw) => ({
      ...heading,
      shards: heading.shards.map((shard, index) => ({
        ...shard,
        polygons: shard.polygons.map((polygon, polygonIndex) => {
          const source = core.headings[yaw]?.shards[index]?.polygons[polygonIndex]?.color;
          if (!source || !/^#[0-9a-f]{6}$/iu.test(polygon.color)) {
            throw new Error(`Invalid shard colour slot: ${core.archetype} / ${family}`);
          }
          const prior = colours.get(source);
          if (prior !== undefined && prior !== polygon.color) {
            throw new Error(`Conflicting shard colour: ${core.archetype} / ${family} / ${source}`);
          }
          colours.set(source, polygon.color);
          return { ...polygon, color: source };
        }),
      })),
    })),
  };
  if (!isDeepStrictEqual(core, neutral)) {
    throw new Error(`Shard geometry or ordering differs: ${core.archetype} / ${family}`);
  }
  return Object.fromEntries(colours);
}

/** Preserve every v1 field and order while factoring out only the literal polygon colours. */
export function shardPalettePack(
  text: string,
  recoloured: Readonly<Record<Family, string>>,
): string {
  const core = JSON.parse(text) as Body;
  return JSON.stringify({
    version: 2,
    core,
    palettes: Object.fromEntries(
      families.map((family) => [family, paletteFor(core, JSON.parse(recoloured[family]), family)]),
    ),
  });
}
