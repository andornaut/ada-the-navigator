import { isDeepStrictEqual } from "node:util";

const families = ["garnet", "claim", "needle"] as const;
type Family = (typeof families)[number];

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
