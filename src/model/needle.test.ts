import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { NEEDLE } from "../data/needle.ts";
import { NEEDLE_COURSE_COPY, NEEDLE_LEARNING } from "../data/needleCopy.ts";
import { toScreen } from "./convex.ts";
import { createFlight, stepFlight } from "./flight.ts";
import {
  activeNeedleCourses,
  createNeedleCourse,
  inNeedleChannel,
  type NeedleCourse,
  needleDebris,
  type NeedleGate,
  needleGateOrientation,
  needleGateReadiness,
  needleLearningFeedback,
  needleRimContacts,
  needleSlow,
  setNeedleActivity,
  stepNeedleCourse,
} from "./needle/index.ts";
import {
  chooseNeedle,
  initNeedle,
  needleAction,
  needleActivityChoices,
  needleCourses,
  needleObjectiveIndex,
  needleTrackedObjective,
  stepNeedle,
  useNeedle,
} from "./needle/runtime.ts";
import {
  type NeedleChapterProgress,
  type NeedleFlight,
  readNeedleChapterProgress,
  readNeedleProgress,
  validNeedleFlight,
} from "./needle/state.ts";
import type { FlightState, GalaxyProgress, Vec } from "./types.ts";
const anchor = { x: 300, y: -800 };
const course = (kind: NeedleCourse["kind"] = "eye") => createNeedleCourse({ anchor }, kind);
const at = (gate: NeedleGate, along: number, across = 0): Vec => ({
  x: gate.point.x + gate.tangent.x * along - gate.tangent.y * across,
  y: gate.point.y + gate.tangent.y * along + gate.tangent.x * across,
});
const pass = (gate: NeedleGate, speed: number, across = 0) => ({
  from: at(gate, -20, across),
  to: at(gate, 20, across),
  topSpeed: 200,
  velocity: { x: speed, y: 0 },
});
describe("Needle course geometry", () => {
  it("keeps Practice at its original spacing and widens both ten-ring courses by 30%", () => {
    expect(course("practice").gates.map(({ point }) => point)).toEqual(
      NEEDLE.eye.gates.slice(0, 4).map(({ point: [x, y] }) => ({
        x: anchor.x + NEEDLE.practiceOffset.x + x!,
        y: anchor.y + NEEDLE.practiceOffset.y + y!,
      })),
    );
    const activity = createNeedleCourse({ anchor, seed: 42 }, "activity");
    const authored = NEEDLE.eye.gates;
    for (const layout of [course("eye"), activity]) {
      expect(layout.gates).toHaveLength(10);
      for (let index = 1; index < layout.gates.length; index++) {
        const original = Math.min(index, authored.length - 1);
        const [x, y] = authored[original]!.point;
        const [previousX, previousY] = authored[original - 1]!.point;
        const { point: a } = layout.gates[index - 1]!;
        const { point: b } = layout.gates[index]!;
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(
          Math.hypot(x! - previousX!, y! - previousY!) * 1.3,
          9,
        );
      }
    }
    expect(activity).toEqual(createNeedleCourse({ anchor, seed: 42 }, "activity"));
    expect(activity.path).not.toEqual(createNeedleCourse({ anchor, seed: 43 }, "activity").path);
    for (const gate of activity.gates) {
      expect(inNeedleChannel({}, activity, gate.point)).toBe(true);
      expect(inNeedleChannel({}, course("practice"), gate.point)).toBe(false);
      expect(inNeedleChannel({}, course(), gate.point)).toBe(false);
    }
  });
  it("describes bounded deterministic almond and channel debris using the authored drift and tumble ranges", () => {
    const eye = course();
    const debris = needleDebris(eye, 42);
    expect(debris).toEqual(needleDebris(eye, 42));
    expect(debris.length).toBeGreaterThan(100);
    expect(debris.length).toBeLessThan(600);
    expect(new Set(debris.map((piece) => piece.id)).size).toBe(debris.length);
    expect(debris.some((piece) => inNeedleChannel({}, eye, piece))).toBe(true);
    expect(debris.some((piece) => !inNeedleChannel({}, eye, piece))).toBe(true);
    for (const piece of debris) {
      expect(Math.hypot(piece.velocity.x, piece.velocity.y)).toBeGreaterThanOrEqual(6);
      expect(Math.hypot(piece.velocity.x, piece.velocity.y)).toBeLessThanOrEqual(12);
      expect(piece.tumbleDegreesPerSecond).toBeGreaterThanOrEqual(60);
      expect(piece.tumbleDegreesPerSecond).toBeLessThanOrEqual(120);
      expect(NEEDLE.channels.debris.pieces.some((art) => art.id === piece.piece)).toBe(true);
      expect(piece).not.toHaveProperty("damage");
    }
  });
  it("orders the Eye's eyelid pieces by row, with tumble frames by index and row", () => {
    const eye = course();
    const eyelids = (seed: number) =>
      needleDebris(eye, seed).filter((piece) => !piece.id.endsWith(":inside"));
    const pieces = eyelids(42);
    const length = eye.path
      .slice(1)
      .reduce(
        (sum, point, index) =>
          sum + Math.hypot(point.x - eye.path[index]!.x, point.y - eye.path[index]!.y),
        0,
      );
    expect(pieces).toHaveLength((Math.floor(length / NEEDLE.eye.debris.spacing) + 1) * 6);
    const plate = "needle-debris-plate";
    expect(NEEDLE.eye.debris.pieces).toEqual([plate, "needle-debris-girder", plate]);
    for (const piece of pieces) {
      const [index, , row] = piece.id.split(":").slice(-3).map(Number) as [number, number, number];
      expect(piece.piece, piece.id).toBe(NEEDLE.eye.debris.pieces[row]);
      expect(piece.tumblePhase, piece.id).toBe(((index + 3 * row) % 8) * 45);
    }
    // No spread: the eyelid positions do not depend on the seed.
    expect(eyelids(7).map(({ x, y }) => ({ x, y }))).toEqual(pieces.map(({ x, y }) => ({ x, y })));
  });
  it("keeps the authored Eye entry and carries the disk and exit patrol beyond the ten rings", () => {
    const eye = course();
    const start = { x: anchor.x + NEEDLE.eyeOffset.x, y: anchor.y + NEEDLE.eyeOffset.y };
    expect(eye.path[0]).toEqual(start);
    expect(eye.gates).toHaveLength(10);
    const last = eye.gates.at(-1)!;
    const beyond = (point: Vec) =>
      (point.x - last.point.x) * last.tangent.x + (point.y - last.point.y) * last.tangent.y;
    expect(beyond(eye.path.at(-1)!)).toBeGreaterThan(0);
    expect(beyond(eye.holodisk)).toBeGreaterThan(beyond(eye.path.at(-1)!));
    expect(beyond(eye.pack)).toBeGreaterThan(beyond(eye.holodisk));
    expect(eye.width).toBe(150);
    expect(inNeedleChannel({}, eye, eye.pack)).toBe(false);
    expect(inNeedleChannel({}, eye, eye.holodisk)).toBe(true);
  });
  it("uses four practice gates in the wider separate channel", () => {
    const practice = course("practice");
    expect(practice.width).toBe(210);
    expect(practice.gates).toHaveLength(4);
    for (const gate of practice.gates) {
      expect(inNeedleChannel({}, practice, gate.point)).toBe(true);
      expect(inNeedleChannel({}, course(), gate.point)).toBe(false);
    }
  });
  it.each(["practice", "eye", "activity"] as const)(
    "keeps every %s gate at least 30 degrees off projected horizontal",
    (kind) => {
      for (const gate of course(kind).gates) {
        const screen = toScreen(gate.tangent);
        const angle = (Math.atan2(Math.abs(screen.y), Math.abs(screen.x)) * 180) / Math.PI;
        expect(angle).toBeGreaterThanOrEqual(NEEDLE.gate.minScreenAngle);
        expect(NEEDLE.gate.orientations.some((o) => o.index === needleGateOrientation(gate))).toBe(
          true,
        );
      }
    },
  );
  it("excludes enemy bodies intersecting the corridor even when their centres are outside", () => {
    const eye = course();
    const p = eye.path[0]!;
    expect(inNeedleChannel({}, eye, p)).toBe(true);
    expect(inNeedleChannel({}, eye, { x: p.x - 100, y: p.y })).toBe(false);
    expect(inNeedleChannel({ radius: 30 }, eye, { x: p.x - 100, y: p.y })).toBe(true);
    expect(inNeedleChannel({ radius: 10 }, eye, eye.pack)).toBe(false);
  });
});
describe("Needle actual centre crossings", () => {
  it.each([0, 99.999])("lights below 50 percent at speed %s", (speed) => {
    const eye = course();
    expect(stepNeedleCourse(pass(eye.gates[0]!, speed), eye, 0)).toEqual({
      lit: 1,
      missed: false,
      passed: [0],
    });
  });
  it.each([100, 150, 200])(
    "rejects speed %s including the exact threshold without resetting lit gates",
    (speed) => {
      const eye = course();
      const context = pass(eye.gates[3]!, speed);
      const before = structuredClone(context);
      expect(stepNeedleCourse(context, eye, 3)).toEqual({
        lit: 3,
        missed: true,
        passed: [],
      });
      expect(context).toEqual(before);
      expect(stepNeedleCourse(pass(eye.gates[0]!, speed), eye, 0)).toEqual({
        lit: 0,
        missed: true,
        passed: [],
      });
    },
  );
  it("uses the swept crossing inside the opening rather than distance to its endpoint", () => {
    const eye = course();
    const gate = eye.gates[0]!;
    const context = { ...pass(gate, 30), from: at(gate, -120), to: at(gate, 150) };
    expect(stepNeedleCourse(context, eye, 0).lit).toBe(1);
    expect(
      stepNeedleCourse({ ...context, from: at(gate, -20), to: at(gate, -1) }, eye, 0).lit,
    ).toBe(0);
    expect(stepNeedleCourse(pass(gate, 30, 33), eye, 0).lit).toBe(0);
    expect(stepNeedleCourse(pass(gate, 30, 32.99), eye, 0).lit).toBe(1);
  });
  it("admits a slow retry from either side but does not count the same plane endpoint twice", () => {
    const eye = course();
    const context = pass(eye.gates[0]!, 30);
    expect(stepNeedleCourse({ ...context, from: context.to, to: context.from }, eye, 0).lit).toBe(
      1,
    );
    expect(stepNeedleCourse({ ...context, from: eye.gates[0]!.point }, eye, 0).lit).toBe(0);
  });
  it("requires the next gate and completes the full authored route one crossing at a time", () => {
    const eye = course();
    expect(stepNeedleCourse(pass(eye.gates[2]!, 20), eye, 0).lit).toBe(0);
    let lit = 0;
    for (const gate of eye.gates) {
      lit = stepNeedleCourse(pass(gate, 20), eye, lit).lit;
    }
    expect(lit).toBe(10);
    expect(stepNeedleCourse(pass(eye.gates[9]!, 20), eye, lit).passed).toEqual([]);
  });
  it("uses actual resultant velocity including diagonal movement and the current engine top speed", () => {
    expect(needleSlow({ topSpeed: 200, velocity: { x: 80, y: 80 } })).toBe(false);
    expect(needleSlow({ topSpeed: 300, velocity: { x: 80, y: 80 } })).toBe(true);
    expect(needleSlow({ topSpeed: 0, velocity: { x: 0, y: 0 } })).toBe(false);
  });
});
describe("Needle non-damaging rim contacts", () => {
  it("leaves the opening clear and reports only the two authored rim blocks", () => {
    const eye = course();
    const gate = eye.gates[0]!;
    expect(needleRimContacts({ position: gate.point, radius: 10 }, eye)).toEqual([]);
    for (const side of [-1, 1]) {
      const contacts = needleRimContacts({ position: at(gate, 0, side * 36.5), radius: 2 }, eye);
      expect(contacts).toHaveLength(1);
      expect(contacts[0]!.damage).toBe(0);
      expect(contacts[0]!.depth).toBeGreaterThan(0);
      expect(Math.hypot(contacts[0]!.normal.x, contacts[0]!.normal.y)).toBeCloseTo(1);
    }
    expect(needleRimContacts({ position: at(gate, 0, 60), radius: 10 }, eye)).toEqual([]);
  });
});
describe("Needle saved practice choice and real guidance", () => {
  it("accepts only bounded progress with a chosen approach before any lit practice gate", () => {
    expect(readNeedleProgress({ eyeLit: 0, practiceLit: 0 })).toEqual({
      eyeLit: 0,
      practiceLit: 0,
    });
    expect(readNeedleProgress({ approach: "show", eyeLit: 10, practiceLit: 4 })).toEqual({
      approach: "show",
      eyeLit: 10,
      practiceLit: 4,
    });
    for (const value of [
      null,
      {},
      { eyeLit: 0, practiceLit: 5 },
      { eyeLit: 0, practiceLit: 1.5 },
      { eyeLit: 1, practiceLit: 0 },
      { eyeLit: 0, practiceLit: 1 },
      { approach: "skip", eyeLit: 0, practiceLit: 0 },
    ]) {
      expect(readNeedleProgress(value)).toBeNull();
    }
  });
  it("gives attempt feedback and keeps independent mode quiet except failure clarity", () => {
    const practice = course("practice");
    const success = stepNeedleCourse(pass(practice.gates[0]!, 30), practice, 0);
    for (const approach of ["show", "feedback", "independent"] as const) {
      const progress = { approach, eyeLit: 0, practiceLit: 0 };
      expect(needleLearningFeedback(progress, success)).toBe(
        approach === "feedback" ? NEEDLE_LEARNING.success : null,
      );
      expect(needleLearningFeedback(progress, { ...success, passed: [] })).toBeNull();
      expect(needleLearningFeedback(progress, { ...success, missed: true })).toBe(
        NEEDLE_LEARNING.tooFast,
      );
    }
  });
});
function chapter() {
  const progress: GalaxyProgress = {
    charted: [],
    deposited: 0,
    destroyedEnemies: 0,
    discoveries: 0,
    donated: {},
    explored: [],
    greetings: {},
    holodisk: false,
    introduced: false,
    known: [],
    opened: false,
    questComplete: false,
    questItem: null,
    resolved: false,
    revealed: [],
    stage: 0,
    stations: [],
  };
  const flight = createFlight(CONTENT, 4, 724, progress);
  const context = { content: CONTENT, flight, progress };
  initNeedle(context);
  return context;
}
type NeedleContext = ReturnType<typeof chapter>;
const chapterProgress = (context: NeedleContext) =>
  (
    context.progress as GalaxyProgress & {
      needle: NeedleChapterProgress;
    }
  ).needle;
const chapterFlight = (context: NeedleContext) =>
  (
    context.flight as FlightState & {
      needle: NeedleFlight;
    }
  ).needle;
function learn(context: NeedleContext, approach: "show" | "feedback" | "independent") {
  const arrival = useNeedle(context, "elderLoom")!.dialogue!;
  const brief = chooseNeedle(context, arrival, "continue")!.dialogue!;
  const choice = chooseNeedle(context, brief, "continue")!.dialogue!;
  expect(choice.choices.map((item) => item.id)).toEqual(["show", "feedback", "independent"]);
  expect(chooseNeedle(context, choice, "continue")).toEqual({});
  expect(chapterProgress(context).briefed).toBe(false);
  chooseNeedle(context, choice, approach);
}
function cross(context: NeedleContext, gate: NeedleGate, speed: number) {
  const from = at(gate, -20);
  context.flight.player = at(gate, 20);
  context.flight.velocity = { x: gate.tangent.x * speed, y: gate.tangent.y * speed };
  stepNeedle(context, 0.1, from);
}
describe("Needle chapter runtime", () => {
  it.each([100, 200])(
    "updates the next-gate signal at each exact speed boundary for top speed %s",
    (topSpeed) => {
      const signal = (share: number) =>
        needleGateReadiness({ topSpeed, velocity: { x: 0, y: -topSpeed * share } });
      expect([
        signal(0.75),
        signal(0.749),
        signal(0.5),
        signal(0.499),
        signal(0),
        signal(0.8),
      ]).toEqual(["red", "yellow", "yellow", "green", "green", "red"]);
    },
  );

  it("tracks only the current flag, starts on approach and repeats the tip only on reentry", () => {
    const context = chapter();
    expect(needleTrackedObjective(context)).toBeNull();
    learn(context, "independent");
    const { flight } = context;
    const { eye, practice } = needleCourses(flight)!;
    expect(needleTrackedObjective(context)).toEqual({
      id: "needlePractice",
      point: practice.path[0],
      step: "flag",
    });
    const cue = () => chapterFlight(context).chatter.at(-1)?.text;
    const visitStart = (course: NeedleCourse) => {
      flight.player = { ...course.path[0]! };
      stepNeedle(context, 0.001, flight.player);
    };
    const approachCount = () =>
      chapterFlight(context).chatter.filter(({ text }) => text === NEEDLE_COURSE_COPY.approach)
        .length;
    visitStart(eye);
    expect(approachCount()).toBe(0);
    expect(useNeedle(context, "needleEye")).toBeUndefined();
    visitStart(practice);
    expect(cue()).toBe(NEEDLE_COURSE_COPY.approach);
    visitStart(practice);
    expect(approachCount()).toBe(1);
    expect(useNeedle(context, "needlePractice")).toBeUndefined();
    expect(needleTrackedObjective(context)).toEqual({
      id: "needlePractice",
      point: practice.gates[0]!.point,
      ringIndex: 0,
      step: "ring",
    });
    cross(context, practice.gates[0]!, 200);
    expect(chapterProgress(context).practiceLit).toBe(0);
    expect(needleTrackedObjective(context)?.point).toEqual(practice.gates[0]!.point);
    visitStart(practice);
    expect(approachCount()).toBe(2);
    expect(cue()).toBe(NEEDLE_COURSE_COPY.approach);
    for (const gate of practice.gates) {
      cross(context, gate, 20);
    }
    expect(needleTrackedObjective(context)).toEqual({
      id: "needleEye",
      point: eye.path[0],
      step: "flag",
    });
    visitStart(eye);
    expect(needleTrackedObjective(context)).toEqual({
      id: "needleEye",
      point: eye.gates[0]!.point,
      ringIndex: 0,
      step: "ring",
    });
    for (const gate of eye.gates) {
      cross(context, gate, 20);
    }
    expect(needleTrackedObjective(context)).toBeNull();
  });

  it.each(["show", "feedback", "independent"] as const)(
    "requires and preserves the %s learning choice across Continue",
    (approach) => {
      const context = chapter();
      const before = { ...context.flight.player };
      learn(context, approach);
      expect(context.flight.player).toEqual(before);
      expect(chapterProgress(context)).toMatchObject({
        approach,
        briefed: true,
        eyeLit: 0,
        met: true,
        practiceLit: 0,
      });
      const resumed = {
        ...context,
        flight: JSON.parse(JSON.stringify(context.flight)) as FlightState,
        progress: JSON.parse(JSON.stringify(context.progress)) as GalaxyProgress,
      };
      expect(readNeedleChapterProgress(chapterProgress(resumed))).toEqual(chapterProgress(context));
      expect(validNeedleFlight(chapterFlight(resumed))).toBe(true);
      const objects = structuredClone(resumed.flight.objects);
      initNeedle(resumed);
      expect(resumed.flight.objects).toEqual(objects);
      expect(chapterProgress(resumed).approach).toBe(approach);
      expect(needleTrackedObjective(resumed)?.step).toBe("flag");
    },
  );
  it("allows changing the learning approach through Loom without resetting any lit gate", () => {
    const context = chapter();
    learn(context, "show");
    cross(context, needleCourses(context.flight)!.practice.gates[0]!, 20);
    expect(chapterProgress(context).practiceLit).toBe(1);
    const talk = useNeedle(context, "elderLoom")!.dialogue!;
    expect(talk.choices.map((choice) => choice.id)).toEqual(["continue", "changeApproach"]);
    const beforeChoice = structuredClone(chapterProgress(context));
    const choice = chooseNeedle(context, talk, "changeApproach")!.dialogue!;
    expect(chapterProgress(context)).toEqual(beforeChoice);
    expect(choice.context).toBe("needle.learningChange");
    chooseNeedle(context, choice, "independent");
    expect(chapterProgress(context)).toMatchObject({ approach: "independent", practiceLit: 1 });
    expect(needleTrackedObjective(context)).toMatchObject({ ringIndex: 1, step: "ring" });
  });
  it("uses real flight movement for gate admission with the current engine top speed", () => {
    const context = chapter();
    learn(context, "independent");
    const gate = needleCourses(context.flight)!.practice.gates[0]!;
    context.flight.player = at(gate, -1);
    context.flight.velocity = { x: gate.tangent.x * 30, y: gate.tangent.y * 30 };
    const before = { ...context.flight.player };
    stepFlight(
      CONTENT,
      0.1,
      { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false },
      context.flight,
    );
    expect(context.flight.player).not.toEqual(before);
    stepNeedle(context, 0.1, before);
    expect(chapterProgress(context).practiceLit).toBe(1);
  });
  it("requires practice and Eye passes before the once-only holodisk outcome", () => {
    const context = chapter();
    expect(needleObjectiveIndex(context)).toBe(0);
    context.progress.known.push("elderLoom");
    expect(needleObjectiveIndex(context)).toBe(1);
    learn(context, "independent");
    const layout = needleCourses(context.flight)!;
    cross(context, layout.eye.gates[0]!, 20);
    expect(chapterProgress(context).eyeLit).toBe(0);
    for (const gate of layout.practice.gates) {
      cross(context, gate, 20);
    }
    expect(needleObjectiveIndex(context)).toBe(3);
    for (const gate of layout.eye.gates) {
      cross(context, gate, 20);
    }
    expect(needleObjectiveIndex(context)).toBe(4);
    expect(chapterProgress(context)).toMatchObject({ eyeLit: 10, practiceLit: 4 });
    expect(useNeedle(context, "holodisk")).toEqual({ useRefused: true });
    context.flight.player = { ...layout.eye.holodisk };
    stepNeedle(context, 0.1, context.flight.player);
    expect(
      chapterFlight(context).chatter.filter((cue) => cue.text === NEEDLE_LEARNING.drones),
    ).toHaveLength(1);
    const beforeCollect = structuredClone(context.progress);
    const collect = useNeedle(context, "holodisk")!.dialogue!;
    expect(collect).toMatchObject({
      context: "needle.collect",
      text: "Collect the holodisk.",
      title: "Holodisk",
    });
    expect(context.progress).toEqual(beforeCollect);
    expect(chooseNeedle(context, collect, "skip")).toEqual({});
    expect(chooseNeedle(context, collect, "continue")).toEqual({ complete: true, holodisk: {} });
    context.progress.holodisk = true;
    context.progress.questComplete = true;
    expect(needleObjectiveIndex(context)).toBe(5);
    expect(chooseNeedle(context, collect, "continue")).toEqual({});
    expect(useNeedle(context, "holodisk")).toEqual({ useRefused: true });
    const before = structuredClone(chapterProgress(context));
    const panel = useNeedle(context, "elderLoom")!.dialogue!;
    chooseNeedle(context, panel, "continue");
    expect(chapterProgress(context)).toEqual({ ...before, practiceThanked: true });
    expect(context.progress.holodisk).toBe(true);
  });
  it("keeps lit gates and position after a fast miss, guiding back to the missed ring", () => {
    const context = chapter();
    learn(context, "feedback");
    const gates = needleCourses(context.flight)!.practice.gates;
    cross(context, gates[0]!, 20);
    context.flight.player = at(gates[1]!, 20);
    context.flight.velocity = { x: 200, y: 0 };
    const before = { ...context.flight.player };
    stepNeedle(context, 0.1, at(gates[1]!, -20));
    expect(chapterProgress(context).practiceLit).toBe(1);
    expect(context.flight.player).toEqual(before);
    expect(needleTrackedObjective(context)).toEqual({
      id: "needlePractice",
      point: gates[1]!.point,
      ringIndex: 1,
      step: "ring",
    });
    expect(chapterFlight(context).chatter.at(-1)?.text).toBe(NEEDLE_LEARNING.tooFast);
    cross(context, gates[1]!, 20);
    expect(chapterProgress(context).practiceLit).toBe(2);
  });
  it("retains the exit pack's identity, casualties and damage without placing it inside either channel", () => {
    const context = chapter();
    const pack = context.flight.objects.filter((object) => object.id.startsWith("needle:exit:"));
    expect(pack.length).toBeGreaterThan(0);
    const layout = needleCourses(context.flight)!;
    for (const member of pack) {
      expect(inNeedleChannel({ radius: member.radius }, layout.eye, member)).toBe(false);
    }
    pack[0]!.hp = pack[0]!.enemy!.hp = 1;
    const before = structuredClone(pack);
    const denominator = { ...context.flight.combat!.initialPackSizes };
    initNeedle(context);
    expect(context.flight.objects.filter((object) => object.id.startsWith("needle:exit:"))).toEqual(
      before,
    );
    expect(context.flight.combat!.initialPackSizes).toEqual(denominator);
  });
  it("rejects impossible chapter state without accepting incomplete practice as Eye progress", () => {
    const context = chapter();
    expect(readNeedleChapterProgress(chapterProgress(context))).toEqual(chapterProgress(context));
    expect(readNeedleChapterProgress({ ...chapterProgress(context), eyeLit: 1 })).toBeNull();
    expect(
      readNeedleChapterProgress({ ...chapterProgress(context), practiceThanked: true }),
    ).toBeNull();
    expect(validNeedleFlight({ ...chapterFlight(context), anchor: { x: Infinity, y: 0 } })).toBe(
      false,
    );
  });
});

describe("Needle repeat Talk and collection cards", () => {
  it("preserves an answered approach on ordinary Talk and stale initial choices", () => {
    const context = chapter();
    const arrival = useNeedle(context, "elderLoom")!.dialogue!;
    const brief = chooseNeedle(context, arrival, "continue")!.dialogue!;
    const initial = chooseNeedle(context, brief, "continue")!.dialogue!;
    chooseNeedle(context, initial, "show");
    const before = structuredClone({ flight: context.flight, progress: context.progress });
    for (const stale of [initial, JSON.parse(JSON.stringify(initial)) as typeof initial]) {
      expect(chooseNeedle(context, stale, "feedback")).toEqual({});
      expect({ flight: context.flight, progress: context.progress }).toEqual(before);
    }
    const repeat = useNeedle(context, "elderLoom")!.dialogue!;
    expect(repeat.context).toBe("needle.practice");
    expect(chooseNeedle(context, repeat, "continue")).toEqual({});
    expect({ flight: context.flight, progress: context.progress }).toEqual(before);
    const change = chooseNeedle(context, repeat, "changeApproach")!.dialogue!;
    expect({ flight: context.flight, progress: context.progress }).toEqual(before);
    const resumed = {
      ...context,
      flight: JSON.parse(JSON.stringify(context.flight)) as FlightState,
      progress: JSON.parse(JSON.stringify(context.progress)) as GalaxyProgress,
    };
    initNeedle(resumed);
    expect(chapterProgress(resumed).approach).toBe("show");
    expect(chooseNeedle(resumed, change, "independent")).toEqual({});
    expect(chapterProgress(resumed).approach).toBe("independent");
  });
  it("rechecks a restored Collect card's range and commits its normal outcome only once", () => {
    const context = chapter();
    learn(context, "independent");
    const layout = needleCourses(context.flight)!;
    for (const gate of [...layout.practice.gates, ...layout.eye.gates]) {
      cross(context, gate, 20);
    }
    context.flight.player = { ...layout.eye.holodisk };
    const collect = useNeedle(context, "holodisk")!.dialogue!;
    const before = structuredClone(context.progress);
    expect(before.holodisk).toBe(false);
    expect(before.questComplete).toBe(false);
    const resumed = {
      ...context,
      flight: JSON.parse(JSON.stringify(context.flight)) as FlightState,
      progress: JSON.parse(JSON.stringify(context.progress)) as GalaxyProgress,
    };
    initNeedle(resumed);
    resumed.flight.player.x += CONTENT.tuning.talkRange + 1;
    expect(chooseNeedle(resumed, collect, "continue")).toEqual({});
    expect(resumed.progress).toEqual(before);
    resumed.flight.player = { ...layout.eye.holodisk };
    expect(chooseNeedle(resumed, collect, "continue")).toEqual({ complete: true, holodisk: {} });
    resumed.progress.holodisk = true;
    resumed.progress.questComplete = true;
    const completed = structuredClone({ flight: resumed.flight, progress: resumed.progress });
    expect(chooseNeedle(resumed, collect, "continue")).toEqual({});
    expect({ flight: resumed.flight, progress: resumed.progress }).toEqual(completed);
  });
  it("shares only held activity geometry with physics and rendering without persisting the toggle", () => {
    const context = chapter();
    expect(activeNeedleCourses(context.flight).map((course) => course.kind)).toEqual([
      "practice",
      "eye",
    ]);
    setNeedleActivity(context.flight, true);
    expect(activeNeedleCourses(context.flight).map((course) => course.kind)).toEqual([
      "practice",
      "eye",
      "activity",
    ]);
    const restored = JSON.parse(JSON.stringify(context.flight)) as FlightState;
    expect(activeNeedleCourses(restored).map((course) => course.kind)).toEqual(["practice", "eye"]);
    setNeedleActivity(restored, true);
    expect(activeNeedleCourses(restored).map((course) => course.kind)).toEqual([
      "practice",
      "eye",
      "activity",
    ]);
    setNeedleActivity(context.flight, false);
    expect(activeNeedleCourses(context.flight).map((course) => course.kind)).toEqual([
      "practice",
      "eye",
    ]);
  });
});

describe("Needle optional help on central activity cards", () => {
  it.each(["activity:elderLoom", "activityActive:elderLoom"])(
    "handles only an offered help action on %s",
    (dialogueContext) => {
      const context = chapter();
      expect(needleActivityChoices(context, "elderLoom")).toEqual([]);
      learn(context, "show");
      context.progress.resolved = true;
      const before = structuredClone({ flight: context.flight, progress: context.progress });
      const extra = needleActivityChoices(context, "elderLoom");
      expect(extra).toEqual([{ id: "changeApproach", label: NEEDLE_LEARNING.changeLabel }]);
      const primary = dialogueContext.startsWith("activityActive") ? "drop" : "take";
      const card = {
        choices: [{ id: primary, label: primary }, { id: "continue", label: "Continue" }, ...extra],
        context: dialogueContext,
        text: "Thread the needle",
        title: "Elder Loom",
      };
      expect(chooseNeedle(context, card, primary)).toBeUndefined();
      expect(chooseNeedle(context, card, "continue")).toBeUndefined();
      expect({ flight: context.flight, progress: context.progress }).toEqual(before);
      const absent = {
        ...card,
        choices: card.choices.filter((choice) => choice.id !== "changeApproach"),
      };
      expect(chooseNeedle(context, absent, "changeApproach")).toBeUndefined();
      const refused = {
        ...card,
        choices: card.choices.map((choice) => ({ ...choice, refused: true })),
      };
      expect(chooseNeedle(context, refused, "changeApproach")).toBeUndefined();
      const changed = chooseNeedle(context, card, "changeApproach")!.dialogue!;
      expect(changed.context).toBe("needle.learningChange");
      expect({ flight: context.flight, progress: context.progress }).toEqual(before);
      chooseNeedle(context, changed, "feedback");
      expect(chapterProgress(context).approach).toBe("feedback");
      expect(chapterProgress(context).practiceLit).toBe(0);
    },
  );
  it("does not offer Needle help or replace Use actions at unrelated places", () => {
    const context = chapter();
    learn(context, "independent");
    expect(needleActivityChoices(context, "family")).toEqual([]);
    expect(needleAction(context, "station:4:0")).toBeUndefined();
    expect(needleAction(context, "elderLoom")).toBe("talk");
    expect(needleAction(context, "holodisk")).toBe("use");
    expect(
      needleAction({ ...context, flight: { ...context.flight, galaxy: 3 } }, "holodisk"),
    ).toBeUndefined();
    const card = {
      choices: [{ id: "changeApproach", label: NEEDLE_LEARNING.changeLabel }],
      context: "activity:family",
      text: "",
      title: "Whale family",
    };
    expect(chooseNeedle(context, card, "changeApproach")).toBeUndefined();
    expect(chapterProgress(context).approach).toBe("independent");
  });
});
