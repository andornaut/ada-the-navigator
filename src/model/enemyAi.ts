import {
  ENEMY_AIM,
  type EnemyArchetype,
  enemyCatalog,
  type EnemyDefinition,
  escortTuning,
  fireDamageRatio,
  type FireProfile,
  type HardpointDefinition,
  type Point,
  type RetreatPolicy,
  RING_BOLTS,
} from "../data/enemyCatalog.ts";
import { MUZZLE_ART, muzzleLayout } from "../data/enemyMuzzles.ts";
import { SHARED_SHIP_PHYSICS } from "../data/shipPhysics.ts";
import { muzzleOffset } from "./muzzles.ts";
import { fanHeading } from "./playerProjectiles.ts";
import { direction, hullOffset, speedFraction, stepShipMotion, turnToward } from "./shipPhysics.ts";

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
/** One bounded retreat and its recovery cooldown, retained exactly across a saved flight. */
export interface RetreatState {
  away: Point;
  endedAt?: number;
  kind: "hitAndRun" | "morale";
  origin: Point;
  startedAt: number;
}
export interface EnemyState {
  age: number;
  /** Smoothed hull-weapon aim; null until the ship first has a target direction. */
  aim: Point | null;
  archetype: EnemyArchetype;
  /**
   * A heavy with every weapon hardpoint destroyed: it stops attacking and steering, coasts to
   * rest and no longer counts for battle (gameplay/ships.md "Heavy hull and disabling").
   */
  disabled: boolean;
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
  /** Hull hp; a heavy's is its hull HP (gameplay/ships.md "Heavy hull and disabling"). */
  hp: number;
  id: string;
  /** Where the ship last saw Ada; an engaged ship steers here while she is unseen. */
  lastSeen: Point | null;
  /** Seconds since the ship last saw Ada. */
  lastSeenAge: number;
  packId: string | null;
  phase: number;
  position: Point;
  primaryCooldown: number;
  /**
   * The pursuit clock: seconds engaged while Ada is unseen or beyond firing range, reset to 0
   * while the ship fights her.
   */
  pursuitSeconds: number;
  /** Seconds since the current return began; 0 when not returning. */
  returnSeconds?: number;
  /** The return-to-home latch, set when a chase ends. */
  returning: boolean;
  retreat?: RetreatState;
  /** A disabled heavy Ada salvaged: powered down, passable and drawn dimmed. */
  salvaged: boolean;
  tactic: TacticState;
  velocity: Point;
}
export interface EnemyContext {
  /** Admission for new sight aggression only; damage, summons and existing pursuit bypass it. */
  engagementAdmitted?: boolean;
  dormantPackMembers?: Readonly<Record<string, number>>;
  adaWidth: number;
  dt: number;
  initialPackSizes: Readonly<Record<string, number>>;
  /** The route position's lead (ENEMY_AIM.lead). */
  lead: number;
  peers: readonly EnemyState[];
  player: Point;
  /** Ada's velocity averaged for aim (ENEMY_AIM.velocitySeconds). */
  playerVelocity: Point;
  /**
   * A cued route guard (flight.ts cueGuards): it flies straight at Ada at full speed, past its
   * pursuit limits and holding its fire, until it is inside the current play view.
   */
  summoned?: boolean;
  targetable: boolean;
  visibility: "visible" | "occluded" | "unknown";
}
export interface FireIntent {
  aim: Point;
  /** The weapon's damage at its level as a multiple of base shot damage. */
  damageRatio: number;
  delay: number;
  hardpointId: string | null;
  level: FireProfile["level"];
  origin: Point;
  /** A beam is a Phaser or lance shot, fired after its tell; a mine is laid where it starts. */
  projectile: FireProfile["projectile"];
  speed: number;
  weapon: FireProfile["weapon"];
}
export interface EnemyEffects {
  /** The hull is at 0 HP: the ship is destroyed. */
  defeated: boolean;
  /** Every weapon hardpoint is destroyed: the heavy stops attacking and steering. */
  disabled: boolean;
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

/** A ship's seeded value in [0, 1) from its id, fixed for its life. */
function seeded(id: string, salt: number): number {
  let value = 2166136261 ^ salt;
  for (let index = 0; index < id.length; index++) {
    value = Math.imul(value ^ id.charCodeAt(index), 16777619);
  }
  return (value >>> 0) / 2 ** 32;
}

const rotate = (vector: Point, angle: number): Point => ({
  x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
  y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
});

/**
 * Ada's averaged velocity for aim after `dt` more seconds at `current`: an exponential average
 * with time constant ENEMY_AIM.velocitySeconds.
 */
export function averageVelocity(dt: number, previous: Point, current: Point): Point {
  const blend = 1 - Math.exp(-dt / ENEMY_AIM.velocitySeconds);
  return {
    x: previous.x + (current.x - previous.x) * blend,
    y: previous.y + (current.y - previous.y) * blend,
  };
}

/**
 * A ship's lead skill for its life: the position's `lead` times 1 plus a seeded share up to
 * ENEMY_AIM.skillSpread either way, within [0, 1].
 */
export function leadSkill(lead: number, id: string): number {
  const spread = (seeded(id, 1) * 2 - 1) * ENEMY_AIM.skillSpread;
  return Math.max(0, Math.min(1, lead * (1 + spread)));
}

/**
 * The sideways aim drift at `age` seconds, in radians: a smooth seeded swing of up to
 * ENEMY_AIM.driftRadians either way with period ENEMY_AIM.driftPeriod, never random per shot.
 */
export function aimDrift(id: string, age: number): number {
  const phase = seeded(id, 2) * Math.PI * 2;
  return ENEMY_AIM.driftRadians * Math.sin((age * Math.PI * 2) / ENEMY_AIM.driftPeriod + phase);
}

/**
 * Where a shot from `origin` at `speed` aims to meet a target moving at `velocity`: the target
 * led by `skill` of its movement until the shot arrives, never behind it and never more than
 * ENEMY_AIM.maxLeadSeconds of its movement. A shot that cannot catch the target takes the cap.
 */
export function leadPoint(
  origin: Point,
  target: Point,
  velocity: Point,
  speed: number,
  skill: number,
): Point {
  const offset = { x: target.x - origin.x, y: target.y - origin.y };
  // The arrival time t solves |offset + velocity t| = speed t.
  const a = velocity.x ** 2 + velocity.y ** 2 - speed ** 2;
  const b = 2 * (offset.x * velocity.x + offset.y * velocity.y);
  const c = offset.x ** 2 + offset.y ** 2;
  let arrival: number = ENEMY_AIM.maxLeadSeconds;
  if (Math.abs(a) < 1e-9) {
    arrival = b < 0 ? -c / b : arrival;
  } else {
    const root = b * b - 4 * a * c;
    if (root >= 0) {
      const times = [(-b - Math.sqrt(root)) / (2 * a), (-b + Math.sqrt(root)) / (2 * a)];
      arrival = Math.min(...times.filter((time) => time >= 0), arrival);
    }
  }
  const lead = Math.min(Math.max(0, Math.min(1, skill)) * arrival, ENEMY_AIM.maxLeadSeconds);
  return { x: target.x + velocity.x * lead, y: target.y + velocity.y * lead };
}

/** Current speed as a fraction of the enemy's maximum speed, clamped to [0, 1], for jets. */
export function enemySpeedFraction(
  definition: EnemyDefinition,
  state: Pick<EnemyState, "velocity">,
): number {
  return speedFraction(definition.physics.maxSpeed, state.velocity);
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

/** Whether an enemy is destroyed: its hull at 0 HP, whatever its hardpoints. */
export function enemyDefeated(state: Pick<EnemyState, "hp">): boolean {
  return state.hp <= 0;
}

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

export function enemyEffects(definition: EnemyDefinition, state: EnemyState): EnemyEffects {
  const disabledHardpoints = definition.hardpoints
    .filter((part) => !state.hardpoints.some((value) => value.id === part.id && value.hp > 0))
    .map((part) => part.id);
  const engines = definition.hardpoints.filter((part) => part.kind === "engine");
  const working = engines.filter((part) => !disabledHardpoints.includes(part.id)).length;
  const weapons = definition.hardpoints.filter((part) => part.kind === "weapon");
  return {
    defeated: enemyDefeated(state),
    disabled:
      state.disabled ||
      (weapons.length > 0 && weapons.every((part) => disabledHardpoints.includes(part.id))),
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
    disabled: false,
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
    returnSeconds: 0,
    returning: false,
    salvaged: false,
    tactic: freshTactic(definition.hardpoints.reduce((sum, part) => sum + part.hp, definition.hp)),
    velocity: { x: 0, y: 0 },
  };
}

/**
 * Every hit lowers the hull; a hit at a hardpoint (null selects the hull alone) also damages
 * that hardpoint. Destroying a heavy's last weapon hardpoint disables it for good. A hit engages
 * the ship; on a returning ship that is not fleeing it also clears the return latch and resets
 * the pursuit clock.
 */
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
  const wake = state.returning && !state.fleeing;
  const next: EnemyState = {
    ...state,
    engaged: true,
    ...(wake ? { pursuitSeconds: 0, returnSeconds: 0, returning: false } : {}),
    hardpoints: state.hardpoints.map((part) =>
      part.id === hit.hardpointId
        ? { ...part, hp: Math.max(0, part.hp - hit.amount) }
        : { ...part },
    ),
    hp: Math.max(0, state.hp - hit.amount),
  };
  return { ...next, disabled: enemyEffects(definition, next).disabled };
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

/**
 * Smooth approach to a seeded ellipse passing through its anchor. The flow uses current
 * position and fixed ship identity, so resuming or changing frame rate never rerolls a route.
 */
function navigate(
  definition: EnemyDefinition,
  anchor: Point,
  searching: boolean,
  state: EnemyState,
): Point {
  const tuning = definition.navigation;
  if (!tuning) {
    return { x: 0, y: 0 };
  }
  const radius =
    tuning.patrolRadius[0] +
    seeded(state.id, 11) * (tuning.patrolRadius[1] - tuning.patrolRadius[0]);
  const ellipse =
    tuning.ellipseRatio[0] +
    seeded(state.id, 12) * (tuning.ellipseRatio[1] - tuning.ellipseRatio[0]);
  const heading = state.phase + seeded(state.id, 13) * Math.PI * 2;
  const side = seeded(state.id, 14) < 0.5 ? -1 : 1;
  const offset = rotate({ x: radius, y: 0 }, heading);
  const local = rotate(
    { x: state.position.x - anchor.x - offset.x, y: state.position.y - anchor.y - offset.y },
    -heading,
  );
  const x = local.x / radius;
  const y = local.y / (radius * ellipse);
  const radial = Math.hypot(x, y);
  const correction = Math.max(-1, Math.min(1, 1 - radial));
  const orbit = rotate(
    unit({
      x: x * correction - side * y,
      y: (y * correction + side * x) * ellipse,
    }),
    heading,
  );
  const fraction = Math.max(0, Math.min(1, ((radial - 1) * radius) / tuning.approachRadius));
  const approach = fraction * fraction * (3 - 2 * fraction);
  const toward = unit({ x: anchor.x - state.position.x, y: anchor.y - state.position.y });
  const course = unit({
    x: orbit.x * (1 - approach) + toward.x * approach,
    y: orbit.y * (1 - approach) + toward.y * approach,
  });
  const combatShare =
    definition.behaviour.kind === "siege" ? definition.behaviour.speedFraction : 1;
  const pace =
    combatShare *
    (searching
      ? tuning.patrolShare + (tuning.searchShare - tuning.patrolShare) * approach
      : tuning.patrolShare);
  // At the ellipse centre its tangent is undefined; the fixed route heading exits it smoothly.
  const nonzero = magnitude(course) ? course : rotate({ x: 0, y: side }, heading);
  return { x: nonzero.x * pace, y: nonzero.y * pace };
}

/** The live capital an escort guards, if it is loaded and not disabled. */
function escorted(context: EnemyContext, state: EnemyState): EnemyState | undefined {
  return state.escortOf === null
    ? undefined
    : context.peers.find((peer) => peer.id === state.escortOf && peer.hp > 0 && !peer.disabled);
}

/** A strafe's approach aims this many pass distances beside Ada, so momentum keeps it clear. */
const STRAFE_PASS_OFFSET = 2;
/** A strafe starts its pass, holding its course, within this many pass distances of Ada. */
const STRAFE_PASS_ENTRY = 2.5;
/** A pass whose course would come within this many pass distances of Ada bends away from her. */
const STRAFE_FLOOR_MARGIN = 1.8;

/** The side a ship circles or passes Ada on, +1 or -1, fixed for the ship by its phase. */
const circlingSide = (state: EnemyState): number => (Math.cos(state.phase) >= 0 ? 1 : -1);

/**
 * Steering that holds `band` from Ada along `aim`: straight in beyond the far edge, straight out
 * inside the near edge, and sideways on `side` across the band, blending through it.
 */
function holdBand(
  band: { far: number; near: number },
  aim: Point,
  distance: number,
  side: number,
): Point {
  const half = (band.far - band.near) / 2;
  const radial = Math.max(-1, Math.min(1, (distance - band.near - half) / half));
  const across = Math.sqrt(1 - radial * radial) * side;
  return { x: aim.x * radial - aim.y * across, y: aim.y * radial + aim.x * across };
}

const retreatActive = (state: EnemyState): boolean =>
  state.retreat !== undefined && state.retreat.endedAt === undefined;
const retreatReady = (definition: EnemyDefinition, state: EnemyState): boolean =>
  !state.retreat ||
  (state.retreat.endedAt !== undefined &&
    state.age - state.retreat.endedAt >= definition.retreats[state.retreat.kind].cooldownSeconds);
function beginRetreat(kind: RetreatState["kind"], state: EnemyState): RetreatState {
  const known = state.lastSeen ?? state.position;
  const away = unit({ x: state.position.x - known.x, y: state.position.y - known.y });
  const fallback = unit(state.facing);
  return {
    away: magnitude(away) ? away : magnitude(fallback) ? fallback : { ...UP },
    kind,
    origin: { ...state.position },
    startedAt: state.age,
  };
}
function retreatCourse(policy: RetreatPolicy, state: EnemyState): Point {
  const retreat = state.retreat!;
  const fraction = Math.max(0, Math.min(1, (state.age - retreat.startedAt) / policy.seconds));
  const curve = fraction * fraction * (3 - 2 * fraction) * policy.curveRadians;
  return rotate(retreat.away, (seeded(state.id, 21) < 0.5 ? -1 : 1) * curve);
}

/**
 * Advances the behaviour phase. Hit-and-run pulls away after a hit or a burst within its
 * bounded retreat policy and cooldown; strafe holds its course for a
 * pass once near Ada and loops back beyond its loop distance. Leaving the engagement resets to a
 * fresh attack.
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
    if (retreatActive(next)) {
      return tactic.phase === "retreat" ? tactic : enter("retreat");
    }
    if (tactic.phase === "retreat") {
      return enter("attack");
    }
    if (retreatReady(definition, next) && (hit || tactic.volleys >= behaviour.burstVolleys)) {
      next.retreat = beginRetreat("hitAndRun", next);
      return enter("retreat");
    }
  } else if (behaviour.kind === "strafe") {
    if (tactic.phase === "attack" && distance <= behaviour.passDistance * STRAFE_PASS_ENTRY) {
      return enter("pass");
    }
    if (tactic.phase === "pass" && distance >= behaviour.loopDistance) {
      return enter("attack");
    }
  }
  return tactic;
}

/**
 * Desired movement as a fraction of maximum speed: a unit vector, or shorter on arrival. `aim`
 * points at Ada, or at her last-seen position while she is unseen, `distance` away.
 */
function steering(
  definition: EnemyDefinition,
  context: EnemyContext,
  maxSpeed: number,
  aim: Point,
  distance: number,
  state: EnemyState,
): Point {
  if (state.returning) {
    return definition.navigation
      ? navigate(definition, state.home, true, state)
      : arrive(definition, maxSpeed, state.home, state);
  }
  if (retreatActive(state)) {
    return retreatCourse(definition.retreats[state.retreat!.kind], state);
  }
  if (!state.engaged || !context.targetable) {
    const investigate =
      state.retreat?.endedAt !== undefined &&
      state.lastSeen !== null &&
      state.lastSeenAge < definition.pursuit.unseenSeconds;
    return navigate(definition, investigate ? state.lastSeen! : state.home, investigate, state);
  }
  const behaviour = definition.behaviour;
  if (context.visibility !== "visible") {
    // An engaged ship that has lost sight of Ada makes for where it last saw her; a siege ship
    // keeps to its slow advance.
    if (definition.navigation) {
      return navigate(definition, state.lastSeen ?? state.home, state.lastSeen !== null, state);
    }
    if (!state.lastSeen) {
      return { x: 0, y: 0 };
    }
    const search = arrive(definition, maxSpeed, state.lastSeen, state);
    const pace = behaviour.kind === "siege" ? behaviour.speedFraction : 1;
    return { x: search.x * pace, y: search.y * pace };
  }
  const push = separation(definition, context, state);
  const toward = (scale: number): Point =>
    unit({ x: aim.x * scale + push.x, y: aim.y * scale + push.y });
  const side = circlingSide(state);
  const band = definition.standoff;
  /** Holds `edges` from Ada, or presses in without a band (a heavy). */
  const hold = (edges = band): Point => {
    if (!edges) {
      return toward(1);
    }
    const held = holdBand(edges, aim, distance, side);
    return unit({ x: held.x + push.x, y: held.y + push.y });
  };
  const capital = escorted(context, state);
  if (capital) {
    // Escorts hold a station beside the capital and intercept Ada when she comes close to it.
    const hull = (enemyCatalog[capital.archetype].sizeRatio * context.adaWidth) / 2;
    const reach = Math.hypot(
      context.player.x - capital.position.x,
      context.player.y - capital.position.y,
    );
    if (reach <= escortTuning.interceptRadius + hull) {
      return hold();
    }
    const gap = hull + escortTuning.stationGap;
    const station = {
      x: capital.position.x + Math.cos(state.phase) * gap,
      y: capital.position.y + Math.sin(state.phase) * gap,
    };
    return arrive(definition, maxSpeed, station, state);
  }
  switch (behaviour.kind) {
    case "chase":
      return hold();
    case "swarm": {
      // Sinusoidal phase makes the hold erratic without query-dependent RNG.
      const wobble = Math.sin(state.age * 3 + state.phase) * definition.steering.wobble;
      const held = band ? holdBand(band, aim, distance, side) : aim;
      return unit({
        x: held.x - held.y * wobble + push.x,
        y: held.y + held.x * wobble + push.y,
      });
    }
    case "hitAndRun": {
      // The attack holds a band centred on the standoff band's near edge.
      const half = band ? (band.far - band.near) / 2 : 0;
      return hold(band && { far: band.near + half, near: band.near - half });
    }
    case "strafe": {
      const floor = behaviour.passDistance;
      if (state.tactic.phase === "pass") {
        // A pass keeps its course, so momentum carries the ship past Ada before it loops back. A
        // course that would come within the floor's margin bends away from her.
        const course = magnitude(state.velocity) ? unit(state.velocity) : aim;
        const along = Math.max(0, (aim.x * course.x + aim.y * course.y) * distance);
        const miss = {
          x: aim.x * distance - course.x * along,
          y: aim.y * distance - course.y * along,
        };
        const gap = magnitude(miss);
        const away = gap > 1e-9 ? { x: -miss.x / gap, y: -miss.y / gap } : { x: -aim.x, y: -aim.y };
        const margin = floor * STRAFE_FLOOR_MARGIN;
        const bend = Math.max(0, Math.min(1, (margin - gap) / (margin - floor * 0.8))) * 2;
        return unit({ x: course.x + away.x * bend, y: course.y + away.y * bend });
      }
      // The approach aims beside Ada, so the pass goes by rather than at her.
      const offset = floor * STRAFE_PASS_OFFSET * side;
      return unit({
        x: aim.x * distance - aim.y * offset + push.x,
        y: aim.y * distance + aim.x * offset + push.y,
      });
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
  const summoned = context.summoned === true;
  const target = observed || summoned ? context.player : (state.lastSeen ?? state.position);
  const delta = { x: target.x - state.position.x, y: target.y - state.position.y };
  const aim = unit(delta);
  const distance = magnitude(delta);
  /** The ship sees Ada within its perception. */
  const perceived = observed && distance <= definition.perception;
  /** A sight-aggressive ship sees Ada within its perception. */
  const sighted =
    perceived && definition.aggression === "sight" && context.engagementAdmitted !== false;
  /** The ship sees Ada within its firing range. */
  const fighting = observed && distance <= definition.engagement;
  const packSize = state.packId === null ? 0 : (context.initialPackSizes[state.packId] ?? 0);
  const alive =
    context.peers.filter((peer) => peer.packId === state.packId && peer.hp > 0).length +
    (state.packId === null ? 0 : (context.dormantPackMembers?.[state.packId] ?? 0));
  const packFlee = packSize > 1 && 1 - alive / packSize >= definition.morale.packLossRatio;
  const next: EnemyState = {
    ...state,
    age: state.age + context.dt,
    engaged: state.engaged || summoned || sighted,
    fleeing: state.fleeing,
    hardpoints: state.hardpoints.map((part) => ({ ...part })),
  };
  if (observed || summoned) {
    next.lastSeen = { ...context.player };
    next.lastSeenAge = 0;
  } else {
    next.lastSeenAge += context.dt;
  }
  const morale =
    packFlee ||
    (definition.morale.individualHpRatio > 0 &&
      state.hp / definition.hp <= definition.morale.individualHpRatio);
  if (
    !retreatActive(next) &&
    retreatReady(definition, next) &&
    (state.fleeing || (morale && !state.returning && (state.engaged || !state.retreat)))
  ) {
    next.retreat = beginRetreat("morale", next);
  }
  let completedRetreat = false;
  if (retreatActive(next)) {
    const retreat = next.retreat!;
    const policy = definition.retreats[retreat.kind];
    if (
      next.age - retreat.startedAt >= policy.seconds ||
      Math.hypot(next.position.x - retreat.origin.x, next.position.y - retreat.origin.y) >=
        policy.distance
    ) {
      next.retreat = { ...retreat, endedAt: next.age };
      completedRetreat = true;
      next.engaged = false;
    }
  }
  next.fleeing = retreatActive(next) && next.retreat!.kind === "morale";
  const admitted = context.engagementAdmitted !== false;
  const recovering = next.retreat?.endedAt !== undefined;
  const reacquired = recovering && perceived && admitted;
  next.engaged = next.engaged || reacquired || summoned;
  const investigating = recovering && !next.engaged && next.lastSeen !== null && !state.returning;
  // Searching during recovery retains the finite pursuit clock and fixed last-seen knowledge.
  next.pursuitSeconds =
    (next.engaged || investigating || retreatActive(next)) && !fighting
      ? state.pursuitSeconds + context.dt
      : 0;
  const playerHomeDistance = observed
    ? Math.hypot(context.player.x - state.home.x, context.player.y - state.home.y)
    : 0;
  const homeDistance = Math.hypot(state.position.x - state.home.x, state.position.y - state.home.y);
  const pursuit = definition.pursuit;
  /** The ship is beyond its home radius, or sees Ada beyond it: a chase cannot go on. */
  const leashed = homeDistance >= pursuit.homeRadius || playerHomeDistance > pursuit.homeRadius;
  const returnSeconds = state.returning ? (state.returnSeconds ?? 0) + context.dt : 0;
  if (summoned) {
    next.returning = false;
    next.pursuitSeconds = 0;
  } else if (state.returning) {
    // A returning ship that is not fleeing re-engages on sight within perception once
    // rearmSeconds have passed and the chase could go on, a retaliator too, since it has fought
    // Ada. At home, seeing Ada beyond perception also clears the latch without engaging.
    const rearm =
      !next.fleeing &&
      perceived &&
      (!recovering || admitted) &&
      returnSeconds >= pursuit.rearmSeconds &&
      !leashed;
    const settled = homeDistance <= 5 && observed && playerHomeDistance > definition.perception;
    if (rearm || settled) {
      next.returning = false;
      next.pursuitSeconds = 0;
    }
    if (rearm) {
      next.engaged = true;
    }
  } else if (
    (next.engaged || investigating || retreatActive(next)) &&
    (next.pursuitSeconds >= pursuit.maxSeconds ||
      leashed ||
      next.lastSeenAge >= pursuit.unseenSeconds)
  ) {
    next.returning = true;
  }
  if (next.returning) {
    next.engaged = false;
    if (retreatActive(next)) {
      next.retreat = { ...next.retreat!, endedAt: next.age };
      next.fleeing = false;
    }
  }
  next.returnSeconds = next.returning ? returnSeconds : 0;
  // An escort without a live capital fights by hitAndRun.
  const acting =
    state.escortOf !== null && !escorted(context, state)
      ? { ...definition, behaviour: definition.escortFallback }
      : definition;
  next.tactic = completedRetreat
    ? freshTactic(enemyIntegrity(next))
    : nextTactic(acting, next, distance, state);
  // Each working engine gives an equal share of top speed; losing one slows the ship through
  // its own physics, while its maximum speed still bounds saved momentum.
  const fullSpeed = definition.physics.maxSpeed;
  const speed = fullSpeed * effects.thrust;
  // A disabled heavy stops steering and coasts to rest.
  const request = effects.disabled
    ? { x: 0, y: 0 }
    : summoned
      ? aim
      : steering(acting, context, speed, aim, distance, next);
  const navigating =
    definition.navigation &&
    !summoned &&
    (next.returning ||
      (!next.fleeing &&
        (!next.engaged || !context.targetable || context.visibility !== "visible")));
  const physics = navigating
    ? {
        ...definition.physics,
        turnSeconds: Math.max(definition.physics.turnSeconds, definition.navigation!.turnSeconds),
      }
    : definition.physics;
  if (
    effects.defeated ||
    (next.returning && !definition.navigation && homeDistance <= 5 && !effects.movementStopped)
  ) {
    next.velocity = { x: 0, y: 0 };
    next.heading = null;
  } else {
    // A heavy that has lost every engine has no thrust: it coasts to rest from its momentum.
    const thrust = effects.movementStopped
      ? { direction: { x: 0, y: 0 }, speed: 0 }
      : { direction: request, speed: speed * Math.min(1, magnitude(request)) };
    const motion = stepShipMotion(
      physics,
      context.dt,
      { maxSpeed: fullSpeed, restHeading: state.facing },
      thrust,
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
    !summoned &&
    !effects.defeated &&
    !effects.disabled &&
    !next.returning &&
    !next.fleeing &&
    next.engaged &&
    context.targetable &&
    context.visibility === "visible" &&
    distance <= definition.engagement;
  const skill = leadSkill(context.lead, state.id);
  const drift = aimDrift(state.id, state.age);
  /**
   * Weapons track the target independently of the hull, turning with aimTurnSeconds. An aimed
   * weapon leads a seen Ada by the ship's skill at its shot's speed, then drifts sideways.
   */
  const track = (origin: Point, current: Point | null, profile: FireProfile): Point | null => {
    // A hitscan beam aims at Ada directly.
    const direct = profile.projectile === "beam";
    const speed = profile.projectileSpeed;
    const velocity = observed && !direct ? context.playerVelocity : { x: 0, y: 0 };
    const point = leadPoint(origin, target, velocity, speed, skill);
    const line = unit({ x: point.x - origin.x, y: point.y - origin.y });
    if (!magnitude(line)) {
      return current;
    }
    const wanted = direct ? line : rotate(line, drift);
    return current ? turnToward(context.dt, physics.aimTurnSeconds, wanted, current) : wanted;
  };
  let volleys = 0;
  // A turret whose art defines muzzles fires from the drawn barrel tip of the hull's drawn
  // heading and the top's drawn aim frame, cycling barrels by volley; the shot still flies along
  // the continuous aim. Other weapons fire from the model origin.
  const layout = muzzleLayout(definition, MUZZLE_ART[state.archetype]);
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
      const shot = {
        damageRatio: fireDamageRatio(profile),
        delay,
        hardpointId,
        level: profile.level,
        projectile: profile.projectile,
        speed: profile.projectileSpeed,
        weapon: profile.weapon,
      };
      if (profile.weapon === "ringBurst") {
        // Bolts outward from the hull's edge, evenly around it, whatever the aim.
        const radius = (definition.sizeRatio * context.adaWidth) / 2;
        for (let index = 0; index < RING_BOLTS; index++) {
          const turn = (index / RING_BOLTS) * Math.PI * 2;
          const aim = { x: Math.cos(turn), y: Math.sin(turn) };
          const origin = {
            x: state.position.x + aim.x * radius,
            y: state.position.y + aim.y * radius,
          };
          fire.push({ ...shot, aim, origin });
        }
      } else {
        for (const degrees of profile.angles) {
          fire.push({ ...shot, aim: fanHeading(muzzleAim, degrees), origin: { ...from } });
        }
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
  next.aim = track(state.position, state.aim, definition.fire);
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
      value.aim = track(origin, value.aim, part.fire);
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
