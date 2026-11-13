import { expect, it } from "vitest";

import { ENEMY_RETREAT, type EnemyArchetype, enemyCatalog } from "../data/enemyCatalog.ts";
import { createEnemy, type EnemyContext, type EnemyState, stepEnemy } from "./enemyAi.ts";

const dt = 1 / 60;
const spawn = (archetype: EnemyArchetype): EnemyState => ({
  ...createEnemy(
    enemyCatalog[archetype],
    { archetype, id: "bounded-retreat", packId: null, phase: 0.7 },
    { x: 0, y: 0 },
  ),
  engaged: true,
});
const context = (state: EnemyState): EnemyContext => ({
  adaWidth: 20,
  dt,
  engagementAdmitted: true,
  initialPackSizes: {},
  lead: 1,
  peers: [state],
  player: { x: 300, y: 0 },
  playerVelocity: { x: 0, y: 0 },
  targetable: true,
  visibility: "visible",
});
const step = (state: EnemyState, observation = context(state)) =>
  stepEnemy(enemyCatalog[state.archetype], observation, state);

it("ends a blocked tactical retreat at the time limit without needing to pass the firing band", () => {
  let state = spawn("fighter");
  state.tactic.volleys = 3;
  state = step(state).state;
  expect(state.retreat?.kind).toBe("hitAndRun");
  let elapsed = 0;
  while (state.retreat?.endedAt === undefined && elapsed < 2) {
    state = { ...step(state).state, velocity: { x: 0, y: 0 } };
    elapsed += dt;
  }
  expect(elapsed).toBeLessThanOrEqual(ENEMY_RETREAT.seconds + dt);
  expect(state.position).toEqual({ x: 0, y: 0 });
  expect(state.retreat?.endedAt).toBeDefined();
  expect(state.tactic.phase).toBe("attack");
});

it.each(["swarm", "fighter", "interceptor", "retaliator"] as const)(
  "lets %s recover from generic morale retreat and fight without instantly fleeing again",
  (archetype) => {
    let state = spawn(archetype);
    state.hp = (enemyCatalog[archetype].hp * enemyCatalog[archetype].morale.individualHpRatio) / 2;
    state = step(state).state;
    expect(state.fleeing).toBe(true);
    for (let frame = 0; frame < 100; frame++) {
      state = step(state).state;
    }
    expect(state.retreat?.endedAt).toBeDefined();
    expect(state).toMatchObject({ engaged: true, fleeing: false, returning: false });
    const ended = state.retreat!.endedAt!;
    while (state.age - ended < ENEMY_RETREAT.cooldownSeconds - dt) {
      state = step(state).state;
      expect(state.fleeing).toBe(false);
      expect(state.retreat?.endedAt).toBe(ended);
    }
  },
);

it("ends retreat at the displacement bound and preserves the same cooldown as timeout", () => {
  let state = spawn("fighter");
  state.hp = 1;
  state = step(state).state;
  state.position = { x: state.retreat!.origin.x + ENEMY_RETREAT.distance + 1, y: 0 };
  const result = step(state).state;
  expect(result.retreat?.endedAt).toBe(result.age);
  expect(result.fleeing).toBe(false);
  expect(step(result).state.retreat?.endedAt).toBe(result.retreat?.endedAt);
});

it("investigates only fixed last-seen knowledge after hidden retreat, then returns home", () => {
  let state = spawn("fighter");
  state.hp = 1;
  state = step(state).state;
  const known = { ...state.lastSeen! };
  const hidden = {
    ...context(state),
    get player(): { x: number; y: number } {
      throw Error("Hidden target must not be read");
    },
    visibility: "occluded" as const,
  };
  for (let frame = 0; frame < 110; frame++) {
    const result = step(state, hidden);
    expect(result.fire).toEqual([]);
    state = result.state;
  }
  expect(state).toMatchObject({ engaged: false, fleeing: false, returning: false });
  expect(state.lastSeen).toEqual(known);
  expect(Math.hypot(state.velocity.x, state.velocity.y)).toBeGreaterThan(0);
  for (let frame = 0; frame < 300; frame++) {
    state = step(state, hidden).state;
  }
  expect(state.returning).toBe(true);
  expect(state.lastSeen).toEqual(known);
});

it("requires admission, perception and the home leash before recovery can reengage", () => {
  let state = spawn("retaliator");
  state.hp = 1;
  state = step(state).state;
  const denied = { ...context(state), engagementAdmitted: false };
  for (let frame = 0; frame < 110; frame++) {
    state = step(state, denied).state;
  }
  expect(state.engaged).toBe(false);
  expect(
    step(state, { ...denied, engagementAdmitted: true, player: { x: 1000, y: 0 } }).state.engaged,
  ).toBe(false);
  expect(step(state).state.engaged).toBe(true);
  const outside = { ...state, position: { x: 1990, y: 0 } };
  const leashed = step(outside, { ...context(outside), player: { x: 2100, y: 0 } }).state;
  expect(leashed).toMatchObject({ engaged: false, returning: true });
});

it("uses one smooth seeded bend independent of visible target changes and resumes exactly", () => {
  let state = spawn("fighter");
  state.hp = 1;
  state = step(state).state;
  const initialAway = { ...state.retreat!.away };
  let resumed = JSON.parse(JSON.stringify(state)) as EnemyState;
  for (let frame = 0; frame < 60; frame++) {
    const result = step(state);
    const other = step(resumed, { ...context(resumed), player: { x: -300, y: 150 } });
    expect(result.velocity).toEqual(other.velocity);
    expect(result.state.retreat).toEqual(other.state.retreat);
    const before = state.heading;
    state = result.state;
    resumed = other.state;
    if (before && state.heading) {
      expect(before.x * state.heading.x + before.y * state.heading.y).toBeGreaterThan(0.95);
    }
    expect(Math.hypot(state.velocity.x, state.velocity.y)).toBeLessThanOrEqual(
      enemyCatalog.fighter.physics.maxSpeed,
    );
  }
  expect(state.retreat!.away).toEqual(initialAway);
  const copy = JSON.parse(JSON.stringify(state)) as EnemyState;
  expect(step(copy)).toEqual(step(state));
});

it("enforces tactical cooldown even when hits and completed volleys still request retreat", () => {
  let state = spawn("fighter");
  state.tactic.volleys = 3;
  state = step(state).state;
  for (let frame = 0; frame < 100; frame++) {
    state = step(state).state;
  }
  const ended = state.retreat!.endedAt!;
  state.tactic.volleys = 3;
  state.age = ended + ENEMY_RETREAT.cooldownSeconds - 0.1;
  expect(step(state).state.retreat?.endedAt).toBe(ended);
  state.age = ended + ENEMY_RETREAT.cooldownSeconds;
  const restarted = step(state).state;
  expect(restarted.retreat?.endedAt).toBeUndefined();
  expect(restarted.retreat?.startedAt).toBeGreaterThan(ended);
});

it("does not restart morale withdrawal while waiting for engagement admission", () => {
  let state = spawn("retaliator");
  state.hp = 1;
  state = step(state).state;
  const denied = { ...context(state), engagementAdmitted: false };
  for (let frame = 0; frame < 110; frame++) {
    state = step(state, denied).state;
  }
  const ended = state.retreat!.endedAt!;
  for (let frame = 0; frame < 500; frame++) {
    state = step(state, denied).state;
  }
  expect(state).toMatchObject({ engaged: false, fleeing: false });
  expect(state.retreat!.endedAt).toBe(ended);
});

it("honors an archetype's per-behavior policy override without changing the shared default", () => {
  const definition = {
    ...enemyCatalog.fighter,
    retreats: { ...enemyCatalog.fighter.retreats, hitAndRun: { ...ENEMY_RETREAT, seconds: 0.2 } },
  };
  let state = spawn("fighter");
  state.tactic.volleys = 3;
  for (let frame = 0; frame < 16; frame++) {
    state = stepEnemy(definition, context(state), state).state;
  }
  expect(state.retreat?.endedAt).toBeDefined();
  expect(ENEMY_RETREAT.seconds).toBe(1.6);
});
