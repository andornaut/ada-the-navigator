import { describe, expect, it } from "vitest";

import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunk-catalog.ts";
import { byPosition } from "../data/galaxies.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { type ChunkPlacement, planChunk } from "./chunk-templates.ts";
import { drawnRock, rocksOverlap } from "./rock-spacing.ts";

const shapes = [...ASTEROID_SHAPES.values()];
const tuning = PROTOTYPE.tuning;
const plan = (sector: 1 | 2 | 3, seed: number, x: number, y: number) =>
  planChunk(CHUNK_CATALOG, {
    asteroids: { field: byPosition(ASTEROID_FIELDS, sector), shapes },
    clearance: tuning.flight.shipRadius,
    objectsPerChunk: tuning.flight.objectsPerChunk,
    rockRadius: tuning.flight.rockRadius,
    sector,
    seed,
    shipRadius: tuning.flight.shipRadius,
    size: tuning.chunkSize,
    spawnWeights: tuning.flight.spawnWeights,
    x,
    y,
  }).placements;

const rock = (asteroid: string, x: number, y: number, orbit = 0): ChunkPlacement => ({
  asteroid,
  id: `${asteroid}@${x},${y}`,
  kind: "rock",
  radius: ASTEROID_SHAPES.get(asteroid)!.radius,
  x,
  y,
  ...(orbit ? { orbit: { phase: 0, radius: orbit, rate: 0.1 } } : {}),
});

describe("rock spacing", () => {
  it("overlaps two drawn rocks where their outlines meet on the screen, not their discs", () => {
    const large = "asteroid-l1";
    const reach = drawnRock(rock(large, 0, 0))!.reach;
    expect(rocksOverlap(rock(large, 0, 0), rock(large, 10, 0))).toBe(true);
    // Screen offset (x - y, (x + y) / 2): a world step along x + y moves half as far on screen.
    const far = reach * 2;
    expect(rocksOverlap(rock(large, 0, 0), rock(large, far, far))).toBe(false);
    expect(rocksOverlap(rock(large, 0, 0), { ...rock(large, 0, 0), kind: "pickup" })).toBe(false);
  });

  it("counts a drifting rock anywhere on its loop", () => {
    const small = "asteroid-s1";
    const reach = drawnRock(rock(small, 0, 0))!.reach;
    // Apart on screen by twice the reach plus a little: still, they clear; a loop closes the gap.
    const apart = 2 * reach + 2;
    expect(rocksOverlap(rock(small, 0, 0), rock(small, apart, apart))).toBe(false);
    expect(rocksOverlap(rock(small, 0, 0, 16), rock(small, apart, apart))).toBe(true);
  });

  it("plans chunks whose drawn rocks never overlap on the screen, across neighbouring chunks", () => {
    let rocks = 0;
    for (const sector of [1, 2, 3] as const) {
      for (const seed of [173, 4242]) {
        const plans = new Map<string, readonly ChunkPlacement[]>();
        const at = (x: number, y: number) => {
          const key = `${x},${y}`;
          if (!plans.has(key)) {
            plans.set(key, plan(sector, seed, x, y));
          }
          return plans.get(key)!;
        };
        for (let x = -4; x < 4; x++) {
          for (let y = -4; y < 4; y++) {
            const around = [-1, 0, 1].flatMap((dx) =>
              [-1, 0, 1].flatMap((dy) => at(x + dx, y + dy)),
            );
            for (const placement of at(x, y)) {
              if (placement.kind === "pickup") {
                continue;
              }
              rocks++;
              const overlapping = around.filter(
                (other) => other !== placement && rocksOverlap(placement, other),
              );
              expect(
                overlapping.map((other) => other.id),
                placement.id,
              ).toEqual([]);
            }
          }
        }
      }
    }
    expect(rocks).toBeGreaterThan(1000);
  });

  it("regenerates the same spaced plan for the same chunk and seed", () => {
    for (const sector of [1, 2, 3] as const) {
      expect(plan(sector, 911, 2, -3)).toEqual(plan(sector, 911, 2, -3));
    }
  });
});
