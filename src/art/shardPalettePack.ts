import { readShards, type ShardData } from "./destructionArt.ts";

const RECOLORS = ["garnet", "claim", "needle"] as const;
type Recolor = (typeof RECOLORS)[number];

interface ShardPalettePack {
  readonly core: ShardData;
  readonly forFamily: (family: "coral" | Recolor) => ShardData;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pair(value: unknown): boolean {
  return list(value) && value.length === 2 && finite(value[0]) && finite(value[1]);
}

function validPoints(value: unknown): boolean {
  if (!list(value) || value.length < 6 || value.length % 2 !== 0) {
    return false;
  }
  for (const point of value) {
    if (!finite(point)) {
      return false;
    }
  }
  return true;
}

function color(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value);
}

function validShard(value: unknown): boolean {
  return (
    record(value) &&
    (value.kind === "fleck" || value.kind === "hull" || value.kind === "part") &&
    [value.spin, value.jitter, value.distance, value.lift].every(finite)
  );
}

function readPolygonColors(
  headings: readonly unknown[],
  shardCount: number,
): Set<string> | undefined {
  const colors = new Set<string>();
  for (const [index, heading] of headings.entries()) {
    if (!record(heading) || heading.index !== index || !list(heading.shards)) {
      return undefined;
    }
    for (const entry of heading.shards) {
      if (
        !record(entry) ||
        typeof entry.shard !== "number" ||
        !Number.isInteger(entry.shard) ||
        entry.shard < 0 ||
        entry.shard >= shardCount ||
        !pair(entry.centroid) ||
        !pair(entry.drift) ||
        !finite(entry.nearness) ||
        !finite(entry.nearnessDrift) ||
        !list(entry.polygons)
      ) {
        return undefined;
      }
      for (const polygon of entry.polygons) {
        if (!record(polygon) || !color(polygon.color) || !validPoints(polygon.points)) {
          return undefined;
        }
        colors.add(polygon.color);
      }
    }
  }
  return colors.size ? colors : undefined;
}

function readPalette(value: unknown, colors: ReadonlySet<string>): Map<string, string> | undefined {
  if (!record(value) || Object.keys(value).length !== colors.size) {
    return undefined;
  }
  const palette = new Map<string, string>();
  for (const source of colors) {
    const target = value[source];
    if (!Object.hasOwn(value, source) || !color(target)) {
      return undefined;
    }
    palette.set(source, target);
  }
  return palette;
}

function recolor(core: ShardData, palette: ReadonlyMap<string, string>): ShardData {
  return {
    ...core,
    headings: core.headings.map((heading) => ({
      ...heading,
      shards: heading.shards.map((shard) => ({
        ...shard,
        polygons: shard.polygons.map((polygon) => {
          const target = palette.get(polygon.color)!;
          return target === polygon.color ? polygon : { ...polygon, color: target };
        }),
      })),
    })),
  };
}

/** Validates the candidate v2 wrapper as a whole. The caller keeps the separate v1 entry point. */
export function readShardPalettePack(
  value: unknown,
  archetype: string,
): ShardPalettePack | undefined {
  if (
    !record(value) ||
    value.version !== 2 ||
    !record(value.core) ||
    value.core.archetype !== archetype ||
    !finite(value.core.frame) ||
    !finite(value.core.halfSpan) ||
    !record(value.palettes) ||
    Object.keys(value.palettes).length !== RECOLORS.length
  ) {
    return undefined;
  }
  const core = readShards(value.core);
  if (!core || !core.shards.length) {
    return undefined;
  }
  for (const shard of core.shards) {
    if (!validShard(shard)) {
      return undefined;
    }
  }
  const colors = readPolygonColors(core.headings, core.shards.length);
  if (!colors) {
    return undefined;
  }
  const palettes = new Map<Recolor, ReadonlyMap<string, string>>();
  for (const family of RECOLORS) {
    const palette = readPalette(value.palettes[family], colors);
    if (!Object.hasOwn(value.palettes, family) || !palette) {
      return undefined;
    }
    palettes.set(family, palette);
  }
  const views = new Map<Recolor, ShardData>();
  return {
    core,
    forFamily(family) {
      if (family === "coral") {
        return core;
      }
      const held = views.get(family);
      if (held) {
        return held;
      }
      const view = recolor(core, palettes.get(family)!);
      views.set(family, view);
      return view;
    },
  };
}
