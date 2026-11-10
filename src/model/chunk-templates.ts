import type { ChunkCatalog, ChunkTemplateId } from "../data/chunk-catalog.ts";
import type { SectorId } from "../data/types.ts";
import type { Vec } from "./types.ts";

export interface ChunkPlanOptions {
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
export interface ChunkPlacement extends Vec {
  readonly id: string;
  readonly kind: "rock" | "resource" | "pickup";
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
    const radius = options.rockRadius;
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
    placements.push({
      id: `chunk:${options.x},${options.y}:${slot}`,
      kind,
      x: origin.x + x,
      y: origin.y + y,
    });
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
