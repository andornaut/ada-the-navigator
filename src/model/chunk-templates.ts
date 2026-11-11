import type { AsteroidSize } from "../data/asteroid-catalog.ts";
import type { AsteroidField, ChunkCatalog, ChunkTemplateId } from "../data/chunk-catalog.ts";
import { RESOURCE_ROCKS, type ResourceClass, resourceClass } from "../data/resource-rocks.ts";
import type { SectorId } from "../data/types.ts";
import { type AsteroidShape, resourceShapes } from "./asteroids.ts";
import type { Vec } from "./types.ts";

/** Asteroid variants and the sector's field weights; without them rocks use `rockRadius`. */
export interface ChunkAsteroids {
  readonly field: AsteroidField;
  readonly shapes: readonly AsteroidShape[];
}

export interface ChunkPlanOptions {
  readonly asteroids?: ChunkAsteroids;
  readonly clearance: number;
  readonly objectsPerChunk: number;
  readonly rockRadius: number;
  readonly sector: SectorId;
  readonly seed: number;
  readonly shipRadius: number;
  readonly size: number;
  readonly spawnWeights: Readonly<Record<"enemy" | "pickup" | "resource" | "rock", number>>;
  readonly x: number;
  readonly y: number;
}
/** A slow closed drift path around the placement point: angle `phase + rate * time`. */
export interface AsteroidOrbit {
  readonly phase: number;
  readonly radius: number;
  /** Signed angular rate in radians per second. */
  readonly rate: number;
}
export interface ChunkPlacement extends Vec {
  readonly asteroid?: string;
  readonly id: string;
  readonly kind: "rock" | "resource" | "pickup";
  readonly orbit?: AsteroidOrbit;
  readonly radius: number;
  readonly resource?: ResourceClass;
}
export interface ChunkPort {
  readonly center: Vec;
  readonly halfWidth: number;
}
export interface ChunkPlan {
  readonly id: ChunkTemplateId;
  readonly placements: readonly ChunkPlacement[];
  readonly ports: Readonly<Record<"east" | "north" | "south" | "west", ChunkPort>>;
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

interface Drift {
  readonly phase: number;
  readonly roll: number;
  readonly sign: number;
  readonly speed: number;
}
// Drift paths stay small and slow so they read as drifting, not circling.
const ORBIT_RADIUS: readonly [number, number] = [16, 96];
const ORBIT_MAX_RATE = 0.3;

/** A seeded variant of a weighted size, with drift parameters when the variant may drift. */
function asteroid(
  asteroids: ChunkAsteroids,
  sizes: Readonly<Partial<Record<AsteroidSize, number>>>,
  seed: number,
  salt: number,
): { shape: AsteroidShape; drift?: Drift } | undefined {
  const size = weighted(sizes, unit(seed, salt));
  const variants = asteroids.shapes.filter((shape) => shape.size === size);
  if (!variants.length) {
    return undefined;
  }
  const shape = variants[mix(seed, salt + 1) % variants.length]!;
  if (!shape.drift.eligible || unit(seed, salt + 2) >= asteroids.field.driftChance) {
    return { shape };
  }
  const [slow, fast] = shape.drift.speed;
  return {
    drift: {
      phase: unit(seed, salt + 3) * Math.PI * 2,
      roll: unit(seed, salt + 5),
      sign: mix(seed, salt + 6) % 2 ? 1 : -1,
      speed: slow + unit(seed, salt + 4) * (fast - slow),
    },
    shape,
  };
}

function seedFor(options: ChunkPlanOptions): number {
  return mix(mix(mix(options.seed, options.sector), options.x), options.y);
}
function validate(options: ChunkPlanOptions): void {
  if (
    ![options.seed, options.x, options.y, options.objectsPerChunk].every(Number.isSafeInteger) ||
    options.objectsPerChunk < 0 ||
    ![options.size, options.shipRadius, options.rockRadius, options.clearance].every(
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

/** Pure plans use normalized authored slots and return world coordinates without retaining visits. */
export function planChunk(catalog: ChunkCatalog, options: ChunkPlanOptions): ChunkPlan {
  validate(options);
  const choices = catalog[options.sector];
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
  const seed = seedFor(options);
  let roll = (seed / 0x100000000) * total;
  let id = choices.find((choice) => choice.weight > 0)!.id;
  for (const choice of choices) {
    if (roll < choice.weight) {
      id = choice.id;
      break;
    }
    roll -= choice.weight;
  }
  const origin = { x: options.x * options.size, y: options.y * options.size };
  const center = { x: origin.x + options.size / 2, y: origin.y + options.size / 2 };
  const halfWidth = options.shipRadius + options.clearance;
  const slots = TEMPLATES[id];
  const count = Math.min(options.objectsPerChunk, slots.length);
  const weights = options.spawnWeights;
  const totalSpawn = weights.resource + weights.rock + weights.enemy + weights.pickup;
  const placements: ChunkPlacement[] = [];
  const asteroids = options.asteroids;
  // At most one large feature per chunk sits at a quadrant center, clear of edges and corridors.
  let feature: ChunkPlacement | undefined;
  if (asteroids && weights.rock > 0 && unit(seed, 997) < (asteroids.field.featureChance[id] ?? 0)) {
    const chosen = asteroid(asteroids, asteroids.field.featureSizes, seed, 1009);
    const quadrant = mix(seed, 991) % 4;
    const local = {
      x: (quadrant % 2 ? 0.75 : 0.25) * options.size,
      y: (quadrant < 2 ? 0.25 : 0.75) * options.size,
    };
    if (chosen && chosen.shape.radius + halfWidth <= options.size / 4) {
      feature = {
        asteroid: chosen.shape.id,
        id: `chunk:${options.x},${options.y}:feature`,
        kind: "rock",
        radius: chosen.shape.radius,
        x: origin.x + local.x,
        y: origin.y + local.y,
      };
    }
  }
  const drifting = new Map<number, { drift: Drift; free: number }>();
  // Placed resource rocks follow the large-every pattern from a seeded start.
  let resources = mix(seed, 3001) % RESOURCE_ROCKS.largeEvery;
  for (let slot = 0; slot < count; slot++) {
    const local = slots[(slot + (seed % slots.length)) % slots.length]!;
    const x = local[0] * options.size;
    const y = local[1] * options.size;
    const choice = (mix(seed, slot + 1) / 0x100000000) * totalSpawn;
    const kind =
      choice < weights.resource
        ? "resource"
        : choice < weights.resource + weights.rock
          ? "rock"
          : choice < weights.resource + weights.rock + weights.enemy
            ? "enemy"
            : "pickup";
    // Keep combat under the existing encounter director, never an ambient slot roll.
    if (kind === "enemy") {
      continue;
    }
    const chosen =
      kind === "rock" && asteroids
        ? asteroid(asteroids, asteroids.field.slotSizes, seed, 2000 + slot * 16)
        : undefined;
    const resource = kind === "resource" ? resourceClass(resources) : undefined;
    const variants = resource && asteroids ? resourceShapes(asteroids.shapes, resource) : [];
    const ore = variants.length ? variants[mix(seed, 3100 + slot) % variants.length] : undefined;
    const radius = chosen?.shape.radius ?? ore?.radius ?? options.rockRadius;
    const boundary = radius + halfWidth;
    if (
      x < boundary ||
      y < boundary ||
      x > options.size - boundary ||
      y > options.size - boundary ||
      Math.abs(x - options.size / 2) < boundary ||
      Math.abs(y - options.size / 2) < boundary
    ) {
      continue;
    }
    const at = { x: origin.x + x, y: origin.y + y };
    // Slots beside the feature keep a ship-width gap so the feature never seals them in.
    if (
      feature &&
      Math.hypot(at.x - feature.x, at.y - feature.y) < feature.radius + radius + 2 * halfWidth
    ) {
      continue;
    }
    if (chosen?.drift) {
      const edges = Math.min(
        x,
        y,
        options.size - x,
        options.size - y,
        Math.abs(x - options.size / 2),
        Math.abs(y - options.size / 2),
      );
      drifting.set(placements.length, { drift: chosen.drift, free: edges - boundary });
    }
    if (resource) {
      resources++;
    }
    placements.push({
      ...(chosen ? { asteroid: chosen.shape.id } : ore ? { asteroid: ore.id } : {}),
      id: `chunk:${options.x},${options.y}:${slot}`,
      kind,
      radius,
      ...(resource ? { resource } : {}),
      ...at,
    });
  }
  if (feature) {
    placements.push(feature);
  }
  // A drift path never leaves the slot's corridor clearance or reaches a neighbor's gap. Paths
  // are assigned in order and each one leaves room for those before it, so no two paths overlap.
  for (const [index, { drift, free }] of drifting) {
    const placement = placements[index]!;
    const room = placements.reduce(
      (limit, other, at) =>
        at === index
          ? limit
          : Math.min(
              limit,
              Math.hypot(other.x - placement.x, other.y - placement.y) -
                other.radius -
                (other.orbit?.radius ?? 0) -
                placement.radius -
                2 * halfWidth,
            ),
      free,
    );
    if (room < ORBIT_RADIUS[0]) {
      continue;
    }
    const radius =
      ORBIT_RADIUS[0] + drift.roll * (Math.min(room, ORBIT_RADIUS[1]) - ORBIT_RADIUS[0]);
    placements[index] = {
      ...placement,
      orbit: {
        phase: drift.phase,
        radius,
        rate: drift.sign * Math.min(drift.speed / radius, ORBIT_MAX_RATE),
      },
    };
  }
  return {
    id,
    placements,
    ports: {
      east: { center: { x: origin.x + options.size, y: center.y }, halfWidth },
      north: { center: { x: center.x, y: origin.y }, halfWidth },
      south: { center: { x: center.x, y: origin.y + options.size }, halfWidth },
      west: { center: { x: origin.x, y: center.y }, halfWidth },
    },
  };
}
