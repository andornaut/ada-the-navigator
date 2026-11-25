import { describe, expect, it } from "vitest";

import { retaliatorVariant } from "../data/enemyIdentity.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import { SLOT_ROCKS_PER_AREA, SPAWN_AREA_CHUNKS, SPAWN_TARGETS } from "../data/spawnTargets.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import {
  ACCEPTANCE,
  ACCEPTANCE_SEEDS,
  accepted,
  bandAcceptance,
} from "../testing/spawnAcceptance.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { hostileStationSites } from "./hostileStationSites.ts";
import type { ExclusionZone, SpawnCategory } from "./spawnPlanner.ts";
import { spawnRules, worldSpawnExclusions } from "./spawnTargets.ts";

/**
 * Spawn targets the planner does not deliver, by kind, as `galaxy:band`. Each runs as an
 * expected failure until its target or placement changes; the main dropping rule is noted.
 */
const KNOWN_FAILURES: Readonly<Record<string, readonly string[]>> = {};

describe("spawn target catalog", () => {
  it("fills lattice cells at 0.75 times each galaxy's enemy density factor", () => {
    const occupancy = { 1: 0.4575, 2: 0.405, 3: 0.375, 4: 0.375, 5: 0.39, 6: 0.5775 } as const;
    for (const galaxy of GALAXY_NUMBERS) {
      expect(spawnRules(galaxy).lattice!.occupancy).toBeCloseTo(occupancy[galaxy], 12);
    }
  });

  it("sizes footprints, member spacing and escort rings by each design's spacing radius", () => {
    const target = (galaxy: GalaxyNumber, kind: string) =>
      spawnRules(galaxy)
        .bands.flatMap((band) => band.enemies)
        .find((enemy) => enemy.kind === kind)!;
    const line = (galaxy: GalaxyNumber, kind: string) => {
      const enemy = target(galaxy, kind);
      return Math.max(enemy.spacing, 2 * enemy.radius + spawnRules(galaxy).gap);
    };
    // Andromeda flies the Twin hull (58), Phantom the Shoulder frigate (63).
    expect(line(5, "frigate")).toBe(136);
    expect(line(6, "frigate")).toBe(146);
    expect(target(6, "capital").radius).toBe(91);
    // Each frigate's fighter escorts (13) station 60 beyond the frigate's spacing radius.
    expect(target(5, "frigate").escorts).toMatchObject({ radius: 13, ring: 58 + 60 });
    // A retaliator's hull follows from its ship id, its pack's chunk and its index, so each member
    // takes its own hull's; the largest, the Cargo Hauler's, bounds the group's reach.
    const retaliator = target(1, "retaliator");
    expect(retaliator.radius).toBe(45);
    const radii = new Set<number>();
    for (let x = 0; x < 30; x++) {
      const chunk = `${x},0`;
      const hull = retaliatorVariant({ archetype: "retaliator", id: `pack:${chunk}:0` });
      const radius = retaliator.memberRadius!(chunk, 0);
      expect(radius, chunk).toBe(hull === "retaliatorCargoHauler" ? 45 : 30);
      radii.add(radius);
    }
    expect([...radii].sort()).toEqual([30, 45]);
    expect(target(1, "swarm").radius).toBe(8);
  });

  it("keeps salvage zones around the wreck's footprint", () => {
    const local = SPAWNER_POLICIES[5].localRadius;
    let zones: ExclusionZone[] = [];
    for (let x = 0; !zones.length && x < GALAXY_SIDE; x += 4000) {
      zones = worldSpawnExclusions({ worldSide: GALAXY_SIDE }, 5, 11, [], 4000, { x, y: 0 }).filter(
        (zone) => zone.rule === "salvage",
      );
    }
    const shape = (category: SpawnCategory) =>
      zones.find((zone) => zone.applies.includes(category))!.shape;
    // Andromeda's wreck is a Twin hull (58).
    expect(shape("enemy")).toMatchObject({ radius: 2 * local + 58 });
    expect(shape("rock")).toMatchObject({ radius: 58 + spawnRules(5).gap });
  });

  it("keeps hostile station zones around each seeded station site's footprint", () => {
    const context = { galaxy: 5 as const, geographySeed: 11, worldSide: GALAXY_SIDE };
    const half = GALAXY_SIDE / 2;
    const site = hostileStationSites(context, {
      height: GALAXY_SIDE,
      width: GALAXY_SIDE,
      x: -half,
      y: -half,
    })[0]!;
    const zones = worldSpawnExclusions({ worldSide: GALAXY_SIDE }, 5, 11, [], 100, site).filter(
      (zone) => zone.rule === "hostile-station",
    );
    const shape = (category: SpawnCategory) =>
      zones.find((zone) => zone.applies.includes(category))!.shape;
    // Andromeda's station spans 131.3 x 113.7 display px, r 70.
    expect(shape("enemy")).toMatchObject({
      radius: 2 * SPAWNER_POLICIES[5].localRadius + 70,
      x: site.x,
      y: site.y,
    });
    expect(shape("rock")).toMatchObject({ radius: 70 + spawnRules(5).gap });
    // A galaxy without hostile stations has no station zones.
    expect(
      worldSpawnExclusions({ worldSide: GALAXY_SIDE }, 1, 11, [], 100, site).some(
        (zone) => zone.rule === "hostile-station",
      ),
    ).toBe(false);
  });

  it("requests every positive table density from a roster group, per chunk", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      spawnRules(galaxy).bands.forEach((band, index) => {
        const table = SPAWN_TARGETS[galaxy][index]!;
        for (const [kind, density] of Object.entries(table.enemies)) {
          const target = band.enemies.find((enemy) => enemy.kind === kind);
          expect(target?.density ?? 0, `${galaxy}:${index}:${kind}`).toBeCloseTo(
            density / SPAWN_AREA_CHUNKS,
          );
        }
        const rock = (kind: string) => band.rocks.find((target) => target.kind === kind)!;
        expect(rock("rock").density).toBeCloseTo(SLOT_ROCKS_PER_AREA / SPAWN_AREA_CHUNKS);
        expect(band.rocks.map((target) => target.kind)).toEqual(["rock-feature", "rock"]);
        expect(band.moving[0]!.density).toBeCloseTo(table.moving / SPAWN_AREA_CHUNKS);
        expect(rock("rock-feature").density).toBeCloseTo(table.features / SPAWN_AREA_CHUNKS);
        for (const shape of rock("rock-feature").shapes) {
          expect(ASTEROID_SHAPES.get(shape.id)!.size).toBe("large");
        }
      });
    }
  });
});

const ACCEPTANCE_NAME =
  `spawn targets deliver ${ACCEPTANCE.deliveredShare} of requests in ${ACCEPTANCE.areaShare} ` +
  `of 3x3-chunk areas over seeds ${ACCEPTANCE_SEEDS.join(", ")}`;

describe(ACCEPTANCE_NAME, () => {
  for (const galaxy of GALAXY_NUMBERS) {
    const rules = spawnRules(galaxy, GALAXY_SIDE);
    rules.bands.forEach((band, index) => {
      const kinds = new Set([
        ...band.rocks.map((target) => target.kind),
        ...band.moving.map((target) => target.kind),
        ...band.enemies.map((target) => target.kind),
      ]);
      for (const kind of kinds) {
        const name = `${galaxy}:${index}:${kind}`;
        const test = KNOWN_FAILURES[kind]?.includes(`${galaxy}:${index}`) ? it.fails : it;
        test(name, () => {
          const result = bandAcceptance(galaxy, index).kinds[kind];
          expect(result, `${name} was never requested`).toBeDefined();
          expect(accepted(result!), JSON.stringify(result)).toBe(true);
        });
      }
    });
  }
});
