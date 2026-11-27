import { describe, expect, it } from "vitest";

import { WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { seedLaunches } from "../testing/launchSeeds.ts";
import { createEnemy } from "./enemyAi.ts";
import {
  activeEnemyBeams,
  activeProjectileImpacts,
  arrivalGraceActive,
  beginArrivalGrace,
  createFlight,
  ensureStation,
  routeBlocked,
  stepFlight,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval, worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { readRequiredPlan } from "./requiredEncounterPlans.ts";
import { MOVING_ROCK_PREFIX } from "./rockRicochet.ts";
import { flightStationContext, type StationSite, worldStationInCell } from "./stations.ts";
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
  const model = new GameModel(content, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.progress[1].opened = true;
  if (seen) {
    model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  }
  model.startGalaxy(1);
  return model;
}

/** Steps the model until the arrival grace has run out; returns the flight time it took. */
function outlastGrace(model: GameModel, input: FlightInput = idle): number {
  const flight = model.state.flight!;
  const start = flight.time;
  for (let step = 0; step < 1000 && arrivalGraceActive(flight); step++) {
    model.state.dialogue = null;
    model.step(SIMULATION_STEP_SECONDS, input);
  }
  expect(arrivalGraceActive(flight)).toBe(false);
  return flight.time - start;
}

function nearestStation(flight: FlightState): StationSite {
  const context = flightStationContext(flight);
  for (let span = 0; span <= 6; span++) {
    for (let x = -span; x <= span; x++) {
      for (let y = -span; y <= span; y++) {
        const site = worldStationInCell(context, ECONOMY, flight.galaxy, { x, y });
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
    const known = new Set(flight.shots.filter((shot) => shot.enemy).map((shot) => shot.id));
    const seenBeams = new Set(activeEnemyBeams(flight).filter((beam) => beam.fired));
    model.step(SIMULATION_STEP_SECONDS, {
      ...idle,
      aim: hitAt === null ? { x: aim.x / length, y: aim.y / length } : { x: 0, y: 0 },
    });
    if (hitAt === null && integrity() < start) {
      hitAt = t;
    }
    if (
      hitAt !== null &&
      (flight.shots.some((shot) => shot.enemy && !known.has(shot.id)) ||
        activeEnemyBeams(flight).some(
          (beam) => beam.ownerId === target.id && beam.fired && !seenBeams.has(beam),
        ))
    ) {
      return { answered: t - hitAt, hit: true };
    }
  }
  return { answered: null, hit: hitAt !== null };
}

describe("arrival grace", () => {
  it("protects Ada for the full grace after a launch, through her own fire, then lets fire land", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    const start = flight.time;
    expect(arrivalGraceActive(flight)).toBe(true);
    incoming(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    // The bolt is spent on contact with no damage and no hit effect.
    expect(flight.shield).toBe(shieldMax);
    expect(flight.shots.filter((shot) => shot.enemy)).toEqual([]);
    expect(activeProjectileImpacts(flight)).toEqual([]);
    outlastGrace(model, { ...idle, aim: { x: 1, y: 0 } });
    expect(flight.time - start).toBeGreaterThanOrEqual(GRACE - 1e-9);
    expect(flight.time - start).toBeLessThan(GRACE + SIMULATION_STEP_SECONDS + 1e-9);
    incoming(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax - 1);
  });

  it("is neither saved nor given by Continue", () => {
    const model = sunflower();
    model.state.dialogue = null;
    expect(arrivalGraceActive(model.state.flight!)).toBe(true);
    const saved = model.save();
    expect(saved).not.toContain("arrivalGrace");
    const resumed = relaunch(content, saved);
    expect(resumed.state.mode).toBe("space");
    expect(arrivalGraceActive(resumed.state.flight!)).toBe(false);
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

  it("keeps scenery bumps and hazards from damaging Ada during the grace", () => {
    const flight = createFlight(content, 1, 7, { known: [] });
    flight.player = { x: 100, y: 100 };
    const debris = (id: string): SpaceObject => ({
      hp: content.tuning.flight.rockHp,
      id,
      kind: "debris",
      radius: content.tuning.flight.rockRadius,
      velocity: { x: 1, y: 0 },
      x: 100,
      y: 100,
    });
    const hazard: SpaceObject = {
      hp: 1,
      id: "hazard",
      kind: "hazard",
      radius: 1000,
      x: 100,
      y: 100,
    };
    flight.objects = [debris("grace-debris")];
    beginArrivalGrace(content, flight);
    stepFlight(content, 0.05, idle, flight);
    expect(flight.shield).toBe(shieldMax);
    flight.objects = [hazard];
    stepFlight(content, 0.05, idle, flight);
    expect(flight.shield).toBe(shieldMax);
    flight.objects = [];
    while (arrivalGraceActive(flight)) {
      stepFlight(content, SIMULATION_STEP_SECONDS, idle, flight);
    }
    delete flight.lastBump;
    flight.objects = [debris("late-debris")];
    stepFlight(content, 0.05, idle, flight);
    const bumped = flight.shield;
    expect(bumped).toBeLessThan(shieldMax);
    flight.objects = [{ ...hazard, cooldown: 0 }];
    stepFlight(content, 0.05, idle, flight);
    expect(flight.shield).toBeLessThan(bumped);
  });

  it("protects Ada after a Travel arrival at a station until the grace ends", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    outlastGrace(model);
    const site = nearestStation(flight);
    flight.player = { x: site.x + 100, y: site.y };
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(model.state.progress[1].stations).toContain(site.id);
    flight.player = { x: site.x + 6000, y: site.y };
    model.step(SIMULATION_STEP_SECONDS, idle);
    flight.dangerFor = 0;
    model.state.economy.stardust = 50;
    expect(model.teleport(site.id)).toBe(true);
    expect(flight.player).toEqual({ x: site.x, y: site.y });
    expect(arrivalGraceActive(flight)).toBe(true);
    incoming(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax);
    expect(outlastGrace(model)).toBeLessThan(GRACE);
    incoming(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax - 1);
  });
});

describe("paused protection", () => {
  it("refuses Dock in danger, then docks once Ada has broken contact", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    outlastGrace(model);
    const site = nearestStation(flight);
    flight.player = { x: site.x + 150, y: site.y };
    flight.velocity = { x: 0, y: 0 };
    model.step(SIMULATION_STEP_SECONDS, idle);
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    const enemy = frigate(1, "danger-frigate", { x: site.x + 400, y: site.y });
    enemy.enemy!.engaged = true;
    flight.objects.push(enemy);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(model.inDanger).toBe(true);
    expect(model.contextAction).toBe("dock");
    expect(model.useRefusals).toBe(0);
    model.interact();
    expect(model.state.docked).toBeNull();
    expect(model.state.notice).toBe("Unavailable while you are in danger.");
    // The scene plays each new refusal as the Use disc's refusal cue.
    expect(model.useRefusals).toBe(1);
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    flight.shots = [];
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(model.inDanger).toBe(false);
    model.interact();
    expect(model.state.docked).toBe(site.id);
    expect(model.useRefusals).toBe(1);
  });

  /**
   * Ada within Dock's Talk range of Sunflower's station with an engaged frigate pressing her, the
   * drone warning showing some way into its line.
   */
  function dronesWarning(): GameModel {
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    outlastGrace(model);
    const site = nearestStation(flight);
    flight.player = { x: site.x + 150, y: site.y };
    flight.velocity = { x: 0, y: 0 };
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    const enemy = frigate(1, "drones-frigate", { x: site.x + 400, y: site.y });
    enemy.enemy!.engaged = true;
    flight.objects.push(enemy);
    for (let step = 0; step < 200 && !model.warningShowing; step++) {
      model.step(SIMULATION_STEP_SECONDS, idle);
    }
    expect(model.warningShowing).toBe(true);
    expect(model.conversation?.key.startsWith("warning:drones:")).toBe(true);
    for (let step = 0; step < 10; step++) {
      model.step(SIMULATION_STEP_SECONDS, idle);
    }
    expect(model.inDanger).toBe(true);
    expect(model.contextAction).toBe("dock");
    return model;
  }

  it("shows a refused Dock's notice over the drone warning at once, then resumes the warning", () => {
    const model = dronesWarning();
    const warning = model.conversation!;
    model.interact();
    expect(model.state.docked).toBeNull();
    expect(model.state.notice).toBe("Unavailable while you are in danger.");
    expect(model.conversation).toBeNull();
    expect(model.warningShowing).toBe(false);
    // The warning waits under the refusal with its time held, drones still pressing.
    for (let step = 0; step < 10; step++) {
      model.step(SIMULATION_STEP_SECONDS, idle);
      expect(model.state.notice).toBe("Unavailable while you are in danger.");
      expect(model.conversation).toBeNull();
    }
    model.dismissNotice();
    expect(model.warningShowing).toBe(true);
    expect(model.conversation?.key).toBe(warning.key);
    expect(model.conversation?.elapsed).toBeCloseTo(warning.elapsed, 9);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(model.conversation?.elapsed).toBeCloseTo(warning.elapsed + SIMULATION_STEP_SECONDS, 9);
  });

  it("drops the drone warning a refusal interrupted once its drones are gone", () => {
    const model = dronesWarning();
    const flight = model.state.flight!;
    model.interact();
    expect(model.conversation).toBeNull();
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    flight.shots = [];
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(model.inDanger).toBe(false);
    model.dismissNotice();
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(model.warningShowing).toBe(false);
    expect(model.conversation?.key.startsWith("warning:drones:") ?? false).toBe(false);
  });

  it("lands no shot while docked, and undocking starts the grace before combat resumes", () => {
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    outlastGrace(model);
    const site = nearestStation(flight);
    flight.player = { x: site.x + 150, y: site.y };
    flight.velocity = { x: 0, y: 0 };
    model.step(SIMULATION_STEP_SECONDS, idle);
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    model.step(SIMULATION_STEP_SECONDS, { ...idle, use: true });
    expect(model.state.docked).toBe(site.id);
    const enemy = frigate(1, "dock-frigate", { x: site.x + 400, y: site.y });
    enemy.enemy!.engaged = true;
    flight.objects.push(enemy);
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
    expect(arrivalGraceActive(flight)).toBe(true);
    // The bolt frozen beside her while docked is spent without damage.
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBe(shieldMax);
    expect(flight.shots.some(({ id }) => id === shots[0]!.id)).toBe(false);
    outlastGrace(model);
    expect(flight.shield).toBe(shieldMax);
    incoming(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(flight.shield).toBeLessThan(shieldMax);
  });

  it("lands no shot during a conversation card, and closing it gives no grace", () => {
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
    expect(arrivalGraceActive(flight)).toBe(false);
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
      content.tuning.exclusionRadius,
    );
    const { answered, hit } = answerTime(model, leader, 8);
    expect(hit).toBe(true);
    expect(answered).not.toBeNull();
    expect(answered!).toBeLessThanOrEqual(3);
  });

  it("answers within three seconds when Ada fires on Sounder's Manta Dreadnought from beside its site", () => {
    const model = new GameModel(content, () => 173, SAVE_RESTORE);
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
    const leader = stationPopulationObjects(flight).find(
      ({ id }) => id === WHIRLPOOL_CAPITAL_BOSS.id,
    )!;
    expect(leader.enemy?.archetype).toBe("capital");
    expect(routeBlocked("holodisk", flight)).toBe(true);
    const site = model.state.progress[3].requiredSites!.holodisk!;
    const out = { x: leader.x - site.x, y: leader.y - site.y };
    const reach = Math.hypot(out.x, out.y);
    // Approach from the edge of the protected site so the leader closes into view promptly.
    const approach = content.tuning.exclusionRadius - 5;
    flight.player = {
      x: site.x + (out.x / reach) * approach,
      y: site.y + (out.y / reach) * approach,
    };
    flight.velocity = { x: 0, y: 0 };
    expect(Math.hypot(flight.player.x - site.x, flight.player.y - site.y)).toBeLessThan(
      content.tuning.exclusionRadius,
    );
    const world = flightWorldContext(flight);
    worldSyncFlightRegion(world, content, flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    // Only the actual leader can supply the fresh response after Ada lands a hit.
    for (const actor of stationPopulationObjects(flight)) {
      if (actor.kind === "enemy" && actor !== leader) {
        worldRecordObjectRemoval(world, content, actor, flight);
      }
    }
    // Ambient movers can change the leader's approach through predicted avoidance.
    // Keep the protected site and static scenery for this targeting check.
    flight.objects = flight.objects.filter(
      (actor) =>
        (actor.kind !== "enemy" || actor === leader) && !actor.id.startsWith(MOVING_ROCK_PREFIX),
    );
    flight.shots = [];
    expect(flight.objects.filter(({ kind }) => kind === "enemy")).toEqual([leader]);
    const { answered, hit } = answerTime(model, leader, 8);
    expect(hit).toBe(true);
    expect(answered).not.toBeNull();
    expect(answered!).toBeLessThanOrEqual(3);
  });

  it("answers within three seconds when Ada fires on an ambient frigate beside a station", () => {
    seedLaunches(1);
    const model = sunflower();
    const flight = model.state.flight!;
    model.state.dialogue = null;
    outlastGrace(model);
    const site = nearestStation(flight);
    flight.player = { x: site.x + 100, y: site.y };
    flight.velocity = { x: 0, y: 0 };
    model.step(SIMULATION_STEP_SECONDS, idle);
    const station = ensureStation(content, site.id, flight)!;
    expect(station).toMatchObject(site);
    // Isolate the firing lane after the real station's local chunks have loaded.
    const enemy = frigate(1, "ambient-frigate", { x: site.x + 420, y: site.y });
    flight.objects = [station, enemy];
    flight.shots = [];
    const { answered, hit } = answerTime(model, enemy, 8);
    expect(hit).toBe(true);
    expect(answered).not.toBeNull();
    expect(answered!).toBeLessThanOrEqual(3);
  });
});
