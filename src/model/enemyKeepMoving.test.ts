import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { type EnemyArchetype, enemyCatalog, type EnemyDefinition } from "../data/enemyCatalog.ts";
import { retaliatorVariant } from "../data/enemyIdentity.ts";
import { ENEMY_KEEP_MOVING } from "../data/enemyNavigation.ts";
import { spacingRadius } from "../data/enemySpacing.ts";
import {
  edgeCourse,
  minerDwell,
  minerNeedsPick,
  outlineEdge,
  pickMinerRock,
} from "./ai/edgeTrace.ts";
import { steerAroundObstacles } from "./ai/obstacleNavigation.ts";
import { packSlot } from "./ai/packRoute.ts";
import { ASTEROID_SHAPES, scenerySilhouette } from "./asteroids.ts";
import { worldParts } from "./convex.ts";
import { createEnemy, type EnemyContext, type EnemyState, stepEnemy } from "./enemyAi.ts";
import type { SpaceObject, Vec } from "./types.ts";

const dt = 1 / 60;
const floor = ENEMY_KEEP_MOVING.minimumShare;

const spawn = (
  archetype: EnemyArchetype,
  id: string,
  position: Vec,
  patch: Partial<EnemyState> = {},
): EnemyState => ({
  ...createEnemy(enemyCatalog[archetype], { archetype, id, packId: null, phase: 0.4 }, position),
  ...patch,
});
const observation = (peers: readonly EnemyState[], patch: Partial<EnemyContext> = {}) =>
  ({
    adaWidth: CONTENT.tuning.flight.shipRadius * 2,
    dt,
    inPlayView: true,
    initialPackSizes: {},
    lead: 1,
    peers,
    player: { x: 9000, y: 9000 },
    playerVelocity: { x: 0, y: 0 },
    routePosition: 1,
    targetable: true,
    visibility: "visible",
    ...patch,
  }) satisfies EnemyContext;
const speed = (state: EnemyState) => Math.hypot(state.velocity.x, state.velocity.y);
const advance = (state: EnemyState): EnemyState => ({
  ...state,
  position: {
    x: state.position.x + state.velocity.x * dt,
    y: state.position.y + state.velocity.y * dt,
  },
});
const gap = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Steps `state` for `seconds` in a context built from it and returns its slowest speed as a share
 * of top speed after `settle` seconds, with the final state.
 */
function slowest(
  definition: EnemyDefinition,
  context: (state: EnemyState) => EnemyContext,
  seconds: number,
  settle: number,
  state: EnemyState,
): { share: number; state: EnemyState } {
  let share = Infinity;
  let current = state;
  for (let step = 0; step * dt < seconds; step++) {
    current = advance(stepEnemy(definition, context(current), current).state);
    if (step * dt >= settle) {
      share = Math.min(share, speed(current) / definition.physics.maxSpeed);
    }
  }
  return { share, state: current };
}

/** Steps every ship of `fleet` together against the same pre-movement peers. */
function flyTogether(
  definition: (state: EnemyState) => EnemyDefinition,
  context: (peers: readonly EnemyState[]) => EnemyContext,
  seconds: number,
  each: (fleet: readonly EnemyState[], time: number) => void,
  fleet: readonly EnemyState[],
): EnemyState[] {
  let current = [...fleet];
  for (let step = 0; step * dt < seconds; step++) {
    const before = current;
    current = before.map((ship) =>
      advance(stepEnemy(definition(ship), context(before), ship).state),
    );
    each(current, step * dt);
  }
  return current;
}

describe("every movable enemy keeps moving", () => {
  it("keeps a ship whose request falls under the floor at a quarter of its current top speed", () => {
    // An engineless share or a song lowers the top speed; the floor follows it.
    const ship = spawn("fighter", "floor", { x: 0, y: 0 }, { returning: true });
    const slowed = {
      ...enemyCatalog.fighter,
      physics: { ...enemyCatalog.fighter.physics, maxSpeed: 80 },
    };
    const run = slowest(
      slowed,
      (state) => observation([state], { visibility: "unknown" }),
      10,
      2,
      ship,
    );
    expect(run.share).toBeGreaterThanOrEqual(floor);
  });

  it("keeps a returning ship moving once it reaches home", () => {
    const ship = spawn("fighter", "home", { x: 0, y: 0 }, { returning: true });
    const run = slowest(
      enemyCatalog.fighter,
      (state) => observation([state], { visibility: "unknown" }),
      20,
      2,
      ship,
    );
    expect(run.share).toBeGreaterThanOrEqual(floor);
  });

  it("keeps an engaged ship moving while it waits for line of sight", () => {
    const ship = spawn(
      "fighter",
      "unseen",
      { x: 0, y: 0 },
      {
        engaged: true,
        lastSeen: { x: 0, y: 0 },
      },
    );
    const run = slowest(
      enemyCatalog.fighter,
      (state) => observation([state], { visibility: "occluded" }),
      7,
      1,
      ship,
    );
    expect(run.state.engaged).toBe(true);
    expect(run.share).toBeGreaterThanOrEqual(floor);
  });

  it("strafes a band hold along the band", () => {
    const ship = spawn("fighter", "band", { x: 0, y: 0 }, { engaged: true });
    const run = slowest(
      enemyCatalog.fighter,
      (state) => observation([state], { player: { x: 300, y: 0 } }),
      10,
      1,
      ship,
    );
    expect(run.share).toBeGreaterThanOrEqual(floor);
  });

  it("circles a leader's escorts on its station ring at equal angles", () => {
    const leader = spawn("capital", "leader", { x: 0, y: 0 });
    const ring = spacingRadius(1, leader) + 60;
    const escorts = [0, Math.PI].map((phase, index) =>
      spawn(
        "fighter",
        `escort:${index}`,
        { x: Math.cos(phase) * ring, y: Math.sin(phase) * ring },
        {
          engaged: true,
          escortOf: "leader",
          phase,
        },
      ),
    );
    let share = Infinity;
    let total = 0;
    let samples = 0;
    let spread = 0;
    let turned = 0;
    const start = Math.atan2(escorts[0]!.position.y, escorts[0]!.position.x);
    // The leader holds its place here, so the escorts' speed relative to it is their speed.
    flyTogether(
      () => enemyCatalog.fighter,
      // Its clock runs with theirs, which turns the ring.
      (peers) =>
        observation([{ ...leader, age: peers[0]!.age }, ...peers], { player: { x: -1500, y: 0 } }),
      12,
      (fleet, time) => {
        const lead = leader;
        const [a, b] = fleet;
        if (time < 3) {
          return;
        }
        share = Math.min(share, speed(a!) / 160, speed(b!) / 160);
        total += (speed(a!) + speed(b!)) / 320;
        samples++;
        const angle = (ship: EnemyState) =>
          Math.atan2(ship.position.y - lead!.position.y, ship.position.x - lead!.position.x);
        const apart = Math.abs(
          Math.atan2(Math.sin(angle(a!) - angle(b!)), Math.cos(angle(a!) - angle(b!))),
        );
        spread = Math.max(spread, Math.abs(apart - Math.PI));
        turned = Math.abs(Math.atan2(Math.sin(angle(a!) - start), Math.cos(angle(a!) - start)));
      },
      escorts,
    );
    // Velocity blends along the chord as the station turns, so it dips a little below the floor.
    expect(total / samples).toBeGreaterThanOrEqual(floor * 0.9);
    expect(share).toBeGreaterThan(floor * 0.5);
    expect(spread).toBeLessThan(0.2);
    expect(turned).toBeGreaterThan(0.5);
  });

  it("circles a turret heavy holding on Ada at twice its spacing radius", () => {
    const ship = spawn("frigate", "turret", { x: 0, y: 0 }, { engaged: true });
    const ada = { x: 100, y: 0 };
    const hold = ENEMY_KEEP_MOVING.turretHoldRadii * spacingRadius(1, ship);
    let far = 0;
    let near = Infinity;
    const run = slowest(
      enemyCatalog.frigate,
      (state) => {
        if (state.age > 15) {
          far = Math.max(far, gap(state.position, ada));
          near = Math.min(near, gap(state.position, ada));
        }
        return observation([state], { player: ada });
      },
      30,
      5,
      ship,
    );
    expect(run.share).toBeGreaterThanOrEqual(floor * 0.95);
    expect(near).toBeGreaterThan(hold * 0.6);
    expect(far).toBeLessThan(hold * 1.6);
  });

  it("keeps an idle siege heavy patrolling at the floor, dipping only through its turns", () => {
    let state = spawn("frigate", "idle-frigate", { x: 0, y: 0 });
    let total = 0;
    let least = Infinity;
    let samples = 0;
    for (let step = 0; step * dt < 30; step++) {
      state = advance(stepEnemy(enemyCatalog.frigate, observation([state]), state).state);
      if (step * dt >= 5) {
        const share = speed(state) / enemyCatalog.frigate.physics.maxSpeed;
        total += share;
        least = Math.min(least, share);
        samples++;
      }
    }
    // Velocity blends along the chord of a turn, so a sharp turn dips below the requested floor.
    expect(total / samples).toBeGreaterThanOrEqual(floor * 0.9);
    expect(least).toBeGreaterThan(floor * 0.5);
  });

  it("flies an idle pack on one shared route, in order and spaced apart", () => {
    const run = () => {
      const pack = [
        spawn("fighter", "pack:a", { x: 0, y: 0 }, { packId: "pack" }),
        spawn("fighter", "pack:b", { x: 20, y: 0 }, { packId: "pack", phase: 2.1 }),
        spawn("fighter", "pack:c", { x: 0, y: 20 }, { packId: "pack", phase: 4.2 }),
      ];
      let closest = Infinity;
      let share = Infinity;
      const final = flyTogether(
        () => enemyCatalog.fighter,
        (peers) => observation(peers, { initialPackSizes: { pack: 3 }, packSpacing: 120 }),
        60,
        (fleet, time) => {
          if (time < 15) {
            return;
          }
          for (const [index, member] of fleet.entries()) {
            share = Math.min(share, speed(member) / enemyCatalog.fighter.physics.maxSpeed);
            for (const other of fleet.slice(index + 1)) {
              closest = Math.min(closest, gap(member.position, other.position));
            }
          }
        },
        pack,
      );
      return { closest, final, share };
    };
    const first = run();
    expect(first.share).toBeGreaterThanOrEqual(floor);
    // Spaced 120 along the route, never side by side.
    expect(first.closest).toBeGreaterThan(60);
    // Pure and seeded: the same start gives the same flight.
    expect(run().final).toEqual(first.final);
  });

  it("places pack members the pair spacing apart and grows a short route to fit", () => {
    const navigation = { ellipseRatio: [1, 1] as const, patrolRadius: [10, 10] as const };
    const members = ["a", "b", "c", "d"].map((id) => ({
      age: 0,
      home: { x: 0, y: 0 },
      id,
      spacing: 13,
    }));
    const slots = members.map((member) =>
      packSlot(
        navigation,
        { gap: 20, memberSpacing: 100 },
        "pack",
        { x: 0, y: 0 },
        0,
        members,
        member.id,
      )!,
    );
    // Four pairs of 100 need a loop of 400: the radius grows from 10 to about 64.
    for (let index = 0; index < slots.length; index++) {
      const next = slots[(index + 1) % slots.length]!;
      expect(gap(slots[index]!.point, next.point)).toBeGreaterThan(85);
    }
    expect(
      packSlot(
        navigation,
        { gap: 20, memberSpacing: 100 },
        "pack",
        { x: 0, y: 0 },
        0,
        members,
        "z",
      ),
    ).toBeNull();
  });

  it("reverses a request with no clear course and flips a patrol", () => {
    const definition = enemyCatalog.fighter;
    const state = spawn("fighter", "boxed", { x: 0, y: 0 }, { facing: { x: 1, y: 0 } });
    const wall = {
      clear: (pose: { position: Vec }) => pose.position.x <= 0,
      escape: () => null,
    };
    const box = {
      clear: (pose: { position: Vec }) => pose.position.x === 0 && pose.position.y === 0,
      escape: () => null,
    };
    expect(
      steerAroundObstacles(definition.physics, wall, dt, definition.physics.maxSpeed, state, {
        x: 0.5,
        y: 0,
      }),
    ).toEqual({ blocked: true, request: { x: -0.5, y: 0 } });
    const boxed = stepEnemy(definition, { ...observation([state]), navigationQuery: box }, state);
    expect(boxed.state.patrolFlip).toEqual({ at: dt, side: expect.any(Number) });
    expect(Math.hypot(boxed.velocity.x, boxed.velocity.y)).toBeGreaterThan(0);
  });

  it("leaves wrecked, disabled and engineless ships and fixed platforms to their physics", () => {
    const disabled = { ...spawn("frigate", "disabled", { x: 0, y: 0 }), disabled: true };
    expect(
      slowest(enemyCatalog.frigate, (state) => observation([state]), 40, 39, {
        ...disabled,
        velocity: { x: 50, y: 0 },
      }).state.velocity,
    ).toEqual({ x: 0, y: 0 });
    const engineless = spawn("frigate", "engineless", { x: 0, y: 0 });
    engineless.hardpoints = engineless.hardpoints.map((part) =>
      part.id === "engine" ? { ...part, hp: 0 } : part,
    );
    expect(
      speed(
        slowest(enemyCatalog.frigate, (state) => observation([state]), 30, 29, engineless).state,
      ),
    ).toBe(0);
    const wreck = {
      ...spawn("fighter", "wreck", { x: 0, y: 0 }),
      hp: 0,
      velocity: { x: 50, y: 0 },
    };
    expect(stepEnemy(enemyCatalog.fighter, observation([wreck]), wreck).velocity).toEqual({
      x: 0,
      y: 0,
    });
    const platform = spawn("platform", "platform", { x: 0, y: 0 });
    expect(
      slowest(enemyCatalog.platform, (state) => observation([state]), 5, 0, platform).state
        .position,
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("the Mining Freighter traces asteroid edges", () => {
  const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "large")!;
  const rock = (id: string, x: number, y: number): SpaceObject => ({
    asteroid: shape.id,
    hp: 10,
    id,
    kind: "rock",
    radius: shape.radius,
    x,
    y,
  });
  const outline = worldParts(scenerySilhouette(rock("probe", 0, 0))!.frames[0]!);
  let index = 0;
  while (
    retaliatorVariant({ archetype: "retaliator", id: `miner-${index}` }) !==
    "retaliatorMiningFreighter"
  ) {
    index++;
  }
  const id = `miner-${index}`;

  it("traces one rock's edge for its dwell, then moves to another and saves its picks", () => {
    const definition = enemyCatalog.retaliator;
    const rocks = [rock("rock-a", 0, 0), rock("rock-b", 1400, 0)];
    let miner = spawn("retaliator", id, { x: -500, y: 0 });
    const offset = spacingRadius(1, miner) + ENEMY_KEEP_MOVING.edgeGap;
    const edges: number[] = [];
    const traced = new Set<string>();
    let share = Infinity;
    for (let step = 0; step * dt < 40; step++) {
      const current = rocks.find((entry) => entry.id === miner.miner?.rock);
      const edge = current ? outlineEdge(outline, current, miner.position) : undefined;
      const candidates = minerNeedsPick(ENEMY_KEEP_MOVING, edge !== undefined, miner)
        ? rocks.map((entry) => ({ id: entry.id, position: { x: entry.x, y: entry.y } }))
        : undefined;
      miner = advance(
        stepEnemy(
          definition,
          {
            ...observation([miner]),
            miner: { ...(candidates ? { candidates } : {}), ...(edge ? { edge } : {}) },
            retaliatorNavigation: { physicalReach: 30 },
          },
          miner,
        ).state,
      );
      traced.add(miner.miner!.rock!);
      if (step * dt > 2) {
        share = Math.min(share, speed(miner) / definition.physics.maxSpeed);
      }
      const settled = edge && miner.age - miner.miner!.arrived > 4;
      if (settled) {
        edges.push(outlineEdge(outline, current!, miner.position).distance);
      }
    }
    expect(share).toBeGreaterThanOrEqual(floor * 0.8);
    // On the edge: its centre about its spacing radius plus the gap from the drawn outline.
    // At the minimum speed it holds close outside the target, swinging out a little on the
    // outline's corners and never touching the rock.
    const mean = edges.reduce((sum, value) => sum + value, 0) / edges.length;
    expect(Math.min(...edges)).toBeGreaterThan(offset * 0.8);
    expect(mean).toBeGreaterThan(offset * 0.9);
    expect(mean).toBeLessThan(offset * 1.4);
    expect(Math.max(...edges)).toBeLessThan(offset * 2);
    expect(traced).toEqual(new Set(["rock-a", "rock-b"]));
    expect(miner.miner!.picks.length).toBeLessThanOrEqual(ENEMY_KEEP_MOVING.recentPicks);
    // Resuming from a JSON round trip gives the same future.
    const saved = JSON.parse(JSON.stringify(miner)) as EnemyState;
    expect(saved.miner).toEqual(miner.miner);
  });

  it("picks the nearest rock not among its last picks, or none, with a seeded dwell", () => {
    const state = { age: 10, id, position: { x: 0, y: 0 } };
    const candidates = [
      { id: "near", position: { x: 100, y: 0 } },
      { id: "far", position: { x: 900, y: 0 } },
    ];
    const first = pickMinerRock({}, ENEMY_KEEP_MOVING, candidates, state);
    expect(first).toEqual({ arrived: 10, count: 1, picks: ["near"], rock: "near" });
    const second = pickMinerRock({}, ENEMY_KEEP_MOVING, candidates, { ...state, miner: first });
    expect(second.rock).toBe("far");
    const none = pickMinerRock({}, ENEMY_KEEP_MOVING, candidates, { ...state, miner: second });
    expect(none).toEqual({ arrived: 10, count: 3, picks: ["near", "far"], rock: null });
    for (let count = 0; count < 20; count++) {
      const dwell = minerDwell(ENEMY_KEEP_MOVING, id, count);
      expect(dwell).toBeGreaterThanOrEqual(6);
      expect(dwell).toBeLessThanOrEqual(12);
    }
    expect(minerNeedsPick(ENEMY_KEEP_MOVING, true, { ...state, miner: first })).toBe(false);
    expect(minerNeedsPick(ENEMY_KEEP_MOVING, false, { ...state, miner: first })).toBe(true);
    expect(minerNeedsPick(ENEMY_KEEP_MOVING, true, { ...state, age: 30, miner: first })).toBe(true);
  });

  it("steers straight at a far edge and along a near one", () => {
    const far = edgeCourse(50, 1, { around: 5150, distance: 5050, normal: { x: -1, y: 0 } });
    expect(far.x).toBeGreaterThan(0.99);
    const along = edgeCourse(50, 1, { around: 150, distance: 50, normal: { x: -1, y: 0 } });
    expect(along.x).toBeCloseTo(0, 9);
    expect(Math.abs(along.y)).toBeCloseTo(1, 9);
  });
});
