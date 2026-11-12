import {
  ACTIVITIES,
  type ActivityDefinition,
  MINING_CONTRACT_DEPOSITS,
} from "../data/activities.ts";
import { ECONOMY } from "../data/economy.ts";
import { byPosition } from "../data/galaxies.ts";
import { JOB_REWARDS, JOB_TUNING } from "../data/jobs.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { stationById, type StationSite } from "./stations.ts";
import type { GalaxyProgress, GameState, HeldActivity, JobTarget, Vec } from "./types.ts";

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
  /** A guide's calf start, from the family. */
  readonly start?: Vec;
  /** A supply run's destination station. */
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
  if (!activity) {
    return false;
  }
  book.tasks[galaxy] = {
    id: activity.id,
    kind: "activity",
    place,
    reward: terms.reward,
    ...(activity.id === "miningContract" ? { deposited: 0 } : {}),
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
  return held.reward;
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
      : value.reward === activity.reward && value.target === undefined) &&
    (activity.id === "miningContract"
      ? Number.isSafeInteger(value.deposited) && (value.deposited as number) >= 0
      : value.deposited === undefined) &&
    (activity.id === "supplyRun"
      ? typeof value.carrying === "boolean"
      : value.carrying === undefined) &&
    (activity.id === "guideCalf" ? vector(value.start) : value.start === undefined)
  );
}

const vector = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  Number.isFinite((value as Vec).x) &&
  Number.isFinite((value as Vec).y);
