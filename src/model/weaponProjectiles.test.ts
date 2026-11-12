import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import type { Weapon } from "../data/types.ts";
import { BEAM, WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { outlineContact, worldParts } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyHull } from "./enemyBody.ts";
import { activeBeamFlashes, activeBlastFlashes, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { noseOffset, nosePoint } from "./nose.ts";
import { projectileOpacity } from "./playerProjectiles.ts";
import { restoreSave } from "./save.ts";
import type { FlightState, SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launched(weapon: Weapon) {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
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

function retaliator(
  id: string,
  x: number,
  y: number,
  hp: number = enemyCatalog.retaliator.hp,
): SpaceObject {
  const definition = enemyCatalog.retaliator;
  const enemy = createEnemy(
    definition,
    { archetype: "retaliator", id, packId: null, phase: 0 },
    { x, y },
  );
  enemy.hp = hp;
  return {
    enemy,
    hp,
    id,
    kind: "enemy",
    radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
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
  stepFlight(CONTENT, 1 / 60, right, flight);
  return flight;
}
const reach = (enemy: number) => enemy + BEAM.halfWidth;
/** A retaliator's drawn hull on the world plane, from its position. */
const retaliatorHull = () => worldParts(enemyHull(retaliator("probe", 0, 0).enemy!)!);
/**
 * The greatest value of `t` in [0, `most`] for which `touches(t)` holds, to 0.001, where it
 * holds below some value and not above it.
 */
function edgeOf(touches: (t: number) => boolean, most = 400): number {
  let low = 0;
  let high = most;
  while (high - low > 1e-3) {
    const middle = (low + high) / 2;
    if (touches(middle)) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
}
/** Whether a beam point at `point` is within the half-width of a retaliator drawn at `at`. */
const beamTouches = (at: { x: number; y: number }, point: { x: number; y: number }) =>
  outlineContact(enemyHull(retaliator("probe", at.x, at.y).enemy!)!, at, point, BEAM.halfWidth) !==
  null;
// The beam and every shot leave the nose; firing right, along y = nose.y.
const nose = noseOffset({ x: 1, y: 0 });
const ahead = (distance: number) => nose.x + distance;

describe("Phaser hitscan beam", () => {
  // A retaliator sturdy enough to survive a level 3 beam, so each hit shows in its hit points.
  const STURDY = 30;
  const sturdy = (id: string, x: number, y: number) => retaliator(id, x, y, STURDY);

  it("strikes only the nearest enemy along its line, for 6.5x Laser damage", () => {
    const flight = beam([sturdy("far", 200, nose.y), sturdy("near", 100, nose.y)]);
    expect(hp(flight, "near")).toBe(STURDY - 6.5);
    expect(hp(flight, "far")).toBe(STURDY);
    expect(flight.shots.filter((shot) => !shot.enemy)).toHaveLength(0);
    expect(flight.fireCooldown).toBeCloseTo(1, 9);
  });

  it("stops at a rock in front, sparing the enemy behind it", () => {
    const flight = beam([
      sturdy("behind", 150, nose.y),
      { hp: 10, id: "rock", kind: "rock", radius: 20, x: 80, y: nose.y },
    ]);
    expect(hp(flight, "behind")).toBe(STURDY);
    expect(hp(flight, "rock")).toBe(10 - 6.5);
    expect(activeBeamFlashes(flight)[0]!.to.x).toBeCloseTo(80 - reach(20), 9);
  });

  it("grazes an enemy's drawn hull within the beam half-width and misses one just beyond it", () => {
    // The hull's highest world point sits the half-width below the beam line at the edge.
    const top = Math.min(
      ...retaliatorHull()
        .flat()
        .map((at) => at.y),
    );
    const edge = nose.y - top + BEAM.halfWidth;
    const grazed = beam([sturdy("enemy", 150, edge - 0.5)]);
    expect(hp(grazed, "enemy")).toBe(STURDY - 6.5);
    const missed = beam([sturdy("enemy", 150, edge + 0.5)]);
    expect(hp(missed, "enemy")).toBe(STURDY);
  });

  it.each([
    [1, 370, 6.5],
    [2, 370, 9.75],
    [3, 370, 14.625],
  ])("reaches %i: range %f from the nose, damage %f", (level, range, damage) => {
    // The farthest hull the beam's end still reaches within its half-width.
    const end = { x: ahead(range), y: nose.y };
    const farthest = edgeOf((t) => beamTouches({ x: end.x + t, y: nose.y }, end));
    const edge = end.x + farthest - 0.5;
    const struck = beam([sturdy("enemy", edge, nose.y)], level);
    expect(hp(struck, "enemy")).toBe(STURDY - damage);
    expect(hp(beam([sturdy("enemy", edge + 1, nose.y)], level), "enemy")).toBe(STURDY);
    // From level 2 one shot destroys a retaliator's own 8 hit points; level 1's 6.5 does not.
    expect(alive(beam([retaliator("enemy", edge, nose.y)], level), "enemy")).toBe(level === 1);
  });

  it("flashes from the nose to the hit point, or to full range on a miss, spark included", () => {
    const hitFlight = beam([retaliator("enemy", 100, nose.y)]);
    const flash = activeBeamFlashes(hitFlight)[0]!;
    expect(flash.from).toEqual(nose);
    // It ends where the beam first meets the drawn hull, refined in 2-unit steps.
    const before = edgeOf(
      (t) => !beamTouches({ x: 100, y: nose.y }, { x: nose.x + t, y: nose.y }),
      100 - nose.x,
    );
    expect(flash.to.x).toBeGreaterThanOrEqual(nose.x + before - 1e-6);
    expect(flash.to.x).toBeLessThanOrEqual(nose.x + before + 2);
    expect(flash.to.y).toBeCloseTo(nose.y, 9);
    expect(flash.hit).toBe(true);
    const miss = beam([]);
    expect(activeBeamFlashes(miss)[0]!.to.x).toBeCloseTo(ahead(370), 9);
    expect(activeBeamFlashes(miss)[0]!.hit).toBe(false);
    // The flash shows 0.15 s and a hit's spark 0.16 s, so both last until the spark ends.
    miss.fireCooldown = 100;
    stepFlight(CONTENT, BEAM.sparkSeconds - 2 / 60, idle, miss);
    expect(activeBeamFlashes(miss)).toHaveLength(1);
    stepFlight(CONTENT, 2 / 60, idle, miss);
    expect(activeBeamFlashes(miss)).toHaveLength(0);
  });

  it("strikes an obstacle at the nose at once", () => {
    // A rock over Ada's drawn nose: she is pushed off it and the beam meets it where it leaves.
    const flight = beam([{ hp: 10, id: "rock", kind: "rock", radius: 2, x: 12, y: nose.y }]);
    expect(hp(flight, "rock")).toBe(10 - 6.5);
    const flash = activeBeamFlashes(flight)[0]!;
    const from = nosePoint({ x: 1, y: 0 }, flight.player);
    expect(flash.from).toEqual(from);
    expect(flash.to).toEqual(from);
  });

  it("hits once per shot and keeps no projectile or save state", () => {
    const { flight, model } = launched("phaser");
    flight.ownedWeapons = ["phaser"];
    flight.facing = { x: 1, y: 0 };
    flight.objects = [sturdy("enemy", 100, 0)];
    // Hold fire for one interval: exactly one shot.
    for (let slice = 0; slice < 60; slice++) {
      stepFlight(CONTENT, 1 / 60, right, flight);
    }
    expect(hp(flight, "enemy")).toBe(STURDY - 6.5);
    expect(flight.shots.filter((shot) => !shot.enemy)).toHaveLength(0);
    expect(model.save()).not.toContain("flash");
  });
});

describe("Ada's shot origin", () => {
  it.each(Array.from({ length: 16 }, (_, index) => index))(
    "fires from the nose of heading %i along her smoothed facing",
    (index) => {
      const { flight } = launched("laser");
      flight.ownedWeapons = [];
      const facing = { x: Math.cos((index * Math.PI) / 8), y: Math.sin((index * Math.PI) / 8) };
      flight.facing = facing;
      // A microsecond slice fires while the ship barely turns; the shot then travels that long.
      const elapsed = 1e-6;
      stepFlight(CONTENT, elapsed, { ...idle, aim: facing, viewportWidth: 720 }, flight);
      const shot = flight.shots.find(({ enemy }) => !enemy)!;
      const at = nosePoint(facing, { x: 0, y: 0 });
      expect(shot.x - shot.velocity.x * elapsed).toBeCloseTo(at.x, 6);
      expect(shot.y - shot.velocity.y * elapsed).toBeCloseTo(at.y, 6);
      expect(
        Math.atan2(shot.velocity.y, shot.velocity.x) - Math.atan2(facing.y, facing.x),
      ).toBeCloseTo(0, 6);
    },
  );

  it("strikes an obstacle the nose starts inside at once instead of passing through", () => {
    const { flight } = launched("laser");
    flight.ownedWeapons = [];
    flight.facing = { x: 1, y: 0 };
    // A small rock just touching Ada's 10-unit hull, the nose inside it. A bolt checks contact
    // every 5 units of travel, so from the nose it would first test 5.19 from the rock's centre,
    // past its 5-unit reach, and pass through.
    flight.objects = [{ hp: 3, id: "rock", kind: "rock", radius: 2, x: 12, y: nose.y }];
    stepFlight(CONTENT, 1 / 60, right, flight);
    expect(hp(flight, "rock")).toBe(2);
    expect(flight.shots.filter((shot) => !shot.enemy)).toHaveLength(0);
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
    stepFlight(CONTENT, 0.1, right, flight);
    expect(hp(flight, "direct")).toBe(10 - 2.5);
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
      stepFlight(CONTENT, 1 / 60, slice ? idle : right, flight);
    }
    expect(alive(flight, "struck")).toBe(false);
    expect(alive(flight, "inside")).toBe(false);
    expect(hp(flight, "outside")).toBe(8);
    expect(flight.shield).toBe(shield);
    expect(activeBlastFlashes(flight)).toMatchObject([{ radius: 60 }]);
  });

  it("lets one blast flash stand in for the destruction flash of every enemy it destroys", () => {
    const { flight, model } = launched("heavyMissile");
    flight.ownedWeapons = ["heavyMissile"];
    flight.facing = { x: 1, y: 0 };
    flight.objects = [retaliator("struck", 60, 0), retaliator("inside", 40, 60)];
    for (let slice = 0; slice < 30 && alive(flight, "struck"); slice++) {
      stepFlight(CONTENT, 1 / 60, slice ? idle : right, flight);
    }
    const wreck = (id: string) => flight.objects.find((object) => object.id === `wreck:${id}`);
    expect(activeBlastFlashes(flight)).toHaveLength(1);
    expect(wreck("struck")?.wreck?.blasted).toBe(true);
    expect(wreck("inside")?.wreck?.blasted).toBe(true);
    const saved = JSON.parse(model.save());
    expect(restoreSave(saved)?.flight?.objects.find(({ id }) => id === "wreck:struck")).toEqual(
      wreck("struck"),
    );
    saved.flight.objects.find(({ id }: SpaceObject) => id === "wreck:struck").wreck.blasted = 1;
    expect(restoreSave(saved)).toBeNull();
  });

  it("keeps the destruction flash of an enemy a bolt destroys", () => {
    const { flight } = launched("laser");
    flight.ownedWeapons = [];
    flight.facing = { x: 1, y: 0 };
    // One bolt's damage destroys it.
    const target = retaliator("target", 60, 0);
    target.enemy!.hp = 1;
    target.hp = 1;
    flight.objects = [target];
    for (let slice = 0; slice < 30 && alive(flight, "target"); slice++) {
      stepFlight(CONTENT, 1 / 60, slice ? idle : right, flight);
    }
    expect(alive(flight, "target")).toBe(false);
    const wreck = flight.objects.find((object) => object.id === "wreck:target")?.wreck;
    expect(wreck).toBeDefined();
    expect(wreck?.blasted).toBeUndefined();
  });

  it("passes fractional scatter damage through the canonical collision path", () => {
    const { flight } = launched("scattershot");
    flight.facing = { x: 1, y: 0 };
    stepFlight(CONTENT, 0.001, { ...idle, aim: { x: 1, y: 0 }, viewportWidth: 720 }, flight);
    const center = flight.shots.find((shot) => Math.abs(shot.velocity.y) < 0.000001)!;
    expect(center.projectile).toBe("dot");
    flight.shots = [center];
    flight.fireCooldown = 100;
    flight.objects = [{ hp: 3, id: "target", kind: "rock", radius: 4, x: 30, y: 0 }];
    stepFlight(CONTENT, 0.1, idle, flight);
    expect(flight.objects[0]!.hp).toBeCloseTo(3 - 6 / 7);
    expect(flight.shots).toHaveLength(0);
  });

  it("stops scatter pellets 100 world units from the nose within a step", () => {
    const { flight } = launched("scattershot");
    stepFlight(CONTENT, 0.001, { ...idle, aim: { x: 1, y: 1 }, viewportWidth: 960 }, flight);
    // The pellets left the nose of the facing they fired along.
    const start = nosePoint(flight.facing, flight.player);
    const pellets = [...flight.shots];
    expect(pellets).toHaveLength(7);
    flight.fireCooldown = 100;
    stepFlight(CONTENT, 2, idle, flight);
    expect(flight.shots).toHaveLength(0);
    for (const shot of pellets) {
      const dx = shot.x - start.x;
      const dy = shot.y - start.y;
      expect(Math.hypot(dx, dy)).toBeCloseTo(100);
      expect(shot.life).toBe(0);
      expect(projectileOpacity(shot.fade!, shot.life)).toBe(0);
    }
  });

  it("restores active fading shots exactly and preserves their future after the viewport changes", () => {
    const { flight, model } = launched("scattershot");
    stepFlight(CONTENT, 0.1, { ...idle, aim: { x: 0, y: -1 }, viewportWidth: 840 }, flight);
    const saved = model.save();
    const restored = relaunch(CONTENT, saved);
    expect(restored.state).toEqual(model.state);
    flight.fireCooldown = 100;
    restored.state.flight!.fireCooldown = 100;
    stepFlight(CONTENT, 0.1, { ...idle, viewportWidth: 1200 }, flight);
    stepFlight(CONTENT, 0.1, { ...idle, viewportWidth: 1200 }, restored.state.flight!);
    expect(restored.state).toEqual(model.state);
    expect(flight.shots.every((shot) => shot.fade?.projectedRange === 100)).toBe(true);
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
