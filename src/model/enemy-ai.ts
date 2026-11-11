import {
  type EnemyArchetype,
  enemyCatalog,
  type EnemyDefinition,
  escortTuning,
  type FireProfile,
  type HardpointDefinition,
  type Point,
} from "../data/enemy-catalog.ts";
import { MUZZLE_LAYOUTS } from "../data/enemy-muzzles.ts";
import { SHARED_SHIP_PHYSICS } from "../data/ship-physics.ts";
import { muzzleOffset } from "./muzzles.ts";
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
  /** Bolts already fired in the current burst, for a weapon that fires bursts. */
  burst?: number;
  cooldown: number;
  hp: number;
  id: string;
}
/** Behaviour phase memory for hit-and-run retreats and strafing passes. */
export interface TacticState {
  /** Hull plus hardpoint hp at the previous step, so a drop shows a hit. */
  integrity: number;
  /** `attack` presses in; `retreat` pulls away (hitAndRun); `pass` flies through (strafe). */
  phase: "attack" | "retreat" | "pass";
  /** Seconds in the current phase. */
  seconds: number;
  /** Volleys fired in the current attack. */
  volleys: number;
}
export interface EnemyState {
  age: number;
  /** Smoothed hull-weapon aim; null until the ship first has a target direction. */
  aim: Point | null;
  archetype: EnemyArchetype;
  engaged: boolean;
  /** The capital this ship escorts, or null. */
  escortOf: string | null;
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
  tactic: TacticState;
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
  /** True when every engine is disabled. */
  movementStopped: boolean;
  /** Fraction of engines still working: each gives an equal share of top speed. */
  thrust: number;
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

/** Saved enemy state; older saves lack orientation, aim, escort and behaviour state. */
export type SavedEnemyState = Omit<
  EnemyState,
  "aim" | "escortOf" | "facing" | "hardpoints" | "heading" | "tactic"
> & {
  aim?: Point | null;
  escortOf?: string | null;
  facing?: Point;
  hardpoints: (Omit<HardpointState, "aim"> & { aim?: Point | null })[];
  heading?: Point | null;
  tactic?: TacticState;
};

/** Hull plus hardpoint hp; a drop between steps means the ship was hit. */
export function enemyIntegrity(state: Pick<EnemyState, "hardpoints" | "hp">): number {
  return state.hardpoints.reduce((sum, part) => sum + part.hp, state.hp);
}

const freshTactic = (integrity: number): TacticState => ({
  integrity,
  phase: "attack",
  seconds: 0,
  volleys: 0,
});

/** Keeps a saved unit vector bit-for-bit so restored simulation stays deterministic. */
const savedDirection = (value: Point | null | undefined): Point | null => {
  if (!value || !magnitude(value)) {
    return null;
  }
  return Math.abs(magnitude(value) - 1) <= 1e-9 ? { ...value } : direction(value);
};

/**
 * Completes state from a save: a missing facing starts from the velocity direction, or up
 * when stopped; a missing heading or aim starts unset; a missing escort is none; a missing
 * behaviour state starts a fresh attack at the saved hp.
 */
export function restoreEnemyState(saved: SavedEnemyState): EnemyState {
  const hardpoints = saved.hardpoints.map((part) => ({ ...part, aim: savedDirection(part.aim) }));
  return {
    ...saved,
    aim: savedDirection(saved.aim),
    escortOf: saved.escortOf ?? null,
    facing: savedDirection(saved.facing) ?? savedDirection(saved.velocity) ?? { ...UP },
    hardpoints,
    heading: savedDirection(saved.heading),
    tactic: saved.tactic
      ? { ...saved.tactic }
      : freshTactic(enemyIntegrity({ hardpoints, hp: saved.hp })),
  };
}

export function enemyEffects(definition: EnemyDefinition, state: EnemyState): EnemyEffects {
  const disabledHardpoints = definition.hardpoints
    .filter((part) => !state.hardpoints.some((value) => value.id === part.id && value.hp > 0))
    .map((part) => part.id);
  const required = definition.hardpoints.filter((part) => part.required);
  const engines = definition.hardpoints.filter((part) => part.kind === "engine");
  const working = engines.filter((part) => !disabledHardpoints.includes(part.id)).length;
  return {
    defeated: required.length
      ? required.every((part) => disabledHardpoints.includes(part.id))
      : state.hp <= 0,
    disabledHardpoints,
    movementStopped: engines.length > 0 && working === 0,
    thrust: engines.length ? working / engines.length : 1,
  };
}

export function createEnemy(
  definition: EnemyDefinition,
  identity: {
    archetype: EnemyArchetype;
    escortOf?: string | null;
    id: string;
    packId: string | null;
    phase: number;
  },
  position: Point,
): EnemyState {
  return {
    age: 0,
    aim: null,
    ...identity,
    engaged: false,
    escortOf: identity.escortOf ?? null,
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
    tactic: freshTactic(definition.hardpoints.reduce((sum, part) => sum + part.hp, definition.hp)),
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

/** Push away from nearby live peers, strongest when closest. */
function separation(definition: EnemyDefinition, context: EnemyContext, state: EnemyState): Point {
  const push = { x: 0, y: 0 };
  for (const peer of context.peers) {
    if (peer.id === state.id || peer.hp <= 0) {
      continue;
    }
    const delta = { x: state.position.x - peer.position.x, y: state.position.y - peer.position.y };
    const length = magnitude(delta);
    if (length > 0 && length < definition.steering.separation) {
      const weight = 1 - length / definition.steering.separation;
      push.x += (delta.x / length) * weight;
      push.y += (delta.y / length) * weight;
    }
  }
  return push;
}

/** Steer to a point, slowing on approach so momentum cannot carry the ship around it. */
function arrive(
  definition: EnemyDefinition,
  maxSpeed: number,
  goal: Point,
  state: EnemyState,
): Point {
  const offset = { x: goal.x - state.position.x, y: goal.y - state.position.y };
  const distance = magnitude(offset);
  if (distance <= 5) {
    return { x: 0, y: 0 };
  }
  const arrival = Math.min(
    1,
    distance / Math.max(0.001, maxSpeed * definition.physics.brakingSeconds),
  );
  return { x: (offset.x / distance) * arrival, y: (offset.y / distance) * arrival };
}

/** The live capital an escort guards, if it is loaded. */
function escorted(context: EnemyContext, state: EnemyState): EnemyState | undefined {
  return state.escortOf === null
    ? undefined
    : context.peers.find(
        (peer) =>
          peer.id === state.escortOf &&
          (peer.hp > 0 || peer.hardpoints.some((part) => part.hp > 0)),
      );
}

/**
 * Advances the behaviour phase. Hit-and-run pulls away after a hit or a burst and returns
 * after its retreat; strafe flies straight through within its pass distance and loops back
 * beyond its loop distance. Leaving the engagement resets to a fresh attack.
 */
function nextTactic(
  definition: EnemyDefinition,
  next: EnemyState,
  distance: number,
  state: EnemyState,
): TacticState {
  const integrity = enemyIntegrity(next);
  const hit = integrity < state.tactic.integrity;
  const tactic: TacticState = {
    ...state.tactic,
    integrity,
    seconds: state.tactic.seconds + (next.age - state.age),
  };
  const enter = (phase: TacticState["phase"]): TacticState => ({
    ...tactic,
    phase,
    seconds: 0,
    volleys: 0,
  });
  if (!next.engaged || next.returning || next.fleeing) {
    return tactic.phase === "attack" && tactic.volleys === 0 ? tactic : enter("attack");
  }
  const behaviour = definition.behaviour;
  if (behaviour.kind === "hitAndRun") {
    if (tactic.phase === "attack" && (hit || tactic.volleys >= behaviour.burstVolleys)) {
      return enter("retreat");
    }
    if (tactic.phase === "retreat" && tactic.seconds >= behaviour.retreatSeconds) {
      return enter("attack");
    }
  } else if (behaviour.kind === "strafe") {
    if (tactic.phase === "attack" && distance <= behaviour.passDistance) {
      return enter("pass");
    }
    if (tactic.phase === "pass" && distance >= behaviour.loopDistance) {
      return enter("attack");
    }
  }
  return tactic;
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
    return arrive(definition, maxSpeed, state.home, state);
  }
  if (state.fleeing) {
    return { x: -aim.x, y: -aim.y };
  }
  if (!state.engaged || !context.targetable || context.visibility !== "visible") {
    return { x: 0, y: 0 };
  }
  const push = separation(definition, context, state);
  const toward = (scale: number): Point =>
    unit({ x: aim.x * scale + push.x, y: aim.y * scale + push.y });
  const capital = escorted(context, state);
  if (capital) {
    // Escorts hold a station beside the capital and intercept Ada when she comes close to it.
    const hull = (enemyCatalog[capital.archetype].sizeRatio * context.adaWidth) / 2;
    const reach = Math.hypot(
      context.player.x - capital.position.x,
      context.player.y - capital.position.y,
    );
    if (reach <= escortTuning.interceptRadius + hull) {
      return toward(1);
    }
    const gap = hull + escortTuning.stationGap;
    const station = {
      x: capital.position.x + Math.cos(state.phase) * gap,
      y: capital.position.y + Math.sin(state.phase) * gap,
    };
    return arrive(definition, maxSpeed, station, state);
  }
  const behaviour = definition.behaviour;
  switch (behaviour.kind) {
    case "chase":
      return toward(1);
    case "swarm": {
      // Sinusoidal phase makes the chase erratic without query-dependent RNG.
      const wobble = Math.sin(state.age * 3 + state.phase) * definition.steering.wobble;
      return unit({
        x: aim.x - aim.y * wobble + push.x,
        y: aim.y + aim.x * wobble + push.y,
      });
    }
    case "hitAndRun":
      return state.tactic.phase === "retreat" ? toward(-1) : toward(1);
    case "strafe": {
      // A pass keeps its course, so momentum carries the ship past Ada before it loops back.
      const course = unit(state.velocity);
      return state.tactic.phase === "pass" && magnitude(course) ? course : toward(1);
    }
    case "siege":
      break;
  }
  // Siege advances slowly while the turrets fire.
  const advance = toward(1);
  return { x: advance.x * behaviour.speedFraction, y: advance.y * behaviour.speedFraction };
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
  next.tactic = nextTactic(definition, next, magnitude(delta), state);
  // Each working engine gives an equal share of top speed; losing one slows the ship through
  // its own physics, while the shared cap still bounds saved momentum.
  const fullSpeed = enemyMaxSpeed(definition, context.adaSpeed, context.speedCapRatio);
  const speed = fullSpeed * effects.thrust;
  const request = steering(definition, context, speed, aim, next);
  const physics = definition.physics;
  if (effects.defeated || effects.movementStopped || (next.returning && homeDistance <= 5)) {
    next.velocity = { x: 0, y: 0 };
    next.heading = null;
  } else {
    const motion = stepShipMotion(
      physics,
      context.dt,
      { maxSpeed: fullSpeed, restHeading: state.facing },
      { direction: request, speed: speed * Math.min(1, magnitude(request)) },
      { heading: state.heading, velocity: state.velocity },
    );
    next.velocity = motion.velocity;
    next.heading = motion.heading;
    // The hull turns toward its velocity with the short shared hullTurnSeconds, so
    // collision slides do not snap it, and keeps its facing at rest. The heading starts
    // from the hull, so velocity and hull swing round together.
    if (magnitude(motion.velocity)) {
      next.facing = turnToward(
        context.dt,
        SHARED_SHIP_PHYSICS.hullTurnSeconds,
        motion.velocity,
        state.facing,
      );
    }
  }
  const velocitySize = magnitude(next.velocity);
  if (velocitySize > fullSpeed && velocitySize > 0) {
    next.velocity = {
      x: (next.velocity.x * fullSpeed) / velocitySize,
      y: (next.velocity.y * fullSpeed) / velocitySize,
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
  let volleys = 0;
  // A turret whose art defines muzzles fires from the drawn barrel tip of the hull's drawn
  // heading and the top's drawn aim frame, cycling barrels by volley; the shot still flies along
  // the continuous aim. Other weapons fire from the model origin.
  const layout = MUZZLE_LAYOUTS[state.archetype];
  const spawn = (origin: Point, turret: string | null, muzzleAim: Point, volley: number) => {
    const offset =
      turret === null ? undefined : muzzleOffset(layout, turret, state.facing, muzzleAim, volley);
    return offset ? { x: state.position.x + offset.x, y: state.position.y + offset.y } : origin;
  };
  /**
   * Fires each volley due this step and returns the next cooldown and burst position. A
   * burst's bolts follow `gap` apart and its next burst starts `interval` after its first.
   */
  const cycle = (
    profile: FireProfile,
    origin: Point,
    muzzleAim: Point,
    hardpointId: string | null,
    cooldown: number,
    burst = 0,
  ): { burst: number; cooldown: number } => {
    const interval = Math.max(0.01, profile.interval);
    const count = Math.max(1, profile.burst?.count ?? 1);
    const gap = Math.min(interval / count, Math.max(0, profile.burst?.gap ?? 0));
    if (!canFire) {
      return { burst: 0, cooldown: Math.max(0, cooldown - context.dt) };
    }
    let delay = Math.max(0, cooldown);
    let bolt = Math.min(burst, count - 1);
    while (delay < context.dt) {
      if (bolt === 0) {
        volleys++;
      }
      const volley = Math.floor((state.age + delay) / interval) * count + bolt;
      const from = spawn(origin, hardpointId, muzzleAim, volley);
      for (const angle of profile.angles) {
        fire.push({
          aim: {
            x: muzzleAim.x * Math.cos(angle) - muzzleAim.y * Math.sin(angle),
            y: muzzleAim.x * Math.sin(angle) + muzzleAim.y * Math.cos(angle),
          },
          delay,
          hardpointId,
          origin: { ...from },
          profileId: profile.id,
          projectile: profile.projectile,
          speed: context.adaSpeed * profile.projectileSpeedRatio,
        });
      }
      bolt++;
      if (bolt < count) {
        delay += gap;
      } else {
        delay += interval - gap * (count - 1);
        bolt = 0;
      }
    }
    return { burst: bolt, cooldown: delay - context.dt };
  };
  next.aim = track(state.position, state.aim);
  const hullAim = next.aim ?? { x: 0, y: 0 };
  next.primaryCooldown = definition.hardpoints.length
    ? 0
    : cycle(definition.fire, state.position, hullAim, null, state.primaryCooldown).cooldown;
  for (const part of definition.hardpoints) {
    const value = next.hardpoints.find((entry) => entry.id === part.id);
    if (part.kind === "weapon" && value && value.hp > 0) {
      // Muzzles sit on the hull as it faced at the start of the step.
      const offset = hardpointOffset(definition, context.adaWidth, state.facing, part);
      const origin = { x: state.position.x + offset.x, y: state.position.y + offset.y };
      value.aim = track(origin, value.aim);
      const fired = cycle(
        part.fire,
        origin,
        value.aim ?? { x: 0, y: 0 },
        part.id,
        value.cooldown,
        value.burst,
      );
      value.cooldown = fired.cooldown;
      if (part.fire.burst) {
        value.burst = fired.burst;
      }
    }
  }
  if (next.tactic.phase === "attack") {
    next.tactic = { ...next.tactic, volleys: next.tactic.volleys + volleys };
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
