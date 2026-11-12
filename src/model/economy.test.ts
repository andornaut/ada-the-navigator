import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunk-catalog.ts";
import { ECONOMY, type UpgradeWeapon } from "../data/economy.ts";
import {
  type EnemyArchetype,
  enemyCatalog,
  enemyDefinition,
  enemyStardust,
  HEAVIES,
} from "../data/enemy-catalog.ts";
import { byPosition } from "../data/galaxies.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { RESOURCE_ROCKS } from "../data/resource-rocks.ts";
import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { planChunk } from "./chunk-templates.ts";
import { type Parts, worldParts } from "./convex.ts";
import {
  dropRandom,
  rollAsteroidStardust,
  rollEnemyDrop,
  rollSalvageDrop,
  splitStardust,
} from "./drops.ts";
import { createEnemy } from "./enemy-ai.ts";
import { createFlight, pickupTouched, stepFlight } from "./flight.ts";
import { HUNT_GLINT, pickupOutline } from "./pickup-body.ts";
import { shipBody } from "./ship-body.ts";
import {
  buy,
  fill,
  itemAbout,
  itemName,
  packCount,
  requestPurchase,
  selectPaint,
  shopRow,
  shopRows,
  shopRowState,
  weaponName,
} from "./shop.ts";
import type {
  EconomyState,
  FlightEvent,
  FlightInput,
  FlightState,
  SpaceObject,
  Vec,
} from "./types.ts";
import { newEconomy, noLevels, shipTuning } from "./upgrades.ts";
import { collectWeapon, noAmmo, UPGRADE_WEAPONS } from "./weapons.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const length = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);

function flight(seed = 77): FlightState {
  const value = createFlight(PROTOTYPE, 1, seed, { known: [] });
  value.objects = [];
  value.shots = [];
  value.combat = { initialPackSizes: {}, routeEncounters: [] };
  return value;
}
function enemy(archetype: EnemyArchetype, id: string, x: number, y: number): SpaceObject {
  const definition = enemyCatalog[archetype];
  return {
    enemy: createEnemy(definition, { archetype, id, packId: null, phase: 0 }, { x, y }),
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: PROTOTYPE.tuning.flight.shipRadius * definition.sizeRatio,
    x,
    y,
  };
}
function stardust(id: string, x: number, y: number, amount = 1): SpaceObject {
  return {
    amount,
    hp: 1,
    id,
    kind: "pickup",
    radius: ECONOMY.stardustPickupRadius,
    role: "stardust",
    x,
    y,
  };
}
function killShot(target: SpaceObject) {
  return {
    damage: 1000,
    enemy: false,
    hitIds: [],
    id: `kill:${target.id}`,
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
    x: target.x,
    y: target.y,
  };
}
const gained = (events: FlightEvent[]) =>
  events.reduce((sum, event) => sum + (event.type === "stardust" ? event.amount : 0), 0);
const pickups = (value: FlightState) =>
  value.objects.filter((object) => object.role === "stardust");
const total = (objects: SpaceObject[]) =>
  objects.reduce((sum, object) => sum + (object.amount ?? 0), 0);

describe("Stardust drops", () => {
  it("releases the documented Stardust per destroyed enemy archetype at position 1", () => {
    const expected: Record<EnemyArchetype, number> = {
      capital: 28,
      fighter: 2,
      frigate: 12,
      interceptor: 1,
      platform: 8,
      retaliator: 4,
      swarm: 1,
    };
    for (const [archetype, amount] of Object.entries(expected)) {
      // A roll of 0.999 never meets the upgrade drop chance.
      expect(rollEnemyDrop(ECONOMY, 1, archetype as EnemyArchetype, () => 0.999)).toEqual({
        stardust: amount,
        upgrade: false,
      });
    }
  });

  it("pays each enemy half its position's hit points, rounded down, and at least 1", () => {
    for (const sector of [1, 2, 3, 4, 5, 6] as const) {
      for (const archetype of Object.keys(enemyCatalog) as EnemyArchetype[]) {
        const definition = enemyDefinition(sector, archetype);
        // A heavy counts its hardpoints' hit points, not its hull.
        const hp = HEAVIES.includes(archetype)
          ? definition.hardpoints.reduce((sum, part) => sum + part.hp, 0)
          : definition.hp;
        expect(enemyStardust(sector, archetype)).toBe(Math.max(1, Math.floor(hp / 2)));
      }
    }
    // Position 1 (gameplay/economy.md): a heavy's salvaged value; destroying it pays double.
    expect(
      Object.fromEntries(
        (Object.keys(enemyCatalog) as EnemyArchetype[]).map((a) => [a, enemyStardust(1, a)]),
      ),
    ).toEqual({
      capital: 14,
      fighter: 2,
      frigate: 6,
      interceptor: 1,
      platform: 4,
      retaliator: 4,
      swarm: 1,
    });
  });

  it("drops twice a destroyed heavy's Stardust and never an upgrade", () => {
    for (const archetype of HEAVIES) {
      for (let index = 0; index < 400; index++) {
        expect(rollEnemyDrop(ECONOMY, 2, archetype, dropRandom(3, `h:${index}`))).toEqual({
          stardust: enemyStardust(2, archetype) * 2,
          upgrade: false,
        });
      }
    }
    expect(rollEnemyDrop(ECONOMY, 1, "frigate", dropRandom(1, "f")).stardust).toBe(12);
    expect(rollEnemyDrop(ECONOMY, 1, "capital", dropRandom(1, "c")).stardust).toBe(28);
  });

  it("releases zero or one Stardust per small asteroid with equal seeded frequency", () => {
    const counts = new Map<number, number>();
    for (let index = 0; index < 6000; index++) {
      const value = rollAsteroidStardust(ECONOMY, "small", dropRandom(5, `rock:${index}`));
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([0, 1]);
    for (const count of counts.values()) {
      expect(count / 6000).toBeCloseTo(1 / 2, 1);
    }
  });

  it.each([
    ["medium", 1],
    ["large", 2],
    ["huge", 3],
  ] as const)("releases exactly %s asteroid Stardust: %i", (size, amount) => {
    for (let index = 0; index < 200; index++) {
      expect(rollAsteroidStardust(ECONOMY, size, dropRandom(5, `rock:${index}`))).toBe(amount);
    }
  });

  it.each([
    [1, "swarm"],
    [1, "fighter"],
    [2, "interceptor"],
    [3, "retaliator"],
    [5, "fighter"],
  ] as const)(
    "in galaxy %i drops an upgrade pickup from a destroyed %s 0.25% of the time, never extra Stardust",
    (sector, archetype) => {
      const draws = 200000;
      let dropped = 0;
      for (let index = 0; index < draws; index++) {
        const drop = rollEnemyDrop(ECONOMY, sector, archetype, dropRandom(11, `wreck:${index}`));
        expect(drop.stardust).toBe(enemyStardust(sector, archetype));
        dropped += drop.upgrade ? 1 : 0;
      }
      expect(Math.abs(dropped / draws - 0.0025)).toBeLessThan(0.0025 * 0.15);
    },
  );

  it.each([
    [1, "frigate"],
    [1, "capital"],
    [2, "platform"],
    [3, "capital"],
    [5, "frigate"],
  ] as const)(
    "drops an upgrade pickup from galaxy %i's %s 10% of the time when salvaged, never when destroyed",
    (sector, archetype) => {
      let dropped = 0;
      for (let index = 0; index < 20000; index++) {
        const salvaged = rollSalvageDrop(ECONOMY, sector, archetype, dropRandom(5, `s:${index}`));
        expect(salvaged.stardust).toBe(enemyStardust(sector, archetype));
        dropped += salvaged.upgrade ? 1 : 0;
        const destroyed = rollEnemyDrop(ECONOMY, sector, archetype, dropRandom(5, `d:${index}`));
        expect(destroyed).toEqual({
          stardust: enemyStardust(sector, archetype) * 2,
          upgrade: false,
        });
      }
      expect(Math.abs(dropped / 20000 - 0.1)).toBeLessThan(0.006);
    },
  );

  it("splits a drop above its cap into pickups worth more than 1", () => {
    // A destroyed capital's 28 at position 1 over its 24 pickups.
    const pieces = splitStardust(ECONOMY.pickupCap.capital, enemyStardust(1, "capital") * 2);
    expect(pieces).toHaveLength(24);
    expect(pieces.filter((piece) => piece === 2)).toHaveLength(4);
    expect(pieces.reduce((sum, piece) => sum + piece, 0)).toBe(28);
  });

  it("splits every small craft's drop below its cap into pickups of 1 Stardust", () => {
    const small = ["swarm", "fighter", "interceptor", "retaliator"] as const;
    for (const archetype of small) {
      const value = enemyStardust(1, archetype);
      expect(value).toBeLessThanOrEqual(ECONOMY.pickupCap[archetype]);
      expect(splitStardust(ECONOMY.pickupCap[archetype], value)).toEqual(
        Array.from({ length: value }, () => 1),
      );
    }
  });

  it("splits a capped drop into its pickup count, larger first", () => {
    expect(splitStardust(8, 15)).toEqual([2, 2, 2, 2, 2, 2, 2, 1]);
    expect(splitStardust(16, 40)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2]);
  });

  it("splits an asteroid into one pickup per Stardust and a capped drop into whole pieces", () => {
    expect(splitStardust(0, 0)).toEqual([]);
    expect(splitStardust(1, 1)).toEqual([1]);
    const capped = splitStardust(ECONOMY.pickupCap.swarm, 26);
    expect(capped).toHaveLength(8);
    expect(capped.reduce((sum, piece) => sum + piece, 0)).toBe(26);
  });

  it("releases a destroyed retaliator as four pickups carrying 4 Stardust", () => {
    const value = flight();
    const target = enemy("retaliator", "retaliator", 500, 0);
    target.enemy!.hp = 1;
    target.hp = 1;
    value.objects.push(target);
    value.shots.push(killShot(target));
    stepFlight(PROTOTYPE, 1 / 60, idle, value);
    stepFlight(PROTOTYPE, 0.6, idle, value);
    const drop = rollEnemyDrop(
      ECONOMY,
      value.sector,
      "retaliator",
      dropRandom(value.seed, "wreck:retaliator"),
    );
    expect(drop.stardust).toBe(4);
    expect(pickups(value).map((object) => object.amount)).toEqual([1, 1, 1, 1]);
  });

  it("breaks a destroyed enemy apart before it drops, instead of removing it at once", () => {
    const value = flight();
    const target = enemy("fighter", "target", 300, 0);
    value.objects.push(target);
    value.shots.push(killShot(target));
    const events = stepFlight(PROTOTYPE, 1 / 60, idle, value);
    expect(events).toContainEqual({ type: "enemyDestroyed" });
    expect(value.objects.some((object) => object.id === "target")).toBe(false);
    const wreck = value.objects.find((object) => object.kind === "wreck");
    expect(wreck?.wreck?.archetype).toBe("fighter");
    expect(pickups(value)).toEqual([]);
    // Art's fighter timing: drops leave at 150 ms and the wreck is gone at 450 ms.
    stepFlight(PROTOTYPE, 0.15, idle, value);
    expect(total(pickups(value))).toBe(enemyStardust(1, "fighter"));
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(true);
    for (const pickup of pickups(value)) {
      expect(pickup.release?.from).toEqual({ x: wreck!.x, y: wreck!.y });
      const offset = Math.hypot(pickup.x - wreck!.x, pickup.y - wreck!.y);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThanOrEqual(19.2 * 1.6);
    }
    stepFlight(PROTOTYPE, 0.3, idle, value);
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(false);
    expect(total(pickups(value))).toBe(enemyStardust(1, "fighter"));
  });

  it("times each shard-drawn destruction from Art's destruction data", () => {
    interface Timing {
      durationMs: number;
      releaseMs: number;
      spread: number;
    }
    const art = JSON.parse(
      readFileSync(new URL("../../public/art/enemies/destruction.json", import.meta.url), "utf8"),
    ) as { archetypes: Record<string, Timing & { reduced: Timing }> };
    const seconds = (timing: Timing) => ({
      durationSeconds: timing.durationMs / 1000,
      releaseSeconds: timing.releaseMs / 1000,
      spread: timing.spread,
    });
    for (const [archetype, timing] of Object.entries(art.archetypes)) {
      expect(ECONOMY.destruction[archetype as EnemyArchetype]).toEqual({
        ...seconds(timing),
        reduced: seconds(timing.reduced),
      });
    }
  });

  it("under reduced motion releases a wreck's drops in place at Art's reduced release", () => {
    const value = flight();
    const target = enemy("fighter", "target", 300, 0);
    value.objects.push(target);
    value.shots.push(killShot(target));
    const reduced = { ...idle, reducedMotion: true };
    stepFlight(PROTOTYPE, 1 / 60, reduced, value);
    const wreck = value.objects.find((object) => object.kind === "wreck")!;
    // Art's reduced fighter: drops appear at 240 ms, within 7.68 units, and the hull is gone at 360 ms.
    stepFlight(PROTOTYPE, 0.2, reduced, value);
    expect(pickups(value)).toEqual([]);
    stepFlight(PROTOTYPE, 0.05, reduced, value);
    expect(total(pickups(value))).toBe(enemyStardust(1, "fighter"));
    for (const pickup of pickups(value)) {
      const offset = Math.hypot(pickup.x - wreck.x, pickup.y - wreck.y);
      expect(offset).toBeLessThanOrEqual(7.68 * 1.6);
    }
    stepFlight(PROTOTYPE, 0.12, reduced, value);
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(false);
  });

  it("destroys a heavy whose hull reaches 0 and drops twice its Stardust", () => {
    const value = flight();
    const frigate = enemy("frigate", "frigate", 600, 0);
    frigate.enemy!.hp = 0;
    value.objects.push(frigate);
    stepFlight(PROTOTYPE, 1 / 60, idle, value);
    expect(value.objects.some((object) => object.id === "frigate")).toBe(false);
    stepFlight(PROTOTYPE, 0.6, idle, value);
    expect(total(pickups(value))).toBe(enemyStardust(1, "frigate") * 2);
  });

  it("releases a huge asteroid's three Stardust where it breaks", () => {
    const value = flight();
    const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "huge")!;
    const rock: SpaceObject = {
      asteroid: shape.id,
      hp: 1,
      id: "huge-rock",
      kind: "rock",
      radius: shape.radius,
      x: 600,
      y: 0,
    };
    value.objects.push(rock);
    value.shots.push(killShot(rock));
    stepFlight(PROTOTYPE, 1 / 60, idle, value);
    expect(total(pickups(value))).toBe(3);
  });

  it("makes an asteroid's Stardust collectable at once, drawn in place from 240 ms within 7.68 units", () => {
    const value = flight();
    const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "huge")!;
    const rock: SpaceObject = {
      asteroid: shape.id,
      hp: 1,
      id: "huge-rock",
      kind: "rock",
      radius: shape.radius,
      x: 600,
      y: 0,
    };
    value.objects.push(rock);
    value.shots.push(killShot(rock));
    const destroyedAt = value.time;
    stepFlight(PROTOTYPE, 1 / 60, idle, value);
    const released = pickups(value);
    expect(released).toHaveLength(3);
    for (const pickup of released) {
      // Art's generic reduced destruction (the fighter's reduced timing) at every motion setting.
      expect(pickup.release?.at).toBeCloseTo(destroyedAt + 1 / 60 + 0.24, 9);
      expect(pickup.release?.from).toBeUndefined();
      const offset = Math.hypot(pickup.x - rock.x, pickup.y - rock.y);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThanOrEqual(7.68 * 1.6);
      expect(offset).toBeLessThan(shape.radius);
    }
  });

  it("releases Stardust from asteroids but none from story mining deposits", () => {
    const value = flight();
    const rock: SpaceObject = { hp: 1, id: "rock", kind: "rock", radius: 20, x: 400, y: 0 };
    const deposit: SpaceObject = {
      hp: 1,
      id: "deposit",
      kind: "resource",
      radius: 20,
      x: -400,
      y: 0,
    };
    value.objects.push(rock, deposit);
    value.shots.push(killShot(rock), killShot(deposit));
    stepFlight(PROTOTYPE, 1 / 60, idle, value);
    const released = pickups(value);
    expect(total(released)).toBe(
      rollAsteroidStardust(ECONOMY, "small", dropRandom(value.seed, "rock")),
    );
    expect(released.every((object) => object.x > 0)).toBe(true);
    expect(value.objects.filter((object) => object.role === "cargo")).toHaveLength(
      RESOURCE_ROCKS.classes.medium.pieces,
    );
  });

  it("releases each resource rock class's pieces, centred on the rock", () => {
    for (const resource of ["medium", "large"] as const) {
      const value = flight();
      const { hp, pieces } = RESOURCE_ROCKS.classes[resource];
      const shape = ASTEROID_SHAPES.get(resource === "medium" ? "asteroid-m2" : "asteroid-l1")!;
      const deposit: SpaceObject = {
        asteroid: shape.id,
        hp,
        id: "deposit",
        kind: "resource",
        radius: shape.radius,
        resource,
        x: -400,
        y: 0,
      };
      value.objects.push(deposit);
      value.shots.push({ ...killShot(deposit), damage: hp - 1, id: "chip" });
      stepFlight(PROTOTYPE, 1 / 60, idle, value);
      expect(value.objects.some((object) => object.id === "deposit")).toBe(true);
      value.shots.push(killShot(deposit));
      stepFlight(PROTOTYPE, 1 / 60, idle, value);
      const cargo = value.objects.filter((object) => object.role === "cargo");
      expect(cargo).toHaveLength(pieces);
      expect(cargo.reduce((sum, piece) => sum + piece.x, 0) / pieces).toBeCloseTo(-400, 9);
    }
    expect([RESOURCE_ROCKS.classes.medium, RESOURCE_ROCKS.classes.large]).toMatchObject([
      { hp: 3, pieces: 3 },
      { hp: 5, pieces: 5 },
    ]);
  });

  it("makes two of every three chunk resource rocks medium, each on a shape of its size", () => {
    const counts = { large: 0, medium: 0 };
    const shapes = [...ASTEROID_SHAPES.values()];
    for (let x = -20; x < 20; x++) {
      for (let y = -20; y < 20; y++) {
        const plan = planChunk(CHUNK_CATALOG, {
          asteroids: { field: byPosition(ASTEROID_FIELDS, 2), shapes },
          clearance: PROTOTYPE.tuning.flight.shipRadius,
          objectsPerChunk: PROTOTYPE.tuning.flight.objectsPerChunk,
          rockRadius: PROTOTYPE.tuning.flight.rockRadius,
          sector: 2,
          seed: 11,
          shipRadius: PROTOTYPE.tuning.flight.shipRadius,
          size: PROTOTYPE.tuning.chunkSize,
          spawnWeights: PROTOTYPE.tuning.flight.spawnWeights,
          x,
          y,
        });
        for (const placement of plan.placements.filter((entry) => entry.kind === "resource")) {
          counts[placement.resource!]++;
          const shape = ASTEROID_SHAPES.get(placement.asteroid!)!;
          expect(shape.size).toBe(placement.resource);
          expect(placement.radius).toBe(shape.radius);
        }
      }
    }
    const share = counts.medium / (counts.medium + counts.large);
    // A large rock that does not fit its slot's clearance is left out, so large rocks run a
    // little under a third.
    expect(counts.large).toBeGreaterThan(50);
    expect(share).toBeGreaterThan(0.6);
    expect(share).toBeLessThan(0.85);
  });
});

describe("discovery caches", () => {
  it("generates Stardust caches worth 5 instead of upgrade pickups", () => {
    const value = createFlight(PROTOTYPE, 1, 4242, { known: [] });
    const discoveries = new Map<string, SpaceObject>();
    for (let step = 0; step < 40; step++) {
      value.player = { x: step * PROTOTYPE.tuning.chunkSize * 2, y: 0 };
      stepFlight(PROTOTYPE, 1 / 60, idle, value);
      // Rare caches are gathered along the way, since distant chunks unload.
      for (const object of value.objects) {
        if (object.kind === "pickup" && object.role === "discovery") {
          discoveries.set(object.id, object);
        }
      }
    }
    expect(discoveries.size).toBeGreaterThan(0);
    for (const cache of discoveries.values()) {
      expect(cache).toMatchObject({ amount: 5 });
      expect(cache.upgrade).toBeUndefined();
    }
  });

  it("collects a cache as 5 Stardust and pulls it with the tractor beam", () => {
    const value = flight();
    value.objects.push({
      amount: ECONOMY.discoveryStardust,
      hp: 1,
      id: "cache",
      kind: "pickup",
      radius: PROTOTYPE.tuning.flight.pickupRadius,
      role: "discovery",
      x: 60,
      y: 0,
    });
    stepFlight(PROTOTYPE, 0.1, idle, value);
    // The base pull: 120 a second from within 60.
    expect(value.objects[0]!.x).toBeCloseTo(60 - 12, 6);
    expect(gained(stepFlight(PROTOTYPE, 1, idle, value))).toBe(5);
    expect(value.weapon).toBe("laser");
    expect(value.ownedWeapons).toEqual([]);
  });
});

describe("tractor beam and pickup reach", () => {
  /** The tractor beam's pull radius and speed at each level: alike for every pickup kind. */
  const TRACTOR = [
    [1, 60, 120],
    [2, 90, 160],
    [3, 120, 200],
  ] as const;
  const KINDS = [
    ["Stardust gem", { amount: 1, radius: ECONOMY.stardustPickupRadius, role: "stardust" }],
    ["cache", { amount: 3, radius: 10, role: "discovery" }],
    ["ore nugget", { radius: 7, role: "cargo" }],
    ["upgrade pickup", { radius: 10, upgrade: true }],
  ] as const;

  it.each(KINDS.flatMap(([name, extra]) => TRACTOR.map((row) => [name, ...row, extra] as const)))(
    "pulls a %s at tractor level %i from within %i at %i a second, and none beyond",
    (_, level, radius, speed, extra) => {
      const value = flight();
      value.levels = { ...noLevels(), tractor: level };
      value.objects.push(
        { hp: 1, id: "inside", kind: "pickup", x: radius - 1, y: 0, ...extra },
        { hp: 1, id: "outside", kind: "pickup", x: 0, y: radius + 1, ...extra },
      );
      stepFlight(PROTOTYPE, 0.05, idle, value);
      const inside = value.objects.find((object) => object.id === "inside")!;
      expect(inside.x).toBeCloseTo(radius - 1 - speed * 0.05, 6);
      expect(inside.y).toBeCloseTo(0, 9);
      expect(value.objects.find((object) => object.id === "outside")).toMatchObject({
        x: 0,
        y: radius + 1,
      });
    },
  );

  it("zips Stardust into the ship as it collects, as every pickup does", () => {
    const value = flight();
    value.objects.push(stardust("dust", 5, 0));
    const events = stepFlight(PROTOTYPE, 0.001, idle, value);
    // The collected event is the one the view zips the gem's sprite into the ship from.
    expect(events).toContainEqual(
      expect.objectContaining({ id: "dust", type: "collected", x: expect.any(Number) }),
    );
    expect(events).toContainEqual({ amount: 1, type: "stardust" });
    expect(PROTOTYPE.tuning.flight.pickupZip).toBe(0.15);
  });

  /** Least world distance between two drawn outlines placed apart, 0 if they cross. */
  function outlineGap(a: Parts, at: Vec, b: Parts, from: Vec): number {
    const edges = (parts: Parts, origin: Vec) =>
      worldParts(parts).flatMap((part) =>
        part.map((point, index) => {
          const next = part[(index + 1) % part.length]!;
          return [
            { x: origin.x + point.x, y: origin.y + point.y },
            { x: origin.x + next.x, y: origin.y + next.y },
          ] as const;
        }),
      );
    const toSegment = (p: Vec, [q, r]: readonly [Vec, Vec]) => {
      const dx = r.x - q.x;
      const dy = r.y - q.y;
      const t = Math.max(
        0,
        Math.min(1, ((p.x - q.x) * dx + (p.y - q.y) * dy) / (dx * dx + dy * dy || 1)),
      );
      return Math.hypot(p.x - q.x - dx * t, p.y - q.y - dy * t);
    };
    let best = Infinity;
    for (const one of edges(a, at)) {
      for (const two of edges(b, from)) {
        best = Math.min(
          best,
          toSegment(one[0], two),
          toSegment(one[1], two),
          toSegment(two[0], one),
          toSegment(two[1], one),
        );
      }
    }
    return best;
  }

  it.each([
    ["cache", 20, { amount: 3, radius: 10, role: "discovery" }],
    ["Stardust gem", 20, { amount: 3, radius: ECONOMY.stardustPickupRadius, role: "stardust" }],
    ["ore nugget", 20, { radius: 7, role: "cargo" }],
    ["upgrade pickup", 20, { radius: 10, upgrade: true }],
  ] as const)(
    "collects the %s within %i world units of Ada's drawn ship, not beyond",
    (_, margin, extra) => {
      const pickup = (id: string, x: number, y: number): SpaceObject => ({
        hp: 1,
        id,
        kind: "pickup",
        x,
        y,
        ...extra,
      });
      const outline = pickupOutline(pickup("probe", 0, 0))!;
      expect(outline).not.toBeNull();
      // Along each axis, where the drawn gap between pickup and ship first exceeds 4, to 0.001.
      const value = flight();
      const body = shipBody(value.facing);
      const edge = (axis: Vec) => {
        let low = 0;
        let high = 200;
        while (high - low > 1e-3) {
          const middle = (low + high) / 2;
          const at = { x: value.player.x + axis.x * middle, y: value.player.y + axis.y * middle };
          if (outlineGap(outline, at, body, value.player) <= margin) {
            low = middle;
          } else {
            high = middle;
          }
        }
        return high;
      };
      const east = edge({ x: 1, y: 0 });
      const south = edge({ x: 0, y: 1 });
      value.objects.push(
        pickup("inside", value.player.x + east - 0.3, value.player.y),
        pickup("outside", value.player.x, value.player.y + south + 1),
      );
      const before = value.cargo;
      const events = stepFlight(PROTOTYPE, 0.001, idle, value);
      expect(value.objects.map((object) => object.id)).toEqual(["outside"]);
      // Collected at contact, with the event the view zips it into the ship from.
      expect(events.filter(({ type }) => type === "collected")).toEqual([
        expect.objectContaining({ id: "inside", type: "collected" }),
      ]);
      if ("upgrade" in extra) {
        expect(events).toContainEqual({ id: "inside", type: "upgradeCollected" });
      } else if (extra.role === "cargo") {
        expect(value.cargo).toBe(before + 1);
      }
    },
  );

  it("collects a hunt's lost item within 20 world units of Ada's drawn ship, as its glint", () => {
    // One pickup rule: every kind reaches 20 past the drawn ship.
    expect(PROTOTYPE.tuning.flight.pickupMargin).toBe(20);
    const value = flight();
    const body = shipBody(value.facing);
    let low = 0;
    let high = 200;
    while (high - low > 1e-3) {
      const middle = (low + high) / 2;
      const at = { x: value.player.x + middle, y: value.player.y };
      if (outlineGap(HUNT_GLINT!, at, body, value.player) <= 20) {
        low = middle;
      } else {
        high = middle;
      }
    }
    const at = (x: number) => ({ x: value.player.x + x, y: value.player.y });
    const { pickupRadius } = PROTOTYPE.tuning.flight;
    expect(pickupTouched(PROTOTYPE, value, at(high - 0.3), pickupRadius, HUNT_GLINT)).toBe(true);
    expect(pickupTouched(PROTOTYPE, value, at(high + 1), pickupRadius, HUNT_GLINT)).toBe(false);
  });

  it.each(TRACTOR)("tractor level %i has pull radius %i and speed %i", (level, radius, speed) => {
    const levels = { ...noLevels(), tractor: level };
    expect(shipTuning(ECONOMY, PROTOTYPE, levels)).toMatchObject({
      tractorRadius: radius,
      tractorSpeed: speed,
    });
    const value = flight();
    value.levels = levels;
    value.objects.push(stardust("inside", radius - 1, 0), stardust("outside", 0, radius + 1));
    stepFlight(PROTOTYPE, 0.05, idle, value);
    expect(value.objects.find((object) => object.id === "inside")!.x).toBeCloseTo(
      radius - 1 - speed * 0.05,
      6,
    );
    expect(value.objects.find((object) => object.id === "outside")!.y).toBe(radius + 1);
  });

  it("does not change pickup reach with tractor levels: a higher level pulls from farther", () => {
    const value = flight();
    value.levels.tractor = 3;
    value.objects.push({
      hp: 1,
      id: "upgrade",
      kind: "pickup",
      radius: 10,
      upgrade: true,
      // Past its 20 reach, within the level 3 tractor's 120, which pulls it in.
      x: 70,
      y: 0,
    });
    const events = stepFlight(PROTOTYPE, 0.001, idle, value);
    expect(events.some((event) => event.type === "upgradeCollected")).toBe(false);
    expect(value.objects.find((object) => object.id === "upgrade")!.x).toBeCloseTo(70 - 0.2, 6);
  });

  it("turns a found weapon Ada already owns into one pack of its ammunition", () => {
    const value = flight();
    value.ownedWeapons = ["rapidMissile"];
    value.ammo.rapidMissile = 7;
    expect(collectWeapon("rapidMissile", value)).toBe(false);
    expect(value.ammo.rapidMissile).toBe(7 + 200);
    expect(value.weapon).toBe("laser");
  });
});

describe("upgrade effects", () => {
  it.each([
    [1, 10, 20, 60, 160, 1],
    [2, 15, 15, 45, 190, 0.9],
    [3, 20, 10, 30, 220, 0.8],
  ])(
    "applies shield, recharge and engine level %i",
    (level, shield, delay, fill, speed, seconds) => {
      const levels = { ...noLevels(), engine: level, shield: level };
      const tuning = shipTuning(ECONOMY, PROTOTYPE, levels);
      const base = PROTOTYPE.tuning;
      expect(tuning.shieldMax).toBe(shield);
      expect(tuning.shieldRechargeDelay).toBe(delay);
      // The shield refills from empty in its fill time, whatever its capacity.
      expect(tuning.shieldMax / tuning.shieldRechargeRate).toBeCloseTo(fill, 9);
      expect(tuning.physics.maxSpeed).toBe(speed);
      expect(tuning.physics.accelerationSeconds).toBeCloseTo(
        base.physics.accelerationSeconds * seconds,
        9,
      );
      expect(tuning.physics.brakingSeconds).toBeCloseTo(base.physics.brakingSeconds * seconds, 9);
      expect(tuning.physics.turnSeconds).toBe(base.physics.turnSeconds);
    },
  );

  it.each([1, 2, 3])("fires Ada's Laser at 600 at engine level %i", (level) => {
    const value = flight();
    value.levels.engine = level;
    stepFlight(PROTOTYPE, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, value);
    const { velocity } = value.shots[0]!;
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(
      600 * WEAPON_CATALOG.laser[0].speedRatio,
      6,
    );
  });

  it("fires the equipped weapon at its own level", () => {
    const value = flight();
    value.levels.weapons.laser = 3;
    stepFlight(PROTOTYPE, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, value);
    expect(value.shots[0]!.damage).toBeCloseTo(PROTOTYPE.tuning.flight.playerShotDamage * 1.5, 9);
    expect(value.fireCooldown).toBeCloseTo(WEAPON_CATALOG.laser[2].intervalSeconds, 9);
    const other = flight();
    other.levels.weapons.rapidMissile = 3;
    stepFlight(PROTOTYPE, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, other);
    expect(other.shots[0]!.damage).toBe(PROTOTYPE.tuning.flight.playerShotDamage);
  });

  it("starts a flight at the upgraded shield capacity and recharges toward it", () => {
    const levels = { ...noLevels(), shield: 2 };
    const value = createFlight(
      PROTOTYPE,
      1,
      77,
      { known: [] },
      {
        ammo: noAmmo(),
        levels,
        ownedWeapons: [],
        weapon: "laser",
      },
    );
    value.objects = [];
    expect(value.shield).toBe(15);
    value.shield = 5;
    value.sinceDamage = 0;
    // Level 2 waits 15 s, then refills 15 HP in 45 s.
    stepFlight(PROTOTYPE, 15 - 0.05, idle, value);
    expect(value.shield).toBe(5);
    stepFlight(PROTOTYPE, 0.05 + 9, idle, value);
    // Within one 1/60 s step of the refill rate.
    expect(Math.abs(value.shield - (5 + (15 / 45) * 9))).toBeLessThan(15 / 45 / 60 + 1e-9);
  });

  it("raises Ada's top speed and acceleration with engine tuning", () => {
    const right = { ...idle, move: { x: 1, y: 0 } };
    for (const level of [1, 3]) {
      const value = flight();
      value.levels.engine = level;
      stepFlight(PROTOTYPE, 0.2, right, value);
      const physics = shipTuning(ECONOMY, PROTOTYPE, value.levels).physics;
      const top = physics.maxSpeed;
      expect(length(value.velocity)).toBeCloseTo(
        top * (1 - Math.exp(-0.2 / physics.accelerationSeconds)),
        6,
      );
    }
  });

  it("keeps enemy movement tied to Ada's base speed when engines are tuned", () => {
    const runs = [1, 3].map((level) => {
      const value = flight(91);
      value.levels.engine = level;
      value.objects.push(enemy("interceptor", "chaser", 260, 0));
      for (let step = 0; step < 60; step++) {
        stepFlight(PROTOTYPE, 1 / 30, idle, value);
      }
      return value.objects.find((object) => object.id === "chaser")!;
    });
    expect(runs[1]!.enemy!.velocity).toEqual(runs[0]!.enemy!.velocity);
    expect({ x: runs[1]!.x, y: runs[1]!.y }).toEqual({ x: runs[0]!.x, y: runs[0]!.y });
    expect(length(runs[0]!.enemy!.velocity)).toBeGreaterThan(0);
  });
});

describe("shop purchases", () => {
  const rich = (stardust = 5000): EconomyState => ({ ...newEconomy(ECONOMY), stardust });

  it("lists weapons, an upgrade row for Laser and each owned weapon, and owned ammunition", () => {
    const economy = rich();
    expect(shopRows(ECONOMY, economy, "weapons")).toEqual([
      {
        inUse: false,
        item: { kind: "weapon", weapon: "multiLaser" },
        level: null,
        owned: false,
        price: 375,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "rapidMissile" },
        level: null,
        owned: false,
        price: 225,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "heavyMissile" },
        level: null,
        owned: false,
        price: 450,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "scattershot" },
        level: null,
        owned: false,
        price: 525,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "phaser" },
        level: null,
        owned: false,
        price: 600,
      },
      {
        inUse: false,
        item: { kind: "weaponUpgrade", weapon: "laser" },
        level: { current: 1, max: 3 },
        owned: false,
        price: 225,
      },
    ]);
    expect(buy(ECONOMY, { kind: "weapon", weapon: "multiLaser" }, economy)).toEqual({
      kind: "bought",
      price: 375,
    });
    const rows = shopRows(ECONOMY, economy, "weapons");
    // The owned weapon's ammunition row leads the tab, before the weapon rows.
    expect(rows[1]).toMatchObject({ owned: true, price: null });
    expect(rows.at(-1)).toMatchObject({ item: { kind: "weaponUpgrade", weapon: "multiLaser" } });
    expect(rows[0]).toEqual({
      inUse: false,
      item: { kind: "ammo", weapon: "multiLaser" },
      level: null,
      owned: false,
      price: ECONOMY.ammo.packPrice,
    });
    expect(economy.stardust).toBe(4625);
    expect(economy.ownedWeapons).toEqual(["multiLaser"]);
    // A bought weapon includes three packs.
    expect(economy.ammo.multiLaser).toBe(3 * 200);
  });

  it("sells packs of an owned weapon's ammunition, never sold out, and none for others", () => {
    const economy = rich();
    expect(ECONOMY.ammo.pack).toEqual({
      heavyMissile: 50,
      multiLaser: 200,
      phaser: 55,
      rapidMissile: 200,
      scattershot: 130,
    });
    const pack = { kind: "ammo", weapon: "phaser" } as const;
    expect(requestPurchase(ECONOMY, economy, pack)).toEqual({
      kind: "refused",
      reason: "notForSale",
    });
    economy.ownedWeapons.push("phaser");
    for (let count = 1; count <= 3; count++) {
      expect(buy(ECONOMY, pack, economy)).toEqual({
        kind: "bought",
        price: ECONOMY.ammo.packPrice,
      });
      expect(economy.ammo.phaser).toBe(count * 55);
    }
    expect(shopRow(ECONOMY, economy, pack)).toMatchObject({ owned: false, price: 9 });
    expect(itemName(ECONOMY, PROTOTYPE.labels, pack)).toBe("Phaser ammo");
    expect(packCount(ECONOMY, PROTOTYPE.labels, "phaser")).toBe("×55");
  });

  it.each([
    [{ kind: "weaponUpgrade", weapon: "laser" }, [225, 450]],
    [{ kind: "track", track: "shield" }, [450, 900]],
    [{ kind: "track", track: "engine" }, [180, 360]],
    [{ kind: "track", track: "tractor" }, [120, 240]],
  ] as const)("prices levels 2 and 3 of %j and stops at level 3", (item, prices) => {
    const economy = rich();
    let spent = 0;
    const tab = item.kind === "track" ? "ship" : "weapons";
    prices.forEach((price, index) => {
      expect(shopRows(ECONOMY, economy, tab)).toContainEqual({
        inUse: false,
        item,
        level: { current: index + 1, max: 3 },
        owned: false,
        price,
      });
      expect(buy(ECONOMY, item, economy)).toEqual({ kind: "bought", price });
      spent += price;
    });
    expect(shopRows(ECONOMY, economy, tab)).toContainEqual({
      inUse: false,
      item,
      level: { current: 3, max: 3 },
      owned: true,
      price: null,
    });
    expect(economy.stardust).toBe(5000 - spent);
    expect(requestPurchase(ECONOMY, economy, item)).toEqual({
      kind: "refused",
      reason: "notForSale",
    });
    expect(buy(ECONOMY, item, economy)).toEqual({ kind: "refused", reason: "notForSale" });
  });

  it("confirms with the balance left after, and refuses what Ada cannot afford", () => {
    const economy = rich(275);
    expect(requestPurchase(ECONOMY, economy, { kind: "weapon", weapon: "rapidMissile" })).toEqual({
      kind: "confirm",
      left: 50,
      price: 225,
    });
    expect(requestPurchase(ECONOMY, economy, { kind: "weapon", weapon: "multiLaser" })).toEqual({
      kind: "refused",
      reason: "cantAfford",
    });
    const exact = rich(225);
    expect(
      requestPurchase(ECONOMY, exact, { kind: "weapon", weapon: "rapidMissile" }),
    ).toMatchObject({
      left: 0,
    });
  });

  it("refuses a confirmed purchase when the balance changed before Buy", () => {
    const economy = rich(225);
    const item = { kind: "weapon", weapon: "rapidMissile" } as const;
    expect(requestPurchase(ECONOMY, economy, item).kind).toBe("confirm");
    economy.stardust = 224;
    expect(buy(ECONOMY, item, economy)).toEqual({ kind: "refused", reason: "cantAfford" });
    expect(economy.ownedWeapons).toEqual([]);
    expect(economy.stardust).toBe(224);
  });

  it("refuses an upgrade for a weapon Ada does not own", () => {
    const economy = rich();
    expect(
      requestPurchase(ECONOMY, economy, { kind: "weaponUpgrade", weapon: "scattershot" }),
    ).toEqual({ kind: "refused", reason: "notForSale" });
  });

  it("sells four paint schemes at 75 and keeps Classic free, owned and in use", () => {
    const economy = rich(110);
    const paints = () =>
      shopRows(ECONOMY, economy, "ship").filter((row) => row.item.kind === "paint");
    expect(paints().map((row) => [row.item, row.owned, row.inUse, row.price])).toEqual([
      [{ kind: "paint", scheme: "classic" }, true, true, null],
      [{ kind: "paint", scheme: "cobalt" }, false, false, 75],
      [{ kind: "paint", scheme: "seafoam" }, false, false, 75],
      [{ kind: "paint", scheme: "graphite" }, false, false, 75],
      [{ kind: "paint", scheme: "iris" }, false, false, 75],
    ]);
    expect(selectPaint(ECONOMY, "cobalt", economy)).toBe(false);
    expect(buy(ECONOMY, { kind: "paint", scheme: "cobalt" }, economy)).toEqual({
      kind: "bought",
      price: 75,
    });
    expect(economy).toMatchObject({ paint: "cobalt", paints: ["classic", "cobalt"], stardust: 35 });
    expect(paints()[0]).toMatchObject({ inUse: false, owned: true });
    expect(paints()[1]).toMatchObject({ inUse: true, owned: true, price: null });
    // An owned scheme goes into use at once, with no purchase.
    expect(selectPaint(ECONOMY, "classic", economy)).toBe(true);
    expect(economy).toMatchObject({ paint: "classic", stardust: 35 });
  });

  it("sets each row's tap behaviour from ownership, use and the balance", () => {
    const economy = rich(225);
    economy.paints.push("iris");
    const states = (tab: "weapons" | "ship") =>
      shopRows(ECONOMY, economy, tab).map((row) => shopRowState(economy.stardust, row));
    // Multi-Laser, Rapid Missile, Heavy Missile, Scattershot, Phaser, then the Laser upgrade.
    expect(states("weapons")).toEqual([
      "unaffordable",
      "forSale",
      "unaffordable",
      "unaffordable",
      "unaffordable",
      "forSale",
    ]);
    // Shield, engine, tractor; then Classic, Cobalt, Seafoam, Graphite, Iris.
    expect(states("ship")).toEqual([
      "unaffordable",
      "forSale",
      "forSale",
      "inUse",
      "forSale",
      "forSale",
      "forSale",
      "selectable",
    ]);
    economy.stardust = 40;
    expect(states("ship").slice(4)).toEqual([
      "unaffordable",
      "unaffordable",
      "unaffordable",
      "selectable",
    ]);
    economy.levels.tractor = 3;
    expect(states("ship")[2]).toBe("owned");
  });

  it("shows a weapon's one-line description or a pack's size in the buy confirm", () => {
    const labels = PROTOTYPE.labels;
    const about = (weapon: UpgradeWeapon) => itemAbout(ECONOMY, labels, { kind: "weapon", weapon });
    expect(about("heavyMissile")).toBe("One slow missile with a big blast.");
    expect(about("rapidMissile")).toBe("Quick missiles with a small blast.");
    expect(about("multiLaser")).toBe("A fan of laser bolts that grows with each level.");
    expect(about("scattershot")).toBe("A shotgun spread, strongest up close.");
    expect(about("phaser")).toBe("An instant beam that strikes the first thing in its path.");
    expect(itemAbout(ECONOMY, labels, { kind: "track", track: "shield" })).toBe("");
    expect(itemAbout(ECONOMY, labels, { kind: "ammo", weapon: "heavyMissile" })).toBe("×50");
    expect(labels.aboutMissiles).toBeUndefined();
    expect(labels.aboutTripleLaser).toBeUndefined();
  });

  it("names the five shop weapons and their upgrades", () => {
    const labels = PROTOTYPE.labels;
    expect(UPGRADE_WEAPONS.map((weapon) => weaponName(labels, weapon))).toEqual([
      "Multi-Laser",
      "Rapid Missile",
      "Heavy Missile",
      "Scattershot",
      "Phaser",
    ]);
    expect(itemName(ECONOMY, labels, { kind: "weaponUpgrade", weapon: "multiLaser" })).toBe(
      "Multi-Laser upgrade",
    );
    expect(UPGRADE_WEAPONS.map((weapon) => ECONOMY.weaponPrices[weapon])).toEqual([
      375, 225, 450, 525, 600,
    ]);
  });

  it("names items and fills confirm strings from the player strings", () => {
    const labels = PROTOTYPE.labels;
    const name = (item: Parameters<typeof itemName>[2]) => itemName(ECONOMY, labels, item);
    expect(name({ kind: "weaponUpgrade", weapon: "laser" })).toBe("Laser upgrade");
    expect(name({ kind: "track", track: "shield" })).toBe("Shield");
    expect(name({ kind: "track", track: "engine" })).toBe("Engine tuning");
    expect(name({ kind: "track", track: "tractor" })).toBe("Tractor beam");
    expect(Object.keys(ECONOMY.paints).map((scheme) => name({ kind: "paint", scheme }))).toEqual([
      "Classic",
      "Cobalt",
      "Graphite",
      "Iris",
      "Seafoam",
    ]);
    expect(labels.inUse).toBe("In use");
    expect(labels.stationWelcome).toBe("Welcome aboard. Trade your Stardust, or take a job.");
    expect(fill(labels.confirmTitle!, { name: "Multi-Laser" })).toBe("Buy Multi-Laser?");
    expect(fill(labels.confirmLeft!, { amount: 50 })).toBe("50 left after");
    expect(fill(labels.level!, { level: 1, max: 3 })).toBe("Level 1 of 3");
    expect(fill(labels.stardustAmount!, { amount: 7 })).toBe("7 Stardust");
  });
});

describe("discovery cache rarity", () => {
  const tuning = PROTOTYPE.tuning;
  const plan = (spawnWeights: typeof tuning.flight.spawnWeights, x: number, y: number) =>
    planChunk(CHUNK_CATALOG, {
      clearance: tuning.flight.shipRadius,
      objectsPerChunk: tuning.flight.objectsPerChunk,
      rockRadius: tuning.flight.rockRadius,
      sector: 1,
      seed: 99,
      shipRadius: tuning.flight.shipRadius,
      size: tuning.chunkSize,
      spawnWeights,
      x,
      y,
    });

  it("leaves rare caches' freed weight empty, so rocks and resources are unchanged", () => {
    const weights = tuning.flight.spawnWeights;
    const common = { ...weights, enemy: weights.enemy + weights.pickup - 0.12, pickup: 0.12 };
    let caches = 0;
    let chunks = 0;
    for (let x = -20; x < 20; x++) {
      for (let y = -20; y < 20; y++) {
        const now = plan(weights, x, y).placements;
        const scenery = (placements: typeof now) =>
          placements.filter((placement) => placement.kind !== "pickup");
        expect(scenery(now)).toEqual(scenery(plan(common, x, y).placements));
        caches += now.length - scenery(now).length;
        chunks++;
      }
    }
    expect(weights.pickup).toBe(0.0136);
    expect(caches / chunks).toBeCloseTo(weights.pickup * tuning.flight.objectsPerChunk, 1);
  });
});
