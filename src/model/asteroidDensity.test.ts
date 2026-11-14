import { describe, expect, it } from "vitest";

import { ASTEROID_FIELDS, CHUNK_CATALOG, type ChunkTemplateId } from "../data/chunkCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { byPosition } from "../data/galaxies.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { type ChunkPlanOptions, planChunk } from "./chunkTemplates.ts";
import { createFlight, ensureDestinationAt } from "./flight.ts";
import { worldOreFieldsNear } from "./oreFields.ts";
import { rocksOverlap } from "./rockSpacing.ts";
import { stationsNear } from "./stations.ts";

function options(galaxy: GalaxyNumber, x: number, y: number): ChunkPlanOptions {
  const tuning = CONTENT.tuning.flight;
  return {
    asteroidDensity: tuning.asteroidDensity,
    asteroids: {
      field: byPosition(ASTEROID_FIELDS, galaxy),
      shapes: [...ASTEROID_SHAPES.values()],
    },
    clearance: tuning.shipRadius,
    galaxy,
    objectsPerChunk: tuning.objectsPerChunk,
    rockRadius: tuning.rockRadius,
    seed: 173,
    shipRadius: tuning.shipRadius,
    size: CONTENT.tuning.chunkSize,
    spawnWeights: tuning.spawnWeights,
    x,
    y,
  };
}

const baselineContent = {
  ...CONTENT,
  tuning: { ...CONTENT.tuning, flight: { ...CONTENT.tuning.flight, asteroidDensity: 1 } },
};

describe("asteroid-only density", () => {
  it("uses the approved global multiplier without increasing the shared cache slot budget", () => {
    expect(CONTENT.tuning.flight.asteroidDensity).toBe(1.2);
    expect(CONTENT.tuning.flight.objectsPerChunk).toBe(5);
    for (const asteroidDensity of [0.9, -1, NaN, Infinity]) {
      expect(() => planChunk(CHUNK_CATALOG, { ...options(1, 1, 1), asteroidDensity })).toThrow();
    }
  });
  it.each([0, 1])("retains baseline geometry and caches with drift chance %s", (driftChance) => {
    let added = 0;
    let moving = 0;
    for (let x = -12; x <= 12; x++) {
      const original = options(1, x, 13);
      const settings = {
        ...original,
        asteroids: { ...original.asteroids!, field: { ...original.asteroids!.field, driftChance } },
      };
      const baseline = planChunk(CHUNK_CATALOG, { ...settings, asteroidDensity: 1 });
      const actual = planChunk(CHUNK_CATALOG, settings);
      for (const placement of baseline.placements) {
        expect(actual.placements).toContainEqual(placement);
        if (placement.orbit) {
          moving++;
        }
      }
      expect(actual.placements.filter(({ kind }) => kind === "pickup")).toEqual(
        baseline.placements.filter(({ kind }) => kind === "pickup"),
      );
      const extras = actual.placements.filter(
        ({ id }) => !baseline.placements.some((old) => old.id === id),
      );
      for (const extra of extras) {
        expect(["rock", "resource"]).toContain(extra.kind);
        const margin =
          extra.radius + (extra.orbit?.radius ?? 0) + settings.shipRadius + settings.clearance;
        expect(Math.abs(extra.x - (settings.x + 0.5) * settings.size)).toBeGreaterThanOrEqual(
          margin - 1e-6,
        );
        expect(Math.abs(extra.y - (settings.y + 0.5) * settings.size)).toBeGreaterThanOrEqual(
          margin - 1e-6,
        );
        expect(
          actual.placements
            .filter(({ id }) => id !== extra.id)
            .some((other) => rocksOverlap(extra, other)),
        ).toBe(false);
      }
      added += extras.length;
      expect(planChunk(CHUNK_CATALOG, settings)).toEqual(actual);
    }
    expect(added).toBeGreaterThan(0);
    if (driftChance === 1) {
      expect(moving).toBeGreaterThan(0);
    }
  });

  it.each([1, 2, 3, 4, 5, 6] as const)(
    "measures accepted placement counts in galaxy %i",
    (galaxy) => {
      const total = { authored: 0, baseline: 0, boosted: 0, caches: 0 };
      const templates = new Map<
        ChunkTemplateId,
        { baseline: number; boosted: number; chunks: number }
      >();
      const origins = [
        { x: 129, y: 97 },
        { x: 193, y: 97 },
        { x: 257, y: 97 },
        { x: -129, y: -97 },
        { x: -193, y: -97 },
        { x: -257, y: -97 },
      ];
      if (galaxy === 2) {
        const field = worldOreFieldsNear({}, galaxy, 20000, { x: 70000, y: 50000 }).find(
          (site) =>
            stationsNear(ECONOMY, galaxy, ORE_FIELDS.clearance + ORE_FIELDS.diameter / 2, site)
              .length === 0,
        );
        expect(field).toBeDefined();
        origins.push({
          x: Math.floor(field!.x / CONTENT.tuning.chunkSize),
          y: Math.floor(field!.y / CONTENT.tuning.chunkSize),
        });
      }
      for (const origin of origins) {
        const point = {
          x: origin.x * CONTENT.tuning.chunkSize,
          y: origin.y * CONTENT.tuning.chunkSize,
        };
        const base = createFlight(baselineContent, galaxy, 173, { known: [] });
        const actual = createFlight(CONTENT, galaxy, 173, { known: [] });
        for (const [content, flight] of [
          [baselineContent, base],
          [CONTENT, actual],
        ] as const) {
          flight.player = { ...point };
          ensureDestinationAt(content, "density-fixture", point, flight);
        }
        const inRegion = ({ x, y }: { x: number; y: number }) =>
          Math.abs(Math.floor(x / CONTENT.tuning.chunkSize) - origin.x) <= 2 &&
          Math.abs(Math.floor(y / CONTENT.tuning.chunkSize) - origin.y) <= 2;
        const before = base.objects.filter(inRegion);
        const after = actual.objects.filter(inRegion);
        const oreBefore = before.filter(({ id }) => id.startsWith("ore:"));
        const oreAfter = after.filter(({ id }) => id.startsWith("ore:"));
        expect(oreAfter).toEqual(oreBefore);
        expect(after.filter(({ kind }) => kind === "enemy").length).toBeLessThanOrEqual(
          before.filter(({ kind }) => kind === "enemy").length,
        );
        const cachesBefore = before.filter(({ role }) => role === "stardust");
        expect(after.filter(({ role }) => role === "stardust")).toEqual(cachesBefore);
        total.caches += cachesBefore.length;
        total.authored += oreBefore.filter(({ kind }) => kind === "resource").length;
        for (let x = origin.x - 2; x <= origin.x + 2; x++) {
          for (let y = origin.y - 2; y <= origin.y + 2; y++) {
            const id = planChunk(CHUNK_CATALOG, {
              ...options(galaxy, x, y),
              asteroidDensity: 1,
              objectsPerChunk: 0,
            }).id;
            const prefix = `chunk:${x},${y}:`;
            const asteroid = (object: { id: string; kind: string }) =>
              object.id.startsWith(prefix) && ["rock", "resource"].includes(object.kind);
            const baseline = before.filter(asteroid).length;
            const boosted = after.filter(asteroid).length;
            const counts = templates.get(id) ?? { baseline: 0, boosted: 0, chunks: 0 };
            counts.baseline += baseline;
            counts.boosted += boosted;
            counts.chunks++;
            templates.set(id, counts);
            total.baseline += baseline;
            total.boosted += boosted;
          }
        }
      }
      console.info(
        "ASTEROID_DENSITY",
        JSON.stringify({
          aggregateRatio: (total.boosted + total.authored) / (total.baseline + total.authored),
          ambientRatio: total.boosted / total.baseline,
          galaxy,
          templates: Object.fromEntries(templates),
          total,
        }),
      );
      const aggregateRatio = (total.boosted + total.authored) / (total.baseline + total.authored);
      expect(aggregateRatio).toBeGreaterThanOrEqual(1.15);
      expect(aggregateRatio).toBeLessThanOrEqual(1.25);
      if (galaxy === 2) {
        expect(total.authored).toBeGreaterThan(0);
      }
    },
  );
});
