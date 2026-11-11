import {
  type Conversation,
  CONVERSATION_PRIORITIES,
  CONVERSATION_TUNING,
  type ConversationLine,
  GENERAL_NAMED,
  type Lesson,
  type Speaker,
  SPEAKERS,
} from "../data/conversations.ts";
import type { SectorId } from "../data/types.ts";
import type { FlightState, SectorProgress, SpaceObject } from "./types.ts";

// The in-flight conversation box's schedule (gameplay/rules.md "Astra and Penny in flight"):
// one conversation at a time, chosen by priority (BOX_PRIORITIES). A higher one interrupts a lower
// one showing, which resumes after it if still relevant. Ordinary ones wait out a cooldown after
// the last one ends; warnings skip it. Each line shows for its time or until tapped. The director
// only advances while the flight runs, so pausing, a story panel or a station card freezes it.

/** What the flight did and what is around Ada this step. */
export interface ConversationFacts {
  readonly aimed: boolean;
  /** A capital ship within sight range. */
  readonly capitalInSight: boolean;
  readonly collectedStardust: boolean;
  readonly docked: boolean;
  readonly inDanger: boolean;
  readonly moved: boolean;
  /** Destinations and stations mapped this step, destinations by id. */
  readonly newlyMapped: readonly string[];
  readonly newStation: boolean;
  /** Undiscovered points of interest within Penny's range, nearest first. */
  readonly pennyPoints: readonly string[];
  /** Shield over its capacity, 0 to 1. */
  readonly shieldFraction: number;
  readonly stardustInSight: boolean;
}

export interface ShowingConversation {
  readonly conversation: Conversation;
  /** Seconds the current line has shown. */
  readonly elapsed: number;
  /** The instance that was marked seen: the id, or Penny's per point of interest. */
  readonly instance: string;
  readonly line: ConversationLine;
  readonly lineIndex: number;
}

interface Request {
  readonly conversation: Conversation;
  readonly instance: string;
  /** Penny's point of interest, which must still be undiscovered to show. */
  readonly point?: string;
  /** Where an interrupted conversation resumes. */
  readonly resume?: { readonly elapsed: number; readonly line: number };
}

interface Active extends Request {
  elapsed: number;
  line: number;
}

const rank = (conversation: Conversation) => CONVERSATION_PRIORITIES.indexOf(conversation.priority);

// Timers sum many frame slices, so a deadline counts as reached within float error.
const EPSILON = 1e-9;

/** Penny's instance for one point of interest. */
export function pennyInstance(sector: SectorId, point: string): string {
  return `penny:${sector}:${point}`;
}

/** The name on a speaker's tab: the General's is unknown until the Whirlpool holodisk is in. */
export function speakerName(
  progress: Readonly<Record<SectorId, Pick<SectorProgress, "holodisk">>>,
  speaker: Speaker,
): string {
  return speaker === "general" && progress[GENERAL_NAMED.sector].holodisk
    ? GENERAL_NAMED.name
    : SPEAKERS[speaker].name;
}

/**
 * Whether a capital ship's battle is in sight: a live capital on screen (the view's isometric
 * projection around Ada, with its hull), or a capital or one of its escorts engaging Ada, so a
 * battle that opens with its escorts still counts. The view is the 720x360 play view.
 */
export function capitalInSight(
  view: { readonly height: number; readonly width: number },
  flight: Pick<FlightState, "objects" | "player">,
): boolean {
  const capitals = flight.objects.filter(
    (object) => object.kind === "enemy" && object.hp > 0 && object.enemy?.archetype === "capital",
  );
  const ids = new Set(capitals.map((object) => object.id));
  const onScreen = (object: SpaceObject) => {
    const dx = object.x - flight.player.x;
    const dy = object.y - flight.player.y;
    return (
      Math.abs(dx - dy) <= view.width / 2 + object.radius &&
      Math.abs((dx + dy) / 2) <= view.height / 2 + object.radius
    );
  };
  return (
    capitals.some((object) => onScreen(object) || object.enemy?.engaged === true) ||
    flight.objects.some(
      (object) =>
        object.kind === "enemy" &&
        object.hp > 0 &&
        object.enemy?.engaged === true &&
        object.enemy.escortOf !== null &&
        ids.has(object.enemy.escortOf),
    )
  );
}

/**
 * Undiscovered points of interest within Penny's range of Ada, even off screen, nearest first:
 * unmapped destinations, the guarded holodisk while its waypoint shows, undiscovered stations and
 * discovery caches.
 */
export function pennyPoints(
  progress: Pick<SectorProgress, "known" | "stations">,
  holodiskWaypoint: boolean,
  flight: Pick<FlightState, "objects" | "player">,
): string[] {
  const distance = (object: SpaceObject) =>
    Math.hypot(object.x - flight.player.x, object.y - flight.player.y);
  return flight.objects
    .filter(
      (object) =>
        distance(object) <= CONVERSATION_TUNING.pennyRange &&
        (object.kind === "destination"
          ? object.id === "holodisk"
            ? holodiskWaypoint
            : !progress.known.includes(object.id)
          : object.kind === "station"
            ? !progress.stations.includes(object.id)
            : object.role === "discovery" && object.kind === "pickup" && object.hp > 0),
    )
    .sort((a, b) => distance(a) - distance(b))
    .map((object) => object.id);
}

export class ConversationDirector {
  private active: Active | null = null;
  private cooldown = 0;
  private readonly conversations: readonly Conversation[];
  private done: Record<Lesson, boolean> = { aim: false, dock: false, move: false, stardust: false };
  private inFight = false;
  private pennyPoints: readonly string[] = [];
  /** Seconds until Penny can sense another point. */
  private pennyWait = 0;
  private playedThisFlight = new Set<string>();
  private queue: Request[] = [];
  private quietFor = 0;
  private sector: SectorId | null = null;
  private readonly seen: string[];
  private shieldWarned = false;

  /** seen is the saved list, which the director extends as conversations show. */
  constructor(conversations: readonly Conversation[], seen: string[]) {
    this.conversations = conversations;
    this.seen = seen;
  }

  get showing(): ShowingConversation | null {
    const active = this.active;
    const line = active?.conversation.lines[active.line];
    return active && line
      ? {
          conversation: active.conversation,
          elapsed: active.elapsed,
          instance: active.instance,
          line,
          lineIndex: active.line,
        }
      : null;
  }

  /**
   * A flight starts or resumes in sector. done names lessons Ada has already acted on, such as
   * collecting Stardust before.
   */
  beginFlight(sector: SectorId, done: Partial<Record<Lesson, boolean>> = {}): void {
    this.reset();
    this.sector = sector;
    this.done = { aim: false, dock: false, move: false, stardust: false, ...done };
    this.request((trigger) => trigger.kind === "lesson" && trigger.lesson === "move");
    this.request((trigger) => trigger.kind === "arrival" && trigger.sector === sector);
  }

  /** The flight ended: nothing shows or waits. */
  endFlight(): void {
    this.reset();
    this.sector = null;
  }

  /** A funded project's thank-you line, which waits its turn in the queue. */
  thank(project: string): void {
    this.request((trigger) => trigger.kind === "funded" && trigger.project === project);
  }

  /** A tap on the box: the next line, or after the last, the box closes. */
  advance(): void {
    if (this.active) {
      this.nextLine();
    }
  }

  /**
   * One flight step. A notice ranks below warnings and above everything else (BOX_PRIORITIES):
   * while one shows, requests still queue and a warning may start or keep showing, but any other
   * line waits where it was and resumes once the notice clears.
   */
  step(dt: number, notice: boolean, facts: ConversationFacts): void {
    const sector = this.sector;
    if (sector === null || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.pennyWait = Math.max(0, this.pennyWait - dt);
    this.observe(sector, facts);
    if (notice && !this.warningShowing) {
      this.queue = this.queue.filter((request) => this.valid(request));
      const warning = this.queue.find((request) => request.conversation.priority === "warning");
      if (warning) {
        this.start(warning);
      }
      return;
    }
    if (this.active) {
      this.active.elapsed += dt;
      if (this.active.elapsed >= CONVERSATION_TUNING.lineSeconds - EPSILON) {
        this.nextLine();
      }
    } else {
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.quietFor = facts.inDanger ? 0 : this.quietFor + dt;
    }
    if (this.quietFor >= CONVERSATION_TUNING.quietSeconds - EPSILON) {
      this.quietFor = 0;
      const pool = this.conversations.find(
        (conversation) =>
          conversation.trigger.kind === "quiet" &&
          conversation.trigger.sector === sector &&
          !this.seen.includes(conversation.id),
      );
      if (pool) {
        this.enqueue({ conversation: pool, instance: pool.id });
      }
    }
    this.schedule();
  }

  private observe(sector: SectorId, facts: ConversationFacts): void {
    this.done.move ||= facts.moved;
    this.done.aim ||= facts.aimed;
    this.done.stardust ||= facts.collectedStardust;
    this.done.dock ||= facts.docked;
    this.pennyPoints = facts.pennyPoints;
    if (this.seen.includes("lesson:move")) {
      this.request((trigger) => trigger.kind === "lesson" && trigger.lesson === "aim");
    }
    if (facts.stardustInSight) {
      this.request((trigger) => trigger.kind === "lesson" && trigger.lesson === "stardust");
    }
    if (facts.newStation) {
      this.request((trigger) => trigger.kind === "lesson" && trigger.lesson === "dock");
    }
    // A group's own meeting comes before the general reaction to a new place.
    for (const id of facts.newlyMapped) {
      this.request(
        (trigger) =>
          trigger.kind === "meeting" && trigger.sector === sector && trigger.destination === id,
      );
    }
    if (facts.newlyMapped.length > 0 || facts.newStation) {
      this.request((trigger) => trigger.kind === "mapped");
    }
    if (facts.capitalInSight) {
      this.request((trigger) => trigger.kind === "capital");
    }
    if (facts.inDanger && !this.inFight) {
      this.inFight = true;
      this.shieldWarned = false;
      const general = this.conversations.find(
        (conversation) =>
          conversation.trigger.kind === "general" &&
          conversation.trigger.sector === sector &&
          !this.seen.includes(conversation.id),
      );
      // The General's first broadcast in a galaxy speaks for that engagement's drones.
      if (general) {
        this.enqueue({ conversation: general, instance: general.id });
      } else {
        this.request((trigger) => trigger.kind === "drones");
      }
    } else if (!facts.inDanger) {
      this.inFight = false;
    }
    if (
      this.inFight &&
      !this.shieldWarned &&
      facts.shieldFraction <= CONVERSATION_TUNING.shieldLowFraction
    ) {
      this.shieldWarned = true;
      this.request((trigger) => trigger.kind === "shieldLow");
    }
    const unsensed = facts.pennyPoints.filter(
      (id) => !this.seen.includes(pennyInstance(sector, id)),
    );
    if (this.pennyWait > 0) {
      // Points that come into range while Penny rests pass unsensed.
      for (const id of unsensed) {
        this.seen.push(pennyInstance(sector, id));
      }
      return;
    }
    const [point] = unsensed;
    const penny = this.conversations.find((conversation) => conversation.trigger.kind === "penny");
    if (point !== undefined && penny && !this.queue.some((entry) => entry.point !== undefined)) {
      this.enqueue({ conversation: penny, instance: pennyInstance(sector, point), point });
    }
  }

  private request(matches: (trigger: Conversation["trigger"]) => boolean): void {
    for (const conversation of this.conversations) {
      if (matches(conversation.trigger)) {
        this.enqueue({ conversation, instance: conversation.id });
      }
    }
  }

  private enqueue(request: Request): void {
    const { conversation, instance } = request;
    if (
      (conversation.repeat === "never" && this.seen.includes(instance)) ||
      (conversation.repeat === "flight" && this.playedThisFlight.has(instance)) ||
      this.active?.instance === instance ||
      this.queue.some((entry) => entry.instance === instance)
    ) {
      return;
    }
    this.queue.push(request);
  }

  /** Whether a queued request may still show now; a lesson already acted on is spent instead. */
  private valid(request: Request): boolean {
    const { trigger } = request.conversation;
    if (trigger.kind === "lesson" && this.done[trigger.lesson]) {
      this.markSeen(request);
      return false;
    }
    if (trigger.kind === "shieldLow" || trigger.kind === "drones") {
      return this.inFight;
    }
    return request.point === undefined || this.pennyPoints.includes(request.point);
  }

  /**
   * The highest waiting request interrupts a lower one showing, which waits to resume. With
   * nothing showing, an interrupted one resumes at once, a warning starts at once, and any other
   * waits out the cooldown.
   */
  private schedule(): void {
    this.queue = this.queue.filter((request) => this.valid(request));
    // By rank, interrupted ones first within a rank, then in request order (a stable sort).
    const [next] = [...this.queue].sort(
      (a, b) =>
        rank(a.conversation) - rank(b.conversation) ||
        Number(b.resume !== undefined) - Number(a.resume !== undefined),
    );
    if (!next) {
      return;
    }
    if (this.active) {
      if (rank(next.conversation) < rank(this.active.conversation)) {
        this.start(next);
      }
      return;
    }
    if (
      next.resume !== undefined ||
      next.conversation.priority === "warning" ||
      this.cooldown <= EPSILON
    ) {
      this.start(next);
    }
  }

  private start(request: Request): void {
    const interrupted = this.active;
    this.queue = this.queue.filter((entry) => entry !== request);
    if (interrupted) {
      const { elapsed, line, ...waiting } = interrupted;
      this.queue.unshift({ ...waiting, resume: { elapsed, line } });
    }
    if (request.resume === undefined) {
      this.markSeen(request);
      if (request.conversation.trigger.kind === "penny") {
        this.pennyWait = CONVERSATION_TUNING.pennyIntervalSeconds;
      }
    }
    const { resume, ...shown } = request;
    this.active = { ...shown, elapsed: resume?.elapsed ?? 0, line: resume?.line ?? 0 };
  }

  /** Whether a warning shows, which a notice waits under. */
  get warningShowing(): boolean {
    return this.active?.conversation.priority === "warning";
  }

  private markSeen({ conversation, instance }: Request): void {
    if (conversation.repeat === "never" && !this.seen.includes(instance)) {
      this.seen.push(instance);
    }
    if (conversation.repeat === "flight") {
      this.playedThisFlight.add(instance);
    }
  }

  private nextLine(): void {
    const active = this.active;
    if (!active) {
      return;
    }
    if (active.line + 1 < active.conversation.lines.length) {
      active.line += 1;
      active.elapsed = 0;
      return;
    }
    this.active = null;
    this.cooldown = CONVERSATION_TUNING.cooldownSeconds;
    this.quietFor = 0;
  }

  private reset(): void {
    this.active = null;
    this.cooldown = 0;
    this.inFight = false;
    this.pennyPoints = [];
    this.pennyWait = 0;
    this.playedThisFlight = new Set();
    this.queue = [];
    this.quietFor = 0;
    this.shieldWarned = false;
  }
}
