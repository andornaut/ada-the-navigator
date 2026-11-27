import { NEEDLE_CADENCE } from "../data/capitalBosses.ts";
import type { ConversationLine } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { isNeedleCourseStart, NEEDLE, NEEDLE_PLACES } from "../data/needle.ts";
import { NEEDLE_COPY, NEEDLE_COURSE_COPY, NEEDLE_LEARNING } from "../data/needleCopy.ts";
import type { CapitalBossProgress } from "./capitalBossEncounter.ts";
import type { ChapterContext, ChapterResult } from "./chapterProtocol.ts";
import { ensureDestination, ensureDestinationAt, spawnChapterEnemy } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { worldActivateFlightRegion } from "./geography.ts";
import {
  type NeedleApproach,
  type NeedleCourse,
  needleCourses,
  needleLearningFeedback,
  type NeedleProgress,
  readNeedleProgress,
  stepNeedleCourse,
  unfinishedNeedleCourse,
} from "./needle.ts";
import {
  type NeedleCadencePlacement,
  planNeedleCadence,
  planNeedleExit,
} from "./needleExitPlan.ts";
import type {
  DialogueChoice,
  DialogueState,
  FlightState,
  GalaxyProgress,
  UseAction,
  Vec,
} from "./types.ts";
import { shipTuning } from "./upgrades.ts";
import { worldDistance, worldPoint } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";
export interface NeedleChapterProgress extends NeedleProgress {
  met: boolean;
  briefed: boolean;
  practiceThanked: boolean;
}
export interface NeedleCue {
  speaker: "loom" | "ada" | "astra";
  text: string;
}
type StoryCourse = "practice" | "eye";
export interface NeedleFlight {
  anchor: Vec;
  activityPatrol?: { id: number; tried: number[] };
  chatter: NeedleCue[];
  exitPackPlaced: boolean;
  exitWarned?: boolean;
  /** The current course can be started with zero cleared gates, including across Continue. */
  startedCourse?: StoryCourse;
}
type ChapterProgress = GalaxyProgress & {
  needle?: NeedleChapterProgress;
};
type ChapterFlight = FlightState & {
  needle?: NeedleFlight;
};
const progressOf = (context: ChapterContext): NeedleChapterProgress =>
  ((context.progress as ChapterProgress).needle ??= {
    briefed: false,
    eyeLit: 0,
    met: false,
    practiceLit: 0,
    practiceThanked: false,
  });
const stateOf = (context: ChapterContext) => (context.flight as ChapterFlight).needle;
const nearbyStarts = new WeakMap<NeedleFlight, StoryCourse>();

export type NeedleTrackedObjective = {
  readonly id: "needlePractice" | "needleEye";
  readonly point: Readonly<Vec>;
} & ({ readonly step: "flag" } | { readonly step: "ring"; readonly ringIndex: number });

/** Supplies one revealed course step to the existing tracked story objective. */
export function needleTrackedObjective(context: ChapterContext): NeedleTrackedObjective | null {
  const progress = (context.progress as ChapterProgress).needle;
  if (
    context.flight.galaxy !== 4 ||
    !progress?.briefed ||
    context.progress.holodisk ||
    context.progress.questComplete
  ) {
    return null;
  }
  const kind = unfinishedNeedleCourse(progress);
  const course = kind && needleCourses(context.flight)?.[kind];
  if (!course) {
    return null;
  }
  const id = kind === "practice" ? "needlePractice" : "needleEye";
  const ringIndex = kind === "practice" ? progress.practiceLit : progress.eyeLit;
  if (ringIndex > 0 || stateOf(context)?.startedCourse === kind) {
    return { id, point: { ...course.gates[ringIndex]!.point }, ringIndex, step: "ring" };
  }
  return { id, point: { ...course.path[0]! }, step: "flag" };
}

function nearCourseStart(context: ChapterContext, course: NeedleCourse): boolean {
  const { player } = context.flight;
  const start = course.path[0]!;
  return (
    worldDistance(flightWorldContext(context.flight), player, start) <=
    context.content.tuning.talkRange
  );
}
export { needleCourses } from "./needle.ts";
export { NEEDLE_CADENCE };

export const NEEDLE_CADENCE_CUES = {
  approach: {
    speaker: "captainCadence",
    text: "Hold at the channel mouth. Fire when they come through.",
  },
  hardpoint: {
    speaker: "ada",
    text: "There's a pause between shots. I can use that.",
  },
  resolved: {
    speaker: "astra",
    text: "I picked up a transmission. I've saved it to our flight log.",
  },
} as const satisfies Record<string, ConversationLine>;

/** The optional mark becomes eligible at the final gate, independently of disk collection. */
export function needleCadenceSite(
  context: ChapterContext,
  placement: NeedleCadencePlacement,
): Vec | null {
  if (
    context.flight.galaxy !== 4 ||
    (context.progress as ChapterProgress).needle?.eyeLit !== NEEDLE.eyeGates ||
    context.progress.capitalBoss
  ) {
    return null;
  }
  const courses = needleCourses(context.flight);
  return courses
    ? planNeedleCadence(
        flightWorldContext(context.flight),
        courses,
        context.content.tuning.talkRange,
        placement,
      )
    : null;
}

/** One log entry per outcome. The caller owns the completed-memory reveal gate. */
export function needleCadenceTransmission(
  boss: CapitalBossProgress | undefined,
  archieRevealed: boolean,
): { readonly id: string; readonly text: string } | null {
  return boss?.phase === "resolved"
    ? {
        id: `${NEEDLE_CADENCE.id}:transmission`,
        text: archieRevealed
          ? "Admiral Archie's orders: Hold the exits. Recover every disk."
          : "Orders from fleet command: Hold the exits. Recover every disk.",
      }
    : null;
}

/** Canonical placement and enemy helpers own world retention, pack accounting and physics. */
export function initNeedle(context: ChapterContext): void {
  if (context.flight.galaxy !== 4) {
    return;
  }
  progressOf(context);
  let state = stateOf(context);
  if (!state) {
    const loom = ensureDestination(context.content, "elderLoom", context.flight);
    state = { anchor: { x: loom.x, y: loom.y }, chatter: [], exitPackPlaced: false };
    (context.flight as ChapterFlight).needle = state;
  }
  const layout = needleCourses(context.flight)!;
  ensureDestinationAt(context.content, "needlePractice", layout.practice.path[0]!, context.flight);
  ensureDestinationAt(context.content, "needleEye", layout.eye.path[0]!, context.flight);
  if (!context.progress.holodisk) {
    const world = flightWorldContext(context.flight);
    const retained = context.flight.world.notables.holodisk;
    if (retained) {
      worldActivateFlightRegion(world, context.content, retained, context.flight);
    }
    const disk = ensureDestinationAt(
      context.content,
      "holodisk",
      layout.eye.holodisk,
      context.flight,
    );
    const point =
      world.worldSide === undefined
        ? layout.eye.holodisk
        : wrapPoint(world.worldSide, layout.eye.holodisk);
    // Older flights retain the same disk identity at the exit of the shorter Eye.
    disk.x = point.x;
    disk.y = point.y;
  }
  if (!state.exitPackPlaced && !context.progress.holodisk) {
    for (const actor of planNeedleExit(context.flight.seed, layout.eye.pack)) {
      spawnChapterEnemy(context.content, actor.archetype, actor.id, actor.point, context.flight, {
        home: actor.home,
        packId: actor.packId,
      });
    }
    state.exitPackPlaced = true;
  }
}
/** Gate attempts use the actual frame displacement, resultant velocity and bought engine top speed. */
export function stepNeedle(context: ChapterContext, _seconds: number, previous: Vec): void {
  const progress = progressOf(context);
  const state = stateOf(context);
  const layout = needleCourses(context.flight);
  if (!state || !layout || !progress.briefed) {
    return;
  }
  const exit = layout.eye.path.at(-1)!;
  const world = flightWorldContext(context.flight);
  if (
    progress.eyeLit === NEEDLE.eyeGates &&
    !state.exitWarned &&
    worldDistance(world, context.flight.player, exit) <= layout.eye.width
  ) {
    state.chatter.push({ speaker: "astra", text: NEEDLE_LEARNING.drones });
    state.exitWarned = true;
  }
  if (context.progress.holodisk) {
    return;
  }
  const kind = unfinishedNeedleCourse(progress);
  if (!kind) {
    nearbyStarts.delete(state);
    return;
  }
  const course = layout[kind];
  if (nearCourseStart(context, course)) {
    state.startedCourse = kind;
    if (nearbyStarts.get(state) !== kind) {
      nearbyStarts.set(state, kind);
      state.chatter.push({ speaker: "loom", text: NEEDLE_COURSE_COPY.approach });
    }
  } else {
    nearbyStarts.delete(state);
  }
  const litKey = kind === "practice" ? "practiceLit" : "eyeLit";
  const lit = progress[litKey];
  const from = worldPoint(world, course.path[0]!, previous);
  const attempt = stepNeedleCourse(
    {
      from,
      to: worldPoint(world, from, context.flight.player),
      topSpeed: shipTuning(ECONOMY, context.content, context.flight.levels).physics.maxSpeed,
      velocity: context.flight.velocity,
    },
    course,
    lit,
  );
  progress[litKey] = attempt.lit;
  if (attempt.lit === course.gates.length) {
    delete state.startedCourse;
  } else if (attempt.missed || attempt.passed.length) {
    state.startedCourse = kind;
  }
  const feedback = needleLearningFeedback(progress, attempt);
  if (feedback) {
    state.chatter.push({ speaker: "loom", text: feedback });
  }
  if (kind === "eye" && attempt.lit === NEEDLE.eyeGates && attempt.passed.length) {
    state.chatter.push({ speaker: "ada", text: NEEDLE_LEARNING.eyeComplete });
  }
}
function panel(key: keyof typeof NEEDLE_COPY): DialogueState {
  const copy = NEEDLE_COPY[key]!;
  return {
    choices: [{ id: "continue", label: "Continue" }],
    context: `needle.${key}`,
    text: copy.lines.map((line) => line.text).join("\n\n"),
    title: key === "collect" ? "Holodisk" : "Elder Loom",
  };
}
function learningPanel(change = false): DialogueState {
  return {
    choices: (["show", "feedback", "independent"] as const).map((id) => ({
      id,
      label: NEEDLE_LEARNING[id].label,
    })),
    context: change ? "needle.learningChange" : "needle.learning",
    text: NEEDLE_LEARNING.prompt,
    title: "Elder Loom",
  };
}
export function useNeedle(context: ChapterContext, id: string): ChapterResult | undefined {
  const progress = progressOf(context);
  if (id === "elderLoom") {
    if (!progress.met) {
      return { dialogue: panel("arrival") };
    }
    if (!progress.briefed) {
      return { dialogue: panel("practice") };
    }
    const dialogue = panel(
      progress.practiceLit === NEEDLE.practiceGates ? "practiceComplete" : "practice",
    );
    dialogue.choices.push({ id: "changeApproach", label: NEEDLE_LEARNING.changeLabel });
    return { dialogue };
  }
  if (id === "holodisk") {
    return canCollect(context) ? { dialogue: panel("collect") } : { useRefused: true };
  }
  return undefined;
}
function canCollect(context: ChapterContext): boolean {
  if (context.progress.holodisk || progressOf(context).eyeLit !== NEEDLE.eyeGates) {
    return false;
  }
  const disk = context.flight.objects.find(
    (object) => object.id === "holodisk" && object.kind === "destination",
  );
  return Boolean(
    disk &&
    Math.hypot(context.flight.player.x - disk.x, context.flight.player.y - disk.y) <=
      context.content.tuning.talkRange,
  );
}
export function chooseNeedle(
  context: ChapterContext,
  dialogue: DialogueState,
  choice: string,
): ChapterResult | undefined {
  if (["activity:elderLoom", "activityActive:elderLoom"].includes(dialogue.context)) {
    if (
      choice === "changeApproach" &&
      needleActivityChoices(context, "elderLoom").length &&
      dialogue.choices.some((offered) => offered.id === choice && !offered.refused)
    ) {
      return { dialogue: learningPanel(true) };
    }
    return undefined;
  }
  if (!dialogue.context.startsWith("needle.")) {
    return undefined;
  }
  if (!dialogue.choices.some((offered) => offered.id === choice && !offered.refused)) {
    return {};
  }
  const progress = progressOf(context);
  if (
    choice === "changeApproach" &&
    progress.briefed &&
    ["needle.practice", "needle.practiceComplete"].includes(dialogue.context)
  ) {
    return { dialogue: learningPanel(true) };
  }
  if (
    ((dialogue.context === "needle.learning" &&
      !progress.briefed &&
      progress.approach === undefined) ||
      (dialogue.context === "needle.learningChange" && progress.briefed)) &&
    ["show", "feedback", "independent"].includes(choice) &&
    progress.met
  ) {
    progress.approach = choice as NeedleApproach;
    progress.briefed = true;
    const state = stateOf(context)!;
    state.chatter.push({ speaker: "loom", text: NEEDLE_LEARNING[progress.approach].response });
    return {};
  }
  if (choice !== "continue") {
    return {};
  }
  if (dialogue.context === "needle.collect") {
    return canCollect(context) ? { complete: true, holodisk: {} } : {};
  }
  if (dialogue.context === "needle.arrival" && !progress.met) {
    progress.met = true;
    context.progress.introduced = true;
    return { dialogue: panel("practice") };
  }
  if (dialogue.context === "needle.practice" && progress.met && !progress.briefed) {
    return { dialogue: learningPanel() };
  }
  if (
    dialogue.context === "needle.practiceComplete" &&
    progress.practiceLit === NEEDLE.practiceGates
  ) {
    progress.practiceThanked = true;
  }
  return {};
}
export function needleObjectiveIndex(context: ChapterContext): number {
  const progress = progressOf(context);
  if (context.progress.holodisk || context.progress.questComplete) {
    return 5;
  }
  if (!progress.met) {
    return context.progress.known.includes("elderLoom") ? 1 : 0;
  }
  if (progress.practiceLit < NEEDLE.practiceGates) {
    return 2;
  }
  return progress.eyeLit < NEEDLE.eyeGates ? 3 : 4;
}
export function needleObjective(context: ChapterContext): string | null {
  return (
    ["elderLoom", "elderLoom", "needlePractice", "needleEye", "holodisk", null][
      needleObjectiveIndex(context)
    ] ?? null
  );
}
/** Optional chapter help does not replace the central activity's Take, Drop or Continue actions. */
export function needleActivityChoices(
  context: ChapterContext,
  place: string,
): readonly DialogueChoice[] {
  return context.flight.galaxy === 4 &&
    place === "elderLoom" &&
    (context.progress as ChapterProgress).needle?.briefed
    ? [{ id: "changeApproach", label: NEEDLE_LEARNING.changeLabel }]
    : [];
}
export function needleAction(context: ChapterContext, id: string): UseAction | undefined {
  if (
    context.flight.galaxy !== 4 ||
    isNeedleCourseStart(id) ||
    !NEEDLE_PLACES.some((place) => place === id)
  ) {
    return undefined;
  }
  return id === "elderLoom" ? "talk" : "use";
}
export function readNeedleChapterProgress(value: unknown): NeedleChapterProgress | null {
  const base = readNeedleProgress(value);
  if (!base || !value || typeof value !== "object") {
    return null;
  }
  const record = value as NeedleChapterProgress;
  if (
    [record.met, record.briefed, record.practiceThanked].some(
      (flag) => typeof flag !== "boolean",
    ) ||
    (record.briefed && !record.met) ||
    record.briefed !== Boolean(record.approach) ||
    ((base.practiceLit || base.eyeLit) && !record.briefed) ||
    (record.practiceThanked && base.practiceLit !== NEEDLE.practiceGates)
  ) {
    return null;
  }
  return {
    ...base,
    briefed: record.briefed,
    met: record.met,
    practiceThanked: record.practiceThanked,
  };
}
export function validNeedleFlight(value: unknown): value is NeedleFlight {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as NeedleFlight & { readonly guidance?: unknown };
  const point = (point: unknown): point is Vec =>
    Boolean(point) &&
    typeof point === "object" &&
    Number.isFinite((point as Vec).x) &&
    Number.isFinite((point as Vec).y);
  return (
    point(state.anchor) &&
    (state.activityPatrol === undefined ||
      (state.activityPatrol !== null &&
        Number.isSafeInteger(state.activityPatrol.id) &&
        state.activityPatrol.id >= 0 &&
        Array.isArray(state.activityPatrol.tried) &&
        state.activityPatrol.tried.length <= NEEDLE.activityPatrolGates.length &&
        state.activityPatrol.tried.every((index) =>
          NEEDLE.activityPatrolGates.some((gate) => gate === index),
        ) &&
        new Set(state.activityPatrol.tried).size === state.activityPatrol.tried.length)) &&
    typeof state.exitPackPlaced === "boolean" &&
    (state.exitWarned === undefined || typeof state.exitWarned === "boolean") &&
    (state.guidance === undefined || point(state.guidance)) &&
    (state.startedCourse === undefined ||
      state.startedCourse === "practice" ||
      state.startedCourse === "eye") &&
    Array.isArray(state.chatter) &&
    state.chatter.length <= 16 &&
    state.chatter.every(
      (cue) =>
        ["loom", "ada", "astra"].includes(cue.speaker) &&
        typeof cue.text === "string" &&
        cue.text.length <= 240,
    )
  );
}
