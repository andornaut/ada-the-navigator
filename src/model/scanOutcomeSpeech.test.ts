import { expect, it } from "vitest";

import { CONVERSATION_TUNING, CONVERSATIONS } from "../data/conversations.ts";
import { ConversationDirector, type ConversationFacts } from "./conversations.ts";
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
  talk.step(0.01, false, facts);
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
  talk.step(CONVERSATION_TUNING.cooldownSeconds + 0.01, false, facts);
  expect(talk.showing!.conversation.trigger.kind).toBe("penny");
  const penny = talk.showing!.instance;
  talk.scanOutcome(outcome("remembered"));
  step(talk, facts);
  expect(talk.showing!.line.text).toBe("We've already scanned Veil $& {quest}.");
  talk.skip();
  step(talk, facts);
  expect(talk.showing!.instance).toBe(penny);
});
