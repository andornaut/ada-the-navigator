import { describe, expect, it } from "vitest";

import {
  ENEMY_AIM,
  ENEMY_ONLY_DAMAGE,
  type EnemyArchetype,
  enemyCatalog,
  type EnemyDefinition,
  enemyDefinition,
  enemyFire,
  enemyFireRate,
  fireDamageRatio,
} from "../data/enemyCatalog.ts";
import { ENEMY_SIZE_RATIOS } from "../data/enemyDimensions.ts";
import { SHARED_SHIP_PHYSICS, SHIP_PHYSICS } from "../data/shipPhysics.ts";
import { WEAPON_CATALOG } from "../data/weaponCatalog.ts";
import {
  aimDrift,
  averageVelocity,
  createEnemy,
  damageEnemy,
  type EnemyContext,
  enemyEffects,
  enemySpeedFraction,
  type EnemyState,
  hardpointOffset,
  leadPoint,
  leadSkill,
  stepDebris,
  stepEnemy,
  strafeLimited,
} from "./enemyAi.ts";
import { fanHeading } from "./playerProjectiles.ts";
import { stepShipMotion } from "./shipPhysics.ts";

/** `vector` turned by `angle` radians, as a ship's aim drift turns its line of fire. */
const rotate = (vector: { x: number; y: number }, angle: number) => ({
  x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
  y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
});

/** Controlled mixed-profile unit fixture, not an ambient capital roster or spawn claim. */
function mixedMechanismDefinition(): EnemyDefinition {
  const base = enemyDefinition(5, "capital", "mechanism:mixed-capital");
  const weapons = ["laser", "multiLaser", "heavyMissile"] as const;
  let index = 0;
  // Its turrets only: the front Lasers' fixed fire has its own tests.
  return {
    ...base,
    hardpoints: base.hardpoints
      .flatMap((part) => (part.kind === "weapon" && part.fixed ? [] : [part]))
      .map((part) => {
        if (part.kind !== "weapon") {
          return part;
        }
        const weapon = weapons[index++ % weapons.length]!;
        const fire = enemyFire("capital", { level: 1, weapon });
        return {
          ...part,
          fire: { ...fire, interval: fire.interval / enemyFireRate(5, "capital", weapon) },
        };
      }),
  };
}
const spawn = (
  archetype: EnemyArchetype,
  definition: EnemyDefinition = enemyCatalog[archetype],
): EnemyState =>
  createEnemy(definition, { archetype, id: "enemy", packId: null, phase: 0.4 }, { x: 0, y: 0 });
const observation = (state: EnemyState): EnemyContext => ({
  adaWidth: 20,
  dt: 1 / 60,
  inPlayView: true,
  initialPackSizes: {},
  lead: 1,
  peers: [state],
  player: { x: 300, y: 0 },
  playerVelocity: { x: 0, y: 0 },
  routePosition: 1,
  targetable: true,
  visibility: "visible",
});

it("uses the approved speed and free-roaming leash for each archetype", () => {
  const physics = Object.fromEntries(
    Object.entries(enemyCatalog).map(([kind, ship]) => [
      kind,
      [ship.physics.maxSpeed, ship.pursuit.homeRadius, ship.pursuit.unseenSeconds],
    ]),
  );
  expect(physics).toEqual({
    capital: [50, 1000, 8],
    fighter: [160, 2500, 8],
    frigate: [100, 1500, 8],
    interceptor: [240, 3000, 8],
    platform: [0, 2000, 8],
    retaliator: [120, 1000, 8],
    swarm: [175, 2500, 8],
  });
});

it("chases an opening target across the seam using actual motion instead of aim lead", () => {
  const definition = enemyCatalog.interceptor;
  const state: EnemyState = {
    ...spawn("interceptor"),
    engaged: true,
    facing: { x: 1, y: 0 },
    home: { x: 119900, y: 0 },
    position: { x: 119900, y: 0 },
  };
  const context: EnemyContext = {
    ...observation(state),
    player: { x: -119700, y: 0 },
    playerDisplacement: { x: 2, y: 0 },
    playerVelocity: { x: -200, y: 0 },
    worldSide: 240000,
  };
  const direct = stepEnemy(definition, context, state);
  expect(direct.velocity.x).toBeGreaterThan(0);
  expect(direct.velocity.y).toBeCloseTo(0, 10);
  expect(direct.state.lastSeen).toEqual(context.player);

  const verifyNormal = (patch: Partial<EnemyContext>, actor = state) => {
    const overridden = { ...context, ...patch };
    expect(stepEnemy(definition, overridden, actor)).toEqual(
      stepEnemy(definition, { ...overridden, playerDisplacement: { x: 0, y: 0 } }, actor),
    );
  };
  verifyNormal({ player: { x: -119950, y: 0 } });
  verifyNormal({ playerDisplacement: { x: -2, y: 0 }, playerVelocity: { x: 200, y: 0 } });
  verifyNormal({ enemyDrift: { x: 160, y: 0 } });
  verifyNormal({}, { ...state, velocity: { x: 180, y: 0 } });
  verifyNormal({}, { ...state, escortOf: "leader" });
  verifyNormal({ visibility: "occluded" });
  verifyNormal({ targetable: false });
  verifyNormal({}, { ...state, returning: true });
});

describe("enemy rules", () => {
  it("uses a summon detour only for steering while retaining Ada's actual observation", () => {
    const state = { ...spawn("frigate"), facing: { x: 0, y: 1 } };
    const context: EnemyContext = {
      ...observation(state),
      player: { x: 1000, y: 0 },
      summonTarget: { x: 0, y: 1000 },
      summoned: true,
    };
    const detour = stepEnemy(enemyCatalog.frigate, context, state);
    expect(detour.velocity.y).toBeGreaterThan(0);
    expect(detour.velocity.x).toBeCloseTo(0, 10);
    expect(detour.state.lastSeen).toEqual(context.player);
    expect(detour.fire).toEqual([]);
    const ordinary = { ...observation(state), player: context.player, summoned: false };
    expect(stepEnemy(enemyCatalog.frigate, { ...context, summoned: false }, state)).toEqual(
      stepEnemy(enemyCatalog.frigate, ordinary, state),
    );
  });

  it("fires only while the ship is inside the current play view, still pursuing outside it", () => {
    const state = { ...spawn("swarm"), facing: { x: 1, y: 0 } };
    const inside = stepEnemy(enemyCatalog.swarm, observation(state), state);
    expect(inside.fire.length).toBeGreaterThan(0);
    const outside = stepEnemy(
      enemyCatalog.swarm,
      { ...observation(state), inPlayView: false },
      state,
    );
    expect(outside.fire).toEqual([]);
    expect(outside.state.engaged).toBe(true);
    expect(outside.state.lastSeen).toEqual(inside.state.lastSeen);
  });

  it("flies a summoned guard straight at an unseen Ada past its pursuit limits, holding fire", () => {
    const definition = enemyCatalog.frigate;
    // Ada far beyond the guard's perception and home radius, behind scenery.
    const far = definition.pursuit.homeRadius + definition.perception + 500;
    const context: EnemyContext = {
      ...observation(spawn("frigate", definition)),
      player: { x: far, y: 0 },
      summoned: true,
      visibility: "occluded",
    };
    const spent: EnemyState = {
      ...spawn("frigate", definition),
      pursuitSeconds: definition.pursuit.maxSeconds,
      returning: true,
    };
    // Unsummoned, a ship whose pursuit is spent patrols home without attacking.
    const resting = stepEnemy(definition, { ...context, summoned: false }, spent);
    expect(resting.state.returning).toBe(true);
    expect(Math.hypot(resting.velocity.x, resting.velocity.y)).toBeGreaterThan(0);
    expect(resting.fire).toEqual([]);
    let state = spent;
    let velocity = { x: 0, y: 0 };
    for (let step = 0; step < 600; step++) {
      const intent = stepEnemy(definition, context, state);
      expect(intent.fire).toEqual([]);
      velocity = intent.velocity;
      state = {
        ...intent.state,
        position: {
          x: intent.state.position.x + intent.velocity.x * context.dt,
          y: intent.state.position.y + intent.velocity.y * context.dt,
        },
      };
      expect(state.returning).toBe(false);
      expect(state.engaged).toBe(true);
    }
    // Ten seconds later it is well on its way, flying at Ada at top speed.
    expect(state.position.x).toBeGreaterThan(definition.physics.maxSpeed * 5);
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(definition.physics.maxSpeed, 0);
    expect(Math.abs(velocity.y)).toBeLessThan(definition.physics.maxSpeed / 10);
  });

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
      reachedFasterSpeed ||=
        Math.hypot(result.velocity.x, result.velocity.y) > SHIP_PHYSICS.ada.maxSpeed;
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

  it("keeps a saved return latch before rearmSeconds unless home with Ada seen beyond perception", () => {
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
    // The interceptor's fixed nose guns aim along its hull.
    expect(result.aim).toEqual(result.state.facing);
    expect(result.fire).toEqual([]);
  });

  it("preserves deterministic future commands and inputs across a JSON round trip", () => {
    const definition = enemyCatalog.capital;
    // Ada inside perception but beyond firing range, so the pursuit clock runs.
    const context = (state: EnemyState): EnemyContext => ({
      ...observation(state),
      player: { x: definition.engagement + 100, y: 0 },
    });
    const state = stepEnemy(definition, context(spawn("capital")), spawn("capital")).state;
    const before = JSON.stringify(state);
    const restored = JSON.parse(before) as EnemyState;
    const direct = stepEnemy(definition, context(state), state);
    const resumed = stepEnemy(definition, context(restored), restored);
    expect(resumed).toEqual(direct);
    expect(JSON.stringify(state)).toBe(before);
    expect(restored.home).toEqual(state.home);
    expect(restored.lastSeen).toEqual({ x: definition.engagement + 100, y: 0 });
    expect(restored.pursuitSeconds).toBeGreaterThan(0);
  });

  it("re-engages a returning ship that sees Ada on screen once rearmSeconds have passed", () => {
    const definition = enemyCatalog.fighter;
    const { rearmSeconds } = definition.pursuit;
    // Ada on screen, inside perception and firing range: a ship back home, and one stopped short
    // of it, both re-engage.
    for (const position of [
      { x: 0, y: 0 },
      { x: -500, y: 0 },
    ]) {
      const player = { x: position.x + 200, y: 0 };
      let state: EnemyState = { ...spawn("fighter"), position, returning: true };
      let elapsed = 0;
      let firedReturning = false;
      let fire: unknown[] = [];
      while (state.returning && elapsed < rearmSeconds + 1) {
        const intent = stepEnemy(definition, { ...observation(state), player }, state);
        firedReturning ||= intent.state.returning && intent.fire.length > 0;
        fire = intent.fire;
        // The nose stays on Ada, so the fixed guns can fire on the step the ship re-engages.
        state = { ...intent.state, facing: { x: 1, y: 0 }, position };
        elapsed += 1 / 60;
      }
      // It holds fire while returning, then fires on the step it re-engages.
      expect(firedReturning).toBe(false);
      expect(fire.length).toBeGreaterThan(0);
      expect(elapsed).toBeGreaterThanOrEqual(rearmSeconds);
      expect(elapsed).toBeLessThan(rearmSeconds + 2 / 60);
      expect(state.engaged).toBe(true);
      expect(state.pursuitSeconds).toBe(0);
      expect(state.returnSeconds).toBe(0);
    }
  });

  it("re-engages a returning retaliator on sight, since it has fought Ada, but not an untouched one", () => {
    const definition = enemyCatalog.retaliator;
    const player = { x: 200, y: 0 };
    const returning: EnemyState = {
      ...spawn("retaliator"),
      returnSeconds: definition.pursuit.rearmSeconds,
      returning: true,
    };
    const rearmed = stepEnemy(definition, { ...observation(returning), player }, returning).state;
    expect(rearmed).toMatchObject({ engaged: true, returning: false });
    const untouched = spawn("retaliator");
    const idle = stepEnemy(definition, { ...observation(untouched), player }, untouched).state;
    expect(idle.engaged).toBe(false);
  });

  it("does not re-engage a fleeing ship, or one whose chase is leashed, on sight", () => {
    const definition = enemyCatalog.fighter;
    const fleeing: EnemyState = {
      ...spawn("fighter"),
      fleeing: true,
      returnSeconds: 5,
      returning: true,
    };
    expect(stepEnemy(definition, observation(fleeing), fleeing).state.returning).toBe(true);
    // Stopped near its home radius with Ada beyond it, though within perception.
    const leashed: EnemyState = {
      ...spawn("fighter"),
      position: { x: definition.pursuit.homeRadius - 400, y: 0 },
      returnSeconds: 5,
      returning: true,
    };
    const beyond = {
      ...observation(leashed),
      player: { x: definition.pursuit.homeRadius + 100, y: 0 },
    };
    expect(stepEnemy(definition, beyond, leashed).state.returning).toBe(true);
  });

  it("wakes a returning ship when it is hit, but not a fleeing one", () => {
    const definition = enemyCatalog.fighter;
    const returning: EnemyState = {
      ...spawn("fighter"),
      position: { x: -300, y: 0 },
      pursuitSeconds: 12,
      returnSeconds: 0.5,
      returning: true,
    };
    const hit = damageEnemy(definition, { amount: 1, hardpointId: null }, returning);
    expect(hit.returning).toBe(false);
    expect(hit.engaged).toBe(true);
    expect(hit.pursuitSeconds).toBe(0);
    expect(hit.returnSeconds).toBe(0);
    const next = stepEnemy(definition, observation(hit), hit).state;
    expect(next.returning).toBe(false);
    expect(next.engaged).toBe(true);
    const fleeing = damageEnemy(
      definition,
      { amount: 1, hardpointId: null },
      { ...returning, fleeing: true },
    );
    expect(fleeing.returning).toBe(true);
  });

  it("resets the pursuit clock while fighting and ends a chase held out of range at maxSeconds", () => {
    const definition = enemyCatalog.fighter;
    const fighting: EnemyState = { ...spawn("fighter"), engaged: true, pursuitSeconds: 20 };
    const inRange = { ...observation(fighting), player: { x: definition.engagement - 10, y: 0 } };
    expect(stepEnemy(definition, inRange, fighting).state.pursuitSeconds).toBe(0);
    // Ada in sight but held beyond firing range: the clock runs to the limit.
    const outOfRange = { x: definition.engagement + 100, y: 0 };
    let state: EnemyState = { ...spawn("fighter"), engaged: true };
    let elapsed = 0;
    while (!state.returning && elapsed < definition.pursuit.maxSeconds + 1) {
      state = {
        ...stepEnemy(definition, { ...observation(state), player: outOfRange }, state).state,
        position: { x: 0, y: 0 },
      };
      elapsed += 1 / 60;
    }
    expect(definition.pursuit.maxSeconds).toBe(30);
    expect(state.returning).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(definition.pursuit.maxSeconds - 1 / 60);
    expect(elapsed).toBeLessThan(definition.pursuit.maxSeconds + 1 / 60);
  });

  it("steers an engaged ship to Ada's last-seen position while she is hidden", () => {
    const definition = enemyCatalog.fighter;
    const lastSeen = { x: 0, y: 600 };
    let state: EnemyState = { ...spawn("fighter"), engaged: true, lastSeen };
    const hidden: EnemyContext = {
      ...observation(state),
      get player(): { x: number; y: number } {
        throw new Error("Hidden target coordinates must not be read");
      },
      visibility: "occluded",
    };
    for (let step = 0; step < 300; step++) {
      const intent = stepEnemy(definition, hidden, state);
      expect(intent.fire).toEqual([]);
      state = {
        ...intent.state,
        position: {
          x: state.position.x + intent.velocity.x * hidden.dt,
          y: state.position.y + intent.velocity.y * hidden.dt,
        },
      };
    }
    // Five seconds on, still chasing and well on its way to where it last saw her.
    expect(state.returning).toBe(false);
    expect(state.engaged).toBe(true);
    expect(state.lastSeen).toEqual(lastSeen);
    expect(Math.hypot(state.position.x - lastSeen.x, state.position.y - lastSeen.y)).toBeLessThan(
      400,
    );
  });

  it("ends a chase once Ada stays hidden for unseenSeconds", () => {
    const definition = enemyCatalog.fighter;
    let state: EnemyState = { ...spawn("fighter"), engaged: true, lastSeen: { x: 300, y: 0 } };
    const hidden: EnemyContext = { ...observation(state), visibility: "occluded" };
    let elapsed = 0;
    while (!state.returning && elapsed < definition.pursuit.unseenSeconds + 1) {
      const intent = stepEnemy(definition, hidden, state);
      state = {
        ...intent.state,
        position: {
          x: state.position.x + intent.velocity.x * hidden.dt,
          y: state.position.y + intent.velocity.y * hidden.dt,
        },
      };
      elapsed += hidden.dt;
    }
    expect(definition.pursuit.unseenSeconds).toBe(8);
    expect(state.returning).toBe(true);
    expect(state.engaged).toBe(false);
    expect(elapsed).toBeCloseTo(definition.pursuit.unseenSeconds, 1);
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
    expect(Math.hypot(idle.velocity.x, idle.velocity.y)).toBeGreaterThan(0);
    expect(idle.state.engaged).toBe(false);
    expect(idle.fire).toEqual([]);
    // Facing Ada, its forward launcher bears on her.
    const hit = {
      ...damageEnemy(definition, { amount: 1, hardpointId: null }, state),
      facing: { x: 1, y: 0 },
    };
    expect(
      stepEnemy(definition, observation(hit), hit).fire.map((shot) => [shot.weapon, shot.level]),
    ).toEqual([["rapidMissile", 1]]);
    const unknown = { ...observation(hit), visibility: "unknown" as const };
    expect(stepEnemy(definition, unknown, hit).fire).toEqual([]);
    expect(stepEnemy(definition, unknown, hit).state.lastSeen).toBeNull();
  });

  it("coasts on its momentum without engines while the remaining weapon can fire", () => {
    const definition = enemyCatalog.frigate;
    const moving = { ...spawn("frigate"), velocity: { x: 30, y: 10 } };
    const engineLost = damageEnemy(definition, { amount: 4, hardpointId: "engine" }, moving);
    const portLost = damageEnemy(definition, { amount: 3, hardpointId: "port" }, engineLost);
    const result = stepEnemy(definition, observation(portLost), portLost);
    // No thrust: the hull keeps drifting the way it went and only slows.
    expect(Math.hypot(result.velocity.x, result.velocity.y)).toBeGreaterThan(0);
    expect(Math.hypot(result.velocity.x, result.velocity.y)).toBeLessThan(Math.hypot(30, 10));
    expect(result.velocity.y * 30).toBeCloseTo(result.velocity.x * 10, 6);
    expect(result.effects.defeated).toBe(false);
    expect(result.state.firePhasesInitialized).toBe(true);
    expect(result.fire).toEqual([]);
    const wait = result.state.hardpoints.find((part) => part.id === "starboard")!.cooldown;
    expect(wait).toBeGreaterThan(0);
    const ready = stepEnemy(
      definition,
      { ...observation(result.state), dt: wait + 1e-6 },
      result.state,
    );
    expect(ready.fire.map((shot) => shot.hardpointId)).toEqual(["starboard"]);
  });

  it("fires each hardpoint's projectiles at its profile's speed", () => {
    const definition = enemyCatalog.capital;
    const state = spawn("capital");
    const speeds = new Map(
      definition.hardpoints.flatMap((part) =>
        part.kind === "weapon" ? [[part.id, part.fire.projectileSpeed] as const] : [],
      ),
    );
    const fire = stepEnemy(definition, observation(state), state).fire;
    expect(fire.length).toBeGreaterThan(0);
    for (const shot of fire) {
      expect(shot.speed).toBeCloseTo(speeds.get(shot.hardpointId!)!, 9);
    }
  });

  it("fires each hardpoint's own weapon and level with independent cooldowns", () => {
    const definition = mixedMechanismDefinition();
    const loadout = new Map(
      definition.hardpoints.flatMap((part) =>
        part.kind === "weapon" ? [[part.id, part.fire.weapon] as const] : [],
      ),
    );
    const mountOf = (weapon: string) => [...loadout].find(([, carried]) => carried === weapon)![0];
    // Initialized ongoing clocks isolate per-mount cooldowns from first-entry phasing.
    const state = { ...spawn("capital", definition), firePhasesInitialized: true as const };
    const first = stepEnemy(definition, observation(state), state);
    const fired = first.fire.map((shot) => `${shot.hardpointId} ${shot.weapon} ${shot.level}`);
    expect([...new Set(fired)]).toEqual(
      [...loadout].map(([mount, weapon]) => `${mount} ${weapon} 1`),
    );
    // A level 1 Multi-Laser fires its three-bolt fan.
    const multi = `${mountOf("multiLaser")} multiLaser 1`;
    expect(fired.filter((shot) => shot === multi)).toHaveLength(3);
    expect(first.fire.find((shot) => shot.weapon === "heavyMissile")?.projectile).toBe("missile");
    const cooldown = (mount: string) =>
      first.state.hardpoints.find((part) => part.id === mount)?.cooldown;
    for (const weapon of ["laser", "heavyMissile"]) {
      const part = definition.hardpoints.find((part) => part.id === mountOf(weapon));
      if (part?.kind !== "weapon") {
        throw new Error("Expected an equipped weapon hardpoint");
      }
      expect(cooldown(part.id)).toBeCloseTo(part.fire.interval - observation(state).dt, 9);
    }
    const ready = {
      ...first.state,
      hardpoints: first.state.hardpoints.map((part) => ({
        ...part,
        cooldown: part.id === mountOf("laser") ? 0 : part.cooldown,
      })),
    };
    const second = stepEnemy(definition, observation(ready), ready);
    expect(second.fire.map((shot) => shot.hardpointId)).toEqual([mountOf("laser")]);
    // A heavy's projectiles fly 0.8 of Ada's level 1 speed for the weapon: Laser 400, Heavy 320.
    const speedOf = (weapon: string) => first.fire.find((shot) => shot.weapon === weapon)!.speed;
    expect(speedOf("laser")).toBeCloseTo(400, 9);
    expect(speedOf("heavyMissile")).toBeCloseTo(320, 9);
  });

  it.each(["capital"] as const)(
    "aims every %s bolt and missile from its own muzzle before applying spread",
    (archetype) => {
      const positioned = mixedMechanismDefinition();
      // An initialized readiness snapshot exercises every muzzle and fan together.
      const state = {
        ...spawn(archetype, positioned),
        firePhasesInitialized: true as const,
        position: { x: 110, y: -75 },
      };
      const context = { ...observation(state), player: { x: 390, y: 145 } };
      const angles = [-20, 0, 35];
      const definition = {
        ...positioned,
        hardpoints: positioned.hardpoints.map((part) =>
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
        const offset = hardpointOffset(definition, context.adaWidth, state.facing, part);
        const mount = { x: state.position.x + offset.x, y: state.position.y + offset.y };
        for (const [index, shot] of shots.entries()) {
          expect(shot.origin).toEqual(shots[0]!.origin);
          const dx = context.player.x - mount.x;
          const dy = context.player.y - mount.y;
          expect(Math.hypot(shot.aim.x, shot.aim.y)).toBeCloseTo(1, 12);
          // Each spread angle is taken from the drifted line of fire in the projected aim
          // plane, as Ada's fans are.
          const drift = aimDrift(state.id, state.age);
          const line = rotate({ x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) }, drift);
          const expected = fanHeading(line, angles[index]!);
          expect(shot.aim.x).toBeCloseTo(expected.x, 12);
          expect(shot.aim.y).toBeCloseTo(expected.y, 12);
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

  it("disables a heavy once its weapons are destroyed and destroys it only at 0 hull", () => {
    const definition = enemyCatalog.capital;
    // This existing engagement tests disable and hull routing, not first-entry timing.
    let state: EnemyState = { ...spawn("capital"), firePhasesInitialized: true };
    // Every turret fires; the front Lasers hold with Ada off the nose.
    const volleys = definition.hardpoints.flatMap((part) =>
      part.kind === "weapon" && !part.fixed ? part.fire.angles : [],
    );
    expect(stepEnemy(definition, observation(state), state).fire).toHaveLength(volleys.length);
    for (const part of definition.hardpoints.filter((part) => part.kind === "weapon")) {
      expect(state.disabled).toBe(false);
      state = damageEnemy(definition, { amount: part.hp, hardpointId: part.id }, state);
    }
    // Destroying the weapons leaves the hull intact.
    expect(state).toMatchObject({ disabled: true, hp: definition.hp });
    const moving = { ...state, velocity: { x: 30, y: 0 } };
    const result = stepEnemy(definition, observation(moving), moving);
    expect(result.effects).toMatchObject({ defeated: false, disabled: true });
    expect(result.fire).toEqual([]);
    // It stops steering and coasts to rest through its own physics.
    expect(result.velocity.x).toBeLessThan(30);
    expect(result.velocity.x).toBeGreaterThan(0);
    expect(result.state.disabled).toBe(true);
    state = damageEnemy(definition, { amount: definition.hp, hardpointId: null }, result.state);
    expect(enemyEffects(definition, state).defeated).toBe(true);
    expect(stepEnemy(definition, observation(state), state).fire).toEqual([]);
  });

  it("moves debris at constant velocity without changing the original", () => {
    const debris = { id: "debris", position: { x: 10, y: 20 }, velocity: { x: -3, y: 2 } };
    const first = stepDebris(2, debris);
    expect(first.position).toEqual({ x: 4, y: 24 });
    expect(stepDebris(3, first).position).toEqual({ x: -5, y: 30 });
    expect(first.velocity).toEqual(debris.velocity);
    expect(debris.position).toEqual({ x: 10, y: 20 });
  });

  it.each(["interceptor", "fighter"] as const)(
    "caps a %s's saved momentum at its own maximum speed",
    (archetype) => {
      const state = { ...spawn(archetype), velocity: { x: 500, y: 500 } };
      const result = stepEnemy(enemyCatalog[archetype], observation(state), state);
      expect(Math.hypot(result.velocity.x, result.velocity.y)).toBeCloseTo(
        enemyCatalog[archetype].physics.maxSpeed,
      );
    },
  );
});

it("counts dormant pack survivors for morale without exposing hidden positions to steering or fire", () => {
  const state = { ...spawn("swarm"), facing: { x: 1, y: 0 }, packId: "pack" };
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
    (archetype) => enemyCatalog[archetype].physics.maxSpeed > 0,
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
    expect(pick("swarm")).toEqual({
      behaviour: "swarm",
      engagement: 360,
      hp: 2,
      sizeRatio: ENEMY_SIZE_RATIOS.swarm,
    });
    expect(pick("fighter")).toEqual({
      behaviour: "hitAndRun",
      engagement: 360,
      hp: 4,
      sizeRatio: ENEMY_SIZE_RATIOS.fighter,
    });
    expect(pick("interceptor")).toEqual({
      behaviour: "strafe",
      engagement: 260,
      hp: 3,
      sizeRatio: ENEMY_SIZE_RATIOS.interceptor,
    });
    expect(pick("retaliator")).toEqual({
      behaviour: "chase",
      engagement: 360,
      hp: 8,
      sizeRatio: ENEMY_SIZE_RATIOS.retaliator,
    });
    expect(pick("frigate")).toEqual({
      behaviour: "siege",
      engagement: 500,
      hp: 10,
      sizeRatio: ENEMY_SIZE_RATIOS.frigate,
    });
    expect(pick("capital")).toEqual({
      behaviour: "siege",
      engagement: 750,
      hp: 18,
      sizeRatio: ENEMY_SIZE_RATIOS.capital,
    });
    expect(enemyCatalog.retaliator.fire).toMatchObject({
      angles: [0],
      interval: WEAPON_CATALOG.rapidMissile[0].intervalSeconds,
      weapon: "rapidMissile",
    });
    expect(enemyCatalog.retaliator.aggression).toBe("retaliate");
    expect(enemyCatalog.swarm.steering).toEqual({ separation: 85, wobble: 0.65 });
    expect(Object.keys(enemyCatalog)).not.toContain("oversizedCapital");
  });

  it("gives the capital a command part, two engines, four turrets and two front Lasers", () => {
    const parts = enemyCatalog.capital.hardpoints;
    expect(
      parts.map((part) => (part.kind === "weapon" && part.fixed ? "front" : part.kind)),
    ).toEqual([
      "command",
      "engine",
      "engine",
      "weapon",
      "weapon",
      "weapon",
      "weapon",
      "front",
      "front",
    ]);
    // Hit areas of radius shipRadius + 6 (16 units) stay apart on the 100-unit hull; the front
    // Lasers sit out on the prow.
    const width = enemyCatalog.capital.sizeRatio * 20;
    for (const [index, part] of parts.entries()) {
      if (!(part.kind === "weapon" && part.fixed)) {
        expect(Math.max(Math.abs(part.offset.x), Math.abs(part.offset.y))).toBeLessThanOrEqual(0.5);
      }
      for (const other of parts.slice(index + 1)) {
        const gap = Math.hypot(part.offset.x - other.offset.x, part.offset.y - other.offset.y);
        expect(gap * width).toBeGreaterThanOrEqual(32);
      }
    }
  });

  it.each(archetypes)("moves %s with the shared ship movement model", (archetype) => {
    const definition = { ...enemyCatalog[archetype], navigation: null };
    const state: EnemyState = {
      ...spawn(archetype),
      heading: { x: 0, y: 1 },
      home: { x: -5000, y: 0 },
      returning: true,
      velocity: { x: 0, y: 10 },
    };
    const context = { ...observation(state), visibility: "unknown" as const };
    const speed = definition.physics.maxSpeed;
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
    const definition = { ...enemyCatalog.fighter, navigation: null };
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
    const definition = { ...enemyCatalog.frigate, navigation: null };
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
    const speed = definition.physics.maxSpeed;
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
    const speed = definition.physics.maxSpeed;
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
    const definition = { ...enemyCatalog.capital, navigation: null };
    const maxSpeed = definition.physics.maxSpeed;
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

  it("keeps the hull facing its drift when a disabled engine stops thrust", () => {
    const definition = enemyCatalog.frigate;
    const moving = {
      ...spawn("frigate"),
      facing: { x: 1, y: 0 },
      heading: { x: 1, y: 0 },
      velocity: { x: 30, y: 0 },
    };
    const engineLost = damageEnemy(definition, { amount: 4, hardpointId: "engine" }, moving);
    const context = { ...observation(engineLost), player: { x: 0, y: 300 } };
    const result = stepEnemy(definition, context, engineLost);
    // Ada lies to the side, but with no thrust the hull cannot steer toward her.
    expect(result.velocity.x).toBeGreaterThan(0);
    expect(result.velocity.x).toBeLessThan(30);
    expect(result.velocity.y).toBeCloseTo(0, 9);
    expect(result.state.facing).toEqual({ x: 1, y: 0 });
  });

  it("rotates legacy fraction offsets with the canonical hull span at exactly 90 degrees", () => {
    const definition = enemyCatalog.capital;
    const facing = { x: 1, y: 0 };
    const local = (id: string) => definition.hardpoints.find((part) => part.id === id)!.offset;
    const offset = (id: string) => hardpointOffset(definition, 20, facing, { offset: local(id) });
    // Omitting an id selects the legacy fallback; raw metadata anchors are covered separately.
    const width = definition.sizeRatio * 20;
    for (const id of ["weapon-left", "weapon-right"]) {
      expect(offset(id).x).toBeCloseTo(-local(id).y * width, 9);
      expect(offset(id).y).toBeCloseTo(local(id).x * width, 9);
    }
    expect(Math.sign(offset("weapon-left").y)).toBe(-1);
    const engine = hardpointOffset(definition, 20, facing, {
      offset: { x: 0.3, y: 0.35 },
    });
    expect(engine.x).toBeCloseTo(-0.35 * width, 9);
    expect(engine.y).toBeCloseTo(0.3 * width, 9);
  });

  it("aims weapons independently of the hull with aimTurnSeconds", () => {
    const definition = { ...enemyCatalog.frigate, navigation: null };
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
    const drift = aimDrift(aimed.id, aimed.age);
    const wantedFor = (id: string, facing = aimed.facing) => {
      const offset = hardpointOffset(
        definition,
        context.adaWidth,
        facing,
        definition.hardpoints.find((value) => value.id === id)!,
      );
      return rotate(
        {
          x: aimed.lastSeen.x - aimed.position.x - offset.x,
          y: aimed.lastSeen.y - aimed.position.y - offset.y,
        },
        drift,
      );
    };
    const wanted = wantedFor("starboard");
    expect(degreesBetween(part(turned, "starboard"), wanted)).toBeCloseTo(
      degreesBetween({ x: 1, y: 0 }, wanted) * Math.exp(-context.dt / response),
      6,
    );
    // A weapon with no previous aim acquires its drifted target line directly.
    expect(degreesBetween(part(turned, "port"), wantedFor("port"))).toBeLessThan(1e-9);
    // Changing hull facing rotates the anchor; the weapon still turns from its own prior aim.
    const rotated = stepEnemy(definition, context, { ...aimed, facing: { x: 1, y: 0 } }).state;
    const south = wantedFor("starboard", { x: 1, y: 0 });
    expect(degreesBetween(part(rotated, "starboard"), south)).toBeCloseTo(
      degreesBetween({ x: 1, y: 0 }, south) * Math.exp(-context.dt / response),
      6,
    );
    expect(rotated.facing).toEqual({ x: 1, y: 0 });
  });

  it("fires a turret along the smoothed aim rather than straight at the target", () => {
    // A turret hull weapon, as a mechanism fixture: catalog hulls carry turrets on hardpoints.
    const definition: EnemyDefinition = { ...enemyCatalog.retaliator, guns: { kind: "turrets" } };
    const state = { ...spawn("retaliator", definition), aim: { x: 0, y: 1 }, engaged: true };
    const context = observation(state);
    const result = stepEnemy(definition, context, state);
    expect(result.fire).toHaveLength(definition.fire.angles.length);
    const centre = result.fire[definition.fire.angles.indexOf(0)]!;
    for (const [index, shot] of result.fire.entries()) {
      const fan = fanHeading(result.state.aim!, definition.fire.angles[index]!);
      expect(shot.aim.x).toBeCloseTo(fan.x, 12);
      expect(shot.aim.y).toBeCloseTo(fan.y, 12);
    }
    const wanted = rotate({ x: 1, y: 0 }, aimDrift(state.id, state.age));
    expect(degreesBetween(centre.aim, wanted)).toBeCloseTo(
      degreesBetween({ x: 0, y: 1 }, wanted) *
        Math.exp(-context.dt / definition.physics.aimTurnSeconds),
      6,
    );
  });

  it("reports speed as a fraction of the archetype's maximum", () => {
    const half = enemyCatalog.interceptor.physics.maxSpeed / 2;
    const state = { ...spawn("interceptor"), velocity: { x: 0, y: half } };
    expect(enemySpeedFraction(enemyCatalog.interceptor, state)).toBeCloseTo(0.5, 12);
    expect(enemySpeedFraction(enemyCatalog.capital, state)).toBe(1);
    expect(enemySpeedFraction(enemyCatalog.platform, state)).toBe(0);
  });

  it.each(archetypes)("returns %s home through its momentum and patrols there", (archetype) => {
    const definition = enemyCatalog[archetype];
    const speed = definition.physics.maxSpeed;
    let state: EnemyState = {
      ...spawn(archetype),
      heading: { x: 0, y: 1 },
      position: { x: 300, y: 0 },
      returning: true,
      velocity: { x: 0, y: speed },
    };
    const context = { ...observation(state), visibility: "unknown" as const };
    let elapsed = 0;
    while (elapsed < 150) {
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
    expect(Math.hypot(state.position.x, state.position.y)).toBeLessThanOrEqual(480);
    expect(Math.hypot(state.velocity.x, state.velocity.y)).toBeGreaterThan(0);
  });
});

describe("enemy aim", () => {
  const angleOf = (vector: { x: number; y: number }) => Math.atan2(vector.y, vector.x);
  /**
   * A platform's shots after the first second while Ada circles it 300 units out at 100 units
   * per second. Each sample retains its actual muzzle's intercept geometry, aim angle, angle
   * ahead of the line to Ada and firing time.
   */
  function platformShots(
    seconds: number,
    lead = 1,
  ): { ahead: number; aimError: number; angle: number; part: string; time: number }[] {
    let state = { ...spawn("platform"), engaged: true, id: "platform:aim" };
    const radius = 300;
    const rate = 100 / radius;
    const shots: { ahead: number; aimError: number; angle: number; part: string; time: number }[] =
      [];
    const dt = 1 / 60;
    for (let frame = 0; frame < seconds / dt; frame++) {
      const time = frame * dt;
      const bearing = time * rate;
      const player = { x: Math.cos(bearing) * radius, y: Math.sin(bearing) * radius };
      const playerVelocity = { x: -Math.sin(bearing) * 100, y: Math.cos(bearing) * 100 };
      const result = stepEnemy(
        enemyCatalog.platform,
        { ...observation(state), dt, lead, player, playerVelocity },
        state,
      );
      for (const shot of result.fire) {
        const angle = angleOf(shot.aim);
        const line = angleOf({ x: player.x - shot.origin.x, y: player.y - shot.origin.y });
        const modelPart = enemyCatalog.platform.hardpoints.find(
          (part) => part.id === shot.hardpointId,
        )!;
        const offset = hardpointOffset(
          enemyCatalog.platform,
          observation(state).adaWidth,
          state.facing,
          modelPart,
        );
        const origin = { x: state.position.x + offset.x, y: state.position.y + offset.y };
        const intercept = leadPoint(
          origin,
          player,
          playerVelocity,
          shot.speed,
          leadSkill(lead, state.id),
        );
        const wanted =
          Math.atan2(intercept.y - origin.y, intercept.x - origin.x) +
          aimDrift(state.id, state.age);
        const previous = state.hardpoints.find((part) => part.id === shot.hardpointId)!.aim;
        const previousAngle = previous ? angleOf(previous) : wanted;
        const turn = Math.atan2(Math.sin(wanted - previousAngle), Math.cos(wanted - previousAngle));
        const expectedAngle =
          previousAngle + turn * (1 - Math.exp(-dt / enemyCatalog.platform.physics.aimTurnSeconds));
        const error = angle - expectedAngle;
        shots.push({
          ahead: angle - line,
          aimError: Math.atan2(Math.sin(error), Math.cos(error)),
          angle,
          part: shot.hardpointId!,
          time,
        });
      }
      state = result.state;
    }
    return shots.filter((shot) => shot.time > 1);
  }
  const parts = (shots: { part: string }[]) => [...new Set(shots.map((shot) => shot.part))];
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

  it("gives each ship one lead skill for its life, within 10% of its position's lead", () => {
    const skills = Array.from({ length: 200 }, (_, index) => leadSkill(0.6, `ship:${index}`));
    expect(leadSkill(0.6, "ship:7")).toBe(skills[7]);
    expect(Math.min(...skills)).toBeGreaterThanOrEqual(0.6 * 0.9);
    expect(Math.max(...skills)).toBeLessThanOrEqual(0.6 * 1.1);
    expect(new Set(skills).size).toBeGreaterThan(150);
    // Full lead never rises past aiming where Ada will be.
    const full = Array.from({ length: 50 }, (_, index) => leadSkill(1, `ship:${index}`));
    expect(Math.max(...full)).toBe(1);
    expect(ENEMY_AIM.lead).toEqual({ 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 0.9, 6: 1 });
  });

  it("drifts sideways smoothly up to 4 degrees, never jumping between shots", () => {
    const samples = Array.from({ length: 600 }, (_, index) => aimDrift("ship:1", index / 60));
    const peak = Math.max(...samples.map(Math.abs));
    expect(peak).toBeLessThanOrEqual((4 * Math.PI) / 180 + 1e-12);
    expect(peak).toBeGreaterThan((3.9 * Math.PI) / 180);
    for (let index = 1; index < samples.length; index++) {
      expect(Math.abs(samples[index]! - samples[index - 1]!)).toBeLessThan((0.3 * Math.PI) / 180);
    }
    expect(aimDrift("ship:2", 0)).not.toBe(aimDrift("ship:1", 0));
  });

  it("leads a moving Ada by the same share shot to shot, ahead of a direct aim", () => {
    const shots = platformShots(8);
    expect(shots.length).toBeGreaterThan(8);
    // Without lead the same turrets aim at Ada, give or take the drift and their turning lag.
    const direct = platformShots(8, 0);
    expect(direct.map(({ part, time }) => [part, time])).toEqual(
      shots.map(({ part, time }) => [part, time]),
    );
    // Each shot leaves ahead of the same shot aimed straight at her, whatever the drift.
    for (const [index, shot] of shots.entries()) {
      expect(shot.ahead).toBeGreaterThan(direct[index]!.ahead);
    }
    for (const part of parts(shots)) {
      // The canonical anchor and aim time constant define the per-frame intercept track.
      const error = shots.filter((shot) => shot.part === part).map((shot) => shot.aimError);
      for (const value of error) {
        expect(Math.abs(value)).toBeLessThan(1e-9);
      }
      expect(Math.max(...error) - Math.min(...error)).toBeLessThan(
        2 * ENEMY_AIM.driftRadians + 0.01,
      );
    }
    expect(mean(shots.map((shot) => shot.ahead))).toBeGreaterThan(
      mean(direct.map((shot) => shot.ahead)) + 0.1,
    );
  });

  it("sweeps a burst's shots during steady motion rather than scattering them", () => {
    const shots = platformShots(8);
    // The platform fires two-shot bursts 0.15 s apart. Each pair turns forward with Ada, by no
    // more than her bearing's turn plus the drift's fastest swing over that gap.
    const gap = 0.15;
    const most =
      (100 / 300) * gap + ((ENEMY_AIM.driftRadians * 2 * Math.PI) / ENEMY_AIM.driftPeriod) * gap;
    const steps: number[] = [];
    for (const part of parts(shots)) {
      const own = shots.filter((shot) => shot.part === part);
      for (let index = 1; index < own.length; index++) {
        if (own[index]!.time - own[index - 1]!.time < 0.2) {
          steps.push(own[index]!.angle - own[index - 1]!.angle);
        }
      }
    }
    expect(steps.length).toBeGreaterThan(4);
    for (const step of steps) {
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThan(most + 0.01);
    }
    // Nothing is random per shot: the same flight fires the same shots.
    expect(platformShots(8)).toEqual(shots);
  });

  it("trails a sudden turn, then converges on the new velocity within about 0.3 s", () => {
    let average = { x: 100, y: 0 };
    const turned = { x: -100, y: 0 };
    const after = (seconds: number) => {
      for (let step = 0; step < Math.round(seconds * 60); step++) {
        average = averageVelocity(1 / 60, average, turned);
      }
      return average;
    };
    // Still trailing the old heading just after the turn.
    expect(after(0.05).x).toBeGreaterThan(0);
    // Within 5% of the change by 0.3 s.
    expect(Math.abs(after(0.25).x - turned.x)).toBeLessThan(0.05 * 200);
  });

  it("never aims behind Ada and never leads by more than a second of her movement", () => {
    const velocity = { x: 80, y: -60 };
    for (const skill of [-0.5, 0, 0.3, 1, 2]) {
      for (const speed of [20, 200, 1000]) {
        for (const target of [
          { x: 300, y: 0 },
          { x: -50, y: 900 },
          { x: 0, y: 0.5 },
        ]) {
          const point = leadPoint({ x: 0, y: 0 }, target, velocity, speed, skill);
          const offset = { x: point.x - target.x, y: point.y - target.y };
          // Along her velocity only, from none to one second of it.
          expect(offset.x * velocity.x + offset.y * velocity.y).toBeGreaterThanOrEqual(0);
          expect(offset.x * velocity.y - offset.y * velocity.x).toBeCloseTo(0, 9);
          expect(Math.hypot(offset.x, offset.y)).toBeLessThanOrEqual(
            Math.hypot(velocity.x, velocity.y) * ENEMY_AIM.maxLeadSeconds + 1e-9,
          );
        }
      }
    }
    expect(leadPoint({ x: 0, y: 0 }, { x: 300, y: 0 }, velocity, 200, 0)).toEqual({ x: 300, y: 0 });
  });

  it("meets a target that keeps its velocity at full lead", () => {
    const velocity = { x: 0, y: 100 };
    const point = leadPoint({ x: 0, y: 0 }, { x: 300, y: 0 }, velocity, 340, 1);
    const time = Math.hypot(point.x, point.y) / 340;
    expect(point.y).toBeCloseTo(velocity.y * time, 9);
  });
});

describe("enemy damage", () => {
  it("hits with the shared weapon's damage at its level, the same whoever fires it", () => {
    for (const level of [1, 2, 3] as const) {
      expect(fireDamageRatio({ level, weapon: "laser" })).toBe(
        WEAPON_CATALOG.laser[level - 1]!.damageRatio,
      );
    }
    // A level 1 Laser shot deals 1 damage.
    expect(fireDamageRatio({ level: 1, weapon: "laser" })).toBe(1);
    expect(fireDamageRatio({ level: 1, weapon: "ringBurst" })).toBe(1.5);
    expect(fireDamageRatio({ level: 1, weapon: "mineLayer" })).toBe(3);
    expect(fireDamageRatio({ level: 1, weapon: "chargedLance" })).toBe(
      ENEMY_ONLY_DAMAGE.chargedLance,
    );
  });

  it("fires each volley with its profile's damage", () => {
    const definition = enemyDefinition(2, "fighter", "damage-profile", 3);
    const state = {
      ...spawn("fighter", definition),
      facing: { x: 1, y: 0 },
      weaponLevel: 3 as const,
    };
    const result = stepEnemy(definition, observation(state), state);
    expect(result.fire.length).toBeGreaterThan(0);
    for (const shot of result.fire) {
      expect(shot.damageRatio).toBe(WEAPON_CATALOG.multiLaser[2].damageRatio);
    }
  });
});

describe("new sight engagement admission", () => {
  it("lets an unadmitted ship patrol while tracking Ada without starting combat", () => {
    const state = spawn("fighter");
    const intent = stepEnemy(
      enemyCatalog.fighter,
      { ...observation(state), engagementAdmitted: false },
      state,
    );
    expect(intent.state.engaged).toBe(false);
    expect(intent.state.lastSeen).toEqual(observation(state).player);
    expect(Math.hypot(intent.velocity.x, intent.velocity.y)).toBeGreaterThan(0);
    expect(intent.fire).toEqual([]);
  });

  it("keeps damage, summons and existing combat authoritative when admission is false", () => {
    const state = spawn("fighter");
    const context = { ...observation(state), engagementAdmitted: false };
    const hit = damageEnemy(enemyCatalog.fighter, { amount: 1, hardpointId: null }, state);
    expect(stepEnemy(enemyCatalog.fighter, context, hit).state.engaged).toBe(true);
    expect(
      stepEnemy(enemyCatalog.fighter, { ...context, summoned: true }, state).state.engaged,
    ).toBe(true);
    const engaged = { ...state, engaged: true };
    expect(stepEnemy(enemyCatalog.fighter, context, engaged)).toEqual(
      stepEnemy(enemyCatalog.fighter, observation(engaged), engaged),
    );
  });

  it("preserves the default context and the existing return rearm rule", () => {
    const state = spawn("fighter");
    expect(
      stepEnemy(enemyCatalog.fighter, { ...observation(state), engagementAdmitted: true }, state),
    ).toEqual(stepEnemy(enemyCatalog.fighter, observation(state), state));
    const returning = { ...state, returnSeconds: 5, returning: true };
    expect(
      stepEnemy(
        enemyCatalog.fighter,
        { ...observation(returning), engagementAdmitted: false },
        returning,
      ).state.engaged,
    ).toBe(stepEnemy(enemyCatalog.fighter, observation(returning), returning).state.engaged);
  });
});

describe("small craft nose fire and large ship facing", () => {
  type Vector = { x: number; y: number };
  const degreesBetween = (a: Vector, b: Vector) =>
    (Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)) * 180) / Math.PI;
  const dot = (a: Vector, b: Vector) => a.x * b.x + a.y * b.y;
  const toward = (from: Vector, to: Vector) => {
    const size = Math.hypot(to.x - from.x, to.y - from.y);
    return { x: (to.x - from.x) / size, y: (to.y - from.y) / size };
  };
  /** Explicit test values, independent of the shipped catalog values. */
  const guns = {
    arcRadians: (20 * Math.PI) / 180,
    kind: "forward" as const,
    lateralShare: 0.8,
    reverseShare: 0.6,
  };
  const arcDegrees = 20;
  const driftDegrees = (ENEMY_AIM.driftRadians * 180) / Math.PI;
  // Ada holds still, so the aim point is her position turned by at most the aim drift.
  const reach = arcDegrees + driftDegrees + 1e-6;
  const nosed = (archetype: EnemyArchetype, patch: Partial<EnemyDefinition> = {}) => ({
    ...enemyCatalog[archetype],
    guns,
    ...patch,
  });
  const ada = { x: 0, y: 0 };
  interface Step {
    before: EnemyState;
    intent: ReturnType<typeof stepEnemy>;
  }
  /** Steps a ship at 60 Hz for `seconds` against a still Ada, moving it by its velocity. */
  function fly(definition: EnemyDefinition, seconds: number, state: EnemyState): Step[] {
    const steps: Step[] = [];
    let current = state;
    for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
      const intent = stepEnemy(
        definition,
        { ...observation(current), peers: [current], player: ada },
        current,
      );
      steps.push({ before: current, intent });
      const { velocity } = intent.state;
      current = {
        ...intent.state,
        position: {
          x: current.position.x + velocity.x / 60,
          y: current.position.y + velocity.y / 60,
        },
      };
    }
    return steps;
  }
  const last = (steps: Step[]) => steps[steps.length - 1]!.intent.state;
  /** Every shot leaves along the facing, with Ada's aim point inside the nose arc. */
  function expectNoseShots(definition: EnemyDefinition, steps: Step[]) {
    for (const { before, intent } of steps) {
      for (const [index, shot] of intent.fire.entries()) {
        const fan = fanHeading(
          intent.state.facing,
          definition.fire.angles[index % definition.fire.angles.length]!,
        );
        expect(shot.aim.x).toBeCloseTo(fan.x, 9);
        expect(shot.aim.y).toBeCloseTo(fan.y, 9);
        expect(degreesBetween(intent.state.facing, toward(before.position, ada))).toBeLessThan(
          reach,
        );
      }
    }
  }

  it("caps a strafing request by its direction relative to the facing", () => {
    const facing = { x: 1, y: 0 };
    expect(strafeLimited(guns, facing, { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(strafeLimited(guns, facing, { x: 0, y: -1 }).y).toBeCloseTo(-0.8, 12);
    expect(strafeLimited(guns, facing, { x: -1, y: 0 }).x).toBeCloseTo(-0.6, 12);
    const ahead = strafeLimited(guns, facing, { x: Math.SQRT1_2, y: Math.SQRT1_2 });
    expect(Math.hypot(ahead.x, ahead.y)).toBeCloseTo(
      1 / Math.hypot(Math.SQRT1_2, Math.SQRT1_2 / 0.8),
      12,
    );
    expect(ahead.x).toBeCloseTo(ahead.y, 12);
    const behind = strafeLimited(guns, facing, { x: -Math.SQRT1_2, y: Math.SQRT1_2 });
    expect(Math.hypot(behind.x, behind.y)).toBeCloseTo(
      1 / Math.hypot(Math.SQRT1_2 / 0.6, Math.SQRT1_2 / 0.8),
      12,
    );
    // A request already inside the cap is unchanged.
    expect(strafeLimited(guns, facing, { x: 0, y: 0.5 })).toEqual({ x: 0, y: 0.5 });
  });

  it("holds a small craft's fire until its nose turns Ada's aim point into the arc", () => {
    const definition = nosed("fighter");
    const state = { ...spawn("fighter", definition), engaged: true, position: { x: -300, y: 0 } };
    const steps = fly(definition, 1, state);
    // The nose turns from straight up toward the drifted aim point with aimTurnSeconds.
    const pointed = rotate({ x: 1, y: 0 }, aimDrift(state.id, state.age));
    expect(degreesBetween(steps[0]!.intent.state.facing, pointed)).toBeCloseTo(
      degreesBetween({ x: 0, y: -1 }, pointed) *
        Math.exp(-1 / 60 / definition.physics.aimTurnSeconds),
      6,
    );
    const first = steps.findIndex(({ intent }) => intent.fire.length > 0);
    expect(first).toBeGreaterThan(0);
    for (const { before, intent } of steps.slice(0, first)) {
      expect(degreesBetween(intent.state.facing, toward(before.position, ada))).toBeGreaterThan(
        arcDegrees - driftDegrees,
      );
    }
    expectNoseShots(definition, steps);
  });

  it("fires a fighter crossing past Ada only inside the nose arc, never astern", () => {
    // A long burst keeps the fighter attacking through the crossing.
    const definition = nosed("fighter", { behaviour: { burstVolleys: 99, kind: "hitAndRun" } });
    const steps = fly(definition, 2, {
      ...spawn("fighter", definition),
      engaged: true,
      facing: { x: 1, y: 0 },
      heading: { x: 1, y: 0 },
      position: { x: -20, y: 40 },
      velocity: { x: 160, y: 0 },
    });
    expectNoseShots(definition, steps);
    expect(steps.some(({ intent }) => intent.fire.length > 0)).toBe(true);
    const outside = steps.filter(
      ({ before, intent }) =>
        degreesBetween(intent.state.facing, toward(before.position, ada)) > reach,
    );
    expect(outside.length).toBeGreaterThan(0);
    expect(outside.every(({ intent }) => intent.fire.length === 0)).toBe(true);
    for (const { before, intent } of steps) {
      for (const shot of intent.fire) {
        expect(dot(shot.aim, toward(before.position, ada))).toBeGreaterThan(0);
      }
    }
  });

  it("turns a hit-and-run fighter to its travel and holds fire through the retreat", () => {
    const definition = nosed("fighter");
    const start = spawn("fighter", definition);
    const steps = fly(definition, 1.5, {
      ...start,
      engaged: true,
      facing: { x: 1, y: 0 },
      position: { x: -250, y: 0 },
      // A finished burst pulls it out on this step.
      tactic: { ...start.tactic, volleys: 3 },
    });
    expect(steps[0]!.intent.state.tactic.phase).toBe("retreat");
    const retreating = steps.filter(({ intent }) => intent.state.tactic.phase === "retreat");
    expect(retreating.length).toBeGreaterThan(30);
    expect(retreating.every(({ intent }) => intent.fire.length === 0)).toBe(true);
    const late = retreating[retreating.length - 1]!.intent.state;
    expect(degreesBetween(late.facing, late.velocity)).toBeLessThan(5);
    expect(dot(late.facing, toward(late.position, ada))).toBeLessThan(0);
  });

  it("keeps a standoff fighter's nose on Ada while it strafes sideways and backs off", () => {
    const definition = nosed("fighter");
    const maxSpeed = definition.physics.maxSpeed;
    // The hitAndRun attack band centres on 250: the request there is straight sideways.
    const strafe = fly(definition, 1, {
      ...spawn("fighter", definition),
      engaged: true,
      facing: { x: 1, y: 0 },
      position: { x: -250, y: 0 },
      primaryCooldown: 999,
    });
    const side = last(strafe);
    expect(degreesBetween(side.facing, toward(side.position, ada))).toBeLessThan(
      driftDegrees + 0.5,
    );
    const speed = Math.hypot(side.velocity.x, side.velocity.y);
    expect(speed).toBeGreaterThan(0.5 * maxSpeed);
    expect(speed).toBeLessThan(0.8 * maxSpeed * 1.02);
    expect(Math.abs(dot(side.velocity, side.facing))).toBeLessThan(0.25 * speed);
    // Inside the band it backs straight off at up to the backing-off share, nose still on Ada.
    const backing = fly(definition, 0.6, {
      ...spawn("fighter", definition),
      engaged: true,
      facing: { x: 1, y: 0 },
      position: { x: -120, y: 0 },
      primaryCooldown: 999,
    });
    for (const { intent } of backing) {
      const { facing, velocity } = intent.state;
      expect(-dot(velocity, facing)).toBeLessThan(0.6 * maxSpeed * 1.02);
    }
    const back = last(backing);
    expect(-dot(back.velocity, back.facing)).toBeGreaterThan(0.4 * maxSpeed);
    expect(degreesBetween(back.facing, toward(back.position, ada))).toBeLessThan(
      driftDegrees + 0.5,
    );
  });

  it("breaks off an interceptor's pass after closest approach at full speed, holding fire", () => {
    const definition = nosed("interceptor");
    const speed = definition.physics.maxSpeed;
    const start = spawn("interceptor", definition);
    const steps = fly(definition, 1.2, {
      ...start,
      engaged: true,
      facing: { x: 1, y: 0 },
      heading: { x: 1, y: 0 },
      position: { x: -200, y: 160 },
      tactic: { ...start.tactic, phase: "pass" },
      velocity: { x: speed, y: 0 },
    });
    const looped = steps.findIndex(({ intent }) => intent.state.tactic.phase === "loop");
    expect(looped).toBeGreaterThan(0);
    // It loops once the range opens, at its closest approach.
    const turn = steps[looped]!.before;
    expect(dot(turn.velocity, toward(turn.position, ada))).toBeLessThan(0);
    expect(
      dot(steps[looped - 1]!.before.velocity, toward(steps[looped - 1]!.before.position, ada)),
    ).toBeGreaterThanOrEqual(0);
    const after = steps.slice(looped);
    expect(after.every(({ intent }) => intent.fire.length === 0)).toBe(true);
    const end = last(steps);
    expect(end.tactic.phase).toBe("loop");
    expect(degreesBetween(end.facing, end.velocity)).toBeLessThan(5);
    // Uncapped by the strafe limits, unlike the 0.6 share a nose on Ada would allow backing off.
    expect(Math.hypot(end.velocity.x, end.velocity.y)).toBeGreaterThan(0.8 * speed);
    expectNoseShots(definition, steps);
  });

  it("turns a frigate's hull to its heading while a turret fires at Ada astern", () => {
    const definition = enemyCatalog.frigate;
    const start = spawn("frigate");
    const speed = definition.physics.maxSpeed;
    const steps = fly(definition, 0.6, {
      ...start,
      engaged: true,
      facing: { x: 1, y: 0 },
      firePhasesInitialized: true,
      hardpoints: start.hardpoints.map((part) => ({ ...part, cooldown: 0.3 })),
      heading: { x: -1, y: 0 },
      position: { x: -300, y: 0 },
      velocity: { x: -speed, y: 0 },
    });
    const end = last(steps);
    expect(degreesBetween(end.facing, end.velocity)).toBeLessThan(5);
    expect(dot(end.facing, toward(end.position, ada))).toBeLessThan(0);
    const astern = steps.flatMap(({ intent }) =>
      intent.fire.filter((shot) => dot(shot.aim, intent.state.facing) < -0.9),
    );
    expect(astern.length).toBeGreaterThan(0);
  });

  it("fires a retaliator's forward launcher only along its facing, inside the arc", () => {
    const definition = nosed("retaliator");
    // Ada abeam: no shot, and the launcher points along the hull.
    const abeam = {
      ...spawn("retaliator", definition),
      engaged: true,
      position: { x: -300, y: 0 },
    };
    const held = stepEnemy(definition, { ...observation(abeam), player: ada }, abeam);
    expect(held.fire).toEqual([]);
    expect(held.state.aim).toEqual(held.state.facing);
    const steps = fly(definition, 3, abeam);
    expectNoseShots(definition, steps);
    expect(steps.some(({ intent }) => intent.fire.length > 0)).toBe(true);
    for (const { intent } of steps) {
      expect(intent.state.aim).toEqual(intent.state.facing);
    }
  });

  it("holds a retaliator's nose on Ada while it strafes in its band", () => {
    const definition = nosed("retaliator");
    const maxSpeed = definition.physics.maxSpeed;
    const steps = fly(definition, 2, {
      ...spawn("retaliator", definition),
      engaged: true,
      facing: { x: 1, y: 0 },
      position: { x: -300, y: 0 },
    });
    // The nose turns onto the aim point with the class's aimTurnSeconds, then holds Ada inside
    // the arc as she slides across it.
    for (const { before, intent } of steps.slice(30)) {
      expect(degreesBetween(intent.state.facing, toward(before.position, ada))).toBeLessThan(
        arcDegrees,
      );
    }
    const end = last(steps);
    const range = Math.hypot(end.position.x, end.position.y);
    const band = definition.standoff!;
    expect(range).toBeGreaterThan(band.near);
    expect(range).toBeLessThan(band.far);
    const speed = Math.hypot(end.velocity.x, end.velocity.y);
    expect(speed).toBeGreaterThan(0.3 * maxSpeed);
    expect(speed).toBeLessThan(0.8 * maxSpeed * 1.02);
    expect(Math.abs(dot(end.velocity, end.facing))).toBeLessThan(0.5 * speed);
    expectNoseShots(definition, steps);
    expect(steps.some(({ intent }) => intent.fire.length > 0)).toBe(true);
  });

  it("gives every ship with fixed forward guns the shared nose values and a hull turn rate", () => {
    const kinds = Object.fromEntries(
      Object.entries(enemyCatalog).map(([kind, ship]) => [kind, ship.guns.kind]),
    );
    expect(kinds).toEqual({
      capital: "turrets",
      fighter: "forward",
      frigate: "turrets",
      interceptor: "forward",
      platform: "turrets",
      retaliator: "forward",
      swarm: "forward",
    });
    for (const ship of Object.values(enemyCatalog)) {
      if (ship.guns.kind !== "turrets") {
        expect(ship.guns).toEqual(guns);
        expect(ship.physics.aimTurnSeconds).toBeGreaterThan(0);
      }
    }
  });

  it("steps nose fire deterministically across a JSON round trip", () => {
    const definition = nosed("fighter", { behaviour: { burstVolleys: 99, kind: "hitAndRun" } });
    const state: EnemyState = {
      ...spawn("fighter", definition),
      engaged: true,
      facing: { x: 1, y: 0 },
      heading: { x: 1, y: 0 },
      position: { x: -20, y: 40 },
      velocity: { x: 160, y: 0 },
    };
    const first = fly(definition, 1, state);
    expect(fly(definition, 1, state)).toEqual(first);
    const middle = first[29]!.intent.state;
    const resumed = fly(definition, 0.5, JSON.parse(JSON.stringify(middle)) as EnemyState);
    expect(resumed).toEqual(fly(definition, 0.5, middle));
  });
});
