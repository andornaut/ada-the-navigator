import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { carriedItemName } from "../data/itemNames.ts";
import { questReward } from "../data/questRewards.ts";
import { ensureDestination } from "./flight.ts";
import { GameModel } from "./game.ts";
import { fill } from "./shop.ts";
import type { HeldJob } from "./types.ts";

function modelAt(galaxy: 1 | 2) {
  const model = new GameModel(CONTENT);
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
    expect(model.map!.quests.find((quest) => quest.kind === "story")).toMatchObject({
      destination: "workshop",
    });
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
