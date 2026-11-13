import { ECONOMY } from "../data/economy.ts";
import { encounterTable } from "../data/enemyCatalog.ts";
import { NEEDLE } from "../data/needle.ts";
import { NEEDLE_COPY, NEEDLE_LEARNING } from "../data/needleCopy.ts";
import type { ChapterContext, ChapterResult } from "./chapterProtocol.ts";
import { dropRandom } from "./drops.ts";
import {
  ensureDestination,
  ensureDestinationAt,
  rollEncounter,
  spawnChapterEnemy,
} from "./flight.ts";
import {
  createNeedleCourse,
  type NeedleApproach,
  type NeedleCourse,
  needleLearningFeedback,
  type NeedleProgress,
  readNeedleProgress,
  stepNeedleCourse,
} from "./needle.ts";
import type { DialogueState, FlightState, GalaxyProgress, UseAction, Vec } from "./types.ts";
import { shipTuning } from "./upgrades.ts";
export interface NeedleChapterProgress extends NeedleProgress {
  met: boolean;
  briefed: boolean;
  practiceThanked: boolean;
}
export interface NeedleCue {
  speaker: "loom" | "ada" | "astra";
  text: string;
}
export interface NeedleFlight {
  anchor: Vec;
  chatter: NeedleCue[];
  exitPackPlaced: boolean;
  exitWarned?: boolean;
  guidance?: Vec;
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
const courses = new WeakMap<
  NeedleFlight,
  {
    practice: NeedleCourse;
    eye: NeedleCourse;
    activity: NeedleCourse;
  }
>();
/** Courses derive from one bounded saved anchor; geometry is not copied into every save. */
export function needleCourses(flight: FlightState): {
  practice: NeedleCourse;
  eye: NeedleCourse;
  activity: NeedleCourse;
} | null {
  const state = (flight as ChapterFlight).needle;
  if (!state) {
    return null;
  }
  let held = courses.get(state);
  if (!held) {
    held = {
      activity: createNeedleCourse({ anchor: state.anchor, seed: flight.seed }, "activity"),
      eye: createNeedleCourse({ anchor: state.anchor }, "eye"),
      practice: createNeedleCourse({ anchor: state.anchor }, "practice"),
    };
    courses.set(state, held);
  }
  return held;
}
/** Canonical placement and enemy helpers own world retention, pack accounting and physics. */
export function initNeedle(context: ChapterContext): void {
  if (context.flight.galaxy !== 4) {
    return;
  }
  const progress = progressOf(context);
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
    ensureDestinationAt(context.content, "holodisk", layout.eye.holodisk, context.flight);
  }
  if (!state.exitPackPlaced && !context.progress.holodisk) {
    const next = dropRandom(context.flight.seed, "needle:exit");
    const pack = rollEncounter(
      encounterTable(4).filter((entry) => entry.archetype === "swarm"),
      next(),
      next(),
    );
    for (let index = 0; index < pack.count; index++) {
      const angle = (index * Math.PI * 2) / pack.count;
      const point = {
        x: layout.eye.pack.x + Math.cos(angle) * 110,
        y: layout.eye.pack.y + Math.sin(angle) * 110,
      };
      spawnChapterEnemy(
        context.content,
        pack.archetype,
        `needle:exit:${index}`,
        point,
        context.flight,
        { home: layout.eye.pack, packId: "needle:exit" },
      );
    }
    state.exitPackPlaced = true;
  }
  if (progress.approach === "show" && !progress.practiceLit) {
    state.guidance = { ...layout.practice.gates[0]!.point };
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
  if (
    progress.eyeLit === NEEDLE.eyeGates &&
    !state.exitWarned &&
    Math.hypot(context.flight.player.x - exit.x, context.flight.player.y - exit.y) <=
      layout.eye.width
  ) {
    state.chatter.push({ speaker: "astra", text: NEEDLE_LEARNING.drones });
    state.exitWarned = true;
  }
  if (context.progress.holodisk) {
    return;
  }
  const practice = progress.practiceLit < NEEDLE.practiceGates;
  const course = practice ? layout.practice : layout.eye;
  const lit = practice ? progress.practiceLit : progress.eyeLit;
  if (lit === course.gates.length) {
    return;
  }
  const attempt = stepNeedleCourse(
    {
      from: previous,
      to: context.flight.player,
      topSpeed: shipTuning(ECONOMY, context.content, context.flight.levels).physics.maxSpeed,
      velocity: context.flight.velocity,
    },
    course,
    lit,
  );
  if (practice) {
    progress.practiceLit = attempt.lit;
  } else {
    progress.eyeLit = attempt.lit;
  }
  if (attempt.missed) {
    state.guidance = { ...course.gates[attempt.guidanceGate]!.point };
  } else if (attempt.passed.length) {
    delete state.guidance;
  }
  const feedback = needleLearningFeedback(progress, attempt);
  if (feedback) {
    state.chatter.push({ speaker: "loom", text: feedback });
  }
  if (!practice && attempt.lit === NEEDLE.eyeGates && attempt.passed.length) {
    state.chatter.push({ speaker: "ada", text: NEEDLE_LEARNING.eyeComplete });
  }
}
function panel(key: keyof typeof NEEDLE_COPY): DialogueState {
  const copy = NEEDLE_COPY[key]!;
  return {
    choices: [{ id: "continue", label: "Continue" }],
    context: `needle.${key}`,
    text: copy.lines.map((line) => line.text).join("\n\n"),
    title: "Elder Loom",
  };
}
function learningPanel(): DialogueState {
  return {
    choices: (["show", "feedback", "independent"] as const).map((id) => ({
      id,
      label: NEEDLE_LEARNING[id].label,
    })),
    context: "needle.learning",
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
    if (progress.practiceLit === NEEDLE.practiceGates && !progress.practiceThanked) {
      return { dialogue: panel("practiceComplete") };
    }
    return { dialogue: learningPanel() };
  }
  if (id === "holodisk") {
    if (context.progress.holodisk || progress.eyeLit !== NEEDLE.eyeGates) {
      return {};
    }
    const disk = context.flight.objects.find(
      (object) => object.id === "holodisk" && object.kind === "destination",
    );
    if (
      !disk ||
      Math.hypot(context.flight.player.x - disk.x, context.flight.player.y - disk.y) >
        context.content.tuning.talkRange
    ) {
      return {};
    }
    return { complete: true, holodisk: {} };
  }
  return undefined;
}
export function chooseNeedle(
  context: ChapterContext,
  dialogue: DialogueState,
  choice: string,
): ChapterResult | undefined {
  if (!dialogue.context.startsWith("needle.")) {
    return undefined;
  }
  if (!dialogue.choices.some((offered) => offered.id === choice && !offered.refused)) {
    return {};
  }
  const progress = progressOf(context);
  if (
    dialogue.context === "needle.learning" &&
    ["show", "feedback", "independent"].includes(choice) &&
    progress.met
  ) {
    progress.approach = choice as NeedleApproach;
    progress.briefed = true;
    const state = stateOf(context)!;
    delete state.guidance;
    if (choice === "show" && !progress.practiceLit) {
      state.guidance = { ...needleCourses(context.flight)!.practice.gates[0]!.point };
    }
    state.chatter.push({ speaker: "loom", text: NEEDLE_LEARNING[progress.approach].response });
    return {};
  }
  if (choice !== "continue") {
    return {};
  }
  if (dialogue.context === "needle.arrival") {
    progress.met = true;
    context.progress.introduced = true;
    return { dialogue: panel("practice") };
  }
  if (dialogue.context === "needle.practice" && progress.met) {
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
export function needleAction(_context: ChapterContext, id: string): UseAction {
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
    (record.briefed && (!record.met || !record.approach)) ||
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
  const state = value as NeedleFlight;
  const point = (point: unknown): point is Vec =>
    Boolean(point) &&
    typeof point === "object" &&
    Number.isFinite((point as Vec).x) &&
    Number.isFinite((point as Vec).y);
  return (
    point(state.anchor) &&
    typeof state.exitPackPlaced === "boolean" &&
    (state.exitWarned === undefined || typeof state.exitWarned === "boolean") &&
    (state.guidance === undefined || point(state.guidance)) &&
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
