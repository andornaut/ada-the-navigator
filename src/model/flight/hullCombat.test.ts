import { expect, it } from "vitest";

import { SHIP_IMPACT_DAMAGE } from "../../data/collisionDamage.ts";
import { CONTENT } from "../../data/content.ts";
import { ECONOMY } from "../../data/economy.ts";
import { enemyDefinition } from "../../data/enemyCatalog.ts";
import { FLAGSHIP_SURRENDER_HP, PHANTOM_FLAGSHIP_ID } from "../../data/enemyIdentity.ts";
import { PHANTOM_TUNING } from "../../data/phantom.ts";
import { weaponAt } from "../../data/weaponCatalog.ts";
import { restoreSave, SAVE_RESTORE } from "../../saving/index.ts";
import { endArrivalGrace } from "../../testing/arrivalGrace.ts";
import { relaunch, supportEntropy } from "../../testing/launch.ts";
import { createEnemy, damageEnemy, enemyEffects } from "../ai/index.ts";
import { dropRandom, enemyStardust, rollEnemyDrop, rollHeavyDefeatUpgrade } from "../drops.ts";
import { GameModel } from "../game.ts";
import type { FlightEvent, FlightState, Shot, SpaceObject } from "../types.ts";
import { createHitResolution, hit } from "./hitResolution.ts";
import { bounceShips, stepFlight, wreckId } from "./index.ts";
import { fireBeam } from "./playerBeam.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function encounter() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 6] });
  model.state.progress[6].opened = true;
  model.startGalaxy(6);
  const flight = model.state.flight!;
  const id = PHANTOM_FLAGSHIP_ID;
  const definition = enemyDefinition(6, "capital", id);
  const point = { x: 600, y: 0 };
  const enemy = createEnemy(
    definition,
    { archetype: "capital", id, packId: null, phase: 0 },
    point,
  );
  const flagship: SpaceObject = {
    ...point,
    enemy,
    hp: enemy.hp,
    id,
    kind: "enemy",
    persistent: true,
    radius: 100,
  };
  flight.objects = [flagship];
  flight.world.notables = {};
  flight.phantom = {
    allies: [],
    allyTurn: PHANTOM_TUNING.waves,
    blockades: {},
    chatter: [],
    disabledCued: false,
    enemyIds: [id],
    phase: "flagship",
    resolvedIds: [],
    wave: PHANTOM_TUNING.waves,
    waypoint: point,
  };
  endArrivalGrace(flight);
  return { definition, flagship, flight, model };
}

it("clamps only the active finale on a lethal contact and persists that one transition", () => {
  const { definition, flagship, flight, model } = encounter();
  const events: FlightEvent[] = [];
  const hardpoint = flagship.enemy!.hardpoints[0]!;
  hit(CONTENT, 303, hardpoint.id, flagship, flight, events);
  expect(flagship.hp).toBe(17);
  expect(flagship.enemy!.hardpoints[0]).toBe(hardpoint);
  hit(CONTENT, 999, hardpoint.id, flagship, flight, events);
  hit(CONTENT, 999, null, flagship, flight, events);
  expect(flagship.enemy).toMatchObject({
    disabled: true,
    hp: FLAGSHIP_SURRENDER_HP,
    surrendered: true,
  });
  expect(flagship.hp).toBe(FLAGSHIP_SURRENDER_HP);
  expect(events).toEqual([{ id: PHANTOM_FLAGSHIP_ID, type: "enemySurrendered" }]);
  expect(enemyEffects(definition, flagship.enemy!).disabled).toBe(true);
  const saved = model.save();
  const savedFlight = restoreSave(saved)?.flight;
  expect(savedFlight).toBeTruthy();
  const restored = relaunch(CONTENT, saved).state.flight!;
  const retained =
    restored.objects.find(({ id }) => id === PHANTOM_FLAGSHIP_ID) ??
    restored.world.notables[PHANTOM_FLAGSHIP_ID]!;
  expect(retained.enemy).toMatchObject({ disabled: true, hp: 16, surrendered: true });
  hit(CONTENT, 999, null, retained, restored, events);
  expect(retained.hp).toBe(16);
  expect(events).toHaveLength(1);
});

it("uses ordinary destruction for the same actor ID before the finale gate", () => {
  const { flagship, flight } = encounter();
  flight.phantom!.phase = "waves";
  const events: FlightEvent[] = [];
  hit(CONTENT, 999, null, flagship, flight, events);
  expect(events).toEqual([{ id: flagship.id, type: "enemyDestroyed" }]);
  expect(flagship.hp).toBe(0);
});

it("shares the surrender guard across beam, area damage, and successive pellets", () => {
  const { flagship, flight } = encounter();
  const events: FlightEvent[] = [];
  const scenery = { drawnOf: () => null, frameOf: () => 0, kinds: ["rock", "debris"] };
  const { blast, strike } = createHitResolution(scenery);
  const origin = { x: flagship.x - 200, y: flagship.y };
  const definition = weaponAt("phaser", 1);
  const beamDamage = CONTENT.tuning.flight.playerShotDamage * definition.damageRatio;
  flagship.hp = flagship.enemy!.hp = FLAGSHIP_SURRENDER_HP + beamDamage + 2;
  fireBeam(
    { hit, scenery },
    { centre: origin, viewportHeight: 1000, viewportWidth: 1000 },
    CONTENT,
    definition,
    { x: 1, y: 0 },
    origin,
    flight,
    events,
  );
  expect(flagship.hp).toBe(FLAGSHIP_SURRENDER_HP + 2);
  blast(CONTENT, 1, 100, flagship, null, flight, events);
  expect(flagship.hp).toBe(FLAGSHIP_SURRENDER_HP + 1);
  const pellet: Shot = {
    damage: 100,
    enemy: false,
    hitIds: [],
    id: "pellet-a",
    life: 1,
    piercing: false,
    velocity: { x: 1, y: 0 },
    x: flagship.x,
    y: flagship.y,
  };
  const nextPellet = { ...pellet, hitIds: [], id: "pellet-b" };
  strike(CONTENT, pellet, flight, events);
  strike(CONTENT, nextPellet, flight, events);
  expect(pellet.hitIds).toEqual([flagship.id]);
  expect(nextPellet.hitIds).toEqual([flagship.id]);
  expect(flagship.hp).toBe(FLAGSHIP_SURRENDER_HP);
  expect(events).toEqual([{ id: flagship.id, type: "enemySurrendered" }]);
});

it("reactivates old mount damage as hull-only combat without changing saved mount clocks", () => {
  const { definition, flagship } = encounter();
  const enemy = flagship.enemy!;
  enemy.disabled = true;
  for (const mount of enemy.hardpoints) {
    mount.hp = 0;
    mount.cooldown = 0.42;
  }
  const next = damageEnemy(definition, { amount: 2, hardpointId: enemy.hardpoints[0]!.id }, enemy);
  expect(next).toMatchObject({ disabled: false, hp: 318 });
  expect(next.hardpoints).toEqual(enemy.hardpoints);
  expect(enemyEffects(definition, next)).toMatchObject({
    disabledHardpoints: [],
    movementStopped: false,
    thrust: 1,
  });
});

it("keeps Ada's ram damage and collision motion while suppressing the surrendered flagship's fire", () => {
  const { flagship, flight } = encounter();
  const hull = flagship.enemy!;
  hull.engaged = true;
  hull.firePhasesInitialized = true;
  hull.hp = flagship.hp = FLAGSHIP_SURRENDER_HP + SHIP_IMPACT_DAMAGE;
  const closing = (test: FlightState) =>
    bounceShips(
      CONTENT,
      test,
      test.objects.find(({ id }) => id === flagship.id)!,
    );
  let witness = false;
  for (let gap = 100; gap > 0; gap--) {
    flight.player = { x: flagship.x - gap, y: flagship.y };
    flight.velocity = { x: 100, y: 0 };
    if (closing(structuredClone(flight))) {
      witness = true;
      break;
    }
  }
  expect(witness).toBe(true);
  const shield = flight.shield;
  const velocity = { ...flight.velocity };
  const events = stepFlight(CONTENT, 0.001, idle, flight);
  expect(events).toContainEqual({ id: flagship.id, type: "enemySurrendered" });
  expect(flight.shield).toBe(shield - SHIP_IMPACT_DAMAGE);
  expect(flight.velocity).not.toEqual(velocity);
  expect(flight.shots.some(({ enemy }) => enemy)).toBe(false);
  expect(flight.enemyBeams ?? []).toEqual([]);
});

it.each([
  ["frigate", 0.1],
  ["platform", 0.1],
  ["capital", 0.2],
  ["hostileStation", 0.2],
] as const)("rolls %s's exclusive upgrade at %f using the existing actor seed", (kind, chance) => {
  const seed = 77;
  for (let index = 0; index < 256; index++) {
    const id = `boundary:${index}`;
    const upgraded = dropRandom(seed, `salvage:${id}`)() < chance;
    const identity = { id: wreckId(id), seed };
    expect(rollHeavyDefeatUpgrade(ECONOMY, identity, kind)).toBe(upgraded);
    if (kind !== "hostileStation") {
      const payout = rollEnemyDrop(ECONOMY, identity, kind, () => {
        throw new Error("Heavy reward drew from the placement stream");
      });
      expect(payout).toEqual({
        stardust: upgraded ? 0 : enemyStardust({ id, seed }, kind),
        upgrade: upgraded,
      });
    }
  }
});
