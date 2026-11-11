import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { type EnemyArchetype, enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { dropRandom, rollAsteroidStardust, rollEnemyDrop, splitStardust } from "./drops.ts";
import { createEnemy } from "./enemy-ai.ts";
import { createFlight, stepFlight } from "./flight.ts";
import {
  buy,
  fill,
  itemAbout,
  itemName,
  requestPurchase,
  selectPaint,
  shopRows,
  shopRowState,
} from "./shop.ts";
import type { EconomyState, FlightEvent, FlightInput, FlightState, SpaceObject } from "./types.ts";
import { newEconomy, noLevels, shipTuning, upgradedWeapon } from "./upgrades.ts";

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
      capital: 150,
      fighter: 5,
      frigate: 40,
      interceptor: 6,
      oversizedCapital: 400,
      retaliator: 15,
      swarm: 2,
    };
    for (const [archetype, amount] of Object.entries(expected)) {
      // A roll of 0.999 never meets a weapon drop chance.
      expect(rollEnemyDrop(ECONOMY, [], archetype as EnemyArchetype, () => 0.999)).toEqual({
        stardust: amount,
        weapon: null,
      });
    }
  });

  it("releases one to three Stardust per asteroid with equal seeded frequency", () => {
    const counts = new Map<number, number>();
    for (let index = 0; index < 6000; index++) {
      const value = rollAsteroidStardust(ECONOMY, dropRandom(5, `rock:${index}`));
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3]);
    for (const count of counts.values()) {
      expect(count / 6000).toBeCloseTo(1 / 3, 1);
    }
  });

  it.each([
    ["swarm", 0.02],
    ["fighter", 0.02],
    ["interceptor", 0.02],
    ["retaliator", 0.02],
    ["frigate", 0.1],
    ["capital", 0.25],
  ] as const)("drops a random upgrade weapon from %s at its chance", (archetype, chance) => {
    const draws = 20000;
    const weapons = new Map<string, number>();
    for (let index = 0; index < draws; index++) {
      const drop = rollEnemyDrop(ECONOMY, [], archetype, dropRandom(11, `wreck:${index}`));
      if (drop.weapon) {
        weapons.set(drop.weapon, (weapons.get(drop.weapon) ?? 0) + 1);
      }
    }
    const dropped = [...weapons.values()].reduce((sum, count) => sum + count, 0);
    expect(Math.abs(dropped / draws - chance)).toBeLessThan(chance * 0.15);
    expect([...weapons.keys()].sort()).toEqual(["missiles", "scattershot", "tripleLaser"]);
    for (const count of weapons.values()) {
      expect(Math.abs(count / dropped - 1 / 3)).toBeLessThan(0.08);
    }
  });

  it("gives 25 Stardust instead of a dropped weapon Ada already owns", () => {
    const owned = ["missiles", "tripleLaser", "scattershot"] as const;
    let replaced = 0;
    for (let index = 0; index < 4000; index++) {
      const drop = rollEnemyDrop(ECONOMY, owned, "capital", dropRandom(3, `w:${index}`));
      expect(drop.weapon).toBeNull();
      expect([150, 175]).toContain(drop.stardust);
      replaced += drop.stardust === 175 ? 1 : 0;
    }
    expect(Math.abs(replaced / 4000 - 0.25)).toBeLessThan(0.03);
  });

  it.each([
    ["swarm", [1, 1]],
    ["fighter", [1, 1, 1, 1, 1]],
    ["interceptor", [1, 1, 1, 1, 1, 1]],
    ["retaliator", [2, 2, 2, 2, 2, 2, 2, 1]],
    ["frigate", [3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2]],
    ["capital", [7, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]],
    [
      "oversizedCapital",
      [
        17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 16, 16, 16, 16, 16, 16, 16,
        16,
      ],
    ],
  ] as const)(
    "splits a %s drop into its capped pickup count, larger first",
    (archetype, pieces) => {
      const value = ECONOMY.enemyStardust[archetype];
      const split = splitStardust(ECONOMY.pickupCap[archetype], value);
      expect(split).toEqual(pieces);
      expect(split.reduce((sum, piece) => sum + piece, 0)).toBe(value);
    },
  );

  it("splits an asteroid into one pickup per Stardust and keeps owned-weapon bonuses whole", () => {
    for (const amount of [1, 2, 3]) {
      expect(splitStardust(amount, amount)).toEqual(Array.from({ length: amount }, () => 1));
    }
    const bonus = splitStardust(ECONOMY.pickupCap.swarm, 2 + ECONOMY.ownedWeaponStardust);
    expect(bonus).toHaveLength(8);
    expect(bonus.reduce((sum, piece) => sum + piece, 0)).toBe(27);
  });

  it("releases a destroyed retaliator as eight pickups carrying 15 Stardust", () => {
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
      [],
      "retaliator",
      dropRandom(value.seed, "wreck:retaliator"),
    );
    expect(drop.stardust).toBe(15);
    expect(pickups(value).map((object) => object.amount)).toEqual([2, 2, 2, 2, 2, 2, 2, 1]);
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
    expect(total(pickups(value))).toBe(5);
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(true);
    for (const pickup of pickups(value)) {
      expect(pickup.release?.from).toEqual({ x: wreck!.x, y: wreck!.y });
      const offset = Math.hypot(pickup.x - wreck!.x, pickup.y - wreck!.y);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThanOrEqual(19.2 * 1.6);
    }
    stepFlight(PROTOTYPE, 0.3, idle, value);
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(false);
    expect(total(pickups(value))).toBe(5);
  });

  it("times each shard-drawn destruction from Art's destruction data", () => {
    const art = JSON.parse(
      readFileSync(new URL("../../public/art/enemies/destruction.json", import.meta.url), "utf8"),
    ) as {
      archetypes: Record<string, { durationMs: number; releaseMs: number; spread: number }>;
    };
    for (const [archetype, timing] of Object.entries(art.archetypes)) {
      expect(ECONOMY.destruction[archetype as EnemyArchetype]).toEqual({
        durationSeconds: timing.durationMs / 1000,
        releaseSeconds: timing.releaseMs / 1000,
        spread: timing.spread,
      });
    }
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
    // A frigate drop is at least its 40 Stardust; a weapon drop adds a weapon pickup.
    expect(total(pickups(value))).toBeGreaterThanOrEqual(40);
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
    expect(total(released)).toBeGreaterThanOrEqual(1);
    expect(total(released)).toBeLessThanOrEqual(3);
    expect(released.every((object) => object.x > 0)).toBe(true);
    expect(value.objects.filter((object) => object.role === "cargo")).toHaveLength(
      PROTOTYPE.tuning.flight.piecesPerRock,
    );
  });
});

describe("discovery caches", () => {
  it("generates Stardust caches worth 25 instead of weapon pickups", () => {
    const value = createFlight(PROTOTYPE, 1, 4242, { known: [] });
    for (let step = 0; step < 40; step++) {
      value.player = { x: step * PROTOTYPE.tuning.chunkSize * 2, y: 0 };
      stepFlight(PROTOTYPE, 1 / 60, idle, value);
    }
    const discoveries = [...value.objects, ...Object.values(value.world.notables)].filter(
      (object) => object?.kind === "pickup" && object.role === "discovery",
    );
    expect(discoveries.length).toBeGreaterThan(0);
    for (const cache of discoveries) {
      expect(cache).toMatchObject({ amount: 25 });
      expect(cache?.weapon).toBeUndefined();
    }
  });

  it("collects a cache as 25 Stardust and pulls it with the tractor beam", () => {
    const value = flight();
    value.objects.push({
      amount: 25,
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
    expect(gained(stepFlight(PROTOTYPE, 1, idle, value))).toBe(25);
    expect(value.weapon).toBe("basic");
    expect(value.ownedWeapons).toEqual([]);
  });
});

describe("tractor beam and pickup reach", () => {
  it("pulls Stardust inside the pull radius toward Ada at the pull speed", () => {
    const value = flight();
    value.objects.push(stardust("near", 90, 0), stardust("far", 0, 110));
    stepFlight(PROTOTYPE, 0.1, idle, value);
    const near = value.objects.find((object) => object.id === "near")!;
    const far = value.objects.find((object) => object.id === "far")!;
    expect(near.x).toBeCloseTo(90 - 150 * 0.1, 6);
    expect(near.y).toBeCloseTo(0, 9);
    expect(far).toMatchObject({ x: 0, y: 110 });
  });

  it("does not pull weapon pickups", () => {
    const value = flight();
    value.objects.push({
      hp: 1,
      id: "weapon",
      kind: "pickup",
      radius: 10,
      weapon: "missiles",
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
      { hp: 1, id: "edge", kind: "pickup", radius: 10, weapon: "missiles", x: 23.9, y: 0 },
      { hp: 1, id: "beyond", kind: "pickup", radius: 10, weapon: "tripleLaser", x: 0, y: 24.1 },
    );
    stepFlight(PROTOTYPE, 0.001, idle, weapon);
    expect(weapon.ownedWeapons).toEqual(["missiles"]);
  });

  it.each([
    [0, 100, 150],
    [1, 150, 220],
    [2, 200, 300],
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
    value.levels.tractor = 2;
    value.objects.push({
      hp: 1,
      id: "weapon",
      kind: "pickup",
      radius: 10,
      weapon: "missiles",
      x: 25,
      y: 0,
    });
    stepFlight(PROTOTYPE, 0.001, idle, value);
    expect(value.ownedWeapons).toEqual([]);
  });

  it("turns a found weapon Ada already owns into 25 Stardust", () => {
    const value = flight();
    value.ownedWeapons = ["missiles"];
    value.objects.push({
      hp: 1,
      id: "w",
      kind: "pickup",
      radius: 10,
      weapon: "missiles",
      x: 0,
      y: 0,
    });
    const events = stepFlight(PROTOTYPE, 0.01, idle, value);
    expect(gained(events)).toBe(25);
    expect(value.weapon).toBe("basic");
  });
});

describe("upgrade effects", () => {
  it.each([0, 1, 2, 3])("applies shield, recharge and engine level %i", (level) => {
    const levels = { ...noLevels(), engine: level, shield: level, shieldRecharge: level };
    const tuning = shipTuning(ECONOMY, PROTOTYPE, levels);
    const base = PROTOTYPE.tuning;
    expect(tuning.shieldMax).toBeCloseTo(base.shieldMax * (1 + 0.2 * level), 9);
    expect(tuning.shieldRechargeDelay).toBeCloseTo(
      base.shieldRechargeDelay * (1 - 0.15 * level),
      9,
    );
    expect(tuning.shieldRechargeRate).toBeCloseTo(base.shieldRechargeRate * (1 + 0.2 * level), 9);
    expect(tuning.physics.speedRatio).toBeCloseTo(base.physics.speedRatio * (1 + 0.05 * level), 9);
    expect(tuning.physics.accelerationSeconds).toBeCloseTo(
      base.physics.accelerationSeconds * (1 - 0.1 * level),
      9,
    );
    expect(tuning.physics.brakingSeconds).toBeCloseTo(
      base.physics.brakingSeconds * (1 - 0.1 * level),
      9,
    );
    expect(tuning.physics.turnSeconds).toBe(base.physics.turnSeconds);
  });

  it.each([0, 1, 2, 3])("applies weapon upgrade level %i to damage and interval", (level) => {
    for (const definition of Object.values(WEAPON_CATALOG)) {
      const upgraded = upgradedWeapon(ECONOMY, level, definition);
      expect(upgraded.damageRatio).toBeCloseTo(definition.damageRatio * (1 + 0.1 * level), 9);
      expect(upgraded.intervalSeconds).toBeCloseTo(
        definition.intervalSeconds * (1 - 0.1 * level),
        9,
      );
      expect(upgraded.speedRatio).toBe(definition.speedRatio);
    }
  });

  it("fires the equipped weapon with its own upgrade level", () => {
    const value = flight();
    value.levels.weapons.basic = 3;
    stepFlight(PROTOTYPE, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, value);
    expect(value.shots[0]!.damage).toBeCloseTo(PROTOTYPE.tuning.flight.playerShotDamage * 1.3, 9);
    expect(value.fireCooldown).toBeCloseTo(WEAPON_CATALOG.basic.intervalSeconds * 0.7, 9);
    const other = flight();
    other.levels.weapons.missiles = 3;
    stepFlight(PROTOTYPE, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, other);
    expect(other.shots[0]!.damage).toBe(PROTOTYPE.tuning.flight.playerShotDamage);
  });

  it("starts a flight at the upgraded shield capacity and recharges toward it", () => {
    const levels = { ...noLevels(), shield: 2, shieldRecharge: 1 };
    const value = createFlight(
      PROTOTYPE,
      1,
      77,
      { known: [] },
      {
        levels,
        ownedWeapons: [],
        weapon: "basic",
      },
    );
    value.objects = [];
    expect(value.shield).toBeCloseTo(140, 9);
    value.shield = 100;
    value.sinceDamage = 0;
    stepFlight(PROTOTYPE, PROTOTYPE.tuning.shieldRechargeDelay * 0.85 - 0.05, idle, value);
    expect(value.shield).toBe(100);
    stepFlight(PROTOTYPE, 0.1 + 1, idle, value);
    expect(value.shield).toBeGreaterThan(100 + 18 * 1.2 * 0.9);
  });

  it("raises Ada's top speed and acceleration with engine tuning", () => {
    const right = { ...idle, move: { x: 1, y: 0 } };
    for (const level of [0, 3]) {
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
    const runs = [0, 3].map((level) => {
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

  it("lists weapons with prices and an upgrade row for Basic and each owned weapon", () => {
    const economy = rich();
    expect(shopRows(ECONOMY, economy, "weapons")).toEqual([
      {
        inUse: false,
        item: { kind: "weapon", weapon: "missiles" },
        level: null,
        owned: false,
        price: 150,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "tripleLaser" },
        level: null,
        owned: false,
        price: 250,
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
        item: { kind: "weaponUpgrade", weapon: "basic" },
        level: { current: 0, max: 3 },
        owned: false,
        price: 100,
      },
    ]);
    expect(buy(ECONOMY, { kind: "weapon", weapon: "tripleLaser" }, economy)).toEqual({
      kind: "bought",
      price: 250,
    });
    const rows = shopRows(ECONOMY, economy, "weapons");
    expect(rows[1]).toMatchObject({ owned: true, price: null });
    expect(rows.at(-1)).toMatchObject({ item: { kind: "weaponUpgrade", weapon: "tripleLaser" } });
    expect(economy.stardust).toBe(4750);
    expect(economy.ownedWeapons).toEqual(["tripleLaser"]);
  });

  it.each([
    [{ kind: "weaponUpgrade", weapon: "basic" }, [100, 200, 400]],
    [{ kind: "track", track: "shield" }, [100, 200, 400]],
    [{ kind: "track", track: "shieldRecharge" }, [100, 200, 400]],
    [{ kind: "track", track: "engine" }, [120, 240, 480]],
    [{ kind: "track", track: "tractor" }, [80, 160]],
  ] as const)("prices each level of %j and stops at the last", (item, prices) => {
    const economy = rich();
    let spent = 0;
    prices.forEach((price, level) => {
      expect(shopRows(ECONOMY, economy, item.kind === "track" ? "ship" : "weapons")).toContainEqual(
        { inUse: false, item, level: { current: level, max: prices.length }, owned: false, price },
      );
      expect(buy(ECONOMY, item, economy)).toEqual({ kind: "bought", price });
      spent += price;
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
    expect(requestPurchase(ECONOMY, economy, { kind: "weapon", weapon: "missiles" })).toEqual({
      kind: "confirm",
      left: 50,
      price: 150,
    });
    expect(requestPurchase(ECONOMY, economy, { kind: "weapon", weapon: "tripleLaser" })).toEqual({
      kind: "refused",
      reason: "cantAfford",
    });
    const exact = rich(150);
    expect(requestPurchase(ECONOMY, exact, { kind: "weapon", weapon: "missiles" })).toMatchObject({
      left: 0,
    });
  });

  it("refuses a confirmed purchase when the balance changed before Buy", () => {
    const economy = rich(150);
    const item = { kind: "weapon", weapon: "missiles" } as const;
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
      [{ kind: "paint", scheme: "graphite" }, false, false, 50],
      [{ kind: "paint", scheme: "iris" }, false, false, 50],
      [{ kind: "paint", scheme: "seafoam" }, false, false, 50],
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
    const economy = rich(120);
    economy.paints.push("iris");
    const states = (tab: "weapons" | "ship") =>
      shopRows(ECONOMY, economy, tab).map((row) => shopRowState(economy.stardust, row));
    expect(states("weapons")).toEqual(["unaffordable", "unaffordable", "unaffordable", "forSale"]);
    // Shield, recharge, engine, tractor; then Classic, Cobalt, Graphite, Iris, Seafoam.
    expect(states("ship")).toEqual([
      "forSale",
      "forSale",
      "forSale",
      "forSale",
      "inUse",
      "forSale",
      "forSale",
      "selectable",
      "forSale",
    ]);
    economy.stardust = 40;
    expect(states("ship").slice(5)).toEqual([
      "unaffordable",
      "unaffordable",
      "selectable",
      "unaffordable",
    ]);
    economy.levels.tractor = 2;
    expect(states("ship")[3]).toBe("owned");
  });

  it("shows a weapon's one-line description in the buy confirm", () => {
    const labels = PROTOTYPE.labels;
    expect(itemAbout(labels, { kind: "weapon", weapon: "missiles" })).toBe(
      "One slow, strong missile.",
    );
    expect(itemAbout(labels, { kind: "weapon", weapon: "tripleLaser" })).toBe(
      "Three bolts in a fan.",
    );
    expect(itemAbout(labels, { kind: "weapon", weapon: "scattershot" })).toBe(
      "Seven short-range shots in a wide spread.",
    );
    expect(itemAbout(labels, { kind: "track", track: "shield" })).toBe("");
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
    expect(labels.stationWelcome).toBe(
      "Welcome aboard. Trade your Stardust for weapons and ship upgrades.",
    );
    expect(fill(labels.confirmTitle!, { name: "Triple Laser" })).toBe("Buy Triple Laser?");
    expect(fill(labels.confirmLeft!, { amount: 50 })).toBe("50 left after");
    expect(fill(labels.level!, { level: 1, max: 3 })).toBe("Level 1 of 3");
    expect(fill(labels.stardustAmount!, { amount: 7 })).toBe("7 Stardust");
  });
});
