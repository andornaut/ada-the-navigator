import { describe, expect, it } from "vitest";

import { CONVERSATION_TUNING, CONVERSATIONS } from "../data/conversations.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import {
  ConversationDirector,
  type ConversationFacts,
  pennyInstance,
  pennyPoints,
  speakerName,
} from "./conversations.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { playOpening } from "./test-launch.ts";
import type { SpaceObject } from "./types.ts";

const { cooldownSeconds, lineSeconds, pennyRange, quietSeconds } = CONVERSATION_TUNING;

const calm: ConversationFacts = {
  aimed: false,
  capitalInSight: false,
  collectedStardust: false,
  docked: false,
  inDanger: false,
  moved: false,
  newStation: false,
  newlyMapped: [],
  pennyPoints: [],
  shieldFraction: 1,
  stardustInSight: false,
};

/** A director in sector whose saved list already holds seen. */
function director(sector: SectorId, seen: string[] = [], done = {}) {
  const heard = [...seen];
  const talk = new ConversationDirector(CONVERSATIONS, heard);
  talk.beginFlight(sector, done);
  return { heard, talk };
}
/** Steps in slices of at most 0.05 s, as the scene does. */
function run(talk: ConversationDirector, seconds: number, facts: Partial<ConversationFacts> = {}) {
  for (let left = seconds; left > 1e-9; left -= 0.05) {
    talk.step(Math.min(0.05, left), false, { ...calm, ...facts });
  }
}
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

describe("conversation schedule", () => {
  it("shows each line for its time or until tapped, and the last tap closes", () => {
    const { talk } = director(1, lessonsHeard);
    run(talk, 0.05);
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, lineSeconds - 0.1);
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
    run(talk, cooldownSeconds - 0.1);
    expect(talk.showing).toBeNull();
    run(talk, 0.15);
    expect(showing(talk)).toBe("reaction:capital:0");
  });

  it("orders waiting conversations warning, Penny, lesson, lore", () => {
    const { talk } = director(1, ["lesson:move", "lesson:aim", "lesson:dock", "arrival:1"]);
    run(talk, 0.05, {
      newlyMapped: ["growers"],
      pennyPoints: ["cache"],
      stardustInSight: true,
    });
    expect(showing(talk)).toBe(`${pennyInstance(1, "cache")}:0`);
    tapThrough(talk);
    run(talk, cooldownSeconds + 0.05, { pennyPoints: ["cache"], stardustInSight: true });
    expect(showing(talk)).toBe("lesson:stardust:0");
    tapThrough(talk);
    run(talk, cooldownSeconds + 0.05);
    expect(talk.showing?.conversation.priority).toBe("lore");
  });

  it("lets a warning skip the cooldown and replace an ordinary conversation", () => {
    const { talk } = director(1, lessonsHeard);
    run(talk, 0.05);
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, 0.05, { inDanger: true });
    expect(showing(talk)).toBe("warning:drones:0");
    tapThrough(talk);
    run(talk, 1, { inDanger: true, shieldFraction: 0.2 });
    expect(showing(talk)).toBe("warning:shieldLow:0");
  });

  it("holds a line under a notice, then resumes it where it was and the queue after it", () => {
    const { talk } = director(1, lessonsHeard);
    run(talk, lineSeconds - 0.5, { capitalInSight: true });
    expect(showing(talk)).toBe("arrival:1:0");
    for (let i = 0; i < 400; i++) {
      talk.step(0.05, true, { ...calm, inDanger: i > 200 });
    }
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, 0.4);
    expect(showing(talk)).toBe("arrival:1:0");
    run(talk, 0.15);
    expect(showing(talk)).toBe("arrival:1:1");
  });
});

describe("conversation triggers", () => {
  it("teach moving at the first flight's start, then aiming", () => {
    const { talk } = director(1);
    run(talk, 0.05);
    expect(showing(talk)).toBe("lesson:move:0");
    expect(talk.showing?.line).toEqual({
      desktop: "Use WASD to fly.",
      speaker: "astra",
      text: "Use the left stick to fly.",
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
    const seen = ["lesson:move", "lesson:aim", "arrival:1", "reaction:mapped"];
    const fresh = director(1, seen);
    run(fresh.talk, 0.05, { newStation: true });
    expect(showing(fresh.talk)).toBe("lesson:dock:0");
    const docked = director(1, seen);
    run(docked.talk, 0.05, { docked: true, newStation: true });
    expect(docked.talk.showing).toBeNull();
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

  it("meet each alien group and react to a new place once", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { newlyMapped: ["workshop"] });
    const lines = [tapThrough(talk)];
    run(talk, cooldownSeconds + 0.05);
    lines.push(tapThrough(talk));
    expect(lines.flat().map((line) => line.replace(/:\d+$/u, ""))).toEqual([
      "meeting:1:workshop",
      "meeting:1:workshop",
      "reaction:mapped",
      "reaction:mapped",
    ]);
    run(talk, cooldownSeconds + 0.05, { newStation: true, newlyMapped: ["growers"] });
    expect(showing(talk)).toBe("meeting:1:growers:0");
  });

  it("react to a capital ship once", () => {
    const { heard, talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { capitalInSight: true });
    expect(showing(talk)).toBe("reaction:capital:0");
    tapThrough(talk);
    run(talk, cooldownSeconds + 1, { capitalInSight: true });
    expect(talk.showing).toBeNull();
    expect(heard).toContain("reaction:capital");
  });

  it("warn of a low shield once per fight, at a quarter or less", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { inDanger: true });
    tapThrough(talk);
    run(talk, 0.5, { inDanger: true, shieldFraction: 0.26 });
    expect(talk.showing).toBeNull();
    run(talk, 0.05, { inDanger: true, shieldFraction: 0.25 });
    expect(showing(talk)).toBe("warning:shieldLow:0");
    tapThrough(talk);
    run(talk, 1, { inDanger: true, shieldFraction: 0.1 });
    expect(talk.showing).toBeNull();
    run(talk, 0.05);
    run(talk, 0.05, { inDanger: true, shieldFraction: 0.1 });
    expect(showing(talk)).toBe("warning:shieldLow:0");
  });

  it("call out drones once per flight", () => {
    const { talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { inDanger: true });
    expect(showing(talk)).toBe("warning:drones:0");
    tapThrough(talk);
    run(talk, 0.05);
    run(talk, 0.05, { inDanger: true });
    expect(talk.showing).toBeNull();
    talk.beginFlight(1);
    run(talk, 0.05, { inDanger: true });
    expect(showing(talk)).toBe("warning:drones:0");
  });

  it("broadcast the General when his drones first engage Ada from Cartwheel on", () => {
    const sunflower = director(1, [...lessonsHeard, "arrival:1"]);
    run(sunflower.talk, 0.05, { inDanger: true });
    expect(showing(sunflower.talk)).toBe("warning:drones:0");
    for (const sector of [2, 3] as const) {
      const { heard, talk } = director(sector, lessonsHeard);
      run(talk, 0.05, { inDanger: true });
      expect(tapThrough(talk)).toEqual([`general:${sector}:0`, `general:${sector}:1`]);
      expect(heard).toContain(`general:${sector}`);
      run(talk, 0.05);
      run(talk, 0.05, { inDanger: true });
      expect(showing(talk)).toBe("warning:drones:0");
    }
  });

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

  it("let Penny sense each point of interest once, while it is still near", () => {
    const { heard, talk } = director(1, [...lessonsHeard, "arrival:1"]);
    run(talk, 0.05, { pennyPoints: ["a"] });
    expect(tapThrough(talk)).toEqual(["penny:1:a:0", "penny:1:a:1"]);
    run(talk, cooldownSeconds + 0.05, { pennyPoints: ["a", "b"] });
    expect(showing(talk)).toBe("penny:1:b:0");
    expect(heard).toEqual(expect.arrayContaining(["penny:1:a", "penny:1:b"]));
    tapThrough(talk);
    // A point found before Penny could speak is not sensed.
    run(talk, 1, { pennyPoints: ["c"] });
    run(talk, cooldownSeconds);
    expect(talk.showing).toBeNull();
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
    expect(pennyPoints({ known: ["growers"], stations: [] }, false, flight)).toEqual([
      "station:1:0",
      "cache",
      "workshop",
    ]);
  });

  it("include the guarded holodisk only while its waypoint shows", () => {
    expect(pennyPoints({ known: ["growers"], stations: ["station:1:0"] }, true, flight)).toEqual([
      "cache",
      "holodisk",
      "workshop",
    ]);
  });
});

describe("the General's name tab", () => {
  it("reads Unknown voice until the Whirlpool holodisk is inserted", () => {
    const progress = { 1: { holodisk: true }, 2: { holodisk: true }, 3: { holodisk: false } };
    expect(speakerName(progress, "general")).toBe("Unknown voice");
    expect(speakerName({ ...progress, 3: { holodisk: true } }, "general")).toBe("General Gadget");
    expect(speakerName(progress, "astra")).toBe("Astra");
  });
});

describe("conversations in the game", () => {
  /**
   * Galaxy one's first flight with no drones and nothing for Penny near the start, so neither a
   * warning nor Penny comes before the first lesson.
   */
  function flying(): GameModel {
    const model = new GameModel(PROTOTYPE);
    model.state.prologueSeen = true;
    model.startSector(1);
    playOpening(model);
    expect(model.state.mode).toBe("space");
    const flight = model.state.flight!;
    const quiet = (object: SpaceObject) =>
      object.kind !== "enemy" && object.kind !== "station" && object.role !== "discovery";
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

  it("show the touch and desktop wording with the speaker's name tab and side", () => {
    const model = flying();
    model.step(0.05, idle);
    expect(model.conversation).toMatchObject({
      desktop: "Use WASD to fly.",
      name: "Astra",
      side: "right",
      speaker: "astra",
      text: "Use the left stick to fly.",
    });
  });

  it("show a notice at once ahead of a line, which resumes once the notice clears", () => {
    const model = flying();
    model.step(0.05, idle);
    const key = model.conversation?.key;
    expect(key).toBe("lesson:move:0");
    model.state.flight!.dangerFor = 3;
    model.returnHome();
    expect(model.state.notice).toBe(PROTOTYPE.labels.travelUnavailable);
    expect(model.conversation).toBeNull();
    for (let i = 0; i < 98; i++) {
      model.step(0.05, idle);
    }
    expect(model.state.notice).toBe(PROTOTYPE.labels.travelUnavailable);
    expect(model.conversation).toBeNull();
    model.step(0.05, idle);
    model.step(0.05, idle);
    expect(model.state.notice).toBe("");
    expect(model.conversation?.key).toBe(key);
  });

  it("hold the box under the save status until saving works again", () => {
    const model = flying();
    model.step(0.05, idle);
    const key = model.conversation?.key;
    model.setSaveNotice(PROTOTYPE.labels.savingUnavailable ?? "");
    for (let i = 0; i < 200; i++) {
      model.step(0.05, idle);
    }
    expect(model.conversation).toBeNull();
    model.setSaveNotice("");
    expect(model.conversation?.key).toBe(key);
  });

  it("freeze under a story panel and resume with the flight", () => {
    const model = flying();
    model.step(0.05, idle);
    const key = model.conversation?.key;
    model.state.dialogue = { choices: [], context: "test", text: "", title: "" };
    for (let i = 0; i < 200; i++) {
      model.step(0.05, idle);
    }
    expect(model.conversation?.key).toBe(key);
    model.state.dialogue = null;
    for (let i = 0; i < 120; i++) {
      model.step(0.05, idle);
    }
    expect(model.conversation?.key).not.toBe(key);
  });

  it("save what was heard with story progress and do not repeat it after a reload", () => {
    const model = flying();
    model.step(0.05, idle);
    model.advanceConversation();
    const saved = model.save();
    expect(restoreSave(saved)?.seenConversations).toContain("lesson:move");
    const resumed = new GameModel(PROTOTYPE, saved);
    resumed.step(0.05, idle);
    expect(resumed.conversation?.key).not.toBe("lesson:move:0");
  });

  it("count what an earlier save already played as heard", () => {
    const model = flying();
    Object.assign(model.state.progress[1], { introduced: true, known: ["growers"], stage: 1 });
    const state = JSON.parse(model.save()) as Record<string, unknown>;
    delete state.seenConversations;
    expect(restoreSave(state)?.seenConversations).toEqual([
      "lesson:move",
      "lesson:aim",
      "lesson:stardust",
      "lesson:dock",
      "reaction:mapped",
      "arrival:1",
      "meeting:1:growers",
    ]);
    const fresh = JSON.parse(new GameModel(PROTOTYPE).save()) as Record<string, unknown>;
    delete fresh.seenConversations;
    expect(restoreSave(fresh)?.seenConversations).toEqual([]);
    expect(restoreSave({ ...fresh, seenConversations: [1] })).toBeNull();
  });
});
