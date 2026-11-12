import { describe, expect, it } from "vitest";

import {
  asteroidKillSeconds,
  DEFAULT_BEHAVIOUR,
  generateChunk,
  onScreen,
  runScenario,
  scenarioEconomy,
  SCENARIOS,
} from "../../tools/pacing-sim.ts";
import { ASTEROID_SIZES } from "../data/asteroid-catalog.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunk-catalog.ts";
import { ECONOMY } from "../data/economy.ts";
import { sectorEncounters } from "../data/enemy-catalog.ts";
import { byPosition } from "../data/galaxies.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { SCREEN } from "../data/screen.ts";
import type { SectorId } from "../data/types.ts";
import { weaponAt } from "../data/weapon-catalog.ts";
import { ASTEROID_SHAPES, asteroidSize } from "../model/asteroids.ts";
import { planChunk } from "../model/chunk-templates.ts";
import { createFlight } from "../model/flight.ts";

const spawnWeights = PROTOTYPE.tuning.flight.spawnWeights;

describe("pacing simulation world", () => {
  it("generates the same asteroids, caches and encounter packs as a real flight", () => {
    for (const sector of [1, 2] as const satisfies readonly SectorId[]) {
      for (let seed = 1; seed <= 30; seed++) {
        const flight = createFlight(PROTOTYPE, sector, seed, { known: [] });
        const world = {
          catalog: ECONOMY,
          encounters: byPosition(sectorEncounters, sector),
          sector,
          seed,
          spawnWeights,
        };
        const expected = { caches: [] as string[], packs: [] as string[], rocks: [] as string[] };
        for (let x = -2; x <= 2; x++) {
          for (let y = -2; y <= 2; y++) {
            const chunk = generateChunk(world, { x: 0, y: 0 }, x, y);
            expected.rocks.push(
              ...chunk.rocks.map((rock) => `${rock.id}:${rock.size}@${rock.x},${rock.y}`),
            );
            expected.caches.push(
              ...chunk.caches.map((cache) => `${cache.id}@${cache.x},${cache.y}=${cache.amount}`),
            );
            if (chunk.pack) {
              expected.packs.push(`${chunk.pack.id}:${chunk.pack.archetype}x${chunk.pack.count}`);
            }
          }
        }
        const rocks = flight.objects
          .filter((object) => object.kind === "rock")
          .map((object) => `${object.id}:${asteroidSize(object)}@${object.x},${object.y}`);
        const caches = flight.objects
          .filter((object) => object.kind === "pickup" && object.amount !== undefined)
          .map((object) => `${object.id}@${object.x},${object.y}=${object.amount}`);
        const packs = new Map<string, string[]>();
        for (const object of flight.objects) {
          if (object.kind === "enemy" && object.enemy?.packId) {
            const members = packs.get(object.enemy.packId) ?? [];
            members.push(object.enemy.archetype);
            packs.set(object.enemy.packId, members);
          }
        }
        expect(rocks.sort()).toEqual(expected.rocks.sort());
        expect(caches.sort()).toEqual(expected.caches.sort());
        expect([...packs].map(([id, members]) => `${id}:${members[0]}x${members.length}`)).toEqual(
          expected.packs,
        );
      }
    }
  });

  it("uses the scene's isometric viewport for on-screen checks", () => {
    expect(onScreen(SCREEN.height / 2, SCREEN.height / 2)).toBe(true);
    expect(onScreen(SCREEN.height / 2 + 1, SCREEN.height / 2 + 1)).toBe(false);
    expect(onScreen(SCREEN.width / 4, -SCREEN.width / 4)).toBe(true);
    expect(onScreen(SCREEN.width / 4 + 1, -SCREEN.width / 4 - 1)).toBe(false);
  });
});

describe("pacing simulation runs", () => {
  const options = { behaviour: DEFAULT_BEHAVIOUR, minutes: 15, sector: 1 as const, seeds: 3 };

  it("is deterministic for the same seeds and values", () => {
    const scenario = { behaviour: {}, description: "", economy: {}, name: "current", prices: {} };
    expect(runScenario({ ...options, scenario }).runs).toEqual(
      runScenario({ ...options, scenario }).runs,
    );
  });

  it("spends firing time on each asteroid in proportion to its size's hit points", () => {
    const hp = ASTEROID_FIELDS[1]!.hp;
    const laser = weaponAt("laser", 1);
    // Laser deals one hit point per volley, so each hit point costs one interval over the hit rate.
    for (const size of ASTEROID_SIZES) {
      expect(asteroidKillSeconds(DEFAULT_BEHAVIOUR, 1, "laser", size)).toBeCloseTo(
        (hp[size] * laser.intervalSeconds) / DEFAULT_BEHAVIOUR.hitRate,
      );
    }
    const halfAim = { ...DEFAULT_BEHAVIOUR, hitRate: DEFAULT_BEHAVIOUR.hitRate / 2 };
    expect(asteroidKillSeconds(halfAim, 1, "laser", "huge")).toBeCloseTo(
      2 * asteroidKillSeconds(DEFAULT_BEHAVIOUR, 1, "laser", "huge"),
    );
    expect(asteroidKillSeconds(DEFAULT_BEHAVIOUR, 1, "heavyMissile", "huge")).toBeLessThan(
      asteroidKillSeconds(DEFAULT_BEHAVIOUR, 1, "laser", "huge"),
    );
    const { runs, summary } = runScenario({
      ...options,
      scenario: { behaviour: {}, description: "", economy: {}, name: "time", prices: {} },
    });
    expect(summary.asteroidTimeShare).toBeGreaterThan(0);
    for (const run of runs) {
      const shot = ASTEROID_SIZES.reduce((sum, size) => sum + run.asteroidSizes.shot[size], 0);
      expect(shot).toBe(run.asteroidsShot);
      expect(run.asteroidSeconds > 0).toBe(shot > 0);
    }
  });

  it("meets large and huge asteroids at the generated world's share", () => {
    const world = { large: 0, rocks: 0 };
    for (let seed = 1; seed <= 4; seed++) {
      for (let x = -20; x < 20; x++) {
        for (let y = -20; y < 20; y++) {
          const plan = planChunk(CHUNK_CATALOG, {
            asteroids: { field: ASTEROID_FIELDS[1]!, shapes: [...ASTEROID_SHAPES.values()] },
            clearance: PROTOTYPE.tuning.flight.shipRadius,
            objectsPerChunk: PROTOTYPE.tuning.flight.objectsPerChunk,
            rockRadius: PROTOTYPE.tuning.flight.rockRadius,
            sector: 1,
            seed,
            shipRadius: PROTOTYPE.tuning.flight.shipRadius,
            size: PROTOTYPE.tuning.chunkSize,
            spawnWeights,
            x,
            y,
          });
          for (const placement of plan.placements.filter((at) => at.kind === "rock")) {
            const size = ASTEROID_SHAPES.get(placement.asteroid!)!.size;
            world.rocks++;
            world.large += size === "large" || size === "huge" ? 1 : 0;
          }
        }
      }
    }
    const { summary } = runScenario({
      ...options,
      minutes: 60,
      scenario: { behaviour: {}, description: "", economy: {}, name: "sizes", prices: {} },
      seeds: 4,
    });
    const seen = summary.asteroidSizeShare.seen;
    expect(world.large / world.rocks).toBeGreaterThan(0.05);
    expect(seen.large + seen.huge).toBeCloseTo(world.large / world.rocks, 1);
  });

  it("applies value overrides to drops and caches", () => {
    const catalog = scenarioEconomy({ discoveryStardust: 3, enemyStardust: { swarm: 7 } });
    expect(catalog.discoveryStardust).toBe(3);
    expect(catalog.enemyStardust.swarm).toBe(7);
    expect(catalog.enemyStardust.fighter).toBe(ECONOMY.enemyStardust.fighter);
    const base = runScenario({
      ...options,
      scenario: { behaviour: {}, description: "", economy: {}, name: "base", prices: {} },
    });
    const richer = runScenario({
      ...options,
      scenario: {
        behaviour: {},
        description: "",
        economy: { discoveryStardust: ECONOMY.discoveryStardust * 5 },
        name: "richer",
        prices: {},
      },
    });
    expect(base.summary.cachesPerMinute).toBeGreaterThan(0);
    expect(richer.summary.sourcePerMinute.caches).toBeCloseTo(
      base.summary.sourcePerMinute.caches * 5,
      6,
    );
  });

  it("finds more stations by following the direction indicator than by sight alone", () => {
    const stations = (indicatorRange: number) =>
      runScenario({
        ...options,
        minutes: 60,
        scenario: {
          behaviour: {},
          description: "",
          economy: { station: { indicatorRange } },
          name: `indicator ${indicatorRange}`,
          prices: {},
        },
        seeds: 4,
      }).runs.reduce((sum, run) => sum + run.stationSeconds.length, 0);
    expect(ECONOMY.station.indicatorRange).toBe(2000);
    expect(stations(ECONOMY.station.indicatorRange)).toBeGreaterThan(2 * stations(0));
  });

  it("fights galaxy three's capital route guards", () => {
    const { runs } = runScenario({
      ...options,
      scenario: { behaviour: {}, description: "", economy: {}, name: "three", prices: {} },
      sector: 3,
    });
    for (const run of runs) {
      // Both route guards, plus any capital battle met in open space.
      expect(run.destroyed.capital).toBeGreaterThanOrEqual(2);
      expect(run.stardust.guards).toBeGreaterThan(0);
    }
  });

  it("takes and completes every job type only when jobs are on, paid from the rewards table", () => {
    const scenario = { behaviour: {}, description: "", economy: {}, name: "jobs", prices: {} };
    const without = runScenario({ ...options, minutes: 40, scenario, seeds: 4 });
    expect(without.runs.every((run) => run.stardust.jobs === 0)).toBe(true);
    const withJobs = runScenario({
      ...options,
      behaviour: { ...DEFAULT_BEHAVIOUR, jobs: true },
      minutes: 40,
      scenario,
      seeds: 4,
    });
    const completed = (type: "survey" | "delivery" | "rescue" | "hunt") =>
      withJobs.runs.reduce((sum, run) => sum + (run.jobs[type] ?? 0), 0);
    for (const type of ["survey", "delivery", "rescue", "hunt"] as const) {
      expect(completed(type)).toBeGreaterThan(0);
    }
    // Galaxy one's rewards are 10 to 25 Stardust a job.
    for (const run of withJobs.runs) {
      const count = Object.values(run.jobs).reduce<number>((sum, value) => sum + (value ?? 0), 0);
      expect(run.stardust.jobs).toBeGreaterThanOrEqual(10 * count);
      expect(run.stardust.jobs).toBeLessThanOrEqual(25 * count);
    }
    expect(withJobs.summary.firstWeaponMinutes.median).toBeLessThan(
      without.summary.firstWeaponMinutes.median,
    );
  });

  it("meets galaxy one's frigates and escorted capital battles from the catalog", () => {
    const { summary } = runScenario({
      ...options,
      minutes: 60,
      scenario: { behaviour: {}, description: "", economy: {}, name: "one", prices: {} },
      seeds: 6,
    });
    expect(summary.metPerMinute.frigate ?? 0).toBeGreaterThan(0);
    expect(summary.metPerMinute.capital ?? 0).toBeGreaterThan(0);
    // Each capital battle brings four escort fighters.
    expect(summary.destroyedPerMinute.fighter ?? 0).toBeGreaterThan(0);
  });
  it("spends Stardust on ammunition for upgrade weapons, in proportion to the pack price", () => {
    const armed = (ammoPackPrice: number, restockPacks = DEFAULT_BEHAVIOUR.restockPacks) =>
      runScenario({
        ...options,
        behaviour: { ...DEFAULT_BEHAVIOUR, restockPacks },
        minutes: 45,
        scenario: { ...SCENARIOS.armed!, behaviour: {}, economy: { ammoPackPrice }, name: "armed" },
        seeds: 4,
      }).summary;
    expect(SCENARIOS.armed!.startWeapons).toEqual(["heavyMissile", "scattershot", "phaser"]);
    const base = armed(ECONOMY.ammo.packPrice);
    expect(base.packPrice).toBe(6);
    expect(base.packsPerHour).toBeGreaterThan(0);
    expect(base.ammoSpentPerMinute).toBeCloseTo(
      (base.packsPerHour / 60) * ECONOMY.ammo.packPrice,
      6,
    );
    // Typical use of the stronger weapons costs about a sixth of income.
    expect(base.ammoShareOfIncome).toBeGreaterThan(0.1);
    expect(base.ammoShareOfIncome).toBeLessThan(0.25);
    expect(armed(ECONOMY.ammo.packPrice * 2).ammoSpentPerMinute).toBeGreaterThan(
      base.ammoSpentPerMinute * 1.5,
    );
    // A player who never restocks spends nothing and runs out to Laser.
    const unstocked = armed(ECONOMY.ammo.packPrice, 0);
    expect(unstocked.ammoSpentPerMinute).toBe(0);
    expect(unstocked.emptiedPerHour).toBeGreaterThan(0);
  });
});
