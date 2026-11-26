import { deliveryDestination } from "../data/destinations.ts";
import { ECONOMY } from "../data/economy.ts";
import { byPosition } from "../data/galaxies.ts";
import {
  JOB_POOL,
  JOB_REWARDS,
  JOB_TUNING,
  JOB_TYPES,
  type JobRewardKind,
  type JobType,
} from "../data/jobs.ts";
import { questReward } from "../data/questRewards.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { dropRandom } from "./drops.ts";
import { type LandmarkSite, landmarkSites } from "./landmarks.ts";
import { stationById, type StationSite } from "./stations.ts";
import type {
  GalaxyProgress,
  GameState,
  HeldJob,
  JobOffer,
  JobTarget,
  SpaceObject,
  Vec,
} from "./types.ts";
import { type WorldContext, worldDistance } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

// Station job boards (gameplay/quests.md "Station jobs"): each station's three offers, the held
// job and how it comes along. A held job fills the galaxy's one optional task slot, which other
// optional task kinds share: while the slot is taken, boards refuse offers. Offers are made from the
// station's site and a running job count, so a board never changes until a job on it is taken and
// completed.

/** The boards and the optional task slots they fill. */
export type JobBook = Pick<GameState, "jobs" | "tasks">;

/** What a board draws on when it makes offers. */
export interface BoardContext {
  /** Eligible survey sites in the actual flight; legacy callers use the static catalog. */
  readonly landmarks?: readonly LandmarkSite[];
  readonly galaxy: GalaxyNumber;
  /** Charted landmarks, and discovered stations: delivery destinations. */
  readonly progress: Pick<GalaxyProgress, "charted" | "stations">;
  /** Known outposts in the flight: delivery destinations and tow safe places. */
  readonly outposts: readonly JobTarget[];
  /** Live frigates and capitals, which job targets keep clear of. */
  readonly hostiles: readonly Vec[];
}

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** The held job in a galaxy's optional task slot, if the slot holds a job. */
export function heldJob(galaxy: GalaxyNumber, book: Pick<GameState, "tasks">): HeldJob | undefined {
  const task = book.tasks[galaxy];
  return task?.kind === "job" ? task : undefined;
}

/** Heavy hulls that job targets keep clear of. */
export function jobHostiles(flight: { readonly objects: readonly SpaceObject[] }): Vec[] {
  return flight.objects.filter(
    (object) =>
      object.kind === "enemy" &&
      object.hp > 0 &&
      (object.enemy?.archetype === "frigate" ||
        object.enemy?.archetype === "capital" ||
        object.enemy?.archetype === "platform"),
  );
}

/** A delivery's reward row: long from JOB_TUNING.delivery.longFrom. */
function rewardKind(type: JobType, length: number): JobRewardKind {
  if (type !== "delivery") {
    return type;
  }
  return length >= JOB_TUNING.delivery.longFrom ? "deliveryLong" : "deliveryShort";
}

const without = <T>(items: readonly T[], index: number): T[] =>
  items.filter((_, at) => at !== index);
const pick = <T>(next: () => number, items: readonly T[]): T | undefined =>
  items[Math.floor(next() * items.length)];

/** Survey landmarks already named by a board offer or the held job in the galaxy. */
function surveyed(galaxy: GalaxyNumber, book: JobBook): Set<string> {
  const offers = Object.values(book.jobs.boards[galaxy] ?? {}).flat();
  const held = heldJob(galaxy, book);
  return new Set(
    [...offers, ...(held ? [held] : [])]
      .filter((offer) => offer.type === "survey")
      .map((offer) => offer.target.id),
  );
}

interface SpotPlacement {
  readonly world?: WorldContext;
  readonly allowFallback?: boolean;
}

/** First clear seeded spot, or the safest tried spot when fallback is allowed. */
function spotNear(
  context: BoardContext,
  next: () => number,
  reach: { readonly max: number; readonly min: number },
  station: Vec,
  { allowFallback = false, world = {} }: SpotPlacement = {},
): Vec | null {
  let best: Vec | null = null;
  let bestClearance = -Infinity;
  for (let attempt = 0; attempt < 24; attempt++) {
    const length = reach.min + next() * (reach.max - reach.min);
    const angle = next() * Math.PI * 2;
    const spot = {
      x: station.x + Math.cos(angle) * length,
      y: station.y + Math.sin(angle) * length,
    };
    let clearance = Infinity;
    for (const hostile of context.hostiles) {
      clearance = Math.min(clearance, worldDistance(world, hostile, spot));
      // More hostiles can only lower the clearance. An earlier fallback wins ties.
      if (allowFallback ? clearance <= bestClearance : clearance < JOB_TUNING.hostileClearance) {
        break;
      }
    }
    if (clearance >= JOB_TUNING.hostileClearance) {
      return spot;
    }
    if (allowFallback && clearance > bestClearance) {
      best = spot;
      bestClearance = clearance;
    }
  }
  return best;
}

/** The job type's target and pool item, or null when the galaxy has none to give. */
function jobTarget(
  context: BoardContext,
  book: JobBook,
  next: () => number,
  station: StationSite,
  type: JobType,
): Pick<JobOffer, "item" | "spot" | "target"> | null {
  const pool = JOB_POOL[context.galaxy]!;
  if (type === "survey") {
    const taken = surveyed(context.galaxy, book);
    // One of the three nearest landmarks no other survey names; recorded scans remain valid.
    const open = (context.landmarks ?? landmarkSites(context.galaxy))
      .filter((site) => !taken.has(site.id))
      .sort((a, b) => distance(a, station) - distance(b, station))
      .slice(0, 3);
    const site = pick(next, open);
    return site ? { item: site.kind, target: { id: site.id, x: site.x, y: site.y } } : null;
  }
  if (type === "delivery") {
    // The nearest other known station or outpost at least the minimum away, with no upper limit;
    // other story places never take deliveries.
    const place = [
      ...context.progress.stations.flatMap((id) => stationById(ECONOMY, context.galaxy, id) ?? []),
      ...context.outposts.filter(({ id }) => deliveryDestination(id)),
    ]
      .filter(
        (place) => place.id !== station.id && distance(place, station) >= JOB_TUNING.delivery.min,
      )
      .sort((a, b) => distance(a, station) - distance(b, station))[0];
    const item = pick(next, pool.delivery);
    return place && item ? { item, target: { id: place.id, x: place.x, y: place.y } } : null;
  }
  if (type === "rescue") {
    const spot = spotNear(context, next, JOB_TUNING.rescue, station);
    const item = pick(next, pool.craft);
    return spot && item ? { item, target: { id: "", ...spot } } : null;
  }
  return huntTarget(context, next, station);
}

function huntTarget(
  context: BoardContext,
  next: () => number,
  station: StationSite,
  placement?: SpotPlacement,
): Pick<JobOffer, "item" | "spot" | "target"> | null {
  const { hunt } = JOB_TUNING;
  const centre = spotNear(context, next, hunt, station, placement);
  const item = pick(next, JOB_POOL[context.galaxy]!.lost);
  if (!centre || !item) {
    return null;
  }
  // The item lies well inside the search area, so the glint is never at its rim.
  const reach = Math.sqrt(next()) * hunt.radius * 0.8;
  const angle = next() * Math.PI * 2;
  const spot = { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach };
  const side = placement?.world?.worldSide;
  return {
    item,
    spot: side === undefined ? spot : wrapPoint(side, spot),
    target: { id: "", ...(side === undefined ? centre : wrapPoint(side, centre)) },
  };
}

export type LeadJobType = Extract<JobType, "rescue" | "hunt">;
export type ExplorationLeadPhase = "placement" | "scan";
export const isPostedLead = (offer: JobOffer): boolean => offer.id.startsWith("lead:poi:");

/** A lead uses the board reward and job pool; rescue clearance applies at placement. */
export function explorationLeadOffer(
  world: WorldContext,
  context: BoardContext,
  seed: number,
  station: StationSite,
  site: JobTarget,
  type: LeadJobType,
  phase: ExplorationLeadPhase = "placement",
): JobOffer | null {
  const reward = byPosition(JOB_REWARDS, context.galaxy)[type];
  if (reward === null || reward === undefined) {
    return null;
  }
  const id = `lead:${site.id}`;
  const next = dropRandom(seed, id);
  let target: ReturnType<typeof huntTarget>;
  if (type === "rescue") {
    const item = pick(next, JOB_POOL[context.galaxy]!.craft);
    if (
      !item ||
      (phase === "placement" &&
        context.hostiles.some(
          (hostile) => worldDistance(world, hostile, site) < JOB_TUNING.hostileClearance,
        ))
    ) {
      return null;
    }
    target = { item, target: { id: "", x: site.x, y: site.y } };
  } else {
    target = huntTarget(context, next, station, { allowFallback: true, world });
  }
  return target && { ...target, id, reward, station: station.id, type };
}

/** A new discovery replaces the untaken lead. A held lead keeps its original drop state. */
export function postExplorationLead(galaxy: GalaxyNumber, book: JobBook, lead: JobOffer): void {
  const boards = (book.jobs.boards[galaxy] ??= {});
  const held = heldJob(galaxy, book);
  const board = boards[lead.station] ?? [];
  boards[lead.station] = [
    ...board.filter((offer) => !isPostedLead(offer) || offer.id === held?.id),
    lead,
  ];
}

/**
 * A new offer for a station's slot: types not on the board first, in a seeded order, then any
 * type the galaxy can still give. Null when it can give none.
 */
function makeOffer(
  context: BoardContext,
  book: JobBook,
  board: readonly JobOffer[],
  station: StationSite,
): JobOffer | null {
  const made = book.jobs.made;
  const next = dropRandom(made, `job:${context.galaxy}:${station.id}`);
  // A seeded Fisher-Yates shuffle of the types.
  const order = [...JOB_TYPES];
  for (let index = order.length - 1; index > 0; index--) {
    const swap = Math.floor(next() * (index + 1));
    [order[index], order[swap]] = [order[swap]!, order[index]!];
  }
  const fresh = order.filter((type) => !board.some((offer) => offer.type === type));
  for (const type of [...fresh, ...order.filter((type) => !fresh.includes(type))]) {
    const target = jobTarget(context, book, next, station, type);
    const reward =
      target &&
      byPosition(JOB_REWARDS, context.galaxy)[rewardKind(type, distance(target.target, station))];
    if (target && reward !== undefined && reward !== null) {
      book.jobs.made = made + 1;
      return {
        ...target,
        id: `job:${made}`,
        reward,
        station: station.id,
        type,
      };
    }
  }
  return null;
}

/**
 * A station's board in slot order, made or topped up as needed. Recorded scans do not expire
 * survey offers; the held job keeps its slot until it completes.
 */
export function stationBoard(
  context: BoardContext,
  book: JobBook,
  station: StationSite,
): readonly JobOffer[] {
  const boards = (book.jobs.boards[context.galaxy] ??= {});
  const board = (boards[station.id] ??= []);
  const held = heldJob(context.galaxy, book);
  for (let slot = 0; slot < board.length; slot++) {
    const offer = board[slot]!;
    if (
      !isPostedLead(offer) &&
      offer.id !== held?.id &&
      !offerValid(context, book, station.id, slot, offer)
    ) {
      const replacement = makeOffer(
        context,
        book,
        without(board, slot).filter((job) => !isPostedLead(job)),
        station,
      );
      if (replacement) {
        board[slot] = replacement;
      } else {
        board.splice(slot--, 1);
      }
    }
  }
  const ordinary = board.filter((offer) => !isPostedLead(offer));
  while (ordinary.length < JOB_TUNING.boardSize) {
    const offer = makeOffer(context, book, ordinary, station);
    if (!offer) {
      break;
    }
    ordinary.push(offer);
  }
  return (boards[station.id] = [...ordinary, ...board.filter(isPostedLead)]);
}

/**
 * Whether a board's target remains eligible and is not already used by the held job or an
 * earlier offer in the galaxy, the boards read in station order.
 */
function offerValid(
  context: BoardContext,
  book: JobBook,
  station: string,
  slot: number,
  offer: JobOffer,
): boolean {
  if (
    offer.type === "survey" &&
    context.landmarks !== undefined &&
    !context.landmarks.some(({ id }) => id === offer.target.id)
  ) {
    return false;
  }
  if (offer.target.id === "") {
    return true;
  }
  const same = (other: JobOffer) =>
    other.type === offer.type && other.target.id === offer.target.id;
  const held = heldJob(context.galaxy, book);
  if (held && held.id !== offer.id && same(held)) {
    return false;
  }
  for (const [id, board] of Object.entries(book.jobs.boards[context.galaxy] ?? {})) {
    const earlier = id === station ? board.slice(0, slot) : id < station ? board : [];
    if (earlier.some((other) => other.id !== held?.id && same(other))) {
      return false;
    }
  }
  return true;
}

/**
 * A new flight re-rolls the galaxy's untaken offers (quests.md "Job boards"): every board keeps
 * the held job and posted leads, and refills when it next shows.
 */
export function rerollBoards(galaxy: GalaxyNumber, book: JobBook): void {
  const boards = book.jobs.boards[galaxy];
  if (!boards) {
    return;
  }
  const held = heldJob(galaxy, book);
  for (const [station, board] of Object.entries(boards)) {
    boards[station] = board.filter((offer) => offer.id === held?.id || isPostedLead(offer));
  }
}

/** Takes an offer from a station's board into the galaxy's empty optional task slot. */
export function acceptJob(
  galaxy: GalaxyNumber,
  station: string,
  id: string,
  book: JobBook,
): "accepted" | "busy" | "missing" {
  const offer = book.jobs.boards[galaxy]?.[station]?.find((entry) => entry.id === id);
  if (!offer) {
    return "missing";
  }
  if (book.tasks[galaxy]) {
    return "busy";
  }
  // A delivery's item loads at once into the job's own carried-item slot.
  book.tasks[galaxy] = {
    ...structuredClone(offer),
    kind: "job",
    ...(offer.type === "delivery" ? { carrying: true } : {}),
  };
  return "accepted";
}

/** Drops the held job: its progress is lost and its offer shows on its board again. */
export function dropJob(galaxy: GalaxyNumber, book: JobBook): boolean {
  const held = heldJob(galaxy, book);
  if (!held) {
    return false;
  }
  const boards = book.jobs.boards[galaxy];
  const board = boards?.[held.station];
  if (isPostedLead(held) && boards && board) {
    boards[held.station] = board.filter((offer) => !isPostedLead(offer) || offer.id === held.id);
  }
  delete book.tasks[galaxy];
  return true;
}

/**
 * Completes the held job: its slot refills from the pool when the galaxy can give a job.
 * Returns the reward.
 */
export function completeJob(
  context: BoardContext,
  station: StationSite | null,
  book: JobBook,
): number {
  const held = heldJob(context.galaxy, book);
  if (!held) {
    return 0;
  }
  delete book.tasks[context.galaxy];
  const board = book.jobs.boards[context.galaxy]?.[held.station];
  const slot = board?.findIndex((offer) => offer.id === held.id) ?? -1;
  if (board && slot >= 0) {
    const replacement =
      !isPostedLead(held) &&
      station &&
      makeOffer(
        context,
        book,
        without(board, slot).filter((job) => !isPostedLead(job)),
        station,
      );
    if (replacement) {
      board[slot] = replacement;
    } else {
      board.splice(slot, 1);
    }
  }
  return questReward(held.reward);
}

/**
 * The tow line pulls the craft along only while taut: it trails at the line's length behind Ada
 * and rests where it is when she backs up.
 */
export function pullTow(player: Vec, tow: Vec): void {
  const length = distance(player, tow);
  const line = JOB_TUNING.tow.line;
  if (length > line) {
    tow.x = player.x + ((tow.x - player.x) / length) * line;
    tow.y = player.y + ((tow.y - player.y) / length) * line;
  }
}

/** The nearest of a rescue's safe places to a point: its issuing station or a known outpost. */
export function nearestSafePlace(
  outposts: readonly JobTarget[],
  station: StationSite | null,
  point: Vec,
): JobTarget | null {
  return nearestWorldSafePlace({}, station ? [station, ...outposts] : outposts, point);
}

export function nearestWorldSafePlace(
  world: WorldContext,
  places: readonly JobTarget[],
  point: Vec,
): JobTarget | null {
  return (
    [...places]
      .sort((a, b) => worldDistance(world, a, point) - worldDistance(world, b, point))
      .map(({ id, x, y }) => ({
        id,
        x,
        y,
      }))[0] ?? null
  );
}
