import { strictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import GALAXIES_FILE from "../../public/art/galaxies.json" with { type: "json" };
import { type AsteroidSize, CRYSTAL_FLAGS, type CrystalFlag } from "../data/asteroidCatalog.ts";
import {
  ASTEROID_LOOT,
  ASTEROID_RESOURCE_FLOOR,
  CRYSTAL_MINIMUM_ORE,
} from "../data/asteroidLoot.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunkCatalog.ts";
import { CONTENT } from "../data/content.ts";
import {
  ECONOMY,
  LASER_UPGRADE_PRICES,
  UPGRADE_PRICE_STEP,
  type UpgradeWeapon,
  weaponUpgradePrices,
} from "../data/economy.ts";
import { type EnemyArchetype, enemyCatalog, HEAVIES } from "../data/enemyCatalog.ts";
import { INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { SCREEN } from "../data/screen.ts";
import { WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import * as asteroidLoot from "./asteroidLoot.ts";
import { oreQuantityScale, rollAsteroidLoot } from "./asteroidLoot.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { planChunkCaches } from "./chunkCaches.ts";
import { type Parts, toScreen, worldParts } from "./convex.ts";
import * as dropRolls from "./drops.ts";
import {
  dropRandom,
  enemyStardust,
  rollEnemyDrop,
  rollRockAmmoDrop,
  rollSalvageDrop,
  splitResourcePickup,
} from "./drops.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight, pickupTouched, stepFlight, wreckId } from "./flight.ts";
import { dropFromRock, seededRockOre } from "./flight/destruction.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { nosePoint } from "./nose.ts";
import { HUNT_GLINT, orePickupSize, pickupOutline, stardustPickupSize } from "./pickupBody.ts";
import { playerWeaponCoverage } from "./playerWeaponCoverage.ts";
import { MOVING_ROCK_PREFIX } from "./rockRicochet.ts";
import { shipBody } from "./shipBody.ts";
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
  const value = createFlight(CONTENT, 1, seed, { known: [] });
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
    radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
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
const oreTotal = (objects: SpaceObject[]) =>
  objects
    .filter((object) => object.role === "cargo")
    .reduce((sum, object) => sum + (object.amount ?? 1), 0);
const gained = (events: FlightEvent[]) =>
  events.reduce((sum, event) => sum + (event.type === "stardust" ? event.amount : 0), 0);
const pickups = (value: FlightState) =>
  value.objects.filter((object) => object.role === "stardust");
const total = (objects: SpaceObject[]) =>
  objects.reduce((sum, object) => sum + (object.amount ?? 0), 0);

const rockResourceBounds = [
  ["small", 0, 4],
  ["medium", 1, 6],
  ["large", 2, 8],
  ["huge", 3, 10],
] as const;

describe("guaranteed destruction loot", () => {
  it.each(rockResourceBounds)(
    "pays %s between %i and %i combined units on the resource path",
    (size, floor, cap) => {
      const value = flight();
      value.ownedWeapons = [];
      const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === size)!;
      const rock: SpaceObject = {
        asteroid: shape.id,
        hp: 1,
        id: `payout-boundary:${size}`,
        kind: "rock",
        radius: shape.radius,
        x: 600,
        y: 0,
      };
      for (const { combined, draws, ore, stardust } of [
        {
          combined: floor,
          // The lowest non-small roll preserves its first Ore. Draws at and just below the Ore
          // cut add one of each to Huge.
          draws:
            size === "small" ? [0] : [0, 0, ...[0.75, 0.75 - Number.EPSILON].slice(0, floor - 1)],
          ore: size === "huge" ? 2 : size === "small" ? 0 : 1,
          stardust: size === "huge" || size === "large" ? 1 : 0,
        },
        {
          combined: cap,
          draws: [1 - Number.EPSILON, ...Array<number>(cap).fill(0.75)],
          ore: 0,
          stardust: cap,
        },
      ]) {
        const next = vi.fn(() => 0.5);
        for (const draw of draws) {
          next.mockReturnValueOnce(draw);
        }
        const roll = vi.spyOn(dropRolls, "dropRandom").mockReturnValue(next);
        try {
          expect(seededRockOre(value.seed, rock)).toBe(ore);
          expect(next).toHaveBeenCalledTimes(draws.length);
          for (const draw of draws) {
            next.mockReturnValueOnce(draw);
          }
          next.mockClear();
          value.objects = [];
          dropFromRock(CONTENT, rock, value);
          expect(oreTotal(value.objects)).toBe(ore);
          expect(total(pickups(value))).toBe(stardust);
          expect(oreTotal(value.objects) + total(pickups(value))).toBe(combined);
          expect(next).toHaveBeenCalledTimes(
            draws.length + 2 * splitResourcePickup(stardust).length,
          );
        } finally {
          roll.mockRestore();
        }
      }
    },
  );

  it.each([
    { draws: [0, 0.75, 0.75], size: "huge" as const, stardust: 2 },
    ...rockResourceBounds.map(([size, , cap]) => ({
      draws: [1 - Number.EPSILON, ...Array<number>(cap).fill(0.75)],
      size,
      stardust: cap - 1,
    })),
  ])(
    "counts crystal ore toward the floor and cap for $size with $stardust Stardust",
    ({ draws, size, stardust }) => {
      const value = flight();
      value.ownedWeapons = ["phaser"];
      const rock: SpaceObject = {
        asteroid: [...ASTEROID_SHAPES.values()].find((shape) => shape.size === size)!.id,
        crystals: CRYSTAL_FLAGS[0],
        hp: 1,
        id: "crystal-floor",
        kind: "rock",
        radius: 20,
        x: 600,
        y: 0,
      };
      // The low Huge roll gets one seeded Stardust after the guaranteed Ore. At the cap, the
      // all-Stardust roll instead gives up one Stardust to make room for Ore without a draw.
      const next = vi.fn(() => 0.5);
      for (const draw of draws) {
        next.mockReturnValueOnce(draw);
      }
      const roll = vi.spyOn(dropRolls, "dropRandom").mockReturnValue(next);
      try {
        dropFromRock(CONTENT, rock, value);
        expect(roll).toHaveBeenCalledExactlyOnceWith(value.seed, rock.id);
        expect(oreTotal(value.objects)).toBe(1);
        expect(total(pickups(value))).toBe(stardust);
        expect(next).toHaveBeenCalledTimes(draws.length + 2 * splitResourcePickup(stardust).length);
      } finally {
        roll.mockRestore();
      }
    },
  );

  it("preserves a below-floor rock's seeded payout across save and restore", () => {
    const value = flight();
    value.ownedWeapons = [];
    value.topology = CURRENT_FLIGHT_TOPOLOGY;
    const shape = [...ASTEROID_SHAPES.values()].find(({ size }) => size === "huge")!;
    const id = Array.from({ length: 100 }, (_, index) => `floor-save:${index}`).find((id) => {
      const { ore, stardust } = rollAsteroidLoot(ASTEROID_LOOT, "huge", dropRandom(value.seed, id));
      return ore + stardust === 1;
    })!;
    const rock: SpaceObject = {
      asteroid: shape.id,
      hp: 1,
      id,
      kind: "rock",
      radius: shape.radius,
      x: 600,
      y: 0,
    };
    value.objects.push(rock);
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.mode = "space";
    model.state.flight = value;
    const saved = restoreSave(model.save())!.flight!;
    const destroy = (flight: FlightState) => {
      flight.shots.push(killShot(rock));
      stepFlight(CONTENT, 1 / 60, idle, flight);
      return flight.objects.filter(({ kind }) => kind === "pickup");
    };
    const preview = seededRockOre(value.seed, rock);
    const drops = destroy(value);
    expect(oreTotal(drops)).toBe(preview);
    expect(total(drops)).toBe(3);
    expect(destroy(saved)).toEqual(drops);
    expect(
      restoreSave(model.save())!.flight!.objects.filter(({ kind }) => kind === "pickup"),
    ).toEqual(drops);
  });

  it.each(["rock"] as const)(
    "pays one bounded combined outcome only on a lethal %s hit",
    (kind) => {
      for (const size of ["small", "medium", "large", "huge"] as const) {
        const value = flight();
        const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === size)!;
        const rock: SpaceObject = {
          asteroid: shape.id,
          hp: 2,
          id: `combined-${kind}-${size}`,
          kind,
          radius: shape.radius,
          x: 600,
          y: 0,
        };
        value.objects.push(rock);
        value.shots.push({ ...killShot(rock), damage: 1 });
        stepFlight(CONTENT, 1 / 60, idle, value);
        expect(value.objects.filter((object) => object.kind === "pickup")).toHaveLength(0);
        value.shots.push(killShot(rock));
        stepFlight(CONTENT, 1 / 60, idle, value);
        const ore = value.objects.filter((object) => object.role === "cargo");
        const amount = oreTotal(ore) + total(pickups(value));
        const outcome = rollAsteroidLoot(ASTEROID_LOOT, size, dropRandom(value.seed, rock.id));
        expect(amount).toBe(
          Math.max(ASTEROID_RESOURCE_FLOOR[size], outcome.ore + outcome.stardust),
        );
        expect(value.cargo).toBe(0);
        const ids = value.objects.filter((object) => object.kind === "pickup").map(({ id }) => id);
        value.shots.push(killShot(rock), killShot(rock));
        stepFlight(CONTENT, 1 / 60, idle, value);
        expect(
          value.objects.filter((object) => object.kind === "pickup").map(({ id }) => id),
        ).toEqual(ids);
      }
    },
  );

  it("drops a destroyed moving rock's loot as its static rock of the same size would", () => {
    const drops = (id: string, moving: boolean, size: AsteroidSize) => {
      const value = flight();
      const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === size)!;
      const rock: SpaceObject = {
        asteroid: shape.id,
        hp: 1,
        id: moving ? `${MOVING_ROCK_PREFIX}${id}` : id,
        kind: moving ? "debris" : "rock",
        radius: shape.radius,
        x: 600,
        y: 0,
        ...(moving ? { velocity: { x: 0, y: 40 } } : {}),
      };
      value.objects.push(rock);
      value.shots.push(killShot(rock), killShot(rock));
      stepFlight(CONTENT, 1 / 60, idle, value);
      expect(rock.hp).toBeLessThanOrEqual(0);
      return value.objects
        .filter((object) => object.kind === "pickup")
        .map((object) => `${object.role}:${object.amount ?? 1}`)
        .sort();
    };
    let dropped = 0;
    for (const size of ["small", "medium", "large", "huge"] as const) {
      for (let index = 0; index < 6; index++) {
        const id = `rock:${index},0:${size}`;
        const still = drops(id, false, size);
        dropped += still.length;
        expect(drops(id, true, size), id).toEqual(still);
      }
    }
    expect(dropped).toBeGreaterThan(0);
  });

  it.each(["rock"] as const)(
    "supports ore-only, Stardust-only and mixed %s outcomes without a bonus",
    (kind) => {
      for (const composition of ["ore", "stardust", "mixed"] as const) {
        const value = flight();
        const candidates = Array.from({ length: 200 }, (_, index) => {
          const id = `composition:${index}`;
          return { id, loot: rollAsteroidLoot(ASTEROID_LOOT, "small", dropRandom(value.seed, id)) };
        });
        const chosen = candidates.find(({ loot }) =>
          composition === "ore"
            ? loot.stardust === 0
            : composition === "stardust"
              ? loot.ore === 0
              : loot.ore > 0 && loot.stardust > 0,
        )!;
        expect(chosen).toBeDefined();
        const rock: SpaceObject = { hp: 1, id: chosen.id, kind, radius: 20, x: 600, y: 0 };
        value.objects.push(rock);
        value.shots.push(killShot(rock), killShot(rock));
        stepFlight(CONTENT, 1 / 60, idle, value);
        expect(oreTotal(value.objects)).toBe(chosen.loot.ore);
        expect(total(pickups(value))).toBe(chosen.loot.stardust);
        expect(value.objects.some(({ upgrade }) => upgrade)).toBe(false);
        expect(value.cargo).toBe(0);
      }
    },
  );

  it.each([
    ["rock", "rapidMissile"],
    ["rock", "heavyMissile"],
  ] as const)("pays each destroyed %s once for a %s impact, including splash", (kind, weapon) => {
    const value = flight();
    const { blastRadius, damageRatio } = WEAPON_CATALOG[weapon][0];
    const damage = CONTENT.tuning.flight.playerShotDamage * damageRatio;
    const shape = ASTEROID_SHAPES.get("asteroid-s1")!;
    const target: SpaceObject = {
      asteroid: shape.id,
      hp: 2 * damage,
      id: "missile-rock",
      kind,
      radius: shape.radius,
      x: 600,
      y: 0,
    };
    const splash = { ...target, hp: damage, id: "splash-rock", x: 624, y: 24 };
    const margin = (blastRadius! + 2 * shape.silhouette.reach + 5) / 2;
    const outside = { ...target, hp: damage, id: "outside-rock", x: 600 - margin, y: margin };
    const outcome = (rock: SpaceObject) =>
      rollAsteroidLoot(ASTEROID_LOOT, shape.size, dropRandom(value.seed, rock.id));
    const directLoot = outcome(target);
    const splashLoot = outcome(splash);
    const missile = {
      ...killShot(target),
      blast: blastRadius!,
      damage,
      projectile: "missile",
    } as const;

    value.objects.push(target, splash, outside);
    value.shots.push({ ...missile, hitIds: [] });
    stepFlight(CONTENT, 1 / 60, idle, value);
    expect(target.hp).toBe(damage);
    expect(value.objects.some(({ id }) => id === splash.id)).toBe(false);
    expect(oreTotal(value.objects)).toBe(splashLoot.ore);
    expect(total(pickups(value))).toBe(splashLoot.stardust);

    value.shots.push(
      { ...missile, hitIds: [], id: "follow-up" },
      {
        ...missile,
        hitIds: [],
        id: "expiry",
        life: 0.001,
      },
    );
    stepFlight(CONTENT, 1 / 60, idle, value);
    expect(value.objects.some(({ id }) => id === target.id)).toBe(false);
    expect(value.objects).toContain(outside);
    expect(outside.hp).toBe(damage);
    expect(oreTotal(value.objects)).toBe(splashLoot.ore + directLoot.ore);
    expect(total(pickups(value))).toBe(splashLoot.stardust + directLoot.stardust);
  });

  it.each(["rock"] as const)(
    "groups rolled ore into five-unit chunks and single remainders from a %s and collects once after save/resume",
    (kind) => {
      const { minimum, weights } = ASTEROID_LOOT.totals.huge;
      const cap = minimum + weights.length - 1;
      const scale = oreQuantityScale(ASTEROID_LOOT, "huge");
      const support = new Set<number>();
      for (const [index, weight] of weights.entries()) {
        if (weight === 0) {
          continue;
        }
        const rawTotal = minimum + index;
        for (let rawOre = 0; rawOre <= rawTotal; rawOre++) {
          const protectedOne = rawOre === 1 && rawTotal === 1 && minimum === 1;
          const quantity = protectedOne ? 1 : scale * rawOre;
          support.add(Math.floor(quantity));
          support.add(Math.ceil(quantity));
        }
      }
      const seed = flight().seed;
      const candidates = new Map<number, { id: string; loot: asteroidLoot.AsteroidLoot }>();
      for (let index = 0; index < 2000 && candidates.size < support.size; index++) {
        const id = `ore-group:${index}`;
        const loot = rollAsteroidLoot(ASTEROID_LOOT, "huge", dropRandom(seed, id));
        if (loot.ore + loot.stardust >= ASTEROID_RESOURCE_FLOOR.huge && !candidates.has(loot.ore)) {
          candidates.set(loot.ore, { id, loot });
        }
      }
      expect([...candidates.keys()].sort((a, b) => a - b)).toEqual(
        [...support].sort((a, b) => a - b),
      );
      const cases = [...support]
        .sort((a, b) => a - b)
        .map((ore) => ({
          ...candidates.get(ore)!,
          ore,
          packingOnly: false,
        }));
      if (!support.has(cap)) {
        // Exercise multiple bundles through the real packing path without claiming a reachable roll.
        cases.push({
          id: "packing-seam",
          loot: { ore: cap, stardust: 0 },
          ore: cap,
          packingOnly: true,
        });
      }
      for (const { id, loot, ore, packingOnly } of cases) {
        const value = flight(seed);
        value.topology = CURRENT_FLIGHT_TOPOLOGY;
        const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "huge")!;
        const target: SpaceObject = {
          asteroid: shape.id,
          hp: 1,
          id,
          kind,
          radius: shape.radius,
          x: 600,
          y: 0,
        };
        value.objects.push(target);
        value.shots.push(killShot(target), killShot(target));
        if (packingOnly) {
          const stub = vi.spyOn(asteroidLoot, "rollAsteroidLoot").mockReturnValueOnce(loot);
          try {
            stepFlight(CONTENT, 1 / 60, idle, value);
            expect(stub).toHaveBeenCalledTimes(1);
          } finally {
            stub.mockRestore();
          }
        } else {
          stepFlight(CONTENT, 1 / 60, idle, value);
        }
        const pieces = value.objects.filter((object) => object.role === "cargo");
        expect(pieces).toHaveLength(Math.floor(ore / 5) + (ore % 5));
        expect(pieces.map((piece) => piece.amount)).toEqual([
          ...Array(Math.floor(ore / 5)).fill(5),
          ...Array(ore % 5).fill(1),
        ]);
        expect(oreTotal(pieces)).toBe(ore);
        const glyphs = value.objects.filter(
          (object) => object.role === "cargo" || object.role === "stardust",
        );
        for (const [index, first] of glyphs.entries()) {
          const a = toScreen(first);
          const widthA = (first.role === "cargo" ? orePickupSize : stardustPickupSize)(
            first.amount,
          );
          for (const second of glyphs.slice(index + 1)) {
            const b = toScreen(second);
            const widthB = (second.role === "cargo" ? orePickupSize : stardustPickupSize)(
              second.amount,
            );
            const dx = Math.max(0, Math.abs(a.x - b.x) - (widthA + widthB) / 2);
            const dy = Math.max(0, Math.abs(a.y - b.y) - (widthA + widthB) / 2);
            expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(ECONOMY.stardustPickupGap - 1e-9);
          }
        }
        expect(total(pickups(value))).toBe(loot.stardust);
        expect(value.cargo).toBe(0);
        if (ore < 5) {
          continue;
        }
        if (ore === 5) {
          expect(pieces[0]).toMatchObject({ x: target.x, y: target.y });
        }
        const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
        model.state.mode = "space";
        model.state.flight = value;
        const resumed = restoreSave(model.save())!.flight!;
        expect(resumed.objects.find((object) => object.role === "cargo")?.amount).toBe(5);
        resumed.shots.push(killShot(target));
        stepFlight(CONTENT, 1 / 60, idle, resumed);
        expect(oreTotal(resumed.objects)).toBe(ore);
        const ids = new Set(pieces.map((piece) => piece.id));
        const collected = new Set<string>();
        for (const pickup of resumed.objects.filter((object) => object.role === "cargo")) {
          if (pickup.hp <= 0) {
            continue;
          }
          resumed.player = { x: pickup.x, y: pickup.y };
          const events = stepFlight(CONTENT, 0.001, idle, resumed);
          for (const event of events) {
            if (event.type === "collected" && ids.has(event.id)) {
              collected.add(event.id);
            }
          }
        }
        expect(resumed.cargo).toBe(ore);
        expect(collected.size).toBe(pieces.length);
        stepFlight(CONTENT, 0.001, idle, resumed);
        expect(resumed.cargo).toBe(ore);
      }
    },
  );

  it("never pays ore for intact indestructible scenery", () => {
    const value = flight();
    const rock: SpaceObject = {
      hp: Infinity,
      id: "intact",
      kind: "rock",
      radius: 20,
      x: 600,
      y: 0,
    };
    value.objects.push(rock);
    value.shots.push(killShot(rock));
    stepFlight(CONTENT, 1 / 60, idle, value);
    expect(rock.hp).toBe(Infinity);
    expect(value.objects.filter((object) => object.kind === "pickup")).toHaveLength(0);
  });

  it("keeps every enemy archetype and route position above zero without relying on an optional pickup roll", () => {
    for (const galaxy of [1, 2, 3, 4, 5, 6] as const) {
      for (const archetype of Object.keys(enemyCatalog) as EnemyArchetype[]) {
        const drop = rollEnemyDrop(
          ECONOMY,
          { id: `sample:${galaxy}`, seed: 11 },
          archetype,
          () => 1,
        );
        expect(drop.stardust, `${galaxy}:${archetype}`).toBeGreaterThanOrEqual(1);
        expect(splitResourcePickup(drop.stardust).reduce((sum, amount) => sum + amount, 0)).toBe(
          drop.stardust,
        );
      }
    }
  });

  it.each(["rock"] as const)("preserves released %s loot across save and resume", (kind) => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.mode = "space";
    const value = flight();
    value.topology = CURRENT_FLIGHT_TOPOLOGY;
    const target: SpaceObject = { hp: 1, id: "saved-rock", kind, radius: 20, x: 600, y: 0 };
    value.objects.push(target);
    value.shots.push(killShot(target), killShot(target));
    stepFlight(CONTENT, 1 / 60, idle, value);
    const before = value.objects.filter(({ kind }) => kind === "pickup").map(({ id }) => id);
    expect(before.length).toBeGreaterThan(0);
    model.state.flight = value;
    const restored = restoreSave(model.save());
    expect(restored).not.toBeNull();
    const resumed = restored!.flight!;
    resumed.shots.push(killShot(target));
    stepFlight(CONTENT, 1 / 60, idle, resumed);
    expect(resumed.objects.filter(({ kind }) => kind === "pickup").map(({ id }) => id)).toEqual(
      before,
    );
  });

  it("does not pay an already released wreck again after restoring a save", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.mode = "space";
    const value = flight();
    value.topology = CURRENT_FLIGHT_TOPOLOGY;
    const target = enemy("fighter", "once-only", 600, 0);
    value.objects.push(target);
    value.shots.push(killShot(target));
    stepFlight(CONTENT, 1 / 60, idle, value);
    model.state.flight = value;
    const beforeRelease = restoreSave(model.save());
    expect(beforeRelease).not.toBeNull();
    expect(
      beforeRelease!.flight!.objects.find((object) => object.kind === "wreck")?.wreck?.released,
    ).toBeFalsy();
    stepFlight(CONTENT, 0.15, idle, beforeRelease!.flight!);
    stepFlight(CONTENT, 0.15, idle, value);
    expect(pickups(beforeRelease!.flight!)).toEqual(pickups(value));
    expect(total(pickups(value))).toBe(
      enemyStardust({ id: target.id, seed: value.seed }, "fighter"),
    );
    const before = pickups(value).map((object) => object.id);
    expect(before.length).toBeGreaterThan(0);
    expect(value.objects.find((object) => object.kind === "wreck")?.wreck?.released).toBe(true);
    model.state.flight = value;
    const restored = restoreSave(model.save());
    expect(restored).not.toBeNull();
    stepFlight(CONTENT, 0.1, idle, restored!.flight!);
    expect(pickups(restored!.flight!).map((object) => object.id)).toEqual(before);
  });
});

describe("Stardust drops", () => {
  it("reaches every approved galaxy-independent integer endpoint with even frequencies", () => {
    const ranges = {
      capital: [20, 30],
      fighter: [2, 5],
      frigate: [10, 20],
      hostileStation: [10, 20],
      interceptor: [2, 5],
      platform: [10, 20],
      retaliator: [2, 5],
      swarm: [1, 3],
    };
    for (const archetype of Object.keys(ranges) as (keyof typeof ranges)[]) {
      const [low, high] = ranges[archetype]!;
      const counts = new Map<number, number>();
      const samples = 4096;
      for (let index = 0; index < samples; index++) {
        const amount = enemyStardust({ id: `sample:${index}`, seed: 173 }, archetype);
        counts.set(amount, (counts.get(amount) ?? 0) + 1);
      }
      expect([...counts.keys()].sort((a, b) => a - b)).toEqual(
        Array.from({ length: high! - low! + 1 }, (_, index) => index + low!),
      );
      for (const count of counts.values()) {
        expect(Math.abs(count / samples - 1 / counts.size)).toBeLessThan(0.025);
      }
    }
  });

  it("shares one heavy roll between original and wreck IDs, flooring odd salvage payouts", () => {
    let odd = 0;
    for (const archetype of HEAVIES) {
      for (let index = 0; index < 400; index++) {
        const id = `h:${index}`;
        const next = vi.fn(() => 0);
        const destroyed = rollEnemyDrop(ECONOMY, { id: wreckId(id), seed: 3 }, archetype, next);
        expect(next).not.toHaveBeenCalled();
        expect(destroyed.upgrade).toBe(false);
        const salvaged = rollSalvageDrop(ECONOMY, { id, seed: 3 }, archetype, next);
        expect(next).toHaveBeenCalledOnce();
        expect(salvaged).toEqual({ stardust: Math.floor(destroyed.stardust / 2), upgrade: true });
        odd += destroyed.stardust % 2;
      }
    }
    expect(odd).toBeGreaterThan(0);
  });

  it.each([
    [1, "swarm"],
    [1, "fighter"],
    [2, "interceptor"],
    [3, "retaliator"],
  ] as const)(
    "in galaxy %i drops an upgrade pickup from a destroyed %s 0.25% of the time, never extra Stardust",
    (galaxy, archetype) => {
      const draws = 200000;
      let dropped = 0;
      const identity = { id: `route-fixture:${galaxy}`, seed: 11 };
      const reward = enemyStardust(identity, archetype);
      for (let index = 0; index < draws; index++) {
        const drop = rollEnemyDrop(ECONOMY, identity, archetype, dropRandom(11, `wreck:${index}`));
        strictEqual(drop.stardust, reward);
        dropped += drop.upgrade ? 1 : 0;
      }
      expect(Math.abs(dropped / draws - 0.0025)).toBeLessThan(0.0025 * 0.15);
    },
  );

  it.each([
    [1, "frigate"],
    [1, "capital"],
    [2, "platform"],
  ] as const)(
    "drops an upgrade pickup from galaxy %i's %s 20% of the time when salvaged, never when destroyed",
    (galaxy, archetype) => {
      let dropped = 0;
      const identity = { id: `route-fixture:${galaxy}`, seed: 5 };
      const reward = enemyStardust(identity, archetype);
      expect(
        rollSalvageDrop(ECONOMY, identity, archetype, () => 0.2 - Number.EPSILON).upgrade,
      ).toBe(true);
      expect(rollSalvageDrop(ECONOMY, identity, archetype, () => 0.2).upgrade).toBe(false);
      for (let index = 0; index < 20000; index++) {
        const salvaged = rollSalvageDrop(ECONOMY, identity, archetype, dropRandom(5, `s:${index}`));
        expect(salvaged.stardust).toBe(Math.floor(reward / 2));
        dropped += salvaged.upgrade ? 1 : 0;
        const destroyed = rollEnemyDrop(ECONOMY, identity, archetype, dropRandom(5, `d:${index}`));
        expect(destroyed).toEqual({ stardust: reward, upgrade: false });
      }
      expect(Math.abs(dropped / 20000 - 0.2)).toBeLessThan(0.006);
    },
  );

  it("packs declared rewards into fives followed by singles, including a destroyed capital", () => {
    expect(splitResourcePickup(0)).toEqual([]);
    expect(splitResourcePickup(1)).toEqual([1]);
    expect(splitResourcePickup(12)).toEqual([5, 5, 1, 1]);
    const [min, max] = [20, 30];
    const seed = 1;
    const id = Array.from({ length: 64 }, (_, index) => `capital:${index}`).find(
      (candidate) => enemyStardust({ id: candidate, seed }, "capital") === max,
    )!;
    expect(id).toBeDefined();
    const reward = enemyStardust({ id, seed }, "capital");
    expect(reward).toBeGreaterThanOrEqual(min);
    const pieces = splitResourcePickup(reward);
    expect(pieces).toEqual([5, 5, 5, 5, 5, 5]);
    expect(pieces.reduce((sum, amount) => sum + amount, 0)).toBe(reward);
  });

  it("releases a destroyed retaliator in bundles and singles for its keyed payout", () => {
    const value = flight();
    const target = enemy("retaliator", "retaliator", 500, 0);
    target.enemy!.hp = 1;
    target.hp = 1;
    value.objects.push(target);
    value.shots.push(killShot(target));
    stepFlight(CONTENT, 1 / 60, idle, value);
    stepFlight(CONTENT, 0.6, idle, value);
    const drop = rollEnemyDrop(
      ECONOMY,
      { id: target.id, seed: value.seed },
      "retaliator",
      dropRandom(value.seed, "wreck:retaliator"),
    );
    expect(drop.stardust).toBeGreaterThanOrEqual(2);
    expect(drop.stardust).toBeLessThanOrEqual(5);
    expect(pickups(value).map((object) => object.amount)).toEqual(
      splitResourcePickup(drop.stardust),
    );
  });

  it("adds ammo on its own roll for a destroyed fighter escort without changing Stardust", () => {
    const seed = 77;
    const ids = Array.from({ length: 128 }, (_, index) => `escort:${index}`);
    const ammoRoll = (id: string) => dropRandom(seed, `ammo:${wreckId(id)}`)();
    const destroy = (id: string, owned: UpgradeWeapon[]) => {
      const value = flight(seed);
      value.ownedWeapons = owned;
      const target = enemy("fighter", id, 600, 0);
      target.enemy!.escortOf = "escort-leader";
      value.objects.push(target);
      value.shots.push(killShot(target));
      expect(stepFlight(CONTENT, 1 / 60, idle, value)).toContainEqual({
        id,
        type: "enemyDestroyed",
      });
      stepFlight(CONTENT, 0.15, idle, value);
      return {
        ammo: value.objects.filter(({ ammoPack }) => ammoPack),
        stardust: pickups(value),
      };
    };
    const winner = ids.find((id) => ammoRoll(id) >= 0.1 && ammoRoll(id) < 0.15)!;
    const tooHigh = ids.find((id) => ammoRoll(id) >= 0.15 && ammoRoll(id) < 0.3)!;
    expect(winner).toBeDefined();
    expect(tooHigh).toBeDefined();
    const owned = destroy(winner, ["multiLaser"]);
    const laserOnly = destroy(winner, []);
    expect(owned.ammo).toMatchObject([{ ammoPack: true, role: "drop" }]);
    expect(laserOnly.ammo).toEqual([]);
    expect(owned.stardust).toEqual(laserOnly.stardust);
    const rejected = destroy(tooHigh, ["multiLaser"]);
    expect(rejected.ammo).toEqual([]);
    expect(total(rejected.stardust)).toBe(enemyStardust({ id: tooHigh, seed }, "fighter"));
  });

  it("breaks a destroyed enemy apart before it drops, instead of removing it at once", () => {
    const value = flight();
    const target = enemy("fighter", "target", 300, 0);
    value.objects.push(target);
    value.shots.push(killShot(target));
    const events = stepFlight(CONTENT, 1 / 60, idle, value);
    expect(events).toContainEqual({ id: target.id, type: "enemyDestroyed" });
    expect(value.objects.some((object) => object.id === "target")).toBe(false);
    const wreck = value.objects.find((object) => object.kind === "wreck");
    expect(wreck?.wreck?.archetype).toBe("fighter");
    expect(pickups(value)).toEqual([]);
    // Art's fighter timing: drops leave at 150 ms and the wreck is gone at 450 ms.
    stepFlight(CONTENT, 0.15, idle, value);
    expect(total(pickups(value))).toBe(
      enemyStardust({ id: target.id, seed: value.seed }, "fighter"),
    );
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(true);
    for (const pickup of pickups(value)) {
      expect(pickup.release?.from).toEqual({ x: wreck!.x, y: wreck!.y });
      const offset = Math.hypot(pickup.x - wreck!.x, pickup.y - wreck!.y);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThanOrEqual(19.2 * 1.6);
    }
    stepFlight(CONTENT, 0.3, idle, value);
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(false);
    expect(total(pickups(value))).toBe(
      enemyStardust({ id: target.id, seed: value.seed }, "fighter"),
    );
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
      const actor = INDUSTRIAL_BODY_KEYS.some((key) => key === archetype)
        ? "retaliator"
        : (archetype as EnemyArchetype);
      expect(ECONOMY.destruction[actor]).toEqual({
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
    stepFlight(CONTENT, 1 / 60, reduced, value);
    const wreck = value.objects.find((object) => object.kind === "wreck")!;
    // Reduced drops keep their release time and separate full glints before appearing in place.
    stepFlight(CONTENT, 0.2, reduced, value);
    expect(pickups(value)).toEqual([]);
    stepFlight(CONTENT, 0.05, reduced, value);
    expect(total(pickups(value))).toBe(
      enemyStardust({ id: target.id, seed: value.seed }, "fighter"),
    );
    const released = pickups(value);
    const spread = ECONOMY.destruction.fighter.reduced.spread;
    const spacing =
      2 * Math.SQRT2 * (stardustPickupSize(1) / 2 + GALAXIES_FILE.lightField.keyline) +
      ECONOMY.stardustPickupGap;
    const points = released.map((pickup) =>
      toScreen({ x: pickup.x - wreck.x, y: pickup.y - wreck.y }),
    );
    for (const [index, point] of points.entries()) {
      // Each earlier pickup can displace x by at most one rounded separation step.
      expect(Math.abs(point.x)).toBeLessThanOrEqual(spread + index * Math.ceil(spacing));
      expect(Math.abs(point.y)).toBeLessThanOrEqual(spread * 0.8);
      for (const other of points.slice(index + 1)) {
        expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThanOrEqual(
          spacing - 1e-9,
        );
      }
      // Released at the first step after the wreck reaches Art's reduced release.
      const releaseSeconds = ECONOMY.destruction.fighter.reduced.releaseSeconds;
      expect(released[index]!.release?.at).toBeGreaterThanOrEqual(releaseSeconds);
      expect(released[index]!.release?.at).toBeLessThanOrEqual(releaseSeconds + 1 / 30);
      expect(released[index]!.release?.from).toEqual({ x: wreck.x, y: wreck.y });
    }
    const positions = released.map(({ id, x, y }) => ({ id, x, y }));
    stepFlight(CONTENT, 0.12, reduced, value);
    expect(value.objects.some((object) => object.kind === "wreck")).toBe(false);
    expect(pickups(value).map(({ id, x, y }) => ({ id, x, y }))).toEqual(positions);
  });

  it("destroys a heavy whose hull reaches 0 and drops its full rolled Stardust", () => {
    const value = flight();
    const frigate = enemy("frigate", "frigate", 600, 0);
    frigate.enemy!.hp = 0;
    value.objects.push(frigate);
    stepFlight(CONTENT, 1 / 60, idle, value);
    expect(value.objects.some((object) => object.id === "frigate")).toBe(false);
    stepFlight(CONTENT, 0.6, idle, value);
    expect(total(pickups(value))).toBe(
      enemyStardust({ id: frigate.id, seed: value.seed }, "frigate"),
    );
  });

  it("releases a huge asteroid's bounded combined loot where it breaks", () => {
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
    stepFlight(CONTENT, 1 / 60, idle, value);
    const amount = total(pickups(value)) + oreTotal(value.objects);
    expect(amount).toBeGreaterThanOrEqual(1);
    expect(amount).toBeLessThanOrEqual(10);
  });

  it("makes an asteroid's Stardust collectable at once, drawn in separated positions from 240 ms", () => {
    const value = flight();
    const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "huge")!;
    const rock: SpaceObject = {
      asteroid: shape.id,
      hp: 1,
      id: Array.from({ length: 100 }, (_, index) => `visual:${index}`).find(
        (id) => rollAsteroidLoot(ASTEROID_LOOT, "huge", dropRandom(value.seed, id)).stardust > 0,
      )!,
      kind: "rock",
      radius: shape.radius,
      x: 600,
      y: 0,
    };
    value.objects.push(rock);
    value.shots.push(killShot(rock));
    const destroyedAt = value.time;
    stepFlight(CONTENT, 1 / 60, idle, value);
    const released = pickups(value);
    expect(released.length).toBeGreaterThan(0);
    expect(released.length).toBeLessThanOrEqual(10);
    for (const pickup of released) {
      // The asteroid drop timing at every motion setting.
      expect(pickup.release?.at).toBeCloseTo(
        destroyedAt + 1 / 60 + ECONOMY.rockRelease.releaseSeconds,
        9,
      );
      expect(pickup.release?.from).toBeUndefined();
      const offset = Math.hypot(pickup.x - rock.x, pickup.y - rock.y);
      expect(offset).toBeGreaterThan(0);
      expect(Number.isFinite(offset)).toBe(true);
    }
  });

  it.each([
    ["rock", "small", 0, 0.01, 0.02],
    ["rock", "medium", 0.02, 0.03, 0.04],
    ["rock", "large", 0.04, 0.06, 0.08],
    ["rock", "huge", 0.08, 0.09, 0.1],
  ] as const)(
    "uses the canonical %s %s shot-destruction cutoff and releases a single outcome",
    (kind, size, previousChance, chance, nextChance) => {
      const seed = 77;
      const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === size)!;
      for (const result of [true, false]) {
        // Raw seed witnesses straddle the new cutoff and exercise each increase.
        const id = Array.from({ length: 2000 }, (_, index) => `exclusive:${index}`).find((id) => {
          const roll = dropRandom(seed, `ammo:${id}`)();
          return result
            ? roll >= previousChance && roll < chance
            : roll >= chance && roll < nextChance;
        })!;
        expect(id).toBeDefined();
        for (const ownership of ["owned", "none"] as const) {
          const value = flight(seed);
          value.ownedWeapons = ownership === "none" ? [] : ["phaser"];
          const target: SpaceObject = {
            asteroid: shape.id,
            hp: 1,
            id,
            kind,
            radius: shape.radius,
            x: 600,
            y: 0,
          };
          value.objects.push(target);
          value.shots.push(killShot(target), killShot(target));
          stepFlight(CONTENT, 1 / 60, idle, value);
          const drops = value.objects.filter((object) => object.kind === "pickup");
          if (result && ownership === "owned") {
            expect(drops).toHaveLength(1);
            expect(drops[0]).toMatchObject({ ammoPack: true, role: "drop" });
            expect(drops[0]!.upgrade).not.toBe(true);
          } else {
            expect(drops.some((object) => object.ammoPack)).toBe(false);
            const expected = rollAsteroidLoot(ASTEROID_LOOT, size, dropRandom(seed, id));
            const ore = seededRockOre(seed, target);
            expect(oreTotal(drops)).toBe(ore);
            expect(ore + total(pickups(value))).toBe(
              Math.max(ASTEROID_RESOURCE_FLOOR[size], expected.ore + expected.stardust),
            );
          }
          const ids = drops.map((object) => object.id);
          value.shots.push(killShot(target));
          stepFlight(CONTENT, 0.001, idle, value);
          expect(
            value.objects.filter((object) => object.kind === "pickup").map((object) => object.id),
          ).toEqual(ids);
        }
      }
    },
  );

  it("drops an ammo pack from a destroyed rock on its own roll while Ada owns a weapon, never an upgrade", () => {
    const seed = 77;
    const owned = ["phaser"] as const;
    const ids = Array.from({ length: 2000 }, (_, index) => `rock:${index}`);
    const dropsAmmo = (id: string) =>
      rollRockAmmoDrop(ECONOMY, owned, "small", dropRandom(seed, `ammo:${id}`));
    const destroy = (weapons: UpgradeWeapon[], ...rockIds: string[]) => {
      const value = flight(seed);
      value.ownedWeapons = weapons;
      // A 10-wide grid 50 units apart, clear of Ada at the origin.
      for (const [index, id] of rockIds.entries()) {
        const at = { x: 200 + (index % 10) * 50, y: -225 + Math.floor(index / 10) * 50 };
        const rock: SpaceObject = { hp: 1, id, kind: "rock", radius: 20, ...at };
        value.objects.push(rock);
        value.shots.push(killShot(rock));
      }
      stepFlight(CONTENT, 1 / 60, idle, value);
      return value.objects.filter((object) => object.kind === "pickup" && object.role === "drop");
    };
    // Phaser does not unlock in Sunflower, yet its owner still gets rock ammo packs there.
    const ammoId = ids.find(dropsAmmo)!;
    expect(destroy([...owned], ammoId)).toMatchObject([{ ammoPack: true }]);
    expect(destroy([], ammoId)).toEqual([]);
    // Over many rocks, packs come from the ammo roll alone and none is an upgrade pickup.
    const many = ids.slice(0, 100);
    const dropped = destroy([...owned], ...many);
    expect(dropped).toHaveLength(many.filter(dropsAmmo).length);
    expect(dropped.every((object) => object.ammoPack && !object.upgrade)).toBe(true);
  });

  it("gives at least one ore and never an ammo pack from a destroyed crystal rock", () => {
    const seed = 77;
    const ids = Array.from({ length: 4000 }, (_, index) => `ore:0,0:${index}`);
    // A rock whose ammo roll hits, and one whose ordinary roll gives no ore.
    const ammoId = ids.find((id) =>
      rollRockAmmoDrop(ECONOMY, ["phaser"], "medium", dropRandom(seed, `ammo:${id}`)),
    )!;
    const orelessId = ids.find(
      (id) => rollAsteroidLoot(ASTEROID_LOOT, "medium", dropRandom(seed, id)).ore === 0,
    )!;
    expect(ammoId).toBeDefined();
    expect(orelessId).toBeDefined();
    const shape = ASTEROID_SHAPES.get("asteroid-m2")!;
    const destroy = (id: string, crystals?: CrystalFlag, moving = false) => {
      const value = flight(seed);
      value.ownedWeapons = ["phaser"];
      const rock: SpaceObject = {
        asteroid: shape.id,
        ...(crystals ? { crystals } : {}),
        hp: 1,
        id: moving ? `${MOVING_ROCK_PREFIX}${id}` : id,
        kind: moving ? "debris" : "rock",
        radius: shape.radius,
        x: 600,
        y: 0,
      };
      value.objects.push(rock);
      value.shots.push(killShot(rock));
      stepFlight(CONTENT, 1 / 60, idle, value);
      return value;
    };
    // Both flags, on a static rock and on a moving one, which rolls under its placed rock's id.
    for (const id of [ammoId, orelessId]) {
      const rolled = rollAsteroidLoot(ASTEROID_LOOT, "medium", dropRandom(seed, id));
      for (const crystals of CRYSTAL_FLAGS) {
        for (const moving of [false, true]) {
          const value = destroy(id, crystals, moving);
          expect(value.objects.some((object) => object.ammoPack)).toBe(false);
          expect(oreTotal(value.objects)).toBe(Math.max(CRYSTAL_MINIMUM_ORE, rolled.ore));
          expect(total(pickups(value))).toBe(rolled.stardust);
        }
      }
    }
    expect(rollAsteroidLoot(ASTEROID_LOOT, "medium", dropRandom(seed, orelessId)).ore).toBeLessThan(
      CRYSTAL_MINIMUM_ORE,
    );
    // The same plain rocks keep the ordinary roll, the exclusive ammo pack included.
    const ammo = destroy(ammoId);
    expect(ammo.objects.filter((object) => object.kind === "pickup")).toMatchObject([
      { ammoPack: true },
    ]);
    const plain = destroy(orelessId);
    expect(oreTotal(plain.objects)).toBe(0);
    expect(CRYSTAL_MINIMUM_ORE).toBe(1);
  });
});

describe("discovery caches", () => {
  it("generates one five-unit Stardust pickup per cache instead of upgrade pickups", () => {
    const value = createFlight(CONTENT, 1, 4242, { known: [] });
    const discoveries = new Map<string, SpaceObject>();
    for (let step = 0; step < 40; step++) {
      value.player = { x: step * CONTENT.tuning.chunkSize * 2, y: 0 };
      stepFlight(CONTENT, 1 / 60, idle, value);
      // Rare caches are gathered along the way, since distant chunks unload.
      for (const object of value.objects) {
        if (object.kind === "pickup" && /:stardust:0$/.test(object.id)) {
          discoveries.set(object.id, object);
        }
      }
    }
    expect(discoveries.size).toBeGreaterThan(0);
    for (const cache of discoveries.values()) {
      expect(cache).toMatchObject({ amount: 5, role: "stardust" });
      expect(cache.upgrade).toBeUndefined();
    }
  });

  it("collects each cache star as one Stardust and pulls it with the ordinary tractor beam", () => {
    const value = flight();
    value.objects.push({
      amount: 1,
      hp: 1,
      id: "cache:stardust:0",
      kind: "pickup",
      radius: ECONOMY.stardustPickupRadius,
      role: "stardust",
      x: 60,
      y: 0,
    });
    stepFlight(CONTENT, 0.1, idle, value);
    // The base pull: 120 a second from within 60.
    expect(value.objects[0]!.x).toBeCloseTo(60 - 12, 6);
    expect(gained(stepFlight(CONTENT, 1, idle, value))).toBe(1);
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
    ["five-ore chunk", { amount: 5, radius: 7, role: "cargo" }],
    ["upgrade pickup", { radius: 10, upgrade: true }],
    ["ammo pack", { ammoPack: true, radius: 10 }],
  ] as const;

  it.each(TRACTOR)(
    "pulls every pickup kind at tractor level %i from within %i at %i a second, and none beyond",
    (level, radius, speed) => {
      const value = flight();
      value.levels = { ...noLevels(), tractor: level };
      for (const [name, extra] of KINDS) {
        value.objects.push(
          { hp: 1, id: `inside:${name}`, kind: "pickup", x: radius - 1, y: 0, ...extra },
          { hp: 1, id: `outside:${name}`, kind: "pickup", x: 0, y: radius + 1, ...extra },
        );
      }
      stepFlight(CONTENT, 0.05, idle, value);
      for (const [name] of KINDS) {
        const inside = value.objects.find((object) => object.id === `inside:${name}`);
        expect(inside?.x, name).toBeCloseTo(radius - 1 - speed * 0.05, 6);
        expect(inside?.y, name).toBeCloseTo(0, 9);
        expect(
          value.objects.find((object) => object.id === `outside:${name}`),
          name,
        ).toMatchObject({
          x: 0,
          y: radius + 1,
        });
      }
    },
  );

  it("collects an ammo pack at the one pickup reach, its pack chosen as Ada collects it", () => {
    const value = flight();
    value.objects.push({
      ammoPack: true,
      hp: 1,
      id: "pack",
      kind: "pickup",
      radius: 10,
      x: 0,
      y: 0,
    });
    const events = stepFlight(CONTENT, 0.001, idle, value);
    expect(events).toContainEqual({ id: "pack", type: "ammoCollected" });
    expect(value.objects.some((object) => object.id === "pack")).toBe(false);
  });

  it("zips Stardust into the ship as it collects, as every pickup does", () => {
    const value = flight();
    value.objects.push(stardust("dust", 5, 0));
    const events = stepFlight(CONTENT, 0.001, idle, value);
    // The collected event is the one the view zips the gem's sprite into the ship from.
    expect(events).toContainEqual(
      expect.objectContaining({ id: "dust", type: "collected", x: expect.any(Number) }),
    );
    expect(events).toContainEqual({ amount: 1, type: "stardust" });
    expect(CONTENT.tuning.flight.pickupZip).toBe(0.15);
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

  /** Centre distance along an axis just beyond the allowed gap, to within 0.001. */
  function contactEdge(outline: Parts, value: FlightState, axis: Vec, margin: number): number {
    const body = shipBody(value.facing);
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
  }

  it.each([
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
      const value = flight();
      const east = contactEdge(outline, value, { x: 1, y: 0 }, margin);
      const south = contactEdge(outline, value, { x: 0, y: 1 }, margin);
      value.objects.push(
        pickup("inside", value.player.x + east - 0.3, value.player.y),
        pickup("outside", value.player.x, value.player.y + south + 1),
      );
      const before = value.cargo;
      const events = stepFlight(CONTENT, 0.001, idle, value);
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

  it.each([
    ["east", { x: 1, y: 0 }],
    ["south", { x: 0, y: 1 }],
  ] as const)("collects the lit cache from its rendered outline to the %s", (_, axis) => {
    // Use the actual renderer manifest's lit rows as the test oracle for the pickup data.
    const manifest = JSON.parse(
      readFileSync(new URL("../../public/art/manifest.json", import.meta.url), "utf8"),
    ) as {
      assets: readonly {
        id: string;
        displayWidth: number;
        displayHeight: number;
        pivot: Vec;
      }[];
    };
    const sheet = JSON.parse(
      readFileSync(new URL("../../public/art/pickups/pickups.json", import.meta.url), "utf8"),
    ) as {
      frames: Record<string, { collision: [number, number][][]; frame: [number, number] }>;
    };
    const drawn = ["discovery-cache-lit-a", "discovery-cache-lit-b"].flatMap((id) => {
      const asset = manifest.assets.find((row) => row.id === id)!;
      const frame = sheet.frames[id]!;
      return frame.collision.map((part) =>
        part.map(([x, y]) => ({
          x: ((x - asset.pivot.x * frame.frame[0]) * asset.displayWidth) / frame.frame[0],
          y: ((y - asset.pivot.y * frame.frame[1]) * asset.displayHeight) / frame.frame[1],
        })),
      );
    });
    const value = flight();
    expect(CONTENT.tuning.flight.pickupMargin).toBe(20);
    const edge = contactEdge(drawn, value, axis, 20);
    const pickup = (id: string, distance: number): SpaceObject => ({
      amount: 3,
      hp: 1,
      id,
      kind: "pickup",
      radius: 10,
      role: "discovery",
      x: value.player.x + axis.x * distance,
      y: value.player.y + axis.y * distance,
    });
    const inside = pickup("inside", edge - 0.3);
    const outside = pickup("outside", edge + 1);
    value.objects.push(inside, outside);
    const events = stepFlight(CONTENT, 0.001, idle, value);
    expect(value.objects.map(({ id }) => id)).toEqual(["outside"]);
    expect(events.filter(({ type }) => type === "collected")).toEqual([
      expect.objectContaining({ id: "inside", type: "collected" }),
    ]);
    expect(gained(events)).toBe(3);
    expect(pickupOutline(inside)).toEqual(drawn);
  });

  it("collects a hunt's lost item within 20 world units of Ada's drawn ship, as its glint", () => {
    // One pickup rule: every kind reaches 20 past the drawn ship.
    expect(CONTENT.tuning.flight.pickupMargin).toBe(20);
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
    const { pickupRadius } = CONTENT.tuning.flight;
    expect(pickupTouched(CONTENT, value, at(high - 0.3), pickupRadius, HUNT_GLINT)).toBe(true);
    expect(pickupTouched(CONTENT, value, at(high + 1), pickupRadius, HUNT_GLINT)).toBe(false);
  });

  it.each(TRACTOR)("tractor level %i has pull radius %i and speed %i", (level, radius, speed) => {
    const levels = { ...noLevels(), tractor: level };
    expect(shipTuning(ECONOMY, CONTENT, levels)).toMatchObject({
      tractorRadius: radius,
      tractorSpeed: speed,
    });
    const value = flight();
    value.levels = levels;
    value.objects.push(stardust("inside", radius - 1, 0), stardust("outside", 0, radius + 1));
    stepFlight(CONTENT, 0.05, idle, value);
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
    const events = stepFlight(CONTENT, 0.001, idle, value);
    expect(events.some((event) => event.type === "upgradeCollected")).toBe(false);
    expect(value.objects.find((object) => object.id === "upgrade")!.x).toBeCloseTo(70 - 0.2, 6);
  });

  it("turns a found weapon Ada already owns into its fixed duplicate ammo grant", () => {
    const value = flight();
    value.ownedWeapons = ["rapidMissile"];
    value.ammo.rapidMissile = 7;
    expect(collectWeapon("rapidMissile", value)).toBe(false);
    expect(value.ammo.rapidMissile).toBe(7 + 260);
    expect(value.weapon).toBe("laser");
  });
});

describe("upgrade effects", () => {
  it.each([
    [1, 10, 20, 20, 175, 0.41258, 0.69264, 0.08, 0.16],
    [2, 15, 20, 20, 200, 0.34744, 0.60606, 0.07, 0.14],
    [3, 20, 20, 20, 225, 0.28229, 0.53872, 0.06, 0.12],
  ])(
    "applies shield, recharge and engine level %i",
    (level, shield, delay, fill, speed, acceleration, braking, aimTurn, turn) => {
      const levels = { ...noLevels(), engine: level, shield: level };
      const tuning = shipTuning(ECONOMY, CONTENT, levels);
      expect(tuning.shieldMax).toBe(shield);
      expect(tuning.shieldRechargeDelay).toBe(delay);
      // The shield refills from empty in its fill time whatever its capacity.
      expect(tuning.shieldMax / tuning.shieldRechargeRate).toBeCloseTo(fill, 9);
      expect(tuning.physics.maxSpeed).toBe(speed);
      expect(tuning.physics.accelerationSeconds).toBeCloseTo(acceleration, 5);
      expect(tuning.physics.brakingSeconds).toBeCloseTo(braking, 5);
      expect(tuning.physics.aimTurnSeconds).toBe(aimTurn);
      expect(tuning.physics.turnSeconds).toBe(turn);
    },
  );

  it.each([
    [0, 10, 20],
    [1, 10, 20],
    [2, 9, 16],
    [2.9, 9, 16],
    [3, 7, 12],
    [99, 7, 12],
  ])("uses independent engine timings and clamps level %i", (level, acceleration, braking) => {
    const catalog = {
      ...ECONOMY,
      engineLevels: {
        ...ECONOMY.engineLevels,
        accelerationSeconds: [9, 7],
        brakingSeconds: [16, 12],
      } as const,
    };
    const content = {
      ...CONTENT,
      tuning: {
        ...CONTENT.tuning,
        physics: { ...CONTENT.tuning.physics, accelerationSeconds: 10, brakingSeconds: 20 },
      },
    };
    const tuning = shipTuning(catalog, content, { ...noLevels(), engine: level });
    expect(tuning.physics.accelerationSeconds).toBe(acceleration);
    expect(tuning.physics.brakingSeconds).toBe(braking);
  });

  it.each([1, 2, 3])("fires Ada's level 1 Laser at 500 at engine level %i", (level) => {
    const value = flight();
    value.levels.engine = level;
    stepFlight(CONTENT, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, value);
    const { velocity } = value.shots[0]!;
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(500, 6);
  });

  it.each([
    ["laser", 1, 500, "viewport"],
    ["laser", 2, 600, "viewport"],
    ["laser", 3, 700, "viewport"],
    ["multiLaser", 1, 400, "viewport"],
    ["multiLaser", 2, 400, "viewport"],
    ["multiLaser", 3, 400, "viewport"],
    ["rapidMissile", 1, 500, 220],
    ["rapidMissile", 2, 600, 220],
    ["rapidMissile", 3, 700, 220],
    ["heavyMissile", 1, 400, 220],
    ["heavyMissile", 2, 400, 220],
    ["heavyMissile", 3, 400, 220],
  ] as const)(
    "fires %s at level %i at %i world units per second, reaching %s",
    (weapon, level, speed, reach) => {
      const value = flight();
      value.weapon = weapon;
      if (weapon !== "laser") {
        value.ammo[weapon] = 5;
      }
      value.levels.weapons[weapon] = level;
      const centre = { ...value.player };
      stepFlight(
        CONTENT,
        1 / 60,
        {
          ...idle,
          aim: { x: 1, y: 0 },
          viewportHeight: SCREEN.height,
          viewportWidth: SCREEN.width,
        },
        value,
      );
      expect(value.shots.length).toBeGreaterThan(0);
      for (const { fade, life, velocity } of value.shots) {
        expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(speed, 6);
        // The lifetime is the reach over the speed, less the step already flown; no fade.
        const expected =
          reach === "viewport"
            ? playerWeaponCoverage(
                { centre, viewportHeight: SCREEN.height, viewportWidth: SCREEN.width },
                { direction: velocity, origin: nosePoint(value.facing, centre) },
              )
            : reach;
        expect((life + 1 / 60) * speed).toBeCloseTo(expected, 6);
        expect(fade).toBeUndefined();
      }
    },
  );

  it("fires the equipped weapon at its own level", () => {
    const value = flight();
    value.levels.weapons.laser = 3;
    stepFlight(CONTENT, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, value);
    expect(value.shots[0]!.damage).toBeCloseTo(CONTENT.tuning.flight.playerShotDamage * 1.5, 9);
    expect(value.fireCooldown).toBeCloseTo(WEAPON_CATALOG.laser[2].intervalSeconds, 9);
    const other = flight();
    other.levels.weapons.rapidMissile = 3;
    stepFlight(CONTENT, 1 / 60, { ...idle, aim: { x: 1, y: 0 } }, other);
    expect(other.shots[0]!.damage).toBe(CONTENT.tuning.flight.playerShotDamage);
  });

  it("starts a flight at the upgraded shield capacity and recharges toward it", () => {
    const levels = { ...noLevels(), shield: 2 };
    const value = createFlight(
      CONTENT,
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
    value.cargo = 100;
    value.sinceDamage = 0;
    // Level 2 waits 20 s, then refills 5% of its 15 HP capacity per second.
    stepFlight(CONTENT, 20 - 0.05, idle, value);
    expect(value.shield).toBe(5);
    stepFlight(CONTENT, 0.05 + 9, idle, value);
    // Within one 1/60 s step of the refill rate.
    expect(Math.abs(value.shield - (5 + (15 / 20) * 9))).toBeLessThan(15 / 20 / 60 + 1e-9);
  });

  it("raises Ada's top speed and acceleration with engine tuning", () => {
    const right = { ...idle, move: { x: 1, y: 0 } };
    for (const level of [1, 3]) {
      const value = flight();
      value.levels.engine = level;
      stepFlight(CONTENT, 0.2, right, value);
      const physics = shipTuning(ECONOMY, CONTENT, value.levels).physics;
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
        stepFlight(CONTENT, 1 / 30, idle, value);
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
  /** Phantom's route position, where every weapon is unlocked. */
  const PHANTOM = 6;

  it("lists weapons, an upgrade row for Laser and each owned weapon, and owned ammunition", () => {
    const economy = rich();
    expect(shopRows(ECONOMY, economy, PHANTOM, "weapons")).toEqual([
      {
        inUse: false,
        item: { kind: "weapon", weapon: "multiLaser" },
        level: null,
        owned: false,
        price: 400,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "rapidMissile" },
        level: null,
        owned: false,
        price: 500,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "heavyMissile" },
        level: null,
        owned: false,
        price: 600,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "scattershot" },
        level: null,
        owned: false,
        price: 800,
      },
      {
        inUse: false,
        item: { kind: "weapon", weapon: "phaser" },
        level: null,
        owned: false,
        price: 1000,
      },
      {
        inUse: false,
        item: { kind: "weaponUpgrade", weapon: "laser" },
        level: { current: 1, max: 3 },
        owned: false,
        price: 300,
      },
    ]);
    expect(buy(ECONOMY, { kind: "weapon", weapon: "multiLaser" }, economy)).toEqual({
      kind: "bought",
      price: 400,
    });
    const rows = shopRows(ECONOMY, economy, PHANTOM, "weapons");
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
    expect(economy.stardust).toBe(4600);
    expect(economy.ownedWeapons).toEqual(["multiLaser"]);
    // A bought weapon includes its own starting ammo.
    expect(economy.ammo.multiLaser).toBe(270);
  });

  it("sells packs of an owned weapon's ammunition, never sold out, and none for others", () => {
    const economy = rich();
    expect(ECONOMY.ammo.pack).toEqual({
      heavyMissile: 75,
      multiLaser: 90,
      phaser: 75,
      rapidMissile: 180,
      scattershot: 120,
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
      expect(economy.ammo.phaser).toBe(count * 75);
    }
    expect(shopRow(ECONOMY, economy, pack)).toMatchObject({ owned: false, price: 25 });
    expect(itemName(ECONOMY, CONTENT.labels, pack)).toBe("Phaser ammo");
    expect(packCount(ECONOMY, CONTENT.labels, "phaser")).toBe("×75");
  });

  it.each([
    [{ kind: "weaponUpgrade", weapon: "laser" }, [300, 600]],
    [{ kind: "track", track: "shield" }, [450, 900]],
    [{ kind: "track", track: "engine" }, [180, 360]],
    [{ kind: "track", track: "tractor" }, [120, 240]],
  ] as const)("prices levels 2 and 3 of %j and stops at level 3", (item, prices) => {
    const economy = rich();
    let spent = 0;
    const tab = item.kind === "track" ? "ship" : "weapons";
    prices.forEach((price, index) => {
      expect(shopRows(ECONOMY, economy, PHANTOM, tab)).toContainEqual({
        inUse: false,
        item,
        level: { current: index + 1, max: 3 },
        owned: false,
        price,
      });
      expect(buy(ECONOMY, item, economy)).toEqual({ kind: "bought", price });
      spent += price;
    });
    expect(shopRows(ECONOMY, economy, PHANTOM, tab)).toContainEqual({
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
    const economy = rich(450);
    expect(requestPurchase(ECONOMY, economy, { kind: "weapon", weapon: "multiLaser" })).toEqual({
      kind: "confirm",
      left: 50,
      price: 400,
    });
    expect(requestPurchase(ECONOMY, economy, { kind: "weapon", weapon: "rapidMissile" })).toEqual({
      kind: "refused",
      reason: "cantAfford",
    });
    const exact = rich(400);
    expect(requestPurchase(ECONOMY, exact, { kind: "weapon", weapon: "multiLaser" })).toMatchObject(
      {
        left: 0,
      },
    );
  });

  it("refuses a confirmed purchase when the balance changed before Buy", () => {
    const economy = rich(400);
    const item = { kind: "weapon", weapon: "multiLaser" } as const;
    expect(requestPurchase(ECONOMY, economy, item).kind).toBe("confirm");
    economy.stardust = 399;
    expect(buy(ECONOMY, item, economy)).toEqual({ kind: "refused", reason: "cantAfford" });
    expect(economy.ownedWeapons).toEqual([]);
    expect(economy.stardust).toBe(399);
  });

  it("refuses an upgrade for a weapon Ada does not own", () => {
    const economy = rich();
    expect(
      requestPurchase(ECONOMY, economy, { kind: "weaponUpgrade", weapon: "scattershot" }),
    ).toEqual({ kind: "refused", reason: "notForSale" });
  });

  it("starts every paid paint at 1500 and keeps Classic free, owned and in use", () => {
    const economy = rich(1535);
    const paints = () =>
      shopRows(ECONOMY, economy, PHANTOM, "ship").filter((row) => row.item.kind === "paint");
    expect(paints().map((row) => [row.item, row.owned, row.inUse, row.price])).toEqual([
      [{ kind: "paint", scheme: "classic" }, true, true, null],
      [{ kind: "paint", scheme: "cobalt" }, false, false, 1500],
      [{ kind: "paint", scheme: "seafoam" }, false, false, 1500],
      [{ kind: "paint", scheme: "graphite" }, false, false, 1500],
      [{ kind: "paint", scheme: "iris" }, false, false, 1500],
      [{ kind: "paint", scheme: "amber" }, false, false, 1500],
    ]);
    expect(selectPaint(ECONOMY, "cobalt", economy)).toBe(false);
    expect(buy(ECONOMY, { kind: "paint", scheme: "cobalt" }, economy)).toEqual({
      kind: "bought",
      price: 1500,
    });
    expect(economy).toMatchObject({ paint: "cobalt", paints: ["classic", "cobalt"], stardust: 35 });
    expect(paints()[0]).toMatchObject({ inUse: false, owned: true });
    expect(paints()[1]).toMatchObject({ inUse: true, owned: true, price: null });
    // An owned scheme goes into use at once, with no purchase.
    expect(selectPaint(ECONOMY, "classic", economy)).toBe(true);
    expect(economy).toMatchObject({ paint: "classic", stardust: 35 });
  });

  it.each([
    ["iris", "cobalt", "graphite", "seafoam", "amber"],
    ["amber", "seafoam", "graphite", "cobalt", "iris"],
  ])("prices paint by purchase order beginning with %s across saves", (...order) => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.economy.stardust = 12500;
    for (const [index, scheme] of order.entries()) {
      const economy = model.state.economy;
      const price = [1500, 2000, 2500, 3000, 3500][index]!;
      for (const unowned of order.slice(index)) {
        expect(shopRow(ECONOMY, economy, { kind: "paint", scheme: unowned }).price).toBe(price);
      }
      expect(requestPurchase(ECONOMY, economy, { kind: "paint", scheme })).toEqual({
        kind: "confirm",
        left: economy.stardust - price,
        price,
      });
      expect(buy(ECONOMY, { kind: "paint", scheme }, economy)).toEqual({ kind: "bought", price });
      expect(selectPaint(ECONOMY, "classic", economy)).toBe(true);
      expect(buy(ECONOMY, { kind: "paint", scheme: "classic" }, economy)).toEqual({
        kind: "refused",
        reason: "notForSale",
      });
      const restored = restoreSave(model.save());
      expect(restored).not.toBeNull();
      expect(restored!.economy).toEqual(economy);
      model.state.economy = restored!.economy;
    }
    expect(model.state.economy.stardust).toBe(0);
    expect(
      shopRows(ECONOMY, model.state.economy, PHANTOM, "ship")
        .filter(({ item }) => item.kind === "paint")
        .every(({ owned, price }) => owned && price === null),
    ).toBe(true);
  });

  it("rechecks the current paint price and refuses insufficient funds without advancing order", () => {
    const economy = rich(3499);
    expect(requestPurchase(ECONOMY, economy, { kind: "paint", scheme: "iris" })).toMatchObject({
      price: 1500,
    });
    expect(buy(ECONOMY, { kind: "paint", scheme: "cobalt" }, economy)).toMatchObject({
      kind: "bought",
      price: 1500,
    });
    const before = structuredClone(economy);
    expect(buy(ECONOMY, { kind: "paint", scheme: "iris" }, economy)).toEqual({
      kind: "refused",
      reason: "cantAfford",
    });
    expect(economy).toEqual(before);
    economy.stardust++;
    expect(buy(ECONOMY, { kind: "paint", scheme: "iris" }, economy)).toMatchObject({
      kind: "bought",
      price: 2000,
    });
  });

  it("sets each row's tap behaviour from ownership, use and the balance", () => {
    const economy = rich(400);
    economy.paints.push("iris");
    const states = (tab: "weapons" | "ship") =>
      shopRows(ECONOMY, economy, PHANTOM, tab).map((row) => shopRowState(economy.stardust, row));
    // Multi-Laser, Rapid Missile, Heavy Missile, Scattershot, Phaser, then the Laser upgrade.
    expect(states("weapons")).toEqual([
      "forSale",
      "unaffordable",
      "unaffordable",
      "unaffordable",
      "unaffordable",
      "forSale",
    ]);
    // Shield, engine, tractor; then Classic, Cobalt, Obsidian, Crimson, Iris and Amber.
    expect(states("ship")).toEqual([
      "unaffordable",
      "forSale",
      "forSale",
      "inUse",
      "unaffordable",
      "unaffordable",
      "unaffordable",
      "selectable",
      "unaffordable",
    ]);
    economy.stardust = 40;
    expect(states("ship").slice(4)).toEqual([
      "unaffordable",
      "unaffordable",
      "unaffordable",
      "selectable",
      "unaffordable",
    ]);
    economy.levels.tractor = 3;
    expect(states("ship")[2]).toBe("owned");
  });

  it("shows a weapon's one-line description or a pack's size in the buy confirm", () => {
    const labels = CONTENT.labels;
    const about = (weapon: UpgradeWeapon) => itemAbout(ECONOMY, labels, { kind: "weapon", weapon });
    expect(about("heavyMissile")).toBe("One slow missile with a big blast.");
    expect(about("rapidMissile")).toBe("Quick missiles with a small blast.");
    expect(about("multiLaser")).toBe("A fan of laser bolts that grows with each level.");
    expect(about("scattershot")).toBe("A shotgun spread, strongest up close.");
    expect(about("phaser")).toBe("An instant beam that pierces targets in its path.");
    expect(itemAbout(ECONOMY, labels, { kind: "track", track: "shield" })).toBe("");
    expect(itemAbout(ECONOMY, labels, { kind: "ammo", weapon: "heavyMissile" })).toBe("×75");
    expect(labels.aboutMissiles).toBeUndefined();
    expect(labels.aboutTripleLaser).toBeUndefined();
  });

  it("names the five shop weapons and their upgrades", () => {
    const labels = CONTENT.labels;
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
    // Each weapon costs its level 2 upgrade price.
    expect(UPGRADE_WEAPONS.map((weapon) => ECONOMY.weaponPrices[weapon])).toEqual([
      400, 500, 600, 800, 1000,
    ]);
  });

  it("derives upgrade prices from Laser's, 25% more per later weapon, rounded up to 100", () => {
    expect(weaponUpgradePrices(LASER_UPGRADE_PRICES, UPGRADE_PRICE_STEP)).toEqual({
      heavyMissile: [600, 1200],
      laser: [300, 600],
      multiLaser: [400, 800],
      phaser: [1000, 1900],
      rapidMissile: [500, 1000],
      scattershot: [800, 1500],
    });
    expect(ECONOMY.weaponUpgradePrices).toEqual(
      weaponUpgradePrices(LASER_UPGRADE_PRICES, UPGRADE_PRICE_STEP),
    );
  });

  it("names items and fills confirm strings from the player strings", () => {
    const labels = CONTENT.labels;
    const name = (item: Parameters<typeof itemName>[2]) => itemName(ECONOMY, labels, item);
    expect(name({ kind: "weaponUpgrade", weapon: "laser" })).toBe("Laser upgrade");
    expect(name({ kind: "track", track: "shield" })).toBe("Shield");
    expect(name({ kind: "track", track: "engine" })).toBe("Engine tuning");
    expect(name({ kind: "track", track: "tractor" })).toBe("Tractor beam");
    expect(Object.keys(ECONOMY.paints).map((scheme) => name({ kind: "paint", scheme }))).toEqual([
      "Amber",
      "Classic",
      "Cobalt",
      "Crimson",
      "Iris",
      "Obsidian",
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
  it("places caches on template slots at the pickup share", () => {
    const tuning = CONTENT.tuning;
    const weights = tuning.flight.spawnWeights;
    let caches = 0;
    let chunks = 0;
    for (let x = -20; x < 20; x++) {
      for (let y = -20; y < 20; y++) {
        caches += planChunkCaches(CHUNK_CATALOG, {
          clearance: tuning.flight.shipRadius,
          field: ASTEROID_FIELDS[1]!,
          galaxy: 1,
          objectsPerChunk: tuning.flight.objectsPerChunk,
          radius: tuning.flight.rockRadius,
          seed: 99,
          shapes: [...ASTEROID_SHAPES.values()],
          shipRadius: tuning.flight.shipRadius,
          size: tuning.chunkSize,
          spawnWeights: weights,
          x,
          y,
        }).length;
        chunks++;
      }
    }
    expect(weights.pickup).toBe(0.0136);
    expect(caches / chunks).toBeCloseTo(weights.pickup * tuning.flight.objectsPerChunk, 1);
  });
});
