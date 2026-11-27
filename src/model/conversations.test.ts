import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import {
  CONVERSATION_TUNING,
  CONVERSATIONS,
  INTERACTION_COPY,
  lineDuration,
} from "../data/conversations.ts";
import { type EnemyArchetype, enemyCatalog } from "../data/enemyCatalog.ts";
import { SCREEN } from "../data/screen.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import {
  ConversationDirector,
  type ConversationFacts,
  heavyInSight,
  InteractionConversation,
  interactionCopy,
  pennyInstance,
  pennyPoints,
  speakerName,
} from "./conversations.ts";
import { createEnemy } from "./enemyAi.ts";
import { GameModel } from "./game.ts";
import type { PhantomChatter } from "./phantom.ts";
import type { SpaceObject } from "./types.ts";
import { collectWeapon } from "./weapons.ts";

const { cooldownSeconds, pennyIntervalSeconds, pennyRange, quietSeconds } = CONVERSATION_TUNING;

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

// A shuffle that keeps each pool in the copy's order, so the first draw is the first variant.
const inOrder = () => 1 - 1e-9;

/** A director in galaxy whose saved list already holds seen. */
function director(galaxy: GalaxyNumber, seen: string[] = [], done = {}) {
  const heard = [...seen];
  const talk = new ConversationDirector(CONVERSATIONS, heard, inOrder);
  talk.beginFlight(galaxy, done);
  return { heard, talk };
}
/** Steps in slices of at most 0.05 s, as the scene does. */
function run(talk: ConversationDirector, seconds: number, facts: Partial<ConversationFacts> = {}) {
  for (let left = seconds; left > 1e-9; left -= 0.05) {
    talk.step(Math.min(0.05, left), null, { ...calm, ...facts });
    void talk.showing;
  }
}
/** How long the line now showing shows unless tapped: 3 s plus 30 ms a character. */
const lineTime = (talk: ConversationDirector) => lineDuration(talk.showing!.line.text);
/** Whole 0.05 s steps that cover seconds. */
const lineSteps = (seconds: number) => Math.ceil(seconds / 0.05 - 1e-6);
const showing = (talk: ConversationDirector) =>
  talk.showing && `${talk.showing.instance}:${talk.showing.lineIndex}`;
/** Taps through whatever shows, returning each line's instance and index. */
function tapThrough(talk: ConversationDirector): string[] {
  const lines: string[] = [];
  for (let guard = 0; guard < 10 && talk.showing; guard++) {
    lines.push(showing(talk) ?? "");
    talk.advance();
  }
  return lines;
}
const lessonsHeard = ["lesson:move", "lesson:aim", "lesson:stardust", "lesson:dock"];
// Drones pressing Ada, which puts her in danger.
const drones = { dronesNear: true, inDanger: true };
// Galaxy one's quiet pool, heard, so a quiet minute brings no line.
const quietHeard = ["quiet:1:lonely", "quiet:1:tail", "quiet:1:name"];

describe("Phantom flight chatter", () => {
  it("keeps a blocked or unshown hardpoint cue pending across Continue and retires it on display", () => {
    const pending: PhantomChatter[] = ["flagshipHardpoint"];
    const id = "chapter:phantom:flagshipHardpoint";
    const initial = director(6);
    initial.talk.queuePhantomChatter(pending);
    initial.talk.step(0.01, "refusal", calm);
    expect(initial.talk.showing).toBeNull();
    expect(pending).toEqual(["flagshipHardpoint"]);
    initial.talk.step(0.01, null, calm);
    expect(initial.talk.pending(id)).toBe(true);
    expect(pending).toEqual(["flagshipHardpoint"]);

    const continued = director(6, initial.heard);
    const restored: PhantomChatter[] = JSON.parse(JSON.stringify(pending));
    continued.talk.queuePhantomChatter(restored);
    continued.talk.queuePhantomChatter(restored);
    continued.talk.step(0.01, null, calm);
    expect(restored).toEqual(["flagshipHardpoint"]);
    expect(continued.talk.showing).toMatchObject({
      instance: id,
      line: { speaker: "astra", text: "One hardpoint down. Keep aiming for the glowing parts." },
    });
    expect(restored).toEqual([]);
    expect(continued.heard).not.toContain(id);

    const afterDisplay = director(6, continued.heard);
    afterDisplay.talk.queuePhantomChatter(structuredClone(restored));
    afterDisplay.talk.step(0.01, null, calm);
    expect(afterDisplay.talk.pending(id)).toBe(false);

    // A new battle may generate the same cue after the canonical flight reset.
    afterDisplay.talk.beginFlight(6);
    afterDisplay.talk.queuePhantomChatter(["flagshipHardpoint"]);
    afterDisplay.talk.step(0.01, null, calm);
    expect(afterDisplay.talk.showing?.instance).toBe(id);
  });

  it.each(["battleAllies", "battleAlone"] as const)(
    "keeps %s, attack, hardpoint, and surrender in their original warning order",
    (approach) => {
      const pending: PhantomChatter[] = [
        approach,
        "flagshipAttack",
        "flagshipHardpoint",
        "flagshipDisabled",
      ];
      const { talk } = director(6);
      for (const cue of [...pending]) {
        talk.queuePhantomChatter(pending);
        talk.step(0.01, null, calm);
        expect(talk.showing?.conversation).toMatchObject({
          id: `chapter:phantom:${cue}`,
          priority: "warning",
          repeat: "flight",
        });
        expect(pending).not.toContain(cue);
        if (cue === approach || cue === "flagshipAttack") {
          talk.advance();
          expect(talk.showing?.lineIndex).toBe(1);
        }
        talk.skip();
      }
      expect(pending).toEqual([]);
    },
  );
});

describe("conversation schedule", () => {
  it("dwells and fades a one-line discovery on the same flight clock", () => {
    const mapped = CONVERSATIONS.find(({ trigger }) => trigger.kind === "mapped")!;
    const single = { ...mapped, lines: mapped.lines.slice(0, 1) };
    const talk = new ConversationDirector([single], [], inOrder);
    talk.beginFlight(1);
    run(talk, 0.05, { newlyMapped: ["test:charted"] });
    expect(talk.showing?.discoveryFadeEnd).toBe(3.3);
    run(talk, 3);
    expect(talk.showing?.elapsed).toBeCloseTo(3, 8);
    run(talk, 0.25);
    expect(talk.showing?.elapsed).toBeCloseTo(3.25, 8);
    run(talk, 0.05);
    expect(talk.showing).toBeNull();
  });
  it("shows each line for its time or until tapped, and the last tap closes", () => {
    const { talk } = director(1, lessonsHeard);
    run(talk, 0.05);
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, lineTime(talk) - 0.1);
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, 0.1);
    expect(showing(talk)).toBe("arrival:1:1");
    talk.advance();
    expect(talk.showing).toBeNull();
  });

  it("shows one at a time and waits out the cooldown before the next ordinary one", () => {
    const { talk } = director(1, lessonsHeard);
    run(talk, 0.05, { capitalInSight: true });
    expect(tapThrough(talk)).toEqual(["arrival:1:0", "arrival:1:1"]);
    // The capital stays in sight, so its reaction still holds when the cooldown ends.
    run(talk, cooldownSeconds - 0.1, { capitalInSight: true });
    expect(talk.showing).toBeNull();
    run(talk, 0.15, { capitalInSight: true });
    expect(showing(talk)).toBe("reaction:capital:0");
  });

  it("reacts to a disabled heavy once each flight", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { heavyDisabled: true });
    expect(tapThrough(talk)).toEqual(["reaction:disabled:0", "reaction:disabled:1"]);
    run(talk, cooldownSeconds + 1, { heavyDisabled: true });
    expect(talk.showing).toBeNull();
  });

  it("warns of a blocking guard with one line of its pool, once per destination each flight", () => {
    const pool = CONVERSATIONS.filter(({ trigger }) => trigger.kind === "guard");
    expect(pool.map(({ id }) => id)).toEqual([
      "warning:guard:1",
      "warning:guard:2",
      "warning:guard:3",
    ]);
    expect(pool.map(({ lines }) => lines[0]!.text)).toEqual([
      "Something's guarding this place. Here it comes!",
      "We can't visit yet. A guard ship is watching.",
      "A guard is blocking the way in. Stop its weapons first.",
    ]);
    pool.forEach(({ id }, index) => {
      const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
      run(talk, 0.05, { guardCues: [{ destination: "quest", pick: (index + 0.5) / 3 }] });
      expect(talk.showing?.conversation.id).toBe(id);
      expect(talk.showing?.instance).toBe("guard:1:quest");
      tapThrough(talk);
      // The same destination's cue does not play again this flight; another destination's does.
      run(talk, 1, { guardCues: [{ destination: "quest", pick: 0 }] });
      expect(talk.showing).toBeNull();
      run(talk, 0.05, { guardCues: [{ destination: "growers", pick: 0 }] });
      expect(talk.showing?.instance).toBe("guard:1:growers");
    });
  });

  it("orders waiting conversations warning, lesson, Penny, lore", () => {
    const { talk } = director(1, ["lesson:move", "lesson:aim", "lesson:dock", "arrival:1"]);
    run(talk, 0.05, {
      newlyMapped: ["growers"],
      pennyPoints: ["cache"],
      stardustInSight: true,
    });
    expect(showing(talk)).toBe("lesson:stardust:0");
    tapThrough(talk);
    run(talk, cooldownSeconds + 0.05, { pennyPoints: ["cache"] });
    expect(showing(talk)).toBe(`${pennyInstance(1, "cache")}:0`);
    tapThrough(talk);
    run(talk, cooldownSeconds + 0.05);
    expect(talk.showing?.conversation.priority).toBe("lore");
  });

  it("lets a higher conversation interrupt a lower one, which resumes after it", () => {
    const { talk } = director(1, ["lesson:move", "lesson:aim", "lesson:dock", "arrival:1"]);
    run(talk, 0.05, { pennyPoints: ["cache"] });
    talk.advance();
    run(talk, 2, { pennyPoints: ["cache"] });
    expect(showing(talk)).toBe("penny:1:cache:1");
    run(talk, 0.05, { pennyPoints: ["cache"], stardustInSight: true });
    expect(showing(talk)).toBe("lesson:stardust:0");
    tapThrough(talk);
    // Penny resumes at once, on the line she was on, ahead of the cooldown.
    run(talk, 0.05, { pennyPoints: ["cache"] });
    expect(showing(talk)).toBe("penny:1:cache:1");
    run(talk, lineTime(talk) - 2.1, { pennyPoints: ["cache"] });
    expect(showing(talk)).toBe("penny:1:cache:1");
    run(talk, 0.1, { pennyPoints: ["cache"] });
    expect(talk.showing).toBeNull();
  });

  it("drops an interrupted conversation that is no longer relevant", () => {
    const { talk } = director(1, ["lesson:move", "lesson:aim", "lesson:dock", "arrival:1"]);
    run(talk, 0.05, { pennyPoints: ["cache"] });
    run(talk, 0.05, { pennyPoints: ["cache"], stardustInSight: true });
    expect(showing(talk)).toBe("lesson:stardust:0");
    tapThrough(talk);
    // The cache was found meanwhile, so Penny's sense has nothing left to point at.
    run(talk, cooldownSeconds - 1);
    expect(talk.showing).toBeNull();
  });

  it("lets a warning skip the cooldown and interrupt an ordinary conversation", () => {
    const { talk } = director(1, lessonsHeard);
    run(talk, 0.05);
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, 0.05, drones);
    expect(showing(talk)).toBe("warning:drones:0");
    tapThrough(talk);
    run(talk, 0.05, drones);
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, 1, { inDanger: true, shieldFraction: 0.2 });
    expect(showing(talk)).toBe("warning:shieldLow:0");
  });

  it("holds a lower line under a notice, then resumes it where it was", () => {
    const { talk } = director(1, lessonsHeard);
    run(talk, 0.05, { capitalInSight: true });
    run(talk, lineTime(talk) - 0.55, { capitalInSight: true });
    expect(showing(talk)).toBe("arrival:1:0");
    for (let i = 0; i < 400; i++) {
      talk.step(0.05, "notice", calm);
    }
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, 0.4);
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, 0.15);
    expect(showing(talk)).toBe("arrival:1:1");
  });

  it("never holds a warning behind a notice", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { inDanger: true });
    tapThrough(talk);
    talk.step(0.05, "notice", { ...calm, inDanger: true, shieldFraction: 0.2 });
    expect(showing(talk)).toBe("warning:shieldLow:0");
    expect(talk.warningShowing).toBe(true);
    // A warning showing over a notice keeps its own time, line by line.
    const step = () => talk.step(0.05, "notice", { ...calm, inDanger: true, shieldFraction: 0.2 });
    for (let i = 0, steps = lineSteps(lineTime(talk)); i < steps; i++) {
      step();
    }
    expect(showing(talk)).toBe("warning:shieldLow:1");
    for (let i = 0, steps = lineSteps(lineTime(talk)); i < steps; i++) {
      step();
    }
    expect(talk.showing).toBeNull();
  });
});

describe("conversation triggers", () => {
  it("teach moving at the first flight's start, then aiming", () => {
    const { talk } = director(1);
    run(talk, 0.05);
    expect(showing(talk)).toBe("lesson:move:0");
    expect(talk.showing?.line).toEqual({
      desktop: "Fly with WASD.",
      speaker: "astra",
      text: "Fly with the {move}.",
    });
    tapThrough(talk);
    run(talk, cooldownSeconds + 0.05);
    expect(showing(talk)).toBe("lesson:aim:0");
  });

  it("skip a lesson already done, marking it heard", () => {
    const { heard, talk } = director(1);
    run(talk, 0.1, { aimed: true, moved: true });
    expect(heard).toEqual(expect.arrayContaining(["lesson:move", "lesson:aim"]));
    expect(showing(talk)).toBe("arrival:1:0");
  });

  it("teach Stardust on sighting it, unless Ada has collected some before", () => {
    const fresh = director(1, ["lesson:move", "lesson:aim", "arrival:1"]);
    run(fresh.talk, 0.05, { stardustInSight: true });
    expect(showing(fresh.talk)).toBe("lesson:stardust:0");
    const collected = director(1, ["lesson:move", "lesson:aim", "arrival:1"], { stardust: true });
    run(collected.talk, 0.05, { stardustInSight: true });
    expect(collected.talk.showing).toBeNull();
    expect(collected.heard).toContain("lesson:stardust");
  });

  it("teach docking on a new station, unless Ada has docked first", () => {
    const seen = ["lesson:move", "lesson:aim", "arrival:1"];
    const fresh = director(1, seen);
    run(fresh.talk, 0.05, { newStation: true });
    expect(showing(fresh.talk)).toBe("lesson:dock:0");
    const docked = director(1, seen);
    run(docked.talk, 0.05, { docked: true, newStation: true });
    // The new station's own reaction plays instead.
    expect(showing(docked.talk)).toBe("reaction:station:0");
    expect(docked.heard).toContain("lesson:dock");
  });

  it("greet a first arrival in a galaxy with lines, and only once", () => {
    const { heard, talk } = director(1, lessonsHeard);
    run(talk, 0.05);
    expect(showing(talk)).toBe("arrival:1:0");
    tapThrough(talk);
    talk.beginFlight(1);
    run(talk, 0.05);
    expect(talk.showing).toBeNull();
    expect(heard).toContain("arrival:1");
  });

  it("meet each alien group, then react to the new place", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { newlyMapped: ["workshop"] });
    const lines = [tapThrough(talk)];
    run(talk, 0.05);
    lines.push(tapThrough(talk));
    expect(lines.flat().map((line) => line.replace(/:\d+$/u, ""))).toEqual([
      "meeting:1:workshop",
      "meeting:1:workshop",
      "poi:1:storyPlace:workshop",
    ]);
    run(talk, cooldownSeconds + 0.05, { newStation: true, newlyMapped: ["growers"] });
    expect(showing(talk)).toBe("meeting:1:growers:0");
  });

  it("queues every confirmed authored site in order, coalescing only duplicates", () => {
    const talk = new ConversationDirector([], [], inOrder);
    talk.beginFlight(1);
    run(talk, 0.05, { newlyMapped: ["growers", "salvagers", "growers"] });
    expect(tapThrough(talk)).toEqual(["poi:1:storyPlace:growers:0"]);
    run(talk, 0.05);
    expect(tapThrough(talk)).toEqual(["poi:1:storyPlace:salvagers:0"]);
    run(talk, cooldownSeconds + 0.05);
    expect(talk.showing).toBeNull();
  });

  it("keeps distinct procedural story IDs that share a copy pool", () => {
    const talk = new ConversationDirector([], [], inOrder);
    talk.beginFlight(5);
    const first = "settlement:0,1";
    const second = "settlement:0,2";
    const mappedStoryRoles = new Map([
      [first, "settlement"],
      [second, "settlement"],
    ]);
    run(talk, 0.05, { mappedStoryRoles, newlyMapped: [first, second, first] });
    expect(tapThrough(talk)).toEqual([`poi:5:storyPlace:settlement:${first}:0`]);
    run(talk, 0.05);
    expect(tapThrough(talk)).toEqual([`poi:5:storyPlace:settlement:${second}:0`]);
    run(talk, cooldownSeconds + 0.05);
    expect(talk.showing).toBeNull();
  });

  it("react to a capital ship and a frigate once each flight", () => {
    const { heard, talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { capitalInSight: true, frigateInSight: true });
    expect(tapThrough(talk)).toEqual(["reaction:frigate:0", "reaction:frigate:1"]);
    run(talk, cooldownSeconds + 0.05, { capitalInSight: true, frigateInSight: true });
    expect(tapThrough(talk)).toEqual(["reaction:capital:0", "reaction:capital:1"]);
    run(talk, cooldownSeconds + 1, { capitalInSight: true, frigateInSight: true });
    expect(talk.showing).toBeNull();
    expect(heard).not.toContain("reaction:capital");
    talk.beginFlight(1);
    run(talk, 0.05, { capitalInSight: true });
    expect(showing(talk)).toBe("reaction:capital:0");
  });

  it("warn of a low shield once per fight, at a quarter or less", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { inDanger: true });
    tapThrough(talk);
    run(talk, 0.5, { inDanger: true, shieldFraction: 0.26 });
    expect(talk.showing).toBeNull();
    run(talk, 0.05, { inDanger: true, shieldFraction: 0.25 });
    expect(showing(talk)).toBe("warning:shieldLow:0");
    // One warning: Astra's line, then Penny's whimper with her upset frame.
    expect(talk.showing?.line).toEqual({ speaker: "astra", text: "Shield low!" });
    talk.advance();
    expect(showing(talk)).toBe("warning:shieldLow:1");
    expect(talk.showing?.line).toEqual({ mood: "upset", speaker: "penny", text: "Whimper..." });
    expect(talk.warningShowing).toBe(true);
    tapThrough(talk);
    run(talk, 1, { inDanger: true, shieldFraction: 0.1 });
    expect(talk.showing).toBeNull();
    run(talk, 0.05);
    run(talk, 0.05, { inDanger: true, shieldFraction: 0.1 });
    expect(showing(talk)).toBe("warning:shieldLow:0");
  });

  it("call out drones once per flight", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, drones);
    expect(showing(talk)).toBe("warning:drones:0");
    tapThrough(talk);
    run(talk, 0.05);
    run(talk, 0.05, drones);
    expect(talk.showing).toBeNull();
    talk.beginFlight(1);
    run(talk, 0.05, drones);
    expect(showing(talk)).toBe("warning:drones:0");
  });

  it("call out drones only once they are near, never for danger from debris or hazards alone", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 2, { inDanger: true });
    expect(talk.showing).toBeNull();
    // Drones arriving later in the same danger are called out then.
    run(talk, 0.05, drones);
    expect(showing(talk)).toBe("warning:drones:0");
  });

  it("broadcast Archie once per built galaxy, the line after the holodisks Ada holds", () => {
    // Holding none, no broadcast plays: the drones' own warning does.
    const sunflower = director(1, [...lessonsHeard, "arrival:1"]);
    run(sunflower.talk, 0.05, drones);
    expect(showing(sunflower.talk)).toBe("warning:drones:0");
    for (const [galaxy, holodisks, line] of [
      [3, 1, "archie:held:1"],
      [2, 2, "archie:held:2"],
      [4, 2, "archie:held:2"],
      [5, 3, "archie:held:3"],
    ] as const) {
      const { heard, talk } = director(galaxy, lessonsHeard);
      run(talk, 0.05, { ...drones, holodisks });
      expect(talk.showing?.conversation.id).toBe(line);
      expect(tapThrough(talk)).toEqual([`archie:${galaxy}:0`, `archie:${galaxy}:1`]);
      expect(heard).toContain(`archie:${galaxy}`);
      // Once per galaxy: later engagements there call out the drones.
      run(talk, 0.05);
      run(talk, 0.05, { ...drones, holodisks: holodisks + 1 });
      expect(showing(talk)).toBe("warning:drones:0");
    }
  });

  it("plays the sixth broadcast, which names Phantom, nowhere else at five holodisks held", () => {
    for (const galaxy of [1, 2, 3] as const) {
      const { heard, talk } = director(galaxy, [...lessonsHeard, `arrival:${galaxy}`]);
      run(talk, 0.05, { ...drones, holodisks: 5 });
      expect(showing(talk)).toBe("warning:drones:0");
      expect(heard).not.toContain(`archie:${galaxy}`);
    }
  });

  it.each([
    ["drop", null, "arrival:1:0"],
    ["play", "job:lost", "penny:1:job:lost:0"],
  ] as const)(
    "%s a queued line when its turn comes, as its trigger has lapsed or holds",
    (_, after, shown) => {
      const { heard, talk } = director(1, [], { aim: true });
      run(talk, 0.05);
      expect(talk.showing?.instance).toBe("lesson:move");
      // Penny senses the lost item under the higher lesson, so her line waits its turn.
      run(talk, 0.05, { lostItemNear: "job:lost" });
      expect(talk.showing?.instance).toBe("lesson:move");
      tapThrough(talk);
      // Ada has left the item's range, or stays in it, when the cooldown ends.
      run(talk, cooldownSeconds + 0.1, { lostItemNear: after });
      expect(showing(talk)).toBe(shown);
      expect(heard.includes("penny:1:job:lost")).toBe(after !== null);
    },
  );

  it("draw an unseen lore line from the galaxy's pool after a quiet minute", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, quietSeconds - 1);
    run(talk, 0.05, { inDanger: true });
    tapThrough(talk);
    run(talk, quietSeconds - 0.5);
    expect(talk.showing).toBeNull();
    run(talk, 0.6);
    expect(showing(talk)).toBe("quiet:1:lonely:0");
    tapThrough(talk);
    run(talk, quietSeconds + 0.05);
    expect(showing(talk)).toBe("quiet:1:tail:0");
  });

  it.each([
    [2, ["quiet:2:notice:0", "quiet:2:whole:0"]],
    [3, ["quiet:3:maps:0", "quiet:3:rock:0"]],
  ] as const)(
    "greet galaxy %i with Astra's arrival line, then draw quiet lines from its own pool",
    (galaxy, quiet) => {
      const { talk } = director(galaxy, [...lessonsHeard, `archie:${galaxy}`]);
      run(talk, 0.05);
      expect(tapThrough(talk)).toEqual([`arrival:${galaxy}:0`, `arrival:${galaxy}:1`]);
      const drawn: string[] = [];
      for (let line = 0; line < quiet.length; line++) {
        for (let step = 0; step < 4000 && !talk.showing; step++) {
          run(talk, 0.05);
        }
        drawn.push(showing(talk) ?? "");
        tapThrough(talk);
      }
      expect(drawn).toEqual(quiet);
    },
  );

  it("keep each galaxy's quiet lines to its own pool", () => {
    const { talk } = director(2, [...lessonsHeard, "arrival:2", "quiet:2:notice", "quiet:2:whole"]);
    run(talk, 3 * (quietSeconds + cooldownSeconds));
    expect(talk.showing).toBeNull();
  });

  it("let Penny sense each point of interest once, while it is still near", () => {
    const { heard, talk } = director(1, [...lessonsHeard, "arrival:1", ...quietHeard]);
    run(talk, 0.05, { pennyPoints: ["a"] });
    expect(tapThrough(talk)).toEqual(["penny:1:a:0", "penny:1:a:1"]);
    run(talk, pennyIntervalSeconds + 0.05, { pennyPoints: ["a"] });
    expect(talk.showing).toBeNull();
    expect(heard.filter((entry) => entry === "penny:1:a")).toHaveLength(1);
  });

  it("let Penny sense at most once a minute, passing points that come near meanwhile", () => {
    const { heard, talk } = director(1, [...lessonsHeard, "arrival:1", ...quietHeard]);
    run(talk, 0.05, { pennyPoints: ["a"] });
    tapThrough(talk);
    run(talk, cooldownSeconds + 1, { pennyPoints: ["b"] });
    expect(talk.showing).toBeNull();
    expect(heard).toContain("penny:1:b");
    run(talk, pennyIntervalSeconds - cooldownSeconds - 1.2);
    run(talk, 0.05, { pennyPoints: ["c"] });
    expect(talk.showing).toBeNull();
    run(talk, 0.3);
    run(talk, 0.05, { pennyPoints: ["d"] });
    expect(showing(talk)).toBe("penny:1:d:0");
    expect(heard).toEqual(expect.arrayContaining(["penny:1:c", "penny:1:d"]));
    // Only the points she sensed count toward her finds, not the ones passed while she rested.
    expect(talk.takeSensed()).toEqual(["penny:1:a", "penny:1:d"]);
    expect(talk.takeSensed()).toEqual([]);
  });
});

describe("Penny's points of interest", () => {
  const object = (id: string, kind: SpaceObject["kind"], x: number, extra = {}): SpaceObject => ({
    hp: 1,
    id,
    kind,
    radius: 10,
    x,
    y: 0,
    ...extra,
  });
  const flight = {
    objects: [
      object("workshop", "destination", pennyRange),
      object("salvagers", "destination", pennyRange + 1),
      object("growers", "destination", 100),
      object("station:1:0", "station", 200),
      object("cache", "pickup", 300, { role: "discovery" }),
      object("rock", "rock", 50),
      object("holodisk", "destination", 400),
    ],
    player: { x: 0, y: 0 },
  };

  it("are the undiscovered ones within 900 units, even off screen, nearest first", () => {
    expect(pennyPoints({ known: ["growers"], stations: [] }, false, [], flight)).toEqual([
      "station:1:0",
      "cache",
      "workshop",
    ]);
  });

  it("include the uncharted landmarks given within range, by distance", () => {
    const landmarks = [
      { id: "landmark:1:0", x: 250, y: 0 },
      { id: "landmark:1:1", x: pennyRange + 50, y: 0 },
    ];
    expect(pennyPoints({ known: ["growers"], stations: [] }, false, landmarks, flight)).toEqual([
      "station:1:0",
      "landmark:1:0",
      "cache",
      "workshop",
    ]);
  });

  it("include the guarded holodisk only while its waypoint shows", () => {
    expect(
      pennyPoints({ known: ["growers"], stations: ["station:1:0"] }, true, [], flight),
    ).toEqual(["cache", "holodisk", "workshop"]);
  });
});

describe("capital sightings", () => {
  const enemy = (
    id: string,
    archetype: EnemyArchetype,
    x: number,
    state: Partial<SpaceObject["enemy"] & object> = {},
  ): SpaceObject => ({
    enemy: {
      ...createEnemy(
        enemyCatalog[archetype],
        { archetype, id, packId: null, phase: 0 },
        { x, y: 0 },
      ),
      ...state,
    },
    hp: enemyCatalog[archetype].hp,
    id,
    kind: "enemy",
    radius: enemyCatalog[archetype].sizeRatio * CONTENT.tuning.flight.shipRadius,
    x,
    y: 0,
  });
  const sighted = (objects: SpaceObject[]) =>
    heavyInSight("capital", SCREEN, { objects, player: { x: 0, y: 0 } });

  it("count a live capital on screen, hull and all", () => {
    expect(sighted([enemy("capital", "capital", 300)])).toBe(true);
    expect(sighted([enemy("capital", "capital", 5000)])).toBe(false);
    expect(sighted([{ ...enemy("capital", "capital", 300), hp: 0 }])).toBe(false);
    expect(sighted([enemy("fighter", "fighter", 100)])).toBe(false);
  });

  it("cover the capital battle while its escorts or the capital engage Ada off screen", () => {
    const capital = enemy("capital", "capital", 5000);
    expect(sighted([capital, enemy("escort", "fighter", 400, { escortOf: "capital" })])).toBe(
      false,
    );
    expect(
      sighted([capital, enemy("escort", "fighter", 400, { engaged: true, escortOf: "capital" })]),
    ).toBe(true);
    expect(sighted([enemy("capital", "capital", 5000, { engaged: true })])).toBe(true);
  });
});

describe("drone engagements in flight", () => {
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
  /** A flight in galaxy far from any friendly place, with a pack of drones near Ada. */
  function engaged(
    galaxy: GalaxyNumber,
    archetype: EnemyArchetype,
    count: number,
    recovered: readonly GalaxyNumber[] = [],
  ): GameModel {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.prologueSeen = true;
    model.state.unlocked = [1, 2, 3];
    for (const held of recovered) {
      model.state.progress[held].holodisk = true;
    }
    model.startGalaxy(galaxy);
    const flight = model.state.flight!;
    flight.player = { x: flight.player.x + 6000, y: flight.player.y };
    endArrivalGrace(flight);
    flight.objects = Array.from({ length: count }, (_, index) => {
      const definition = enemyCatalog[archetype];
      const at = {
        x: flight.player.x + 150 * Math.cos((index * 2 * Math.PI) / count),
        y: flight.player.y + 150 * Math.sin((index * 2 * Math.PI) / count),
      };
      const id = `drone:${index}`;
      return {
        ...at,
        enemy: createEnemy(definition, { archetype, id, packId: null, phase: index }, at),
        hp: definition.hp,
        id,
        kind: "enemy" as const,
        radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
      };
    });
    flight.shots = [];
    for (let step = 0; step < 60 && !model.inDanger; step++) {
      model.step(0.05, idle);
    }
    expect(model.inDanger).toBe(true);
    return model;
  }

  it("call out a large pack once its drones engage Ada", () => {
    const model = engaged(1, "swarm", 6);
    expect(model.conversation).toMatchObject({ key: "warning:drones:0" });
    expect(model.conversation?.discoveryFadeEnd).toBeUndefined();
  });

  it("play no broadcast in Sunflower before any holodisk", () => {
    expect(engaged(1, "swarm", 6).conversation?.key).toBe("warning:drones:0");
  });

  it("broadcast the second line in Whirlpool with Sunflower's holodisk held", () => {
    const whirlpool = engaged(3, "fighter", 4, [1]).conversation;
    expect(whirlpool).toMatchObject({
      key: "archie:3:0",
      name: "Unknown voice",
      named: false,
      text: "All drones: find the holodisks. Bring them to me.",
    });
  });

  it("broadcast the third line in Cartwheel with two holodisks held, still unnamed", () => {
    const cartwheel = engaged(2, "swarm", 6, [1, 3]).conversation;
    expect(cartwheel).toMatchObject({
      key: "archie:2:0",
      name: "Unknown voice",
      named: false,
      text: "Someone is collecting my holodisks. Stop them.",
    });
  });

  it("drops a stale broadcast and names Archie on a fresh three-disk broadcast", () => {
    const model = engaged(2, "swarm", 6, [1, 3]);
    expect(model.conversation).toMatchObject({ name: "Unknown voice", named: false });
    model.state.progress[2].holodisk = true;
    expect(model.conversation).toBeNull();
    expect(speakerName(model.state.progress, "archie")).toBe("Admiral Archie");
    const fresh = engaged(2, "swarm", 6, [1, 2, 3]);
    expect(fresh.conversation).toMatchObject({
      key: "archie:2:0",
      name: "Admiral Archie",
      named: true,
    });
  });
});

describe("Archie's name tab", () => {
  it("reads Unknown voice until the third holodisk is inserted, from whichever galaxy", () => {
    const progress = { 1: { holodisk: true }, 2: { holodisk: false }, 3: { holodisk: true } };
    expect(speakerName(progress, "archie")).toBe("Unknown voice");
    expect(speakerName({ ...progress, 2: { holodisk: true } }, "archie")).toBe("Admiral Archie");
    expect(speakerName({ ...progress, 5: { holodisk: true } }, "archie")).toBe("Admiral Archie");
    expect(speakerName(progress, "astra")).toBe("Astra");
  });
});

describe("conversations in the game", () => {
  /**
   * Galaxy one's first flight with no drones and nothing for Penny near the start, so neither a
   * warning nor Penny comes before the first lesson.
   */
  // A first flight, with the heard conversations already heard.
  function flying(heard: readonly string[] = []): GameModel {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    // As after a real first launch: the prologue and its achievement are behind Ada.
    model.state.prologueSeen = true;
    model.state.achievements.unlocked.push("newNavigator");
    model.state.seenConversations.push(...heard);
    model.startGalaxy(1);
    playOpening(model);
    expect(model.state.mode).toBe("space");
    const flight = model.state.flight!;
    // No enemies, stations, discoveries or drifting debris, which can strike Ada and start a fight.
    const quiet = (object: SpaceObject) =>
      object.kind !== "enemy" &&
      object.kind !== "station" &&
      object.kind !== "debris" &&
      object.role !== "discovery";
    for (const object of flight.objects.filter((object) => !quiet(object))) {
      // A removal tombstone keeps the chunk from loading it again.
      flight.world.notables[object.id] = null;
    }
    flight.objects = flight.objects.filter(quiet);
    flight.shots = [];
    flight.dangerFor = 0;
    return model;
  }
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
  const noticeSteps = lineSteps(2.5);
  const outOfAmmo = CONTENT.labels.outOfAmmo ?? "";

  it("show the touch and desktop wording with the speaker's name tab and side", () => {
    const model = flying();
    model.step(0.05, idle);
    expect(model.conversation).toMatchObject({
      desktop: "Fly with WASD.",
      mood: "neutral",
      name: "Astra",
      named: false,
      side: "right",
      speaker: "astra",
      text: "Fly with the {move}.",
    });
  });

  it("time each line from its start, for the speaking loop", () => {
    const model = flying();
    model.step(0.05, idle);
    expect(model.conversation?.elapsed).toBeCloseTo(0, 9);
    for (let i = 0; i < 10; i++) {
      model.step(0.05, idle);
    }
    expect(model.conversation?.elapsed).toBeCloseTo(0.5, 9);
    expect(model.conversation?.key).toBe("lesson:move:0");
  });

  it.each([
    ["destination", "reaction:mapped"],
    ["station", "reaction:station"],
  ] as const)("dwells on a newly mapped %s, then fades its last line", (kind, prefix) => {
    const model = flying([...lessonsHeard, "arrival:1"]);
    const flight = model.state.flight!;
    const id = "test:new-place";
    flight.objects.push({ ...flight.player, hp: 1, id, kind, radius: 30 });
    model.step(0.05, idle);
    expect(
      kind === "station" ? model.state.progress[1].stations : model.state.progress[1].known,
    ).toContain(id);
    // Penny can sense other nearby points before the lower-priority discovery chatter.
    for (let i = 0; i <= lineSteps(cooldownSeconds + 0.1); i++) {
      const current = model.conversation;
      if (current?.key.startsWith(prefix)) {
        break;
      }
      if (current) {
        model.dismissConversation();
      }
      model.step(0.05, idle);
    }
    const first = model.conversation!;
    expect(first?.key).toBe(`${prefix}:0`);
    expect(first.discoveryFadeEnd).toBeUndefined();
    for (let i = 0; i < lineSteps(2.95); i++) {
      model.step(0.05, idle);
    }
    expect(model.conversation?.key).toBe(first.key);
    model.step(0.05, idle);
    const last = model.conversation!;
    expect(last?.key).toBe(`${prefix}:1`);
    expect(last.discoveryFadeEnd).toBe(3.3);
    for (let i = 0; i < lineSteps(3.2); i++) {
      model.step(0.05, idle);
    }
    const beforeCover = model.conversation!;
    expect(beforeCover.elapsed).toBeCloseTo(3.2, 8);
    model.state.dialogue = { choices: [], context: "test", text: "", title: "" };
    model.step(0.05, idle);
    expect(model.conversation).toBeNull();
    model.state.dialogue = null;
    expect(model.conversation).toEqual(beforeCover);
    model.step(0.05, idle);
    expect(model.conversation?.key).toBe(last.key);
    model.step(0.05, idle);
    expect(model.conversation?.key).not.toBe(last.key);
  });

  it("carry a line's mood: Ada's happy reply to the Stardust lesson", () => {
    const model = flying(["lesson:move", "lesson:aim"]);
    const { player } = model.state.flight!;
    model.state.flight!.objects.push({
      amount: 1,
      hp: 1,
      id: "test:stardust",
      kind: "pickup",
      radius: 4,
      x: player.x + 300,
      y: player.y,
    });
    model.step(0.05, idle);
    expect(model.conversation).toMatchObject({ key: "lesson:stardust:0", mood: "neutral" });
    for (let i = 0, steps = lineSteps(lineDuration(model.conversation!.text)); i < steps; i++) {
      model.step(0.05, idle);
    }
    expect(model.conversation).toMatchObject({
      key: "lesson:stardust:1",
      mood: "happy",
      speaker: "ada",
      text: "Like a magnet!",
    });
  });

  it("show a notice at once ahead of a line, which resumes once the notice clears", () => {
    const model = flying();
    model.step(0.05, idle);
    const key = model.conversation?.key;
    expect(key).toBe("lesson:move:0");
    model.state.flight!.dangerFor = 3;
    model.returnHome();
    // Danger ends at once, so no warning comes over the notice.
    model.state.flight!.dangerFor = 0;
    expect(model.state.notice).toBe(CONTENT.labels.travelUnavailable);
    expect(model.conversation).toBeNull();
    expect(model.noticeOpacity).toBe(1);
    for (let i = 0; i < lineSteps(2); i++) {
      model.step(0.05, idle);
    }
    expect(model.noticeOpacity).toBe(1);
    for (let i = 0; i < lineSteps(0.25); i++) {
      model.step(0.05, idle);
    }
    expect(model.state.notice).toBe(CONTENT.labels.travelUnavailable);
    expect(model.noticeOpacity).toBeCloseTo(0.5, 9);
    expect(model.conversation).toBeNull();
    for (let i = 0; i < lineSteps(0.25); i++) {
      model.step(0.05, idle);
    }
    expect(model.state.notice).toBe("");
    expect(model.noticeOpacity).toBe(0);
    expect(model.conversation?.key).toBe(key);
  });

  it("show a notice over a lore line, which resumes where it was once the notice clears", () => {
    const model = flying(["lesson:move", "lesson:aim", "lesson:stardust", "lesson:dock"]);
    const lore = (key: string | undefined) =>
      CONVERSATIONS.find(({ id }) => key?.startsWith(`${id}:`))?.priority === "lore";
    for (let i = 0; i < 1200 && !lore(model.conversation?.key); i++) {
      model.step(0.05, idle);
    }
    const key = model.conversation?.key;
    expect(lore(key), key).toBe(true);
    model.step(0.05, idle);
    const elapsed = model.conversation!.elapsed;
    model.state.flight!.dangerFor = 3;
    model.returnHome();
    model.state.flight!.dangerFor = 0;
    model.step(0.05, idle);
    expect(model.state.notice).toBe(CONTENT.labels.travelUnavailable);
    expect(model.conversation).toBeNull();
    model.dismissNotice();
    expect(model.conversation?.key).toBe(key);
    expect(model.conversation?.elapsed).toBeCloseTo(elapsed, 9);
  });

  it("dismiss a tapped notice at once, and resume the line under it", () => {
    const model = flying();
    model.step(0.05, idle);
    const key = model.conversation?.key;
    model.state.flight!.dangerFor = 3;
    model.returnHome();
    model.state.flight!.dangerFor = 0;
    model.step(0.05, idle);
    expect(model.state.notice).toBe(CONTENT.labels.travelUnavailable);
    expect(model.conversation).toBeNull();
    model.dismissNotice();
    expect(model.noticeOpacity).toBe(0);
    expect(model.state.notice).toBe("");
    expect(model.conversation?.key).toBe(key);
  });

  it("gives the out-of-ammo notice its full dwell after the shot that emits it", () => {
    const model = flying();
    const flight = model.state.flight!;
    collectWeapon("rapidMissile", flight);
    flight.ammo.rapidMissile = 1;
    model.step(0.05, { ...idle, aim: { x: 0, y: -1 } });
    expect(model.state.notice).toBe(outOfAmmo);

    for (let i = 0; i < lineSteps(2); i++) {
      model.step(0.05, idle);
    }
    expect(model.noticeOpacity).toBe(1);
    model.step(0.05, idle);
    expect(model.noticeOpacity).toBeCloseTo(0.9, 9);
  });

  it("show a warning over a notice, which waits with its time and resumes after", () => {
    const model = flying();
    model.step(0.05, idle);
    expect(model.conversation?.key).toBe("lesson:move:0");
    const flight = model.state.flight!;
    // Far from any friendly place with danger running and the shield low, as in a fight.
    flight.player.x += CONTENT.tuning.exclusionRadius * 3;
    flight.dangerFor = 5;
    // An enemy shot held in the battle square for 5 s keeps the danger running.
    flight.shots.push({
      damage: 1,
      enemy: true,
      hitIds: [],
      id: "held",
      life: 5,
      piercing: false,
      velocity: { x: 0, y: 0 },
      x: flight.player.x,
      y: flight.player.y + 300,
    });
    flight.shield = (model.shieldMax * CONVERSATION_TUNING.shieldLowFraction) / 2;
    // Firing the last missile empties the launcher: "Out of ammo.", an ordinary notice.
    collectWeapon("rapidMissile", flight);
    flight.ammo.rapidMissile = 1;
    model.step(0.05, { ...idle, aim: { x: 0, y: -1 } });
    expect(model.state.notice).toBe(outOfAmmo);
    model.step(0.05, idle);
    expect(model.conversation?.key).toBe("warning:shieldLow:0");
    expect(model.warningShowing).toBe(true);
    for (let i = 0; i < 60; i++) {
      model.step(0.05, idle);
    }
    void model.conversation;
    model.dismissConversation();
    expect(model.warningShowing).toBe(false);
    expect(model.conversation).toBeNull();
    // The warning held the notice at its initial opacity.
    for (let i = 0; i < noticeSteps - 3; i++) {
      model.step(0.05, idle);
    }
    expect(model.state.notice).toBe(outOfAmmo);
    for (let i = 0; i < 3; i++) {
      model.step(0.05, idle);
    }
    expect(model.state.notice).toBe("");
    expect(model.noticeOpacity).toBe(0);
    model.step(0.05, idle);
    expect(model.conversation?.key).toBe("lesson:move:0");
  });

  it("show a press refusal over a warning, which starts once the refusal clears", () => {
    const model = flying();
    model.step(0.05, idle);
    expect(model.conversation?.key).toBe("lesson:move:0");
    const flight = model.state.flight!;
    flight.player.x += CONTENT.tuning.exclusionRadius * 3;
    flight.dangerFor = 5;
    // The held shot outlasts the refusal, so the danger and the warning's trigger hold.
    flight.shots.push({
      damage: 1,
      enemy: true,
      hitIds: [],
      id: "held",
      life: 60,
      piercing: false,
      velocity: { x: 0, y: 0 },
      x: flight.player.x,
      y: flight.player.y + 300,
    });
    flight.shield = (model.shieldMax * CONVERSATION_TUNING.shieldLowFraction) / 2;
    model.returnHome();
    expect(model.state.notice).toBe(CONTENT.labels.travelUnavailable);
    // The shield-low warning waits under the refusal, which runs its full time.
    for (let i = 0; i < noticeSteps - 2; i++) {
      model.step(0.05, idle);
      expect(model.conversation).toBeNull();
      expect(model.warningShowing).toBe(false);
    }
    expect(model.state.notice).toBe(CONTENT.labels.travelUnavailable);
    model.step(0.05, idle);
    model.step(0.05, idle);
    expect(model.state.notice).toBe("");
    model.step(0.05, idle);
    expect(model.conversation?.key).toBe("warning:shieldLow:0");
  });

  it("freeze under a story panel and resume with the flight", () => {
    const model = flying();
    model.step(0.05, idle);
    const before = model.conversation;
    expect(before).not.toBeNull();
    const { elapsed, key } = before!;
    model.state.dialogue = { choices: [], context: "test", text: "", title: "" };
    for (let i = 0; i < 200; i++) {
      model.step(0.05, idle);
    }
    expect(model.conversation).toBeNull();
    model.state.dialogue = null;
    expect(model.conversation).toMatchObject({ elapsed, key });
    for (let i = 0, steps = lineSteps(lineDuration(model.conversation!.text)); i < steps; i++) {
      model.step(0.05, idle);
    }
    expect(model.conversation?.key).not.toBe(key);
  });

  it("dismiss the whole conversation on a tap, so its skipped lines never replay", () => {
    const model = flying(["lesson:move", "lesson:aim"]);
    const { player } = model.state.flight!;
    model.state.flight!.objects.push({
      amount: 1,
      hp: 1,
      id: "test:stardust",
      kind: "pickup",
      radius: 4,
      x: player.x + 300,
      y: player.y,
    });
    model.step(0.05, idle);
    expect(model.conversation?.key).toBe("lesson:stardust:0");
    model.dismissConversation();
    expect(model.conversation).toBeNull();
    expect(model.state.seenConversations).toContain("lesson:stardust");
    for (let i = 0; i < 600; i++) {
      model.step(0.05, idle);
      expect(model.conversation?.key ?? "").not.toMatch(/^lesson:stardust:/u);
    }
  });

  it("save what was heard with story progress and do not repeat it after a reload", () => {
    const model = flying();
    model.step(0.05, idle);
    void model.conversation;
    model.dismissConversation();
    const saved = model.save();
    expect(restoreSave(saved)?.seenConversations).toContain("lesson:move");
    const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, saved);
    resumed.step(0.05, idle);
    expect(resumed.conversation?.key).not.toBe("lesson:move:0");
  });

  it("rejects a malformed seen-conversations list", () => {
    const fresh = JSON.parse(new GameModel(CONTENT, supportEntropy, SAVE_RESTORE).save()) as Record<
      string,
      unknown
    >;
    expect(restoreSave({ ...fresh, seenConversations: [1] })).toBeNull();
  });
});

describe("line pools", () => {
  /** The variant ids a pool shows over plays, each tapped through and its cooldown waited out. */
  function plays(talk: ConversationDirector, count: number, facts: Partial<ConversationFacts>) {
    const ids: string[] = [];
    for (let play = 0; play < count; play++) {
      for (let guard = 0; guard < 1000 && !talk.showing; guard++) {
        run(talk, 0.05, facts);
      }
      ids.push(talk.showing?.conversation.id ?? "");
      tapThrough(talk);
    }
    return ids;
  }

  it("give every repeating trigger a pool of variants on one theme", () => {
    const pools = new Map<string, (typeof CONVERSATIONS)[number][]>();
    for (const conversation of CONVERSATIONS) {
      if (conversation.pool) {
        pools.set(conversation.pool, [...(pools.get(conversation.pool) ?? []), conversation]);
      }
    }
    expect(
      Object.fromEntries([...pools].map(([pool, variants]) => [pool, variants.length])),
    ).toEqual({
      penny: 5,
      "reaction:capital": 3,
      "reaction:disabled": 3,
      "reaction:frigate": 3,
      "reaction:mapped": 4,
      "reaction:return": 3,
      "reaction:station": 4,
      "warning:drones": 5,
      "warning:shieldLow": 4,
    });
    for (const variants of pools.values()) {
      expect(
        new Set(
          variants.map(({ priority, repeat, trigger }) =>
            JSON.stringify([priority, repeat, trigger]),
          ),
        ).size,
      ).toBe(1);
    }
    for (const { lines } of pools.get("warning:shieldLow")!) {
      expect(lines[0]!.text.startsWith("Shield low!")).toBe(true);
    }
    for (const { lines } of pools.get("penny")!) {
      expect(lines[0]).toEqual({ mood: "happy", speaker: "penny", text: "Woof! Woof!" });
    }
  });

  it("draw a pool in a shuffled order, each variant once a shuffle, never one twice in a row", () => {
    // The first shuffle keeps the copy's order; the second would open on the fourth variant, the
    // last one drawn, so it moves to the shuffle's end.
    const values = [0.99, 0.99, 0.99, 0, 0.99, 0.99];
    const random = () => values.shift() ?? 0.99;
    const talk = new ConversationDirector(CONVERSATIONS, [...lessonsHeard, "arrival:1"], random);
    talk.beginFlight(1);
    expect(plays(talk, 8, { newlyMapped: ["landmark"] }).map((id) => id.split(":")[2])).toEqual([
      "1",
      "2",
      "3",
      "4",
      "2",
      "3",
      "1",
      "4",
    ]);
  });

  it("react to each newly mapped place and station, with their own pools", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    expect(plays(talk, 2, { newlyMapped: ["landmark"] })).toEqual([
      "reaction:mapped:1",
      "reaction:mapped:2",
    ]);
    expect(plays(talk, 2, { newStation: true })).toEqual([
      "reaction:station:1",
      "reaction:station:2",
    ]);
  });

  it("greet a return to a mapped station once per station each flight", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    // In range as the flight starts: no return.
    run(talk, 0.05, { stationsNear: ["a"] });
    run(talk, cooldownSeconds);
    expect(talk.showing).toBeNull();
    // Mapped as Ada arrives: the station's own reaction, no return.
    run(talk, 0.05, { newStation: true, stationsDiscovered: ["b"], stationsNear: ["b"] });
    expect(showing(talk)).toBe("reaction:station:0");
    tapThrough(talk);
    run(talk, cooldownSeconds + 0.05);
    run(talk, 0.05, { stationsNear: ["a"] });
    expect(showing(talk)).toBe("return:1:a:0");
    tapThrough(talk);
    run(talk, cooldownSeconds + 0.05);
    run(talk, 0.05, { stationsNear: ["a"] });
    run(talk, 0.05, { stationsNear: ["b"] });
    expect(showing(talk)).toBe("return:1:b:0");
    tapThrough(talk);
    run(talk, cooldownSeconds + 0.05);
    run(talk, cooldownSeconds, { stationsNear: ["a"] });
    expect(talk.showing).toBeNull();
    // A return left before it plays is dropped.
    talk.beginFlight(1);
    run(talk, 0.05);
    run(talk, 0.05, { dronesNear: true, inDanger: true, stationsNear: ["a"] });
    tapThrough(talk);
    run(talk, cooldownSeconds + 0.05);
    expect(talk.showing).toBeNull();
  });

  it("meet the Cobbles, the whale family and the Voron once per save, on their cues", () => {
    const { heard, talk } = director(3, [...lessonsHeard, "arrival:3"]);
    run(talk, 0.05, { encounters: ["familyInSight", "stationNear"] });
    expect(tapThrough(talk)).toEqual([
      "meeting:3:family:0",
      "meeting:3:family:1",
      "meeting:3:family:2",
    ]);
    run(talk, cooldownSeconds + 0.05, { encounters: ["stationNear"] });
    expect(tapThrough(talk)).toEqual(["meeting:3:voron:0", "meeting:3:voron:1"]);
    talk.beginFlight(3);
    run(talk, cooldownSeconds + 0.05, { encounters: ["familyInSight", "stationNear"] });
    expect(talk.showing).toBeNull();
    const cartwheel = director(2, [...lessonsHeard, "arrival:2"]);
    run(cartwheel.talk, 0.05, { encounters: ["hubNear"] });
    expect(showing(cartwheel.talk)).toBe("meeting:2:cobbles:0");
    // Each galaxy's cue names its own people.
    expect(heard).toEqual(expect.arrayContaining(["meeting:3:family", "meeting:3:voron"]));
    const sunflower = director(1, [...lessonsHeard, "arrival:1"]);
    run(sunflower.talk, cooldownSeconds, { encounters: ["hubNear", "stationNear"] });
    expect(sunflower.talk.showing).toBeNull();
  });
});

describe("Use conversation paging", () => {
  const copy = {
    lines: [
      { speaker: "Clover", text: "First" },
      { speaker: "Ada", text: "Last" },
    ],
    party: "Clover",
    topics: [{ label: "Question", lines: [{ speaker: "Clover", text: "Answer" }] }],
  };
  const panel = {
    choices: [
      { id: "take", label: "Accept" },
      { id: "skip", label: "Not now" },
    ],
    context: "grower",
    text: "old",
    title: "Grower",
  };

  it("keeps a pending choice after Skip and never applies an outcome", () => {
    const run = new InteractionConversation();
    run.show(copy, panel);
    expect(run.choices).toEqual([]);
    run.skip();
    expect(run.line?.text).toBe("Last");
    expect(run.choices).toEqual(panel.choices);
    run.skip();
    expect(run.choices).toEqual(panel.choices);
  });

  it("retraces scoped forks and marks only a completed optional thread", () => {
    const run = new InteractionConversation();
    const child = { label: "Nested choice", lines: [{ speaker: "Ada", text: "Nested answer" }] };
    run.show(
      {
        ...copy,
        topics: [{ ...copy.topics[0]!, choices: [child] }],
      },
      panel,
    );
    expect(run.hasPrevious).toBe(false);
    run.advance();
    expect(run.topics.map(({ label }) => label)).toEqual(["Question"]);
    run.topic(0);
    run.advance();
    expect(run.topics).toEqual([child]);
    run.topic(0);
    expect(run.line?.text).toBe("Nested answer");
    run.previous();
    expect(run.topics).toEqual([child]);
    expect(run.completedTopic(0)).toBe(false);
    run.previous();
    expect(run.line?.text).toBe("Answer");
    run.previous();
    expect(run.completedTopic(0)).toBe(false);

    run.topic(0);
    run.advance();
    run.topic(0);
    run.advance();
    expect(run.topics.map(({ label }) => label)).toEqual(["Question"]);
    expect(run.completedTopic(0)).toBe(true);
    run.previous();
    expect(run.line?.text).toBe("Nested answer");
    run.advance();
    expect(run.completedTopic(0)).toBe(true);
    run.leaveTopics();
    expect(run.choices).toEqual(panel.choices);
    run.previous();
    expect(run.completedTopic(0)).toBe(true);
    expect(panel.choices).toHaveLength(2);
  });

  it("retains completion across station screens and clears it on undock or standalone close", () => {
    const run = new InteractionConversation();
    run.setDocked("station:1,2");
    const open = () => {
      run.show(structuredClone(copy), { ...panel });
      run.advance();
    };
    open();
    run.topic(0);
    run.advance();
    expect(run.completedTopic(0)).toBe(true);
    run.hide();
    open();
    expect(run.completedTopic(0)).toBe(true);
    run.setDocked(undefined);
    open();
    expect(run.completedTopic(0)).toBe(false);
    run.topic(0);
    run.advance();
    run.hide();
    open();
    expect(run.completedTopic(0)).toBe(false);
  });

  it("returns from a model fork to its actual preceding page without replaying an applied outcome", () => {
    const run = new InteractionConversation();
    const linear = { ...panel, choices: [{ id: "continue", label: "Continue" }] };
    const intro = { ...copy, topics: [] };
    const fork = { ...panel, context: "fork" };
    run.show(intro, linear);
    run.advance();
    const apply = vi.fn(() => run.show({ ...intro, lines: [intro.lines[0]!] }, fork));
    run.choose("continue", apply);
    expect(run.atChoice).toBe(true);
    run.previous();
    expect(run.line?.text).toBe("Last");
    run.show(intro, fork);
    expect(run.line?.text).toBe("Last");
    run.choose("continue", apply);
    expect(run.atChoice).toBe(true);
    expect(apply).toHaveBeenCalledOnce();
  });

  it("retains pending meaningful choices and leaves their outcome to explicit model selection", () => {
    const run = new InteractionConversation();
    const guarded = {
      ...panel,
      choices: [
        { id: "take", label: "Accept", refused: true },
        { id: "skip", label: "Not now" },
      ],
    };
    const before = structuredClone(guarded);
    run.show(copy, guarded);
    run.skip();
    expect(run.line?.text).toBe("Last");
    for (let press = 0; press < 3; press++) {
      run.advance();
      run.skip();
    }
    expect(run.choices).toEqual(guarded.choices);
    expect(run.atChoice).toBe(true);
    expect(guarded).toEqual(before);
  });

  it("skips optional background without selecting a topic and stops before material outcomes", () => {
    const run = new InteractionConversation();
    const before = structuredClone(panel);
    run.show(copy, panel);
    run.advance();
    expect(run.atChoice).toBe(false);
    run.skip();
    expect(run.line?.text).toBe("Last");
    expect(run.topics).toEqual([]);
    expect(run.choices).toEqual(panel.choices);
    expect(run.atChoice).toBe(true);
    run.skip();
    expect(run.choices).toEqual(panel.choices);
    expect(panel).toEqual(before);
  });

  it("guards an active activity's Continue alternative and drop confirmation as decisions", () => {
    for (const choices of [
      [
        { id: "drop", label: "Drop" },
        { id: "continue", label: "Continue" },
      ],
      [
        { id: "confirmDrop", label: "Drop" },
        { id: "cancel", label: "Cancel" },
      ],
    ]) {
      const run = new InteractionConversation();
      run.show(copy, { ...panel, choices });
      run.skip();
      expect(run.atChoice).toBe(true);
      run.advance();
      run.skip();
      expect(run.choices).toEqual(choices);
    }
  });

  it("treats single action options as material regardless of a Continue display label", () => {
    for (const id of ["take", "deliver", "confirmDrop"]) {
      const run = new InteractionConversation();
      const choices = [{ id, label: "Continue" }];
      run.show(copy, { ...panel, choices });
      run.skip();
      expect(run.atChoice).toBe(true);
      run.skip();
      expect(run.choices).toEqual(choices);
    }
  });

  it("exempts only the canonical Continue action whose current contexts advance text without outcomes", () => {
    const contexts: (readonly [GalaxyNumber, string])[] = Object.entries(CONTENT.chapters).flatMap(
      ([galaxy, chapter]) =>
        Object.keys(chapter.dialogue).map(
          (context) => [Number(galaxy) as GalaxyNumber, context] as const,
        ),
    );
    contexts.push(
      ...["salvage", "deposit", "tow", "deliver", "holodiskHandover"].map(
        (context) => [1, context] as const,
      ),
    );
    for (const [galaxy, context] of contexts) {
      const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
      model.state.unlocked = [galaxy];
      model.startGalaxy(galaxy);
      if (context === "holodiskHandover") {
        model.state.progress[galaxy].holodisk = true;
      }
      const complete = { ...panel, choices: [{ id: "continue", label: "Continue" }], context };
      model.state.dialogue = complete;
      const before = structuredClone({ ...model.state, dialogue: null });
      const run = new InteractionConversation();
      run.show(copy, complete);
      run.skip();
      expect(run.atChoice, `${galaxy}:${context}`).toBe(false);
      model.choose("continue");
      expect({ ...model.state, dialogue: null }, `${galaxy}:${context}`).toEqual(before);
    }
  });

  it("keeps a plain completion available once without applying or inventing an outcome", () => {
    const run = new InteractionConversation();
    const complete = { ...panel, choices: [{ id: "continue", label: "Continue" }] };
    const before = structuredClone(complete);
    run.show(copy, complete);
    run.skip();
    run.advance();
    run.skip();
    expect(run.line?.text).toBe("Last");
    expect(run.choices).toEqual(complete.choices);
    expect(run.atChoice).toBe(false);
    expect(complete).toEqual(before);
    run.reset();
    expect(run.choices).toEqual([]);
    expect(run.topics).toEqual([]);
    expect(run.line).toBeNull();
    expect(run.atOutcome).toBe(false);
  });

  it("preserves the page on render and resets for a new model panel", () => {
    const run = new InteractionConversation();
    run.show(copy, panel);
    run.advance();
    run.leaveTopics();
    run.show(copy, panel);
    expect(run.line?.text).toBe("Last");
    run.show(copy, { ...panel });
    expect(run.line?.text).toBe("First");
  });
});

describe("Use copy resolution", () => {
  const panel = {
    choices: [{ id: "continue", label: "Continue" }],
    context: "holodiskHandover",
    text: "",
    title: "Salvager",
  };
  it("keeps the addressed outpost as party while Ada and Astra speak as themselves", () => {
    const copy = interactionCopy(1, panel);
    expect(copy.party).toBe("Patch");
    expect(copy.lines.map(({ speaker }) => speaker)).toEqual(["Patch", "Ada", "Astra", "Patch"]);
  });
  it("resolves Phantom party, lines and topics by liberation order without changing the actual target", () => {
    const context = {
      galaxy: 6,
      progress: { phantom: { broken: [], flagshipKnown: false, freed: [] as string[] }, stage: 0 },
    };
    const actual = { ...panel, context: "phantom.phantomSettlement3" };
    const before = structuredClone(actual);
    expect(interactionCopy(context, actual)).toEqual(
      INTERACTION_COPY["6.phantom.phantomSettlement1"],
    );
    context.progress.phantom.freed.push("phantomSettlement3", "phantomSettlement2");
    expect(interactionCopy(context, { ...panel, context: "phantom.phantomSettlement1" })).toEqual(
      INTERACTION_COPY["6.phantom.phantomSettlement3"],
    );
    context.progress.phantom.freed.push("phantomSettlement1");
    expect(interactionCopy(context, actual)).toEqual(
      INTERACTION_COPY["6.phantom.phantomSettlement1"],
    );
    expect(actual).toEqual(before);
    expect(context.progress.phantom.freed).toEqual([
      "phantomSettlement3",
      "phantomSettlement2",
      "phantomSettlement1",
    ]);
  });

  it("preserves legacy Phantom copy lookup when liberation facts are not supplied", () => {
    const actual = { ...panel, context: "phantom.phantomSettlement3" };
    expect(interactionCopy(6, actual)).toEqual(INTERACTION_COPY["6.phantom.phantomSettlement3"]);
    expect(interactionCopy({ galaxy: 6, progress: { stage: 0 } }, actual)).toEqual(
      INTERACTION_COPY["6.phantom.phantomSettlement3"],
    );
  });

  it("addresses Astra for flagship salvage while preserving each line and topic speaker", () => {
    const copy = interactionCopy(6, { ...panel, context: "phantom.flagshipSalvage" });
    expect(copy.party).toBe("Astra");
    expect(copy.lines.map(({ speaker }) => speaker)).toEqual(["Astra", "Ada"]);
    expect(copy.topics.map(({ lines }) => lines.map(({ speaker }) => speaker))).toEqual([
      ["Astra"],
      ["Astra"],
    ]);
    expect(interactionCopy(6, { ...panel, context: "phantom.aftermath" }).party).toBe(
      "Admiral Archie",
    );
  });
  it("leaves departure narration unattributed", () => {
    const copy = interactionCopy(3, {
      ...panel,
      context: "reunionDeparture",
      text: "The whale swims off.",
    });
    expect(copy.party).toBe("Marlo");
    expect(copy.lines[0]?.speaker).toBe("");
  });
  it("keeps the two existing family handover panels in order without replaying the exchange", () => {
    const first = interactionCopy(3, { ...panel, context: "holodiskLead" });
    const last = interactionCopy(3, { ...panel, context: "holodiskLeadSong" });
    expect(first.lines.length + last.lines.length).toBe(4);
    expect(first.lines[0]?.text).toBe("You listened when we needed help. Now listen to us.");
    expect(last.lines[0]?.text).toContain("A shining disk");
  });
});
