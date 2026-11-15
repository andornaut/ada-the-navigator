import { describe, expect, it } from "vitest";

import { CONVERSATION_TUNING, CONVERSATIONS } from "../data/conversations.ts";
import { LANDMARK_SCAN_COPY } from "../data/landmarkScanCopy.ts";
import { ConversationDirector, type ConversationFacts } from "./conversations.ts";

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

describe("visible landmark Scan tutorial", () => {
  it("waits behind covered notices and records the once-per-save lesson only on exposure", () => {
    const { heard, talk } = fixture();
    talk.requestScanLesson();
    talk.step(0.01, true, calm);
    expect(heard).not.toContain("lesson:scan");
    talk.step(0.01, false, calm);
    expect(heard).not.toContain("lesson:scan");
    expect(talk.showing?.line).toMatchObject({
      speaker: "astra",
      text: LANDMARK_SCAN_COPY.instruction,
    });
    expect(heard).toEqual(["lesson:scan"]);
    talk.advance();
    talk.requestScanLesson();
    talk.step(20, false, calm);
    expect(talk.showing).toBeNull();
    const restored = fixture([...heard]);
    restored.talk.requestScanLesson();
    restored.talk.step(0.01, false, calm);
    expect(restored.talk.showing).toBeNull();
  });

  it("follows an already showing Penny exchange without interrupting or duplicating it", () => {
    const { heard, talk } = fixture([], true);
    talk.step(0.01, false, { ...calm, pennyPoints: ["landmark:1:0"] });
    expect(talk.showing?.instance).toContain("penny:1:landmark:1:0");
    talk.requestScanLesson();
    talk.step(0.01, false, calm);
    expect(talk.showing?.instance).toContain("penny:1:landmark:1:0");
    expect(heard).not.toContain("lesson:scan");
    for (let i = 0; i < 8 && talk.showing?.instance.startsWith("penny:"); i++) {
      talk.advance();
    }
    talk.step(CONVERSATION_TUNING.cooldownSeconds + 0.01, false, calm);
    expect(talk.showing?.line.text).toBe(LANDMARK_SCAN_COPY.instruction);
    expect(heard.filter((id) => id === "lesson:scan")).toHaveLength(1);
  });

  it("drops a target that becomes charted before exposure without spending an unheard lesson", () => {
    const { heard, talk } = fixture();
    let uncharted = true;
    talk.requestScanLesson(() => uncharted);
    talk.step(0.01, true, calm);
    uncharted = false;
    expect(talk.pending("lesson:scan")).toBe(false);
    talk.step(0.01, false, calm);
    expect(talk.showing).toBeNull();
    expect(heard).not.toContain("lesson:scan");
    talk.requestScanLesson(() => true);
    talk.step(0.01, false, calm);
    expect(talk.showing?.line.text).toBe(LANDMARK_SCAN_COPY.instruction);
  });

  it("cancels only the deferred lesson after Scan and preserves the Penny exchange", () => {
    const { heard, talk } = fixture([], true);
    talk.step(0.01, false, { ...calm, pennyPoints: ["landmark:1:0"] });
    const penny = talk.showing;
    expect(penny?.instance).toContain("penny:");
    talk.requestScanLesson(() => true);
    talk.completeScanLesson();
    expect(talk.showing).toEqual(penny);
    for (let i = 0; i < 8 && talk.showing?.instance.startsWith("penny:"); i++) {
      talk.advance();
    }
    talk.step(CONVERSATION_TUNING.cooldownSeconds + 0.01, false, calm);
    expect(talk.showing).toBeNull();
    expect(heard.filter((id) => id === "lesson:scan")).toHaveLength(1);
    const restored = fixture([...heard]);
    restored.talk.requestScanLesson();
    restored.talk.step(0.01, false, calm);
    expect(restored.talk.showing).toBeNull();
  });

  it("does not resume stale Scan instruction after an unrelated warning", () => {
    const { talk } = fixture();
    let uncharted = true;
    talk.requestScanLesson(() => uncharted);
    talk.step(0.01, false, calm);
    expect(talk.showing?.line.text).toBe(LANDMARK_SCAN_COPY.instruction);
    talk.chapterCue({ speaker: "astra", text: "Existing warning" });
    talk.step(0.01, false, calm);
    expect(talk.showing?.line.text).toBe("Existing warning");
    uncharted = false;
    expect(talk.pending("lesson:scan")).toBe(false);
    expect(talk.showing?.line.text).toBe("Existing warning");
    talk.advance();
    talk.step(CONVERSATION_TUNING.cooldownSeconds + 0.01, false, calm);
    expect(talk.showing).toBeNull();
  });
});
