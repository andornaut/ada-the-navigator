import { type Random, seededRandom, shuffled } from "@andornaut/game-kit/random";

import { CAST, SPEAKER_CAST } from "../data/cast.ts";
import {
  type Conversation,
  CONVERSATION_PRIORITIES,
  CONVERSATION_TUNING,
  type ConversationLine,
  type EncounterCue,
  GENERAL_NAMED,
  INTERACTION_COPY,
  type JobMoment,
  type Lesson,
  lineDuration,
  type Speaker,
  SPEAKERS,
} from "../data/conversations.ts";
import { BUILT } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { FlightState, GalaxyProgress, SpaceObject, Vec } from "./types.ts";

// The in-flight conversation box's schedule (gameplay/rules.md "Astra and Penny in flight"):
// one conversation at a time, chosen by priority (BOX_PRIORITIES). A higher one interrupts a lower
// one showing, which resumes after it if still relevant. Each request carries its trigger, which
// it re-checks against the current facts whenever it could show, and a request whose trigger no
// longer holds is dropped. Ordinary ones wait out a cooldown after the last one ends; warnings
// skip it. Each line shows for its time or until tapped. The director only advances while the
// flight runs, so pausing, a story panel or a station card freezes it. A repeating trigger's pool
// waits as one request and shows one variant, drawn as it starts: the pool plays in a shuffled
// order, never one variant twice in a row, and reshuffles once all have played.

/** What the flight did and what is around Ada this step. */
export interface ConversationFacts {
  readonly aimed: boolean;
  /** A capital ship within sight range. */
  readonly capitalInSight: boolean;
  readonly collectedStardust: boolean;
  readonly docked: boolean;
  /** First-meeting cues this step, in the current galaxy. */
  readonly encounters: readonly EncounterCue[];
  /** A frigate within sight range. */
  readonly frigateInSight: boolean;
  /** A live enemy presses Ada (flight.ts dronesNear); damage from debris or hazards is not one. */
  readonly dronesNear: boolean;
  /**
   * Destinations whose blocking guard was cued this step (flight.ts cueGuards), each with a
   * uniform pick in [0, 1) that chooses its guard line.
   */
  readonly guardCues: readonly { readonly destination: string; readonly pick: number }[];
  /** A heavy was disabled this step, its hull holding. */
  readonly heavyDisabled: boolean;
  /** Holodisks Ada holds: every galaxy's recovered one. */
  readonly holodisks: number;
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
  /** Stations mapped this step, the hub included, by id. */
  readonly stationsDiscovered: readonly string[];
  /** Mapped stations, the hub included, within station discovery range of Ada, by id. */
  readonly stationsNear: readonly string[];
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
export function pennyInstance(galaxy: GalaxyNumber, point: string): string {
  return `penny:${galaxy}:${point}`;
}

/** Holodisks recovered across every galaxy, the count memory lines and broadcasts follow. */
export function holodisksHeld(
  progress: Readonly<Partial<Record<GalaxyNumber, Pick<GalaxyProgress, "holodisk">>>>,
): number {
  return Object.values(progress).filter((p) => p?.holodisk).length;
}

/**
 * The name on a speaker's tab: a cast member's own name in place of the copy's role label, and the
 * General's unknown until the third holodisk is in.
 */
export function speakerName(
  progress: Readonly<Partial<Record<GalaxyNumber, Pick<GalaxyProgress, "holodisk">>>>,
  speaker: Speaker,
): string {
  const cast = SPEAKER_CAST[speaker];
  if (cast) {
    return CAST[cast].name;
  }
  return speaker === "general" && holodisksHeld(progress) >= GENERAL_NAMED.holodisks
    ? GENERAL_NAMED.name
    : SPEAKERS[speaker].name;
}

/**
 * Whether object shows on Ada's screen: the view's isometric projection around her, with its hull.
 * The view is the 720x360 play view.
 */
export function onScreen(
  view: { readonly height: number; readonly width: number },
  player: Vec,
  object: Pick<SpaceObject, "radius" | "x" | "y">,
): boolean {
  const dx = object.x - player.x;
  const dy = object.y - player.y;
  return (
    Math.abs(dx - dy) <= view.width / 2 + object.radius &&
    Math.abs((dx + dy) / 2) <= view.height / 2 + object.radius
  );
}

/**
 * Whether a heavy ship's battle is in sight: a live frigate or capital on screen, or one or its
 * escorts engaging Ada, so a battle that opens with its escorts still counts.
 */
export function heavyInSight(
  archetype: "capital" | "frigate",
  view: { readonly height: number; readonly width: number },
  flight: Pick<FlightState, "objects" | "player">,
): boolean {
  const heavies = flight.objects.filter(
    (object) => object.kind === "enemy" && object.hp > 0 && object.enemy?.archetype === archetype,
  );
  const ids = new Set(heavies.map((object) => object.id));
  return (
    heavies.some(
      (object) => onScreen(view, flight.player, object) || object.enemy?.engaged === true,
    ) ||
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
  progress: Pick<GalaxyProgress, "known" | "stations">,
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
  /** Each pool's variants still to play in this shuffle, by index, and the last one drawn. */
  private readonly decks = new Map<string, { order: number[]; last: number | null }>();
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
  /** Mapped stations in range last step; null until the flight's first step. */
  private nearStations: ReadonlySet<string> | null = null;
  private queue: Request[] = [];
  private quietFor = 0;
  private random: Random;
  private galaxy: GalaxyNumber | null = null;
  private readonly seen: string[];
  private shieldWarned = false;

  /**
   * seen is the saved list, which the director extends as conversations show; random shuffles the
   * pools until a flight gives its own.
   */
  constructor(
    conversations: readonly Conversation[],
    seen: string[],
    random: Random = seededRandom(1),
  ) {
    this.conversations = conversations;
    this.seen = seen;
    this.random = random;
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
   * A flight starts or resumes in galaxy. done names lessons Ada has already acted on, such as
   * collecting Stardust before; random, when given, shuffles the pools from now on.
   */
  beginFlight(
    galaxy: GalaxyNumber,
    done: Partial<Record<Lesson, boolean>> = {},
    random: Random = this.random,
  ): void {
    this.reset();
    this.random = random;
    this.galaxy = galaxy;
    this.done = { aim: false, dock: false, move: false, stardust: false, ...done };
    this.request((trigger) => trigger.kind === "lesson" && trigger.lesson === "move");
    this.request((trigger) => trigger.kind === "arrival" && trigger.galaxy === galaxy);
  }

  /** The flight ended: nothing shows or waits. */
  endFlight(): void {
    this.reset();
    this.galaxy = null;
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

  /** Dismisses the active exchange, preserving queued warnings and reactions. */
  skip(): void {
    if (!this.active) {
      return;
    }
    this.active.line = this.active.conversation.lines.length - 1;
    this.nextLine();
  }

  /**
   * One flight step. A notice ranks below warnings and above everything else (BOX_PRIORITIES):
   * while one shows, requests still queue and a warning may start or keep showing, but any other
   * line waits where it was and resumes once the notice clears.
   */
  step(dt: number, notice: boolean, facts: ConversationFacts): void {
    const galaxy = this.galaxy;
    if (galaxy === null || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    this.pennyWait = Math.max(0, this.pennyWait - dt);
    this.observe(galaxy, facts);
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
      const shown = this.active.conversation.lines[this.active.line];
      if (this.active.elapsed >= lineDuration(shown?.text ?? "") - EPSILON) {
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
          conversation.trigger.galaxy === galaxy &&
          !this.seen.includes(conversation.id),
      );
      if (pool) {
        this.enqueue({ conversation: pool, holds: (now) => !now.inDanger, instance: pool.id });
      }
    }
    this.schedule(facts);
  }

  private observe(galaxy: GalaxyNumber, facts: ConversationFacts): void {
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
    // A people's first meeting, and a group's own, come before the general reaction to a new place.
    for (const cue of facts.encounters) {
      this.request(
        (trigger) =>
          trigger.kind === "encounter" && trigger.galaxy === galaxy && trigger.cue === cue,
      );
    }
    for (const id of facts.newlyMapped) {
      this.request(
        (trigger) =>
          trigger.kind === "meeting" && trigger.galaxy === galaxy && trigger.destination === id,
      );
    }
    if (facts.newlyMapped.length > 0) {
      this.request((trigger) => trigger.kind === "mapped");
    }
    if (facts.heavyDisabled) {
      this.request((trigger) => trigger.kind === "disabled");
    }
    // Each cued destination plays one guard line, picked at random from the pool.
    const guardLines = this.conversations.filter(({ trigger }) => trigger.kind === "guard");
    for (const { destination, pick } of facts.guardCues) {
      const conversation =
        guardLines[Math.min(guardLines.length - 1, Math.floor(pick * guardLines.length))];
      if (conversation) {
        this.enqueue({ conversation, holds: always, instance: `guard:${galaxy}:${destination}` });
      }
    }
    if (facts.newStation) {
      this.request((trigger) => trigger.kind === "stationMapped");
    }
    this.observeReturns(galaxy, facts);
    if (facts.frigateInSight) {
      this.request(
        (trigger) => trigger.kind === "frigate",
        (now) => now.frigateInSight,
      );
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
      // A built galaxy's one broadcast, the line after the holodisks Ada holds (none while she
      // holds none), speaks for its first engagement's drones; a placeholder plays none, and a
      // broadcast bound to a galaxy plays only there.
      const instance = `general:${galaxy}`;
      const general =
        BUILT.has(galaxy) && !this.seen.includes(instance)
          ? this.conversations.find(
              ({ trigger }) =>
                trigger.kind === "general" &&
                trigger.held === facts.holodisks &&
                (trigger.galaxy === undefined || trigger.galaxy === galaxy),
            )
          : undefined;
      if (general) {
        this.enqueue({ conversation: general, holds: dronesPress, instance });
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
    this.observeJob(galaxy, facts);
    const unsensed = facts.pennyPoints.filter(
      (id) => !this.seen.includes(pennyInstance(galaxy, id)),
    );
    if (this.pennyWait > 0) {
      // Points that come into range while Penny rests pass unsensed.
      for (const id of unsensed) {
        this.seen.push(pennyInstance(galaxy, id));
      }
      return;
    }
    const [point] = unsensed;
    const penny = this.conversations.find((conversation) => conversation.trigger.kind === "penny");
    if (point !== undefined && penny && !this.queue.some((entry) => entry.point !== undefined)) {
      this.enqueue({
        conversation: penny,
        holds: (now) => now.pennyPoints.includes(point),
        instance: pennyInstance(galaxy, point),
        point,
      });
    }
  }

  /**
   * Ada back in range of a station mapped before she entered it, once per station each flight; one
   * mapped as she arrives, or in range as the flight starts, is no return.
   */
  private observeReturns(galaxy: GalaxyNumber, facts: ConversationFacts): void {
    const before = this.nearStations;
    this.nearStations = new Set(facts.stationsNear);
    const back = this.conversations.find(({ trigger }) => trigger.kind === "stationReturn");
    if (!before || !back) {
      return;
    }
    for (const id of facts.stationsNear) {
      if (!before.has(id) && !facts.stationsDiscovered.includes(id)) {
        this.enqueue({
          conversation: back,
          holds: (now) => now.stationsNear.includes(id),
          instance: `return:${galaxy}:${id}`,
        });
      }
    }
  }

  /** A held job's lines, a completed job's lore line and Penny's lost-item sense. */
  private observeJob(galaxy: GalaxyNumber, facts: ConversationFacts): void {
    for (const moment of facts.jobMoments) {
      if (moment !== "jobComplete") {
        this.request((trigger) => trigger.kind === "job" && trigger.moment === moment);
        continue;
      }
      // The first lore line neither seen nor waiting, so two quick jobs earn two lines.
      const lore = this.conversations.find(
        ({ id, trigger }) =>
          trigger.kind === "jobLore" &&
          trigger.galaxy === galaxy &&
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
        instance: pennyInstance(galaxy, item),
      });
    }
  }

  /**
   * Each conversation whose trigger matches, held by holds (an event's by default); a pool waits
   * as one request under its name.
   */
  private request(
    matches: (trigger: Conversation["trigger"]) => boolean,
    holds: Holds = always,
  ): void {
    const pools = new Set<string>();
    for (const conversation of this.conversations) {
      if (!matches(conversation.trigger) || (conversation.pool && pools.has(conversation.pool))) {
        continue;
      }
      if (conversation.pool) {
        pools.add(conversation.pool);
      }
      this.enqueue({ conversation, holds, instance: conversation.pool ?? conversation.id });
    }
  }

  /** The pool's next variant: the next in its shuffle, never the last one drawn again. */
  private draw(pool: string): Conversation {
    const variants = this.conversations.filter((conversation) => conversation.pool === pool);
    const deck = this.decks.get(pool) ?? { last: null, order: [] };
    if (deck.order.length === 0) {
      deck.order = shuffled(
        this.random,
        variants.map((_, index) => index),
      );
      if (deck.order.length > 1 && deck.order[0] === deck.last) {
        deck.order.push(deck.order.shift()!);
      }
    }
    const index = deck.order.shift()!;
    deck.last = index;
    this.decks.set(pool, deck);
    return variants[index]!;
  }

  private enqueue(request: Request): void {
    const { conversation, instance } = request;
    if (
      (conversation.repeat === "never" && this.seen.includes(instance)) ||
      // A station return's instance is its station's, once each flight.
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
    const pool = request.conversation.pool;
    const conversation = resume === undefined && pool ? this.draw(pool) : request.conversation;
    this.active = {
      ...shown,
      conversation,
      elapsed: resume?.elapsed ?? 0,
      line: resume?.line ?? 0,
    };
  }

  /** The points Penny sensed since the last call, as `penny:{galaxy}:{point}` instances. */
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
    this.nearStations = null;
    this.pennyWait = 0;
    this.playedThisFlight = new Set();
    this.queue = [];
    this.quietFor = 0;
    this.shieldWarned = false;
  }
}

/** Pages one Use panel without applying or guessing any gameplay outcome. */
export class InteractionConversation {
  private panel: import("./types.ts").DialogueState | null = null;
  private copy: import("../data/conversations.ts").InteractionCopy | null = null;
  private index = 0;
  private answer: readonly import("../data/conversations.ts").InteractionLine[] | null = null;
  private answerIndex = 0;
  private topicsShown = false;

  show(
    copy: import("../data/conversations.ts").InteractionCopy,
    panel: import("./types.ts").DialogueState,
  ): void {
    if (panel === this.panel) {
      return;
    }
    this.panel = panel;
    this.copy = copy;
    this.index = 0;
    this.answer = null;
    this.answerIndex = 0;
    this.topicsShown = false;
  }

  get line(): import("../data/conversations.ts").InteractionLine | null {
    return this.answer?.[this.answerIndex] ?? this.copy?.lines[this.index] ?? null;
  }

  get atOutcome(): boolean {
    return !this.answer && this.index >= (this.copy?.lines.length ?? 0) - 1;
  }

  get topics() {
    return this.topicsShown && !this.answer ? (this.copy?.topics ?? []) : [];
  }

  get choices() {
    return this.atOutcome ? (this.panel?.choices.filter(({ id }) => id !== "optional") ?? []) : [];
  }

  get party(): string {
    return this.copy?.party ?? "Astra";
  }

  get hasTopics(): boolean {
    return (this.copy?.topics.length ?? 0) > 0;
  }

  ask(): void {
    this.topicsShown = true;
  }

  topic(index: number): void {
    const topic = this.copy?.topics[index];
    if (!topic || !this.topicsShown) {
      return;
    }
    this.answer = topic.lines;
    this.answerIndex = 0;
  }

  /** Returns to the topic list after an answer; never resolves a model choice. */
  advance(): void {
    if (this.answer) {
      if (++this.answerIndex >= this.answer.length) {
        this.answer = null;
      }
    } else if (this.topicsShown) {
      this.topicsShown = false;
    } else if (!this.atOutcome) {
      this.index++;
    }
  }

  /** Pending choices remain visible and must be explicitly answered. */
  skip(): void {
    this.answer = null;
    this.topicsShown = false;
    this.index = Math.max(0, (this.copy?.lines.length ?? 0) - 1);
  }

  reset(): void {
    this.panel = null;
    this.copy = null;
    this.answer = null;
  }
}

/** Resolves legacy role labels through the existing cast, leaving narration unattributed. */
export function interactionCopy(
  galaxy: number,
  panel: import("./types.ts").DialogueState,
): import("../data/conversations.ts").InteractionCopy {
  const roles: Readonly<Record<string, string>> = {
    Grower: "Clover",
    Miner: "Mica",
    "Regular visitor": panel.context === "approach" ? "Jasper" : "Opal",
    Salvager: "Patch",
    Station: "Quartz",
    Whale: "Marlo",
    Workshop: "Rivet",
  };
  const name = roles[panel.title] ?? panel.title;
  if (panel.context === "holodiskHandover") {
    const party = ["Clover", "Rivet", "Patch"].includes(name) ? name : "Clover";
    return {
      lines: [
        { speaker: party, text: "We found this drifting near our outposts." },
        { speaker: "Ada", text: "Astra, is that your holodisk?" },
        { speaker: "Astra", text: "Yes. A piece of my memory." },
        { speaker: party, text: "Take it, with our thanks." },
      ],
      party,
      topics: [
        {
          label: "Where was it?",
          lines: [{ speaker: party, text: "Drifting near our outposts." }],
        },
        { label: "What does it hold?", lines: [{ speaker: "Astra", text: "Part of my memory." }] },
      ],
    };
  }
  const authored =
    INTERACTION_COPY[`${galaxy}.${panel.context}`] ?? INTERACTION_COPY[panel.context];
  if (authored) {
    if (panel.context === "holodiskLead") {
      return { ...authored, lines: authored.lines.slice(0, 2), topics: [] };
    }
    if (panel.context === "holodiskLeadSong") {
      return { ...authored, lines: authored.lines.slice(2) };
    }
    return authored;
  }
  const narration = ["reunionDeparture", "approachDocking"].includes(panel.context);
  const known = ["Ada", "Astra", "Penny", ...Object.values(CAST).map(({ name }) => name)].includes(
    name,
  );
  return {
    lines: [{ speaker: narration ? "" : known ? name : "Astra", text: panel.text }],
    party: narration ? (galaxy === 3 ? "Marlo" : "Jasper") : known ? name : "Astra",
    topics: [],
  };
}
