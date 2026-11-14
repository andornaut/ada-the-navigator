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
});
