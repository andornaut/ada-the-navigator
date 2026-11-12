import { describe, expect, it } from "vitest";

import { CHUNK_CATALOG, type ChunkCatalog, type ChunkTemplateId } from "../data/chunkCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { type ChunkPlan, type ChunkPlanOptions, planChunk } from "./chunkTemplates.ts";

const options: ChunkPlanOptions = {
  clearance: CONTENT.tuning.flight.shipRadius,
  galaxy: 1,
  objectsPerChunk: CONTENT.tuning.flight.objectsPerChunk,
  rockRadius: CONTENT.tuning.flight.rockRadius,
  seed: 173,
  shipRadius: CONTENT.tuning.flight.shipRadius,
  size: CONTENT.tuning.chunkSize,
  spawnWeights: CONTENT.tuning.flight.spawnWeights,
  x: -3,
  y: -2,
};
const families: readonly ChunkTemplateId[] = ["quiet", "cluster", "passage", "poi"];
function catalogFor(id: ChunkTemplateId): ChunkCatalog {
  return { 1: [{ id, weight: 1 }], 2: [{ id, weight: 1 }], 3: [{ id, weight: 1 }] };
}
function clearCross(plan: ChunkPlan, settings: ChunkPlanOptions): void {
  const center = { x: (settings.x + 0.5) * settings.size, y: (settings.y + 0.5) * settings.size };
  const free = settings.shipRadius + settings.clearance;
  for (const placement of plan.placements) {
    expect(Math.abs(placement.x - center.x) - settings.rockRadius).toBeGreaterThanOrEqual(free);
    expect(Math.abs(placement.y - center.y) - settings.rockRadius).toBeGreaterThanOrEqual(free);
  }
}

describe("stateless chunk plans", () => {
  it("regenerates negative coordinates identically without retaining traversal history", () => {
    const before = planChunk(CHUNK_CATALOG, options);
    const serialized = JSON.stringify(before);
    planChunk(CHUNK_CATALOG, { ...options, x: 50, y: 75 });
    planChunk(CHUNK_CATALOG, { ...options, galaxy: 3, x: -90, y: 4 });
    expect(planChunk(CHUNK_CATALOG, options)).toEqual(before);
    expect(JSON.stringify(before)).toBe(serialized);
    expect(before.placements.every((placement) => placement.x < 0 && placement.y < 0)).toBe(true);
    expect(new Set(before.placements.map((placement) => placement.id)).size).toBe(
      before.placements.length,
    );
  });

  it("joins opposite ports of different templates with real-radius clearance, including negative boundaries", () => {
    for (let i = 0; i < families.length; i++) {
      const left = planChunk(catalogFor(families[i]!), options);
      const rightOptions = { ...options, x: options.x + 1 };
      const right = planChunk(catalogFor(families[(i + 1) % families.length]!), rightOptions);
      const belowOptions = { ...options, y: options.y + 1 };
      const below = planChunk(catalogFor(families[(i + 2) % families.length]!), belowOptions);
      expect(left.id).not.toBe(right.id);
      expect(left.ports.east).toEqual(right.ports.west);
      expect(left.ports.south).toEqual(below.ports.north);
      expect(left.ports.east.halfWidth).toBeGreaterThan(options.shipRadius);
      clearCross(left, options);
      clearCross(right, rightOptions);
      clearCross(below, belowOptions);
    }
  });

  it("bounds placements to authored slots and configured count without introducing story or combat entities", () => {
    const allRock = { enemy: 0, pickup: 0, resource: 0, rock: 1 };
    for (const family of families) {
      const many = planChunk(catalogFor(family), {
        ...options,
        objectsPerChunk: 100000,
        spawnWeights: allRock,
      });
      expect(many.placements.length).toBeLessThanOrEqual(8);
      expect(many.placements.length).toBeGreaterThan(0);
      const capped = planChunk(catalogFor(family), {
        ...options,
        objectsPerChunk: 2,
        spawnWeights: allRock,
      });
      expect(capped.placements.length).toBeLessThanOrEqual(2);
      const combatOnly = planChunk(catalogFor(family), {
        ...options,
        spawnWeights: { ...allRock, enemy: 1, rock: 0 },
      });
      expect(combatOnly.placements).toEqual([]);
      expect(many.placements.every((placement) => placement.kind === "rock")).toBe(true);
    }
  });

  it("uses the galaxy catalog and configured content weights without changing the shared openings", () => {
    // By route position: Sunflower 1, Whirlpool (galaxy 3) 2, Cartwheel (galaxy 2) 5.
    const catalog: ChunkCatalog = {
      1: [{ id: "quiet", weight: 1 }],
      2: [{ id: "poi", weight: 1 }],
      5: [{ id: "cluster", weight: 1 }],
    };
    const first = planChunk(catalog, options);
    const second = planChunk(catalog, {
      ...options,
      galaxy: 2,
      spawnWeights: { enemy: 0, pickup: 0, resource: 1, rock: 0 },
    });
    const third = planChunk(catalog, { ...options, galaxy: 3 });
    expect([first.id, second.id, third.id]).toEqual(["quiet", "cluster", "poi"]);
    expect(second.placements.length).toBeGreaterThan(0);
    expect(second.placements.every((placement) => placement.kind === "resource")).toBe(true);
    expect(first.ports).toEqual(second.ports);
    expect(second.ports).toEqual(third.ports);
    clearCross(second, { ...options, galaxy: 2 });
  });

  it("drops scenery that cannot fit clearances instead of sealing a passage", () => {
    // Resource rocks take their class radius, so only plain rocks read the wide rockRadius.
    const constrained = {
      ...options,
      rockRadius: options.size / 2,
      spawnWeights: { ...options.spawnWeights, resource: 0 },
    };
    const plan = planChunk(catalogFor("passage"), constrained);
    expect(plan.placements).toEqual([]);
    expect(plan.ports.east.halfWidth).toBe(options.shipRadius + options.clearance);
    expect(() => planChunk(CHUNK_CATALOG, { ...options, clearance: 0 })).toThrow(RangeError);
  });
});
