import { describe, expect, it } from "vitest";

import { SUPPLY_ITEMS } from "../data/activities.ts";
import { CONTENT } from "../data/content.ts";
import { carriedItemName } from "../data/itemNames.ts";
import { questReward } from "../data/questRewards.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import {
  completeCartwheelHubIntroductionFixture,
  visitCartwheelHubFixture,
} from "../testing/cartwheelFixture.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { questRoute } from "../ui/questsScreen.ts";
import { ensureDestination } from "./flight.ts";
import { GameModel } from "./game.ts";
import { fill } from "./shop.ts";
import type { HeldJob } from "./types.ts";

function modelAt(galaxy: 1 | 2) {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked = [1, 2, 3];
  model.startGalaxy(galaxy);
  const progress = model.state.progress[galaxy];
  progress.introduced = true;
  progress.stage = 1;
  model.state.flight!.objects = [];
  return model;
}

describe("GameModel map quest detail integration", () => {
  it("uses actual story cargo and hides the endpoint until it is discovered", () => {
    const model = modelAt(1);
    const progress = model.state.progress[1];
    progress.questItem = "food";
    progress.known = ["growers"];
    const flight = model.state.flight!;
    ensureDestination(CONTENT, "growers", flight);
    ensureDestination(CONTENT, "workshop", flight);
    const before = structuredClone(model.state);
    const hidden = model.map!.quests.find((quest) => quest.kind === "story")!;
    expect(hidden).toMatchObject({ destination: null, source: "growers" });
    expect(model.map!.places.some(({ id }) => id === "workshop")).toBe(false);
    expect(model.state).toEqual(before);
    progress.known.push("workshop");
    const story = model.quests.find(({ galaxy, line }) => galaxy === 1 && line.kind === "story")!;
    expect(model.map!.quests.find((quest) => quest.kind === "story")).toMatchObject({
      destination: "workshop",
    });
    expect(model.map!.places.find(({ id }) => id === "workshop")?.questLinks).toEqual([
      { id: story.id, label: story.line.text },
    ]);
    progress.questItem = null;
    const collecting = model.map!.quests.find((quest) => quest.kind === "story")!;
    expect(collecting).not.toEqual(hidden);
    expect(collecting).toMatchObject({
      nextStep: fill(CONTENT.labels.questCollect!, { item: "Food" }),
    });
  });

  it("reads carried job data and the accepted reward without changing the task", () => {
    const model = modelAt(1);
    const task: HeldJob = {
      carrying: false,
      id: "accepted-delivery",
      item: "Toolbox",
      kind: "job",
      reward: 73,
      station: "growers",
      target: { id: "workshop", x: 1000, y: 0 },
      type: "delivery",
    };
    model.state.tasks[1] = task;
    model.state.progress[1].known = ["growers"];
    const before = structuredClone(task);
    expect(model.map!.quests.find((quest) => quest.kind === "job")).toMatchObject({
      destination: null,
      nextStep: fill(CONTENT.labels.questCollect!, { item: carriedItemName(task.item) }),
      reward: fill(CONTENT.labels.jobReward!, { amount: questReward(task.reward) }),
    });
    expect(task).toEqual(before);
    task.carrying = true;
    task.reward += 1;
    model.state.progress[1].known.push(task.target.id);
    expect(model.map!.quests.find((quest) => quest.kind === "job")).toMatchObject({
      destination: task.target.id,
      nextStep: fill(CONTENT.labels.questDeliver!, { item: carriedItemName(task.item) }),
      reward: fill(CONTENT.labels.jobReward!, { amount: questReward(task.reward) }),
    });
  });

  it("names an unmapped delivery destination by its sentence name while its To endpoint stays unlocated", () => {
    const model = modelAt(1);
    model.state.tasks[1] = {
      carrying: false,
      id: "unmapped-delivery",
      item: "a crate of seedling trays",
      kind: "job",
      reward: 50,
      station: "growers",
      target: { id: "workshop", x: 1000, y: 0 },
      type: "delivery",
    };
    model.state.progress[1].known = ["growers"];
    const entry = model.quests.find(({ line }) => line.kind === "job")!;
    expect(entry.line.text).toBe("Deliver a crate of seedling trays to the workshop");
    expect(entry.line.description).toBe(
      "Take a crate of seedling trays to the workshop, where it is needed.",
    );
    const [from, to] = questRoute(entry, model.map!.places);
    expect(from?.location?.id).toBe("growers");
    expect(to).toEqual({ kind: "target", location: null, place: null });
    expect(CONTENT.labels.questExplore).toBe("Explore to locate");
  });

  it("names an unmapped supply source and destination by sentence name; both endpoints stay unlocated", () => {
    const model = modelAt(1);
    model.state.tasks[1] = {
      carrying: true,
      id: "supplyRun",
      kind: "activity",
      place: "workshop",
      reward: 50,
      target: { id: "station:receiver", x: 6000, y: 7000 },
    };
    model.state.progress[1].known = [];
    model.state.progress[1].stations = [];
    const entry = model.quests.find(({ line }) => line.kind === "job")!;
    expect(entry.line.text).toBe(`Carry ${SUPPLY_ITEMS.workshop} to the station.`);
    expect(entry.line.description).toBe(
      `Carry ${SUPPLY_ITEMS.workshop} from the workshop to the station. ` +
        "The station is waiting for these supplies.",
    );
    expect(questRoute(entry, model.map!.places)).toEqual([
      { kind: "source", location: null, place: null },
      { kind: "target", location: null, place: null },
    ]);
  });

  it("names Cartwheel's hub on the map and in the linked quest while keeping its sentence name", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 2] });
    model.state.progress[2].opened = true;
    model.startGalaxy(2);
    const hub = visitCartwheelHubFixture(CONTENT, model);
    completeCartwheelHubIntroductionFixture(model);
    model.state.progress[2].stage = 4;

    const name = CONTENT.chapters[2]!.name;
    const map = model.map!;
    const place = map.places.find(({ id }) => id === hub.id)!;
    const quest = model.quests.find(({ galaxy, line }) => galaxy === 2 && line.kind === "story")!;
    expect(place).toMatchObject({ label: name, objective: true, symbol: "station" });
    expect(quest.locations).toContainEqual({ id: hub.id, label: name, symbol: "station" });
    expect(questRoute(quest, map.places)).toEqual([
      { kind: "target", location: { id: hub.id, label: name, symbol: "station" }, place },
    ]);
    expect(
      model.jobText({
        id: "hub-delivery",
        item: "a parcel",
        reward: 50,
        station: "station:0,0",
        target: { id: hub.id, x: hub.x, y: hub.y },
        type: "delivery",
      }).title,
    ).toBe("Deliver a parcel to the mining hub");
  });

  it("uses current mining cargo and deposits through the public map getter", () => {
    const model = modelAt(2);
    const flight = model.state.flight!;
    const progress = model.state.progress[2];
    progress.deposited = 3;
    flight.cargo = 7;
    expect(model.map!.quests.find((quest) => quest.kind === "story")).toMatchObject({
      nextStep: fill(CONTENT.labels.questDeliver!, {
        item: `${flight.cargo} ${CONTENT.labels.ore}`,
      }),
      progress: fill(CONTENT.labels.questProgress!, {
        current: progress.deposited,
        required: CONTENT.tuning.miningMilestones[0]!,
      }),
    });
    flight.cargo = 0;
    expect(model.map!.quests.find((quest) => quest.kind === "story")).toMatchObject({
      nextStep: fill(CONTENT.labels.questCollect!, { item: CONTENT.labels.ore! }),
    });
  });
});
