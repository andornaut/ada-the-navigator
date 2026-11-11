import { describe, expect, it } from "vitest";

import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import type { Weapon } from "../data/types.ts";
import { BEAM, WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { createEnemy } from "./enemy-ai.ts";
import { activeBeamFlashes, activeBlastFlashes, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { projectileOpacity } from "./player-projectiles.ts";
import { restoreSave } from "./save.ts";
import { playOpening } from "./test-launch.ts";
import type { FlightState, SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launched(weapon: Weapon) {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  playOpening(model);
  const flight = model.state.flight!;
  flight.objects = [];
  flight.shots = [];
  flight.player = { x: 0, y: 0 };
  flight.velocity = { x: 0, y: 0 };
  flight.ownedWeapons = ["rapidMissile", "multiLaser", "scattershot"];
  flight.weapon = weapon;
  return { flight, model };
}

function retaliator(id: string, x: number, y: number): SpaceObject {
  const definition = enemyCatalog.retaliator;
  return {
    enemy: createEnemy(
      definition,
      { archetype: "retaliator", id, packId: null, phase: 0 },
      { x, y },
    ),
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: PROTOTYPE.tuning.flight.shipRadius * definition.sizeRatio,
    x,
    y,
  };
}
const hp = (flight: FlightState, id: string) =>
  flight.objects.find((object) => object.id === id)?.enemy?.hp ??
  flight.objects.find((object) => object.id === id)?.hp;
const alive = (flight: FlightState, id: string) =>
  flight.objects.some((object) => object.id === id && object.hp > 0);
const right = { ...idle, aim: { x: 1, y: 0 }, viewportWidth: 720 };

/** Fires one Phaser shot to the right in a single slice and returns the flight. */
function beam(objects: SpaceObject[], level = 1): FlightState {
  const { flight } = launched("phaser");
  flight.ownedWeapons = ["phaser"];
  flight.levels.weapons.phaser = level;
  flight.facing = { x: 1, y: 0 };
  flight.objects = objects;
  stepFlight(PROTOTYPE, 1 / 60, right, flight);
  return flight;
}
const reach = (enemy: number) => enemy + BEAM.halfWidth;

describe("Phaser hitscan beam", () => {
  it("strikes only the nearest enemy along its line, for 4x Basic damage", () => {
    const flight = beam([retaliator("far", 200, 0), retaliator("near", 100, 0)]);
    expect(hp(flight, "near")).toBe(8 - 4);
    expect(hp(flight, "far")).toBe(8);
    expect(flight.shots.filter((shot) => !shot.enemy)).toHaveLength(0);
    expect(flight.fireCooldown).toBeCloseTo(0.28 * 4, 9);
  });

  it("stops at a rock in front, sparing the enemy behind it", () => {
    const flight = beam([
      retaliator("behind", 150, 0),
      { hp: 10, id: "rock", kind: "rock", radius: 20, x: 80, y: 0 },
    ]);
    expect(hp(flight, "behind")).toBe(8);
    expect(hp(flight, "rock")).toBe(10 - 4);
    expect(activeBeamFlashes(flight)[0]!.to.x).toBeCloseTo(80 - reach(20), 9);
  });

  it("grazes an enemy within the beam half-width and misses one just beyond it", () => {
    const grazed = beam([retaliator("enemy", 150, reach(20) - 0.5)]);
    expect(hp(grazed, "enemy")).toBe(4);
    const missed = beam([retaliator("enemy", 150, reach(20) + 0.5)]);
    expect(hp(missed, "enemy")).toBe(8);
  });

  it.each([
    [1, 320, 4],
    [2, 384, 6],
    [3, 460.8, 9],
  ])("reaches %i: range %f, damage %f", (level, range, damage) => {
    const edge = range + reach(20) - 0.5;
    const struck = beam([retaliator("enemy", edge, 0)], level);
    // A retaliator has 8 hit points, so level 3 destroys it in one shot.
    if (damage < 8) {
      expect(hp(struck, "enemy")).toBe(8 - damage);
    } else {
      expect(alive(struck, "enemy")).toBe(false);
    }
    expect(hp(beam([retaliator("enemy", edge + 1, 0)], level), "enemy")).toBe(8);
  });

  it("ends its flash at the hit point, or at full range on a miss, after 0.15 s", () => {
    const hitFlight = beam([retaliator("enemy", 100, 0)]);
    const flash = activeBeamFlashes(hitFlight)[0]!;
    expect(flash.from).toEqual({ x: 0, y: 0 });
    expect(flash.to.x).toBeCloseTo(100 - reach(20), 9);
    expect(flash.to.y).toBeCloseTo(0, 9);
    const miss = beam([]);
    expect(activeBeamFlashes(miss)[0]!.to.x).toBeCloseTo(320, 9);
    miss.fireCooldown = 100;
    stepFlight(PROTOTYPE, BEAM.flashSeconds - 2 / 60, idle, miss);
    expect(activeBeamFlashes(miss)).toHaveLength(1);
    stepFlight(PROTOTYPE, 2 / 60, idle, miss);
    expect(activeBeamFlashes(miss)).toHaveLength(0);
  });

  it("hits once per shot and keeps no projectile or save state", () => {
    const { flight, model } = launched("phaser");
    flight.ownedWeapons = ["phaser"];
    flight.facing = { x: 1, y: 0 };
    flight.objects = [retaliator("enemy", 100, 0)];
    // Hold fire for one interval: exactly one shot.
    for (let slice = 0; slice < 60; slice++) {
      stepFlight(PROTOTYPE, 1 / 60, right, flight);
    }
    expect(hp(flight, "enemy")).toBe(8 - 4);
    expect(flight.shots.filter((shot) => !shot.enemy)).toHaveLength(0);
    expect(model.save()).not.toContain("flash");
  });
});

describe("integrated weapon projectiles", () => {
  it("uses missile damage and cooldown; a blast spares rocks", () => {
    const { flight } = launched("rapidMissile");
    flight.objects = [
      { hp: 10, id: "direct", kind: "rock", radius: 4, x: 30, y: 0 },
      { hp: 10, id: "nearby", kind: "rock", radius: 4, x: 30, y: 15 },
    ];
    flight.facing = { x: 1, y: 0 };
    stepFlight(PROTOTYPE, 0.1, right, flight);
    expect(hp(flight, "direct")).toBe(10 - 1.5);
    expect(hp(flight, "nearby")).toBe(10);
    expect(flight.fireCooldown).toBeGreaterThan(
      WEAPON_CATALOG.rapidMissile[0].intervalSeconds - 0.11,
    );
    expect(flight.shots).toHaveLength(0);
  });

  it("damages every enemy within a Heavy Missile's blast and never Ada", () => {
    const { flight } = launched("heavyMissile");
    flight.ownedWeapons = ["heavyMissile"];
    flight.facing = { x: 1, y: 0 };
    // The missile strikes the first hull, radius 20, about 37 ahead; Ada is inside the blast.
    flight.objects = [
      retaliator("struck", 60, 0),
      retaliator("inside", 40, 60),
      retaliator("outside", 40, -85),
    ];
    const shield = flight.shield;
    for (let slice = 0; slice < 30 && alive(flight, "struck"); slice++) {
      stepFlight(PROTOTYPE, 1 / 60, slice ? idle : right, flight);
    }
    expect(alive(flight, "struck")).toBe(false);
    expect(alive(flight, "inside")).toBe(false);
    expect(hp(flight, "outside")).toBe(8);
    expect(flight.shield).toBe(shield);
    expect(activeBlastFlashes(flight)).toMatchObject([{ radius: 60 }]);
  });

  it("passes fractional scatter damage through the canonical collision path", () => {
    const { flight } = launched("scattershot");
    flight.facing = { x: 1, y: 0 };
    stepFlight(PROTOTYPE, 0.001, { ...idle, aim: { x: 1, y: 0 }, viewportWidth: 720 }, flight);
    const center = flight.shots.find((shot) => Math.abs(shot.velocity.y) < 0.000001)!;
    expect(center.projectile).toBe("dot");
    flight.shots = [center];
    flight.fireCooldown = 100;
    flight.objects = [{ hp: 3, id: "target", kind: "rock", radius: 4, x: 30, y: 0 }];
    stepFlight(PROTOTYPE, 0.1, idle, flight);
    expect(flight.objects[0]!.hp).toBeCloseTo(2.65);
    expect(flight.shots).toHaveLength(0);
  });

  it("stops scatter pellets at their captured range when expiry falls within a step", () => {
    const { flight } = launched("scattershot");
    stepFlight(PROTOTYPE, 0.001, { ...idle, aim: { x: 1, y: 1 }, viewportWidth: 960 }, flight);
    const pellets = [...flight.shots];
    expect(pellets).toHaveLength(7);
    flight.fireCooldown = 100;
    stepFlight(PROTOTYPE, 2, idle, flight);
    expect(flight.shots).toHaveLength(0);
    for (const shot of pellets) {
      expect(Math.hypot(shot.x - shot.y, (shot.x + shot.y) / 2)).toBeCloseTo(480);
      expect(shot.life).toBe(0);
      expect(projectileOpacity(shot.fade!, shot.life)).toBe(0);
    }
  });

  it("restores active fading shots exactly and preserves their future after the viewport changes", () => {
    const { flight, model } = launched("scattershot");
    stepFlight(PROTOTYPE, 0.1, { ...idle, aim: { x: 0, y: -1 }, viewportWidth: 840 }, flight);
    const saved = model.save();
    const restored = new GameModel(PROTOTYPE, saved);
    expect(restored.state).toEqual(model.state);
    flight.fireCooldown = 100;
    restored.state.flight!.fireCooldown = 100;
    stepFlight(PROTOTYPE, 0.1, { ...idle, viewportWidth: 1200 }, flight);
    stepFlight(PROTOTYPE, 0.1, { ...idle, viewportWidth: 1200 }, restored.state.flight!);
    expect(restored.state).toEqual(model.state);
    expect(flight.shots.every((shot) => shot.fade?.projectedRange === 420)).toBe(true);
    for (const change of [{ initialLife: 0 }, { projectedRange: -1 }, { fadeStartFraction: 1 }]) {
      const invalid = JSON.parse(saved);
      Object.assign(invalid.flight.shots[0].fade, change);
      expect(restoreSave(invalid)).toBeNull();
    }
    const missingDamage = JSON.parse(saved);
    delete missingDamage.flight.shots[0].damage;
    expect(restoreSave(missingDamage)).toBeNull();
    const oldRoster = JSON.parse(saved);
    oldRoster.flight.weapon = "rapid";
    expect(restoreSave(oldRoster)).toBeNull();
  });
});
