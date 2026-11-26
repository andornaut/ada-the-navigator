import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATION_TUNING, CONVERSATIONS } from "../data/conversations.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { ConversationDirector, type ConversationFacts } from "./conversations.ts";
import { GameModel } from "./game.ts";
import { landmarkSites } from "./landmarks.ts";
import { immutableScanOutcome, type ScanCompletion, type ScanOutcome } from "./scanOutcomes.ts";
import { scanOutcomeLines } from "./scanOutcomeSpeech.ts";

const calm: ConversationFacts = {
  aimed: false,
  capitalInSight: false,
  collectedStardust: false,
  docked: false,
  dronesNear: false,
  encounters: [],
  frigateInSight: false,
  guardCues: [],
  heavyDisabled: false,
  holodisks: 0,
  inCurrent: false,
  inDanger: false,
  jobMoments: [],
  lostItemNear: null,
  moved: false,
  newStation: false,
  newlyMapped: [],
  pennyPoints: [],
  shieldFraction: 1,
  stardustInSight: false,
  stationsDiscovered: [],
  stationsNear: [],
};
function outcome(
  source: ScanOutcome["source"] = "scan",
  completions: readonly ScanCompletion[] = [],
) {
  return immutableScanOutcome({
    completions,
    galaxy: 1,
    source,
    target: { id: "landmark:1:0", name: "Veil $& {quest}", symbol: "nebula" },
    targetId: "landmark:1:0",
  });
}
const quest = {
  icon: { jobType: "survey" as const, symbol: "job" as const },
  id: "job:1:survey-1",
  name: "Nebula survey",
};
function director() {
  const seen = CONVERSATIONS.map(({ id }) => id);
  const talk = new ConversationDirector(CONVERSATIONS, seen);
  talk.beginFlight(1, { aim: true, dock: true, move: true, scan: true, stardust: true });
  return { seen, talk };
}
function step(talk: ConversationDirector, facts = calm) {
  talk.step(0.01, null, facts);
}

it("formats exactly one ordinary or remembered intro using safe literal target substitution", () => {
  expect(scanOutcomeLines(outcome())).toEqual([
    { speaker: "astra", text: "Scan complete: Veil $& {quest}." },
  ]);
  expect(scanOutcomeLines(outcome("remembered"))).toEqual([
    { speaker: "astra", text: "We've already scanned Veil $& {quest}." },
  ]);
});

it("keeps real task and full quest completions distinct and in committed event order", () => {
  const lines = scanOutcomeLines(
    outcome("remembered", [
      { kind: "task", quest, task: { id: "target-task", text: "Survey $& {target}" } },
      { kind: "quest", quest },
    ]),
  );
  expect(lines.map(({ text }) => text)).toEqual([
    "We've already scanned Veil $& {quest}.",
    "Task complete: Survey $& {target}.",
    "Quest complete: Nebula survey.",
  ]);
  expect(lines.every(({ speaker }) => speaker === "astra")).toBe(true);
  expect(
    scanOutcomeLines(outcome("scan", [{ kind: "quest", quest }])).map(({ text }) => text),
  ).toEqual(["Scan complete: Veil $& {quest}.", "Quest complete: Nebula survey."]);
});

it("queues the same object once but retains distinct equally worded outcomes without saving speech IDs", () => {
  const { seen, talk } = director();
  const first = outcome("scan", [{ kind: "quest", quest }]);
  talk.scanOutcome(first);
  talk.scanOutcome(first);
  talk.scanOutcome(outcome("scan", [{ kind: "quest", quest }]));
  step(talk);
  const firstInstance = talk.showing!.instance;
  expect(talk.showing!.line.text).toBe("Scan complete: Veil $& {quest}.");
  talk.advance();
  expect(talk.showing!.line.text).toBe("Quest complete: Nebula survey.");
  talk.advance();
  step(talk);
  expect(talk.showing!.instance).not.toBe(firstInstance);
  expect(talk.showing!.line.text).toBe("Scan complete: Veil $& {quest}.");
  talk.advance();
  talk.advance();
  talk.scanOutcome(first);
  step(talk);
  expect(talk.showing).toBeNull();
  expect(seen.some((id) => id.startsWith("chapter:cue:scan:"))).toBe(false);
});

it("keeps the existing spoken scan receipt duration when ordinary speech is shorter", () => {
  const { talk } = director();
  talk.scanOutcome(outcome());
  const text = talk.showing!.line.text;
  const end = 5 + 0.05 * text.length;
  talk.step(end - 0.01, null, calm);
  expect(talk.showing?.line.text).toBe(text);
  talk.step(0.01, null, calm);
  expect(talk.showing).toBeNull();
});

it("keeps an active event warning ahead of the new receipt instead of clearing unrelated speech", () => {
  const { talk } = director();
  talk.chapterCue({ speaker: "astra", text: "Existing event warning." });
  step(talk);
  const warning = talk.showing!.instance;
  talk.scanOutcome(outcome());
  step(talk);
  expect(talk.showing!.instance).toBe(warning);
  talk.skip();
  step(talk);
  expect(talk.showing!.line.text).toBe("Scan complete: Veil $& {quest}.");
});

it("resumes the existing lesson and Penny requests through the shared event-cue scheduler", () => {
  const talk = new ConversationDirector(
    CONVERSATIONS.filter(
      ({ trigger }) =>
        (trigger.kind === "lesson" && trigger.lesson === "move") || trigger.kind === "penny",
    ),
    [],
  );
  talk.beginFlight(1);
  const facts = { ...calm, pennyPoints: ["landmark:1:0"] };
  step(talk, facts);
  const lesson = talk.showing!.instance;
  talk.scanOutcome(outcome());
  step(talk, facts);
  expect(talk.showing!.line.speaker).toBe("astra");
  talk.skip();
  step(talk, facts);
  expect(talk.showing!.instance).toBe(lesson);
  talk.skip();
  talk.step(CONVERSATION_TUNING.cooldownSeconds + 0.01, null, facts);
  expect(talk.showing!.conversation.trigger.kind).toBe("penny");
  const penny = talk.showing!.instance;
  talk.scanOutcome(outcome("remembered"));
  step(talk, facts);
  expect(talk.showing!.line.text).toBe("We've already scanned Veil $& {quest}.");
  talk.skip();
  step(talk, facts);
  expect(talk.showing!.instance).toBe(penny);
});

it("replaces a lower line with the receipt on the step its outcome is committed", () => {
  const talk = new ConversationDirector(
    CONVERSATIONS.filter(({ trigger }) => trigger.kind === "penny"),
    [],
  );
  talk.beginFlight(1, { aim: true, dock: true, move: true, scan: true, stardust: true });
  const facts = { ...calm, pennyPoints: ["landmark:1:0"] };
  step(talk, facts);
  const penny = talk.showing!.instance;
  talk.scanOutcome(outcome());
  expect(talk.showing!.line.text).toBe("Scan complete: Veil $& {quest}.");
  talk.skip();
  step(talk, facts);
  expect(talk.showing!.instance).toBe(penny);
});

it("shows the receipt over a game notice and keeps it showing as the notice waits", () => {
  const { talk } = director();
  step(talk);
  talk.scanOutcome(outcome());
  expect(talk.showsOver("notice")).toBe(true);
  expect(talk.showsOver("refusal")).toBe(false);
  expect(talk.warningShowing).toBe(false);
  talk.step(1, "notice", calm);
  expect(talk.showing!.line.text).toBe("Scan complete: Veil $& {quest}.");
  expect(talk.showing!.elapsed).toBeCloseTo(1);
});

it("queues the receipt behind a drone warning, never dropped, however long the warning lasts", () => {
  const { talk } = director();
  const drones = { ...calm, dronesNear: true, inDanger: true };
  step(talk, drones);
  const warning = talk.showing!.instance;
  expect(talk.warningShowing).toBe(true);
  talk.scanOutcome(outcome());
  expect(talk.showing!.instance).toBe(warning);
  // Past the rectangle's 1.5 s and every warning line, the receipt still follows.
  const shown: string[] = [];
  for (let t = 0; t < 30 && talk.showing?.instance !== undefined; t += 0.05) {
    talk.step(0.05, null, drones);
    const text = talk.showing?.line.text;
    if (text && shown.at(-1) !== text) {
      shown.push(text);
    }
  }
  expect(shown.indexOf("Scan complete: Veil $& {quest}.")).toBeGreaterThan(0);
});

it("lets a warning interrupt the receipt, which resumes after it", () => {
  const { talk } = director();
  step(talk);
  talk.scanOutcome(outcome());
  const receipt = talk.showing!.instance;
  talk.step(0.05, null, { ...calm, dronesNear: true, inDanger: true });
  expect(talk.warningShowing).toBe(true);
  talk.skip();
  step(talk, { ...calm, dronesNear: true, inDanger: true });
  expect(talk.showing!.instance).toBe(receipt);
  expect(talk.showing!.line.text).toBe("Scan complete: Veil $& {quest}.");
});

it("shows the receipt in the conversation box as soon as Use scans", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  model.startGalaxy(1);
  const flight = model.state.flight!;
  // No drones: a warning would rightly keep the receipt waiting.
  flight.objects = flight.objects.filter(({ kind }) => kind !== "enemy");
  const target = landmarkSites(1).find(({ id }) => !model.state.progress[1].charted.includes(id))!;
  flight.player = { x: target.x, y: target.y };
  expect(model.contextAction).toBe("scan");
  // A flight step runs the conversation director before Use, so no later step is needed.
  model.interact();
  expect(model.drainScanOutcomes()).toHaveLength(1);
  expect(model.conversation?.text).toMatch(/^Scan complete: /);
});
