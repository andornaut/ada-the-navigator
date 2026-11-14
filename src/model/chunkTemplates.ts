import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import type { AsteroidField, ChunkCatalog, ChunkTemplateId } from "../data/chunkCatalog.ts";
import { byPosition } from "../data/galaxies.ts";
import { RESOURCE_ROCKS, type ResourceClass, resourceClass } from "../data/resourceRocks.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { type AsteroidShape, resourceShapes } from "./asteroids.ts";
import { fromScreen, toScreen } from "./convex.ts";
import { drawnRock, loopReach, rocksOverlap } from "./rockSpacing.ts";
import type { Vec } from "./types.ts";
import { worldCell, worldCellKey, worldCellOrigin, worldGrid } from "./worldCells.ts";

/** Asteroid variants and the galaxy's field weights; without them rocks use `rockRadius`. */
export interface ChunkAsteroids {
  readonly field: AsteroidField;
  readonly shapes: readonly AsteroidShape[];
}

export interface ChunkPlanOptions {
  /** Target multiplier, at least 1; absent keeps the base plan and slot geometry can limit additions. */
  readonly asteroidDensity?: number;
  readonly worldSide?: number;
  readonly asteroids?: ChunkAsteroids;
  readonly clearance: number;
  readonly objectsPerChunk: number;
  readonly rockRadius: number;
  readonly galaxy: GalaxyNumber;
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
  return mix(mix(mix(options.seed, options.galaxy), options.x), options.y);
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
  if (
    options.asteroidDensity !== undefined &&
    (!Number.isFinite(options.asteroidDensity) || options.asteroidDensity < 1)
  ) {
    throw new RangeError("Invalid asteroid density");
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
  options: ChunkPlanOptions,
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
  return { id, seed };
}

/** The sizes a rock steps down through, largest first, ending at small. */
const STEP_DOWN: Readonly<Record<AsteroidSize, AsteroidSize | null>> = {
  huge: "large",
  large: "medium",
  medium: "small",
  small: null,
};

/** The seeded variant of a size for a slot's step, or undefined without one. */
function variantOf(
  asteroids: ChunkAsteroids,
  size: AsteroidSize,
  seed: number,
  salt: number,
): AsteroidShape | undefined {
  const variants = asteroids.shapes.filter((shape) => shape.size === size);
  return variants.length ? variants[mix(seed, salt) % variants.length] : undefined;
}

/**
 * The chunk's large feature as first rolled, at a quadrant centre clear of edges and corridors,
 * or undefined without one.
 */
function rolledFeature(
  options: ChunkPlanOptions,
  id: ChunkTemplateId,
  seed: number,
): { readonly placement: ChunkPlacement; readonly shape: AsteroidShape } | undefined {
  const { asteroids } = options;
  if (
    !asteroids ||
    options.spawnWeights.rock <= 0 ||
    unit(seed, 997) >= (asteroids.field.featureChance[id] ?? 0)
  ) {
    return undefined;
  }
  const chosen = asteroid(asteroids, asteroids.field.featureSizes, seed, 1009);
  const halfWidth = options.shipRadius + options.clearance;
  if (!chosen || chosen.shape.radius + halfWidth > options.size / 4) {
    return undefined;
  }
  const quadrant = mix(seed, 991) % 4;
  return {
    placement: {
      asteroid: chosen.shape.id,
      id: `chunk:${options.x},${options.y}:feature`,
      kind: "rock",
      radius: chosen.shape.radius,
      x:
        worldCellOrigin(worldGrid(options, options.size), options).x +
        (quadrant % 2 ? 0.75 : 0.25) * options.size,
      y:
        worldCellOrigin(worldGrid(options, options.size), options).y +
        (quadrant < 2 ? 0.25 : 0.75) * options.size,
    },
    shape: chosen.shape,
  };
}

/** Whether rock a gives way to rock b where they overlap: the smaller drawn rock, then the later id. */
function yields(a: ChunkPlacement, b: ChunkPlacement): boolean {
  const reachA = drawnRock(a)?.reach ?? 0;
  const reachB = drawnRock(b)?.reach ?? 0;
  return reachA !== reachB ? reachA < reachB : a.id > b.id;
}

/**
 * The chunk's feature after spacing: it steps down a size while it overlaps a neighbouring
 * chunk's feature, as first rolled, that it yields to, and is dropped past small. Neighbours'
 * features compare as rolled, so every chunk decides from the same facts.
 */
function spacedFeature(
  options: ChunkPlanOptions,
  rolled: { readonly placement: ChunkPlacement; readonly shape: AsteroidShape } | undefined,
  neighbours: readonly ChunkPlacement[],
): ChunkPlacement | undefined {
  if (!rolled || !options.asteroids) {
    return rolled?.placement;
  }
  const rank = rolled.placement;
  let placement: ChunkPlacement | undefined = rolled.placement;
  let size: AsteroidSize | null = rolled.shape.size;
  let step = 0;
  while (
    placement &&
    neighbours.some((other) => yields(rank, other) && rocksOverlap(placement!, other))
  ) {
    size = size ? STEP_DOWN[size] : null;
    const shape = size
      ? variantOf(options.asteroids, size, seedFor(options), 1011 + step++)
      : undefined;
    placement = shape ? { ...placement, asteroid: shape.id, radius: shape.radius } : undefined;
  }
  return placement;
}

/** The rolled features of the eight chunks around this one. */
function neighbourFeatures(catalog: ChunkCatalog, options: ChunkPlanOptions): ChunkPlacement[] {
  const features: ChunkPlacement[] = [];
  const grid = worldGrid(options, options.size);
  const seen = new Set([worldCellKey(grid, options)]);
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      if (dx || dy) {
        const raw = { x: options.x + dx, y: options.y + dy };
        const cell = worldCell(grid, raw);
        const identity = worldCellKey(grid, cell);
        if (seen.has(identity)) {
          continue;
        }
        seen.add(identity);
        const around = { ...options, ...cell };
        const { id, seed } = chunkTemplate(catalog, around);
        const feature = rolledFeature(around, id, seed);
        if (feature) {
          features.push({
            ...feature.placement,
            x: feature.placement.x + (raw.x - cell.x) * options.size,
            y: feature.placement.y + (raw.y - cell.y) * options.size,
          });
        }
      }
    }
  }
  return features;
}

// A screen disc of radius r covers world offsets up to sqrt(5) / 2 r along x or along y.
const WORLD_SPAN = Math.sqrt(5) / 2;
// Respacing passes per round, and step-down rounds per chunk.
const RESPACE_PASSES = 200;
const STEP_ROUNDS = 8;
// A pass moves an overlapping pair apart by at most this many screen px each.
const RESPACE_STEP = 4;
const BOX_MARGIN = 1e-6;

/** A slot's rock as spacing moves and steps it down. */
interface Slot {
  placement: ChunkPlacement;
  size: AsteroidSize | null;
  steps: number;
  readonly drift?: Drift;
  readonly salt: number;
}

/**
 * Where a slot may sit, chunk-local: its quadrant, clear of the corridors by its radius and the
 * ship's half width, and far enough in from the chunk's edges that its drawn rock never reaches
 * a neighbouring chunk.
 */
function slotBox(
  options: ChunkPlanOptions,
  origin: Vec,
  placement: ChunkPlacement,
  extra = 0,
): { readonly x: readonly [number, number]; readonly y: readonly [number, number] } {
  const half = options.size / 2;
  const halfWidth = options.shipRadius + options.clearance;
  const corridor = placement.radius + halfWidth;
  const edge = Math.max(corridor, WORLD_SPAN * ((drawnRock(placement)?.reach ?? 0) + extra));
  // A hair inside each limit, so a rock moved onto one keeps its clearance in floating point.
  const range = (local: number): [number, number] => {
    const [from, to] =
      local < half ? [edge, half - corridor] : [half + corridor, options.size - edge];
    return from + 2 * BOX_MARGIN <= to
      ? [from + BOX_MARGIN, to - BOX_MARGIN]
      : [(from + to) / 2, (from + to) / 2];
  };
  return { x: range(placement.x - origin.x), y: range(placement.y - origin.y) };
}

/**
 * Moves the slots' rocks apart until none overlaps another or a fixed rock on the screen, each
 * held to its slot box: overlapping pairs part along the screen line between them a step at a
 * time, and a slot beside the feature keeps its ship-width gap from it.
 */
function respace(
  options: ChunkPlanOptions,
  origin: Vec,
  fixed: readonly ChunkPlacement[],
  feature: ChunkPlacement | undefined,
  slots: readonly Slot[],
): void {
  const halfWidth = options.shipRadius + options.clearance;
  // Moves a slot within its box, and returns whether it moved.
  const move = (slot: Slot, by: Vec): boolean => {
    const box = slotBox(options, origin, slot.placement);
    const x = origin.x + Math.min(box.x[1], Math.max(box.x[0], slot.placement.x + by.x - origin.x));
    const y = origin.y + Math.min(box.y[1], Math.max(box.y[0], slot.placement.y + by.y - origin.y));
    if (Math.abs(x - slot.placement.x) < 1e-9 && Math.abs(y - slot.placement.y) < 1e-9) {
      return false;
    }
    slot.placement = { ...slot.placement, x, y };
    return true;
  };
  // The screen step that parts b from a, b's share.
  const apart = (a: Vec, b: Vec, reach: number): Vec => {
    const offset = toScreen({ x: b.x - a.x, y: b.y - a.y });
    const distance = Math.hypot(offset.x, offset.y);
    const direction =
      distance > 0 ? { x: offset.x / distance, y: offset.y / distance } : { x: 1, y: 0 };
    const step = Math.min(RESPACE_STEP, Math.max(0.5, (reach - distance) / 2));
    return fromScreen({ x: direction.x * step, y: direction.y * step });
  };
  const reach = (placement: ChunkPlacement) => drawnRock(placement)?.reach ?? 0;
  // Each rock starts inside its box, so its drawn rock stays in the chunk.
  for (const slot of slots) {
    move(slot, { x: 0, y: 0 });
  }
  for (let pass = 0; pass < RESPACE_PASSES; pass++) {
    let moved = false;
    for (let a = 0; a < slots.length; a++) {
      const first = slots[a]!;
      for (const rock of fixed) {
        if (rocksOverlap(rock, first.placement)) {
          const by = apart(rock, first.placement, reach(rock) + reach(first.placement));
          moved = move(first, { x: 2 * by.x, y: 2 * by.y }) || moved;
        }
      }
      if (feature) {
        const world = Math.hypot(first.placement.x - feature.x, first.placement.y - feature.y);
        const gap = feature.radius + first.placement.radius + 2 * halfWidth;
        if (world < gap) {
          const scale = world > 0 ? Math.min(RESPACE_STEP, gap - world) / world : 0;
          moved =
            move(first, {
              x: (first.placement.x - feature.x) * scale || RESPACE_STEP,
              y: (first.placement.y - feature.y) * scale,
            }) || moved;
        }
      }
      for (let b = a + 1; b < slots.length; b++) {
        const second = slots[b]!;
        if (!rocksOverlap(first.placement, second.placement)) {
          continue;
        }
        const by = apart(
          first.placement,
          second.placement,
          reach(first.placement) + reach(second.placement),
        );
        const pushed = move(second, by);
        moved = move(first, { x: -by.x, y: -by.y }) || pushed || moved;
      }
    }
    if (!moved) {
      return;
    }
  }
}

/** Whether a slot still overlaps a fixed rock or a slot it gives way to, or sits too near the feature. */
function blocked(
  options: ChunkPlanOptions,
  fixed: readonly ChunkPlacement[],
  feature: ChunkPlacement | undefined,
  slots: readonly Slot[],
  slot: Slot,
): boolean {
  const halfWidth = options.shipRadius + options.clearance;
  return (
    fixed.some((rock) => rocksOverlap(rock, slot.placement)) ||
    (feature !== undefined &&
      Math.hypot(slot.placement.x - feature.x, slot.placement.y - feature.y) <
        feature.radius + slot.placement.radius + 2 * halfWidth) ||
    slots.some(
      (other) =>
        other !== slot &&
        yields(slot.placement, other.placement) &&
        rocksOverlap(slot.placement, other.placement),
    )
  );
}

/** Pure plans use normalized authored slots and return world coordinates without retaining visits. */
export function planChunk(catalog: ChunkCatalog, rawOptions: ChunkPlanOptions): ChunkPlan {
  validate(rawOptions);
  const options = {
    ...rawOptions,
    ...worldCell(worldGrid(rawOptions, rawOptions.size), rawOptions),
  };
  const { id, seed } = chunkTemplate(catalog, options);
  const origin = worldCellOrigin(worldGrid(options, options.size), options);
  const center = { x: origin.x + options.size / 2, y: origin.y + options.size / 2 };
  const halfWidth = options.shipRadius + options.clearance;
  const templateSlots = TEMPLATES[id];
  const count = Math.min(options.objectsPerChunk, templateSlots.length);
  const weights = options.spawnWeights;
  const totalSpawn = weights.resource + weights.rock + weights.enemy + weights.pickup;
  const asteroids = options.asteroids;
  const around = asteroids ? neighbourFeatures(catalog, options) : [];
  // At most one large feature per chunk sits at a quadrant center, clear of edges and corridors.
  const rolled = rolledFeature(options, id, seed);
  const feature = spacedFeature(options, rolled, around);
  const slots: Slot[] = [];
  const pickups: ChunkPlacement[] = [];
  // Placed resource rocks follow the large-every pattern from a seeded start.
  let resources = mix(seed, 3001) % RESOURCE_ROCKS.largeEvery;
  for (let slot = 0; slot < count; slot++) {
    const local = templateSlots[(slot + (seed % templateSlots.length)) % templateSlots.length]!;
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
    // Slots beside the feature as rolled keep a ship-width gap so it never seals them in.
    if (
      rolled &&
      Math.hypot(at.x - rolled.placement.x, at.y - rolled.placement.y) <
        rolled.placement.radius + radius + 2 * halfWidth
    ) {
      continue;
    }
    if (resource) {
      resources++;
    }
    const placement: ChunkPlacement = {
      ...(chosen ? { asteroid: chosen.shape.id } : ore ? { asteroid: ore.id } : {}),
      id: `chunk:${options.x},${options.y}:${slot}`,
      kind,
      radius,
      ...(resource ? { resource } : {}),
      ...at,
    };
    if (kind === "pickup" || !placement.asteroid) {
      pickups.push(placement);
      continue;
    }
    slots.push({
      ...(chosen?.drift ? { drift: chosen.drift } : {}),
      placement,
      salt: resource ? 3100 + slot : 2000 + slot * 16,
      size: chosen?.shape.size ?? ore?.size ?? null,
      steps: 0,
    });
  }
  // Rocks part on the screen; a slot that still overlaps steps down a size and parts again, and
  // one that cannot fit at small is dropped. A resource rock steps down from large to medium
  // only, its class with it.
  const fixed = feature ? [feature, ...around] : around;
  for (let round = 0; round < STEP_ROUNDS; round++) {
    respace(options, origin, fixed, feature, slots);
    const stuck = slots.filter((slot) => blocked(options, fixed, feature, slots, slot));
    if (!stuck.length) {
      break;
    }
    for (const slot of stuck) {
      const resource = slot.placement.resource;
      const next =
        resource === "large" ? "medium" : resource ? null : slot.size ? STEP_DOWN[slot.size] : null;
      const shape =
        next && asteroids
          ? variantOf(asteroids, next, seed, slot.salt + 7 + slot.steps)
          : undefined;
      slot.steps++;
      if (!shape) {
        slots.splice(slots.indexOf(slot), 1);
        continue;
      }
      slot.size = next;
      slot.placement = {
        ...slot.placement,
        asteroid: shape.id,
        radius: shape.radius,
        ...(resource ? { resource: next as ResourceClass } : {}),
      };
    }
  }
  // Whatever still overlaps after the last round gives way.
  for (const slot of [...slots]) {
    if (blocked(options, fixed, feature, slots, slot)) {
      slots.splice(slots.indexOf(slot), 1);
    }
  }
  const placements: ChunkPlacement[] = [...slots.map((slot) => slot.placement), ...pickups];
  const slotOf = (placement: ChunkPlacement) =>
    Number(placement.id.slice(placement.id.lastIndexOf(":") + 1));
  placements.sort((a, b) => slotOf(a) - slotOf(b));
  if (feature) {
    placements.push(feature);
  }
  // A drift path stays clear of the corridors, the chunk's edges and every other rock's drawn
  // reach and path, and leaves a ship-width gap to its neighbours. Paths are assigned in order and
  // each one leaves room for those before it, so no two paths overlap.
  for (const slot of slots) {
    const shape =
      slot.drift && asteroids
        ? asteroids.shapes.find((s) => s.id === slot.placement.asteroid)
        : undefined;
    if (!slot.drift || !shape?.drift.eligible) {
      continue;
    }
    const index = placements.findIndex((placement) => placement.id === slot.placement.id);
    const placement = placements[index]!;
    const own = drawnRock(placement)?.reach ?? 0;
    const local = { x: placement.x - origin.x, y: placement.y - origin.y };
    const corridorFree =
      Math.min(
        local.x,
        local.y,
        options.size - local.x,
        options.size - local.y,
        Math.abs(local.x - options.size / 2),
        Math.abs(local.y - options.size / 2),
      ) -
      placement.radius -
      halfWidth;
    const edgeFree =
      (Math.min(local.x, local.y, options.size - local.x, options.size - local.y) / WORLD_SPAN -
        own) /
      Math.SQRT2;
    const room = [...placements, ...around].reduce(
      (limit, other) => {
        if (other.id === placement.id) {
          return limit;
        }
        const offset = toScreen({ x: other.x - placement.x, y: other.y - placement.y });
        const screen =
          (Math.hypot(offset.x, offset.y) -
            own -
            (drawnRock(other)?.reach ?? other.radius) -
            loopReach(other.orbit?.radius ?? 0)) /
          Math.SQRT2;
        const world =
          Math.hypot(other.x - placement.x, other.y - placement.y) -
          other.radius -
          (other.orbit?.radius ?? 0) -
          placement.radius -
          2 * halfWidth;
        return Math.min(limit, screen, world);
      },
      Math.min(corridorFree, edgeFree),
    );
    if (room < ORBIT_RADIUS[0]) {
      continue;
    }
    const { drift } = slot;
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
  const density = options.asteroidDensity ?? 1;
  if (density > 1 && options.asteroids) {
    const ordinary = placements.filter((placement) => placement.kind !== "pickup");
    const extra = ordinary.length * (density - 1);
    const wanted = Math.floor(extra) + (unit(seed, 9001) < extra % 1 ? 1 : 0);
    const known = new Set(placements.map((placement) => placement.id));
    let added = 0;
    // Only unused authored slots provide additions. Existing geometry, drift and cache rolls stay fixed.
    for (let budget = count + 1; budget <= templateSlots.length && added < wanted; budget++) {
      const candidates = planChunk(catalog, {
        ...options,
        asteroidDensity: 1,
        objectsPerChunk: budget,
        spawnWeights: { ...options.spawnWeights, enemy: 0, pickup: 0 },
      });
      for (const candidate of candidates.placements) {
        if (added >= wanted) {
          break;
        }
        if (candidate.kind === "pickup" || known.has(candidate.id)) {
          continue;
        }
        const proposal: Slot = { placement: candidate, salt: 0, size: null, steps: 0 };
        const fixed = [...around, ...placements];
        // Existing drift loops keep their swept geometry; still additions can use the slot's normal respacing.
        if (!candidate.orbit) {
          respace(options, origin, fixed, feature, [proposal]);
        }
        if (blocked(options, fixed, feature, [proposal], proposal)) {
          continue;
        }
        placements.push(proposal.placement);
        known.add(candidate.id);
        added++;
      }
    }
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
