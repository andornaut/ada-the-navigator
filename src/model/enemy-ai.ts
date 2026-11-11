import type {
  EnemyArchetype,
  EnemyDefinition,
  FireProfile,
  HardpointDefinition,
  Point,
} from "../data/enemy-catalog.ts";
import {
  direction,
  hullOffset,
  speedFraction,
  stepShipMotion,
  turnToward,
} from "./ship-physics.ts";

export interface HardpointState {
  /** Smoothed weapon aim; null until the weapon first has a target direction. */
  aim: Point | null;
  cooldown: number;
  hp: number;
  id: string;
}
export interface EnemyState {
  age: number;
  /** Smoothed hull-weapon aim; null until the ship first has a target direction. */
  aim: Point | null;
  archetype: EnemyArchetype;
  engaged: boolean;
  /** Unit hull facing; hardpoint offsets rotate with it. */
  facing: Point;
  fleeing: boolean;
  hardpoints: HardpointState[];
  /** Smoothed movement heading; null at rest or with no movement request. */
  heading: Point | null;
  home: Point;
  hp: number;
  id: string;
  lastSeen: Point | null;
  lastSeenAge: number;
  packId: string | null;
  phase: number;
  position: Point;
  primaryCooldown: number;
  pursuitSeconds: number;
  returning: boolean;
  velocity: Point;
}
export interface EnemyContext {
  dormantPackMembers?: Readonly<Record<string, number>>;
  adaSpeed: number;
  adaWidth: number;
  dt: number;
  initialPackSizes: Readonly<Record<string, number>>;
  peers: readonly EnemyState[];
  player: Point;
  speedCapRatio: number;
  targetable: boolean;
  visibility: "visible" | "occluded" | "unknown";
}
export interface FireIntent {
  aim: Point;
  delay: number;
  hardpointId: string | null;
  origin: Point;
  profileId: string;
  projectile: FireProfile["projectile"];
  speed: number;
}
export interface EnemyEffects {
  defeated: boolean;
  disabledHardpoints: string[];
  movementStopped: boolean;
}
export interface EnemyIntent {
  aim: Point;
  effects: EnemyEffects;
  fire: FireIntent[];
  state: EnemyState;
  velocity: Point;
}

const magnitude = (point: Point): number => Math.hypot(point.x, point.y);
const unit = direction;
const UP: Point = { x: 0, y: -1 };

/** Maximum speed after the shared speed cap. */
export function enemyMaxSpeed(
  definition: EnemyDefinition,
  adaSpeed: number,
  speedCapRatio: number,
): number {
  return adaSpeed * Math.max(0, Math.min(speedCapRatio, definition.physics.speedRatio));
}

/** Current speed as a fraction of the enemy's maximum speed, clamped to [0, 1], for jets. */
export function enemySpeedFraction(
  definition: EnemyDefinition,
  adaSpeed: number,
  speedCapRatio: number,
  state: Pick<EnemyState, "velocity">,
): number {
  return speedFraction(enemyMaxSpeed(definition, adaSpeed, speedCapRatio), state.velocity);
}

/** World-axis offset of a hardpoint from the hull centre for the given hull facing. */
export function hardpointOffset(
  definition: EnemyDefinition,
  adaWidth: number,
  facing: Point,
  part: Pick<HardpointDefinition, "offset">,
): Point {
  const width = definition.sizeRatio * adaWidth;
  return hullOffset(facing, { x: part.offset.x * width, y: part.offset.y * width });
}

/** Saved enemy state, which older saves record without orientation or aim. */
export type SavedEnemyState = Omit<EnemyState, "aim" | "facing" | "hardpoints" | "heading"> & {
  aim?: Point | null;
  facing?: Point;
  hardpoints: (Omit<HardpointState, "aim"> & { aim?: Point | null })[];
  heading?: Point | null;
};

/** Keeps a saved unit vector bit-for-bit so restored simulation stays deterministic. */
const savedDirection = (value: Point | null | undefined): Point | null => {
  if (!value || !magnitude(value)) {
    return null;
  }
  return Math.abs(magnitude(value) - 1) <= 1e-9 ? { ...value } : direction(value);
};

/**
 * Completes orientation state from a save: a missing facing starts from the velocity
 * direction, or up when stopped; a missing heading or aim starts unset.
 */
export function restoreEnemyOrientation(saved: SavedEnemyState): EnemyState {
  return {
    ...saved,
    aim: savedDirection(saved.aim),
    facing: savedDirection(saved.facing) ?? savedDirection(saved.velocity) ?? { ...UP },
    hardpoints: saved.hardpoints.map((part) => ({ ...part, aim: savedDirection(part.aim) })),
    heading: savedDirection(saved.heading),
  };
}

export function enemyEffects(definition: EnemyDefinition, state: EnemyState): EnemyEffects {
  const disabledHardpoints = definition.hardpoints
    .filter((part) => !state.hardpoints.some((value) => value.id === part.id && value.hp > 0))
    .map((part) => part.id);
  const required = definition.hardpoints.filter((part) => part.required);
  return {
    defeated: required.length
      ? required.every((part) => disabledHardpoints.includes(part.id))
      : state.hp <= 0,
    disabledHardpoints,
    movementStopped: definition.hardpoints.some(
      (part) => part.kind === "engine" && disabledHardpoints.includes(part.id),
    ),
  };
}

export function createEnemy(
  definition: EnemyDefinition,
  identity: { archetype: EnemyArchetype; id: string; packId: string | null; phase: number },
  position: Point,
): EnemyState {
  return {
    age: 0,
    aim: null,
    ...identity,
    engaged: false,
    facing: { ...UP },
    fleeing: false,
    hardpoints: definition.hardpoints.map((part) => ({
      aim: null,
      cooldown: 0,
      hp: part.hp,
      id: part.id,
    })),
    heading: null,
    home: { ...position },
    hp: definition.hp,
    lastSeen: null,
    lastSeenAge: 0,
    position: { ...position },
    primaryCooldown: 0,
    pursuitSeconds: 0,
    returning: false,
    velocity: { x: 0, y: 0 },
  };
}

/** Null selects the hull. Required hardpoints cannot be bypassed by hull damage. */
export function damageEnemy(
  definition: EnemyDefinition,
  hit: { amount: number; hardpointId: string | null },
  state: EnemyState,
): EnemyState {
  if (!Number.isFinite(hit.amount) || hit.amount <= 0 || enemyEffects(definition, state).defeated) {
    return state;
  }
  if (
    hit.hardpointId !== null &&
    !definition.hardpoints.some((part) => part.id === hit.hardpointId)
  ) {
    return state;
  }
  return {
    ...state,
    engaged: true,
    hardpoints: state.hardpoints.map((part) =>
      part.id === hit.hardpointId
        ? { ...part, hp: Math.max(0, part.hp - hit.amount) }
        : { ...part },
    ),
    hp: hit.hardpointId === null ? Math.max(0, state.hp - hit.amount) : state.hp,
  };
}

/** Desired movement as a fraction of maximum speed: a unit vector, or shorter on arrival. */
function steering(
  definition: EnemyDefinition,
  context: EnemyContext,
  maxSpeed: number,
  aim: Point,
  state: EnemyState,
): Point {
  if (state.returning) {
    const home = { x: state.home.x - state.position.x, y: state.home.y - state.position.y };
    const distance = magnitude(home);
    if (distance <= 5) {
      return { x: 0, y: 0 };
    }
    // Slow on approach so momentum cannot carry the ship around home.
    const arrival = Math.min(
      1,
      distance / Math.max(0.001, maxSpeed * definition.physics.brakingSeconds),
    );
    return { x: (home.x / distance) * arrival, y: (home.y / distance) * arrival };
  }
  if (state.fleeing) {
    return { x: -aim.x, y: -aim.y };
  }
  if (!state.engaged || !context.targetable || context.visibility !== "visible") {
    return { x: 0, y: 0 };
  }
  const distance = Math.hypot(
    context.player.x - state.position.x,
    context.player.y - state.position.y,
  );
  const radial = Math.max(-1, Math.min(1, (distance - definition.engagement * 0.7) / 100));
  const orbit = definition.steering.orbit;
  const wobble = Math.sin(state.age * 3 + state.phase) * definition.steering.wobble;
  const desired = {
    x: aim.x * radial - aim.y * (orbit + wobble),
    y: aim.y * radial + aim.x * (orbit + wobble),
  };
  for (const peer of context.peers) {
    if (peer.id === state.id || peer.hp <= 0) {
      continue;
    }
    const delta = { x: state.position.x - peer.position.x, y: state.position.y - peer.position.y };
    const length = magnitude(delta);
    if (length > 0 && length < definition.steering.separation) {
      const weight = 1 - length / definition.steering.separation;
      desired.x += (delta.x / length) * weight;
      desired.y += (delta.y / length) * weight;
    }
  }
  return unit(desired);
}

/** Pure rules: positions are supplied by the runtime after collision resolution. */
export function stepEnemy(
  definition: EnemyDefinition,
  context: EnemyContext,
  state: EnemyState,
): EnemyIntent {
  if (!Number.isFinite(context.dt) || context.dt <= 0) {
    return {
      aim: { x: 0, y: 0 },
      effects: enemyEffects(definition, state),
      fire: [],
      state,
      velocity: { ...state.velocity },
    };
  }
  const effects = enemyEffects(definition, state);
  const observed = context.targetable && context.visibility === "visible";
  const target = observed ? context.player : (state.lastSeen ?? state.position);
  const delta = { x: target.x - state.position.x, y: target.y - state.position.y };
  const aim = unit(delta);
  const packSize = state.packId === null ? 0 : (context.initialPackSizes[state.packId] ?? 0);
  const alive =
    context.peers.filter(
      (peer) =>
        peer.packId === state.packId &&
        (peer.hp > 0 || peer.hardpoints.some((part) => part.hp > 0)),
    ).length + (state.packId === null ? 0 : (context.dormantPackMembers?.[state.packId] ?? 0));
  const packFlee = packSize > 1 && 1 - alive / packSize >= definition.morale.packLossRatio;
  const next: EnemyState = {
    ...state,
    age: state.age + context.dt,
    engaged:
      state.engaged ||
      (context.targetable &&
        context.visibility === "visible" &&
        definition.aggression === "sight" &&
        magnitude(delta) <= definition.perception),
    fleeing:
      state.fleeing ||
      packFlee ||
      (definition.morale.individualHpRatio > 0 &&
        state.hp / definition.hp <= definition.morale.individualHpRatio),
    hardpoints: state.hardpoints.map((part) => ({ ...part })),
  };
  if (observed) {
    next.lastSeen = { ...context.player };
    next.lastSeenAge = 0;
  } else {
    next.lastSeenAge += context.dt;
  }
  next.pursuitSeconds = next.engaged ? state.pursuitSeconds + context.dt : 0;
  const playerHomeDistance = observed
    ? Math.hypot(context.player.x - state.home.x, context.player.y - state.home.y)
    : 0;
  const homeDistance = Math.hypot(state.position.x - state.home.x, state.position.y - state.home.y);
  if (
    next.engaged &&
    (next.pursuitSeconds >= definition.pursuit.maxSeconds ||
      homeDistance >= definition.pursuit.homeRadius ||
      (observed && playerHomeDistance > definition.pursuit.homeRadius) ||
      next.lastSeenAge >= definition.pursuit.unseenSeconds)
  ) {
    next.returning = true;
  }
  if (next.returning) {
    next.engaged = false;
    if (
      state.returning &&
      homeDistance <= 5 &&
      observed &&
      playerHomeDistance > definition.perception
    ) {
      next.returning = false;
      next.pursuitSeconds = 0;
    }
  }
  const speed = enemyMaxSpeed(definition, context.adaSpeed, context.speedCapRatio);
  const request = steering(definition, context, speed, aim, next);
  const physics = definition.physics;
  if (effects.defeated || effects.movementStopped || (next.returning && homeDistance <= 5)) {
    next.velocity = { x: 0, y: 0 };
    next.heading = null;
  } else {
    const motion = stepShipMotion(
      physics,
      context.dt,
      { direction: request, speed: speed * Math.min(1, magnitude(request)) },
      { heading: state.heading, velocity: state.velocity },
    );
    next.velocity = motion.velocity;
    next.heading = motion.heading;
    // The hull turns smoothly even when movement starts directly from rest.
    if (magnitude(request)) {
      next.facing = turnToward(context.dt, physics.turnSeconds, request, state.facing);
    }
  }
  const velocitySize = magnitude(next.velocity);
  if (velocitySize > speed && velocitySize > 0) {
    next.velocity = {
      x: (next.velocity.x * speed) / velocitySize,
      y: (next.velocity.y * speed) / velocitySize,
    };
  }
  const fire: FireIntent[] = [];
  const canFire =
    !effects.defeated &&
    !next.returning &&
    !next.fleeing &&
    next.engaged &&
    context.targetable &&
    context.visibility === "visible" &&
    magnitude(delta) <= definition.engagement;
  /** Weapons track the target independently of the hull, turning with aimTurnSeconds. */
  const track = (origin: Point, current: Point | null): Point | null => {
    const wanted = unit({ x: target.x - origin.x, y: target.y - origin.y });
    if (!magnitude(wanted)) {
      return current;
    }
    return current ? turnToward(context.dt, physics.aimTurnSeconds, wanted, current) : wanted;
  };
  const cycle = (
    profile: FireProfile,
    origin: Point,
    muzzleAim: Point,
    hardpointId: string | null,
    cooldown: number,
  ): number => {
    const interval = Math.max(0.01, profile.interval);
    if (!canFire) {
      return Math.max(0, cooldown - context.dt);
    }
    let delay = Math.max(0, cooldown);
    while (delay < context.dt) {
      for (const angle of profile.angles) {
        fire.push({
          aim: {
            x: muzzleAim.x * Math.cos(angle) - muzzleAim.y * Math.sin(angle),
            y: muzzleAim.x * Math.sin(angle) + muzzleAim.y * Math.cos(angle),
          },
          delay,
          hardpointId,
          origin: { ...origin },
          profileId: profile.id,
          projectile: profile.projectile,
          speed: context.adaSpeed * profile.projectileSpeedRatio,
        });
      }
      delay += interval;
    }
    return delay - context.dt;
  };
  next.aim = track(state.position, state.aim);
  const hullAim = next.aim ?? { x: 0, y: 0 };
  next.primaryCooldown = definition.hardpoints.length
    ? 0
    : cycle(definition.fire, state.position, hullAim, null, state.primaryCooldown);
  for (const part of definition.hardpoints) {
    const value = next.hardpoints.find((entry) => entry.id === part.id);
    if (part.kind === "weapon" && value && value.hp > 0) {
      // Muzzles sit on the hull as it faced at the start of the step.
      const offset = hardpointOffset(definition, context.adaWidth, state.facing, part);
      const origin = { x: state.position.x + offset.x, y: state.position.y + offset.y };
      value.aim = track(origin, value.aim);
      value.cooldown = cycle(
        part.fire,
        origin,
        value.aim ?? { x: 0, y: 0 },
        part.id,
        value.cooldown,
      );
    }
  }
  return { aim: hullAim, effects, fire, state: next, velocity: next.velocity };
}

export interface BallisticDebris {
  id: string;
  position: Point;
  velocity: Point;
}

/** Debris has no perception, steering, targeting or firing state. */
export function stepDebris(dt: number, debris: BallisticDebris): BallisticDebris {
  if (!Number.isFinite(dt) || dt <= 0) {
    return debris;
  }
  return {
    ...debris,
    position: {
      x: debris.position.x + debris.velocity.x * dt,
      y: debris.position.y + debris.velocity.y * dt,
    },
    velocity: { ...debris.velocity },
  };
}
