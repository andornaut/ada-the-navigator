import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import type { Weapon } from "../data/types.ts";
import { BEAM, WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { playOpening, relaunch, supportEntropy } from "../testing/launch.ts";
import { createEnemy } from "./ai/index.ts";
import { outlineContact, worldParts } from "./convex.ts";
import { enemyHull, enemyPartOutline } from "./enemyBody.ts";
import {
  activeBeamFlashes,
  activeBlastFlashes,
  activeWeaponImpacts,
  drawnBeamFlash,
  stepFlight,
} from "./flight/index.ts";
import { GameModel } from "./game.ts";
import { noseOffset, nosePoint } from "./nose.ts";
import { projectileOpacity } from "./playerProjectiles.ts";
import { playerWeaponCoverage } from "./playerWeaponCoverage.ts";
import type { FlightState, SpaceObject } from "./types.ts";
import { flightWorldContext, worldDistance } from "./world/index.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launched(weapon: Weapon) {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  playOpening(model);
  const flight = model.state.flight!;
  endArrivalGrace(flight);
  flight.objects = [];
  flight.shots = [];
  flight.player = { x: 0, y: 0 };
  flight.velocity = { x: 0, y: 0 };
  flight.ownedWeapons = ["rapidMissile", "multiLaser", "scattershot"];
  flight.weapon = weapon;
  if (weapon === "scattershot") {
    flight.ammo.scattershot = 2;
  }
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

  it("strikes both enemies along its line for four damage each", () => {
    const flight = beam([sturdy("far", 200, nose.y), sturdy("near", 100, nose.y)]);
    expect(hp(flight, "near")).toBe(STURDY - 4);
    expect(hp(flight, "far")).toBe(STURDY - 4);
    expect(activeWeaponImpacts(flight).map(({ targetId }) => targetId)).toEqual(["near", "far"]);
    expect(flight.shots.filter((shot) => !shot.enemy)).toHaveLength(0);
    expect(flight.fireCooldown).toBeCloseTo(2, 9);
  });

  it("damages a rock and the enemy behind it at separate surfaces", () => {
    const flight = beam([
      sturdy("behind", 150, nose.y),
      { hp: 10, id: "rock", kind: "rock", radius: 20, x: 80, y: nose.y },
    ]);
    expect(hp(flight, "behind")).toBe(STURDY - 4);
    expect(hp(flight, "rock")).toBe(10 - 4);
    const [rock, enemy] = activeWeaponImpacts(flight);
    expect(rock).toMatchObject({ targetId: "rock", x: 60 });
    expect(enemy!.targetId).toBe("behind");
    expect(enemy!.x).toBeGreaterThan(rock!.x);
    expect(activeBeamFlashes(flight)[0]!.to.x).toBeCloseTo(ahead(playerRange), 9);
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
    const struck = beam([sturdy("enemy", edge, nose.y), sturdy("near", 100, nose.y)], level);
    expect(hp(struck, "near")).toBe(STURDY - damage);
    expect(hp(struck, "enemy")).toBe(STURDY - damage);
    expect(hp(beam([sturdy("enemy", edge + 1, nose.y)], level), "enemy")).toBe(STURDY);
    // Only level 3 exceeds a retaliator's own 8 hit points.
    expect(alive(beam([retaliator("enemy", edge, nose.y)], level), "enemy")).toBe(level < 3);
  });

  it("flashes at full range on hit or miss and sparks at the hit surface", () => {
    const hitFlight = beam([retaliator("enemy", 100, nose.y)]);
    const flash = activeBeamFlashes(hitFlight)[0]!;
    expect(flash.from).toEqual(nose);
    // The spark sits on the actual drawn hull surface, rather than the inflated beam ray.
    const target = retaliator("probe", 100, nose.y);
    const [impact] = activeWeaponImpacts(hitFlight);
    expect(outlineContact(enemyHull(target.enemy!)!, target, impact!, 0.01)).not.toBeNull();
    expect(impact!.x).toBeLessThan(target.x);
    expect(impact).toMatchObject({ age: flash.age, family: "phaserRings", targetId: "enemy" });
    expect(flash.to.x).toBeCloseTo(ahead(playerRange), 9);
    const miss = beam([]);
    expect(activeBeamFlashes(miss)[0]!.to.x).toBeCloseTo(ahead(playerRange), 9);
    expect(activeWeaponImpacts(miss)).toEqual([]);
    // The flash shows 0.15 s and a hit's spark 0.16 s, so both last until the spark ends.
    miss.fireCooldown = 100;
    stepFlight(CONTENT, BEAM.sparkSeconds - 2 / 60, idle, miss);
    expect(activeBeamFlashes(miss)).toHaveLength(1);
    stepFlight(CONTENT, 2 / 60, idle, miss);
    expect(activeBeamFlashes(miss)).toHaveLength(0);
  });

  it("keeps the beam endpoint and damage at fire time as Ada moves and turns", () => {
    const flight = beam([sturdy("enemy", 100, nose.y)]);
    const flash = activeBeamFlashes(flight)[0]!;
    const fired = structuredClone(flash);
    const spark = structuredClone(activeWeaponImpacts(flight));
    expect(spark).toHaveLength(1);
    expect(drawnBeamFlash(flight, flash)).toEqual({ from: fired.from, to: fired.to });
    // Mid-flash, Ada flies down and turns without firing again.
    flight.fireCooldown = 100;
    const turn = { ...idle, aim: { x: 0, y: 1 }, fire: false, move: { x: 0, y: 1 } };
    for (let slice = 0; slice < 5; slice++) {
      stepFlight(CONTENT, 1 / 60, turn, flight);
    }
    expect(activeBeamFlashes(flight)).toEqual([flash]);
    expect(flash).toMatchObject({ from: fired.from, impacts: fired.impacts, to: fired.to });
    expect(flight.player.y).toBeGreaterThan(0);
    expect(flight.facing.y).toBeGreaterThan(0.05);
    const drawn = drawnBeamFlash(flight, flash);
    expect(drawn.from).toEqual(nosePoint(flight.facing, flight.player));
    expect(drawn.to).toEqual(fired.to);
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

  it("anchors the visible end of a miss to its original range boundary", () => {
    const flight = beam([]);
    const flash = activeBeamFlashes(flight)[0]!;
    const end = { ...flash.to };
    flight.player.x -= 8;
    flight.facing = { x: 0, y: 1 };
    expect(drawnBeamFlash(flight, flash)).toEqual({
      from: nosePoint(flight.facing, flight.player),
      to: end,
    });
    expect(activeWeaponImpacts(flight)).toEqual([]);
  });

  it("anchors separate real hits and the full beam endpoint across the seam", () => {
    const { flight } = launched("phaser");
    const side = flight.topology!.side;
    const seam = side / 2;
    flight.ownedWeapons = ["phaser"];
    flight.facing = { x: 1, y: 0 };
    flight.player = { x: seam - 30, y: 0 };
    flight.objects = [
      sturdy("across", -seam + 100, nose.y),
      { hp: 12, id: "rock", kind: "rock", radius: 5, x: -seam + 25, y: nose.y },
    ];
    stepFlight(CONTENT, 1 / 60, right, flight);
    expect(hp(flight, "across")).toBe(STURDY - 4);
    expect(hp(flight, "rock")).toBe(8);
    const flash = activeBeamFlashes(flight)[0]!;
    const impacts = activeWeaponImpacts(flight);
    expect(impacts.map(({ targetId }) => targetId)).toEqual(["rock", "across"]);
    expect(new Set(impacts.map(({ id }) => id)).size).toBe(2);
    flight.player.x = -seam + 10;
    const local = drawnBeamFlash(flight, flash);
    expect(local.from).toEqual(nosePoint(flight.facing, flight.player));
    expect(local.to.x).toBeCloseTo(flash.to.x - side, 8);
    expect(activeWeaponImpacts(flight)).toEqual(
      impacts.map((impact) => ({ ...impact, x: expect.closeTo(impact.x - side, 8) })),
    );
    expect(worldDistance(flightWorldContext(flight), impacts[0]!, impacts[1]!)).toBeGreaterThan(0);
  });

  it("pops armed mines without blocking later hits and skips a mine still in flight", () => {
    const { flight } = launched("phaser");
    flight.ownedWeapons = ["phaser"];
    flight.facing = { x: 1, y: 0 };
    flight.objects = [sturdy("behind", 200, nose.y)];
    flight.mines = [
      { age: 1, damage: 2, id: "first", ownerId: "layer", x: 70, y: nose.y },
      { age: -1, damage: 2, id: "unarmed", ownerId: "layer", x: 105, y: nose.y },
      { age: 1, damage: 2, id: "second", ownerId: "layer", x: 150, y: nose.y },
    ];
    stepFlight(CONTENT, 1 / 60, right, flight);
    expect(flight.mines.map(({ end }) => end?.kind)).toEqual(["pop", undefined, "pop"]);
    expect(hp(flight, "behind")).toBe(STURDY - 4);
    expect(activeWeaponImpacts(flight).map(({ targetId }) => targetId)).toEqual([
      "first",
      "second",
      "behind",
    ]);
  });

  it("damages a multipart hull once and sparks on the selected drawn surface", () => {
    const id = "heavy";
    const definition = enemyDefinition(1, "capital", id);
    const heavy = sturdy(id, 230, nose.y);
    heavy.enemy = createEnemy(
      definition,
      { archetype: "capital", id, packId: null, phase: 0 },
      heavy,
    );
    heavy.hp = heavy.enemy.hp;
    heavy.radius = CONTENT.tuning.flight.shipRadius * definition.sizeRatio;
    const before = heavy.enemy;
    const flight = beam([heavy]);
    const after = heavy.enemy;
    expect(before.hp - after.hp).toBeCloseTo(4);
    expect(after.hardpoints.map(({ hp }) => hp)).toEqual(before.hardpoints.map(({ hp }) => hp));
    const [impact] = activeWeaponImpacts(flight);
    expect(activeWeaponImpacts(flight)).toHaveLength(1);
    const outlines = [
      enemyHull(before, 1),
      ...before.hardpoints.map(({ id }) => enemyPartOutline(1, before, id)),
    ];
    expect(
      outlines.some((outline) => outline && outlineContact(outline, heavy, impact!, 0.01)),
    ).toBe(true);
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
    const [impact] = activeWeaponImpacts(flight);
    expect(Math.hypot(impact!.x - 12, impact!.y - nose.y)).toBeCloseTo(2, 5);
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
  it("uses missile damage and cooldown, damaging the struck and nearby rocks once each", () => {
    const { flight } = launched("rapidMissile");
    flight.objects = [
      { hp: 10, id: "direct", kind: "rock", radius: 4, x: 30, y: 0 },
      { hp: 10, id: "nearby", kind: "rock", radius: 4, x: 30, y: 15 },
    ];
    flight.facing = { x: 1, y: 0 };
    stepFlight(CONTENT, 0.1, right, flight);
    expect(hp(flight, "direct")).toBe(8);
    expect(hp(flight, "nearby")).toBe(8);
    expect(flight.fireCooldown).toBeGreaterThan(
      WEAPON_CATALOG.rapidMissile[0].intervalSeconds - 0.11,
    );
    expect(flight.shots).toHaveLength(0);
  });

  it.each([
    [1, 5],
    [2, 7],
    [3, 9],
  ])(
    "deals a level %i Heavy Missile's %i damage once to each target in its blast",
    (level, damage) => {
      const { flight } = launched("heavyMissile");
      flight.ownedWeapons = ["heavyMissile"];
      flight.ammo.heavyMissile = 3;
      flight.levels.weapons.heavyMissile = level;
      flight.facing = { x: 1, y: 0 };
      // The missile strikes the first hull while Ada and another enemy are inside the blast.
      flight.objects = [
        retaliator("struck", 60, 0, 30),
        retaliator("inside", 40, 60, 30),
        retaliator("outside", 40, -85),
      ];
      const shield = flight.shield;
      for (let slice = 0; slice < 30 && hp(flight, "struck") === 30; slice++) {
        stepFlight(CONTENT, 1 / 60, slice ? idle : right, flight);
      }
      expect(hp(flight, "struck")).toBe(30 - damage);
      expect(hp(flight, "inside")).toBe(30 - damage);
      expect(hp(flight, "outside")).toBe(8);
      expect(flight.shield).toBe(shield);
      expect(flight.ammo.heavyMissile).toBe(2);
      expect(activeBlastFlashes(flight)).toMatchObject([{ radius: 60 }]);
    },
  );

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
    delete flight.pendingPellets;
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
    const pellets = [...flight.shots, ...flight.pendingPellets!.map(({ shot }) => shot)];
    expect(pellets).toHaveLength(11);
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

  it("finishes a last-shell level-three volley on the flight clock after Continue", () => {
    const { flight, model } = launched("scattershot");
    flight.ammo.scattershot = 1;
    flight.levels.weapons.scattershot = 3;
    stepFlight(CONTENT, 0.01, { ...idle, aim: { x: 0, y: -1 } }, flight);
    expect(flight.weapon).toBe("laser");
    expect(flight.ammo.scattershot).toBe(0);
    expect(flight.fireCooldown).toBeCloseTo(1, 12);
    expect(flight.shots).toHaveLength(11);
    const saved = model.save();
    const restored = relaunch(CONTENT, saved);
    const resumed = restored.state.flight!;
    const queued = resumed.pendingPellets!;
    expect(queued).toEqual(flight.pendingPellets);
    expect(queued).toHaveLength(7);
    const middle = queued.slice(0, 5).map(({ shot }) => shot);
    const final = queued.slice(5).map(({ shot }) => shot);

    for (const [dt, count] of [
      [0.049, 11],
      [0.001, 16],
      [0.059, 16],
      [0.001, 18],
    ] as const) {
      stepFlight(CONTENT, dt, idle, flight);
      stepFlight(CONTENT, dt, idle, resumed);
      expect(resumed.shots).toHaveLength(count);
      expect(restored.save()).toBe(model.save());
      if (count === 16 && dt === 0.001) {
        expect(resumed.shots.slice(11)).toEqual(middle);
        expect(middle.every((shot) => shot.life === shot.fade?.initialLife)).toBe(true);
      }
    }
    expect(resumed.shots.slice(16)).toEqual(final);
    expect(final.every((shot) => shot.life === shot.fade?.initialLife)).toBe(true);
    expect(resumed.shots.every((shot) => shot.effectFamily === "pellet")).toBe(true);
    expect(resumed.pendingPellets).toBeUndefined();
    const invalid = JSON.parse(saved);
    invalid.flight.pendingPellets[0].delay = -1;
    expect(restoreSave(invalid)).toBeNull();
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
