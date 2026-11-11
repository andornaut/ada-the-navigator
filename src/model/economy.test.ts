import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CHUNK_CATALOG } from "../data/chunk-catalog.ts";
import { ECONOMY, type UpgradeWeapon } from "../data/economy.ts";
import { type EnemyArchetype, enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { planChunk } from "./chunk-templates.ts";
import { dropRandom, rollAsteroidStardust, rollEnemyDrop, splitStardust } from "./drops.ts";
import { createEnemy } from "./enemy-ai.ts";
import { createFlight, stepFlight } from "./flight.ts";
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
import type { EconomyState, FlightEvent, FlightInput, FlightState, SpaceObject } from "./types.ts";
import { newEconomy, noLevels, shipTuning } from "./upgrades.ts";
import { noAmmo, UPGRADE_WEAPONS } from "./weapons.ts";

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
  it("releases the documented Stardust per destroyed enemy archetype", () => {
    const expected: Record<EnemyArchetype, number> = {
      capital: 12,
      fighter: 2,
      frigate: 5,
      interceptor: 1,
      retaliator: 4,
      swarm: 1,
    };
    for (const [archetype, amount] of Object.entries(expected)) {
      // A roll of 0.999 never meets a weapon drop chance.
      expect(rollEnemyDrop(ECONOMY, 1, archetype as EnemyArchetype, () => 0.999)).toEqual({
        stardust: amount,
        weapon: null,
      });
    }
  });

  it("pays each enemy half its hit points, rounded down, and at least 1", () => {
    for (const [archetype, definition] of Object.entries(enemyCatalog)) {
      // Multipart ships are defeated through their hardpoints, so those carry their hit points.
      const hp = definition.hardpoints.length
        ? definition.hardpoints.reduce((sum, part) => sum + part.hp, 0)
        : definition.hp;
      expect(ECONOMY.enemyStardust[archetype as EnemyArchetype]).toBe(
        Math.max(1, Math.floor(hp / 2)),
      );
    }
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
    [1, "swarm", 0.0025],
    [1, "fighter", 0.0025],
    [1, "interceptor", 0.0025],
    [1, "retaliator", 0.0025],
    [1, "frigate", 0.02],
    [1, "capital", 0.05],
    [2, "swarm", 0.005],
    [2, "frigate", 0.05],
    [2, "capital", 0.05],
    [3, "frigate", 0.05],
    [3, "capital", 0.05],
  ] as const)(
    "in galaxy %i drops a random upgrade weapon from %s at %f",
    (sector, archetype, chance) => {
      const draws = chance < 0.01 ? 200000 : 40000;
      const weapons = new Map<string, number>();
      for (let index = 0; index < draws; index++) {
        const next = dropRandom(11, `wreck:${index}`);
        const drop = rollEnemyDrop(ECONOMY, sector, archetype, next);
        if (drop.weapon) {
          weapons.set(drop.weapon, (weapons.get(drop.weapon) ?? 0) + 1);
        }
      }
      const dropped = [...weapons.values()].reduce((sum, count) => sum + count, 0);
      expect(Math.abs(dropped / draws - chance)).toBeLessThan(chance * 0.15);
      // The pool is every shop weapon, the Phaser included.
      expect([...weapons.keys()].sort()).toEqual([...UPGRADE_WEAPONS].sort());
      for (const count of weapons.values()) {
        expect(Math.abs(count / dropped - 1 / 5)).toBeLessThan(0.06);
      }
    },
  );

  it("drops a weapon pickup whether or not Ada owns it, never extra Stardust", () => {
    let dropped = 0;
    for (let index = 0; index < 8000; index++) {
      const drop = rollEnemyDrop(ECONOMY, 2, "capital", dropRandom(3, `w:${index}`));
      expect(drop.stardust).toBe(ECONOMY.enemyStardust.capital);
      dropped += drop.weapon ? 1 : 0;
    }
    expect(Math.abs(dropped / 8000 - 0.05)).toBeLessThan(0.01);
  });

  it("splits every enemy drop below its cap into pickups of 1 Stardust", () => {
    for (const archetype of Object.keys(enemyCatalog) as EnemyArchetype[]) {
      const value = ECONOMY.enemyStardust[archetype];
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
    expect(events).toContainEqual({ type: "enemyDisabled" });
    expect(value.objects.some((object) => object.id === "target")).toBe(false);
    const wreck = value.objects.find((object) => object.kind === "wreck");
    expect(wreck?.wreck?.archetype).toBe("fighter");
    expect(pickups(value)).toEqual([]);
    // Art's fighter timing: drops leave at 150 ms and the wreck is gone at 450 ms.
    stepFlight(PROTOTYPE, 0.15, idle, value);
    expect(total(pickups(value))).toBe(ECONOMY.enemyStardust.fighter);
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(true);
    for (const pickup of pickups(value)) {
      expect(pickup.release?.from).toEqual({ x: wreck!.x, y: wreck!.y });
      const offset = Math.hypot(pickup.x - wreck!.x, pickup.y - wreck!.y);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThanOrEqual(19.2 * 1.6);
    }
    stepFlight(PROTOTYPE, 0.3, idle, value);
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(false);
    expect(total(pickups(value))).toBe(ECONOMY.enemyStardust.fighter);
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
    expect(total(pickups(value))).toBe(ECONOMY.enemyStardust.fighter);
    for (const pickup of pickups(value)) {
      const offset = Math.hypot(pickup.x - wreck.x, pickup.y - wreck.y);
      expect(offset).toBeLessThanOrEqual(7.68 * 1.6);
    }
    stepFlight(PROTOTYPE, 0.12, reduced, value);
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(false);
  });

  it("destroys a multipart ship once all its required parts are disabled", () => {
    const value = flight();
    const frigate = enemy("frigate", "frigate", 600, 0);
    for (const part of frigate.enemy!.hardpoints) {
      part.hp = 0;
    }
    value.objects.push(frigate);
    stepFlight(PROTOTYPE, 1 / 60, idle, value);
    expect(value.objects.some((object) => object.id === "frigate")).toBe(false);
    stepFlight(PROTOTYPE, 0.6, idle, value);
    // A frigate drop is at least its Stardust; a weapon drop adds a weapon pickup.
    expect(total(pickups(value))).toBeGreaterThanOrEqual(ECONOMY.enemyStardust.frigate);
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
      PROTOTYPE.tuning.flight.piecesPerRock,
    );
  });
});

describe("discovery caches", () => {
  it("generates Stardust caches worth 5 instead of weapon pickups", () => {
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
      expect(cache.weapon).toBeUndefined();
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
    expect(value.objects[0]!.x).toBeCloseTo(60 - 15, 6);
    expect(gained(stepFlight(PROTOTYPE, 1, idle, value))).toBe(5);
    expect(value.weapon).toBe("basic");
    expect(value.ownedWeapons).toEqual([]);
  });
});

describe("tractor beam and pickup reach", () => {
  it("pulls Stardust inside the pull radius toward Ada at the pull speed", () => {
    const value = flight();
    value.objects.push(stardust("near", 60, 0), stardust("far", 0, 70));
    stepFlight(PROTOTYPE, 0.1, idle, value);
    const near = value.objects.find((object) => object.id === "near")!;
    const far = value.objects.find((object) => object.id === "far")!;
    expect(near.x).toBeCloseTo(60 - 150 * 0.1, 6);
    expect(near.y).toBeCloseTo(0, 9);
    expect(far).toMatchObject({ x: 0, y: 70 });
  });

  it("does not pull weapon pickups", () => {
    const value = flight();
    value.objects.push({
      hp: 1,
      id: "weapon",
      kind: "pickup",
      radius: 10,
      weapon: "rapidMissile",
      x: 50,
      y: 0,
    });
    stepFlight(PROTOTYPE, 0.5, idle, value);
    expect(value.objects.find((object) => object.id === "weapon")).toMatchObject({ x: 50, y: 0 });
  });

  it("collects pickups on contact within the pickup reach of 14", () => {
    expect(PROTOTYPE.tuning.flight.pickupReach).toBe(14);
    const reach = ECONOMY.stardustPickupRadius + 14;
    const value = flight();
    value.objects.push(stardust("inside", reach - 0.1, 0, 3), stardust("outside", 0, reach + 1));
    const events = stepFlight(PROTOTYPE, 0.001, idle, value);
    expect(gained(events)).toBe(3);
    expect(value.objects.map((object) => object.id)).toEqual(["outside"]);
    const weapon = flight();
    weapon.objects.push(
      { hp: 1, id: "edge", kind: "pickup", radius: 10, weapon: "rapidMissile", x: 23.9, y: 0 },
      { hp: 1, id: "beyond", kind: "pickup", radius: 10, weapon: "multiLaser", x: 0, y: 24.1 },
    );
    stepFlight(PROTOTYPE, 0.001, idle, weapon);
    expect(weapon.ownedWeapons).toEqual(["rapidMissile"]);
  });

  it.each([
    [1, 65, 150],
    [2, 100, 220],
    [3, 135, 300],
  ])("tractor level %i has pull radius %i and speed %i", (level, radius, speed) => {
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

  it("does not change pickup reach with tractor levels", () => {
    const value = flight();
    value.levels.tractor = 3;
    value.objects.push({
      hp: 1,
      id: "weapon",
      kind: "pickup",
      radius: 10,
      weapon: "rapidMissile",
      x: 25,
      y: 0,
    });
    stepFlight(PROTOTYPE, 0.001, idle, value);
    expect(value.ownedWeapons).toEqual([]);
  });

  it("turns a found weapon Ada already owns into one pack of its ammunition", () => {
    const value = flight();
    value.ownedWeapons = ["rapidMissile"];
    value.ammo.rapidMissile = 7;
    value.objects.push({
      hp: 1,
      id: "w",
      kind: "pickup",
      radius: 10,
      weapon: "rapidMissile",
      x: 0,
      y: 0,
    });
    const events = stepFlight(PROTOTYPE, 0.01, idle, value);
    expect(gained(events)).toBe(0);
    expect(value.ammo.rapidMissile).toBe(7 + 200);
    expect(value.weapon).toBe("basic");
  });
});

describe("upgrade effects", () => {
  it.each([
    [1, 100, 1, 1, 1, 1],
    [2, 150, 1 / 1.2, 1.25, 1.05, 0.9],
    [3, 225, 1 / 1.44, 1.5625, 1.1, 0.8],
  ])(
    "applies shield, recharge and engine level %i",
    (level, shield, delay, rate, speed, seconds) => {
      const levels = { ...noLevels(), engine: level, shield: level, shieldRecharge: level };
      const tuning = shipTuning(ECONOMY, PROTOTYPE, levels);
      const base = PROTOTYPE.tuning;
      expect(tuning.shieldMax).toBeCloseTo(shield, 9);
      expect(tuning.shieldRechargeDelay).toBeCloseTo(base.shieldRechargeDelay * delay, 9);
      expect(tuning.shieldRechargeRate).toBeCloseTo(base.shieldRechargeRate * rate, 9);
      // Recharge output (rate over delay) grows about 1.5 times per level.
      expect(rate / delay).toBeCloseTo(1.5 ** (level - 1), 9);
      expect(tuning.physics.speedRatio).toBeCloseTo(base.physics.speedRatio * speed, 9);
      expect(tuning.physics.accelerationSeconds).toBeCloseTo(
        base.physics.accelerationSeconds * seconds,
        9,
      );
      expect(tuning.physics.brakingSeconds).toBeCloseTo(base.physics.brakingSeconds * seconds, 9);
      expect(tuning.physics.turnSeconds).toBe(base.physics.turnSeconds);
    },
  );

  it("fires the equipped weapon at its own level", () => {
    const value = flight();
    value.levels.weapons.basic = 3;
    stepFlight(PROTOTYPE, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, value);
    expect(value.shots[0]!.damage).toBeCloseTo(PROTOTYPE.tuning.flight.playerShotDamage * 1.5, 9);
    expect(value.fireCooldown).toBeCloseTo(WEAPON_CATALOG.basic[2].intervalSeconds, 9);
    const other = flight();
    other.levels.weapons.rapidMissile = 3;
    stepFlight(PROTOTYPE, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, other);
    expect(other.shots[0]!.damage).toBe(PROTOTYPE.tuning.flight.playerShotDamage);
  });

  it("starts a flight at the upgraded shield capacity and recharges toward it", () => {
    const levels = { ...noLevels(), shield: 2, shieldRecharge: 2 };
    const value = createFlight(
      PROTOTYPE,
      1,
      77,
      { known: [] },
      {
        ammo: noAmmo(),
        levels,
        ownedWeapons: [],
        weapon: "basic",
      },
    );
    value.objects = [];
    expect(value.shield).toBeCloseTo(150, 9);
    value.shield = 100;
    value.sinceDamage = 0;
    stepFlight(PROTOTYPE, PROTOTYPE.tuning.shieldRechargeDelay / 1.2 - 0.05, idle, value);
    expect(value.shield).toBe(100);
    stepFlight(PROTOTYPE, 0.1 + 1, idle, value);
    expect(value.shield).toBeGreaterThan(100 + 18 * 1.25 * 0.9);
  });

  it("raises Ada's top speed and acceleration with engine tuning", () => {
    const right = { ...idle, move: { x: 1, y: 0 } };
    for (const level of [1, 3]) {
      const value = flight();
      value.levels.engine = level;
      stepFlight(PROTOTYPE, 0.2, right, value);
      const physics = shipTuning(ECONOMY, PROTOTYPE, value.levels).physics;
      const top = PROTOTYPE.tuning.maxSpeed * physics.speedRatio;
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

  it("lists weapons, an upgrade row for Basic and each owned weapon, and owned ammunition", () => {
    const economy = rich();
    expect(shopRows(ECONOMY, economy, "weapons")).toEqual([
      {
        inUse: false,
        item: { kind: "weapon", weapon: "rapidMissile" },
        level: null,
        owned: false,
        price: 150,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "multiLaser" },
        level: null,
        owned: false,
        price: 250,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "heavyMissile" },
        level: null,
        owned: false,
        price: 300,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "scattershot" },
        level: null,
        owned: false,
        price: 350,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "phaser" },
        level: null,
        owned: false,
        price: 400,
      },
      {
        inUse: false,
        item: { kind: "weaponUpgrade", weapon: "basic" },
        level: { current: 1, max: 3 },
        owned: false,
        price: 150,
      },
    ]);
    expect(buy(ECONOMY, { kind: "weapon", weapon: "multiLaser" }, economy)).toEqual({
      kind: "bought",
      price: 250,
    });
    const rows = shopRows(ECONOMY, economy, "weapons");
    // The owned weapon's ammunition row leads the tab, before the weapon rows.
    expect(rows[2]).toMatchObject({ owned: true, price: null });
    expect(rows.at(-1)).toMatchObject({ item: { kind: "weaponUpgrade", weapon: "multiLaser" } });
    expect(rows[0]).toEqual({
      inUse: false,
      item: { kind: "ammo", weapon: "multiLaser" },
      level: null,
      owned: false,
      price: ECONOMY.ammo.packPrice,
    });
    expect(economy.stardust).toBe(4750);
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
    expect(shopRow(ECONOMY, economy, pack)).toMatchObject({ owned: false, price: 6 });
    expect(itemName(ECONOMY, PROTOTYPE.labels, pack)).toBe("Phaser ammo");
    expect(packCount(ECONOMY, PROTOTYPE.labels, "phaser")).toBe("×55");
  });

  it.each([
    [{ kind: "weaponUpgrade", weapon: "basic" }, [150, 300]],
    [{ kind: "track", track: "shield" }, [150, 300]],
    [{ kind: "track", track: "shieldRecharge" }, [150, 300]],
    [{ kind: "track", track: "engine" }, [120, 240]],
    [{ kind: "track", track: "tractor" }, [80, 160]],
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
    const economy = rich(200);
    expect(requestPurchase(ECONOMY, economy, { kind: "weapon", weapon: "rapidMissile" })).toEqual({
      kind: "confirm",
      left: 50,
      price: 150,
    });
    expect(requestPurchase(ECONOMY, economy, { kind: "weapon", weapon: "multiLaser" })).toEqual({
      kind: "refused",
      reason: "cantAfford",
    });
    const exact = rich(150);
    expect(
      requestPurchase(ECONOMY, exact, { kind: "weapon", weapon: "rapidMissile" }),
    ).toMatchObject({
      left: 0,
    });
  });

  it("refuses a confirmed purchase when the balance changed before Buy", () => {
    const economy = rich(150);
    const item = { kind: "weapon", weapon: "rapidMissile" } as const;
    expect(requestPurchase(ECONOMY, economy, item).kind).toBe("confirm");
    economy.stardust = 149;
    expect(buy(ECONOMY, item, economy)).toEqual({ kind: "refused", reason: "cantAfford" });
    expect(economy.ownedWeapons).toEqual([]);
    expect(economy.stardust).toBe(149);
  });

  it("refuses an upgrade for a weapon Ada does not own", () => {
    const economy = rich();
    expect(
      requestPurchase(ECONOMY, economy, { kind: "weaponUpgrade", weapon: "scattershot" }),
    ).toEqual({ kind: "refused", reason: "notForSale" });
  });

  it("sells four paint schemes at 50 and keeps Classic free, owned and in use", () => {
    const economy = rich(110);
    const paints = () =>
      shopRows(ECONOMY, economy, "ship").filter((row) => row.item.kind === "paint");
    expect(paints().map((row) => [row.item, row.owned, row.inUse, row.price])).toEqual([
      [{ kind: "paint", scheme: "classic" }, true, true, null],
      [{ kind: "paint", scheme: "cobalt" }, false, false, 50],
      [{ kind: "paint", scheme: "seafoam" }, false, false, 50],
      [{ kind: "paint", scheme: "graphite" }, false, false, 50],
      [{ kind: "paint", scheme: "iris" }, false, false, 50],
    ]);
    expect(selectPaint(ECONOMY, "cobalt", economy)).toBe(false);
    expect(buy(ECONOMY, { kind: "paint", scheme: "cobalt" }, economy)).toEqual({
      kind: "bought",
      price: 50,
    });
    expect(economy).toMatchObject({ paint: "cobalt", paints: ["classic", "cobalt"], stardust: 60 });
    expect(paints()[0]).toMatchObject({ inUse: false, owned: true });
    expect(paints()[1]).toMatchObject({ inUse: true, owned: true, price: null });
    // An owned scheme goes into use at once, with no purchase.
    expect(selectPaint(ECONOMY, "classic", economy)).toBe(true);
    expect(economy).toMatchObject({ paint: "classic", stardust: 60 });
  });

  it("sets each row's tap behaviour from ownership, use and the balance", () => {
    const economy = rich(150);
    economy.paints.push("iris");
    const states = (tab: "weapons" | "ship") =>
      shopRows(ECONOMY, economy, tab).map((row) => shopRowState(economy.stardust, row));
    // Rapid Missile, Multi-Laser, Heavy Missile, Scattershot, Phaser, then the Basic upgrade.
    expect(states("weapons")).toEqual([
      "forSale",
      "unaffordable",
      "unaffordable",
      "unaffordable",
      "unaffordable",
      "forSale",
    ]);
    // Shield, recharge, engine, tractor; then Classic, Cobalt, Seafoam, Graphite, Iris.
    expect(states("ship")).toEqual([
      "forSale",
      "forSale",
      "forSale",
      "forSale",
      "inUse",
      "forSale",
      "forSale",
      "forSale",
      "selectable",
    ]);
    economy.stardust = 40;
    expect(states("ship").slice(5)).toEqual([
      "unaffordable",
      "unaffordable",
      "unaffordable",
      "selectable",
    ]);
    economy.levels.tractor = 3;
    expect(states("ship")[3]).toBe("owned");
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
      "Rapid Missile",
      "Multi-Laser",
      "Heavy Missile",
      "Scattershot",
      "Phaser",
    ]);
    expect(itemName(ECONOMY, labels, { kind: "weaponUpgrade", weapon: "multiLaser" })).toBe(
      "Multi-Laser upgrade",
    );
    expect(UPGRADE_WEAPONS.map((weapon) => ECONOMY.weaponPrices[weapon])).toEqual([
      150, 250, 300, 350, 400,
    ]);
  });

  it("names items and fills confirm strings from the player strings", () => {
    const labels = PROTOTYPE.labels;
    const name = (item: Parameters<typeof itemName>[2]) => itemName(ECONOMY, labels, item);
    expect(name({ kind: "weaponUpgrade", weapon: "basic" })).toBe("Basic upgrade");
    expect(name({ kind: "track", track: "shield" })).toBe("Shield");
    expect(name({ kind: "track", track: "engine" })).toBe("Engine tuning");
    expect(name({ kind: "track", track: "tractor" })).toBe("Tractor beam");
    expect(name({ kind: "track", track: "shieldRecharge" })).toBe("Shield recharge");
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
