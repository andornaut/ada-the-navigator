import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import type { Weapon } from "../data/types.ts";
import { BEAM, WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { outlineContact, worldParts } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyHull } from "./enemyBody.ts";
import {
  activeBeamFlashes,
  activeBlastFlashes,
  activeWeaponImpacts,
  drawnBeamFlash,
  stepFlight,
} from "./flight.ts";
import { GameModel } from "./game.ts";
import { noseOffset, nosePoint } from "./nose.ts";
import { projectileOpacity } from "./playerProjectiles.ts";
import { playerWeaponCoverage } from "./playerWeaponCoverage.ts";
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
const playerRange = playerWeaponCoverage(
  { centre: { x: 0, y: 0 }, viewportHeight: 360, viewportWidth: 720 },
  { direction: { x: 1, y: 0 }, origin: nose },
);

describe("Phaser hitscan beam", () => {
  // A retaliator sturdy enough to survive a level 3 beam, so each hit shows in its hit points.
  const STURDY = 30;
  const sturdy = (id: string, x: number, y: number) => retaliator(id, x, y, STURDY);

  it("strikes only the nearest enemy along its line, for four damage", () => {
    const flight = beam([sturdy("far", 200, nose.y), sturdy("near", 100, nose.y)]);
    expect(hp(flight, "near")).toBe(STURDY - 4);
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
    expect(hp(flight, "rock")).toBe(10 - 4);
    expect(activeBeamFlashes(flight)[0]!.to.x).toBeCloseTo(80 - 20, 9);
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
    expect(hp(grazed, "enemy")).toBe(STURDY - 4);
    const missed = beam([sturdy("enemy", 150, edge + 0.5)]);
    expect(hp(missed, "enemy")).toBe(STURDY);
  });

  it.each([
    [1, playerRange, 4],
    [2, playerRange, 6],
    [3, playerRange, 8],
  ])("reaches %i: range %f from the nose, damage %f", (level, range, damage) => {
    // The farthest hull the beam's end still reaches within its half-width.
    const end = { x: ahead(range), y: nose.y };
    const farthest = edgeOf((t) => beamTouches({ x: end.x + t, y: nose.y }, end));
    const edge = end.x + farthest - 0.5;
    const struck = beam([sturdy("enemy", edge, nose.y)], level);
    expect(hp(struck, "enemy")).toBe(STURDY - damage);
    expect(hp(beam([sturdy("enemy", edge + 1, nose.y)], level), "enemy")).toBe(STURDY);
    // Only level 3 exceeds a retaliator's own 8 hit points.
    expect(alive(beam([retaliator("enemy", edge, nose.y)], level), "enemy")).toBe(level < 3);
  });

  it("flashes from the nose to the hit point, or to full range on a miss, spark included", () => {
    const hitFlight = beam([retaliator("enemy", 100, nose.y)]);
    const flash = activeBeamFlashes(hitFlight)[0]!;
    expect(flash.from).toEqual(nose);
    // The spark sits on the actual drawn hull surface, rather than the inflated beam ray.
    const target = retaliator("probe", 100, nose.y);
    expect(outlineContact(enemyHull(target.enemy!)!, target, flash.to, 0.01)).not.toBeNull();
    expect(flash.to.x).toBeLessThan(target.x);
    expect(flash.hit).toBe(true);
    expect(activeWeaponImpacts(hitFlight)).toMatchObject([
      { ...flash.to, age: flash.age, family: "phaserRings" },
    ]);
    const miss = beam([]);
    expect(activeBeamFlashes(miss)[0]!.to.x).toBeCloseTo(ahead(playerRange), 9);
    expect(activeBeamFlashes(miss)[0]!.hit).toBe(false);
    expect(activeWeaponImpacts(miss)).toEqual([]);
    // The flash shows 0.15 s and a hit's spark 0.16 s, so both last until the spark ends.
    miss.fireCooldown = 100;
    stepFlight(CONTENT, BEAM.sparkSeconds - 2 / 60, idle, miss);
    expect(activeBeamFlashes(miss)).toHaveLength(1);
    stepFlight(CONTENT, 2 / 60, idle, miss);
    expect(activeBeamFlashes(miss)).toHaveLength(0);
  });

  it("keeps the visible beam on Ada's nose and aim as she moves and turns, the hit where it landed", () => {
    const flight = beam([sturdy("enemy", 100, nose.y)]);
    const flash = activeBeamFlashes(flight)[0]!;
    const fired = structuredClone(flash);
    const reach = Math.hypot(fired.to.x - fired.from.x, fired.to.y - fired.from.y);
    const spark = structuredClone(activeWeaponImpacts(flight));
    expect(spark).toHaveLength(1);
    // At fire the beam runs along the aim to its length; the contact sits on the hull surface.
    const atFire = drawnBeamFlash(flight, flash);
    expect(atFire.from).toEqual(fired.from);
    expect(Math.hypot(atFire.to.x - fired.to.x, atFire.to.y - fired.to.y)).toBeLessThan(1);
    // Mid-flash, Ada flies down and turns toward it without firing again.
    flight.fireCooldown = 100;
    const turn = { ...idle, aim: { x: 0, y: 1 }, fire: false, move: { x: 0, y: 1 } };
    for (let slice = 0; slice < 5; slice++) {
      stepFlight(CONTENT, 1 / 60, turn, flight);
    }
    expect(activeBeamFlashes(flight)).toEqual([flash]);
    expect(flash).toMatchObject({ from: fired.from, hit: true, to: fired.to });
    expect(flight.player.y).toBeGreaterThan(0);
    expect(flight.facing.y).toBeGreaterThan(0.05);
    const drawn = drawnBeamFlash(flight, flash);
    const facing = Math.hypot(flight.facing.x, flight.facing.y);
    expect(drawn.from).toEqual(nosePoint(flight.facing, flight.player));
    expect(Math.hypot(drawn.to.x - drawn.from.x, drawn.to.y - drawn.from.y)).toBeCloseTo(reach, 9);
    expect((drawn.to.x - drawn.from.x) / reach).toBeCloseTo(flight.facing.x / facing, 9);
    expect((drawn.to.y - drawn.from.y) / reach).toBeCloseTo(flight.facing.y / facing, 9);
    // The hit, its damage and its spark stay at fire time.
    expect(hp(flight, "enemy")).toBe(STURDY - 4);
    expect(
      activeWeaponImpacts(flight).map(({ direction, family, x, y }) => ({
        direction,
        family,
        x,
        y,
      })),
    ).toEqual(spark.map(({ direction, family, x, y }) => ({ direction, family, x, y })));
  });

  it("strikes an obstacle at the nose at once", () => {
    // A rock over Ada's drawn nose: she is pushed off it and the beam meets it where it leaves.
    const flight = beam([{ hp: 10, id: "rock", kind: "rock", radius: 2, x: 12, y: nose.y }]);
    const collisionDamage = CONTENT.tuning.shieldMax - flight.shield;
    expect(collisionDamage).toBe(1);
    // Subtract the admitted bump to verify the beam's damage independently.
    expect(10 - collisionDamage - hp(flight, "rock")!).toBeCloseTo(4);
    const flash = activeBeamFlashes(flight)[0]!;
    const from = nosePoint({ x: 1, y: 0 }, flight.player);
    expect(flash.from).toEqual(from);
    expect(Math.hypot(flash.to.x - 12, flash.to.y - nose.y)).toBeCloseTo(2, 5);
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
    expect(hp(flight, "enemy")).toBe(STURDY - 4);
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
    const shield = flight.shield;
    stepFlight(CONTENT, 1 / 60, right, flight);
    const collisionDamage = shield - flight.shield;
    expect(collisionDamage).toBe(1);
    // A missed bolt would leave only bump damage, so the projectile must account for one more.
    expect(3 - collisionDamage - hp(flight, "rock")!).toBe(1);
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
      retaliator("struck", 60, 0, 5),
      retaliator("inside", 40, 60, 5),
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
    flight.objects = [retaliator("struck", 60, 0, 5), retaliator("inside", 40, 60, 5)];
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
    expect(flight.objects[0]!.hp).toBeCloseTo(3 - 0.8);
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
