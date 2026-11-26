import { type EnemyActorKind, shipCatalogEntry } from "../data/enemyActors.ts";
import {
  ENEMY_AIM,
  type EnemyDefinition,
  escortTuning,
  fireDamageRatio,
  type FireProfile,
  type HardpointDefinition,
  type Point,
  type RetreatPolicy,
  RING_BOLTS,
} from "../data/enemyCatalog.ts";
import { ENEMY_SIZE_RATIOS } from "../data/enemyDimensions.ts";
import { type HeavyHullProfile, retaliatorVariant } from "../data/enemyIdentity.ts";
import { MUZZLE_ART, muzzleArtForDefinition, muzzleLayout } from "../data/enemyMuzzles.ts";
import {
  ENEMY_FORWARD_GUNS,
  ENEMY_KEEP_MOVING,
  ENEMY_STEERING,
  ENEMY_STRAFE,
  type ForwardGuns,
  MINING_HULLS,
} from "../data/enemyNavigation.ts";
import { spacingRadius } from "../data/enemySpacing.ts";
import type { RoutePosition } from "../data/galaxies.ts";
import { SHARED_SHIP_PHYSICS } from "../data/shipPhysics.ts";
import type { WeaponLevel } from "../data/types.ts";
import { seeded } from "./ai/course.ts";
import {
  edgeCourse,
  leadCourse,
  minerNeedsPick,
  type MinerRock,
  type MinerState,
  pickMinerRock,
  type TracedEdge,
} from "./ai/edgeTrace.ts";
import type { NavigationQuery } from "./ai/navigationQuery.ts";
import { steerAroundObstacles } from "./ai/obstacleNavigation.ts";
import { packAnchor, type PackMember, packSlot } from "./ai/packRoute.ts";
import {
  type StationGuardAnchor,
  stationGuardPatrol,
  stationGuardPatrolRadius,
} from "./ai/stationGuardPatrol.ts";
import { fixedMuzzleOffset, hardpointAnchorOffset, muzzleOffset } from "./muzzles.ts";
import { fanHeading } from "./playerProjectiles.ts";
import {
  INDUSTRIAL_HOME_RADIUS,
  retaliatorNavigation,
  type RetaliatorNavigationContext,
} from "./retaliatorNavigation.ts";
import { direction, hullOffset, speedFraction, stepShipMotion, turnToward } from "./shipPhysics.ts";
import { type WorldContext, worldDelta, worldDistance, worldPoint } from "./worldContacts.ts";

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
  /**
   * `attack` presses in; `retreat` pulls away (hitAndRun); `pass` flies through to its closest
   * approach and `loop` carries on past it until the next approach (strafe).
   */
  phase: "attack" | "retreat" | "pass" | "loop";
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
  archetype: EnemyActorKind;
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
  /** Heavy mount phases have started; existing cooldowns and burst positions are authoritative. */
  firePhasesInitialized?: true;
  /** Smoothed movement heading; null at rest or with no movement request. */
  heading: Point | null;
  home: Point;
  readonly hullProfile?: HeavyHullProfile;
  /** Hull hp; a heavy's is its hull HP (gameplay/ships.md "Heavy hull and disabling"). */
  hp: number;
  id: string;
  /** Where the ship last saw Ada; an engaged ship steers here while she is unseen. */
  lastSeen: Point | null;
  /** A Mining Freighter's edge tracing; absent until its first pick. */
  miner?: MinerState;
  /** Seconds since the ship last saw Ada. */
  lastSeenAge: number;
  packId: string | null;
  /**
   * A solo patrol's flipped direction and the age it flipped at, set when obstacle steering
   * finds no clear course; absent, the ship patrols on its seeded side.
   */
  patrolFlip?: { at: number; side: -1 | 1 };
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
  /** Equipped level resolved at spawn; legacy absence is interpreted by the loadout owner. */
  weaponLevel?: WeaponLevel;
}
export interface EnemyContext extends WorldContext {
  /** Validated exact route-site frame for local guard home patrol and return only. */
  stationGuardAnchor?: StationGuardAnchor;
  /** The industrial body's physical reach, present for industrial idle routes only. */
  retaliatorNavigation?: Pick<RetaliatorNavigationContext, "physicalReach">;
  /** Optional hull-clearance steering, separate from perception and weapon intent. */
  navigationQuery?: NavigationQuery;
  /**
   * A Mining Freighter's runtime facts: the qualifying rocks when it picks, and its traced
   * rock's edge while that rock is live and at rest.
   */
  miner?: { readonly candidates?: readonly MinerRock[]; readonly edge?: TracedEdge };
  /** The galaxy's encounter member spacing, the least gap on a pack's shared route. */
  packSpacing?: number;
  /** Admission for new sight aggression only; damage, summons and existing pursuit bypass it. */
  engagementAdmitted?: boolean;
  /** Local current velocity, in addition to the hull's retained physics velocity. */
  enemyDrift?: Point;
  dormantPackMembers?: Readonly<Record<string, number>>;
  adaWidth: number;
  dt: number;
  /** Whether the ship's centre is inside the current play view around Ada; it fires only then. */
  inPlayView: boolean;
  initialPackSizes: Readonly<Record<string, number>>;
  /** Pre-movement live loaded pack counts, including disabled survivors. */
  loadedPackMembers?: Readonly<Record<string, number>>;
  /** The route position's lead (ENEMY_AIM.lead). */
  lead: number;
  peers: readonly EnemyState[];
  player: Point;
  /** Ada's actual wrapped displacement in this simulation slice, including current drift. */
  playerDisplacement?: Point;
  /** Ada's velocity averaged for aim (ENEMY_AIM.velocitySeconds). */
  playerVelocity: Point;
  /** Existing authored or escort leash for this actor. */
  pursuitHomeRadius?: number;
  /** The flight's route position, which sets each hull's design and spacing radius. */
  routePosition: RoutePosition;
  /**
   * A cued route guard (flight.ts cueGuards): it approaches Ada at full speed, past its
   * pursuit limits and holding its fire, until it is inside the current play view.
   */
  summoned?: boolean;
  /** An obstacle detour for summoned steering only; observations still use Ada's actual position. */
  summonTarget?: Point;
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
  /** The volley's index, which picks the drawn barrel a turret with several fires from. */
  volley: number;
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
  if ("id" in part && typeof part.id === "string") {
    const anchor = hardpointAnchorOffset(muzzleArtForDefinition(definition), part.id, facing);
    if (anchor) {
      return anchor;
    }
  }
  const width = definition.sizeRatio * adaWidth;
  return hullOffset(facing, { x: part.offset.x * width, y: part.offset.y * width });
}

/**
 * A weapon's fire line for the ship as it is now: from the drawn barrel tip `volley` picks when
 * its art defines muzzles, else from the hardpoint's (or the hull's) model origin, along the
 * weapon's current aim as a unit heading. Null for a weapon that has not aimed or is not fitted.
 */
export function enemyFireLine(
  definition: EnemyDefinition,
  adaWidth: number,
  hardpointId: string | null,
  volley: number,
  state: EnemyState,
): { aim: Point; origin: Point } | null {
  const part =
    hardpointId === null ? null : definition.hardpoints.find((entry) => entry.id === hardpointId);
  const aim =
    hardpointId === null
      ? state.aim
      : (state.hardpoints.find((entry) => entry.id === hardpointId)?.aim ?? null);
  if (!aim || !magnitude(aim) || part === undefined) {
    return null;
  }
  const art = muzzleArtForDefinition(definition) ?? MUZZLE_ART[state.archetype];
  const layout = muzzleLayout(definition, art);
  // A fixed front Laser fires from its drawn shot origin; a turret from its barrel tip.
  const tip =
    (part?.kind === "weapon" && part.fixed
      ? fixedMuzzleOffset(art, part.id, state.facing)
      : undefined) ?? muzzleOffset(layout, hardpointId, state.facing, aim, volley);
  const offset = tip ?? (part ? hardpointOffset(definition, adaWidth, state.facing, part) : null);
  return {
    aim: unit(aim),
    origin: offset
      ? { x: state.position.x + offset.x, y: state.position.y + offset.y }
      : { ...state.position },
  };
}

/**
 * Whether a fixed forward weapon's unit line of fire lies within `arcRadians` either side of the
 * unit hull `facing`: the nose arc a fixed gun fires inside.
 */
export function withinNoseArc(arcRadians: number, facing: Point, line: Point): boolean {
  return line.x * facing.x + line.y * facing.y >= Math.cos(arcRadians);
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
    archetype: EnemyActorKind;
    escortOf?: string | null;
    hullProfile?: HeavyHullProfile;
    id: string;
    packId: string | null;
    phase: number;
    weaponLevel?: WeaponLevel;
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
 * A hit damages only its selected hardpoint, with no overflow; null selects only the hull.
 * Destroying a heavy's last weapon hardpoint disables it for good. A hit engages
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
    hp:
      hit.hardpointId === null
        ? Math.max(definition.hullFloor ?? 0, state.hp - hit.amount)
        : state.hp,
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
    const delta = worldDelta(context, peer.position, state.position);
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
  context: WorldContext,
  maxSpeed: number,
  goal: Point,
  state: EnemyState,
): Point {
  const offset = worldDelta(context, state.position, goal);
  const distance = magnitude(offset);
  if (distance <= ENEMY_STEERING.arrivalRadius) {
    return { x: 0, y: 0 };
  }
  const arrival = Math.min(
    1,
    distance / Math.max(0.001, maxSpeed * definition.physics.brakingSeconds),
  );
  return { x: (offset.x / distance) * arrival, y: (offset.y / distance) * arrival };
}

const scaled = (vector: Point, size: number): Point => ({ x: vector.x * size, y: vector.y * size });

/** How far inward a circling course turns from afar, relative to its sideways share. */
const LOOP_INWARD = 3;

/**
 * A unit course circling `point` at `radius` on `side`: sideways on the circle, bending outward
 * inside it and inward beyond it, at most LOOP_INWARD to one.
 */
function circling(
  context: WorldContext,
  point: Point,
  radius: number,
  side: number,
  state: EnemyState,
): Point {
  const offset = worldDelta(context, point, state.position);
  const distance = magnitude(offset);
  const outward = distance
    ? scaled(offset, 1 / distance)
    : rotate(UP, seeded(state.id, 15) * Math.PI * 2);
  const correction = Math.max(-LOOP_INWARD, Math.min(1, 1 - distance / radius));
  return unit({
    x: outward.x * correction - side * outward.y,
    y: outward.y * correction + side * outward.x,
  });
}

/**
 * A request that follows a moving `target` with `velocity`: its velocity as a share of `speed`
 * plus a closing term that reaches full speed `brakingSeconds` of travel out, capped at 1.
 */
function follow(
  definition: EnemyDefinition,
  context: WorldContext,
  speed: number,
  target: Point,
  velocity: Point,
  state: EnemyState,
): Point {
  const reach = Math.max(0.001, speed * definition.physics.brakingSeconds);
  const offset = worldDelta(context, state.position, target);
  const request = {
    x: velocity.x / Math.max(0.001, speed) + offset.x / reach,
    y: velocity.y / Math.max(0.001, speed) + offset.y / reach,
  };
  const size = magnitude(request);
  return size > 1 ? scaled(request, 1 / size) : request;
}

/** A noncombat course with the existing peer separation, at the same pace. */
function separated(
  definition: EnemyDefinition,
  context: EnemyContext,
  course: Point,
  state: EnemyState,
): Point {
  const pace = magnitude(course);
  const push = separation(definition, context, state);
  if (!pace || (!push.x && !push.y)) {
    return course;
  }
  const steered = unit({ x: course.x / pace + push.x, y: course.y / pace + push.y });
  return magnitude(steered) ? scaled(steered, pace) : course;
}

/** A movable ship's request raised to ENEMY_KEEP_MOVING.minimumShare, along its facing at rest. */
function keepMoving(state: EnemyState, request: Point): Point {
  const share = magnitude(request);
  const floor = ENEMY_KEEP_MOVING.minimumShare;
  if (share >= floor) {
    return request;
  }
  const course = share ? scaled(request, 1 / share) : unit(state.facing);
  return scaled(magnitude(course) ? course : UP, floor);
}

/** Whether a ship flies a mining hull, which traces asteroid edges while idle. */
const mining = (state: EnemyState): boolean => {
  const variant = retaliatorVariant(state);
  return variant !== undefined && MINING_HULLS.includes(variant);
};

/** A solo patrol's direction: its flipped side, else its seeded side. */
const patrolSide = (state: EnemyState): -1 | 1 =>
  state.patrolFlip?.side ?? (seeded(state.id, 14) < 0.5 ? -1 : 1);

/** A miner has reached its traced edge within this many edge offsets of the outline. */
const MINER_ARRIVAL = 3;

/** Seconds a flipped patrol keeps its new direction before obstacle steering may flip it again. */
const FLIP_SECONDS = 2;

/**
 * The live members of a ship's pack that fly its shared route, the ship included: two or more
 * ships sharing its pack id, less escorts with a live leader. Empty when the ship flies alone.
 */
function packMembers(context: EnemyContext, state: EnemyState): PackMember[] {
  if (state.packId === null) {
    return [];
  }
  const peers = context.peers.filter(
    (peer) =>
      peer.id !== state.id &&
      peer.packId === state.packId &&
      peer.hp > 0 &&
      !peer.disabled &&
      !escorted(context, peer),
  );
  if (!peers.length || escorted(context, state)) {
    return [];
  }
  return [state, ...peers].map((member) => ({
    age:
      member.id === state.id
        ? (context.peers.find((peer) => peer.id === state.id)?.age ?? state.age)
        : member.age,
    home: member.home,
    id: member.id,
    // The larger of its spacing radius and its collision radius.
    spacing: Math.max(
      spacingRadius(context.routePosition, member),
      (context.adaWidth / 2) * ENEMY_SIZE_RATIOS[member.archetype],
    ),
  }));
}

/**
 * A pack member's request on its pack's shared route through `anchor` (gameplay/ships.md "Keep
 * moving"), or null for a ship flying alone.
 */
function packCourse(
  definition: EnemyDefinition,
  context: EnemyContext,
  speed: number,
  anchor: Point | null,
  state: EnemyState,
): Point | null {
  const members = packMembers(context, state);
  if (!members.length || !definition.navigation || state.packId === null) {
    return null;
  }
  const combatShare =
    definition.behaviour.kind === "siege" ? definition.behaviour.speedFraction : 1;
  const pace = speed * definition.navigation.patrolShare * combatShare;
  const slot = packSlot(
    definition.navigation,
    { gap: ENEMY_KEEP_MOVING.packGap, memberSpacing: context.packSpacing ?? 0 },
    state.packId,
    anchor ?? packAnchor(context, state.home, members),
    pace,
    members,
    state.id,
  );
  return slot
    ? follow(definition, context, speed, slot.point, scaled(slot.tangent, pace), state)
    : null;
}

/**
 * A leader's current top pace from its working engines: its siege advance while it fights, else
 * its patrol speed (with a siege leader's speed share). None for a ship without navigation.
 */
function leaderPace(leader: EnemyState): number {
  const definition = shipCatalogEntry(leader.archetype);
  if (!definition?.navigation) {
    return 0;
  }
  const top = definition.physics.maxSpeed * enemyEffects(definition, leader).thrust;
  const siege = definition.behaviour.kind === "siege" ? definition.behaviour.speedFraction : 1;
  const sieging = definition.behaviour.kind === "siege" && leader.engaged && !leader.returning;
  return top * siege * (sieging ? 1 : definition.navigation.patrolShare);
}

/**
 * An escort's request on its leader's station ring: its station `gap` from the leader turns with
 * the leader's age on the leader's seeded side, so a leader's escorts keep their equal angles. The
 * ring moves each escort at the minimum share of its speed plus its leader's current top pace,
 * so it keeps the floor even when its leader moves against the ring.
 */
function escortRing(
  definition: EnemyDefinition,
  context: EnemyContext,
  speed: number,
  leader: EnemyState,
  state: EnemyState,
): Point {
  const gap = spacingRadius(context.routePosition, leader) + escortTuning.stationGap;
  const side = seeded(leader.id, 14) < 0.5 ? -1 : 1;
  const rate = (ENEMY_KEEP_MOVING.minimumShare * speed + leaderPace(leader)) / gap;
  const angle = state.phase + side * rate * leader.age;
  const radial = { x: Math.cos(angle), y: Math.sin(angle) };
  const station = {
    x: leader.position.x + radial.x * gap,
    y: leader.position.y + radial.y * gap,
  };
  const turning = scaled({ x: -radial.y * side, y: radial.x * side }, rate * gap);
  return follow(
    definition,
    context,
    speed,
    station,
    { x: leader.velocity.x + turning.x, y: leader.velocity.y + turning.y },
    state,
  );
}

/**
 * Smooth approach to a seeded ellipse passing through its anchor. The flow uses current
 * position and fixed ship identity, so resuming or changing frame rate never rerolls a route.
 */
function navigate(
  definition: EnemyDefinition,
  context: WorldContext,
  stationAnchor: StationGuardAnchor | undefined,
  anchor: Point,
  searching: boolean,
  state: EnemyState,
): Point {
  const tuning = definition.navigation;
  if (!tuning) {
    return { x: 0, y: 0 };
  }
  if (stationAnchor) {
    const course = stationGuardPatrol(
      context,
      stationAnchor,
      state.home,
      patrolSide(state),
      state.position,
    );
    const radius = stationGuardPatrolRadius(context, stationAnchor, state.home);
    const fraction = Math.min(
      1,
      Math.abs(worldDistance(context, stationAnchor.center, state.position) - radius) /
        tuning.approachRadius,
    );
    const approach = fraction * fraction * (3 - 2 * fraction);
    const combatShare =
      definition.behaviour.kind === "siege" ? definition.behaviour.speedFraction : 1;
    const pace =
      combatShare *
      (searching
        ? tuning.patrolShare + (tuning.searchShare - tuning.patrolShare) * approach
        : tuning.patrolShare);
    return { x: course.x * pace, y: course.y * pace };
  }
  const radius =
    tuning.patrolRadius[0] +
    seeded(state.id, 11) * (tuning.patrolRadius[1] - tuning.patrolRadius[0]);
  const ellipse =
    tuning.ellipseRatio[0] +
    seeded(state.id, 12) * (tuning.ellipseRatio[1] - tuning.ellipseRatio[0]);
  const heading = state.phase + seeded(state.id, 13) * Math.PI * 2;
  const side = patrolSide(state);
  const offset = rotate({ x: radius, y: 0 }, heading);
  const relative = worldDelta(context, anchor, state.position);
  const local = rotate({ x: relative.x - offset.x, y: relative.y - offset.y }, -heading);
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
  const toward = unit(worldDelta(context, state.position, anchor));
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

/** The side a ship circles or passes Ada on, +1 or -1, fixed for the ship by its phase. */
export const circlingSide = (state: EnemyState): number => (Math.cos(state.phase) >= 0 ? 1 : -1);

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

/**
 * A movement request capped by its direction relative to the hull `facing`: full speed ahead,
 * `lateralShare` sideways and `reverseShare` straight back, along two half-ellipses between them.
 */
export function strafeLimited(guns: ForwardGuns, facing: Point, request: Point): Point {
  const size = magnitude(request);
  if (!size) {
    return request;
  }
  const ahead = (request.x * facing.x + request.y * facing.y) / size;
  const across = (request.y * facing.x - request.x * facing.y) / size;
  const cap =
    1 / Math.hypot(ahead / (ahead >= 0 ? 1 : guns.reverseShare), across / guns.lateralShare);
  return size <= cap ? request : { x: (request.x * cap) / size, y: (request.y * cap) / size };
}

const retreatActive = (state: EnemyState): boolean =>
  state.retreat !== undefined && state.retreat.endedAt === undefined;
const retreatReady = (definition: EnemyDefinition, state: EnemyState): boolean =>
  !state.retreat ||
  (state.retreat.endedAt !== undefined &&
    state.age - state.retreat.endedAt >= definition.retreats[state.retreat.kind].cooldownSeconds);
function beginRetreat(
  context: WorldContext,
  kind: RetreatState["kind"],
  state: EnemyState,
): RetreatState {
  const known = state.lastSeen ?? state.position;
  const away = unit(worldDelta(context, known, state.position));
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
 * bounded retreat policy and cooldown; strafe holds its course for a pass once near Ada, loops
 * on once the range to her opens (`opening`, past closest approach) and comes back beyond its
 * loop distance. Leaving the engagement resets to a fresh attack.
 */
function nextTactic(
  definition: EnemyDefinition,
  context: WorldContext,
  next: EnemyState,
  distance: number,
  opening: boolean,
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
      next.retreat = beginRetreat(context, "hitAndRun", next);
      return enter("retreat");
    }
  } else if (behaviour.kind === "strafe") {
    if (tactic.phase === "attack" && distance <= behaviour.passDistance * ENEMY_STRAFE.passEntry) {
      return enter("pass");
    }
    if (
      (tactic.phase === "pass" || tactic.phase === "loop") &&
      distance >= behaviour.loopDistance
    ) {
      return enter("attack");
    }
    if (tactic.phase === "pass" && opening) {
      return enter("loop");
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
  const leader = escorted(context, state);
  if (state.returning) {
    if (!definition.navigation) {
      return arrive(definition, context, maxSpeed, state.home, state);
    }
    // A returning pack member makes for its place on the pack's route through home.
    return separated(
      definition,
      context,
      packCourse(definition, context, maxSpeed, null, state) ??
        navigate(definition, context, context.stationGuardAnchor, state.home, true, state),
      state,
    );
  }
  if (retreatActive(state)) {
    return retreatCourse(definition.retreats[state.retreat!.kind], state);
  }
  if (!state.engaged || !context.targetable) {
    const investigate =
      state.retreat?.endedAt !== undefined &&
      state.lastSeen !== null &&
      state.lastSeenAge < definition.pursuit.unseenSeconds;
    const peaceful =
      state.archetype === "retaliator" &&
      !state.engaged &&
      !state.fleeing &&
      !investigate &&
      !context.stationGuardAnchor &&
      definition.navigation !== null;
    // An idle Mining Freighter traces its picked rock's edge (gameplay/ships.md "Miners").
    const edge = context.miner?.edge;
    if (peaceful && mining(state) && state.miner?.rock && edge && definition.navigation) {
      const offset = spacingRadius(context.routePosition, state) + ENEMY_KEEP_MOVING.edgeGap;
      // It travels to the rock at its patrol pace and traces the edge at the minimum speed.
      const pace =
        edge.distance > MINER_ARRIVAL * offset
          ? definition.navigation.patrolShare
          : ENEMY_KEEP_MOVING.minimumShare;
      // Turning in by its velocity's lag around the curve keeps the hull on the edge.
      const course = leadCourse(
        pace * maxSpeed,
        definition.physics.accelerationSeconds,
        edge,
        edgeCourse(offset, patrolSide(state), edge),
      );
      return separated(definition, context, scaled(course, pace), state);
    }
    // An idle escort with a live leader keeps its station ring.
    if (leader && !investigate && definition.navigation) {
      return separated(
        definition,
        context,
        escortRing(definition, context, maxSpeed, leader, state),
        state,
      );
    }
    const industrial =
      peaceful && !mining(state) && definition.navigation && context.retaliatorNavigation
        ? retaliatorNavigation(
            {
              ...context.retaliatorNavigation,
              navigation: definition.navigation,
              pursuit: { homeRadius: INDUSTRIAL_HOME_RADIUS },
              ...(context.worldSide === undefined ? {} : { worldSide: context.worldSide }),
            },
            state,
          )
        : undefined;
    const idleDefinition =
      industrial && definition.navigation
        ? {
            ...definition,
            navigation: { ...definition.navigation, patrolRadius: industrial.patrolRadius },
          }
        : definition;
    const pack =
      !industrial && !context.stationGuardAnchor
        ? packCourse(definition, context, maxSpeed, investigate ? state.lastSeen : null, state)
        : null;
    return separated(
      definition,
      context,
      pack ??
        navigate(
          idleDefinition,
          context,
          investigate ? undefined : context.stationGuardAnchor,
          investigate ? state.lastSeen! : (industrial?.anchor ?? state.home),
          investigate,
          state,
        ),
      state,
    );
  }
  const behaviour = definition.behaviour;
  if (context.visibility !== "visible") {
    // An engaged ship that has lost sight of Ada searches where it last saw her, a pack on its
    // shared route through that point; a siege ship keeps to its slow advance.
    if (definition.navigation) {
      const pack =
        state.lastSeen && !leader
          ? packCourse(definition, context, maxSpeed, state.lastSeen, state)
          : null;
      return separated(
        definition,
        context,
        pack ??
          navigate(
            definition,
            context,
            state.lastSeen === null ? context.stationGuardAnchor : undefined,
            state.lastSeen ?? state.home,
            state.lastSeen !== null,
            state,
          ),
        state,
      );
    }
    if (!state.lastSeen) {
      return { x: 0, y: 0 };
    }
    const search = arrive(definition, context, maxSpeed, state.lastSeen, state);
    const pace = behaviour.kind === "siege" ? behaviour.speedFraction : 1;
    return { x: search.x * pace, y: search.y * pace };
  }
  const travel = context.playerDisplacement;
  if (
    state.archetype === "interceptor" &&
    state.escortOf === null &&
    distance > definition.engagement &&
    travel
  ) {
    const outward = aim.x * travel.x + aim.y * travel.y;
    const { enemyDrift } = context;
    const enemyMotionX = state.velocity.x + (enemyDrift?.x ?? 0);
    const enemyMotionY = state.velocity.y + (enemyDrift?.y ?? 0);
    const closing = (aim.x * enemyMotionX + aim.y * enemyMotionY) * context.dt;
    if (outward > 0 && outward > closing) {
      return aim;
    }
  }
  const push = separation(definition, context, state);
  const toward = (scale: number): Point =>
    unit({ x: aim.x * scale + push.x, y: aim.y * scale + push.y });
  const side = circlingSide(state);
  const band = definition.standoff;
  /** Strafing along the band on the circling side, for a hold that separation cancels. */
  const along = { x: -aim.y * side, y: aim.x * side };
  /**
   * Holds `edges` from Ada, or presses in without a band (a heavy). Peer separation that cancels
   * the hold leaves the ship strafing on its circling side.
   */
  const hold = (edges = band, range = distance): Point => {
    if (!edges) {
      return toward(1);
    }
    const held = holdBand(edges, aim, range, side);
    const course = unit({ x: held.x + push.x, y: held.y + push.y });
    return magnitude(course) ? course : along;
  };
  if (leader) {
    // Escorts circle their leader on its station ring and intercept Ada when she comes close
    // to it.
    const hull = spacingRadius(context.routePosition, leader);
    const reach = worldDistance(context, leader.position, context.player);
    if (reach <= escortTuning.interceptRadius + hull) {
      return hold();
    }
    return escortRing(definition, context, maxSpeed, leader, state);
  }
  switch (behaviour.kind) {
    case "chase": {
      if (state.archetype !== "retaliator") {
        return hold();
      }
      // Begin turning against radial momentum over the existing velocity response time.
      const closing = aim.x * state.velocity.x + aim.y * state.velocity.y;
      return hold(band, distance - closing * definition.physics.accelerationSeconds);
    }
    case "swarm": {
      // Sinusoidal phase makes the hold erratic without query-dependent RNG.
      const wobble =
        Math.sin(state.age * ENEMY_STEERING.swarmWobbleRadiansPerSecond + state.phase) *
        definition.steering.wobble;
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
      if (state.tactic.phase === "pass" || state.tactic.phase === "loop") {
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
        const margin = floor * ENEMY_STRAFE.floorMargin;
        const bend =
          Math.max(
            0,
            Math.min(1, (margin - gap) / (margin - floor * ENEMY_STRAFE.floorBlendShare)),
          ) * ENEMY_STRAFE.bendGain;
        return unit({ x: course.x + away.x * bend, y: course.y + away.y * bend });
      }
      // The approach aims beside Ada, so the pass goes by rather than at her.
      const offset = floor * ENEMY_STRAFE.passOffset * side;
      return unit({
        x: aim.x * distance - aim.y * offset + push.x,
        y: aim.y * distance + aim.x * offset + push.y,
      });
    }
    case "siege":
      break;
  }
  // Siege advances slowly while the turrets fire. Close in, a turret ship circles the point it
  // would hold, Ada, at ENEMY_KEEP_MOVING.turretHoldRadii of its spacing radius.
  const holdRadius =
    ENEMY_KEEP_MOVING.turretHoldRadii * spacingRadius(context.routePosition, state);
  const point = { x: state.position.x + aim.x * distance, y: state.position.y + aim.y * distance };
  const advance =
    distance > (1 + LOOP_INWARD) * holdRadius
      ? toward(1)
      : unit({
          x: circling(context, point, holdRadius, side, state).x + push.x,
          y: circling(context, point, holdRadius, side, state).y + push.y,
        });
  return scaled(magnitude(advance) ? advance : along, behaviour.speedFraction);
}

function firingInterval(profile: Pick<FireProfile, "interval">): number {
  return Math.max(0.01, profile.interval);
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
  const delta = worldDelta(context, state.position, target);
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
    (context.loadedPackMembers === undefined
      ? context.peers.filter((peer) => peer.packId === state.packId && peer.hp > 0).length
      : state.packId === null
        ? 0
        : (context.loadedPackMembers[state.packId] ?? 0)) +
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
    next.retreat = beginRetreat(context, "morale", next);
  }
  let completedRetreat = false;
  if (retreatActive(next)) {
    const retreat = next.retreat!;
    const policy = definition.retreats[retreat.kind];
    if (
      next.age - retreat.startedAt >= policy.seconds ||
      worldDistance(context, retreat.origin, next.position) >= policy.distance
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
  const playerHomeDistance = observed ? worldDistance(context, state.home, context.player) : 0;
  const homeDistance = worldDistance(context, state.home, state.position);
  const pursuit = definition.pursuit;
  /** The ship is beyond its home radius, or sees Ada beyond it: a chase cannot go on. */
  const homeRadius = context.pursuitHomeRadius ?? pursuit.homeRadius;
  const leashed = homeDistance >= homeRadius || playerHomeDistance > homeRadius;
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
    const settled =
      homeDistance <= ENEMY_STEERING.arrivalRadius &&
      observed &&
      playerHomeDistance > definition.perception;
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
    : nextTactic(
        acting,
        context,
        next,
        distance,
        // The range to Ada opens once her relative motion has passed its closest approach.
        (state.velocity.x - context.playerVelocity.x) * aim.x +
          (state.velocity.y - context.playerVelocity.y) * aim.y <
          0,
        state,
      );
  // Each working engine gives an equal share of top speed; losing one slows the ship through
  // its own physics, while its maximum speed still bounds saved momentum.
  const fullSpeed = definition.physics.maxSpeed;
  const speed = fullSpeed * effects.thrust;
  // An idle Mining Freighter picks its next rock when its dwell ends or its rock is gone or
  // moving; the runtime supplies the qualifying rocks for that step.
  if (
    mining(next) &&
    definition.navigation &&
    !next.engaged &&
    !next.returning &&
    context.miner?.candidates &&
    minerNeedsPick(ENEMY_KEEP_MOVING, context.miner.edge !== undefined, state)
  ) {
    next.miner = pickMinerRock(context, ENEMY_KEEP_MOVING, context.miner.candidates, next);
  }
  // Its dwell runs from its arrival on the edge, so travel to a rock never eats into it.
  const minerEdge = context.miner?.edge;
  if (
    next.miner?.rock &&
    minerEdge &&
    minerEdge.distance >
      MINER_ARRIVAL * (spacingRadius(context.routePosition, next) + ENEMY_KEEP_MOVING.edgeGap)
  ) {
    next.miner = { ...next.miner, arrived: next.age };
  }
  // A disabled heavy stops steering and coasts to rest.
  let request = effects.disabled
    ? { x: 0, y: 0 }
    : summoned
      ? unit(worldDelta(context, state.position, context.summonTarget ?? context.player))
      : steering(acting, context, speed, aim, distance, next);
  // A tracing miner turns with its own turnSeconds, so it holds the edge's curve.
  const tracing =
    mining(next) &&
    next.miner?.rock &&
    context.miner?.edge !== undefined &&
    !next.engaged &&
    !next.returning &&
    !next.fleeing;
  const navigating =
    definition.navigation &&
    !summoned &&
    !tracing &&
    (next.returning ||
      (!next.fleeing &&
        (!next.engaged || !context.targetable || context.visibility !== "visible")));
  const physics = navigating
    ? {
        ...definition.physics,
        turnSeconds: Math.max(definition.physics.turnSeconds, definition.navigation!.turnSeconds),
      }
    : definition.physics;
  const skill = leadSkill(context.lead, state.id);
  const drift = aimDrift(state.id, state.age);
  /**
   * An aimed weapon's wanted line from `origin`: it leads a seen Ada by the ship's skill at its
   * shot's speed, then drifts sideways. Null when the origin is on the target.
   */
  const lineOfFire = (origin: Point, profile: FireProfile): Point | null => {
    // A hitscan beam aims at Ada directly.
    const direct = profile.projectile === "beam";
    const velocity = observed && !direct ? context.playerVelocity : { x: 0, y: 0 };
    const point = leadPoint(
      origin,
      worldPoint(context, origin, target),
      velocity,
      profile.projectileSpeed,
      skill,
    );
    const line = unit(worldDelta(context, origin, point));
    if (!magnitude(line)) {
      return null;
    }
    return direct ? line : rotate(line, drift);
  };
  const guns = definition.guns;
  /** A fixed forward hull weapon, which fires along the facing within its arc. */
  const forward = guns.kind === "turrets" ? null : guns;
  /** The hull weapon's aim point, which a forward-gun ship's nose turns toward. */
  const pointed = lineOfFire(state.position, definition.fire) ?? aim;
  /** A retreat or a strafe loop past closest approach breaks off. */
  const breakingOff = retreatActive(next) || next.tactic.phase === "loop";
  // A forward-gun ship fighting Ada keeps its nose on her aim point; its velocity still follows
  // the tactic, its requested speed capped by direction relative to the facing.
  const holdNose =
    forward !== null &&
    !summoned &&
    !effects.defeated &&
    !effects.disabled &&
    !next.returning &&
    !next.fleeing &&
    !breakingOff &&
    next.engaged &&
    // An escort on its station ring keeps its nose on Ada while it sees her.
    (fighting || (observed && escorted(context, next) !== undefined));
  if (holdNose) {
    if (magnitude(pointed)) {
      next.facing = turnToward(context.dt, physics.aimTurnSeconds, pointed, state.facing);
    }
    request = strafeLimited(forward, next.facing, request);
  }
  // A ship that can move keeps moving at least at the minimum share; one without navigation
  // (a platform), engines or weapons stays as its physics leaves it.
  if (
    definition.navigation &&
    fullSpeed > 0 &&
    !effects.defeated &&
    !effects.disabled &&
    !effects.movementStopped
  ) {
    request = keepMoving(state, request);
  }
  if (context.navigationQuery && !effects.disabled && !effects.movementStopped) {
    const steered = steerAroundObstacles(
      physics,
      context.navigationQuery,
      context.dt,
      speed,
      state,
      request,
    );
    request = steered.request;
    // A patroller with no clear course flips its patrol direction instead of stopping.
    if (
      steered.blocked &&
      navigating &&
      (!state.patrolFlip || next.age - state.patrolFlip.at >= FLIP_SECONDS)
    ) {
      next.patrolFlip = { at: next.age, side: patrolSide(state) === 1 ? -1 : 1 };
    }
  }
  if (
    effects.defeated ||
    (next.returning &&
      !definition.navigation &&
      homeDistance <= ENEMY_STEERING.arrivalRadius &&
      !effects.movementStopped)
  ) {
    next.velocity = { x: 0, y: 0 };
    next.heading = null;
  } else {
    // A heavy that has lost every engine has no thrust: it coasts to rest from its momentum.
    const thrust = effects.movementStopped
      ? { direction: { x: 0, y: 0 }, speed: 0 }
      : { direction: request, speed: speed * Math.min(1, magnitude(request)) };
    // A ship holding its nose on Ada slides from rest straight onto its request.
    const motion = stepShipMotion(
      physics,
      context.dt,
      holdNose ? { maxSpeed: fullSpeed } : { maxSpeed: fullSpeed, restHeading: state.facing },
      thrust,
      { heading: state.heading, velocity: state.velocity },
    );
    next.velocity = motion.velocity;
    next.heading = motion.heading;
    // Otherwise the hull turns toward its velocity with the short shared hullTurnSeconds, so
    // collision slides do not snap it, and keeps its facing at rest. The heading starts
    // from the hull, so velocity and hull swing round together.
    if (!holdNose && magnitude(motion.velocity)) {
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
  const engagedFire =
    !summoned &&
    !effects.defeated &&
    !effects.disabled &&
    !next.returning &&
    !next.fleeing &&
    !breakingOff &&
    next.engaged &&
    context.targetable &&
    context.visibility === "visible" &&
    context.inPlayView &&
    distance <= definition.engagement;
  // A fixed forward weapon fires only while its aim point is inside the nose arc.
  const canFire =
    engagedFire && (forward === null || withinNoseArc(forward.arcRadians, next.facing, pointed));
  const phasedHeavy = definition.fireClockPolicy === "staggered-and-paused";
  if (phasedHeavy && canFire && !state.firePhasesInitialized) {
    // A legacy active clock or burst resumes as saved rather than receiving a second phase.
    const resumed = state.hardpoints.some((part) => part.cooldown > 0 || (part.burst ?? 0) > 0);
    if (!resumed) {
      // Front Lasers take their phases after the mounts.
      const fill = definition.mounts
        ? [
            ...definition.mounts.fill,
            ...definition.hardpoints.flatMap((part) =>
              part.kind === "weapon" && part.fixed ? [part.id] : [],
            ),
          ]
        : definition.hardpoints.map((part) => part.id);
      const weapons = fill.flatMap((id) => {
        const part = definition.hardpoints.find((part) => part.id === id);
        return part?.kind === "weapon" ? [part] : [];
      });
      weapons.forEach((part, index) => {
        const value = next.hardpoints.find((value) => value.id === part.id);
        if (value) {
          value.cooldown = (index / weapons.length) * firingInterval(part.fire);
        }
      });
    }
    next.firePhasesInitialized = true;
  }
  /** Turrets track their line of fire independently of the hull, turning with aimTurnSeconds. */
  const track = (origin: Point, current: Point | null, profile: FireProfile): Point | null => {
    const wanted = lineOfFire(origin, profile);
    if (!wanted) {
      return current;
    }
    return current ? turnToward(context.dt, physics.aimTurnSeconds, wanted, current) : wanted;
  };
  let volleys = 0;
  // A turret whose art defines muzzles fires from the drawn barrel tip of the hull's drawn
  // heading and the top's drawn aim frame, cycling barrels by volley; the shot still flies along
  // the continuous aim. Other weapons fire from the model origin.
  const art = muzzleArtForDefinition(definition) ?? MUZZLE_ART[state.archetype];
  const layout = muzzleLayout(definition, art);
  const spawn = (origin: Point, turret: string | null, muzzleAim: Point, volley: number) => {
    const offset = muzzleOffset(layout, turret, state.facing, muzzleAim, volley);
    return offset ? { x: state.position.x + offset.x, y: state.position.y + offset.y } : origin;
  };
  /**
   * Fires each volley due this step while `armed` and returns the next cooldown and burst
   * position. A burst's bolts follow `gap` apart and its next burst starts `interval` after its
   * first.
   */
  const cycle = (
    armed: boolean,
    profile: FireProfile,
    origin: Point,
    muzzleAim: Point,
    hardpointId: string | null,
    cooldown: number,
    burst = 0,
  ): { burst: number; cooldown: number } => {
    const interval = firingInterval(profile);
    const count = Math.max(1, profile.burst?.count ?? 1);
    const gap = Math.min(interval / count, Math.max(0, profile.burst?.gap ?? 0));
    if (!armed) {
      return phasedHeavy
        ? { burst, cooldown }
        : { burst: 0, cooldown: Math.max(0, cooldown - context.dt) };
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
        volley,
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
  // A fixed forward hull weapon aims along the facing; hardpoint weapons are turrets unless fixed.
  next.aim = forward ? { ...next.facing } : track(state.position, state.aim, definition.fire);
  const hullAim = next.aim ?? { x: 0, y: 0 };
  next.primaryCooldown = definition.hardpoints.length
    ? 0
    : cycle(canFire, definition.fire, state.position, hullAim, null, state.primaryCooldown)
        .cooldown;
  for (const part of definition.hardpoints) {
    const value = next.hardpoints.find((entry) => entry.id === part.id);
    if (part.kind === "weapon" && value && value.hp > 0) {
      // Muzzles sit on the hull as it faced at the start of the step; a fixed front Laser fires
      // from its drawn shot origin.
      const offset =
        (part.fixed ? fixedMuzzleOffset(art, part.id, state.facing) : undefined) ??
        hardpointOffset(definition, context.adaWidth, state.facing, part);
      const origin = { x: state.position.x + offset.x, y: state.position.y + offset.y };
      // A fixed front weapon aims along the facing and fires while its aim point is in the nose
      // arc; the hull never turns toward it.
      const line = part.fixed ? lineOfFire(origin, part.fire) : null;
      value.aim = part.fixed ? { ...next.facing } : track(origin, value.aim, part.fire);
      const armed = part.fixed
        ? engagedFire &&
          line !== null &&
          withinNoseArc(ENEMY_FORWARD_GUNS.arcRadians, next.facing, line)
        : canFire;
      const fired = cycle(
        armed,
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
