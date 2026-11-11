import {
  type Conversation,
  CONVERSATION_PRIORITIES,
  CONVERSATION_TUNING,
  type ConversationLine,
  GENERAL_NAMED,
  type JobMoment,
  type Lesson,
  type Speaker,
  SPEAKERS,
} from "../data/conversations.ts";
import type { SectorId } from "../data/types.ts";
import type { FlightState, SectorProgress, SpaceObject, Vec } from "./types.ts";

// The in-flight conversation box's schedule (gameplay/rules.md "Astra and Penny in flight"):
// one conversation at a time, chosen by priority (BOX_PRIORITIES). A higher one interrupts a lower
// one showing, which resumes after it if still relevant. Each request carries its trigger, which
// it re-checks against the current facts whenever it could show, and a request whose trigger no
// longer holds is dropped. Ordinary ones wait out a cooldown after the last one ends; warnings
// skip it. Each line shows for its time or until tapped. The director only advances while the
// flight runs, so pausing, a story panel or a station card freezes it.

/** What the flight did and what is around Ada this step. */
export interface ConversationFacts {
  readonly aimed: boolean;
  /** A capital ship within sight range. */
  readonly capitalInSight: boolean;
  readonly collectedStardust: boolean;
  readonly docked: boolean;
  /** A live enemy presses Ada (flight.ts dronesNear); damage from debris or hazards is not one. */
  readonly dronesNear: boolean;
  /** Ada is inside a space current. */
  readonly inCurrent: boolean;
  readonly inDanger: boolean;
  /** Held-job moments this step; jobComplete asks Astra for a lore line. */
  readonly jobMoments: readonly (JobMoment | "jobComplete")[];
  /**
   * A held hunt's lost item within Penny's hunt range, as its point id: Penny senses it once,
   * whatever her rest.
   */
  readonly lostItemNear: string | null;
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

/** Whether a request's trigger still holds in this step's facts. */
type Holds = (facts: ConversationFacts) => boolean;

interface Request {
  readonly conversation: Conversation;
  /** Its trigger, re-checked whenever it could show; a request whose trigger lapsed is dropped. */
  readonly holds: Holds;
  readonly instance: string;
  /** Penny's point of interest; one waits at a time. */
  readonly point?: string;
  /** Where an interrupted conversation resumes. */
  readonly resume?: { readonly elapsed: number; readonly line: number };
}

interface Active extends Request {
  elapsed: number;
  line: number;
}

const rank = (conversation: Conversation) => CONVERSATION_PRIORITIES.indexOf(conversation.priority);

/** An event's trigger, such as an arrival or a newly mapped place, which keeps holding. */
const always: Holds = () => true;
/** Drones pressing Ada in danger: the drone warning's and the General's broadcast's trigger. */
const dronesPress: Holds = (facts) => facts.inDanger && facts.dronesNear;

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
 * unmapped destinations, the guarded holodisk while its waypoint shows, undiscovered stations,
 * discovery caches and the uncharted landmarks given.
 */
export function pennyPoints(
  progress: Pick<SectorProgress, "known" | "stations">,
  holodiskWaypoint: boolean,
  landmarks: readonly (Vec & { readonly id: string })[],
  flight: Pick<FlightState, "objects" | "player">,
): string[] {
  const distance = (point: Vec) => Math.hypot(point.x - flight.player.x, point.y - flight.player.y);
  return [
    ...flight.objects.filter((object) =>
      object.kind === "destination"
        ? object.id === "holodisk"
          ? holodiskWaypoint
          : !progress.known.includes(object.id)
        : object.kind === "station"
          ? !progress.stations.includes(object.id)
          : object.role === "discovery" && object.kind === "pickup" && object.hp > 0,
    ),
    ...landmarks,
  ]
    .filter((point) => distance(point) <= CONVERSATION_TUNING.pennyRange)
    .sort((a, b) => distance(a) - distance(b))
    .map((point) => point.id);
}

export class ConversationDirector {
  private active: Active | null = null;
  private cooldown = 0;
  private readonly conversations: readonly Conversation[];
  private done: Record<Lesson, boolean> = { aim: false, dock: false, move: false, stardust: false };
  /** Danger since it last cleared: a fight, which a low shield warns of once. */
  private inFight = false;
  /** This fight's drones were called out. */
  private dronesCalled = false;
  /** Seconds until Penny can sense another point. */
  private pennyWait = 0;
  private playedThisFlight = new Set<string>();
  /** Penny's sensed points since the last takeSensed, as their instances; rested-past ones never. */
  private sensedPoints: string[] = [];
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
      this.queue = this.queue.filter((request) => this.valid(facts, request));
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
        this.enqueue({ conversation: pool, holds: (now) => !now.inDanger, instance: pool.id });
      }
    }
    this.schedule(facts);
  }

  private observe(sector: SectorId, facts: ConversationFacts): void {
    this.done.move ||= facts.moved;
    this.done.aim ||= facts.aimed;
    this.done.stardust ||= facts.collectedStardust;
    this.done.dock ||= facts.docked;
    if (this.seen.includes("lesson:move")) {
      this.request((trigger) => trigger.kind === "lesson" && trigger.lesson === "aim");
    }
    if (facts.stardustInSight) {
      this.request(
        (trigger) => trigger.kind === "lesson" && trigger.lesson === "stardust",
        (now) => now.stardustInSight,
      );
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
      this.request(
        (trigger) => trigger.kind === "capital",
        (now) => now.capitalInSight,
      );
    }
    if (facts.inCurrent) {
      this.request(
        (trigger) => trigger.kind === "current",
        (now) => now.inCurrent,
      );
    }
    if (facts.inDanger && !this.inFight) {
      this.inFight = true;
      this.dronesCalled = false;
      this.shieldWarned = false;
    } else if (!facts.inDanger) {
      this.inFight = false;
    }
    // Only drones pressing Ada call them out; damage from debris or hazards alone sets danger.
    if (this.inFight && !this.dronesCalled && dronesPress(facts)) {
      this.dronesCalled = true;
      const general = this.conversations.find(
        (conversation) =>
          conversation.trigger.kind === "general" &&
          conversation.trigger.sector === sector &&
          !this.seen.includes(conversation.id),
      );
      // The General's first broadcast in a galaxy speaks for that engagement's drones.
      if (general) {
        this.enqueue({ conversation: general, holds: dronesPress, instance: general.id });
      } else {
        this.request((trigger) => trigger.kind === "drones", dronesPress);
      }
    }
    if (
      this.inFight &&
      !this.shieldWarned &&
      facts.shieldFraction <= CONVERSATION_TUNING.shieldLowFraction
    ) {
      this.shieldWarned = true;
      this.request(
        (trigger) => trigger.kind === "shieldLow",
        (now) => now.inDanger,
      );
    }
    this.observeJob(sector, facts);
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
      this.enqueue({
        conversation: penny,
        holds: (now) => now.pennyPoints.includes(point),
        instance: pennyInstance(sector, point),
        point,
      });
    }
  }

  /** A held job's lines, a completed job's lore line and Penny's lost-item sense. */
  private observeJob(sector: SectorId, facts: ConversationFacts): void {
    for (const moment of facts.jobMoments) {
      if (moment !== "jobComplete") {
        this.request((trigger) => trigger.kind === "job" && trigger.moment === moment);
        continue;
      }
      // The first lore line neither seen nor waiting, so two quick jobs earn two lines.
      const lore = this.conversations.find(
        ({ id, trigger }) =>
          trigger.kind === "jobLore" &&
          trigger.sector === sector &&
          !this.seen.includes(id) &&
          this.active?.instance !== id &&
          !this.queue.some((entry) => entry.instance === id),
      );
      if (lore) {
        this.enqueue({ conversation: lore, holds: always, instance: lore.id });
      }
    }
    const penny = this.conversations.find((conversation) => conversation.trigger.kind === "penny");
    const item = facts.lostItemNear;
    if (item !== null && penny) {
      this.enqueue({
        conversation: penny,
        holds: (now) => now.lostItemNear === item,
        instance: pennyInstance(sector, item),
      });
    }
  }

  /** Each conversation whose trigger matches, held by holds (an event's by default). */
  private request(
    matches: (trigger: Conversation["trigger"]) => boolean,
    holds: Holds = always,
  ): void {
    for (const conversation of this.conversations) {
      if (matches(conversation.trigger)) {
        this.enqueue({ conversation, holds, instance: conversation.id });
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

  /**
   * Whether a queued request may still show now: its trigger holds in facts. A lesson already
   * acted on is spent instead.
   */
  private valid(facts: ConversationFacts, request: Request): boolean {
    const { trigger } = request.conversation;
    if (trigger.kind === "lesson" && this.done[trigger.lesson]) {
      this.markSeen(request);
      return false;
    }
    return request.holds(facts);
  }

  /**
   * The highest waiting request interrupts a lower one showing, which waits to resume. With
   * nothing showing, an interrupted one resumes at once, a warning starts at once, and any other
   * waits out the cooldown.
   */
  private schedule(facts: ConversationFacts): void {
    this.queue = this.queue.filter((request) => this.valid(facts, request));
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
        this.sensedPoints.push(request.instance);
      }
    }
    const { resume, ...shown } = request;
    this.active = { ...shown, elapsed: resume?.elapsed ?? 0, line: resume?.line ?? 0 };
  }

  /** The points Penny sensed since the last call, as `penny:{sector}:{point}` instances. */
  takeSensed(): string[] {
    const sensed = this.sensedPoints;
    this.sensedPoints = [];
    return sensed;
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
    this.dronesCalled = false;
    this.inFight = false;
    this.pennyWait = 0;
    this.playedThisFlight = new Set();
    this.queue = [];
    this.quietFor = 0;
    this.shieldWarned = false;
  }
}
