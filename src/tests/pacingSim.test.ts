import { afterAll, describe, expect, it } from "vitest";

import {
  asteroidKillSeconds,
  createScenarioRunner,
  DEFAULT_BEHAVIOUR,
  generateChunk,
  onScreen,
  type RunOptions,
  runScenario,
  scenarioEconomy,
  SCENARIOS,
  summarise,
} from "../../tools/pacing-sim.ts";
import { ASTEROID_SIZES } from "../data/asteroidCatalog.ts";
import { ASTEROID_FIELDS } from "../data/chunkCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { JOB_REWARDS } from "../data/jobs.ts";
import { questReward } from "../data/questRewards.ts";
import { SCREEN } from "../data/screen.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { weaponAt } from "../data/weaponCatalog.ts";
import { asteroidSize } from "../model/asteroids.ts";
import { createFlight } from "../model/flight.ts";

const spawnWeights = CONTENT.tuning.flight.spawnWeights;

describe("pacing simulation world", () => {
  it("generates the same asteroids, caches and encounter packs as a real flight", () => {
    let cachePickups = 0;
    for (const galaxy of [1, 2] as const satisfies readonly GalaxyNumber[]) {
      for (let seed = 1; seed <= 30; seed++) {
        const flight = createFlight(CONTENT, galaxy, seed, { known: [] });
        const world = { catalog: ECONOMY, galaxy, seed, spawnWeights };
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
        cachePickups += caches.length;
        for (const cache of flight.objects.filter((object) => object.kind === "pickup")) {
          expect(cache.id).toMatch(/:stardust:0$/);
          expect(cache.amount).toBe(5);
        }
        expect([...packs].map(([id, members]) => `${id}:${members[0]}x${members.length}`)).toEqual(
          expected.packs,
        );
      }
    }
    expect(cachePickups).toBeGreaterThan(0);
  });

  it("uses the scene's isometric viewport for on-screen checks", () => {
    expect(onScreen(SCREEN.height / 2, SCREEN.height / 2)).toBe(true);
    expect(onScreen(SCREEN.height / 2 + 1, SCREEN.height / 2 + 1)).toBe(false);
    expect(onScreen(SCREEN.width / 4, -SCREEN.width / 4)).toBe(true);
    expect(onScreen(SCREEN.width / 4 + 1, -SCREEN.width / 4 - 1)).toBe(false);
  });
});

/** Recombine the real seed runs with the same aggregate used by the pacing tool. */
function summaryOf(samples: readonly ReturnType<typeof runScenario>[]) {
  const { packPrice, prices, scenario } = samples[0]!.summary;
  return summarise(
    scenario,
    prices,
    packPrice,
    samples.flatMap((sample) => sample.runs),
  );
}

function completeSamples<T>(seeds: readonly number[], samples: ReadonlyMap<number, T>): T[] {
  expect([...samples.keys()].sort((a, b) => a - b)).toEqual(seeds);
  return seeds.map((seed) => samples.get(seed)!);
}

describe("pacing simulation runs", () => {
  const run = createScenarioRunner();
  const options = { behaviour: DEFAULT_BEHAVIOUR, galaxy: 1 as const, minutes: 15, seeds: 3 };

  const runSeed = (config: Omit<RunOptions, "seeds">, seed: number) => {
    const sample = run({ ...config, seeds: [seed] });
    expect(sample.runs.map((flight) => [flight.seed, flight.minutes])).toEqual([
      [seed, config.minutes],
    ]);
    return sample;
  };

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
    // A missile spends a whole volley even when the last hit deals more damage than needed.
    const missile = weaponAt("heavyMissile", 1);
    const damagePerHit = CONTENT.tuning.flight.playerShotDamage * missile.damageRatio;
    const secondsPerHit = missile.intervalSeconds / DEFAULT_BEHAVIOUR.hitRate;
    for (const size of ASTEROID_SIZES) {
      const seconds = asteroidKillSeconds(DEFAULT_BEHAVIOUR, 1, "heavyMissile", size);
      const hits = Math.round(seconds / secondsPerHit);
      expect(seconds).toBeCloseTo(hits * secondsPerHit, 9);
      expect((hits - 1) * damagePerHit).toBeLessThan(hp[size]);
      expect(hits * damagePerHit).toBeGreaterThanOrEqual(hp[size]);
    }
    const { runs, summary } = run({
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

  describe("meets large and huge asteroids at the generated world's share", () => {
    const seeds = [1, 2, 3, 4];
    const samples = new Map<
      number,
      { flight: ReturnType<typeof runSeed>; large: number; rocks: number }
    >();
    const scenario = { behaviour: {}, description: "", economy: {}, name: "sizes", prices: {} };

    it.each(seeds)("samples generated and simulated rocks for seed %i", (seed) => {
      let large = 0;
      let rocks = 0;
      const world = { catalog: ECONOMY, galaxy: 1 as const, seed, spawnWeights };
      // Ada far away, so every planned rock counts.
      const away = { x: 1e9, y: 1e9 };
      for (let x = -12; x < 12; x++) {
        for (let y = -12; y < 12; y++) {
          for (const rock of generateChunk(world, away, x, y).rocks) {
            rocks++;
            large += rock.size === "large" || rock.size === "huge" ? 1 : 0;
          }
        }
      }
      const flight = runSeed({ ...options, minutes: 60, scenario }, seed);
      samples.set(seed, { flight, large, rocks });
    });

    afterAll(() => {
      const results = completeSamples(seeds, samples);
      const worldLarge = results.reduce((sum, sample) => sum + sample.large, 0);
      const worldRocks = results.reduce((sum, sample) => sum + sample.rocks, 0);
      const seen = summaryOf(results.map((sample) => sample.flight)).asteroidSizeShare.seen;
      expect(worldLarge / worldRocks).toBeGreaterThan(0.02);
      expect(seen.large + seen.huge).toBeCloseTo(worldLarge / worldRocks, 1);
    });
  });

  it("applies value overrides to drops and caches", () => {
    const catalog = scenarioEconomy({ discoveryStardust: 3 });
    expect(catalog.discoveryStardust).toBe(3);
    const base = run({
      ...options,
      scenario: { behaviour: {}, description: "", economy: {}, name: "base", prices: {} },
    });
    const richer = run({
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
      run({
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
    expect(ECONOMY.station.indicatorRange).toBe(5000);
    expect(stations(ECONOMY.station.indicatorRange)).toBeGreaterThan(2 * stations(0));
  });

  it("keeps heading for an indicated station however long the trip takes", () => {
    // Cruise slowly enough that crossing the indicator range takes 90 seconds.
    const speedFraction = ECONOMY.station.indicatorRange / (CONTENT.tuning.physics.maxSpeed * 90);
    const behaviour = {
      ...DEFAULT_BEHAVIOUR,
      asteroidsPerMinute: 0,
      cacheChase: 0,
      depletionChance: 0,
      fightChance: 0,
      retaliatorFightChance: 0,
      speedFraction,
    };
    const scenario = { behaviour: {}, description: "", economy: {}, name: "slow", prices: {} };
    const { runs } = run({ ...options, behaviour, minutes: 10, scenario, seeds: 6 });
    for (const run of runs) {
      expect(run.stationSeconds.length, `seed ${run.seed}`).toBeGreaterThan(0);
    }
  });

  it("collects upgrade pickups from destroyed small craft and salvaged heavies as gifts", () => {
    const { runs, summary } = run({
      ...options,
      galaxy: 2,
      minutes: 30,
      scenario: {
        behaviour: { salvageShare: 1 },
        description: "",
        economy: { upgradeDropChance: { heavy: 1, small: 1 } },
        name: "upgrades",
        prices: {},
      },
    });
    const total = (record: Partial<Record<string, number>>) =>
      Object.values(record).reduce((sum: number, count) => sum + (count ?? 0), 0);
    for (const run of runs) {
      expect(total(run.upgrades)).toBeGreaterThan(0);
    }
    expect(total(summary.salvagedPerMinute)).toBeGreaterThan(0);
    expect(summary.upgradesPerHour.track).toBeGreaterThan(0);
  });

  it("fights galaxy three's capital route guards", () => {
    const { runs } = run({
      ...options,
      galaxy: 3,
      scenario: { behaviour: {}, description: "", economy: {}, name: "three", prices: {} },
    });
    for (const run of runs) {
      // Both authored route guards are the only capitals in Whirlpool.
      expect(run.destroyed.capital).toBe(2);
      expect(run.stardust.guards).toBeGreaterThan(0);
    }
  });

  describe("takes and completes every job type only when jobs are on, paid from the rewards table", () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const scenario = { behaviour: {}, description: "", economy: {}, name: "jobs", prices: {} };
    // Isolate job routes from optional mining, cache detours and shield failures.
    const behaviour = {
      ...DEFAULT_BEHAVIOUR,
      asteroidsPerMinute: 0,
      cacheChase: 0,
      depletionChance: 0,
    };
    const samples = new Map<
      number,
      { withJobs: ReturnType<typeof runSeed>; without: ReturnType<typeof runSeed> }
    >();

    it.each(seeds)("checks jobs on and off for seed %i", (seed) => {
      const config = { ...options, behaviour, minutes: 40, scenario };
      const without = runSeed(config, seed);
      expect(without.runs[0]!.stardust.jobs).toBe(0);
      const withJobs = runSeed({ ...config, behaviour: { ...behaviour, jobs: true } }, seed);
      // Sunflower completion payouts use the canonical conversion of catalog base rewards.
      const rewards = JOB_REWARDS[1]!;
      const flight = withJobs.runs[0]!;
      const fixed =
        questReward(rewards.survey!) * (flight.jobs.survey ?? 0) +
        questReward(rewards.hunt!) * (flight.jobs.hunt ?? 0) +
        questReward(rewards.rescue!) * (flight.jobs.rescue ?? 0);
      const deliveries = flight.jobs.delivery ?? 0;
      expect(flight.stardust.jobs).toBeGreaterThanOrEqual(
        fixed + questReward(rewards.deliveryShort!) * deliveries,
      );
      expect(flight.stardust.jobs).toBeLessThanOrEqual(
        fixed + questReward(rewards.deliveryLong!) * deliveries,
      );
      samples.set(seed, { withJobs, without });
    });

    afterAll(() => {
      const results = completeSamples(seeds, samples);
      const completed = (type: "survey" | "delivery" | "rescue" | "hunt") =>
        results.reduce((sum, { withJobs }) => sum + (withJobs.runs[0]!.jobs[type] ?? 0), 0);
      for (const type of ["survey", "delivery", "rescue", "hunt"] as const) {
        expect(completed(type), type).toBeGreaterThan(0);
      }
      const withJobs = summaryOf(results.map((sample) => sample.withJobs));
      const without = summaryOf(results.map((sample) => sample.without));
      expect(withJobs.firstWeaponMinutes.median).toBeLessThan(without.firstWeaponMinutes.median);
    });
  });

  it("meets Cartwheel's frigates and escorted capital battles from the spawn targets", () => {
    const { summary } = run({
      ...options,
      galaxy: 2,
      minutes: 60,
      scenario: { behaviour: {}, description: "", economy: {}, name: "two", prices: {} },
      seeds: 6,
    });
    expect(summary.metPerMinute.frigate ?? 0).toBeGreaterThan(0);
    expect(summary.metPerMinute.capital ?? 0).toBeGreaterThan(0);
    // Each capital battle brings four escort fighters.
    expect(summary.destroyedPerMinute.fighter ?? 0).toBeGreaterThan(0);
  });
  it("spends Stardust on ammunition for upgrade weapons, in proportion to the pack price", () => {
    const armed = (ammoPackPrice: number, restockPacks = DEFAULT_BEHAVIOUR.restockPacks) =>
      run({
        ...options,
        behaviour: { ...DEFAULT_BEHAVIOUR, restockPacks },
        minutes: 45,
        scenario: { ...SCENARIOS.armed!, behaviour: {}, economy: { ammoPackPrice }, name: "armed" },
        seeds: 4,
      }).summary;
    expect(SCENARIOS.armed!.startWeapons).toEqual(["heavyMissile", "scattershot", "phaser"]);
    const base = armed(ECONOMY.ammo.packPrice);
    expect(base.packPrice).toBe(25);
    expect(base.packsPerHour).toBeGreaterThan(0);
    expect(base.ammoSpentPerMinute).toBeCloseTo(
      (base.packsPerHour / 60) * ECONOMY.ammo.packPrice,
      6,
    );
    const income = Object.values(base.sourcePerMinute).reduce((sum, amount) => sum + amount, 0);
    expect(base.ammoShareOfIncome).toBeCloseTo(base.ammoSpentPerMinute / income, 6);
    // A higher price can change the number of packs the pilot can afford to buy.
    const dearer = armed(base.packPrice * 2);
    expect(dearer.packPrice).toBe(50);
    expect(dearer.ammoSpentPerMinute).toBeCloseTo((dearer.packsPerHour / 60) * dearer.packPrice, 6);
    expect(dearer.ammoSpentPerMinute).toBeGreaterThan(base.ammoSpentPerMinute);
    // A player who never restocks spends nothing and runs out to Laser.
    const unstocked = armed(ECONOMY.ammo.packPrice, 0);
    expect(unstocked.ammoSpentPerMinute).toBe(0);
    expect(unstocked.emptiedPerHour).toBeGreaterThan(0);
  });
});
