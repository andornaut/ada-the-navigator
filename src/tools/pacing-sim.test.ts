import { describe, expect, it } from "vitest";

import {
  DEFAULT_BEHAVIOUR,
  generateChunk,
  onScreen,
  runScenario,
  scenarioEconomy,
  SCENARIOS,
} from "../../tools/pacing-sim.ts";
import { ECONOMY } from "../data/economy.ts";
import { sectorEncounters } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { SCREEN } from "../data/screen.ts";
import type { SectorId } from "../data/types.ts";
import { createFlight } from "../model/flight.ts";

const spawnWeights = PROTOTYPE.tuning.flight.spawnWeights;

describe("pacing simulation world", () => {
  it("generates the same asteroids, caches and encounter packs as a real flight", () => {
    for (const sector of [1, 2] as const satisfies readonly SectorId[]) {
      for (let seed = 1; seed <= 30; seed++) {
        const flight = createFlight(PROTOTYPE, sector, seed, { known: [] });
        const world = {
          catalog: ECONOMY,
          encounterRate: 1,
          encounters: sectorEncounters[sector],
          sector,
          seed,
          spawnWeights,
        };
        const expected = { caches: [] as string[], packs: [] as string[], rocks: [] as string[] };
        for (let x = -2; x <= 2; x++) {
          for (let y = -2; y <= 2; y++) {
            const chunk = generateChunk(world, { x: 0, y: 0 }, x, y);
            expected.rocks.push(...chunk.rocks.map((rock) => `${rock.id}@${rock.x},${rock.y}`));
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
          .map((object) => `${object.id}@${object.x},${object.y}`);
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
    expect(ECONOMY.station.indicatorRange).toBe(1500);
    expect(stations(ECONOMY.station.indicatorRange)).toBeGreaterThan(2 * stations(0));
  });

  it("fights galaxy three's oversized capital route guards", () => {
    const { runs } = runScenario({
      ...options,
      scenario: { behaviour: {}, description: "", economy: {}, name: "three", prices: {} },
      sector: 3,
    });
    for (const run of runs) {
      expect(run.destroyed.oversizedCapital).toBe(2);
      expect(run.stardust.guards).toBeGreaterThan(0);
    }
  });

  it("meets more encounters, frigates and escorted capitals with galaxy one's playtest roster", () => {
    const met = (name: "current" | "roster") => {
      const scenario = { ...SCENARIOS[name]!, behaviour: {}, name };
      const { summary } = runScenario({ ...options, minutes: 60, scenario, seeds: 6 });
      return summary.metPerMinute;
    };
    const total = (record: Partial<Record<string, number>>) =>
      Object.values(record).reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const current = met("current");
    const roster = met("roster");
    expect(total(roster)).toBeGreaterThan(total(current) * 1.1);
    expect(current.frigate).toBeUndefined();
    expect(roster.frigate ?? 0).toBeGreaterThan(0);
  });
});
