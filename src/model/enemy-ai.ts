import type { EnemyArchetype, EnemyDefinition, FireProfile, Point } from "../data/enemy-catalog.ts";

export interface HardpointState {
  cooldown: number;
  hp: number;
  id: string;
}
export interface EnemyState {
  age: number;
  archetype: EnemyArchetype;
  engaged: boolean;
  fleeing: boolean;
  hardpoints: HardpointState[];
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
const unit = (point: Point): Point => {
  const size = magnitude(point);
  return size ? { x: point.x / size, y: point.y / size } : { x: 0, y: 0 };
};

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
    ...identity,
    engaged: false,
    fleeing: false,
    hardpoints: definition.hardpoints.map((part) => ({ cooldown: 0, hp: part.hp, id: part.id })),
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

function steering(
  definition: EnemyDefinition,
  context: EnemyContext,
  aim: Point,
  state: EnemyState,
): Point {
  if (state.returning) {
    const home = { x: state.home.x - state.position.x, y: state.home.y - state.position.y };
    return magnitude(home) <= 5 ? { x: 0, y: 0 } : unit(home);
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
  const alive = context.peers.filter(
    (peer) =>
      peer.packId === state.packId && (peer.hp > 0 || peer.hardpoints.some((part) => part.hp > 0)),
  ).length;
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
  const playerHomeDistance = Math.hypot(
    context.player.x - state.home.x,
    context.player.y - state.home.y,
  );
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
    if (homeDistance <= 5 && observed && playerHomeDistance > definition.perception) {
      next.returning = false;
      next.pursuitSeconds = 0;
    }
  }
  const heading = steering(definition, context, aim, next);
  const speed =
    context.adaSpeed * Math.max(0, Math.min(context.speedCapRatio, definition.speedRatio));
  const blend = 1 - Math.exp(-context.dt / Math.max(0.001, definition.steering.response));
  next.velocity =
    effects.defeated || effects.movementStopped || (next.returning && homeDistance <= 5)
      ? { x: 0, y: 0 }
      : {
          x: state.velocity.x + (heading.x * speed - state.velocity.x) * blend,
          y: state.velocity.y + (heading.y * speed - state.velocity.y) * blend,
        };
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
  const cycle = (
    profile: FireProfile,
    offset: Point,
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
            x: aim.x * Math.cos(angle) - aim.y * Math.sin(angle),
            y: aim.x * Math.sin(angle) + aim.y * Math.cos(angle),
          },
          delay,
          hardpointId,
          origin: { x: state.position.x + offset.x, y: state.position.y + offset.y },
          profileId: profile.id,
          projectile: profile.projectile,
          speed: context.adaSpeed * profile.projectileSpeedRatio,
        });
      }
      delay += interval;
    }
    return delay - context.dt;
  };
  next.primaryCooldown = definition.hardpoints.length
    ? 0
    : cycle(definition.fire, { x: 0, y: 0 }, null, state.primaryCooldown);
  for (const part of definition.hardpoints) {
    const value = next.hardpoints.find((entry) => entry.id === part.id);
    if (part.kind === "weapon" && value && value.hp > 0) {
      value.cooldown = cycle(
        part.fire,
        {
          x: part.offset.x * definition.sizeRatio * context.adaWidth,
          y: part.offset.y * definition.sizeRatio * context.adaWidth,
        },
        part.id,
        value.cooldown,
      );
    }
  }
  return { aim, effects, fire, state: next, velocity: next.velocity };
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
