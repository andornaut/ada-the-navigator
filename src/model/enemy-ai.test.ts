import { describe, expect, it } from "vitest";

import { type EnemyArchetype, enemyCatalog, enemyEncounterTuning } from "../data/enemy-catalog.ts";
import {
  createEnemy,
  damageEnemy,
  type EnemyContext,
  enemyEffects,
  type EnemyState,
  stepDebris,
  stepEnemy,
} from "./enemy-ai.ts";

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
    expect(stepEnemy(definition, observation(hit), hit).fire).toHaveLength(1);
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
      ["weapon-right", "straight-missile", "missile"],
    ]);
    expect(first.state.hardpoints.find((part) => part.id === "weapon-left")?.cooldown).toBeCloseTo(
      1.4 - 1 / 60,
    );
    expect(first.state.hardpoints.find((part) => part.id === "weapon-right")?.cooldown).toBeCloseTo(
      3 - 1 / 60,
    );
    const ready = {
      ...first.state,
      hardpoints: first.state.hardpoints.map((part) => ({
        ...part,
        cooldown: part.id === "weapon-left" ? 0 : part.cooldown,
      })),
    };
    const second = stepEnemy(definition, observation(ready), ready);
    expect(second.fire.map((shot) => shot.hardpointId)).toEqual(["weapon-left"]);
    expect(first.fire[0]?.speed).not.toBe(first.fire[1]?.speed);
  });

  it.each(["capital", "oversizedCapital"] as const)(
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
        for (const [index, shot] of shots.entries()) {
          expect(shot.origin).toEqual({
            x: state.position.x + part.offset.x * definition.sizeRatio * context.adaWidth,
            y: state.position.y + part.offset.y * definition.sizeRatio * context.adaWidth,
          });
          const dx = context.player.x - shot.origin.x;
          const dy = context.player.y - shot.origin.y;
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
    expect(stepEnemy(definition, observation(state), state).fire).toHaveLength(2);
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
