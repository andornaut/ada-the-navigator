import { afterEach, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { type IndustrialBodyKey, retaliatorVariant } from "../data/enemyIdentity.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import { relaunch } from "../testing/launch.ts";
import { ASTEROID_SHAPES, placementRadius } from "./asteroids.ts";
import { partsReach, worldParts } from "./convex.ts";
import { createEnemy, type EnemyContext, type EnemyState, stepEnemy } from "./enemyAi.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { spawnChapterEnemy, syncFlightRegion } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import * as planner from "./retaliatorNavigation.ts";

afterEach(() => vi.restoreAllMocks());
function fixture(variant: IndustrialBodyKey) {
  let id = "";
  for (let index = 0; index < 100; index++) {
    const candidate = `industrial:${index}`;
    if (retaliatorVariant({ archetype: "retaliator", id: candidate }) === variant) {
      id = candidate;
      break;
    }
  }
  expect(id).not.toBe("");
  const definition = enemyActorDefinition(1, "retaliator", id, 1);
  const state = createEnemy(
    definition,
    { archetype: "retaliator", id, packId: null, phase: 0.4, weaponLevel: 1 },
    { x: 0, y: 0 },
  );
  const shape = [...ASTEROID_SHAPES.values()][0]!;
  const rock = {
    asteroid: shape.id,
    hp: 1,
    id: "actual-rock",
    kind: "rock" as const,
    radius: shape.radius,
    x: 1000,
    y: 0,
  };
  const context: EnemyContext = {
    adaWidth: CONTENT.tuning.flight.shipRadius * 2,
    dt: SIMULATION_STEP_SECONDS,
    initialPackSizes: {},
    lead: 1,
    peers: [state],
    player: { x: 300, y: 0 },
    playerVelocity: { x: 0, y: 0 },
    retaliatorNavigation: {
      asteroids: [
        { id: rock.id, physicalReach: placementRadius(rock), position: { x: rock.x, y: rock.y } },
      ],
      physicalReach: partsReach(worldParts(enemyPhysicalBody(ROUTE_POSITION[1], state)!)),
    },
    targetable: true,
    visibility: "visible",
  };
  return { context, definition, state };
}
function advance(value: ReturnType<typeof fixture>, state: EnemyState, industrial: boolean) {
  const context = { ...value.context, peers: [state] };
  if (!industrial) {
    delete context.retaliatorNavigation;
  }
  const intent = stepEnemy(value.definition, context, state);
  expect(intent.fire).toEqual([]);
  return {
    ...intent.state,
    position: {
      x: state.position.x + intent.velocity.x * context.dt,
      y: state.position.y + intent.velocity.y * context.dt,
    },
  };
}
it.each(["retaliatorCargoHauler", "retaliatorMiningFreighter"] as const)(
  "uses %s idle input through the existing seeded ellipse and resumes its exact future",
  (variant) => {
    const value = fixture(variant);
    const plan = vi.spyOn(planner, "retaliatorNavigation");
    let state = structuredClone(value.state);
    let legacy = structuredClone(value.state);
    for (let step = 0; step < 90; step++) {
      state = advance(value, state, true);
      legacy = advance(value, legacy, false);
    }
    expect(plan).toHaveBeenCalledTimes(90);
    expect(state.position).not.toEqual(legacy.position);
    expect(state.engaged).toBe(false);
    expect(state.home).toEqual(value.state.home);
    expect(state.hp).toBe(value.state.hp);
    let resumed = JSON.parse(JSON.stringify(state)) as EnemyState;
    for (let step = 0; step < 30; step++) {
      state = advance(value, state, true);
      resumed = advance(value, resumed, true);
      expect(resumed).toEqual(state);
    }
  },
);
it.each(["engaged", "occluded", "returning", "retreat", "investigation"] as const)(
  "leaves the complete %s intent unchanged and never calls the idle planner",
  (mode) => {
    const value = fixture("retaliatorMiningFreighter");
    value.state.age = 3;
    value.state.lastSeen = { x: 300, y: 0 };
    if (mode === "engaged" || mode === "occluded") {
      value.state.engaged = true;
    }
    if (mode !== "engaged") {
      value.context.visibility = "occluded";
    }
    if (mode === "returning") {
      value.state.returning = true;
    }
    if (mode === "retreat" || mode === "investigation") {
      value.state.retreat = {
        away: { x: -1, y: 0 },
        kind: "morale",
        origin: { x: 0, y: 0 },
        startedAt: 2,
        ...(mode === "investigation" ? { endedAt: 2.5 } : {}),
      };
    }
    const legacy = { ...value.context };
    delete legacy.retaliatorNavigation;
    const plan = vi.spyOn(planner, "retaliatorNavigation");
    expect(stepEnemy(value.definition, value.context, value.state)).toEqual(
      stepEnemy(value.definition, legacy, value.state),
    );
    expect(plan).not.toHaveBeenCalled();
  },
);
it.each(["retaliatorCargoHauler", "retaliatorMiningFreighter"] as const)(
  "preserves actual %s caller identity and clocks through save and paging",
  (variant) => {
    const value = fixture(variant);
    const model = new GameModel(CONTENT);
    model.state.prologueSeen = true;
    model.state.progress[1].opened = true;
    model.state.seenConversations.push(...CONVERSATIONS.map((c) => c.id));
    model.startGalaxy(1);
    model.state.dialogue = null;
    const flight = model.state.flight!;
    const point = { x: 30000, y: 5000 };
    flight.player = { ...point };
    const actor = spawnChapterEnemy(
      CONTENT,
      "retaliator",
      value.state.id,
      { x: point.x + 400, y: point.y },
      flight,
    )!;
    expect(actor).toBeDefined();
    const home = { ...actor.enemy!.home };
    syncFlightRegion(CONTENT, flight);
    const plan = vi.spyOn(planner, "retaliatorNavigation");
    const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
    model.step(SIMULATION_STEP_SECONDS, idle);
    expect(plan).toHaveBeenCalled();
    expect(actor.enemy!.engaged).toBe(false);
    if (variant === "retaliatorMiningFreighter") {
      expect(plan.mock.calls.some(([context]) => context.asteroids.length > 0)).toBe(true);
    }
    for (const [context] of plan.mock.calls) {
      for (const asteroid of context.asteroids) {
        const actual = flight.objects.find((o) => o.id === asteroid.id)!;
        expect(["rock", "resource"]).toContain(actual.kind);
        expect(asteroid.position).toEqual({ x: actual.x, y: actual.y });
        expect(asteroid.physicalReach).toBe(placementRadius(actual));
      }
    }
    const saved = model.save();
    const resumed = relaunch(CONTENT, saved);
    expect(resumed.state.flight).toEqual(flight);
    model.step(SIMULATION_STEP_SECONDS, idle);
    resumed.step(SIMULATION_STEP_SECONDS, idle);
    expect(resumed.state.flight).toEqual(flight);
    const before = structuredClone(
      stationPopulationObjects(flight).find((o) => o.id === actor.id)!,
    );
    flight.player = { x: -30000, y: -5000 };
    syncFlightRegion(CONTENT, flight);
    expect(flight.world.notables[actor.id]).toEqual(before);
    flight.player = { ...point };
    syncFlightRegion(CONTENT, flight);
    expect(stationPopulationObjects(flight).find((o) => o.id === actor.id)?.enemy?.home).toEqual(
      home,
    );
  },
);
