import { describe, expect, it } from "vitest";

import { type EnemyArchetype, enemyCatalog } from "../data/enemyCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { createEnemy, type EnemyContext, type EnemyState, stepEnemy } from "./enemyAi.ts";
import { wrapPoint } from "./worldGeometry.ts";

const half = GALAXY_SIDE / 2;
const spawn = (archetype: EnemyArchetype, x = half - 40, y = half - 20): EnemyState => ({
  ...createEnemy(
    enemyCatalog[archetype],
    { archetype, id: "same-enemy", packId: null, phase: 0.4 },
    { x, y },
  ),
  engaged: true,
});
const observation = (state: EnemyState): EnemyContext => ({
  adaWidth: 20,
  dt: 1 / 60,
  engagementAdmitted: true,
  initialPackSizes: {},
  lead: 1,
  peers: [state],
  player: { x: -half + 60, y: -half + 30 },
  playerVelocity: { x: 17, y: -4 },
  targetable: true,
  visibility: "visible",
  worldSide: GALAXY_SIDE,
});
const legacy = (context: EnemyContext): EnemyContext => {
  const copy = { ...context };
  delete copy.worldSide;
  return copy;
};
const closeVector = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 8);
  expect(a.y).toBeCloseTo(b.y, 8);
};

describe("explicit torus enemy perception and steering", () => {
  it.each(Object.keys(enemyCatalog) as EnemyArchetype[])(
    "keeps %s ranges, motion and weapon lead equivalent to the same nearby target",
    (archetype) => {
      const state = spawn(archetype);
      const context = observation(state);
      const near = {
        ...context,
        player: { x: state.position.x + 100, y: state.position.y + 50 },
      };
      const actual = stepEnemy(enemyCatalog[archetype], context, state);
      const expected = stepEnemy(enemyCatalog[archetype], near, state);
      closeVector(actual.velocity, expected.velocity);
      closeVector(actual.aim, expected.aim);
      expect(actual.state.engaged).toBe(expected.state.engaged);
      expect(actual.state.returning).toBe(false);
      expect(actual.fire).toHaveLength(expected.fire.length);
      for (const [index, shot] of actual.fire.entries()) {
        closeVector(shot.aim, expected.fire[index]!.aim);
        expect(shot.origin).toEqual(expected.fire[index]!.origin);
        expect(shot.damageRatio).toBe(expected.fire[index]!.damageRatio);
      }
      expect(actual.state.lastSeen).toEqual(context.player);
      expect(wrapPoint(GALAXY_SIDE, expected.state.lastSeen!)).toEqual(actual.state.lastSeen);
    },
  );

  it("leaves old flights Euclidean even at coordinates matching a torus seam", () => {
    const state = spawn("fighter");
    const result = stepEnemy(enemyCatalog.fighter, legacy(observation(state)), state);
    expect(result.fire).toHaveLength(0);
    expect(result.state.returning).toBe(true);
  });

  it("separates nearby peer images without changing the supplied entities", () => {
    const state = spawn("fighter", half - 10, 0);
    const peer = { ...spawn("fighter", -half + 10, 0), id: "peer" };
    const context = {
      ...observation(state),
      peers: [state, peer],
      player: { x: -half + 200, y: 0 },
    };
    const before = structuredClone(peer);
    const result = stepEnemy(enemyCatalog.fighter, context, state);
    const near = stepEnemy(
      enemyCatalog.fighter,
      {
        ...legacy(context),
        peers: [state, { ...peer, position: { x: half + 10, y: 0 } }],
        player: { x: half + 200, y: 0 },
      },
      state,
    );
    closeVector(result.velocity, near.velocity);
    expect(peer).toEqual(before);
    expect(context.peers).toHaveLength(2);
  });

  it("measures an escort's intercept range across the capital's seam", () => {
    const state = { ...spawn("fighter", half - 100, 0), escortOf: "capital" };
    const capital = { ...spawn("capital", -half + 20, 0), id: "capital" };
    const context = {
      ...observation(state),
      peers: [state, capital],
      player: { x: -half + 60, y: 0 },
    };
    const actual = stepEnemy(enemyCatalog.fighter, context, state);
    const nearby = stepEnemy(
      enemyCatalog.fighter,
      {
        ...legacy(context),
        peers: [state, { ...capital, position: { x: half + 20, y: 0 } }],
        player: { x: half + 60, y: 0 },
      },
      state,
    );
    closeVector(actual.velocity, nearby.velocity);
    expect(actual.state.escortOf).toBe("capital");
  });

  it("returns to the nearest home and preserves its canonical stored anchor", () => {
    const state = {
      ...spawn("fighter", half - 40, 0),
      engaged: false,
      home: { x: -half + 40, y: 0 },
      returning: true,
    };
    const context = { ...observation(state), targetable: false };
    const actual = stepEnemy(enemyCatalog.fighter, context, state);
    const near = stepEnemy(enemyCatalog.fighter, legacy(context), {
      ...state,
      home: { x: half + 40, y: 0 },
    });
    closeVector(actual.velocity, near.velocity);
    expect(actual.state.home).toEqual(state.home);
  });

  it("measures a retreat's real seam displacement rather than a whole-world jump", () => {
    const state: EnemyState = {
      ...spawn("fighter", -half + 50, 0),
      age: 0.5,
      fleeing: true,
      home: { x: half - 100, y: 0 },
      retreat: {
        away: { x: 1, y: 0 },
        kind: "morale",
        origin: { x: half - 100, y: 0 },
        startedAt: 0,
      },
    };
    const context = { ...observation(state), player: { x: half - 50, y: 0 } };
    const active = stepEnemy(enemyCatalog.fighter, context, state).state;
    expect(active.retreat?.endedAt).toBeUndefined();
    expect(active.fleeing).toBe(true);
    const ended = stepEnemy(enemyCatalog.fighter, context, {
      ...state,
      position: { x: -half + 150, y: 0 },
    }).state;
    expect(ended.retreat?.endedAt).toBeDefined();
  });

  it("uses only the saved last-seen image when the player is occluded", () => {
    const state = { ...spawn("fighter"), lastSeen: { x: -half + 60, y: -half + 30 } };
    const context: EnemyContext = {
      ...observation(state),
      get player(): EnemyState["position"] {
        throw Error("Hidden player must not be read");
      },
      visibility: "occluded",
    };
    const actual = stepEnemy(enemyCatalog.fighter, context, state);
    const expected = stepEnemy(
      enemyCatalog.fighter,
      { ...legacy(observation(state)), visibility: "occluded" },
      { ...state, lastSeen: { x: state.position.x + 100, y: state.position.y + 50 } },
    );
    closeVector(actual.velocity, expected.velocity);
    expect(actual.state.lastSeen).toEqual(state.lastSeen);
    expect(actual.fire).toHaveLength(0);
  });
});
