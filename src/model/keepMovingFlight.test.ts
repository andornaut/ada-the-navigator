import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import type { EnemyArchetype } from "../data/enemyCatalog.ts";
import { PHANTOM_FLAGSHIP_ID, retaliatorVariant } from "../data/enemyIdentity.ts";
import { ENEMY_KEEP_MOVING } from "../data/enemyNavigation.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_TUNING } from "../data/phantom.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { createEnemy, type EnemyState } from "./enemyAi.ts";
import { GameModel } from "./game.ts";
import type { SpaceObject, Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const dt = SIMULATION_STEP_SECONDS;

/** A flight in `galaxy` with its opening played and no enemies, Ada at `player`. */
function flightModel(galaxy: GalaxyNumber, player: Vec): GameModel {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 2, 3, 4, 5, 6];
  model.state.prologueSeen = true;
  model.state.progress[galaxy].opened = true;
  model.state.progress[galaxy].introduced = true;
  model.state.seenConversations.push(...CONVERSATIONS.map((conversation) => conversation.id));
  model.state.economy.levels.shield = 3;
  model.startGalaxy(galaxy);
  model.state.dialogue = null;
  const flight = model.state.flight!;
  flight.player = { ...player };
  flight.velocity = { x: 0, y: 0 };
  flight.shots = [];
  flight.mines = [];
  flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
  return model;
}

/** An enemy of `archetype` at `position`, unengaged, added to the model's flight. */
function addEnemy(
  model: GameModel,
  archetype: EnemyArchetype,
  id: string,
  position: Vec,
  patch: Partial<EnemyState> = {},
  object: Partial<SpaceObject> = {},
): SpaceObject {
  const flight = model.state.flight!;
  const definition = enemyActorDefinition(flight.galaxy, archetype, id, 1);
  const enemy = {
    ...createEnemy(
      definition,
      { archetype, id, packId: null, phase: 0.4, weaponLevel: 1 },
      position,
    ),
    ...patch,
  };
  const added: SpaceObject = {
    ...position,
    enemy,
    hp: enemy.hp,
    id,
    kind: "enemy",
    persistent: false,
    radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
    ...object,
  };
  flight.objects.push(added);
  return added;
}

/** One simulation step with any story line dismissed, so the flight keeps running. */
function stepModel(model: GameModel): void {
  model.state.dialogue = null;
  model.step(dt, idle);
}

const speed = (object: SpaceObject) =>
  Math.hypot(object.enemy!.velocity.x, object.enemy!.velocity.y);

describe("keep moving in flight", () => {
  it("slides two idle ships that meet head on past each other instead of locking", () => {
    const point = { x: 30000, y: 5000 };
    const model = flightModel(1, { x: point.x, y: point.y + 900 });
    // Each ship's patrol lies beyond the other, so both press straight into the contact.
    const a = addEnemy(model, "fighter", "lock:a", point, {
      home: { x: point.x + 600, y: point.y },
    });
    const b = addEnemy(
      model,
      "fighter",
      "lock:b",
      { x: point.x + 28, y: point.y },
      {
        home: { x: point.x - 572, y: point.y },
      },
    );
    let stalled = 0;
    let total = 0;
    let samples = 0;
    for (let step = 0; step * dt < 20; step++) {
      const before = [
        { x: a.x, y: a.y },
        { x: b.x, y: b.y },
      ];
      stepModel(model);
      const moved = Math.min(
        Math.hypot(a.x - before[0]!.x, a.y - before[0]!.y),
        Math.hypot(b.x - before[1]!.x, b.y - before[1]!.y),
      );
      stalled = moved / dt < 8 ? stalled + dt : 0;
      expect(stalled).toBeLessThan(1);
      if (step * dt > 3) {
        total += speed(a) + speed(b);
        samples += 2;
      }
    }
    // They keep their pace; only a turn back on their patrols dips briefly.
    expect(total / samples).toBeGreaterThan(160 * ENEMY_KEEP_MOVING.minimumShare);
  });

  it("turns a blockade ship along its 600 reach instead of holding it at the limit", () => {
    const model = flightModel(6, { x: 0, y: 3000 });
    const home = { x: 0, y: 0 };
    const ship = addEnemy(
      model,
      "fighter",
      "blockade:a",
      { x: PHANTOM_TUNING.blockadeReach - 2, y: 0 },
      { home, velocity: { x: 160, y: 0 } },
      { routeId: PHANTOM_DESTINATIONS[0] },
    );
    let slowest = Infinity;
    for (let step = 0; step * dt < 6; step++) {
      stepModel(model);
      expect(Math.hypot(ship.x, ship.y)).toBeLessThanOrEqual(PHANTOM_TUNING.blockadeReach + 1e-6);
      if (step * dt > 1) {
        slowest = Math.min(slowest, speed(ship));
      }
    }
    expect(slowest).toBeGreaterThan(160 * ENEMY_KEEP_MOVING.minimumShare * 0.5);
  });

  it("stands Phantom's drones down to a home patrol without fire once the flagship is salvaged", () => {
    const model = flightModel(6, { x: 9000, y: 0 });
    const flight = model.state.flight!;
    flight.phantom = {
      allies: [],
      allyTurn: 0,
      blockades: {},
      chatter: [],
      disabledCued: false,
      enemyIds: [PHANTOM_FLAGSHIP_ID, "drone"],
      phase: "salvaged",
      resolvedIds: [],
      wave: 3,
      waypoint: { x: 8000, y: 0 },
    };
    const drone = addEnemy(
      model,
      "fighter",
      "drone",
      { x: 9200, y: 0 },
      {
        engaged: true,
        home: { x: 9300, y: 0 },
        primaryCooldown: 0,
      },
    );
    let slowest = Infinity;
    for (let step = 0; step * dt < 6; step++) {
      stepModel(model);
      expect(flight.shots.some((shot) => shot.enemy)).toBe(false);
      expect(drone.enemy!.engaged).toBe(false);
      if (step * dt > 2) {
        slowest = Math.min(slowest, speed(drone));
      }
    }
    expect(slowest).toBeGreaterThanOrEqual(160 * ENEMY_KEEP_MOVING.minimumShare * 0.9);
  });

  it("traces a qualifying rock with a Mining Freighter and keeps its tracing through a save", () => {
    const point = { x: 30000, y: 5000 };
    const model = flightModel(1, { x: point.x, y: point.y + 900 });
    const flight = model.state.flight!;
    const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "large")!;
    // One step generates the region around Ada first, so the traced rock is the only rock there.
    stepModel(model);
    flight.objects = flight.objects.filter((object) => object.kind !== "rock");
    flight.objects.push({
      asteroid: shape.id,
      hp: 99,
      id: "trace-rock",
      kind: "rock",
      radius: shape.radius,
      x: point.x + 400,
      y: point.y,
    });
    let index = 0;
    while (
      retaliatorVariant({ archetype: "retaliator", id: `trace-miner:${index}` }) !==
      "retaliatorMiningFreighter"
    ) {
      index++;
    }
    const miner = addEnemy(model, "retaliator", `trace-miner:${index}`, point);
    let slowest = Infinity;
    for (let step = 0; step * dt < 5; step++) {
      stepModel(model);
      if (step * dt > 2) {
        slowest = Math.min(slowest, speed(miner));
      }
    }
    // It picked live rocks at rest and traces one of them.
    const tracing = miner.enemy!.miner!;
    expect(tracing.picks.length).toBeGreaterThan(0);
    expect(
      flight.objects.some((object) => object.id === tracing.rock && object.kind === "rock"),
    ).toBe(true);
    // It traces at the minimum speed, dipping briefly through the outline's corners.
    expect(slowest).toBeGreaterThanOrEqual(120 * ENEMY_KEEP_MOVING.minimumShare * 0.8);
    const resumed = relaunch(CONTENT, model.save());
    expect(resumed.state.flight).toEqual(flight);
    stepModel(model);
    stepModel(resumed);
    expect(resumed.state.flight).toEqual(flight);
  });
});
