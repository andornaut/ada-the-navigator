import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import {
  encounterQuiet,
  encounterTable,
  type EnemyArchetype,
  enemyCatalog,
  type EnemyDefinition,
  enemyDefinition,
  enemyStardust,
  escortTuning,
  galaxyEncounters,
  heavyLoadout,
} from "../data/enemyCatalog.ts";
import { byPosition, ROUTE_POSITION } from "../data/galaxies.ts";
import { SCREEN } from "../data/screen.ts";
import type { EnemyWeapon, GalaxyNumber, Weapon } from "../data/types.ts";
import { weaponAt } from "../data/weaponCatalog.ts";
import { fromScreen, outlineContact, outlinesContact, type Parts } from "./convex.ts";
import { carriesStardust } from "./drops.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyHull, enemyPartOutline } from "./enemyBody.ts";
import {
  activeBlastFlashes,
  activeEnemyBeams,
  activeRingEmissions,
  bounceShips,
  createFlight,
  ensureDestination,
  ensureRouteEncounter,
  placeDestinationAhead,
  rollEncounter,
  routeBlocked,
  salvage,
  salvageTarget,
  settleRouteEncounters,
  stepFlight,
  teleport,
} from "./flight.ts";
import { shipBody, shipCircleContact } from "./shipBody.ts";
import type { FlightInput, FlightState, GalaxyProgress, SpaceObject, Vec } from "./types.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const progress: GalaxyProgress = {
  charted: [],
  deposited: 0,
  destroyedEnemies: 0,
  discoveries: 0,
  donated: {},
  explored: [],
  greetings: {},
  holodisk: false,
  introduced: false,
  known: [],
  opened: false,
  questComplete: false,
  questItem: null,
  resolved: false,
  revealed: [],
  stage: 0,
  stations: [],
};
function empty(): FlightState {
  const flight = createFlight(CONTENT, 1, 173, progress);
  flight.objects = [];
  return flight;
}
function ship(
  archetype: EnemyArchetype,
  point: Vec,
  definition: EnemyDefinition = enemyCatalog[archetype],
  id = "target",
): SpaceObject {
  return {
    ...point,
    enemy: createEnemy(definition, { archetype, id, packId: null, phase: 0 }, point),
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
  };
}
/** The first ship id `target:n` whose heavy loadout in `galaxy` passes `accepts`. */
function loadoutId(
  archetype: "capital" | "frigate",
  galaxy: GalaxyNumber,
  accepts: (loadout: ReadonlyMap<string, EnemyWeapon>) => boolean,
): string {
  for (let index = 0; ; index++) {
    const id = `target:${index}`;
    if (accepts(heavyLoadout(archetype, ROUTE_POSITION[galaxy], id)!)) {
      return id;
    }
  }
}
/** A heavy whose loadout carries `weapon`, every hardpoint's fire held but that mount's. */
function armedWith(
  archetype: "capital" | "frigate",
  galaxy: GalaxyNumber,
  weapon: EnemyWeapon,
  point: Vec,
): { mount: string; target: SpaceObject } {
  const id = loadoutId(archetype, galaxy, (loadout) => [...loadout.values()].includes(weapon));
  const mount = [...heavyLoadout(archetype, ROUTE_POSITION[galaxy], id)!].find(
    ([, carried]) => carried === weapon,
  )![0];
  const target = ship(archetype, point, enemyDefinition(galaxy, archetype, id), id);
  return { mount, target: only(target, mount) };
}
/** A shared weapon's level 1 volley, one projectile kind per bolt, missile or dot. */
function volley(weapon: EnemyWeapon | undefined): string[] {
  const shared = weapon && weaponAt(weapon as Weapon, 1);
  return shared ? shared.anglesDegrees.map(() => shared.projectileKind) : [];
}
/** Holds every hardpoint's fire but `id`'s, which fires at once. */
function only(object: SpaceObject, id: string): SpaceObject {
  for (const part of object.enemy!.hardpoints) {
    part.cooldown = part.id === id ? 0 : 999;
  }
  return object;
}
/** An empty flight in `galaxy` with Ada at the origin. */
function emptyIn(galaxy: 2 | 6): FlightState {
  const flight = createFlight(CONTENT, galaxy, 173, progress);
  flight.objects = [];
  flight.player = { x: 0, y: 0 };
  return flight;
}
function hit(flight: FlightState, point: Vec, count = 1): void {
  for (let i = 0; i < count; i++) {
    flight.shots.push({
      ...point,
      damage: CONTENT.tuning.flight.playerShotDamage,
      enemy: false,
      hitIds: [],
      id: `test:${flight.nextId++}`,
      life: 1,
      piercing: false,
      projectile: "bolt",
      velocity: { x: 0, y: 0 },
    });
  }
}
/**
 * A point inside a hardpoint as drawn and clear of every other drawn hardpoint by a shot's
 * reach: the centre of one of its parts, largest first, on the world plane.
 */
function partPosition(object: SpaceObject, id: string): Vec {
  const enemy = object.enemy!;
  const area = (part: readonly Vec[]) =>
    Math.abs(
      part.reduce((sum, at, index) => {
        const next = part[(index + 1) % part.length]!;
        return sum + at.x * next.y - next.x * at.y;
      }, 0),
    );
  const centres = [...enemyPartOutline(1, enemy, id)!]
    .sort((a, b) => area(b) - area(a))
    .map((part) => {
      const centre = fromScreen({
        x: part.reduce((sum, at) => sum + at.x, 0) / part.length,
        y: part.reduce((sum, at) => sum + at.y, 0) / part.length,
      });
      return { x: object.x + centre.x, y: object.y + centre.y };
    });
  const others = enemy.hardpoints
    .filter((part) => part.id !== id)
    .map((part) => enemyPartOutline(1, enemy, part.id)!);
  return (
    centres.find((at) => others.every((outline) => !outlineContact(outline, object, at, 3))) ??
    centres[0]!
  );
}

describe("integrated combat", () => {
  it("fires bolts and missiles from independent capital hardpoints and preserves saved futures", () => {
    // Needle (position 3): a capital with missiles and no Scattershot, whose dots fall short of
    // Ada here; every mount fires its weapon's level 1 volley at once.
    const flight = createFlight(CONTENT, 4, 173, progress);
    flight.objects = [];
    const id = loadoutId("capital", 4, (loadout) => {
      const weapons = [...loadout.values()];
      return weapons.includes("rapidMissile") && !weapons.includes("scattershot");
    });
    const target = ship("capital", { x: 400, y: 0 }, enemyDefinition(4, "capital", id), id);
    flight.objects.push(target);
    stepFlight(CONTENT, 0.01, idle, flight);
    const kinds = flight.shots.map((shot) => shot.projectile);
    const expected = [...heavyLoadout("capital", 3, id)!.values()].flatMap(volley);
    expect(kinds.filter((kind) => kind === "bolt")).toHaveLength(
      expected.filter((kind) => kind === "bolt").length,
    );
    expect(kinds.filter((kind) => kind === "missile")).toHaveLength(
      expected.filter((kind) => kind === "missile").length,
    );
    const missile = flight.shots.find((shot) => shot.projectile === "missile")!;
    const velocity = { ...missile.velocity };
    const position = { x: missile.x, y: missile.y };
    flight.player.y = 200;
    const resumed = JSON.parse(JSON.stringify(flight)) as FlightState;
    stepFlight(CONTENT, 0.1, idle, flight);
    stepFlight(CONTENT, 0.1, idle, resumed);
    expect(resumed).toEqual(flight);
    expect(missile.velocity).toEqual(velocity);
    expect(missile.x).toBeCloseTo(position.x + velocity.x * 0.1);
    expect(missile.y).toBeCloseTo(position.y + velocity.y * 0.1);
  });

  it("lowers the hull on every hit, disables a heavy without weapons and destroys it at 0 hull", () => {
    // Sunflower's capital: a 40 HP hull and 4 HP hardpoints.
    const flight = empty();
    const target = ship("capital", { x: 400, y: 0 }, enemyDefinition(1, "capital", "target"));
    flight.objects.push(target);
    target.enemy!.velocity = { x: 20, y: 10 };
    // A moving hull faces its velocity.
    target.enemy!.facing = { x: 20 / Math.hypot(20, 10), y: 10 / Math.hypot(20, 10) };
    hit(flight, partPosition(target, "engine-left"), 4);
    hit(flight, partPosition(target, "weapon-left"), 4);
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(target.enemy!.hp).toBe(32);
    flight.shots = [];
    const before = { x: target.x, y: target.y };
    for (const part of target.enemy!.hardpoints) {
      part.cooldown = 0;
    }
    stepFlight(CONTENT, 0.01, idle, flight);
    // One working engine of two still drives the hull at half its top speed, and the other three
    // mounts still fire their loadout's volleys.
    expect({ x: target.x, y: target.y }).not.toEqual(before);
    const loadout = heavyLoadout("capital", 1, "target")!;
    const standing = ["weapon-right", "weapon-rear-left", "weapon-rear-right"].flatMap((mount) =>
      volley(loadout.get(mount)),
    );
    expect(flight.shots.map((shot) => shot.projectile).sort()).toEqual(standing.sort());
    flight.shots = [];
    // Destroying the last weapons disables it, once, with 20 hull left.
    for (const id of ["weapon-right", "weapon-rear-left", "weapon-rear-right"]) {
      hit(flight, partPosition(target, id), 4);
    }
    const disabling = stepFlight(CONTENT, 0.01, idle, flight);
    expect(disabling).toContainEqual({ id: "target", type: "enemyDisabled" });
    expect(disabling).not.toContainEqual({ type: "enemyDestroyed" });
    expect(target.enemy).toMatchObject({ disabled: true, hp: 20 });
    expect(flight.objects).toContain(target);
    // It holds fire and coasts to rest on its other engine.
    flight.shots = [];
    target.enemy!.hardpoints.forEach((part) => (part.cooldown = 0));
    const coasting = Math.hypot(target.enemy!.velocity.x, target.enemy!.velocity.y);
    expect(coasting).toBeGreaterThan(0);
    const later = stepFlight(CONTENT, 20, idle, flight);
    expect(later.some((event) => event.type === "enemyDisabled")).toBe(false);
    expect(flight.shots.filter((shot) => shot.enemy)).toEqual([]);
    expect(Math.hypot(target.enemy!.velocity.x, target.enemy!.velocity.y)).toBeLessThan(0.01);
    // Hits on the destroyed command part's place go to the hull until it breaks.
    hit(flight, partPosition(target, "command"), 20);
    expect(stepFlight(CONTENT, 0.01, idle, flight)).toContainEqual({ type: "enemyDestroyed" });
    expect(flight.objects).not.toContain(target);
    expect(stepFlight(CONTENT, 0.01, idle, flight)).not.toContainEqual({
      type: "enemyDestroyed",
    });
  });

  it("salvages a disabled heavy within Talk range for its Stardust and spares it", () => {
    // Sunflower's frigate: a 20 HP hull.
    const flight = empty();
    const target = ship("frigate", { x: 120, y: 0 }, enemyDefinition(1, "frigate"));
    flight.objects.push(target);
    expect(salvageTarget(CONTENT, flight)).toBeUndefined();
    target.enemy!.disabled = true;
    expect(salvageTarget(CONTENT, flight)).toBe(target);
    flight.player = { x: 120 - CONTENT.tuning.safeRadius - 1, y: 0 };
    expect(salvageTarget(CONTENT, flight)).toBeUndefined();
    expect(salvage(CONTENT, flight)).toBe(false);
    flight.player = { x: 0, y: 0 };
    expect(salvage(CONTENT, flight)).toBe(true);
    expect(target.enemy!.salvaged).toBe(true);
    const stardust = flight.objects
      .filter(carriesStardust)
      .reduce((sum, object) => sum + object.amount!, 0);
    expect(stardust).toBe(enemyStardust(1, "frigate"));
    expect(salvageTarget(CONTENT, flight)).toBeUndefined();
    expect(salvage(CONTENT, flight)).toBe(false);
    // Shots and Ada pass through the spared ship, which neither moves nor fires.
    flight.objects = flight.objects.filter((object) => object === target);
    target.enemy!.hardpoints.forEach((part) => (part.cooldown = 0));
    hit(flight, { x: target.x, y: target.y }, 3);
    flight.player = { x: target.x, y: target.y };
    stepFlight(CONTENT, 0.1, idle, flight);
    expect(target.enemy!.hp).toBe(20);
    expect(flight.player).toEqual({ x: target.x, y: target.y });
    expect(flight.shots.filter((shot) => shot.enemy)).toEqual([]);
    expect(flight.objects).toContain(target);
  });

  it("unblocks a route once its guard is disabled, salvaged or not", () => {
    const flight = empty();
    ensureDestination(CONTENT, "quest", flight);
    const guard = ensureRouteEncounter(CONTENT, "quest", flight)!;
    expect(routeBlocked("quest", flight)).toBe(true);
    guard.enemy!.disabled = true;
    expect(routeBlocked("quest", flight)).toBe(false);
    guard.enemy!.salvaged = true;
    expect(routeBlocked("quest", flight)).toBe(false);
  });

  it("stops a nonpiercing shot at a heavy's hull, lowering only the hull", () => {
    const flight = empty();
    const target = ship("capital", { x: 400, y: 0 });
    target.enemy!.hardpoints.forEach((part) => (part.cooldown = 999));
    flight.objects.push(target);
    flight.shots.push({
      damage: CONTENT.tuning.flight.playerShotDamage,
      enemy: false,
      hitIds: [],
      id: "travel",
      life: 5,
      piercing: false,
      // Down the hull's centreline, clear of the turrets and engines either side.
      velocity: { x: 0, y: 300 },
      x: 400,
      y: -150,
    });
    stepFlight(CONTENT, 0.7, idle, flight);
    expect(target.enemy!.hp).toBe(enemyCatalog.capital.hp - 1);
    expect(target.enemy!.hardpoints.map((part) => part.hp)).toEqual(
      enemyCatalog.capital.hardpoints.map((part) => part.hp),
    );
    expect(flight.shots.some((shot) => shot.id === "travel")).toBe(false);
  });

  it("blocks hostile movement and line of fire at scenery instead of walking through it", () => {
    const flight = empty();
    const target = ship("fighter", { x: 300, y: 0 });
    target.enemy!.engaged = true;
    target.enemy!.velocity = { x: -100, y: 0 };
    flight.objects.push(target, { hp: 99, id: "wall", kind: "rock", radius: 40, x: 240, y: 0 });
    stepFlight(CONTENT, 1, idle, flight);
    expect(target.x).toBeGreaterThanOrEqual(290);
    expect(flight.shots).toHaveLength(0);
    flight.shots.push({
      damage: 1,
      enemy: true,
      hitIds: [],
      id: "incoming",
      life: 5,
      piercing: false,
      velocity: { x: -500, y: 0 },
      x: 300,
      y: 0,
    });
    stepFlight(CONTENT, 0.8, idle, flight);
    expect(flight.shield).toBe(CONTENT.tuning.shieldMax);
    expect(flight.shots.some((shot) => shot.id === "incoming")).toBe(false);
  });

  it("bursts an enemy missile on scenery and damages Ada within its blast, once on a direct hit", () => {
    const flight = empty();
    // The rock's face is 50 from Ada, inside a 60 blast.
    flight.objects.push({ hp: 99, id: "wall", kind: "rock", radius: 10, x: 40, y: 0 });
    const missile = (id: string, blast: number, y: number) => ({
      blast,
      damage: 3,
      enemy: true,
      hitIds: [],
      id,
      life: 5,
      piercing: false,
      projectile: "missile" as const,
      velocity: { x: -150, y: 0 },
      x: 200,
      y,
    });
    flight.shots.push(missile("heavy", 60, 0));
    stepFlight(CONTENT, 1.5, idle, flight);
    expect(flight.shots).toEqual([]);
    expect(flight.shield).toBe(CONTENT.tuning.shieldMax - 3);
    // A small blast at the same rock falls short of Ada.
    flight.shots.push(missile("rapid", 4, 0));
    stepFlight(CONTENT, 1.5, idle, flight);
    expect(flight.shield).toBe(CONTENT.tuning.shieldMax - 3);
    // Past the rock, a missile striking Ada deals its damage once, blast included.
    flight.shots.push(missile("direct", 60, -40));
    flight.player = { x: 0, y: -40 };
    stepFlight(CONTENT, 1.5, idle, flight);
    expect(flight.shots).toEqual([]);
    expect(flight.shield).toBe(CONTENT.tuning.shieldMax - 6);
  });

  it("explodes Ada's missile at the end of its reach, its blast striking an enemy beside it", () => {
    const flight = empty();
    const target = ship("interceptor", { x: 300, y: 50 });
    flight.objects.push(target);
    const hp = target.hp;
    // From 200 at 200 a second for 0.5 s: it ends at 300 without touching the interceptor.
    flight.shots.push({
      blast: 60,
      damage: 2,
      enemy: false,
      hitIds: [],
      id: "rapid",
      life: 0.5,
      piercing: false,
      projectile: "missile",
      velocity: { x: 200, y: 0 },
      x: 200,
      y: 0,
    });
    stepFlight(CONTENT, 0.6, idle, flight);
    expect(flight.shots).toEqual([]);
    expect(target.hp).toBe(hp - 2);
    expect(activeBlastFlashes(flight)).toEqual([
      expect.objectContaining({ radius: 60, x: expect.closeTo(300, 6), y: 0 }),
    ]);
    expect(flight.shield).toBe(CONTENT.tuning.shieldMax);
  });

  it("explodes an enemy missile at the end of its reach, its blast damaging Ada", () => {
    const flight = empty();
    // From 200 toward Ada at 100 a second for 1.5 s: it ends 50 from her, inside a 60 blast.
    flight.shots.push({
      blast: 60,
      damage: 3,
      enemy: true,
      hitIds: [],
      id: "heavy",
      life: 1.5,
      piercing: false,
      projectile: "missile",
      velocity: { x: -100, y: 0 },
      x: 200,
      y: 0,
    });
    stepFlight(CONTENT, 1.6, idle, flight);
    expect(flight.shots).toEqual([]);
    expect(flight.shield).toBe(CONTENT.tuning.shieldMax - 3);
    expect(activeBlastFlashes(flight)).toEqual([
      expect.objectContaining({ radius: 60, x: expect.closeTo(50, 6), y: 0 }),
    ]);
  });

  it("lets a bolt at the end of its reach vanish with no blast", () => {
    const flight = empty();
    flight.shots.push({
      damage: 1,
      enemy: false,
      hitIds: [],
      id: "bolt",
      life: 0.5,
      piercing: false,
      projectile: "bolt",
      velocity: { x: 200, y: 0 },
      x: 200,
      y: 0,
    });
    stepFlight(CONTENT, 0.6, idle, flight);
    expect(flight.shots).toEqual([]);
    expect(activeBlastFlashes(flight)).toEqual([]);
  });

  it("fires an enemy Phaser along its fixed aim line 0.4 s after it appears", () => {
    // Phantom (position 6): a capital whose loadout carries the Phaser, 6.5 damage.
    const fixture = () => {
      const flight = createFlight(CONTENT, 6, 173, progress);
      flight.objects = [];
      flight.player = { x: 0, y: 0 };
      const { target } = armedWith("capital", 6, "phaser", { x: 220, y: 0 });
      flight.objects.push(target);
      stepFlight(CONTENT, 1 / 60, idle, flight);
      return flight;
    };
    const flight = fixture();
    const [beam] = activeEnemyBeams(flight);
    expect(beam).toMatchObject({ fired: false, stopped: false });
    expect(flight.shots).toEqual([]);
    const shield = flight.shield;
    stepFlight(CONTENT, 0.3, idle, flight);
    expect(beam!.fired).toBe(false);
    expect(flight.shield).toBe(shield);
    stepFlight(CONTENT, 0.15, idle, flight);
    expect(beam).toMatchObject({ fired: true, stopped: true });
    expect(flight.shield).toBeCloseTo(shield - 6.5, 9);
    // The beam shows for its flash and spark, then goes.
    stepFlight(CONTENT, 0.2, idle, flight);
    expect(activeEnemyBeams(flight)).not.toContain(beam);
    // Ada moving off the line before it fires takes no damage.
    const dodged = fixture();
    dodged.player = { x: 0, y: 120 };
    stepFlight(CONTENT, 0.45, idle, dodged);
    expect(activeEnemyBeams(dodged)[0]).toMatchObject({ fired: true, stopped: false });
    expect(dodged.shield).toBe(CONTENT.tuning.shieldMax);
  });

  it("stops an enemy Phaser's aim line and beam at the first obstacle", () => {
    const flight = createFlight(CONTENT, 6, 173, progress);
    flight.objects = [];
    flight.player = { x: 0, y: 0 };
    const { target } = armedWith("capital", 6, "phaser", { x: 220, y: 0 });
    flight.objects.push(target);
    stepFlight(CONTENT, 1 / 60, idle, flight);
    // A rock rolls between them after the line appears: the line and beam stop at it.
    flight.objects.push({ hp: 99, id: "wall", kind: "rock", radius: 25, x: 80, y: 0 });
    stepFlight(CONTENT, 0.45, idle, flight);
    const [beam] = activeEnemyBeams(flight);
    expect(beam).toMatchObject({ fired: true, stopped: true });
    expect(beam!.end.x).toBeGreaterThan(80);
    expect(flight.shield).toBe(CONTENT.tuning.shieldMax);
  });

  it("fires a ring burst's eight bolts outward from the hull's edge, evenly around it", () => {
    // Phantom (position 6): a capital whose loadout carries the ring burst, 1.5 damage a bolt.
    const flight = emptyIn(6);
    const { target } = armedWith("capital", 6, "ringBurst", { x: 220, y: 0 });
    flight.objects.push(target);
    stepFlight(CONTENT, 1 / 60, idle, flight);
    const bolts = flight.shots.filter((shot) => shot.enemyWeapon === "ringBurst");
    expect(bolts).toHaveLength(8);
    for (const [index, bolt] of bolts.entries()) {
      expect(bolt).toMatchObject({ damage: 1.5, enemy: true, projectile: "bolt" });
      const speed = Math.hypot(bolt.velocity.x, bolt.velocity.y);
      expect(speed).toBeCloseTo(240, 9);
      const turn = Math.atan2(bolt.velocity.y, bolt.velocity.x);
      expect(Math.cos(turn - (index * Math.PI) / 4)).toBeCloseTo(1, 9);
    }
    const [ring] = activeRingEmissions(flight);
    expect(ring!.origins).toHaveLength(8);
    expect(ring!.spawnRadius).toBe(target.radius);
    for (const origin of ring!.origins) {
      expect(Math.hypot(origin.x - ring!.at.x, origin.y - ring!.at.y)).toBeCloseTo(
        target.radius,
        9,
      );
    }
    // The emission shows for 180 ms, then goes.
    flight.objects = [];
    stepFlight(CONTENT, 0.2, idle, flight);
    expect(activeRingEmissions(flight)).toEqual([]);
  });

  it("lays at most four mines, each bursting on Ada for 3 or fading after 20 seconds", () => {
    const flight = emptyIn(6);
    const { mount, target } = armedWith("capital", 6, "mineLayer", { x: 220, y: 0 });
    flight.objects.push(target);
    for (let volley = 0; volley < 6; volley++) {
      target.enemy!.hardpoints.find((part) => part.id === mount)!.cooldown = 0;
      stepFlight(CONTENT, 1 / 60, idle, flight);
    }
    expect(flight.mines).toHaveLength(4);
    expect(new Set(flight.mines.map((mine) => mine.ownerId))).toEqual(new Set([target.id]));
    // One on Ada pops for its damage; one at the end of its life fizzles harmlessly.
    flight.objects = [];
    flight.mines = [
      { age: 1, damage: 3, id: "on-ada", ownerId: "layer", x: 0, y: 0 },
      { age: 19.99, damage: 3, id: "old", ownerId: "layer", x: 300, y: 300 },
    ];
    const shield = flight.shield;
    stepFlight(CONTENT, 0.05, idle, flight);
    expect(flight.shield).toBe(shield - 3);
    expect(flight.mines.map((mine) => [mine.id, mine.end?.kind])).toEqual([
      ["on-ada", "pop"],
      ["old", "fizzle"],
    ]);
    stepFlight(CONTENT, 0.25, idle, flight);
    expect(flight.mines).toEqual([]);
    expect(flight.shield).toBe(shield - 3);
  });

  it("pops a mine that Ada's shot touches and spends the shot", () => {
    const flight = empty();
    flight.mines = [{ age: 1, damage: 3, id: "ahead", ownerId: "layer", x: 100, y: 0 }];
    hit(flight, { x: 100, y: 0 });
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(flight.mines[0]!.end?.kind).toBe("pop");
    expect(flight.shots).toEqual([]);
  });

  it("tracks Ada with a frigate's charged lance, holds still, then fires across the game area", () => {
    // Cartwheel (position 5): a frigate whose loadout carries the lance, 3 damage.
    const fixture = () => {
      const flight = emptyIn(2);
      const { target } = armedWith("frigate", 2, "chargedLance", { x: 200, y: 0 });
      flight.objects.push(target);
      stepFlight(CONTENT, 1 / 60, idle, flight);
      return { flight, target };
    };
    const { flight } = fixture();
    const [tell] = activeEnemyBeams(flight);
    expect(tell).toMatchObject({ fired: false, kind: "lance" });
    // It aims at Ada each step while it tracks, then holds its line.
    flight.player = { x: 0, y: 60 };
    stepFlight(CONTENT, 0.3, idle, flight);
    const toward = { x: flight.player.x - tell!.muzzle.x, y: flight.player.y - tell!.muzzle.y };
    const span = Math.hypot(toward.x, toward.y);
    expect(tell!.direction.x).toBeCloseTo(toward.x / span, 6);
    expect(tell!.direction.y).toBeCloseTo(toward.y / span, 6);
    stepFlight(CONTENT, 0.45, idle, flight);
    const locked = { ...tell!.direction };
    stepFlight(CONTENT, 0.1, idle, flight);
    expect(tell!.direction).toEqual(locked);
    const shield = flight.shield;
    stepFlight(CONTENT, 0.2, idle, flight);
    expect(tell).toMatchObject({ fired: true, stopped: true });
    expect(flight.shield).toBeCloseTo(shield - 3, 9);
    // Ada leaving the locked line takes nothing; the beam runs the game area's width on screen.
    const dodged = fixture().flight;
    const [missed] = activeEnemyBeams(dodged);
    stepFlight(CONTENT, 0.8, idle, dodged);
    dodged.player = { x: 0, y: -150 };
    stepFlight(CONTENT, 0.25, idle, dodged);
    expect(missed).toMatchObject({ fired: true, stopped: false });
    expect(dodged.shield).toBe(CONTENT.tuning.shieldMax);
    const along = { x: missed!.end.x - missed!.muzzle.x, y: missed!.end.y - missed!.muzzle.y };
    expect(Math.hypot(along.x - along.y, (along.x + along.y) / 2)).toBeCloseTo(SCREEN.width, 6);
  });

  it("puts out a charged lance whose frigate is disabled before it fires", () => {
    const flight = emptyIn(2);
    const { target } = armedWith("frigate", 2, "chargedLance", { x: 200, y: 0 });
    flight.objects.push(target);
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(activeEnemyBeams(flight)).toHaveLength(1);
    target.enemy!.disabled = true;
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(activeEnemyBeams(flight)).toEqual([]);
  });

  it("keeps ballistic debris velocity constant, damages on crossing, and absorbs it at safe regions", () => {
    const flight = empty();
    const debris: SpaceObject = {
      hp: 5,
      id: "moving",
      kind: "debris",
      radius: 20,
      velocity: { x: -100, y: 0 },
      x: 60,
      y: 0,
    };
    flight.objects.push(debris);
    stepFlight(CONTENT, 0.5, idle, flight);
    expect(debris.x).toBeCloseTo(10);
    expect(debris.velocity).toEqual({ x: -100, y: 0 });
    expect(flight.shield).toBeLessThan(CONTENT.tuning.shieldMax);
    const destination = ensureDestination(CONTENT, "friendly", flight);
    destination.x = -200;
    destination.y = 0;
    flight.dangerFor = 0;
    expect(teleport(CONTENT, destination.id, flight)).toBe(true);
    const shield = flight.shield;
    stepFlight(CONTENT, 1, idle, flight);
    expect(flight.objects.some((object) => object.id === "moving")).toBe(false);
    expect(flight.shield).toBeGreaterThanOrEqual(shield);
  });

  it.each([1, 2, 3] as const)(
    "opens a galaxy %i route once its guard is disabled, though its hull still stands",
    (galaxy) => {
      const flight = empty();
      flight.galaxy = galaxy;
      const destination = ensureDestination(CONTENT, "quest", flight);
      const guard = ensureRouteEncounter(CONTENT, "quest", flight)!;
      // Its weapons go: every weapon hardpoint destroyed disables it.
      const weapons = enemyCatalog[guard.enemy!.archetype].hardpoints.filter(
        ({ kind }) => kind === "weapon",
      );
      expect(weapons.length).toBeGreaterThan(0);
      for (const hardpoint of guard.enemy!.hardpoints) {
        if (weapons.some(({ id }) => id === hardpoint.id)) {
          hardpoint.hp = 0;
        }
      }
      guard.enemy!.disabled = true;
      expect(guard.hp).toBeGreaterThan(0);
      expect(routeBlocked("quest", flight)).toBe(false);
      flight.player = { x: destination.x, y: destination.y };
      expect(stepFlight(CONTENT, 0.01, idle, flight)).toContainEqual({
        id: "quest",
        type: "discovered",
      });
    },
  );

  it.each([1, 2, 3] as const)(
    "guards a galaxy %i route outside the safezone without respawn after defeat",
    (galaxy) => {
      const flight = empty();
      flight.galaxy = galaxy;
      expect(routeBlocked("quest", flight)).toBe(false);
      const destination = ensureDestination(CONTENT, "quest", flight);
      const guard = ensureRouteEncounter(CONTENT, "quest", flight)!;
      const archetype = galaxy === 1 ? "frigate" : "capital";
      expect(guard.enemy?.archetype).toBe(archetype);
      expect(
        Math.hypot(guard.x - destination.x, guard.y - destination.y) - guard.radius,
      ).toBeGreaterThan(CONTENT.tuning.safeRadius);
      expect(ensureRouteEncounter(CONTENT, "quest", flight)).toBe(guard);
      flight.player = { x: destination.x, y: destination.y };
      expect(stepFlight(CONTENT, 0.01, idle, flight)).not.toContainEqual({
        id: "quest",
        type: "discovered",
      });
      flight.objects = flight.objects.filter((object) => object !== guard);
      expect(routeBlocked("quest", flight)).toBe(false);
      expect(ensureRouteEncounter(CONTENT, "quest", flight)).toBeNull();
      expect(stepFlight(CONTENT, 0.01, idle, flight)).toContainEqual({
        id: "quest",
        type: "discovered",
      });
      expect(flight.shield).toBe(CONTENT.tuning.shieldMax);
    },
  );

  it("upgrades legacy enemy state lazily without resetting saved damage or blocking unspawned routes", () => {
    const flight = empty();
    delete flight.combat;
    flight.objects.push({
      behavior: "shoot",
      hp: 2,
      id: "legacy",
      kind: "enemy",
      radius: 10,
      x: 300,
      y: 0,
    });
    stepFlight(CONTENT, 0.01, idle, flight);
    expect(flight.objects[0]?.enemy?.hp).toBe(2);
    expect(flight.objects[0]?.enemy?.id).toBe("legacy");
    expect(routeBlocked("old-destination", flight)).toBe(false);
    expect(flight.shots.some((shot) => shot.enemy)).toBe(true);
  });

  it("generates deterministic small packs, separated encounter cells, terrain and ballistic regions", () => {
    const flight = empty();
    // Generate distinct distant near-fields without advancing combat or encounter time.
    for (let i = 1; i <= 12; i++) {
      flight.player = { x: i * 4096, y: 0 };
      ensureDestination(CONTENT, `scan:${i}`, flight);
    }
    const packs = flight.combat?.initialPackSizes ?? {};
    expect(Object.keys(packs).length).toBeGreaterThan(2);
    // Galaxy one's largest group is a swarm pack of 4 to 6 with the position's +1 bonus.
    expect(Object.values(packs).every((size) => size >= 1 && size <= 7)).toBe(true);
    expect(
      flight.objects.some(
        (object) => object.id.startsWith("chunk:") && ["rock", "resource"].includes(object.kind),
      ),
    ).toBe(true);
    expect(
      flight.objects.some((object) => object.id.startsWith("ballistic:") && object.velocity),
    ).toBe(true);
    expect(flight.objects.some((object) => object.role === "discovery")).toBe(true);
    // A capital battle's escorts share their capital's encounter cell.
    const cells = new Set(Object.keys(packs).map((id) => id.split(":")[1]!));
    const origins = [...cells].map((cell) => cell.split(",").map(Number));
    for (let i = 0; i < origins.length; i++) {
      for (let j = i + 1; j < origins.length; j++) {
        const first = origins[i]!;
        const second = origins[j]!;
        expect(
          Math.hypot(first[0]! - second[0]!, first[1]! - second[1]!) * CONTENT.tuning.chunkSize,
        ).toBeGreaterThanOrEqual(encounterQuiet(1).distance);
      }
    }
    const replay = empty();
    for (let i = 1; i <= 12; i++) {
      replay.player = { x: i * 4096, y: 0 };
      ensureDestination(CONTENT, `scan:${i}`, replay);
    }
    expect(replay).toEqual(flight);
  });
});

describe("rotating hulls", () => {
  it("hits hardpoints where the rotated hull draws them", () => {
    const flight = empty();
    const target = ship("capital", { x: 400, y: 0 });
    target.enemy!.hardpoints.forEach((part) => (part.cooldown = 999));
    flight.objects.push(target);
    const hp = (id: string) => target.enemy!.hardpoints.find((part) => part.id === id)!.hp;
    target.enemy!.facing = { x: 1, y: 0 };
    const east = partPosition(target, "weapon-rear-right");
    target.enemy!.facing = { x: 0, y: 1 };
    const south = partPosition(target, "weapon-rear-right");
    expect(Math.hypot(east.x - south.x, east.y - south.y)).toBeGreaterThan(20);
    // Facing south, the part is no longer drawn where it was facing east.
    hit(flight, east);
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(hp("weapon-rear-right")).toBe(3);
    hit(flight, south);
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(hp("weapon-rear-right")).toBe(2);
  });
});

describe("galaxy encounters", () => {
  it("generates a capital battle as a capital pack and a four-fighter escort pack on station", () => {
    const flight = empty();
    flight.galaxy = 5;
    let leader: SpaceObject | undefined;
    for (let index = 1; index <= 400 && !leader; index++) {
      flight.player = { x: index * 4096, y: (index % 7) * 4096 };
      stepFlight(CONTENT, 0.001, idle, flight);
      leader = flight.objects.find(
        (object) =>
          object.enemy?.archetype === "capital" && object.enemy.packId?.startsWith("pack:"),
      );
    }
    expect(leader).toBeDefined();
    const packId = leader!.enemy!.packId!;
    expect(leader!.id).toBe(`${packId}:0`);
    expect(leader!.radius).toBe(50);
    const escorts = flight.objects.filter((object) => object.enemy?.packId === `${packId}:escorts`);
    expect(escorts).toHaveLength(4);
    expect(flight.combat!.initialPackSizes).toMatchObject({
      [packId]: 1,
      [`${packId}:escorts`]: 4,
    });
    for (const escort of escorts) {
      expect(escort.enemy).toMatchObject({ archetype: "fighter", escortOf: leader!.id });
      expect(Math.hypot(escort.x - leader!.x, escort.y - leader!.y)).toBeCloseTo(
        leader!.radius + escortTuning.stationGap,
        0,
      );
    }
  });

  it.each([
    // Perception 650 times the route position's notice: 780, 975 and 845.
    [1, 770, true],
    [1, 790, false],
    [2, 970, true],
    [2, 980, false],
    [3, 840, true],
    [3, 850, false],
  ] as const)("in galaxy %i, notices Ada %i units away: %s", (galaxy, away, engaged) => {
    const flight = empty();
    flight.galaxy = galaxy;
    const fighter = ship("fighter", { x: flight.player.x + away, y: flight.player.y });
    flight.objects.push(fighter);
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(fighter.enemy!.engaged).toBe(engaged);
  });

  it("sizes saved hit circles from the catalog", () => {
    const flight = empty();
    const capital = ship("capital", { x: flight.player.x + 900, y: flight.player.y });
    capital.radius = 100;
    flight.objects.push(capital);
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(capital.radius).toBe(enemyCatalog.capital.sizeRatio * CONTENT.tuning.flight.shipRadius);
  });
});

describe("galaxy encounter tables", () => {
  function rolls(seed: number): () => number {
    let n = seed;
    return () => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      return n / 4294967296;
    };
  }

  it("weights galaxy one's roster and draws each group from its own range", () => {
    const next = rolls(20261111);
    const total = 40000;
    const seen = new Map<EnemyArchetype, number[]>();
    const escorts = new Set<string>();
    for (let i = 0; i < total; i++) {
      const count = next();
      const roll = rollEncounter(galaxyEncounters[1]!, count, next());
      seen.set(roll.archetype, [...(seen.get(roll.archetype) ?? []), roll.count]);
      if (roll.escorts) {
        escorts.add(`${roll.archetype}:${roll.escorts.archetype}:${roll.escorts.count}`);
      }
    }
    expect([...seen.keys()].sort()).toEqual([
      "capital",
      "fighter",
      "frigate",
      "interceptor",
      "retaliator",
      "swarm",
    ]);
    const share = (archetype: EnemyArchetype) => (seen.get(archetype)?.length ?? 0) / total;
    for (const [archetype, weight] of [
      ["swarm", 0.35],
      ["fighter", 0.3],
      ["interceptor", 0.15],
      ["retaliator", 0.1],
      ["frigate", 0.07],
      ["capital", 0.03],
    ] as const) {
      expect(Math.abs(share(archetype) - weight)).toBeLessThan(0.01);
    }
    const sizes = (archetype: EnemyArchetype) => seen.get(archetype) ?? [];
    const fraction = (archetype: EnemyArchetype, size: number) =>
      sizes(archetype).filter((value) => value === size).length / sizes(archetype).length;
    // Swarms are packs of four to six.
    expect(new Set(sizes("swarm"))).toEqual(new Set([4, 5, 6]));
    for (const size of [4, 5, 6]) {
      expect(Math.abs(fraction("swarm", size) - 1 / 3)).toBeLessThan(0.03);
    }
    // Fighters fly solo, as a pair or as a three.
    expect(new Set(sizes("fighter"))).toEqual(new Set([1, 2, 3]));
    for (const size of [1, 2, 3]) {
      expect(Math.abs(fraction("fighter", size) - 1 / 3)).toBeLessThan(0.03);
    }
    // Interceptors, retaliators and frigates are solo; a capital brings four escort fighters.
    for (const archetype of ["interceptor", "retaliator", "frigate", "capital"] as const) {
      expect(new Set(sizes(archetype))).toEqual(new Set([1]));
    }
    expect([...escorts]).toEqual(["capital:fighter:4"]);
  });

  it.each([
    [
      2,
      {
        capital: [1, 1, 0.03],
        fighter: [2, 4, 0.4],
        frigate: [1, 1, 0.1],
        interceptor: [1, 2, 0.12],
        retaliator: [1, 1, 0.1],
        swarm: [5, 7, 0.25],
      },
    ],
    [
      3,
      {
        capital: [1, 1, 0.05],
        fighter: [3, 4, 0.3],
        frigate: [1, 1, 0.15],
        interceptor: [1, 2, 0.15],
        retaliator: [1, 1, 0.1],
        swarm: [5, 8, 0.25],
      },
    ],
  ] as const)("rolls galaxy %i's roster groups and weights", (galaxy, roster) => {
    const encounters = byPosition(galaxyEncounters, galaxy);
    const table = Object.fromEntries(
      encounters.map((entry) => [entry.archetype, [...entry.groupSize, entry.weight]]),
    );
    expect(table).toEqual(roster);
    expect(encounters.find((entry) => entry.escorts)?.escorts).toEqual({
      archetype: "fighter",
      count: 4,
    });
    // Every roll lands in the chosen archetype's group range.
    const next = rolls(galaxy * 7919);
    for (let i = 0; i < 2000; i++) {
      const { archetype, count } = rollEncounter(encounters, next(), next());
      const [low, high] = roster[archetype as keyof typeof roster];
      expect(count).toBeGreaterThanOrEqual(low);
      expect(count).toBeLessThanOrEqual(high);
    }
  });

  it("generates only galaxy one's roster and group sizes in galaxy one", () => {
    const flight = empty();
    const packs = new Map<string, Set<EnemyArchetype>>();
    for (let i = 1; i <= 30; i++) {
      flight.player = { x: i * 4096, y: (i % 3) * 4096 };
      ensureDestination(CONTENT, `scan:${i}`, flight);
      for (const object of flight.objects) {
        if (object.enemy?.packId?.startsWith("pack:")) {
          const members = packs.get(object.enemy.packId) ?? new Set();
          members.add(object.enemy.archetype);
          packs.set(object.enemy.packId, members);
        }
      }
    }
    const ranges = new Map(encounterTable(1).map((entry) => [entry.archetype, entry.groupSize]));
    expect(packs.size).toBeGreaterThan(3);
    for (const [id, archetypes] of packs) {
      expect(archetypes.size).toBe(1);
      // A capital battle's escorts form their own pack of up to four fighters.
      const range = id.endsWith(":escorts") ? [1, 4] : ranges.get([...archetypes][0]!)!;
      expect(range).toBeDefined();
      const size = flight.combat!.initialPackSizes[id]!;
      expect(size).toBeGreaterThanOrEqual(1);
      expect(size).toBeLessThanOrEqual(range[1]!);
    }
  });
});

function pack(flight: FlightState, points: Vec[]): SpaceObject[] {
  const members = points.map((point, index) => {
    const object = ship("swarm", point);
    object.id = `roster:${index}`;
    object.enemy!.id = object.id;
    object.enemy!.packId = "roster";
    return object;
  });
  flight.combat = { initialPackSizes: { roster: members.length }, routeEncounters: [] };
  flight.objects.push(...members);
  return members;
}

describe("combat admission and subframe firing", () => {
  it("records only admitted pack members when a safezone excludes part of a seeded group", () => {
    // The fixture uses an encounter at the flight start, which launches otherwise keep clear.
    const content = structuredClone(CONTENT);
    content.tuning.flight.arrivalCalm = 0;
    let template: FlightState | undefined;
    let members: SpaceObject[] = [];
    for (let seed = 0; seed < 64; seed++) {
      const candidate = createFlight(content, 1, seed, progress);
      const group = candidate.objects.filter((object) => object.enemy?.archetype === "swarm");
      if (group.length === 2) {
        template = candidate;
        members = group;
        break;
      }
    }
    expect(template).toBeDefined();
    const flight = template!;
    const packId = members[0]!.enemy!.packId!;
    const last = members.at(-1)!;
    flight.chunks = [];
    flight.combat = { initialPackSizes: {}, routeEncounters: [] };
    flight.objects = [
      {
        hp: 1,
        id: "safe",
        kind: "destination",
        radius: 30,
        x: last.x + content.tuning.safeRadius * 0.75,
        y: last.y,
      },
    ];
    stepFlight(content, 0.001, idle, flight);
    const admitted = flight.objects.filter((object) => object.enemy?.packId === packId);
    expect(admitted.length).toBeGreaterThan(0);
    expect(admitted.length).toBeLessThan(members.length);
    expect(flight.combat!.initialPackSizes[packId]).toBe(admitted.length);
    expect(admitted.every((object) => !object.enemy!.fleeing)).toBe(true);
  });

  it.each(["destination", "guard"] as const)(
    "keeps %s clearance separate from a later combat casualty",
    (clearance) => {
      const flight = empty();
      const points =
        clearance === "destination"
          ? [
              { x: 0, y: -1024 },
              { x: 50, y: -1024 },
              { x: 400, y: -1024 },
              { x: 450, y: -1024 },
            ]
          : [
              { x: 690, y: 0 },
              { x: 700, y: 0 },
              { x: 1100, y: 0 },
              { x: 1150, y: 0 },
            ];
      const members = pack(flight, points);
      if (clearance === "destination") {
        ensureDestination(CONTENT, "clearance", flight);
      } else {
        flight.objects.push({
          hp: 1,
          id: "clearance",
          kind: "destination",
          radius: 30,
          x: 1000,
          y: 0,
        });
        ensureRouteEncounter(CONTENT, "clearance", flight);
      }
      expect(flight.combat!.initialPackSizes.roster).toBe(4);
      expect(flight.combat!.unloadedPackMembers?.roster).toBe(2);
      expect(flight.objects).not.toContain(members[0]);
      expect(flight.objects).not.toContain(members[1]);
      stepFlight(CONTENT, 0.001, idle, flight);
      expect(members[2]!.enemy!.fleeing).toBe(false);
      expect(members[3]!.enemy!.fleeing).toBe(false);
      hit(flight, members[2]!, 2);
      expect(stepFlight(CONTENT, 0.001, idle, flight)).toContainEqual({ type: "enemyDestroyed" });
      expect(flight.combat!.initialPackSizes.roster).toBe(4);
      expect(flight.combat!.unloadedPackMembers?.roster).toBe(2);
      stepFlight(CONTENT, 0.001, idle, flight);
      expect(members[3]!.enemy!.fleeing).toBe(false);
    },
  );

  it("does not erase an already recorded casualty when destination clearance removes its dead object", () => {
    const flight = empty();
    const members = pack(flight, [
      { x: 0, y: -1024 },
      { x: 400, y: -1024 },
    ]);
    members[0]!.hp = 0;
    members[0]!.enemy!.hp = 0;
    ensureDestination(CONTENT, "clearance", flight);
    expect(flight.combat!.initialPackSizes.roster).toBe(2);
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(members[1]!.enemy!.fleeing).toBe(true);
  });

  it("ages and moves a new shot only after its fire delay, then gives it a full subsequent slice", () => {
    const flight = empty();
    const target = ship("fighter", { x: 300, y: 0 });
    target.enemy!.primaryCooldown = 0.012;
    flight.objects.push(target);
    const dt = 1 / 60;
    stepFlight(CONTENT, dt, idle, flight);
    const shot = flight.shots.find((shot) => shot.enemy)!;
    const elapsed = dt - 0.012;
    expect(shot).toBeDefined();
    expect(shot.x).toBeCloseTo(300 + shot.velocity.x * elapsed, 10);
    expect(shot.y).toBeCloseTo(shot.velocity.y * elapsed, 10);
    // A Laser bolt reaches 370 whoever fires it: its lifetime is that over its speed.
    expect(shot.life).toBeCloseTo(370 / Math.hypot(shot.velocity.x, shot.velocity.y) - elapsed, 10);
    const before = { life: shot.life, x: shot.x, y: shot.y };
    stepFlight(CONTENT, dt, idle, flight);
    expect(shot.x).toBeCloseTo(before.x + shot.velocity.x * dt, 10);
    expect(shot.y).toBeCloseTo(before.y + shot.velocity.y * dt, 10);
    expect(shot.life).toBeCloseTo(before.life - dt, 10);
  });

  it("does not hit Ada before a delayed bolt can reach her collision boundary", () => {
    const flight = empty();
    const target = ship("fighter", { x: 15, y: 0 });
    target.cooldown = 999;
    target.enemy!.primaryCooldown = 0.012;
    flight.objects.push(target);
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(flight.shield).toBe(CONTENT.tuning.shieldMax);
    expect(flight.shots.filter((shot) => shot.enemy)).toHaveLength(1);
    // The bolt hits once it has flown to her boundary, within a few frames at 300 a second.
    for (let frame = 0; frame < 5 && flight.shots.some((shot) => shot.enemy); frame++) {
      stepFlight(CONTENT, 1 / 60, idle, flight);
    }
    expect(flight.shield).toBe(CONTENT.tuning.shieldMax - CONTENT.tuning.hazardDamage);
    expect(flight.shots.filter((shot) => shot.enemy)).toHaveLength(0);
  });

  it.each(["destination", "guard"] as const)(
    "preserves both required fights through nearby %s clearance",
    (clearance) => {
      const flight = empty();
      flight.galaxy = 3;
      const first = ensureDestination(CONTENT, "first", flight);
      const firstGuard = ensureRouteEncounter(CONTENT, "first", flight)!;
      const original = { x: firstGuard.x, y: firstGuard.y };
      let second: SpaceObject;
      if (clearance === "destination") {
        // Story spacing keeps a destination off another's guard; without it, the second
        // destination lands on the first's guard, which its clearance must keep.
        flight.player = { x: original.x, y: original.y + CONTENT.tuning.chunkSize * 2 };
        const unspaced = { ...CONTENT, tuning: { ...CONTENT.tuning, storySpacing: 0 } };
        second = ensureDestination(unspaced, "second", flight);
        // A current's clearance can shift both destinations, leaving rounding differences.
        expect(second.x).toBeCloseTo(original.x, 9);
        expect(second.y).toBeCloseTo(original.y, 9);
      } else {
        // Parallel approaches place oversized guard footprints across each other.
        second = {
          hp: 1,
          id: "second",
          kind: "destination",
          radius: 30,
          x: first.x + 400,
          y: first.y,
        };
        flight.objects.push(second);
        flight.player = { x: second.x, y: 0 };
      }
      expect(flight.objects).toContain(firstGuard);
      const secondGuard = ensureRouteEncounter(CONTENT, "second", flight)!;
      expect(flight.objects).toContain(firstGuard);
      expect(flight.objects).toContain(secondGuard);
      expect(routeBlocked("first", flight)).toBe(true);
      expect(routeBlocked("second", flight)).toBe(true);
      for (const guard of [firstGuard, secondGuard]) {
        for (const destination of [first, second]) {
          expect(
            Math.hypot(guard.x - destination.x, guard.y - destination.y) - guard.radius,
          ).toBeGreaterThanOrEqual(CONTENT.tuning.safeRadius);
        }
        expect(guard.enemy!.home).toEqual({ x: guard.x, y: guard.y });
        expect(guard.enemy!.position).toEqual({ x: guard.x, y: guard.y });
      }
      expect(
        Math.hypot(firstGuard.x - secondGuard.x, firstGuard.y - secondGuard.y),
      ).toBeGreaterThanOrEqual(firstGuard.radius + secondGuard.radius);
      expect(ensureRouteEncounter(CONTENT, "first", flight)).toBe(firstGuard);
      expect(ensureRouteEncounter(CONTENT, "second", flight)).toBe(secondGuard);
    },
  );
});

it("settles a translated route guard after destination relocation without resetting its combat state", () => {
  const flight = empty();
  // Cartwheel's capital guard, where no current nudges the relocated destination.
  flight.galaxy = 2;
  const destination: SpaceObject = {
    hp: 1,
    id: "moving-route",
    kind: "destination",
    radius: 30,
    x: 10000,
    y: 10000,
  };
  flight.objects.push(destination);
  const guard = ensureRouteEncounter(CONTENT, destination.id, flight)!;
  guard.enemy!.hardpoints[0]!.hp = 2;
  guard.enemy!.hardpoints[1]!.cooldown = 0.7;
  guard.enemy!.engaged = true;
  guard.enemy!.pursuitSeconds = 1.25;
  const saved = structuredClone(guard.enemy!);
  const old = { x: destination.x, y: destination.y };
  const friendly: SpaceObject = {
    hp: 1,
    id: "friendly",
    kind: "destination",
    radius: 30,
    x: CONTENT.tuning.storySpacing + guard.x - old.x,
    y: -1024 + guard.y - old.y,
  };
  flight.objects.push(friendly);
  const relocated = placeDestinationAhead(CONTENT, destination.id, flight);
  const dx = relocated.x - old.x;
  const dy = relocated.y - old.y;
  guard.x += dx;
  guard.y += dy;
  guard.enemy!.position.x += dx;
  guard.enemy!.position.y += dy;
  guard.enemy!.home.x += dx;
  guard.enemy!.home.y += dy;
  expect(Math.hypot(guard.x - friendly.x, guard.y - friendly.y)).toBeLessThan(1e-6);
  expect(ensureRouteEncounter(CONTENT, destination.id, flight)).toBe(guard);
  expect(Math.hypot(guard.x - friendly.x, guard.y - friendly.y)).toBeLessThan(1e-6);
  settleRouteEncounters(CONTENT, flight);
  for (const target of [relocated, friendly]) {
    expect(
      Math.hypot(guard.x - target.x, guard.y - target.y) - guard.radius,
    ).toBeGreaterThanOrEqual(CONTENT.tuning.safeRadius);
  }
  expect(guard.enemy!.hardpoints).toEqual(saved.hardpoints);
  expect({
    ...guard.enemy!,
    home: saved.home,
    position: saved.position,
    velocity: saved.velocity,
  }).toEqual(saved);
  expect(guard.enemy!.position).toEqual({ x: guard.x, y: guard.y });
  expect(guard.enemy!.home).toEqual({ x: guard.x, y: guard.y });
  expect(routeBlocked(destination.id, flight)).toBe(true);
  expect(flight.combat!.routeEncounters).toEqual([destination.id]);
});

const viewportSpan = SCREEN.width / 2 + SCREEN.height;
const capitalHullGap = Math.hypot(viewportSpan, viewportSpan);
const capitalPairs = [["capital", "capital"]] as const;

function silence(object: SpaceObject): void {
  object.cooldown = 999;
  for (const part of object.enemy!.hardpoints) {
    part.cooldown = 999;
  }
}

function stopEngines(object: SpaceObject): void {
  const definition = enemyCatalog[object.enemy!.archetype];
  for (const part of object.enemy!.hardpoints) {
    if (definition.hardpoints.some((entry) => entry.id === part.id && entry.kind === "engine")) {
      part.hp = 0;
    }
  }
}

describe("capital local-area separation", () => {
  it.each(capitalPairs)(
    "keeps required %s and %s guards separated without displacing a valid first guard",
    (firstKind, secondKind) => {
      const flight = empty();
      flight.galaxy = firstKind === "capital" ? 2 : 3;
      const firstDestination = ensureDestination(CONTENT, "first-capital", flight);
      const first = ensureRouteEncounter(CONTENT, firstDestination.id, flight)!;
      expect(first.x).toBeCloseTo(firstDestination.x);
      expect(first.y).toBeCloseTo(
        firstDestination.y + CONTENT.tuning.safeRadius + first.radius + 120,
      );
      first.enemy!.hardpoints[0]!.hp = 2;
      const saved = structuredClone(first);
      const secondDestination: SpaceObject = {
        hp: 1,
        id: "second-capital",
        kind: "destination",
        radius: 30,
        x: firstDestination.x + 800,
        y: firstDestination.y,
      };
      flight.objects.push(secondDestination);
      flight.player = { x: secondDestination.x, y: 0 };
      flight.galaxy = secondKind === "capital" ? 2 : 3;
      const second = ensureRouteEncounter(CONTENT, secondDestination.id, flight)!;
      expect(first).toEqual(saved);
      expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
        first.radius + second.radius + capitalHullGap,
      );
      expect(routeBlocked(firstDestination.id, flight)).toBe(true);
      expect(routeBlocked(secondDestination.id, flight)).toBe(true);
      expect(flight.objects.filter((object) => object.enemy?.archetype === "capital")).toHaveLength(
        2,
      );
      const repeated = structuredClone(flight);
      settleRouteEncounters(CONTENT, repeated);
      expect(repeated).toEqual(flight);
    },
  );

  it.each(capitalPairs)(
    "does not let moving %s and %s collapse the gap across long frames or an engine disable",
    (firstKind, secondKind) => {
      const flight = empty();
      const radius =
        (enemyCatalog[firstKind].sizeRatio + enemyCatalog[secondKind].sizeRatio) *
        CONTENT.tuning.flight.shipRadius;
      const startDistance = radius + capitalHullGap + 30;
      const first = ship(firstKind, { x: -startDistance / 2, y: 0 });
      const second = ship(secondKind, { x: startDistance / 2, y: 0 });
      first.id = first.enemy!.id = "first";
      second.id = second.enemy!.id = "second";
      first.enemy!.velocity.x = 36;
      second.enemy!.velocity.x = -36;
      silence(first);
      silence(second);
      flight.objects.push(first, second);
      stepFlight(CONTENT, 2, idle, flight);
      expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
        radius + capitalHullGap,
      );
      expect(first.x).toBeGreaterThan(-startDistance / 2);
      expect(second.x).toBeLessThan(startDistance / 2);
      stopEngines(first);
      const stopped = { x: first.x, y: first.y };
      stepFlight(CONTENT, 3, idle, flight);
      expect({ x: first.x, y: first.y }).toEqual(stopped);
      expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
        radius + capitalHullGap,
      );
    },
  );

  it("leaves a salvaged capital where Ada left it, out of the spacing between capitals", () => {
    const flight = empty();
    const live = ship("capital", { x: 300, y: 0 });
    const hulk = ship("capital", { x: 500, y: 0 });
    live.id = live.enemy!.id = "live";
    hulk.id = hulk.enemy!.id = "hulk";
    for (const object of [live, hulk]) {
      stopEngines(object);
      silence(object);
    }
    hulk.enemy!.disabled = true;
    hulk.enemy!.salvaged = true;
    // The hulk comes first, so as a live capital it would be the one kept.
    flight.objects.push(hulk, live);
    for (let step = 0; step < 3; step++) {
      stepFlight(CONTENT, 1 / 60, idle, flight);
    }
    expect([hulk, live].map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 500, y: 0 },
      { x: 300, y: 0 },
    ]);
  });

  it("settles a guard off a salvaged hulk's drawn hull, leaving the hulk in place", () => {
    const flight = empty();
    const hulk = ship("capital", { x: 3000, y: 0 });
    const guard = ship("capital", { x: 3010, y: 0 });
    hulk.id = hulk.enemy!.id = "hulk";
    guard.id = guard.enemy!.id = "guard";
    hulk.routeId = "first";
    guard.routeId = "second";
    hulk.enemy!.disabled = true;
    hulk.enemy!.salvaged = true;
    flight.objects.push(hulk, guard);
    settleRouteEncounters(CONTENT, flight);
    expect({ x: hulk.x, y: hulk.y }).toEqual({ x: 3000, y: 0 });
    expect({ x: guard.x, y: guard.y }).not.toEqual({ x: 3010, y: 0 });
    // At any heading the guard turns to, its hull clears the hulk's on screen.
    const hull = enemyHull(hulk.enemy!)!;
    for (let index = 0; index < 16; index++) {
      const facing = { x: Math.cos((index * Math.PI) / 8), y: Math.sin((index * Math.PI) / 8) };
      expect(
        outlinesContact(hull, hulk, enemyHull({ archetype: "capital", facing })!, guard),
      ).toBeNull();
    }
  });

  it("repairs close capitals in a resumed flight deterministically while retaining damage and route markers", () => {
    const flight = empty();
    const first = ship("capital", { x: 300, y: 0 });
    const second = ship("capital", { x: 500, y: 0 });
    first.id = first.enemy!.id = "resume-first";
    second.id = second.enemy!.id = "resume-second";
    first.routeId = "required-first";
    second.routeId = "required-second";
    stopEngines(first);
    stopEngines(second);
    silence(first);
    silence(second);
    first.enemy!.hardpoints[0]!.hp = 2;
    flight.objects.push(first, second);
    flight.combat = { initialPackSizes: {}, routeEncounters: [first.routeId, second.routeId] };
    const hardpoints = structuredClone([first.enemy!.hardpoints, second.enemy!.hardpoints]);
    const restored = JSON.parse(JSON.stringify(flight)) as FlightState;
    stepFlight(CONTENT, 1 / 60, idle, flight);
    stepFlight(CONTENT, 1 / 60, idle, restored);
    expect(restored).toEqual(flight);
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
      first.radius + second.radius + capitalHullGap,
    );
    expect(first.enemy!.hardpoints.map((part) => part.hp)).toEqual(
      hardpoints[0]!.map((part) => part.hp),
    );
    expect(second.enemy!.hardpoints.map((part) => part.hp)).toEqual(
      hardpoints[1]!.map((part) => part.hp),
    );
    expect(flight.combat!.routeEncounters).toEqual([first.routeId, second.routeId]);
    expect(routeBlocked(first.routeId, flight)).toBe(true);
    expect(routeBlocked(second.routeId, flight)).toBe(true);
    const positions = [first, second].map((object) => ({
      home: { ...object.enemy!.home },
      x: object.x,
      y: object.y,
    }));
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(
      [first, second].map((object) => ({ home: object.enemy!.home, x: object.x, y: object.y })),
    ).toEqual(positions);
  });

  it("settles a translated capital away from another capital without changing the existing valid guard", () => {
    const flight = empty();
    const first = ship("capital", { x: -2000, y: 0 });
    const second = ship("capital", { x: 2000, y: 0 });
    first.id = first.enemy!.id = "anchored";
    second.id = second.enemy!.id = "translated";
    first.routeId = "first";
    second.routeId = "second";
    flight.objects.push(first, second);
    const saved = structuredClone(first);
    second.x = first.x + 500;
    second.enemy!.position.x = second.x;
    second.enemy!.home.x = second.x;
    second.enemy!.hardpoints[0]!.hp = 2;
    const parts = structuredClone(second.enemy!.hardpoints);
    settleRouteEncounters(CONTENT, flight);
    expect(first).toEqual(saved);
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
      first.radius + second.radius + capitalHullGap,
    );
    expect(second.enemy!.hardpoints).toEqual(parts);
    expect(second.enemy!.home).toEqual({ x: second.x, y: second.y });
    expect(second.enemy!.position).toEqual({ x: second.x, y: second.y });
    expect(routeBlocked("first", flight)).toBe(true);
    expect(routeBlocked("second", flight)).toBe(true);
  });

  it("allows nearby frigates and does not apply the capital gap to mixed pairs", () => {
    const flight = empty();
    const first = ship("capital", { x: 300, y: 0 });
    const second = ship("frigate", { x: 600, y: 0 });
    const third = ship("frigate", { x: 750, y: 0 });
    first.id = first.enemy!.id = "capital";
    second.id = second.enemy!.id = "frigate-first";
    third.id = third.enemy!.id = "frigate-second";
    flight.objects.push(first, second, third);
    for (const object of flight.objects) {
      stopEngines(object);
      silence(object);
    }
    const positions = flight.objects.map((object) => ({ x: object.x, y: object.y }));
    stepFlight(CONTENT, 2, idle, flight);
    expect(flight.objects.map((object) => ({ x: object.x, y: object.y }))).toEqual(positions);
    expect(second.x - first.x).toBeLessThan(capitalHullGap);
    expect(third.x - second.x).toBeLessThan(capitalHullGap);
  });

  it("keeps frigates out of capital settlement and on hull-clearance placement", () => {
    const flight = empty();
    const capitals = [ship("capital", { x: 300, y: 0 }), ship("capital", { x: 500, y: 0 })];
    const frigates = [ship("frigate", { x: -1000, y: 600 }), ship("frigate", { x: -950, y: 600 })];
    for (const [index, object] of [...capitals, ...frigates].entries()) {
      object.id = object.enemy!.id = `settled-${index}`;
      stopEngines(object);
      silence(object);
    }
    flight.objects.push(...capitals, ...frigates);
    const frigatePositions = frigates.map((object) => ({ x: object.x, y: object.y }));
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(frigates.map((object) => ({ x: object.x, y: object.y }))).toEqual(frigatePositions);
    expect(
      Math.hypot(capitals[0]!.x - capitals[1]!.x, capitals[0]!.y - capitals[1]!.y),
    ).toBeGreaterThanOrEqual(capitals[0]!.radius + capitals[1]!.radius + capitalHullGap);

    const placed = empty();
    const first = ship("frigate", { x: 0, y: 600 });
    const second = ship("frigate", { x: 40, y: 600 });
    const third = ship("frigate", { x: 240, y: 600 });
    for (const [index, object] of [first, second, third].entries()) {
      object.id = object.enemy!.id = `placed-${index}`;
    }
    placed.objects.push(first, second, third);
    settleRouteEncounters(CONTENT, placed);
    // The earlier blocked frigate advances along +x by one stride; nearby frigates keep their places.
    const stride = 2 * (first.radius + CONTENT.tuning.safeRadius + 120);
    expect({ x: first.x, y: first.y }).toEqual({ x: stride, y: 600 });
    expect({ x: second.x, y: second.y }).toEqual({ x: 40, y: 600 });
    expect({ x: third.x, y: third.y }).toEqual({ x: 240, y: 600 });
  });

  it("settles a paged-in capital without moving an engaged capital beside a rock", () => {
    const flight = empty();
    const engaged = ship("capital", { x: 300, y: 0 });
    const rockRadius = 30;
    const rock: SpaceObject = {
      hp: 100,
      id: "close-rock",
      kind: "rock",
      radius: rockRadius,
      x: engaged.x + engaged.radius + rockRadius + 10,
      y: 0,
    };
    const paged = ship("capital", { x: 900, y: 0 });
    engaged.id = engaged.enemy!.id = "engaged";
    paged.id = paged.enemy!.id = "paged";
    for (const object of [engaged, paged]) {
      stopEngines(object);
      silence(object);
    }
    flight.objects.push(engaged, rock);
    flight.world = { ...flight.world, notables: { [paged.id]: paged } };
    expect(Math.hypot(engaged.x - paged.x, engaged.y - paged.y)).toBeLessThan(
      engaged.radius + paged.radius + capitalHullGap,
    );
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect({ x: engaged.x, y: engaged.y }).toEqual({ x: 300, y: 0 });
    expect(engaged.enemy!.home).toEqual({ x: 300, y: 0 });
    expect({ x: paged.x, y: paged.y }).not.toEqual({ x: 900, y: 0 });
    expect(Math.hypot(engaged.x - paged.x, engaged.y - paged.y)).toBeGreaterThanOrEqual(
      engaged.radius + paged.radius + capitalHullGap,
    );
  });

  it("uses reproducible placement without changing the layout seed or introducing saved RNG state", () => {
    const prepare = (): FlightState => {
      const flight = empty();
      flight.galaxy = 2;
      for (const [index, x] of [0, 800, 1600].entries()) {
        const destination: SpaceObject = {
          hp: 1,
          id: `route-${index}`,
          kind: "destination",
          radius: 30,
          x,
          y: -1024,
        };
        flight.objects.push(destination);
        flight.player = { x, y: 0 };
        ensureRouteEncounter(CONTENT, destination.id, flight);
      }
      return flight;
    };
    const flight = prepare();
    expect(prepare()).toEqual(flight);
    expect(flight.seed).toBe(173);
    expect(flight.objects.filter((object) => object.kind === "enemy")).toHaveLength(3);
    expect(Object.keys(flight.combat!).sort()).toEqual(["initialPackSizes", "routeEncounters"]);
  });
});

/** A screen outline pushed `margin` px out from its origin, for a near-contact test. */
function grownBy(parts: Parts, margin: number): Parts {
  return margin
    ? parts.map((part) =>
        part.map((at) => {
          const gap = Math.hypot(at.x, at.y) || 1;
          return { x: at.x * (1 + margin / gap), y: at.y * (1 + margin / gap) };
        }),
      )
    : parts;
}

describe("ship contact", () => {
  const { sceneryRecoil, sceneryRestitution } = CONTENT.tuning.flight;
  const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
  // The enemy's drawn hull against Ada's drawn ship, pushing Ada.
  const overlapOf = (flight: FlightState, object: SpaceObject, margin = 0) => {
    const hull = enemyHull(object.enemy!);
    return hull
      ? outlinesContact(hull, object, grownBy(shipBody(flight.facing), margin), flight.player)
      : shipCircleContact(flight.facing, flight.player, object, object.radius + margin);
  };
  /** An enemy overlapping Ada's drawn ship by 4 from +x, both moving along x. */
  function contact(archetype: EnemyArchetype, ada: number, enemy: number) {
    const flight = empty();
    flight.velocity = { x: ada, y: 0 };
    const object = ship(archetype, { ...flight.player });
    // The nearest +x offset at which the hull circle clears Ada's drawn ship, to 0.001.
    let low = 0;
    let high = 200;
    while (high - low > 1e-3) {
      const middle = (low + high) / 2;
      object.x = flight.player.x + middle;
      if (overlapOf(flight, object)) {
        low = middle;
      } else {
        high = middle;
      }
    }
    object.x = flight.player.x + high - 4;
    object.enemy!.position = { x: object.x, y: object.y };
    object.enemy!.velocity = { x: enemy, y: 0 };
    flight.objects.push(object);
    const normal = overlapOf(flight, object)!.normal;
    return { flight, normal, object };
  }
  /** Ada's velocity relative to the enemy's along the contact normal: positive separates. */
  const separating = (flight: FlightState, normal: Vec, object: SpaceObject) =>
    dot(
      {
        x: flight.velocity.x - object.enemy!.velocity.x,
        y: flight.velocity.y - object.enemy!.velocity.y,
      },
      normal,
    );

  it("bounces equal ships symmetrically by the scenery rule, along the drawn contact", () => {
    const { flight, normal, object } = contact("fighter", 50, -50);
    const closing = -separating(flight, normal, object);
    expect(closing).toBeGreaterThan(0);
    const before = { ada: { ...flight.velocity }, enemy: { ...object.enemy!.velocity } };
    bounceShips(CONTENT, flight, object);
    // Equal masses share the change evenly; they separate at restitution 0.4 along the normal.
    expect(flight.velocity.x - before.ada.x).toBeCloseTo(
      -(object.enemy!.velocity.x - before.enemy.x),
      9,
    );
    expect(flight.velocity.y - before.ada.y).toBeCloseTo(
      -(object.enemy!.velocity.y - before.enemy.y),
      9,
    );
    expect(separating(flight, normal, object)).toBeCloseTo(
      Math.max(closing * sceneryRestitution, sceneryRecoil),
      9,
    );
    // Separated to the push-out's 0.01 margin.
    expect(overlapOf(flight, object)?.depth ?? 0).toBeLessThan(0.02);
  });

  it("splits the bounce by size ratio squared, so a capital barely moves", () => {
    const { flight, normal, object } = contact("capital", 60, 0);
    const closing = -separating(flight, normal, object);
    const before = { ada: { ...flight.player }, capital: { x: object.x, y: object.y } };
    bounceShips(CONTENT, flight, object);
    const mass = enemyCatalog.capital.sizeRatio ** 2;
    const adaChange = flight.velocity.x - 60;
    const capitalChange = object.enemy!.velocity.x;
    expect(Math.sign(adaChange)).toBe(Math.sign(normal.x));
    expect(capitalChange / -adaChange).toBeCloseTo(1 / mass, 9);
    expect(separating(flight, normal, object)).toBeCloseTo(
      Math.max(closing * sceneryRestitution, sceneryRecoil),
      9,
    );
    const adaPush = Math.hypot(flight.player.x - before.ada.x, flight.player.y - before.ada.y);
    const capitalPush = Math.hypot(object.x - before.capital.x, object.y - before.capital.y);
    expect(capitalPush / adaPush).toBeCloseTo(1 / mass, 9);
  });

  it("separates slow contacts at least at the scenery recoil", () => {
    const { flight, normal, object } = contact("swarm", 5, 0);
    bounceShips(CONTENT, flight, object);
    expect(separating(flight, normal, object)).toBeCloseTo(sceneryRecoil, 9);
  });

  it.each(["fighter", "retaliator"] as const)(
    "bounces Ada's drawn ship off a %s she flies into, without overlap, sticking or damage",
    (archetype) => {
      // Small craft hold a standoff band, so Ada, faster than these two, closes the gap herself.
      const flight = empty();
      const chaser = ship(archetype, { x: flight.player.x + 60, y: flight.player.y });
      chaser.enemy!.engaged = true;
      flight.objects.push(chaser);
      let touches = 0;
      let overlap = 0;
      for (let frame = 0; frame < 60 * 6; frame++) {
        chaser.enemy!.primaryCooldown = 999;
        silence(chaser);
        const toward = { x: chaser.x - flight.player.x, y: chaser.y - flight.player.y };
        const reach = Math.hypot(toward.x, toward.y) || 1;
        stepFlight(
          CONTENT,
          1 / 60,
          { ...idle, move: { x: toward.x / reach, y: toward.y / reach } },
          flight,
        );
        overlap = Math.max(overlap, overlapOf(flight, chaser)?.depth ?? 0);
        touches += overlapOf(flight, chaser, 0.5) ? 1 : 0;
      }
      expect(touches).toBeGreaterThan(0);
      expect(overlap).toBeLessThan(0.5);
      expect(flight.shield).toBe(CONTENT.tuning.shieldMax);
    },
  );
});
