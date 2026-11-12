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
import type { GalaxyNumber } from "../data/types.ts";
import { dropRandom } from "./drops.ts";
import { landmarkSites } from "./landmarks.ts";
import { stationById, type StationSite } from "./stations.ts";
import type {
  FlightState,
  GalaxyProgress,
  GameState,
  HeldJob,
  JobOffer,
  JobTarget,
  Vec,
} from "./types.ts";

// Station job boards (gameplay/quests.md "Station jobs"): each station's three offers, the held
// job and how it comes along. A held job fills the galaxy's one optional task slot, which other
// optional task kinds share: while the slot is taken, boards refuse offers. Offers are made from the
// station's site and a running job count, so a board never changes until a job on it is taken and
// completed.

/** The boards and the optional task slots they fill. */
export type JobBook = Pick<GameState, "jobs" | "tasks">;

/** What a board draws on when it makes offers. */
export interface BoardContext {
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

/** Live frigates and capitals in a flight. */
export function jobHostiles(flight: Pick<FlightState, "objects">): Vec[] {
  return flight.objects.filter(
    (object) =>
      object.kind === "enemy" &&
      object.hp > 0 &&
      (object.enemy?.archetype === "frigate" || object.enemy?.archetype === "capital"),
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

/** A spot reach-away from the station, clear of hostiles, or null after a few tries. */
function spotNear(
  context: BoardContext,
  next: () => number,
  reach: { readonly max: number; readonly min: number },
  station: Vec,
): Vec | null {
  for (let attempt = 0; attempt < 24; attempt++) {
    const length = reach.min + next() * (reach.max - reach.min);
    const angle = next() * Math.PI * 2;
    const spot = {
      x: station.x + Math.cos(angle) * length,
      y: station.y + Math.sin(angle) * length,
    };
    if (
      context.hostiles.every((hostile) => distance(hostile, spot) >= JOB_TUNING.hostileClearance)
    ) {
      return spot;
    }
  }
  return null;
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
    // One of the three nearest uncharted landmarks no other survey names.
    const open = landmarkSites(context.galaxy)
      .filter((site) => !context.progress.charted.includes(site.id) && !taken.has(site.id))
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
  const { hunt } = JOB_TUNING;
  const centre = spotNear(context, next, hunt, station);
  const item = pick(next, pool.lost);
  if (!centre || !item) {
    return null;
  }
  // The item lies well inside the search area, so the glint is never at its rim.
  const reach = Math.sqrt(next()) * hunt.radius * 0.8;
  const angle = next() * Math.PI * 2;
  return {
    item,
    spot: { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach },
    target: { id: "", ...centre },
  };
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
 * A station's board in slot order, made or topped up as needed. A survey offer whose landmark
 * was charted since is replaced; the held job keeps its slot until it completes.
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
    if (offer.id !== held?.id && !offerValid(context, book, station.id, slot, offer)) {
      const replacement = makeOffer(context, book, without(board, slot), station);
      if (replacement) {
        board[slot] = replacement;
      } else {
        board.splice(slot--, 1);
      }
    }
  }
  while (board.length < JOB_TUNING.boardSize) {
    const offer = makeOffer(context, book, board, station);
    if (!offer) {
      break;
    }
    board.push(offer);
  }
  return board;
}

/**
 * Whether a board's offer still stands (quests.md "Job boards"): a survey whose landmark is now
 * charted is not, nor one whose target the held job or an earlier offer in the galaxy already
 * uses, the boards read in station order.
 */
function offerValid(
  context: BoardContext,
  book: JobBook,
  station: string,
  slot: number,
  offer: JobOffer,
): boolean {
  if (offer.type === "survey" && context.progress.charted.includes(offer.target.id)) {
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
 * only the held job, and refills when it next shows.
 */
export function rerollBoards(galaxy: GalaxyNumber, book: JobBook): void {
  const boards = book.jobs.boards[galaxy];
  if (!boards) {
    return;
  }
  const held = heldJob(galaxy, book);
  for (const [station, board] of Object.entries(boards)) {
    boards[station] = board.filter((offer) => offer.id === held?.id);
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
  if (!heldJob(galaxy, book)) {
    return false;
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
    const replacement = station && makeOffer(context, book, without(board, slot), station);
    if (replacement) {
      board[slot] = replacement;
    } else {
      board.splice(slot, 1);
    }
  }
  return held.reward;
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
  const places = [...(station ? [station] : []), ...outposts];
  return (
    places
      .sort((a, b) => distance(a, point) - distance(b, point))
      .map(({ id, x, y }) => ({
        id,
        x,
        y,
      }))[0] ?? null
  );
}
