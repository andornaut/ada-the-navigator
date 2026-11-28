import { describe, expect, it, vi } from "vitest";

import { SUPPLY_ITEMS } from "../data/activities.ts";
import { CONTENT } from "../data/content.ts";
import { carriedItemName } from "../data/itemNames.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { createUnpopulatedFlight } from "./flight/index.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import type { HeldJob } from "./types.ts";

function model() {
  const game = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  game.state.started = true;
  game.state.mode = "space";
  game.state.selectedGalaxy = 1;
  game.state.progress[1].geography = freshGalaxyGeography(173);
  game.state.flight = createUnpopulatedFlight(CONTENT, 1, 173, game.state.economy, 197);
  Object.assign(game.state.progress[1], { introduced: true, questItem: "food", stage: 1 });
  return game;
}
function job(type: HeldJob["type"] = "delivery"): HeldJob {
  return {
    carrying: type === "delivery",
    id: "same-id",
    item: type === "rescue" ? "a pod" : "seeds",
    kind: "job",
    reward: 17,
    station: "station:0,0",
    target: { id: "workshop", x: 0, y: 0 },
    type,
  };
}

describe("independent Ship carrying and towing facts", () => {
  it("shows story and delivery together with separate live quest links and stable IDs", () => {
    const game = model();
    game.state.tasks[1] = job();
    const old = game.aboard,
      oldQuest = game.aboardQuestId;
    const before = structuredClone(game.state);
    const random = vi.spyOn(crypto, "getRandomValues");
    random.mockClear();
    try {
      expect(game.ship.carrying).toEqual([
        { id: "story-item:1:food", name: "Food", questId: "story:1:1" },
        { id: "job:1:same-id", name: carriedItemName("seeds"), questId: "job:1:same-id" },
      ]);
      expect(game.ship.towing).toBeNull();
      expect(game.ship.carrying).toEqual(game.ship.carrying);
      expect(game.aboard).toEqual(old);
      expect(game.aboardQuestId).toBe(oldQuest);
      expect(game.carrying).toBe(true);
      expect(game.towing).toBe(false);
      expect(game.state).toEqual(before);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });
  it("shows supply-run cargo independently and does not invent a simultaneous station job", () => {
    const game = model(),
      place = Object.keys(SUPPLY_ITEMS)[0]!;
    game.state.tasks[1] = { carrying: true, id: "supplyRun", kind: "activity", place, reward: 17 };
    expect(game.ship.carrying).toEqual([
      { id: "story-item:1:food", name: "Food", questId: "story:1:1" },
      {
        id: "activity:1:supplyRun",
        name: carriedItemName(SUPPLY_ITEMS[place]!),
        questId: "activity:1:supplyRun",
      },
    ]);
    expect(game.ship.carrying.some(({ id }) => id.startsWith("job:"))).toBe(false);
    expect(game.ship.towing).toBeNull();
  });
  it("keeps story cargo visible beside the actual rescue tow without changing HUD priority", () => {
    const game = model();
    game.state.tasks[1] = job("rescue");
    game.state.flight!.tow = { x: 0, y: 0 };
    expect(game.ship.carrying).toEqual([
      { id: "story-item:1:food", name: "Food", questId: "story:1:1" },
    ]);
    expect(game.ship.towing).toEqual({
      id: "job:1:same-id",
      name: carriedItemName("a pod"),
      questId: "job:1:same-id",
    });
    expect(game.aboard).toEqual({ kind: "towing", name: carriedItemName("a pod") });
    expect(game.aboardQuestId).toBe("job:1:same-id");
    expect(game.carrying).toBe(false);
    expect(game.towing).toBe(true);
    delete game.state.flight!.tow;
    expect(game.ship.towing).toBeNull();
  });
  it("updates exact quest links live, ignores other galaxies and returns no facts outside flight", () => {
    const game = model();
    game.state.tasks[2] = job();
    const original = game.ship.carrying[0]!.id;
    game.state.progress[1].stage = 2;
    expect(game.ship.carrying).toEqual([{ id: original, name: "Food", questId: "story:1:2" }]);
    game.state.progress[1].resolved = true;
    expect(game.ship.carrying).toEqual([{ id: original, name: "Food" }]);
    expect(game.ship.towing).toBeNull();
    game.state.mode = "home";
    expect(game.ship.carrying).toEqual([]);
    expect(game.ship.towing).toBeNull();
    expect(game.aboard).toBeNull();
    game.state.mode = "space";
    game.state.flight = null;
    expect(game.ship.carrying).toEqual([]);
    expect(game.ship.towing).toBeNull();
  });
  it("returns detached facts without changing serialized state or fabricating an orphaned tow", () => {
    const game = model();
    game.state.tasks[1] = job();
    const saved = game.save();
    const fact = game.ship.carrying[0]!;
    (fact as { name: string }).name = "changed local view";
    expect(game.ship.carrying[0]!.name).toBe("Food");
    expect(game.save()).toBe(saved);
    delete game.state.tasks[1];
    game.state.flight!.tow = { x: 1, y: 2 };
    expect(game.towing).toBe(true);
    expect(game.ship.towing).toBeNull();
  });
});
