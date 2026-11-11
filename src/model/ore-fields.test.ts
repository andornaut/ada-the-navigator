import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog, enemyEncounterTuning } from "../data/enemy-catalog.ts";
import { ORE_FIELDS } from "../data/galaxy-features.ts";
import { ORE_FIELD_LAYOUTS, oreFieldLayout } from "../data/ore-field-layouts.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { RESOURCE_ROCKS } from "../data/resource-rocks.ts";
import { shipDirection } from "../game/ship-art.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { createEnemy, type EnemyContext, type EnemyState, stepEnemy } from "./enemy-ai.ts";
import { createFlight, PLATFORM_FACING, stepFlight } from "./flight.ts";
import { type OreField, oreFieldInCell, oreFieldsNear } from "./ore-fields.ts";
import { stationsNear } from "./stations.ts";

const grid = (sector: 1 | 2 | 3, span: number): OreField[] => {
  const fields: OreField[] = [];
  for (let x = -span; x <= span; x++) {
    for (let y = -span; y <= span; y++) {
      const field = oreFieldInCell(sector, { x, y });
      if (field) {
        fields.push(field);
      }
    }
  }
  return fields;
};
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

describe("ore fields", () => {
  const fields = grid(2, 12);

  it("are seeded in Cartwheel only, the same on every call", () => {
    expect(fields.length).toBeGreaterThan(200);
    expect(grid(1, 6)).toEqual([]);
    expect(grid(3, 6)).toEqual([]);
    expect(grid(2, 12)).toEqual(fields);
  });

  it("hold 6 to 10 rocks within a 900 unit cluster, 3000 apart and clear of the start", () => {
    for (const field of fields) {
      expect(field.rocks.length).toBeGreaterThanOrEqual(6);
      expect(field.rocks.length).toBeLessThanOrEqual(10);
      for (const rock of field.rocks) {
        expect(Math.hypot(rock.x - field.x, rock.y - field.y)).toBeLessThanOrEqual(450);
      }
      expect(Math.hypot(field.x, field.y)).toBeGreaterThanOrEqual(ORE_FIELDS.clearance);
      for (const other of oreFieldsNear(2, 3000, field)) {
        expect(other.id === field.id).toBe(true);
      }
    }
    expect(new Set(fields.map((field) => field.rocks.length)).size).toBeGreaterThan(3);
  });

  it("place Art's layout for the rock count, turned by the seed, keeping gaps and radius", () => {
    const turns = new Set<number>();
    for (const field of fields) {
      const layout = oreFieldLayout(field.rocks.length);
      expect(field.rocks.map((rock) => [rock.asteroid, rock.spinStart])).toEqual(
        layout.map((rock) => [rock.asteroid, rock.frame]),
      );
      expect(field.rocks.filter((rock) => rock.resource === "large")).toHaveLength(
        Math.round(field.rocks.length / 3),
      );
      const radius = (rock: { asteroid: string }) => ASTEROID_SHAPES.get(rock.asteroid)!.radius;
      field.rocks.forEach((rock, index) => {
        const reach = Math.hypot(rock.x - field.x, rock.y - field.y) + radius(rock);
        expect(reach).toBeLessThanOrEqual(ORE_FIELD_LAYOUTS.radius + 1e-6);
        for (const other of field.rocks.slice(index + 1)) {
          const gap = Math.hypot(rock.x - other.x, rock.y - other.y) - radius(rock) - radius(other);
          expect(gap).toBeGreaterThanOrEqual(ORE_FIELD_LAYOUTS.gap - 1e-6);
        }
      });
      const first = field.rocks[0]!;
      turns.add(
        Math.round(
          Math.atan2(first.y - field.y, first.x - field.x) * 1000 -
            Math.atan2(layout[0]!.position.y, layout[0]!.position.x) * 1000,
        ),
      );
    }
    expect(turns.size).toBeGreaterThan(20);
    expect(() => oreFieldLayout(11)).toThrow("No ore field layout for 11 rocks");
    expect(() => oreFieldLayout(5)).toThrow();
  });

  it("guards at most half of the fields, each guard at its field's edge", () => {
    const guarded = fields.filter((field) => field.guard);
    expect(guarded.length).toBeGreaterThan(fields.length * 0.3);
    expect(guarded.length).toBeLessThanOrEqual(fields.length / 2);
    for (const field of guarded) {
      const reach = Math.hypot(field.guard!.x - field.x, field.guard!.y - field.y);
      expect(reach).toBeCloseTo(ORE_FIELDS.diameter / 2 + ORE_FIELDS.guardGap, 9);
    }
  });

  it("places a field's rocks and its retained platform, unrotated, in flight", () => {
    // A field within the clearance of a station is left out, so pick one clear of them.
    const field = fields.find(
      (entry) =>
        entry.guard &&
        Math.hypot(entry.x, entry.y) > 6000 &&
        stationsNear(ECONOMY, 2, ORE_FIELDS.clearance + ORE_FIELDS.diameter, entry).length === 0,
    )!;
    const flight = createFlight(PROTOTYPE, 2, 7, { known: [] });
    flight.player = { x: field.x + 700, y: field.y };
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    const rocks = flight.objects.filter((object) => object.id.startsWith(`${field.id}:`));
    expect(rocks.length).toBeGreaterThan(0);
    expect(rocks.every((rock) => rock.kind === "resource")).toBe(true);
    for (const rock of rocks) {
      const { asteroid, resource, spinStart } = field.rocks[Number(rock.id.split(":").at(-1))]!;
      const shape = ASTEROID_SHAPES.get(asteroid)!;
      expect(shape.size).toBe(resource);
      expect(rock).toMatchObject({
        asteroid,
        hp: RESOURCE_ROCKS.classes[resource].hp,
        radius: shape.radius,
        resource,
        spinStart,
      });
    }
    const platform = flight.objects.find((object) => object.id === `platform:${field.id}`)!;
    expect(platform.enemy?.archetype).toBe("platform");
    expect(platform.enemy?.facing).toEqual(PLATFORM_FACING);
    expect(shipDirection(16, PLATFORM_FACING)).toBe(0);
    expect(platform.enemy?.hardpoints.map((part) => part.hp)).toEqual([6, 6]);
    expect(platform.radius).toBe(PROTOTYPE.tuning.flight.shipRadius * 3);
  });
});

describe("platform", () => {
  const definition = enemyCatalog.platform;
  const platform = (): EnemyState => ({
    ...createEnemy(
      definition,
      { archetype: "platform", id: "platform", packId: null, phase: 0 },
      { x: 0, y: 0 },
    ),
    facing: { ...PLATFORM_FACING },
  });
  const context = (state: EnemyState, away: number): EnemyContext => ({
    adaSpeed: 100,
    adaWidth: 20,
    dt: 1 / 60,
    initialPackSizes: {},
    peers: [state],
    player: { x: away, y: 0 },
    speedCapRatio: enemyEncounterTuning.speedCapRatio,
    targetable: true,
    visibility: "visible",
  });
  const fly = (away: number, seconds: number) => {
    let state = platform();
    const shots: { at: number; hardpoint: string | null }[] = [];
    for (let step = 0; step < seconds * 60; step++) {
      const result = stepEnemy(definition, context(state, away), state);
      for (const shot of result.fire) {
        shots.push({ at: step / 60 + shot.delay, hardpoint: shot.hardpointId });
      }
      expect(result.velocity).toEqual({ x: 0, y: 0 });
      state = { ...result.state, position: state.position };
    }
    return { shots, state };
  };

  it("never turns or moves while its turrets fire", () => {
    const { state } = fly(300, 3);
    expect(state.facing).toEqual(PLATFORM_FACING);
    expect(state.position).toEqual({ x: 0, y: 0 });
  });

  it("fires two-bolt bursts 0.15 s apart every 1.4 s from each live turret", () => {
    const { shots } = fly(300, 4.4);
    for (const turret of ["port", "starboard"]) {
      const times = shots.filter((shot) => shot.hardpoint === turret).map((shot) => shot.at);
      expect(times).toHaveLength(8);
      for (let index = 0; index < times.length; index += 2) {
        expect(times[index + 1]! - times[index]!).toBeCloseTo(0.15, 9);
        if (index >= 2) {
          expect(times[index]! - times[index - 2]!).toBeCloseTo(1.4, 9);
        }
      }
    }
  });

  it("fires only within 520 world units and never pursues", () => {
    expect(fly(510, 2).shots.length).toBeGreaterThan(0);
    const far = fly(540, 2);
    expect(far.shots).toEqual([]);
    expect(far.state.position).toEqual({ x: 0, y: 0 });
  });
});
