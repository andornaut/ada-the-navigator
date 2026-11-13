import { describe, expect, it, vi } from "vitest";

import { CONVERSATION_TUNING, CONVERSATIONS } from "../data/conversations.ts";
import type { GalaxyNumber } from "../data/types.ts";
import {
  ConversationDirector,
  type ConversationEligibilityFacts,
  type ConversationFacts,
} from "./conversations.ts";

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
function fixture(galaxy: GalaxyNumber, ids: readonly string[]) {
  const heard: string[] = [];
  const facts: ConversationEligibilityFacts = {
    galaxy,
    holodisks: 0,
    questComplete: false,
    resolved: false,
  };
  const live = { ...facts };
  const read = vi.fn(() => live);
  const talk = new ConversationDirector(
    CONVERSATIONS.filter(
      ({ id, pool }) => ids.includes(id) || (pool !== undefined && ids.includes(pool)),
    ),
    heard,
  );
  talk.setEligibilityReader(read);
  talk.beginFlight(galaxy);
  const step = (seconds = 0.01, changes: Partial<ConversationFacts> = {}) =>
    talk.step(seconds, false, { ...calm, holodisks: live.holodisks, ...changes });
  const quiet = () => step(CONVERSATION_TUNING.quietSeconds + 0.01);
  return { heard, live, quiet, read, step, talk };
}

describe("authored conversation chronology", () => {
  it.each([
    [2, "quiet:2:whole"],
    [6, "quiet:6:whole"],
  ] as const)("limits galaxy %s's unfinished-whole line to five held disks", (galaxy, id) => {
    for (const held of [5, 6]) {
      const f = fixture(galaxy, [id]);
      f.live.holodisks = held;
      f.quiet();
      expect(f.talk.showing?.conversation.id ?? null).toBe(held === 5 ? id : null);
      expect(f.heard.includes(id)).toBe(held === 5);
    }
  });

  it.each([2, 3])("allows the scattering retrospective from three disks (held=%s)", (held) => {
    const id = "quiet:5:disks";
    const f = fixture(5, [id]);
    f.live.holodisks = held;
    f.quiet();
    expect(f.talk.showing?.conversation.id ?? null).toBe(held === 3 ? id : null);
    expect(f.heard.includes(id)).toBe(held === 3);
  });

  it("skips the first ineligible unseen quiet entry and keeps honesty valid after resolution", () => {
    const f = fixture(5, ["quiet:5:disks", "quiet:5:pretend"]);
    Object.assign(f.live, { holodisks: 2, questComplete: true, resolved: true });
    f.quiet();
    expect(f.talk.showing?.conversation.id).toBe("quiet:5:pretend");
    expect(f.heard).toEqual(["quiet:5:pretend"]);
  });

  it.each(["arrival:6", "quiet:6:together"])(
    "requires an incomplete Phantom quest for %s",
    (id) => {
      for (const complete of [false, true]) {
        const f = fixture(6, [id]);
        Object.assign(f.live, { holodisks: 6, questComplete: complete });
        f.quiet();
        expect(f.talk.showing?.conversation.id ?? null).toBe(complete ? null : id);
        expect(f.heard.includes(id)).toBe(!complete);
      }
    },
  );

  it("does not let an invalid first quiet line block the next eligible Phantom line", () => {
    const f = fixture(6, ["quiet:6:whole", "quiet:6:together"]);
    f.live.holodisks = 6;
    f.quiet();
    expect(f.talk.showing?.conversation.id).toBe("quiet:6:together");
    expect(f.heard).toEqual(["quiet:6:together"]);
  });
});

describe("live eligibility at every director boundary", () => {
  it.each([
    "showing",
    "warningShowing",
    "advance",
    "skip",
    "pending",
    "beforeInteraction",
    "timer",
  ] as const)("rechecks fresh facts at %s without marking an unexposed line heard", (boundary) => {
    const id = "arrival:6";
    const f = fixture(6, [id]);
    f.step();
    expect(f.heard).toEqual([]);
    f.live.questComplete = true;
    const reads = f.read.mock.calls.length;
    if (boundary === "showing") {
      expect(f.talk.showing).toBeNull();
    } else if (boundary === "warningShowing") {
      expect(f.talk.warningShowing).toBe(false);
    } else if (boundary === "advance") {
      f.talk.advance();
    } else if (boundary === "skip") {
      f.talk.skip();
    } else if (boundary === "pending") {
      expect(f.talk.pending(id)).toBe(false);
    } else if (boundary === "beforeInteraction") {
      expect(f.talk.beforeInteraction([id])).toBe(false);
    } else {
      f.step(100);
    }
    expect(f.read.mock.calls.length).toBeGreaterThan(reads);
    expect(f.talk.showing).toBeNull();
    expect(f.heard).toEqual([]);
  });

  it("retains an already exposed identifier while dropping its newly stale remaining lines", () => {
    const f = fixture(2, ["quiet:2:whole"]);
    f.live.holodisks = 5;
    f.quiet();
    expect(f.talk.showing?.lineIndex).toBe(0);
    expect(f.heard).toEqual(["quiet:2:whole"]);
    f.live.holodisks = 6;
    f.talk.advance();
    expect(f.talk.showing).toBeNull();
    expect(f.heard).toEqual(["quiet:2:whole"]);
  });

  it("drops a stale interrupted prelude instead of resuming it after a warning", () => {
    const f = fixture(6, ["arrival:6", "warning:drones"]);
    f.step();
    f.step(0.01, { dronesNear: true, inDanger: true });
    expect(f.talk.showing?.instance).toBe("warning:drones");
    f.live.questComplete = true;
    expect(f.talk.beforeInteraction(["arrival:6"])).toBe(false);
    expect(f.talk.showing?.instance).toBe("warning:drones");
    while (f.talk.showing) {
      f.talk.advance();
    }
    f.step();
    expect(f.talk.showing).toBeNull();
    expect(f.heard).not.toContain("arrival:6");
  });

  it("preserves explicit Talk prelude order, pending state and exposure-based seen records", () => {
    const f = fixture(4, ["arrival:4", "meeting:4:avi"]);
    f.talk.encounter("stationNear");
    expect(f.talk.beforeInteraction(["arrival:4", "meeting:4:avi"])).toBe(true);
    expect(f.heard).toEqual([]);
    expect(f.talk.pending("arrival:4")).toBe(true);
    expect(f.talk.showing?.conversation.id).toBe("arrival:4");
    expect(f.talk.showing?.conversation.id).toBe("arrival:4");
    expect(f.heard).toEqual(["arrival:4"]);
    while (f.talk.showing) {
      f.talk.advance();
    }
    expect(f.talk.beforeInteraction(["meeting:4:avi"])).toBe(true);
    expect(f.talk.showing).toMatchObject({ conversation: { id: "meeting:4:avi" } });
    expect(f.heard).toEqual(["arrival:4", "meeting:4:avi"]);
  });

  it("will not let an explicit Talk prelude replace a higher-priority warning", () => {
    const f = fixture(4, ["arrival:4", "warning:drones"]);
    f.step(0.01, { dronesNear: true, inDanger: true });
    expect(f.talk.beforeInteraction(["arrival:4"])).toBe(true);
    expect(f.talk.showing?.instance).toBe("warning:drones");
    expect(f.heard).not.toContain("arrival:4");
  });

  it.each(["held", "galaxy"] as const)(
    "invalidates a queued broadcast when its exact %s changes",
    (change) => {
      const f = fixture(6, ["general:held:5", "warning:shieldLow"]);
      f.live.holodisks = 5;
      f.step(0.01, { inDanger: true, shieldFraction: 0.1 });
      f.step(0.01, { dronesNear: true, inDanger: true, shieldFraction: 0.1 });
      expect(f.talk.showing?.instance).toBe("warning:shieldLow");
      if (change === "held") {
        f.live.holodisks = 6;
      } else {
        f.live.galaxy = 5;
      }
      expect(f.talk.pending("general:held:5")).toBe(false);
      expect(f.heard).not.toContain("general:6");
    },
  );

  it("rejects an active broadcast using live count even when the last step's facts are stale", () => {
    const f = fixture(6, ["general:held:5"]);
    f.live.holodisks = 5;
    f.step(0.01, { dronesNear: true, inDanger: true });
    f.live.holodisks = 6;
    f.talk.advance();
    expect(f.talk.showing).toBeNull();
    expect(f.heard).toEqual([]);
  });
});
