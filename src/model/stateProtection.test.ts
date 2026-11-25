import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import { createEnemy } from "./enemyAi.ts";
import {
  arrivalGraceActive,
  beginArrivalGrace,
  createFlight,
  routeBlocked,
  stepFlight,
} from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { readRequiredPlan } from "./requiredEncounterPlans.ts";
import { stationInCell, type StationSite } from "./stations.ts";
import type { FlightInput, FlightState, SpaceObject, Vec } from "./types.ts";

/** An explicit grace, independent of the tuned value. */
const GRACE = 2;
const content: GameContent = {
  ...CONTENT,
  tuning: { ...CONTENT.tuning, flight: { ...CONTENT.tuning.flight, arrivalGrace: GRACE } },
};
const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const shieldMax = content.tuning.shieldMax;

/** An enemy bolt resting on Ada, which strikes her on the next step. */
function incoming(flight: FlightState): void {
  flight.shots.push({
    ...flight.player,
    damage: 1,
    enemy: true,
    hitIds: [],
    id: `incoming:${flight.nextId++}`,
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
  });
}

function sunflower(seen = true): GameModel {
  const model = new GameModel(content);
  model.state.prologueSeen = true;
  model.state.progress[1].opened = true;
  if (seen) {
    model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  }
  model.startGalaxy(1);
  return model;
}

/** Steps the model idle until the arrival grace has run out. */
function outlastGrace(model: GameModel): void {
  const flight = model.state.flight!;
  for (let step = 0; step < 1000 && arrivalGraceActive(flight); step++) {
    model.state.dialogue = null;
    model.step(SIMULATION_STEP_SECONDS, idle);
  }
  expect(arrivalGraceActive(flight)).toBe(false);
}

function nearestStation(galaxy: GalaxyNumber): StationSite {
  for (let span = 0; span <= 6; span++) {
    for (let x = -span; x <= span; x++) {
      for (let y = -span; y <= span; y++) {
        const site = stationInCell(ECONOMY, galaxy, { x, y });
        if (site) {
          return site;
        }
      }
    }
  }
  throw new Error("no station");
}

/** An engaged frigate of `galaxy` at `at`, its clocks ready to fire. */
function frigate(galaxy: GalaxyNumber, id: string, at: Vec): SpaceObject {
  const definition = enemyDefinition(galaxy, "frigate", id);
  const enemy = createEnemy(definition, { archetype: "frigate", id, packId: null, phase: 0 }, at);
  return { ...at, enemy, hp: enemy.hp, id, kind: "enemy", radius: 50 };
}

/**
 * Ada fires at `target` until she has hit it, then holds fire; returns the seconds from her
 * first hit until a hostile shot is in flight, or null within `seconds`.
 */
function answerTime(
  model: GameModel,
  target: SpaceObject,
  seconds: number,
): { answered: number | null; hit: boolean } {
  const flight = model.state.flight!;
  const known = new Set(flight.shots.filter((shot) => shot.enemy).map((shot) => shot.id));
  const integrity = () =>
    target.enemy!.hp + target.enemy!.hardpoints.reduce((sum, part) => sum + part.hp, 0);
  const start = integrity();
  let hitAt: number | null = null;
  for (let step = 0; step < Math.round(seconds / SIMULATION_STEP_SECONDS); step++) {
    const t = step * SIMULATION_STEP_SECONDS;
    const aim = { x: target.x - flight.player.x, y: target.y - flight.player.y };
    const length = Math.hypot(aim.x, aim.y) || 1;
    model.state.dialogue = null;
    flight.shield = shieldMax;
    model.step(SIMULATION_STEP_SECONDS, {
      ...idle,
      aim: hitAt === null ? { x: aim.x / length, y: aim.y / length } : { x: 0, y: 0 },
    });
    if (hitAt === null && integrity() < start) {
      hitAt = t;
    }
    if (hitAt !== null && flight.shots.some((shot) => shot.enemy && !known.has(shot.id))) {
      return { answered: t - hitAt, hit: true };
    }
  }
  return { answered: null, hit: hitAt !== null };
}

describe("arrival grace", () => {
  it("protects Ada after a launch, then lets enemy fire land once it ends", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    expect(flight.arrivalGraceUntil).toBe(flight.time + GRACE);
    expect(arrivalGraceActive(flight)).toBe(true);
    incoming(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax);
    expect(flight.shots.filter((shot) => shot.enemy)).toEqual([]);
    outlastGrace(model);
    incoming(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax - 1);
  });

  it("holds an engaged enemy's fire during the grace and releases it at its end", () => {
    const flight = createFlight(content, 2, 7, { known: [] });
    flight.objects = [];
    const enemy = frigate(2, "grace-frigate", { x: 200, y: 0 });
    enemy.enemy!.engaged = true;
    flight.objects.push(enemy);
    beginArrivalGrace(content, flight);
    for (;;) {
      stepFlight(content, SIMULATION_STEP_SECONDS, idle, flight);
      if (!arrivalGraceActive(flight)) {
        break;
      }
      expect(flight.shots.filter((shot) => shot.enemy)).toEqual([]);
      expect(flight.shield).toBe(shieldMax);
    }
    for (let step = 0; step < 4 / SIMULATION_STEP_SECONDS; step++) {
      stepFlight(content, SIMULATION_STEP_SECONDS, idle, flight);
    }
    expect(flight.shield).toBeLessThan(shieldMax);
  });

  it("protects Ada after a Travel arrival at a station until the grace ends", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    outlastGrace(model);
    const site = nearestStation(1);
    flight.player = { x: site.x + 100, y: site.y };
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(model.state.progress[1].stations).toContain(site.id);
    flight.player = { x: site.x + 6000, y: site.y };
    model.step(SIMULATION_STEP_SECONDS, idle);
    outlastGrace(model);
    flight.dangerFor = 0;
    model.teleport(site.id);
    expect(flight.player).toEqual({ x: site.x, y: site.y });
    expect(flight.arrivalGraceUntil).toBe(flight.time + GRACE);
    incoming(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax);
    outlastGrace(model);
    incoming(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax - 1);
  });
});

describe("paused protection", () => {
  it("lands no shot or damage while docked, and normal combat resumes on undocking", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    outlastGrace(model);
    const site = nearestStation(1);
    flight.player = { x: site.x + 150, y: site.y };
    flight.velocity = { x: 0, y: 0 };
    model.step(SIMULATION_STEP_SECONDS, idle);
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    const enemy = frigate(1, "dock-frigate", { x: site.x + 400, y: site.y });
    enemy.enemy!.engaged = true;
    flight.objects.push(enemy);
    model.step(SIMULATION_STEP_SECONDS, { ...idle, use: true });
    expect(model.state.docked).toBe(site.id);
    incoming(flight);
    const time = flight.time;
    const shots = structuredClone(flight.shots);
    for (let step = 0; step < 3 / SIMULATION_STEP_SECONDS; step++) {
      model.step(SIMULATION_STEP_SECONDS, idle);
    }
    expect(flight.time).toBe(time);
    expect(flight.shots).toEqual(shots);
    expect(flight.shield).toBe(shieldMax);
    model.undock();
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax - 1);
  });

  it("lands no shot or damage during dialogue, and normal combat resumes when it closes", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    outlastGrace(model);
    model.state.dialogue = { choices: [], context: "test", text: "", title: "" };
    incoming(flight);
    const time = flight.time;
    for (let step = 0; step < 3 / SIMULATION_STEP_SECONDS; step++) {
      model.step(SIMULATION_STEP_SECONDS, idle);
    }
    expect(flight.time).toBe(time);
    expect(flight.shield).toBe(shieldMax);
    model.closeInteraction();
    expect(model.state.dialogue).toBeNull();
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax - 1);
  });
});

describe("guards fire back wherever Ada attacks from", () => {
  it("answers within three seconds when Ada fires on Sunflower's guard frigate from beside its station", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    outlastGrace(model);
    const pending = readRequiredPlan(flight, "growers")!;
    flight.freshDistance = content.tuning.introFreshDistance;
    model.step(SIMULATION_STEP_SECONDS, idle);
    const leader = flight.objects.find((actor) => actor.id === pending.leader.id)!;
    expect(leader.enemy?.archetype).toBe("frigate");
    expect(routeBlocked("growers", flight)).toBe(true);
    flight.objects = flight.objects.filter(
      (actor) => actor.kind !== "enemy" || actor.id === leader.id,
    );
    const station = flight.objects.find((actor) => actor.id === "growers")!;
    const out = { x: leader.x - station.x, y: leader.y - station.y };
    const reach = Math.hypot(out.x, out.y);
    // Beside the station, inside the radius that once made Ada untargetable.
    flight.player = {
      x: station.x + (out.x / reach) * 100,
      y: station.y + (out.y / reach) * 100,
    };
    flight.velocity = { x: 0, y: 0 };
    expect(Math.hypot(flight.player.x - station.x, flight.player.y - station.y)).toBeLessThan(
      content.tuning.safeRadius,
    );
    const { answered, hit } = answerTime(model, leader, 8);
    expect(hit).toBe(true);
    expect(answered).not.toBeNull();
    expect(answered!).toBeLessThanOrEqual(3);
  });

  it("answers within three seconds when Ada fires on Whirlpool's holodisk guard frigate from beside its site", () => {
    const model = new GameModel(content);
    model.state.unlocked = [1, 3];
    model.state.prologueSeen = true;
    model.state.progress[1].holodisk = true;
    Object.assign(model.state.progress[3], {
      introduced: true,
      known: ["whale", "family"],
      opened: true,
      questComplete: true,
      stage: 5,
    });
    model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
    model.startGalaxy(3);
    model.state.dialogue = null;
    const flight = model.state.flight!;
    model.step(SIMULATION_STEP_SECONDS, idle);
    outlastGrace(model);
    const leader = stationPopulationObjects(flight).find((actor) => actor.routeId === "holodisk")!;
    expect(leader.enemy?.archetype).toBe("frigate");
    flight.objects = flight.objects.filter(
      (actor) => actor.kind !== "enemy" || actor.id === leader.id,
    );
    const site = flight.objects.find((actor) => actor.id === "holodisk")!;
    const out = { x: leader.x - site.x, y: leader.y - site.y };
    const reach = Math.hypot(out.x, out.y);
    flight.player = { x: site.x + (out.x / reach) * 100, y: site.y + (out.y / reach) * 100 };
    flight.velocity = { x: 0, y: 0 };
    const { answered, hit } = answerTime(model, leader, 8);
    expect(hit).toBe(true);
    expect(answered).not.toBeNull();
    expect(answered!).toBeLessThanOrEqual(3);
  });

  it("answers within three seconds when Ada fires on an ambient frigate beside a station", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    outlastGrace(model);
    const site = nearestStation(1);
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    const enemy = frigate(1, "ambient-frigate", { x: site.x + 420, y: site.y });
    flight.objects.push(enemy);
    flight.player = { x: site.x + 100, y: site.y };
    flight.velocity = { x: 0, y: 0 };
    const { answered, hit } = answerTime(model, enemy, 8);
    expect(hit).toBe(true);
    expect(answered).not.toBeNull();
    expect(answered!).toBeLessThanOrEqual(3);
  });
});
