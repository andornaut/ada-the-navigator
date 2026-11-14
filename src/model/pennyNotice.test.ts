import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import { ConversationDirector, type ConversationFacts, pennyPoints } from "./conversations.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { createFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationsNear } from "./stations.ts";

const facts: ConversationFacts = {
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
  pennyPoints: ["cache:displayed"],
  shieldFraction: 1,
  stardustInSight: false,
  stationsDiscovered: [],
  stationsNear: [],
};

function fixture() {
  const model = new GameModel(CONTENT);
  const flight = createFlight(CONTENT, 1, 7, { known: [] });
  flight.objects = [
    {
      amount: 3,
      hp: 1,
      id: "cache:displayed",
      kind: "pickup",
      radius: 5,
      role: "discovery",
      x: 1450,
      y: 0,
    },
  ];
  Object.assign(model.state, { flight, mode: "space", prologueSeen: true, started: true });
  const talk = new ConversationDirector(
    CONVERSATIONS.filter(({ trigger }) => trigger.kind === "penny"),
    [],
    () => 0.99,
  );
  talk.beginFlight(1);
  Object.assign(model, { talk });
  return { flight, model, talk };
}

describe("Penny's actual presentation acknowledgement", () => {
  it("does not admit scheduled or getter-read notices, then binds the rendered exact ID", () => {
    const { flight, model, talk } = fixture();
    talk.step(0.05, false, facts);
    expect(model.pennyMarkers(GAME_AREA)).toEqual([]);
    const key = model.conversation!.key;
    expect(key).toMatch(/^penny:1:cache:displayed:/);
    expect(model.pennyMarkers(GAME_AREA)).toEqual([]);
    model.pennyNoticeDisplayed("penny:1:another:0");
    expect(model.pennyMarkers(GAME_AREA)).toEqual([]);
    model.pennyNoticeDisplayed(key);
    expect(model.pennyMarkers(GAME_AREA)).toMatchObject([
      { id: "cache:displayed", identified: false, item: "stardust" },
    ]);
    talk.advance();
    talk.advance();
    expect(model.conversation).toBeNull();
    flight.objects.push({
      hp: 1,
      id: "closer",
      kind: "pickup",
      radius: 5,
      role: "discovery",
      x: 500,
      y: 0,
    });
    expect(model.pennyMarkers(GAME_AREA).map(({ id }) => id)).toEqual(["cache:displayed"]);
    expect(model.state.progress[1].known).not.toContain("cache:displayed");
    expect(model.state.achievements.finds).toBe(0);
  });

  it("rejects acknowledgement when another notice covers the conversation", () => {
    const { model, talk } = fixture();
    talk.step(0.05, false, facts);
    const key = model.conversation!.key;
    model.state.notice = "covered";
    model.pennyNoticeDisplayed(key);
    expect(model.pennyMarkers(GAME_AREA)).toEqual([]);
  });

  it("senses the expanded ordinary range across a seam and shares the approved hunt range", () => {
    const { flight } = fixture();
    flight.player = { x: 4900, y: 0 };
    flight.objects[0]!.x = -3600;
    expect(pennyPoints({ known: [], stations: [] }, false, [], flight, 10000)).toEqual([
      "cache:displayed",
    ]);
    expect(pennyPoints({ known: [], stations: [] }, false, [], flight)).toEqual([]);
    expect(JOB_TUNING.hunt.penny).toBe(1500);
  });
});

it("keeps a cache unknown until the actual renderer has lit it, then retains the real item glyph", () => {
  const { flight, model, talk } = fixture();
  talk.step(0.05, false, facts);
  model.pennyNoticeDisplayed(model.conversation!.key);
  flight.player = { x: 1200, y: 0 };
  expect(model.pennyMarkers(GAME_AREA, new Set())).toMatchObject([
    { id: "cache:displayed", identified: false },
  ]);
  expect(model.pennyMarkers(GAME_AREA, new Set(["cache:displayed"]))).toEqual([]);
  flight.player = { x: 0, y: 0 };
  expect(model.pennyMarkers(GAME_AREA, new Set(["cache:displayed"]))).toMatchObject([
    { id: "cache:displayed", identified: true, item: "stardust" },
  ]);
  expect(model.state.progress[1].known).toEqual([]);
});

it("replaces an undiscovered station arrow with the exact displayed question mark, then its real identity", () => {
  const { flight, model, talk } = fixture();
  const site = stationsNear(ECONOMY, 1, 40000, { x: 0, y: 0 })[0]!;
  flight.objects = [{ ...site, hp: 1, kind: "station", radius: ECONOMY.station.radius }];
  flight.player = { x: site.x - 1450, y: site.y };
  talk.step(0.05, false, { ...facts, pennyPoints: [site.id] });
  expect(model.indicatorTargets).toContainEqual({ ...site, kind: "station" });
  model.pennyNoticeDisplayed(model.conversation!.key);
  expect(model.pennyMarkers(GAME_AREA)).toMatchObject([
    { id: site.id, identified: false, symbol: "station" },
  ]);
  expect(model.state.progress[1].stations).not.toContain(site.id);
  model.state.progress[1].stations.push(site.id);
  expect(model.pennyMarkers(GAME_AREA)).toMatchObject([
    { id: site.id, identified: true, symbol: "station" },
  ]);
});
