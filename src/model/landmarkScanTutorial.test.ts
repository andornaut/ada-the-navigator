import { describe, expect, it } from "vitest";

import { CONVERSATION_TUNING, CONVERSATIONS } from "../data/conversations.ts";
import { LANDMARK_SCAN_COPY } from "../data/landmarkScanCopy.ts";
import { restoreSave } from "../saving/index.ts";
import { ConversationDirector, type ConversationFacts } from "./conversations.ts";
import { newGameState } from "./game.ts";

const scanExposure = "poi:heard:scan-lesson";

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
function fixture(heard: string[] = [], penny = false) {
  const talk = new ConversationDirector(
    CONVERSATIONS.filter(
      ({ id, trigger }) => id === "lesson:scan" || (penny && trigger.kind === "penny"),
    ),
    heard,
  );
  talk.beginFlight(1);
  return { heard, talk };
}

function reload(heard: string[]) {
  const save = restoreSave(JSON.stringify({ ...newGameState(), seenConversations: heard }))!;
  return fixture(save.seenConversations);
}

describe("visible landmark Scan tutorial", () => {
  it("waits behind covered notices and records the once-per-save lesson only on exposure", () => {
    const { heard, talk } = fixture();
    talk.requestScanLesson();
    talk.step(0.01, "notice", calm);
    expect(heard).toEqual([]);
    talk.step(0.01, null, calm);
    expect(heard).toEqual([]);
    expect(talk.showing?.line).toMatchObject({
      speaker: "astra",
      text: LANDMARK_SCAN_COPY.instruction,
    });
    expect(talk.heardScanLesson).toBe(true);
    expect(heard).toEqual(["lesson:scan", scanExposure]);
    void talk.showing;
    expect(heard).toEqual(["lesson:scan", scanExposure]);
    talk.advance();
    talk.requestScanLesson();
    talk.step(20, null, calm);
    expect(talk.showing).toBeNull();
    const restored = reload(heard);
    restored.talk.requestScanLesson();
    restored.talk.step(0.01, null, calm);
    expect(restored.talk.showing).toBeNull();
    expect(restored.talk.heardScanLesson).toBe(true);
    expect(restored.heard).toEqual(["lesson:scan", scanExposure]);
  });

  it("follows an already showing Penny exchange without interrupting or duplicating it", () => {
    const { heard, talk } = fixture([], true);
    talk.step(0.01, null, { ...calm, pennyPoints: ["landmark:1:0"] });
    expect(talk.showing?.instance).toContain("penny:1:landmark:1:0");
    talk.requestScanLesson();
    talk.step(0.01, null, calm);
    expect(talk.showing?.instance).toContain("penny:1:landmark:1:0");
    expect(heard).not.toContain("lesson:scan");
    expect(heard).not.toContain(scanExposure);
    for (let i = 0; i < 8 && talk.showing?.instance.startsWith("penny:"); i++) {
      talk.advance();
    }
    talk.step(CONVERSATION_TUNING.cooldownSeconds + 0.01, null, calm);
    expect(talk.showing?.line.text).toBe(LANDMARK_SCAN_COPY.instruction);
    expect(heard.filter((id) => id === "lesson:scan" || id === scanExposure)).toEqual([
      "lesson:scan",
      scanExposure,
    ]);
  });

  it("drops a target that becomes charted before exposure without spending an unheard lesson", () => {
    const { heard, talk } = fixture();
    let uncharted = true;
    talk.requestScanLesson(() => uncharted);
    talk.step(0.01, "notice", calm);
    uncharted = false;
    expect(talk.pending("lesson:scan")).toBe(false);
    talk.step(0.01, null, calm);
    expect(talk.showing).toBeNull();
    expect(heard).toEqual([]);
    talk.requestScanLesson(() => true);
    talk.step(0.01, null, calm);
    expect(talk.showing?.line.text).toBe(LANDMARK_SCAN_COPY.instruction);
  });

  it("cancels only the deferred lesson after Scan and preserves the Penny exchange", () => {
    const { heard, talk } = fixture([], true);
    talk.step(0.01, null, { ...calm, pennyPoints: ["landmark:1:0"] });
    const penny = talk.showing;
    expect(penny?.instance).toContain("penny:");
    talk.requestScanLesson(() => true);
    talk.completeScanLesson();
    expect(talk.showing).toEqual(penny);
    expect(talk.heardScanLesson).toBe(false);
    for (let i = 0; i < 8 && talk.showing?.instance.startsWith("penny:"); i++) {
      talk.advance();
    }
    talk.step(CONVERSATION_TUNING.cooldownSeconds + 0.01, null, calm);
    expect(talk.showing).toBeNull();
    expect(heard.filter((id) => id === "lesson:scan" || id === scanExposure)).toEqual([
      "lesson:scan",
    ]);
    const restored = reload(heard);
    restored.talk.requestScanLesson();
    restored.talk.step(0.01, null, calm);
    expect(restored.talk.showing).toBeNull();
    expect(restored.talk.heardScanLesson).toBe(false);
    expect(restored.heard).toEqual(heard);
  });

  it("keeps prior exposure distinct from the saved Scan lesson flag", () => {
    const { heard, talk } = reload([scanExposure]);
    expect(heard).toEqual([scanExposure]);
    expect(talk.heardScanLesson).toBe(true);

    talk.requestScanLesson();
    talk.step(0.01, null, calm);
    expect(talk.showing?.line.text).toBe(LANDMARK_SCAN_COPY.instruction);
    expect(heard).toEqual([scanExposure, "lesson:scan"]);
  });

  it("does not resume stale Scan instruction after an unrelated warning", () => {
    const { talk } = fixture();
    let uncharted = true;
    talk.requestScanLesson(() => uncharted);
    talk.step(0.01, null, calm);
    expect(talk.showing?.line.text).toBe(LANDMARK_SCAN_COPY.instruction);
    talk.chapterCue({ speaker: "astra", text: "Existing warning" });
    talk.step(0.01, null, calm);
    expect(talk.showing?.line.text).toBe("Existing warning");
    uncharted = false;
    expect(talk.pending("lesson:scan")).toBe(false);
    expect(talk.showing?.line.text).toBe("Existing warning");
    talk.advance();
    talk.step(CONVERSATION_TUNING.cooldownSeconds + 0.01, null, calm);
    expect(talk.showing).toBeNull();
  });
});
