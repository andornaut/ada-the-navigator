import { expect, it } from "vitest";

import { ENEMY_NAVIGATION, type EnemyArchetype, enemyCatalog } from "../data/enemyCatalog.ts";
import { createEnemy, type EnemyContext, type EnemyState, stepEnemy } from "./enemyAi.ts";

const dt = 1 / 60;
const speed = (state: EnemyState) => Math.hypot(state.velocity.x, state.velocity.y);
const spawn = (archetype: EnemyArchetype, id = "patrol:17") =>
  createEnemy(enemyCatalog[archetype], { archetype, id, packId: null, phase: 0.7 }, { x: 0, y: 0 });
const context = (state: EnemyState): EnemyContext => ({
  adaWidth: 20,
  dt,
  engagementAdmitted: false,
  initialPackSizes: {},
  lead: 1,
  peers: [state],
  player: { x: 300, y: 0 },
  playerVelocity: { x: 0, y: 0 },
  targetable: true,
  visibility: "occluded",
});
function advance(state: EnemyState, observation = context(state)): EnemyState {
  const intent = stepEnemy(enemyCatalog[state.archetype], observation, state);
  expect(intent.fire).toEqual([]);
  return {
    ...intent.state,
    position: {
      x: state.position.x + intent.velocity.x * observation.dt,
      y: state.position.y + intent.velocity.y * observation.dt,
    },
  };
}

it.each(["swarm", "interceptor"] as const)(
  "slows %s investigation after actual LOS loss without learning hidden coordinates",
  (archetype) => {
    const initial = spawn(archetype);
    const maximum = enemyCatalog[archetype].physics.maxSpeed;
    const state = {
      ...initial,
      engaged: true,
      facing: { x: 1, y: 0 },
      heading: { x: 1, y: 0 },
      lastSeen: { x: 2000, y: 0 },
      velocity: { x: maximum, y: 0 },
    };
    const unseen = { ...context(state), dt: 5 };
    const result = stepEnemy(enemyCatalog[archetype], unseen, state);
    const otherHiddenPosition = stepEnemy(
      enemyCatalog[archetype],
      { ...unseen, player: { x: -10000, y: 8000 } },
      state,
    );
    expect(result).toEqual(otherHiddenPosition);
    expect(result.state.lastSeen).toEqual(state.lastSeen);
    expect(result.state.lastSeenAge).toBe(5);
    expect(speed(result.state)).toBeGreaterThan(maximum * 0.69);
    expect(speed(result.state)).toBeLessThan(maximum * 0.705);
    expect(result.fire).toEqual([]);
  },
);

it.each(["swarm", "fighter", "interceptor", "retaliator", "frigate", "capital"] as const)(
  "keeps %s patrolling smoothly at half its combat speed",
  (archetype) => {
    let state = spawn(archetype);
    const definition = enemyCatalog[archetype];
    const combatSpeed =
      definition.physics.maxSpeed *
      (definition.behaviour.kind === "siege" ? definition.behaviour.speedFraction : 1);
    let maximumStepAngle = 0;
    for (let step = 0; step < 1800; step++) {
      const next = advance(state);
      expect(speed(next)).toBeLessThanOrEqual(definition.physics.maxSpeed);
      expect(next.engaged).toBe(false);
      expect(Math.hypot(next.position.x, next.position.y)).toBeLessThan(
        2 * ENEMY_NAVIGATION.patrolRadius[1] + ENEMY_NAVIGATION.approachRadius,
      );
      if (state.heading && next.heading) {
        maximumStepAngle = Math.max(
          maximumStepAngle,
          Math.acos(
            Math.min(
              1,
              Math.max(-1, state.heading.x * next.heading.x + state.heading.y * next.heading.y),
            ),
          ),
        );
      }
      state = next;
    }
    expect(speed(state)).toBeLessThanOrEqual(combatSpeed * 0.5);
    expect(speed(state)).toBeGreaterThan(combatSpeed * 0.4);
    expect(maximumStepAngle).toBeLessThan(0.08);
    expect(Math.hypot(state.position.x, state.position.y)).toBeGreaterThan(10);
  },
);

it("transitions from investigating the last-seen point into a moving patrol and finite return", () => {
  let state: EnemyState = { ...spawn("swarm"), engaged: true, lastSeen: { x: 20, y: 0 } };
  let returned = false;
  for (let step = 0; step < 900; step++) {
    state = advance(state);
    returned ||= state.returning;
    expect(state.lastSeen).toEqual({ x: 20, y: 0 });
    if (step > 60) {
      expect(speed(state)).toBeGreaterThan(20);
    }
  }
  expect(returned).toBe(true);
  expect(state.engaged).toBe(false);
  expect(Math.hypot(state.position.x, state.position.y)).toBeLessThan(480);
});

it("produces varied deterministic routes and exact JSON-resumed futures without new saved fields", () => {
  let original = spawn("interceptor", "patrol:1");
  let other = spawn("interceptor", "patrol:2");
  const keys = Object.keys(original).sort();
  for (let step = 0; step < 120; step++) {
    original = advance(original);
    other = advance(other);
  }
  let resumed = JSON.parse(JSON.stringify(original)) as EnemyState;
  for (let step = 0; step < 120; step++) {
    original = advance(original);
    resumed = advance(resumed);
    other = advance(other);
  }
  expect(resumed).toEqual(original);
  expect(original.position).not.toEqual(other.position);
  expect(Object.keys(original).sort()).toEqual(keys);
});

it("keeps the platform and disabled mobile ships stationary", () => {
  for (const state of [spawn("platform"), { ...spawn("frigate"), disabled: true }]) {
    const next = advance(state);
    expect(next.position).toEqual(state.position);
    expect(next.velocity).toEqual({ x: 0, y: 0 });
  }
});

it.each(["swarm", "fighter", "interceptor", "retaliator", "frigate", "capital"] as const)(
  "requests the exact shared speed ratios for %s on a straight approach",
  (archetype) => {
    const definition = enemyCatalog[archetype];
    const combatSpeed =
      definition.physics.maxSpeed *
      (definition.behaviour.kind === "siege" ? definition.behaviour.speedFraction : 1);
    const state = {
      ...spawn(archetype),
      facing: { x: 1, y: 0 },
      heading: { x: 1, y: 0 },
      home: { x: 5000, y: 0 },
    };
    const observation = { ...context(state), dt: 1 };
    const patrol = stepEnemy(definition, observation, state);
    const expectedPatrol =
      combatSpeed * 0.5 * (1 - Math.exp(-observation.dt / definition.physics.accelerationSeconds));
    expect(speed(patrol.state)).toBeCloseTo(expectedPatrol, 9);
    const investigating = { ...state, engaged: true, lastSeen: { x: 5000, y: 0 } };
    const search = stepEnemy(definition, observation, investigating);
    expect(speed(search.state)).toBeCloseTo(
      combatSpeed * 0.7 * (1 - Math.exp(-observation.dt / definition.physics.accelerationSeconds)),
      9,
    );
  },
);
