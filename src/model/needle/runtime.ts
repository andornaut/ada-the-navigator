import { NEEDLE_CADENCE } from "../../data/capitalBosses.ts";
import type { ConversationLine } from "../../data/conversations.ts";
import { ECONOMY } from "../../data/economy.ts";
import { isNeedleCourseStart, NEEDLE, NEEDLE_PLACES } from "../../data/needle.ts";
import { NEEDLE_COPY, NEEDLE_COURSE_COPY, NEEDLE_LEARNING } from "../../data/needleCopy.ts";
import type { CapitalBossProgress } from "../capitalBossEncounter.ts";
import type { ChapterContext, ChapterResult } from "../chapterProtocol.ts";
import { ensureDestination, ensureDestinationAt, spawnChapterEnemy } from "../flight.ts";
import { worldActivateFlightRegion } from "../geography.ts";
import type { DialogueChoice, DialogueState, UseAction, Vec } from "../types.ts";
import { shipTuning } from "../upgrades.ts";
import { flightWorldContext, worldDistance, worldPoint, wrapPoint } from "../world/index.ts";
import {
  type NeedleCourse,
  needleCourses,
  needleLearningFeedback,
  stepNeedleCourse,
} from "./geometry.ts";
import { type NeedleCadencePlacement, planNeedleCadence, planNeedleExit } from "./routePlan.ts";
import {
  type NeedleApproach,
  type NeedleChapterProgress,
  type NeedleFlight,
  type StoryCourse,
  unfinishedNeedleCourse,
} from "./state.ts";
const progressOf = (context: ChapterContext): NeedleChapterProgress =>
  (context.progress.needle ??= {
    briefed: false,
    eyeLit: 0,
    met: false,
    practiceLit: 0,
    practiceThanked: false,
  });
const stateOf = (context: ChapterContext) => context.flight.needle;
const nearbyStarts = new WeakMap<NeedleFlight, StoryCourse>();

export type NeedleTrackedObjective = {
  readonly id: "needlePractice" | "needleEye";
  readonly point: Readonly<Vec>;
} & ({ readonly step: "flag" } | { readonly step: "ring"; readonly ringIndex: number });

/** Supplies one revealed course step to the existing tracked story objective. */
export function needleTrackedObjective(context: ChapterContext): NeedleTrackedObjective | null {
  const progress = context.progress.needle;
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
export { needleCourses } from "./geometry.ts";
export { NEEDLE_CADENCE };

export const NEEDLE_CADENCE_CUES = {
  approach: {
    speaker: "captainCadence",
    text: "Hold at the channel mouth. Fire when they come through.",
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
    context.progress.needle?.eyeLit !== NEEDLE.eyeGates ||
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
    context.flight.needle = state;
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
  return context.flight.galaxy === 4 && place === "elderLoom" && context.progress.needle?.briefed
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
