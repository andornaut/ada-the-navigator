import type { AsteroidField, ChunkCatalog, ChunkTemplateId } from "../data/chunkCatalog.ts";
import { byPosition } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { AsteroidShape } from "./asteroids.ts";
import type { Vec } from "./types.ts";
import { periodicWorldGrid, worldCell, worldCellOrigin, type WorldGrid } from "./world/index.ts";

export interface ChunkCacheOptions {
  /** The galaxy's asteroid field and the asteroid variants its feature quadrant reads. */
  readonly field: AsteroidField;
  readonly galaxy: GalaxyNumber;
  /** Ship-width clearance added to the ship radius on either side of each lane. */
  readonly clearance: number;
  readonly objectsPerChunk: number;
  /** A cache's footprint radius for the lane and feature checks. */
  readonly radius: number;
  readonly seed: number;
  readonly shapes: readonly AsteroidShape[];
  readonly shipRadius: number;
  readonly size: number;
  readonly spawnWeights: Readonly<Record<"enemy" | "pickup" | "rock", number>>;
  readonly worldSide?: number;
  readonly x: number;
  readonly y: number;
}

export interface ChunkCache extends Vec {
  readonly id: string;
}

// Finite authored local slots, normalized to one chunk. POI slots leave the center empty.
const TEMPLATES: Readonly<Record<ChunkTemplateId, readonly (readonly [number, number])[]>> = {
  cluster: [
    [0.18, 0.18],
    [0.29, 0.18],
    [0.18, 0.29],
    [0.29, 0.29],
    [0.71, 0.71],
    [0.82, 0.71],
    [0.71, 0.82],
    [0.82, 0.82],
  ],
  passage: [
    [0.15, 0.4],
    [0.3, 0.4],
    [0.7, 0.4],
    [0.85, 0.4],
    [0.15, 0.6],
    [0.3, 0.6],
    [0.7, 0.6],
    [0.85, 0.6],
  ],
  poi: [
    [0.15, 0.15],
    [0.3, 0.15],
    [0.7, 0.15],
    [0.85, 0.15],
    [0.15, 0.85],
    [0.3, 0.85],
    [0.7, 0.85],
    [0.85, 0.85],
  ],
  quiet: [
    [0.12, 0.12],
    [0.88, 0.12],
    [0.12, 0.88],
    [0.88, 0.88],
    [0.24, 0.2],
    [0.8, 0.24],
    [0.2, 0.76],
    [0.76, 0.8],
  ],
};

function mix(seed: number, value: number): number {
  let hash = Math.imul(seed ^ value, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}
const unit = (seed: number, value: number) => mix(seed, value) / 0x100000000;

function weighted<T extends string>(
  weights: Readonly<Partial<Record<T, number>>>,
  roll: number,
): T | undefined {
  const entries = (Object.entries(weights) as [T, number][]).filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let threshold = roll * total;
  for (const [key, weight] of entries) {
    if (threshold < weight) {
      return key;
    }
    threshold -= weight;
  }
  return entries.at(-1)?.[0];
}

function validate(options: ChunkCacheOptions): void {
  if (
    ![options.seed, options.x, options.y, options.objectsPerChunk].every(Number.isSafeInteger) ||
    options.objectsPerChunk < 0 ||
    ![options.size, options.shipRadius, options.radius, options.clearance].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    2 * (options.shipRadius + options.clearance) >= options.size
  ) {
    throw new RangeError("Invalid chunk geometry or identity");
  }
  const weights = Object.values(options.spawnWeights);
  if (
    weights.some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isFinite(weights.reduce((sum, value) => sum + value, 0)) ||
    weights.reduce((sum, value) => sum + value, 0) <= 0
  ) {
    throw new RangeError("Invalid chunk spawn weights");
  }
}

/** The chunk's template and seed, by weighted roll over the galaxy's catalog. */
function chunkTemplate(
  catalog: ChunkCatalog,
  options: ChunkCacheOptions,
): { readonly id: ChunkTemplateId; readonly seed: number } {
  const choices = byPosition(catalog, options.galaxy);
  if (
    !choices.length ||
    choices.some((choice) => !Number.isFinite(choice.weight) || choice.weight < 0)
  ) {
    throw new RangeError("Invalid chunk template catalog");
  }
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  if (!(total > 0) || !Number.isFinite(total)) {
    throw new RangeError("Chunk catalog requires positive weight");
  }
  const seed = mix(mix(mix(options.seed, options.galaxy), options.x), options.y);
  let roll = (seed / 0x100000000) * total;
  let id = choices.find((choice) => choice.weight > 0)!.id;
  for (const choice of choices) {
    if (roll < choice.weight) {
      id = choice.id;
      break;
    }
    roll -= choice.weight;
  }
  return { id, seed };
}

/**
 * The template's feature quadrant: a disc at a quadrant centre with the radius of the seeded
 * feature size, or undefined when the template rolls none. Caches keep a ship-width gap from it.
 */
function featureQuadrant(
  options: ChunkCacheOptions,
  grid: WorldGrid,
  id: ChunkTemplateId,
  seed: number,
): (Vec & { readonly radius: number }) | undefined {
  const { field } = options;
  if (options.spawnWeights.rock <= 0 || unit(seed, 997) >= (field.featureChance[id] ?? 0)) {
    return undefined;
  }
  const size = weighted(field.featureSizes, unit(seed, 1009));
  const variants = options.shapes.filter((shape) => shape.size === size);
  const shape = variants[mix(seed, 1010) % variants.length];
  const halfWidth = options.shipRadius + options.clearance;
  if (!shape || shape.radius + halfWidth > options.size / 4) {
    return undefined;
  }
  const quadrant = mix(seed, 991) % 4;
  const origin = worldCellOrigin(grid, options);
  return {
    radius: shape.radius,
    x: origin.x + (quadrant % 2 ? 0.75 : 0.25) * options.size,
    y: origin.y + (quadrant < 2 ? 0.25 : 0.75) * options.size,
  };
}

/**
 * A chunk's discovery caches: the template slots whose seeded roll draws a cache, clear of the
 * lanes by the cache radius and the ship's half width, and a ship-width gap from the template's
 * feature quadrant. Caches are independent of the spawn planner's rocks.
 */
export function planChunkCaches(catalog: ChunkCatalog, raw: ChunkCacheOptions): ChunkCache[] {
  validate(raw);
  const grid = periodicWorldGrid(raw, raw.size);
  const options = { ...raw, ...worldCell(grid, raw), size: grid.pitch };
  const { id, seed } = chunkTemplate(catalog, options);
  const origin = worldCellOrigin(grid, options);
  const halfWidth = options.shipRadius + options.clearance;
  const slots = TEMPLATES[id];
  const count = Math.min(options.objectsPerChunk, slots.length);
  const weights = options.spawnWeights;
  const total = weights.rock + weights.enemy + weights.pickup;
  const feature = featureQuadrant(options, grid, id, seed);
  const boundary = options.radius + halfWidth;
  const caches: ChunkCache[] = [];
  for (let slot = 0; slot < count; slot++) {
    const choice = (mix(seed, slot + 1) / 0x100000000) * total;
    if (choice < weights.rock + weights.enemy) {
      continue;
    }
    const local = slots[(slot + (seed % slots.length)) % slots.length]!;
    const x = local[0] * options.size;
    const y = local[1] * options.size;
    const at = { x: origin.x + x, y: origin.y + y };
    if (
      x < boundary ||
      y < boundary ||
      x > options.size - boundary ||
      y > options.size - boundary ||
      Math.abs(x - options.size / 2) < boundary ||
      Math.abs(y - options.size / 2) < boundary ||
      (feature &&
        Math.hypot(at.x - feature.x, at.y - feature.y) <
          feature.radius + options.radius + 2 * halfWidth)
    ) {
      continue;
    }
    caches.push({ id: `chunk:${options.x},${options.y}:${slot}`, ...at });
  }
  return caches;
}
