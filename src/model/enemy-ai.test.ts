import { describe, expect, it } from "vitest";

import { type EnemyArchetype, enemyCatalog, enemyEncounterTuning } from "../data/enemy-catalog.ts";
import { SHARED_SHIP_PHYSICS } from "../data/ship-physics.ts";
import {
  createEnemy,
  damageEnemy,
  type EnemyContext,
  enemyEffects,
  enemySpeedFraction,
  type EnemyState,
  hardpointOffset,
  stepDebris,
  stepEnemy,
} from "./enemy-ai.ts";
import { stepShipMotion } from "./ship-physics.ts";

const spawn = (archetype: EnemyArchetype): EnemyState =>
  createEnemy(
    enemyCatalog[archetype],
    { archetype, id: "enemy", packId: null, phase: 0.4 },
    { x: 0, y: 0 },
  );
const observation = (state: EnemyState): EnemyContext => ({
  adaSpeed: 100,
  adaWidth: 20,
  dt: 1 / 60,
  initialPackSizes: {},
  peers: [state],
  player: { x: 300, y: 0 },
  speedCapRatio: enemyEncounterTuning.speedCapRatio,
  targetable: true,
  visibility: "visible",
});

describe("enemy rules", () => {
  it("ends a faster ship's pursuit within its time budget without immediate reacquisition", () => {
    const definition = enemyCatalog.interceptor;
    let state = spawn("interceptor");
    let elapsed = 0;
    let reachedFasterSpeed = false;
    while (!state.returning && elapsed < definition.pursuit.maxSeconds + 1) {
      const context = observation(state);
      // Keep the target in sight and ahead so distance loss cannot end this chase.
      context.player = { x: state.position.x + 400, y: 0 };
      const result = stepEnemy(definition, context, state);
      reachedFasterSpeed ||= result.velocity.x > context.adaSpeed;
      state = {
        ...result.state,
        position: { x: state.position.x + result.velocity.x * context.dt, y: 0 },
      };
      elapsed += context.dt;
    }
    expect(reachedFasterSpeed).toBe(true);
    expect(state.returning).toBe(true);
    expect(state.engaged).toBe(false);
    expect(elapsed).toBeLessThanOrEqual(definition.pursuit.maxSeconds + 1 / 60);
    const again = stepEnemy(definition, observation(state), state);
    expect(again.state.engaged).toBe(false);
    expect(again.fire).toEqual([]);
  });

  it("keeps a saved return latch until home and visible target separation are both satisfied", () => {
    const definition = enemyCatalog.interceptor;
    const returning = { ...spawn("interceptor"), returning: true };
    const saved = JSON.parse(JSON.stringify(returning)) as EnemyState;
    expect(stepEnemy(definition, observation(saved), saved).state.returning).toBe(true);
    const separated = observation(saved);
    separated.player.x = definition.perception + 1;
    expect(stepEnemy(definition, separated, saved).state.returning).toBe(false);
    const unknown = { ...separated, visibility: "unknown" as const };
    expect(stepEnemy(definition, unknown, saved).state.returning).toBe(true);
  });

  it("leashes a visible target outside the home radius even before the time budget expires", () => {
    const state = { ...spawn("interceptor"), engaged: true };
    const context = observation(state);
    context.player.x = enemyCatalog.interceptor.pursuit.homeRadius + 1;
    const result = stepEnemy(enemyCatalog.interceptor, context, state);
    expect(result.state.returning).toBe(true);
    expect(result.state.engaged).toBe(false);
    expect(result.fire).toEqual([]);
  });

  it("ends pursuit on elapsed time even when no distance boundary is crossed", () => {
    const definition = enemyCatalog.interceptor;
    const state = {
      ...spawn("interceptor"),
      engaged: true,
      pursuitSeconds: definition.pursuit.maxSeconds - 1 / 120,
    };
    const result = stepEnemy(definition, observation(state), state);
    expect(result.state.returning).toBe(true);
    expect(result.state.engaged).toBe(false);
    expect(result.fire).toEqual([]);
  });

  it("returns after observation expires and does not replace lastSeen with hidden coordinates", () => {
    const definition = enemyCatalog.interceptor;
    const state = {
      ...spawn("interceptor"),
      engaged: true,
      lastSeen: { x: 300, y: 0 },
      lastSeenAge: definition.pursuit.unseenSeconds,
    };
    const context = { ...observation(state), visibility: "unknown" as const };
    context.player = { x: -99999, y: 99999 };
    const result = stepEnemy(definition, context, state);
    expect(result.state.returning).toBe(true);
    expect(result.state.lastSeen).toEqual({ x: 300, y: 0 });
    expect(result.aim).toEqual({ x: 1, y: 0 });
    expect(result.fire).toEqual([]);
  });

  it("preserves deterministic future commands and inputs across a JSON round trip", () => {
    const definition = enemyCatalog.capital;
    const state = stepEnemy(definition, observation(spawn("capital")), spawn("capital")).state;
    const before = JSON.stringify(state);
    const restored = JSON.parse(before) as EnemyState;
    const direct = stepEnemy(definition, observation(state), state);
    const resumed = stepEnemy(definition, observation(restored), restored);
    expect(resumed).toEqual(direct);
    expect(JSON.stringify(state)).toBe(before);
    expect(restored.home).toEqual(state.home);
    expect(restored.lastSeen).toEqual({ x: 300, y: 0 });
    expect(restored.pursuitSeconds).toBeGreaterThan(0);
  });

  it("flees after pack losses and keeps the decision after survivor counts change", () => {
    const definition = enemyCatalog.swarm;
    const state = { ...spawn("swarm"), packId: "pack" };
    const context = { ...observation(state), initialPackSizes: { pack: 4 } };
    const result = stepEnemy(definition, context, state);
    expect(result.state.fleeing).toBe(true);
    expect(result.velocity.x).toBeLessThan(0);
    expect(result.fire).toEqual([]);
    expect(stepEnemy(definition, observation(result.state), result.state).state.fleeing).toBe(true);
  });

  it("allows individual partial-damage flight before any pack loss", () => {
    const definition = enemyCatalog.fighter;
    const damaged = damageEnemy(definition, { amount: 3, hardpointId: null }, spawn("fighter"));
    const result = stepEnemy(definition, observation(damaged), damaged);
    expect(result.effects.defeated).toBe(false);
    expect(result.state.fleeing).toBe(true);
    expect(result.fire).toEqual([]);
  });

  it("retaliates only after a hit and never fires through unknown visibility", () => {
    const definition = enemyCatalog.retaliator;
    const state = spawn("retaliator");
    const idle = stepEnemy(definition, observation(state), state);
    expect(idle.velocity).toEqual({ x: 0, y: 0 });
    expect(idle.fire).toEqual([]);
    const hit = damageEnemy(definition, { amount: 1, hardpointId: null }, state);
    expect(stepEnemy(definition, observation(hit), hit).fire.map((shot) => shot.profileId)).toEqual(
      ["retaliator-spread", "retaliator-spread", "retaliator-spread"],
    );
    const unknown = { ...observation(hit), visibility: "unknown" as const };
    expect(stepEnemy(definition, unknown, hit).fire).toEqual([]);
    expect(stepEnemy(definition, unknown, hit).state.lastSeen).toBeNull();
  });

  it("stops engine momentum immediately while the remaining weapon can fire", () => {
    const definition = enemyCatalog.frigate;
    const moving = { ...spawn("frigate"), velocity: { x: 30, y: 10 } };
    const engineLost = damageEnemy(definition, { amount: 99, hardpointId: "engine" }, moving);
    const portLost = damageEnemy(definition, { amount: 99, hardpointId: "port" }, engineLost);
    const result = stepEnemy(definition, observation(portLost), portLost);
    expect(result.velocity).toEqual({ x: 0, y: 0 });
    expect(result.effects.defeated).toBe(false);
    expect(result.fire.map((shot) => shot.hardpointId)).toEqual(["starboard"]);
  });

  it("keeps bolt and missile profiles and independent cooldowns", () => {
    const definition = enemyCatalog.capital;
    const state = spawn("capital");
    const first = stepEnemy(definition, observation(state), state);
    expect(first.fire.map((shot) => [shot.hardpointId, shot.profileId, shot.projectile])).toEqual([
      ["weapon-left", "turret-bolt", "bolt"],
      ["weapon-right", "turret-bolt", "bolt"],
      ["weapon-rear-left", "straight-missile", "missile"],
      ["weapon-rear-right", "straight-missile", "missile"],
    ]);
    expect(first.state.hardpoints.find((part) => part.id === "weapon-left")?.cooldown).toBeCloseTo(
      1.4 - 1 / 60,
    );
    expect(
      first.state.hardpoints.find((part) => part.id === "weapon-rear-left")?.cooldown,
    ).toBeCloseTo(3 - 1 / 60);
    const ready = {
      ...first.state,
      hardpoints: first.state.hardpoints.map((part) => ({
        ...part,
        cooldown: part.id === "weapon-left" ? 0 : part.cooldown,
      })),
    };
    const second = stepEnemy(definition, observation(ready), ready);
    expect(second.fire.map((shot) => shot.hardpointId)).toEqual(["weapon-left"]);
    expect(first.fire[0]?.speed).not.toBe(first.fire[2]?.speed);
  });

  it.each(["capital"] as const)(
    "aims every %s bolt and missile from its own muzzle before applying spread",
    (archetype) => {
      const state = { ...spawn(archetype), position: { x: 110, y: -75 } };
      const context = { ...observation(state), player: { x: 390, y: 145 } };
      const angles = [-0.2, 0, 0.35];
      const definition = {
        ...enemyCatalog[archetype],
        hardpoints: enemyCatalog[archetype].hardpoints.map((part) =>
          part.kind === "weapon" ? { ...part, fire: { ...part.fire, angles } } : part,
        ),
      };
      const result = stepEnemy(definition, context, state);
      const weapons = definition.hardpoints.filter((part) => part.kind === "weapon");
      expect(result.fire).toHaveLength(weapons.length * angles.length);
      expect(new Set(result.fire.map((shot) => shot.projectile))).toEqual(
        new Set(["bolt", "missile"]),
      );
      for (const part of weapons) {
        const shots = result.fire.filter((shot) => shot.hardpointId === part.id);
        expect(shots).toHaveLength(angles.length);
        // The turret aims from its hardpoint; every shot of a volley leaves one drawn muzzle.
        const mount = {
          x: state.position.x + part.offset.x * definition.sizeRatio * context.adaWidth,
          y: state.position.y + part.offset.y * definition.sizeRatio * context.adaWidth,
        };
        for (const [index, shot] of shots.entries()) {
          expect(shot.origin).toEqual(shots[0]!.origin);
          const dx = context.player.x - mount.x;
          const dy = context.player.y - mount.y;
          const cross = dx * shot.aim.y - dy * shot.aim.x;
          const dot = dx * shot.aim.x + dy * shot.aim.y;
          expect(Math.hypot(shot.aim.x, shot.aim.y)).toBeCloseTo(1, 12);
          expect(Math.atan2(cross, dot)).toBeCloseTo(angles[index]!, 12);
          if (angles[index] === 0) {
            expect(cross).toBeCloseTo(0, 10);
            expect(dot).toBeGreaterThan(0);
          }
        }
      }
    },
  );

  it.each([
    { targetable: true, visibility: "unknown" as const },
    { targetable: true, visibility: "occluded" as const },
    { targetable: false, visibility: "visible" as const },
  ])("never reads hidden target coordinates or fires with %j", (visibility) => {
    const state = {
      ...spawn("capital"),
      engaged: true,
      lastSeen: { x: 200, y: 100 },
    };
    const context = {
      ...observation(state),
      ...visibility,
      get player(): { x: number; y: number } {
        throw new Error("Hidden target coordinates must not be read");
      },
    };
    const result = stepEnemy(enemyCatalog.capital, context, state);
    expect(result.fire).toEqual([]);
    expect(result.state.lastSeen).toEqual(state.lastSeen);
    expect(result.state.lastSeenAge).toBeCloseTo(context.dt);
    expect(result.state.returning).toBe(false);
    const expired = { ...state, lastSeenAge: enemyCatalog.capital.pursuit.unseenSeconds };
    expect(stepEnemy(enemyCatalog.capital, context, expired).state.returning).toBe(true);
  });

  it("requires the command part after hull, engines and weapons are disabled", () => {
    const definition = enemyCatalog.capital;
    let state = damageEnemy(definition, { amount: 999, hardpointId: null }, spawn("capital"));
    expect(stepEnemy(definition, observation(state), state).fire).toHaveLength(4);
    for (const part of definition.hardpoints.filter((part) => part.kind !== "command")) {
      state = damageEnemy(definition, { amount: 999, hardpointId: part.id }, state);
    }
    expect(enemyEffects(definition, state).defeated).toBe(false);
    state = damageEnemy(definition, { amount: 999, hardpointId: "command" }, state);
    const result = stepEnemy(definition, observation(state), state);
    expect(result.effects.defeated).toBe(true);
    expect(result.fire).toEqual([]);
    expect(result.velocity).toEqual({ x: 0, y: 0 });
  });

  it("moves debris at constant velocity without changing the original", () => {
    const debris = { id: "debris", position: { x: 10, y: 20 }, velocity: { x: -3, y: 2 } };
    const first = stepDebris(2, debris);
    expect(first.position).toEqual({ x: 4, y: 24 });
    expect(stepDebris(3, first).position).toEqual({ x: -5, y: 30 });
    expect(first.velocity).toEqual(debris.velocity);
    expect(debris.position).toEqual({ x: 10, y: 20 });
  });

  it("caps saved momentum and allows only the selected archetype to exceed Ada's speed", () => {
    const state = { ...spawn("interceptor"), velocity: { x: 500, y: 500 } };
    const capped = stepEnemy(
      enemyCatalog.interceptor,
      { ...observation(state), speedCapRatio: 1 },
      state,
    );
    expect(Math.hypot(capped.velocity.x, capped.velocity.y)).toBeLessThanOrEqual(100.000001);
    const allowed = stepEnemy(enemyCatalog.interceptor, observation(state), state);
    expect(Math.hypot(allowed.velocity.x, allowed.velocity.y)).toBeCloseTo(110);
    const fighter = { ...spawn("fighter"), velocity: { x: 500, y: 500 } };
    const ordinary = stepEnemy(enemyCatalog.fighter, observation(fighter), fighter);
    expect(Math.hypot(ordinary.velocity.x, ordinary.velocity.y)).toBeCloseTo(80);
  });
});

it("counts dormant pack survivors for morale without exposing hidden positions to steering or fire", () => {
  const state = { ...spawn("swarm"), packId: "pack" };
  const context = {
    ...observation(state),
    dormantPackMembers: { pack: 3 },
    initialPackSizes: { pack: 4 },
  };
  const supported = stepEnemy(enemyCatalog.swarm, context, state);
  expect(supported.state.fleeing).toBe(false);
  expect(supported.fire).toHaveLength(1);
  const losses = stepEnemy(
    enemyCatalog.swarm,
    { ...context, dormantPackMembers: { pack: 1 } },
    state,
  );
  expect(losses.state.fleeing).toBe(true);
  expect(losses.fire).toEqual([]);
  const unknown = stepEnemy(enemyCatalog.swarm, { ...context, visibility: "unknown" }, state);
  expect(unknown.state.lastSeen).toBeNull();
  expect(unknown.fire).toEqual([]);
});

describe("enemy ship physics and hull rotation", () => {
  // The fixed platform never moves; its own tests cover it.
  const archetypes = (Object.keys(enemyCatalog) as EnemyArchetype[]).filter(
    (archetype) => enemyCatalog[archetype].physics.speedRatio > 0,
  );
  const degreesBetween = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    (Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)) * 180) / Math.PI;

  it("states the galaxy one catalog values and behaviours", () => {
    const pick = (archetype: EnemyArchetype) => {
      const definition = enemyCatalog[archetype];
      return {
        behaviour: definition.behaviour.kind,
        engagement: definition.engagement,
        hp: definition.hp,
        sizeRatio: definition.sizeRatio,
      };
    };
    expect(pick("swarm")).toEqual({ behaviour: "swarm", engagement: 360, hp: 2, sizeRatio: 0.65 });
    expect(pick("fighter")).toEqual({
      behaviour: "hitAndRun",
      engagement: 360,
      hp: 4,
      sizeRatio: 1,
    });
    expect(pick("interceptor")).toEqual({
      behaviour: "strafe",
      engagement: 260,
      hp: 3,
      sizeRatio: 0.75,
    });
    expect(pick("retaliator")).toEqual({
      behaviour: "chase",
      engagement: 360,
      hp: 8,
      sizeRatio: 2,
    });
    expect(pick("frigate")).toEqual({ behaviour: "siege", engagement: 500, hp: 10, sizeRatio: 4 });
    expect(pick("capital")).toEqual({ behaviour: "siege", engagement: 750, hp: 18, sizeRatio: 5 });
    expect(enemyCatalog.retaliator.fire).toMatchObject({ angles: [-0.2, 0, 0.2], interval: 2.2 });
    expect(enemyCatalog.retaliator.aggression).toBe("retaliate");
    expect(enemyCatalog.swarm.steering).toEqual({ separation: 85, wobble: 0.65 });
    expect(Object.keys(enemyCatalog)).not.toContain("oversizedCapital");
  });

  it("gives the capital a command part, two engines and four turrets", () => {
    const parts = enemyCatalog.capital.hardpoints;
    expect(parts.map((part) => part.kind)).toEqual([
      "command",
      "engine",
      "engine",
      "weapon",
      "weapon",
      "weapon",
      "weapon",
    ]);
    // Hit areas of radius shipRadius + 6 (16 units) stay apart on the 100-unit hull.
    const width = enemyCatalog.capital.sizeRatio * 20;
    for (const [index, part] of parts.entries()) {
      expect(Math.max(Math.abs(part.offset.x), Math.abs(part.offset.y))).toBeLessThanOrEqual(0.5);
      for (const other of parts.slice(index + 1)) {
        const gap = Math.hypot(part.offset.x - other.offset.x, part.offset.y - other.offset.y);
        expect(gap * width).toBeGreaterThanOrEqual(32);
      }
    }
  });

  it.each(archetypes)("moves %s with the shared ship movement model", (archetype) => {
    const definition = enemyCatalog[archetype];
    const state: EnemyState = {
      ...spawn(archetype),
      heading: { x: 0, y: 1 },
      home: { x: -5000, y: 0 },
      returning: true,
      velocity: { x: 0, y: 10 },
    };
    const context = { ...observation(state), visibility: "unknown" as const };
    const speed = context.adaSpeed * Math.min(1.1, definition.physics.speedRatio);
    const expected = stepShipMotion(
      definition.physics,
      context.dt,
      { maxSpeed: speed, restHeading: state.facing },
      { direction: { x: -1, y: 0 }, speed },
      { heading: state.heading, velocity: state.velocity },
    );
    const result = stepEnemy(definition, context, state);
    expect(result.velocity).toEqual(expected.velocity);
    expect(result.state.heading).toEqual(expected.heading);
  });

  it("brakes with brakingSeconds when nothing is requested", () => {
    const definition = enemyCatalog.fighter;
    const state = { ...spawn("fighter"), velocity: { x: 40, y: 0 } };
    const context = { ...observation(state), visibility: "unknown" as const };
    const result = stepEnemy(definition, context, state);
    expect(result.velocity.x).toBeCloseTo(
      40 * Math.exp(-context.dt / definition.physics.brakingSeconds),
      9,
    );
    expect(result.state.heading).toBeNull();
  });

  it("turns from rest into motion along its hull with turnSeconds and holds it when stopped", () => {
    const definition = enemyCatalog.frigate;
    const turn = definition.physics.turnSeconds;
    let state: EnemyState = { ...spawn("frigate"), home: { x: 5000, y: 0 }, returning: true };
    const context = { ...observation(state), visibility: "unknown" as const };
    expect(state.facing).toEqual({ x: 0, y: -1 });
    const first = stepEnemy(definition, context, state);
    // The heading starts from the hull facing up rather than on the request east.
    expect(degreesBetween(first.state.heading!, { x: 1, y: 0 })).toBeCloseTo(
      90 * Math.exp(-context.dt / turn),
      9,
    );
    expect(degreesBetween(first.velocity, { x: 0, y: -1 })).toBeLessThan(1);
    state = first.state;
    let slip = 0;
    for (let i = 0; i < 600; i++) {
      state = stepEnemy(definition, context, state).state;
      slip = Math.max(slip, degreesBetween(state.velocity, state.facing));
    }
    expect(slip).toBeLessThan(10);
    expect(degreesBetween(state.facing, { x: 1, y: 0 })).toBeLessThan(0.5);
    const settled = { ...state.facing };
    // Arriving home stops movement; the hull keeps its last facing.
    const stopped = stepEnemy(definition, context, { ...state, position: { ...state.home } });
    expect(stopped.velocity).toEqual({ x: 0, y: 0 });
    expect(stopped.state.facing).toEqual(settled);
    const idle = { ...stopped.state, returning: false };
    expect(stepEnemy(definition, context, idle).state.facing).toEqual(settled);
  });

  it("keeps a moving hull pointed along its velocity through a sharp turn", () => {
    const definition = enemyCatalog.frigate;
    const speed = 100 * definition.physics.speedRatio;
    let state: EnemyState = {
      ...spawn("frigate"),
      facing: { x: 0, y: -1 },
      heading: { x: 0, y: -1 },
      home: { x: 5000, y: 0 },
      returning: true,
      velocity: { x: 0, y: -speed },
    };
    const context = { ...observation(state), visibility: "unknown" as const };
    let slip = 0;
    for (let i = 0; i < 600; i++) {
      state = stepEnemy(definition, context, state).state;
      slip = Math.max(slip, degreesBetween(state.velocity, state.facing));
    }
    // hullTurnSeconds trails the velocity direction by only a few degrees.
    expect(slip).toBeLessThan(5);
    expect(degreesBetween(state.facing, { x: 1, y: 0 })).toBeLessThan(0.5);
  });

  it("turns the hull by at most about 25 degrees in one slice when a collision redirects it", () => {
    const definition = enemyCatalog.fighter;
    const speed = 100 * definition.physics.speedRatio;
    const diagonal = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
    // Moving north-east into a wall that the adapter resolves by zeroing x velocity.
    const sliding: EnemyState = {
      ...spawn("fighter"),
      facing: diagonal,
      heading: diagonal,
      home: { x: 5000, y: -5000 },
      returning: true,
      velocity: { x: 0, y: -speed * Math.SQRT1_2 },
    };
    const context = { ...observation(sliding), visibility: "unknown" as const };
    const result = stepEnemy(definition, context, sliding);
    const turned = degreesBetween(result.state.facing, diagonal);
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThanOrEqual(25);
    expect(turned).toBeCloseTo(
      degreesBetween(result.velocity, diagonal) *
        (1 - Math.exp(-context.dt / SHARED_SHIP_PHYSICS.hullTurnSeconds)),
      6,
    );
  });

  it("brings a heavy archetype to rest below 1% of its maximum speed without creeping", () => {
    const definition = enemyCatalog.capital;
    const maxSpeed = 100 * definition.physics.speedRatio;
    let state: EnemyState = { ...spawn("capital"), velocity: { x: maxSpeed, y: 0 } };
    const context = { ...observation(state), visibility: "unknown" as const };
    let elapsed = 0;
    while (state.velocity.x > 0 && elapsed < 30) {
      state = stepEnemy(definition, context, state).state;
      elapsed += context.dt;
    }
    // exp(-t / brakingSeconds) reaches 1% at brakingSeconds * ln(100), about 13.8 s.
    expect(elapsed).toBeCloseTo(definition.physics.brakingSeconds * Math.log(100), 1);
    expect(state.velocity).toEqual({ x: 0, y: 0 });
    expect(state.facing).toEqual({ x: 1, y: 0 });
  });

  it("keeps the hull still when a disabled engine stops movement", () => {
    const definition = enemyCatalog.frigate;
    const moving = {
      ...spawn("frigate"),
      facing: { x: 1, y: 0 },
      heading: { x: 1, y: 0 },
      velocity: { x: 30, y: 0 },
    };
    const engineLost = damageEnemy(definition, { amount: 99, hardpointId: "engine" }, moving);
    const context = { ...observation(engineLost), player: { x: 0, y: 300 } };
    const result = stepEnemy(definition, context, engineLost);
    expect(result.velocity).toEqual({ x: 0, y: 0 });
    expect(result.state.heading).toBeNull();
    expect(result.state.facing).toEqual({ x: 1, y: 0 });
  });

  it("rotates hardpoint offsets with the hull at exactly 90 degrees", () => {
    const definition = enemyCatalog.capital;
    const facing = { x: 1, y: 0 };
    const offset = (id: string) =>
      hardpointOffset(
        definition,
        20,
        facing,
        definition.hardpoints.find((part) => part.id === id)!,
      );
    // Hull width is 100. Facing east, forward is +x and port is -y.
    expect(offset("weapon-left").x).toBeCloseTo(0.3 * 100, 9);
    expect(offset("weapon-left").y).toBeCloseTo(-0.35 * 100, 9);
    expect(offset("weapon-right").x).toBeCloseTo(0.3 * 100, 9);
    expect(offset("weapon-right").y).toBeCloseTo(0.35 * 100, 9);
    const engine = hardpointOffset(definition, 20, facing, {
      offset: { x: 0.3, y: 0.35 },
    });
    expect(engine.x).toBeCloseTo(-35, 9);
    expect(engine.y).toBeCloseTo(30, 9);
  });

  it("aims weapons independently of the hull with aimTurnSeconds", () => {
    const definition = enemyCatalog.frigate;
    const response = definition.physics.aimTurnSeconds;
    const base = spawn("frigate");
    // A last-seen point straight south while the starboard weapon still points east.
    const aimed = {
      ...base,
      hardpoints: base.hardpoints.map((part) =>
        part.id === "starboard" ? { ...part, aim: { x: 1, y: 0 } } : part,
      ),
      lastSeen: { x: 0, y: 3000 },
    };
    const context = { ...observation(aimed), visibility: "unknown" as const };
    const part = (state: EnemyState, id: string) =>
      state.hardpoints.find((value) => value.id === id)!.aim!;
    const turned = stepEnemy(definition, context, aimed).state;
    // Facing up, starboard sits at (24, 0) and port at (-24, 0).
    const wanted = { x: -24, y: 3000 };
    expect(degreesBetween(part(turned, "starboard"), wanted)).toBeCloseTo(
      degreesBetween({ x: 1, y: 0 }, wanted) * Math.exp(-context.dt / response),
      6,
    );
    // A weapon with no previous aim acquires its target directly.
    expect(degreesBetween(part(turned, "port"), { x: 24, y: 3000 })).toBeLessThan(1e-9);
    // Facing east moves the starboard muzzle to (0, 24); its aim still turns from east.
    const rotated = stepEnemy(definition, context, { ...aimed, facing: { x: 1, y: 0 } }).state;
    expect(degreesBetween(part(rotated, "starboard"), { x: 0, y: 1 })).toBeCloseTo(
      90 * Math.exp(-context.dt / response),
      6,
    );
    expect(rotated.facing).toEqual({ x: 1, y: 0 });
  });

  it("fires along the smoothed aim rather than straight at the target", () => {
    const definition = enemyCatalog.fighter;
    const state = { ...spawn("fighter"), aim: { x: 0, y: 1 }, engaged: true };
    const context = observation(state);
    const result = stepEnemy(definition, context, state);
    expect(result.fire).toHaveLength(1);
    expect(result.fire[0]!.aim).toEqual(result.state.aim);
    expect(degreesBetween(result.fire[0]!.aim, { x: 1, y: 0 })).toBeCloseTo(
      90 * Math.exp(-context.dt / definition.physics.aimTurnSeconds),
      6,
    );
  });

  it("reports speed as a fraction of the archetype's capped maximum", () => {
    const state = { ...spawn("interceptor"), velocity: { x: 0, y: 55 } };
    expect(enemySpeedFraction(enemyCatalog.interceptor, 100, 1.1, state)).toBeCloseTo(0.5, 12);
    expect(enemySpeedFraction(enemyCatalog.interceptor, 100, 1, state)).toBeCloseTo(0.55, 12);
    expect(enemySpeedFraction(enemyCatalog.capital, 100, 1.1, state)).toBe(1);
    expect(enemySpeedFraction(enemyCatalog.fighter, 0, 1.1, state)).toBe(0);
  });

  it.each(archetypes)("returns %s home through its momentum and stops there", (archetype) => {
    const definition = enemyCatalog[archetype];
    const speed = 200 * Math.min(1.1, definition.physics.speedRatio);
    let state: EnemyState = {
      ...spawn(archetype),
      heading: { x: 0, y: 1 },
      position: { x: 300, y: 0 },
      returning: true,
      velocity: { x: 0, y: speed },
    };
    const context = { ...observation(state), adaSpeed: 200, visibility: "unknown" as const };
    let elapsed = 0;
    while (elapsed < 150 && Math.hypot(state.velocity.x, state.velocity.y) > 0) {
      const result = stepEnemy(definition, context, state);
      state = {
        ...result.state,
        position: {
          x: state.position.x + result.velocity.x * context.dt,
          y: state.position.y + result.velocity.y * context.dt,
        },
      };
      elapsed += context.dt;
    }
    expect(Math.hypot(state.position.x, state.position.y)).toBeLessThanOrEqual(5);
    expect(state.velocity).toEqual({ x: 0, y: 0 });
  });
});
