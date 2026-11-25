import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { SLOT_ROCKS_PER_AREA, SPAWN_AREA_CHUNKS, SPAWN_TARGETS } from "../data/spawnTargets.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import {
  ACCEPTANCE,
  ACCEPTANCE_SEEDS,
  accepted,
  bandAcceptance,
} from "../testing/spawnAcceptance.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { encounterSpacing } from "./flight.ts";
import { encounterLatticeSpacing, spawnRules } from "./spawnTargets.ts";

const EVERY_BAND = GALAXY_NUMBERS.flatMap((galaxy) => [0, 1, 2].map((band) => `${galaxy}:${band}`));

/**
 * Spawn targets the planner does not deliver, by kind, as `galaxy:band`. Each runs as an
 * expected failure until its target or placement changes; the main dropping rule is noted.
 */
const KNOWN_FAILURES: Readonly<Record<string, readonly string[]>> = {
  // Group spacing, then admission: anchors kept a lattice spacing apart at random positions
  // jam below the table's group densities.
  capital: EVERY_BAND,
  fighter: EVERY_BAND,
  frigate: EVERY_BAND,
  interceptor: EVERY_BAND,
  // Overlap: at these requests, slot rocks and enemy groups leave room for about two thirds.
  resource: EVERY_BAND,
  retaliator: EVERY_BAND,
  swarm: EVERY_BAND.filter((band) => band !== "6:1"),
};

describe("spawn target catalog", () => {
  it("measures gathering reach on flight's encounter lattice", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      expect(encounterLatticeSpacing(galaxy)).toBe(encounterSpacing(CONTENT, galaxy));
    }
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
        expect(rock("resource").density).toBeCloseTo(table.resources / SPAWN_AREA_CHUNKS);
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
