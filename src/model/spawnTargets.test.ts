import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import {
  ACCEPTANCE,
  ACCEPTANCE_SEEDS,
  accepted,
  bandAcceptance,
} from "../testing/spawnAcceptance.ts";
import { encounterSpacing } from "./flight.ts";
import { interimEncounterSpacing, interimSpawnRules } from "./spawnTargets.ts";

const EVERY_BAND = GALAXY_NUMBERS.flatMap((galaxy) => [0, 1, 2].map((band) => `${galaxy}:${band}`));

/**
 * Interim targets the planner does not deliver, by kind, as `galaxy:band`. Each runs as an
 * expected failure until its target or placement changes; the main dropping rule is noted.
 */
const KNOWN_FAILURES: Readonly<Record<string, readonly string[]>> = {
  // The arrival calm radius.
  interceptor: ["2:0", "4:0"],
  // Overlap: the static rock target exceeds the room between the lanes and the enemy groups.
  resource: EVERY_BAND,
  // Ore fields in galaxy two and currents in galaxy three.
  rock: ["2:1", "2:2", "3:0", "3:1", "3:2"],
  // Corridor: huge rocks cannot fit a quadrant between the lanes.
  "rock-feature": EVERY_BAND,
  // The arrival calm radius.
  swarm: ["4:0"],
};

describe("interim spawn targets", () => {
  it("space enemy groups on flight's encounter lattice", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      expect(interimEncounterSpacing(galaxy)).toBe(encounterSpacing(CONTENT, galaxy));
    }
  });
});

const ACCEPTANCE_NAME =
  `spawn targets deliver ${ACCEPTANCE.deliveredShare} of requests in ${ACCEPTANCE.areaShare} ` +
  `of 3x3-chunk areas over seeds ${ACCEPTANCE_SEEDS.join(", ")}`;

describe(ACCEPTANCE_NAME, () => {
  for (const galaxy of GALAXY_NUMBERS) {
    const rules = interimSpawnRules(galaxy, GALAXY_SIDE);
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
