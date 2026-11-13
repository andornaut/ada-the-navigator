import { describe, expect, it, vi } from "vitest";

import { MINING_CONTRACT_DEPOSITS, SUPPLY_ITEMS } from "../data/activities.ts";
import { CONTENT } from "../data/content.ts";
import { JOB_REWARDS, JOB_TYPES } from "../data/jobs.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { playOpening } from "../testing/launch.ts";
import { questEndpoints } from "../ui/mapScreen.ts";
import { ensureDestination } from "./flight.ts";
import { GameModel } from "./game.ts";
import { landmarkSites } from "./landmarks.ts";
import type { MapPlace } from "./map.ts";
import { type QuestDetailContext, questDetails, type QuestDetailSnapshot } from "./questDetails.ts";
import type { HeldJob, OptionalTask } from "./types.ts";

// Synthetic templates exercise approved keys and token substitution without duplicating copy.
const templates: Readonly<Record<string, string>> = {
  questCollect: "collect:{item}",
  questDeliver: "deliver:{item}",
  questDeliveryDetail: "{item}|{place}",
  questHuntDetail: "{item}",
  questMiningDetail: "{required}",
  questProgress: "{current}/{required}",
  questRescueDetail: "{craft}",
  questSupplyDetail: "{item}|{source}|{destination}",
  questSurveyDetail: "{landmark}",
};
const label = (key: string) => templates[key] ?? CONTENT.labels[key] ?? key;
const context = (galaxy: GalaxyNumber = 1): QuestDetailContext => ({
  galaxy,
  jobText: () => ({ detail: "board-detail", title: "board-title" }),
  label,
  miningMilestones: CONTENT.tuning.miningMilestones,
  placeLabel: (id) => `known:${id}`,
});
function flight() {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  playOpening(model);
  return model;
}
function snapshot(model: GameModel, task?: OptionalTask): QuestDetailSnapshot {
  return {
    flight: model.state.flight!,
    progress: model.state.progress[model.state.flight!.galaxy],
    ...(task ? { task } : {}),
  };
}
function talk(model: GameModel, id: string) {
  const f = model.state.flight!;
  ensureDestination(CONTENT, id, f);
  const at = f.objects.find((object) => object.id === id)!;
  f.player = { x: at.x, y: at.y };
  model.state.progress[1].known.push(id);
  model.state.dialogue = null;
  model.interact();
  model.choose("continue");
}
function job(type: HeldJob["type"]): HeldJob {
  return {
    id: "held",
    item: "seeds",
    kind: "job",
    reward: JOB_REWARDS[1]![type === "delivery" ? "deliveryShort" : type]!,
    station: "station:issuer",
    target: { id: "station:receiver", x: 6000, y: 7000 },
    type,
  };
}

describe("story quest facts", () => {
  it("follows real exchange transitions and lost-cargo collection, with no currency outcome", () => {
    const model = flight();
    const p = model.state.progress[1];
    Object.assign(p, { introduced: true, questItem: null, stage: 1 });
    for (const [source, destination, item, detail] of [
      ["growers", "workshop", "food", "questFoodDetail"],
      ["workshop", "salvagers", "toolkit", "questToolkitDetail"],
      ["salvagers", "workshop", "parts", "questSparePartsDetail"],
    ] as const) {
      const collecting = questDetails(context(), snapshot(model)).storyDetails!;
      expect(collecting.nextStep).toMatch(/^collect:/u);
      expect(collecting.description).toBe(label(detail));
      expect(collecting.progress).toBe("0/1");
      expect(collecting).not.toHaveProperty("reward");
      expect(collecting).not.toHaveProperty("outcome");
      talk(model, source);
      expect(p.questItem).toBe(item);
      const delivering = questDetails(context(), snapshot(model)).storyDetails!;
      expect(delivering.nextStep).toMatch(/^deliver:/u);
      expect(delivering.progress).toBe("1/1");
      expect(delivering.source).toBe(source);
      expect(delivering.destination).toBe(p.known.includes(destination) ? destination : null);
      // Shield depletion or dropping cargo does not change the exchange stage.
      p.questItem = null;
      expect(questDetails(context(), snapshot(model)).storyDetails?.nextStep).toMatch(/^collect:/u);
      p.questItem = item;
      talk(model, destination);
      // The next exchange is already carrying its newly issued cargo.
      if (p.stage < 4) {
        p.questItem = null;
      }
    }
    expect(p.questComplete).toBe(true);
    expect(questDetails(context(), snapshot(model))).not.toHaveProperty("storyDetails");
  });

  it("does not add unapproved details before introduction, after resolution or in other chapters", () => {
    const model = flight();
    const state = snapshot(model);
    expect(questDetails(context(), state)).not.toHaveProperty("storyDetails");
    const progress = { ...state.progress, introduced: true, resolved: true, stage: 1 };
    expect(questDetails(context(), { ...state, progress })).not.toHaveProperty("storyDetails");
    expect(
      questDetails(context(3), { ...state, progress: { ...progress, resolved: false } }),
    ).not.toHaveProperty("storyDetails");
  });

  it("derives mining targets from supplied tuning and uses actual deposits and carried cargo", () => {
    const state = snapshot(flight());
    const milestones = CONTENT.tuning.miningMilestones.map((value) => value * 2);
    for (const [stage, index] of [
      [1, 0],
      [2, 1],
      [4, 2],
    ] as const) {
      const progress = {
        ...state.progress,
        deposited: milestones[index]! - 3,
        introduced: true,
        stage,
      };
      const view = questDetails(
        { ...context(2), miningMilestones: milestones },
        { ...state, progress },
      );
      expect(view.storyDetails?.progress).toBe(`${progress.deposited}/${milestones[index]}`);
      expect(view.storyDetails?.nextStep).toBe(`collect:${label("ore")}`);
      expect(
        questDetails(context(2), { ...state, flight: { cargo: 7 }, progress }).storyDetails
          ?.nextStep,
      ).toBe(`deliver:7 ${label("ore")}`);
      expect(view.storyDetails).not.toHaveProperty("reward");
    }
  });
});

describe("accepted optional task facts", () => {
  for (const type of JOB_TYPES) {
    it(`shows canonical ${type} tokens and the accepted reward without inventing collection`, () => {
      const model = flight();
      const task = job(type);
      if (type === "survey") {
        task.target = landmarkSites(1)[0]!;
      }
      const state = snapshot(model, task);
      const before = JSON.stringify(state);
      const view = questDetails(context(), state).jobDetails!;
      expect(view.reward).toBe(`${task.reward} Stardust`);
      expect(view.description).not.toMatch(/[{}]/u);
      if (type !== "delivery") {
        expect(view).not.toHaveProperty("nextStep");
        expect(view).not.toHaveProperty("source");
        expect(view).not.toHaveProperty("destination");
      }
      expect(
        questDetails(context(), { ...state, task: { ...task, reward: task.reward * 3 } }).jobDetails
          ?.reward,
      ).toBe(`${task.reward * 3} Stardust`);
      expect(JSON.stringify(state)).toBe(before);
    });
  }

  it("does not resolve hidden names and distinguishes collecting from the final delivery", () => {
    const model = flight();
    const task = job("delivery");
    const placeLabel = vi.fn((id: string) => id);
    const collecting = questDetails(
      { ...context(), placeLabel },
      snapshot(model, task),
    ).jobDetails!;
    expect(collecting).toMatchObject({
      destination: null,
      nextStep: "collect:Seeds",
      source: null,
    });
    expect(placeLabel).not.toHaveBeenCalled();
    expect(collecting.description).toBe(`seeds|${label("questExplore")}`);
    model.state.progress[1].stations.push(task.station, task.target.id);
    const delivering = questDetails(
      context(),
      snapshot(model, { ...task, carrying: true }),
    ).jobDetails!;
    expect(delivering).toMatchObject({
      destination: task.target.id,
      nextStep: "deliver:Seeds",
      source: task.station,
    });
  });

  it("uses supply item/source/destination and saved pay, including a replacement collection", () => {
    const model = flight();
    const task = {
      carrying: true,
      id: "supplyRun",
      kind: "activity",
      place: "workshop",
      reward: JOB_REWARDS[1]!.deliveryLong!,
      target: { id: "station:receiver", x: 6000, y: 7000 },
    } as const;
    model.state.progress[1].known.push(task.place);
    const view = questDetails(context(), snapshot(model, task)).jobDetails!;
    expect(view.description).toBe(
      `${SUPPLY_ITEMS[task.place]}|known:${task.place}|${label("questExplore")}`,
    );
    expect(view.reward).toBe(`${task.reward} Stardust`);
    expect(view.destination).toBeNull();
    expect(view.nextStep).toBe("deliver:Repaired tools");
    expect(
      questDetails(context(), snapshot(model, { ...task, carrying: false })).jobDetails?.nextStep,
    ).toBe("collect:Repaired tools");
  });

  it("counts mining deposits since acceptance, independently of story deposits", () => {
    const model = flight();
    model.state.progress[1].deposited = MINING_CONTRACT_DEPOSITS * 4;
    const task = {
      deposited: 7,
      id: "miningContract",
      kind: "activity",
      place: "hub",
      reward: 173,
    } as const;
    const view = questDetails(context(2), snapshot(model, task)).jobDetails!;
    expect(view.progress).toBe(`${task.deposited}/${MINING_CONTRACT_DEPOSITS}`);
    expect(view.description).toBe(String(MINING_CONTRACT_DEPOSITS));
    expect(view.reward).toBe(`${task.reward} Stardust`);
  });

  it("changes the calf step only with actual following state", () => {
    const state = snapshot(flight(), {
      id: "guideCalf",
      kind: "activity",
      place: "family",
      reward: 197,
    });
    expect(questDetails(context(3), state).jobDetails?.nextStep).toBe(label("calfFind"));
    expect(
      questDetails(context(3), { ...state, flight: { calf: { following: true }, cargo: 0 } })
        .jobDetails?.nextStep,
    ).toBe(label("calfGuide"));
  });
});

it("keeps explicit destination null unknown instead of falling back to the pickup target", () => {
  const source: MapPlace = {
    id: "source",
    job: false,
    kind: "station",
    label: "Source",
    objective: false,
    symbol: "station",
    travel: true,
    x: 0,
    y: 0,
  };
  const line = { kind: "story", source: source.id, target: source.id, text: "objective" } as const;
  expect(questEndpoints([source], { ...line, destination: null })[1]?.place).toBeNull();
  expect(questEndpoints([source], line)[1]?.place).toBe(source);
  const destination = { ...source, id: "destination", label: "Destination" };
  expect(
    questEndpoints([source, destination], { ...line, destination: destination.id })[1]?.place,
  ).toBe(destination);
});

describe("rescue description articles", () => {
  it.each([
    ["a drifting lamp buoy", "drifting lamp buoy"],
    ["An old craft", "old craft"],
    ["anemone craft", "anemone craft"],
    ["another craft", "another craft"],
    ["The survey craft", "The survey craft"],
  ])("normalizes only the description token for %s", (item, expected) => {
    const model = flight();
    const task = { ...job("rescue"), item };
    const before = structuredClone(task);
    const details = questDetails(context(), { ...snapshot(model), task });
    expect(details.jobDetails?.description).toBe(expected);
    expect(task).toEqual(before);
  });
});

describe("actual named quest requirements", () => {
  it("distinguishes currently aboard food from completed deliveries and lost later cargo", () => {
    const model = flight();
    const progress = model.state.progress[1];
    Object.assign(progress, { introduced: true, questItem: "food", stage: 1 });
    expect(questDetails(context(), snapshot(model)).storyDetails?.requirements).toEqual([
      { checked: true, label: label("questFoodAboard") },
    ]);
    Object.assign(progress, { questItem: "toolkit", stage: 2 });
    expect(questDetails(context(), snapshot(model)).storyDetails?.requirements).toEqual([
      { checked: true, label: label("questFoodDelivered") },
      { checked: false, label: label("questToolkitDelivered") },
    ]);
    Object.assign(progress, { questItem: null, stage: 3 });
    const details = questDetails(context(), snapshot(model)).storyDetails!;
    expect(details.requirements).toEqual([
      { checked: true, label: label("questFoodDelivered") },
      { checked: true, label: label("questToolkitDelivered") },
      { checked: false, label: label("questSparePartsAboard") },
    ]);
    progress.questItem = "parts";
    expect(
      questDetails(context(), snapshot(model)).storyDetails?.requirements?.at(-1)?.checked,
    ).toBe(true);
  });

  it("checks a rescue only from the actual tow attachment, not carrying flags or title text", () => {
    const model = flight();
    const task = { ...job("rescue"), carrying: true };
    const state = { ...snapshot(model), task };
    expect(questDetails(context(), state).jobDetails?.requirements).toEqual([
      { checked: false, label: label("questTowLineAttached") },
    ]);
    expect(
      questDetails(context(), { ...state, flight: { ...state.flight, tow: { x: 1, y: 2 } } })
        .jobDetails?.requirements,
    ).toEqual([{ checked: true, label: label("questTowLineAttached") }]);
  });

  it("uses deposited counts and the canonical mining goal instead of current cargo", () => {
    const model = flight();
    model.state.selectedGalaxy = 2;
    const progress = model.state.progress[2];
    Object.assign(progress, { deposited: 2, introduced: true, stage: 1 });
    const details = questDetails(context(2), { flight: { cargo: 99 }, progress });
    expect(details.storyDetails?.requirements).toEqual([
      { count: `2/${CONTENT.tuning.miningMilestones[0]}`, label: label("questOreDeposited") },
    ]);
  });
});
