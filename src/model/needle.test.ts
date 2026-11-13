import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { NEEDLE } from "../data/needle.ts";
import { NEEDLE_LEARNING } from "../data/needleCopy.ts";
import { toScreen } from "./convex.ts";
import { createFlight, stepFlight } from "./flight.ts";
import {
  createNeedleCourse,
  inNeedleChannel,
  type NeedleCourse,
  needleDebris,
  type NeedleGate,
  needleGateOrientation,
  needleLearningCue,
  needleLearningFeedback,
  needleRimContacts,
  needleSlow,
  readNeedleProgress,
  stepNeedleCourse,
} from "./needle.ts";
import {
  chooseNeedle,
  initNeedle,
  type NeedleChapterProgress,
  needleCourses,
  type NeedleFlight,
  needleObjectiveIndex,
  readNeedleChapterProgress,
  stepNeedle,
  useNeedle,
  validNeedleFlight,
} from "./needleRuntime.ts";
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
  it("keeps the held activity's seeded eight-gate course separate from both chapter courses", () => {
    const activity = createNeedleCourse({ anchor, seed: 42 }, "activity");
    expect(activity.gates).toHaveLength(8);
    expect(activity).toEqual(createNeedleCourse({ anchor, seed: 42 }, "activity"));
    expect(activity.path).not.toEqual(createNeedleCourse({ anchor, seed: 43 }, "activity").path);
    for (const gate of activity.gates) {
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
  it("translates the authored Eye without replacing its path, gates, disk or pack", () => {
    const eye = course();
    const offset = { x: anchor.x + NEEDLE.eyeOffset.x, y: anchor.y + NEEDLE.eyeOffset.y };
    expect(eye.path).toEqual(
      NEEDLE.eye.path.map(([x, y]) => ({ x: x! + offset.x, y: y! + offset.y })),
    );
    expect(eye.gates).toHaveLength(8);
    expect(eye.holodisk).toEqual({
      x: NEEDLE.eye.holodisk[0]! + offset.x,
      y: NEEDLE.eye.holodisk[1]! + offset.y,
    });
    expect(eye.pack).toEqual({
      x: NEEDLE.eye.pack[0]! + offset.x,
      y: NEEDLE.eye.pack[1]! + offset.y,
    });
    expect(eye.width).toBe(150);
    expect(inNeedleChannel({}, eye, eye.pack)).toBe(false);
    expect(inNeedleChannel({}, eye, eye.holodisk)).toBe(true);
  });
  it("uses three practice gates in the wider separate channel and an independent eight-gate activity", () => {
    const practice = course("practice");
    expect(practice.width).toBe(210);
    expect(practice.gates).toHaveLength(3);
    expect(course("activity").gates).toHaveLength(8);
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
  it.each([0, 79.999])("lights below 40 percent at speed %s", (speed) => {
    const eye = course();
    expect(stepNeedleCourse(pass(eye.gates[0]!, speed), eye, 0)).toEqual({
      guidanceGate: 0,
      lit: 1,
      missed: false,
      passed: [0],
    });
  });
  it.each([80, 200])(
    "rejects speed %s including the exact threshold without resetting lit gates",
    (speed) => {
      const eye = course();
      const context = pass(eye.gates[3]!, speed);
      const before = structuredClone(context);
      expect(stepNeedleCourse(context, eye, 3)).toEqual({
        guidanceGate: 2,
        lit: 3,
        missed: true,
        passed: [],
      });
      expect(context).toEqual(before);
      expect(stepNeedleCourse(pass(eye.gates[0]!, speed), eye, 0).guidanceGate).toBe(0);
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
    expect(lit).toBe(8);
    expect(stepNeedleCourse(pass(eye.gates[7]!, 20), eye, lit).passed).toEqual([]);
  });
  it("uses actual resultant velocity including diagonal movement and the current engine top speed", () => {
    expect(needleSlow({ topSpeed: 200, velocity: { x: 60, y: 60 } })).toBe(false);
    expect(needleSlow({ topSpeed: 300, velocity: { x: 60, y: 60 } })).toBe(true);
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
    expect(readNeedleProgress({ approach: "show", eyeLit: 8, practiceLit: 3 })).toEqual({
      approach: "show",
      eyeLit: 8,
      practiceLit: 3,
    });
    for (const value of [
      null,
      {},
      { eyeLit: 0, practiceLit: 4 },
      { eyeLit: 0, practiceLit: 1.5 },
      { eyeLit: 1, practiceLit: 0 },
      { eyeLit: 0, practiceLit: 1 },
      { approach: "skip", eyeLit: 0, practiceLit: 0 },
    ]) {
      expect(readNeedleProgress(value)).toBeNull();
    }
  });
  it("shows only the first practice approach when chosen, with no automatic gate completion", () => {
    const practice = course("practice");
    const progress = { approach: "show" as const, eyeLit: 0, practiceLit: 0 };
    expect(needleLearningCue(progress, practice)).toBe(practice.gates[0]);
    expect(progress.practiceLit).toBe(0);
    expect(needleLearningCue({ ...progress, practiceLit: 1 }, practice)).toBeNull();
    expect(needleLearningCue(progress, course())).toBeNull();
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
      if (approach !== "show") {
        expect(needleLearningCue(progress, practice)).toBeNull();
      }
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
      expect(Boolean(chapterFlight(resumed).guidance)).toBe(approach === "show");
    },
  );
  it("allows changing the learning approach through Loom without resetting any lit gate", () => {
    const context = chapter();
    learn(context, "show");
    cross(context, needleCourses(context.flight)!.practice.gates[0]!, 20);
    expect(chapterProgress(context).practiceLit).toBe(1);
    const choice = useNeedle(context, "elderLoom")!.dialogue!;
    chooseNeedle(context, choice, "independent");
    expect(chapterProgress(context)).toMatchObject({ approach: "independent", practiceLit: 1 });
    expect(chapterFlight(context).guidance).toBeUndefined();
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
    expect(chapterProgress(context)).toMatchObject({ eyeLit: 8, practiceLit: 3 });
    expect(useNeedle(context, "holodisk")).toEqual({});
    context.flight.player = { ...layout.eye.holodisk };
    stepNeedle(context, 0.1, context.flight.player);
    expect(
      chapterFlight(context).chatter.filter((cue) => cue.text === NEEDLE_LEARNING.drones),
    ).toHaveLength(1);
    expect(useNeedle(context, "holodisk")).toEqual({ complete: true, holodisk: {} });
    context.progress.holodisk = true;
    context.progress.questComplete = true;
    expect(needleObjectiveIndex(context)).toBe(5);
    expect(useNeedle(context, "holodisk")).toEqual({});
    const before = structuredClone(chapterProgress(context));
    const panel = useNeedle(context, "elderLoom")!.dialogue!;
    chooseNeedle(context, panel, "continue");
    expect(chapterProgress(context)).toEqual({ ...before, practiceThanked: true });
    expect(context.progress.holodisk).toBe(true);
  });
  it("keeps lit gates and position on a fast retry, giving actual last-lit guidance without teleporting", () => {
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
    expect(chapterFlight(context).guidance).toEqual(gates[0]!.point);
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
