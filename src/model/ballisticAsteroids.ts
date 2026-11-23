import { randomStream } from "@andornaut/game-kit/runtime/random";

import { ASTEROID_SIZES } from "../data/asteroidCatalog.ts";
import { byPosition } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import type { SpaceObject, Vec } from "./types.ts";
import { worldCell, worldCellCenter, worldCellKey, type WorldGrid } from "./worldCells.ts";

// Snapshot of the original opportunity lattice and its one-in-four branch. This baseline
// anchors the target without changing when enemy difficulty or encounter rates are tuned.
const ORIGINAL_ENCOUNTERS = {
  chance: 1 / 4,
  quietDistance: 1800,
  rates: { 1: 1.725, 2: 1.8975, 3: 2.07, 4: 2.2425, 5: 2.415, 6: 2.5875 },
} as const;
const COUNT = [3, 7] as const;
const GROUP_SHARE = 0.75;
const SPEED = [10, 80] as const;
const SIZE_LIMITS = [0.6, 0.9, 0.99, 1] as const;
const VARIANTS = ASTEROID_SIZES.map((size) =>
  [...ASTEROID_SHAPES.values()].filter((shape) => shape.size === size),
);

interface BallisticContext {
  readonly encounterSeed: number;
  readonly galaxy: GalaxyNumber;
  readonly rockHp: number;
}

function velocity(next: () => number): Vec {
  const heading = next() * 2 * Math.PI;
  const speed = SPEED[0] + next() * (SPEED[1] - SPEED[0]);
  return { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed };
}

/** A cell index hosts an opportunity if it contains a multiple of its lattice spacing. */
export function hostsEncounterCell(spacing: number, index: number): boolean {
  return Math.ceil(index / spacing) * spacing < index + 1;
}

export function ballisticEncounterSpacing(chunkSize: number, galaxy: GalaxyNumber): number {
  const base = Math.max(3, Math.ceil(ORIGINAL_ENCOUNTERS.quietDistance / chunkSize));
  return base / Math.sqrt(byPosition(ORIGINAL_ENCOUNTERS.rates, galaxy));
}

/** Requested movers from a dedicated local stream, before any caller-owned clearances. */
export function planBallisticAsteroids(
  context: BallisticContext,
  grid: WorldGrid,
  cell: Vec,
): SpaceObject[] {
  const { x, y } = worldCell(grid, cell);
  const spacing = ballisticEncounterSpacing(grid.nominalPitch, context.galaxy);
  if (!hostsEncounterCell(spacing, x) || !hostsEncounterCell(spacing, y)) {
    return [];
  }
  const key = worldCellKey(grid, { x, y });
  const next = randomStream(context.encounterSeed, `ballistic-encounter:${key}`);
  if (next() >= 3 * ORIGINAL_ENCOUNTERS.chance) {
    return [];
  }
  const count = COUNT[0] + Math.floor(next() * (COUNT[1] - COUNT[0] + 1));
  const groupCount = Math.round(count * GROUP_SHARE);
  const center = worldCellCenter(grid, { x, y });
  const offset = (span: number) => (next() - 0.5) * span;
  const halfPitch = grid.pitch / 2;
  const group = { x: center.x + offset(halfPitch), y: center.y + offset(halfPitch) };
  return Array.from({ length: count }, (_, index) => {
    const id = `ballistic:${key}:${index}`;
    const rock = randomStream(context.encounterSeed, `ballistic-shape:${id}`);
    const size = rock();
    const variants = VARIANTS[SIZE_LIMITS.findIndex((limit) => size < limit)]!;
    const shape = variants[Math.floor(rock() * variants.length)]!;
    const grouped = index < groupCount;
    const anchor = grouped ? group : center;
    const span = grouped ? halfPitch : grid.pitch;
    return {
      asteroid: shape.id,
      hp: context.rockHp,
      id,
      kind: "debris",
      radius: shape.radius,
      x: anchor.x + offset(span),
      y: anchor.y + offset(span),
    };
  });
}

/** Assign motion once clearances have selected the survivors of this one cell's plan. */
export function assignBallisticVelocities(
  encounterSeed: number,
  rocks: readonly SpaceObject[],
): void {
  const first = rocks[0];
  if (!first) {
    return;
  }
  const cell = first.id.slice(0, first.id.lastIndexOf(":"));
  const group = velocity(randomStream(encounterSeed, `${cell}:group-motion`));
  // Singletons are solo. Round groups up so low-count cells do not compound that loss.
  const groupCount = rocks.length > 1 ? Math.ceil(rocks.length * GROUP_SHARE) : 0;
  for (const [index, rock] of rocks.entries()) {
    rock.velocity =
      index < groupCount
        ? { ...group }
        : velocity(randomStream(encounterSeed, `${rock.id}:solo-motion`));
  }
}
