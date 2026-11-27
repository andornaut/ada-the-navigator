import {
  ACTIVITIES,
  type ActivityDefinition,
  COURIER,
  MINING_CONTRACT_DEPOSITS,
} from "../data/activities.ts";
import { ECONOMY } from "../data/economy.ts";
import { byPosition } from "../data/galaxies.ts";
import { JOB_REWARDS, JOB_TUNING } from "../data/jobs.ts";
import { NEEDLE } from "../data/needle.ts";
import { questReward } from "../data/questRewards.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { settlementById } from "./legacySettlements.ts";
import { stationById, type StationSite } from "./stations.ts";
import type {
  CourierApproach,
  GalaxyProgress,
  GameState,
  HeldActivity,
  JobTarget,
  Vec,
} from "./types.ts";
import { type WorldContext, worldDelta, worldDistance } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

// Repeatable activities (gameplay/quests.md "Repeatable activities"): once a galaxy's chapter is
// complete, its story places offer its activity through Talk. An accepted activity takes the
// galaxy's one optional task slot, shared with station jobs, persists across flights like a job
// and pays at completion; it can be repeated without limit.

type Tasks = Pick<GameState, "tasks">;

/** The accepted activity in a galaxy's optional task slot, if the slot holds one. */
export function heldActivity(galaxy: GalaxyNumber, book: Tasks): HeldActivity | undefined {
  const task = book.tasks[galaxy];
  return task?.kind === "activity" ? task : undefined;
}

/** The activity a story place gives once its galaxy's chapter is complete, if any. */
export function placeActivity(
  galaxy: GalaxyNumber,
  progress: Pick<GalaxyProgress, "resolved">,
  place: string,
): ActivityDefinition | undefined {
  const activity = ACTIVITIES[galaxy];
  return activity && progress.resolved && Object.hasOwn(activity.places, place)
    ? activity
    : undefined;
}

/**
 * The activity a story place offers through Talk: its activity while the galaxy's optional task
 * slot is empty. Undefined otherwise.
 */
export function activityOffer(
  galaxy: GalaxyNumber,
  progress: Pick<GalaxyProgress, "resolved">,
  book: Tasks,
  place: string,
): ActivityDefinition | undefined {
  return book.tasks[galaxy] ? undefined : placeActivity(galaxy, progress, place);
}

/** What one run of an activity is fixed with when accepted: its reward and targets. */
export interface ActivityTerms {
  readonly reward: number;
  readonly courierApproach?: CourierApproach;
  /** A calf's or optional courier's start. */
  readonly start?: Vec;
  /** A supply run's station or optional courier's settlement. */
  readonly target?: JobTarget;
}

/**
 * A supply run's destination and pay by the delivery job rules: the known station nearest the
 * issuing outpost at least the delivery minimum away, paying the short or long delivery reward.
 * Null when no known station qualifies, so the outpost makes no offer.
 */
export function supplyTerms(
  galaxy: GalaxyNumber,
  stations: readonly StationSite[],
  issuer: Vec,
): ActivityTerms | null {
  const length = (site: Vec) => Math.hypot(site.x - issuer.x, site.y - issuer.y);
  const site = stations
    .filter((station) => length(station) >= JOB_TUNING.delivery.min)
    .sort((a, b) => length(a) - length(b))[0];
  const long = site && length(site) >= JOB_TUNING.delivery.longFrom;
  const reward = site && byPosition(JOB_REWARDS, galaxy)[long ? "deliveryLong" : "deliveryShort"];
  if (!site || reward === undefined) {
    return null;
  }
  return { reward, target: { id: site.id, x: site.x, y: site.y } };
}

/** Accepts the place's activity into the empty slot on its terms; false when it is not on offer. */
export function acceptActivity(
  galaxy: GalaxyNumber,
  progress: Pick<GalaxyProgress, "resolved">,
  book: Tasks,
  place: string,
  terms: ActivityTerms,
): boolean {
  const activity = activityOffer(galaxy, progress, book, place);
  if (!activity || (activity.id === "courierRun" && (!terms.start || !terms.target))) {
    return false;
  }
  book.tasks[galaxy] = {
    id: activity.id,
    kind: "activity",
    place,
    reward: terms.reward,
    ...(activity.id === "miningContract" ? { deposited: 0 } : {}),
    ...(activity.id === "threadNeedle" ? { lit: 0 } : {}),
    ...(activity.id === "courierRun"
      ? { courier: courierAtStart(terms.start!, terms.courierApproach) }
      : {}),
    // A supply run's item loads at once into the job carried-item slot.
    ...(activity.id === "supplyRun" ? { carrying: true } : {}),
    ...(terms.start ? { start: { ...terms.start } } : {}),
    ...(terms.target ? { target: { ...terms.target } } : {}),
  };
  return true;
}

/** Drops the held activity: its progress is lost and the slot is free. */
export function dropActivity(galaxy: GalaxyNumber, book: Tasks): boolean {
  if (!heldActivity(galaxy, book)) {
    return false;
  }
  delete book.tasks[galaxy];
  return true;
}

/** Ends the held activity and frees the slot; returns its reward, 0 when none is held. */
export function completeActivity(galaxy: GalaxyNumber, book: Tasks): number {
  const held = heldActivity(galaxy, book);
  if (!held) {
    return 0;
  }
  delete book.tasks[galaxy];
  return questReward(held.reward);
}

/**
 * Counts a hub deposit toward a held mining contract. True when the deposit reaches the goal, so
 * the contract completes; partial loads count.
 */
export function contractDeposit(galaxy: GalaxyNumber, book: Tasks, amount: number): boolean {
  const held = heldActivity(galaxy, book);
  if (held?.id !== "miningContract" || amount <= 0) {
    return false;
  }
  held.deposited = (held.deposited ?? 0) + amount;
  return held.deposited >= MINING_CONTRACT_DEPOSITS;
}

/** Advances only the optional courier; a waiting courier resumes when Ada returns in range. */
export function stepCourier(
  context: WorldContext & { readonly baseSpeed: number; readonly dt: number; readonly player: Vec },
  held: HeldActivity,
): boolean {
  if (held.id !== "courierRun" || !held.courier || !held.target) {
    return false;
  }
  const position = held.courier.position;
  if (worldDistance(context, context.player, position) > COURIER.follow) {
    return false;
  }
  const { x: dx, y: dy } = worldDelta(context, position, held.target);
  const distance = Math.hypot(dx, dy);
  const travel = Math.max(0, context.baseSpeed * COURIER.speedFraction * context.dt);
  if (travel >= distance) {
    position.x = held.target.x;
    position.y = held.target.y;
    return true;
  }
  position.x += (dx / distance) * travel;
  position.y += (dy / distance) * travel;
  if (context.worldSide !== undefined) {
    Object.assign(position, wrapPoint(context.worldSide, position));
  }
  return false;
}

/** Leaving or shield depletion restarts the optional run; Continue does not call this. */
export function resetCourier(held: HeldActivity): void {
  if (held.id === "courierRun" && held.start && held.courier) {
    held.courier = courierAtStart(held.start, held.courier.approach);
  }
}

function courierAtStart(
  start: Vec,
  approach?: CourierApproach,
): NonNullable<HeldActivity["courier"]> {
  return {
    ...(approach ? { approach } : {}),
    patrolSpawned: false,
    position: { ...start },
    ...(approach === "scout" ? { scout: "depart" as const } : {}),
  };
}

function validCourier(value: Record<string, unknown>): boolean {
  if (!value.courier || typeof value.courier !== "object" || Array.isArray(value.courier)) {
    return false;
  }
  const { approach, patrolSpawned, position, scout } = value.courier as NonNullable<
    HeldActivity["courier"]
  >;
  if (!vector(position) || typeof patrolSpawned !== "boolean") {
    return false;
  }
  // Earlier saves stored the position and patrol only.
  if (approach === undefined) {
    return scout === undefined;
  }
  if (
    (approach !== "escort" && approach !== "scout") ||
    (scout !== undefined &&
      (approach !== "scout" || !["depart", "patrol", "return"].includes(scout)))
  ) {
    return false;
  }
  const start = value.start as Vec;
  const target = value.target as JobTarget;
  const settlement = settlementById(ECONOMY, target.id);
  if (!settlement) {
    return false;
  }
  const canonical = wrapPoint(GALAXY_SIDE, settlement);
  const [min, max] = COURIER.distance;
  const distance = worldDistance({ worldSide: GALAXY_SIDE }, start, target);
  return (
    ((settlement.x === target.x && settlement.y === target.y) ||
      (canonical.x === target.x && canonical.y === target.y)) &&
    distance >= min &&
    distance <= max &&
    (scout === undefined || (position.x === start.x && position.y === start.y))
  );
}

/** Whether a saved activity is the galaxy's, offered by one of its places, with its reward. */
export function validActivity(galaxy: GalaxyNumber, value: Record<string, unknown>): boolean {
  const activity = ACTIVITIES[galaxy];
  return (
    activity !== undefined &&
    value.id === activity.id &&
    typeof value.place === "string" &&
    Object.hasOwn(activity.places, value.place) &&
    (activity.id === "supplyRun"
      ? (value.reward === byPosition(JOB_REWARDS, galaxy).deliveryShort ||
          value.reward === byPosition(JOB_REWARDS, galaxy).deliveryLong) &&
        typeof value.target === "object" &&
        value.target !== null &&
        vector(value.target) &&
        stationById(ECONOMY, galaxy, String((value.target as JobTarget).id)) !== null
      : activity.id === "courierRun"
        ? value.reward === activity.reward &&
          vector(value.target) &&
          typeof (value.target as JobTarget).id === "string" &&
          (value.target as JobTarget).id.length > 0
        : value.reward === activity.reward && value.target === undefined) &&
    (activity.id === "miningContract"
      ? Number.isSafeInteger(value.deposited) && (value.deposited as number) >= 0
      : value.deposited === undefined) &&
    (activity.id === "supplyRun"
      ? typeof value.carrying === "boolean"
      : value.carrying === undefined) &&
    (activity.id === "guideCalf" || activity.id === "courierRun"
      ? vector(value.start)
      : value.start === undefined) &&
    (activity.id === "threadNeedle"
      ? Number.isSafeInteger(value.lit) &&
        (value.lit as number) >= 0 &&
        (value.lit as number) <= NEEDLE.activityGates
      : value.lit === undefined) &&
    (activity.id === "courierRun" ? validCourier(value) : value.courier === undefined)
  );
}

const vector = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  Number.isFinite((value as Vec).x) &&
  Number.isFinite((value as Vec).y);
