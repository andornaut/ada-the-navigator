import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { questReward } from "../data/questRewards.ts";
import { restoreSave, SAVE_RESTORE, SAVE_VERSION } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { createFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { landmarkSites } from "./landmarks.ts";
import { stationsNear } from "./stations/index.ts";
import type { HeldJob } from "./types.ts";

function model() {
  const result = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  result.state.mode = "space";
  result.state.selectedGalaxy = 3;
  result.state.flight = createFlight(CONTENT, 3, 123, { known: [] });
  return result;
}
function delivery(): HeldJob {
  return {
    carrying: true,
    id: "shared-id",
    item: "seeds",
    kind: "job",
    reward: 17,
    station: "station:hidden-source",
    target: { id: "station:hidden-target", x: 12345, y: 67890 },
    type: "delivery",
  };
}

describe("current quest tracking", () => {
  it("shares accepted-job eligibility without reading the all-galaxy quest view", () => {
    const game = model();
    const quests = vi.spyOn(game, "quests", "get");
    Object.assign(game.state.progress[3], { introduced: true, stage: 3 });
    game.state.tasks[1] = delivery();
    game.state.tasks[3] = { id: "guideCalf", kind: "activity", place: "family", reward: 29 };
    for (const id of ["story:3:3", "job:1:shared-id", "job:3:offer", "activity:3:guideCalf"]) {
      expect(game.canTrackQuest(id)).toBe(false);
      expect(game.trackQuest(id)).toBe(false);
    }
    game.state.tasks[3] = delivery();
    const id = "job:3:shared-id";
    expect(game.canTrackQuest(id)).toBe(true);
    expect(game.trackQuest(id)).toBe(true);
    expect(game.trackedQuestId).toBe(id);
    expect(
      game.targetMarkers(GAME_AREA).every(({ trackedLabel }) => trackedLabel === undefined),
    ).toBe(true);
    delete game.state.tasks[3];
    expect(game.canTrackQuest(id)).toBe(false);
    expect(game.trackedQuestId).toBe("story:3:3");
    expect(quests).not.toHaveBeenCalled();
  });

  it("restores the same-version selection through Continue and clears it on leaving the flight", () => {
    const game = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    game.state.prologueSeen = true;
    game.startGalaxy(1);
    const station = stationsNear(ECONOMY, 1, 12000, { x: 0, y: 0 })[0]!;
    game.state.tasks[1] = {
      ...delivery(),
      station: station.id,
      target: { id: "workshop", x: 8000, y: 0 },
    };
    const id = "job:1:shared-id";
    const old = game.save();
    expect(restoreSave(old)?.flight?.trackedQuestId).toBeUndefined();
    expect(game.trackQuest(id)).toBe(true);
    const saved = restoreSave(game.save());
    expect(saved?.version).toBe(SAVE_VERSION);
    expect(saved?.flight?.trackedQuestId).toBe(id);
    const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, saved!);
    resumed.continueGame();
    expect(resumed.trackedQuestId).toBe(id);
    resumed.returnHome();
    expect(resumed.state.flight).toBeNull();
    expect(resumed.canTrackQuest(id)).toBe(false);
    expect(resumed.trackedQuestId).toBeNull();
    expect(resumed.state.tasks[1]?.id).toBe("shared-id");
    resumed.startGalaxy(1);
    expect(resumed.state.flight?.trackedQuestId).toBeUndefined();
  });
});

describe("canonical cross-galaxy quest views", () => {
  it("includes all accepted task slots with galaxy-qualified identities and leaves state unchanged", () => {
    const game = model();
    game.state.tasks[1] = delivery();
    game.state.tasks[2] = { ...delivery(), reward: 23 };
    game.state.tasks[3] = { id: "guideCalf", kind: "activity", place: "family", reward: 29 };
    const before = structuredClone(game.state);
    const entries = game.quests;
    expect(entries.map(({ id }) => id)).toEqual([
      "job:1:shared-id",
      "job:2:shared-id",
      "activity:3:guideCalf",
    ]);
    expect(entries.map(({ line }) => line.reward)).toEqual(
      [17, 23, 29].map((amount) =>
        CONTENT.labels.jobReward!.replace("{amount}", String(questReward(amount))),
      ),
    );
    expect(game.state).toEqual(before);
    expect(game.state.selectedGalaxy).toBe(3);
  });

  it("resolves an inactive galaxy's survey through its own canonical landmark catalog", () => {
    const game = model();
    const landmark = landmarkSites(1)[0]!;
    game.state.tasks[1] = {
      ...delivery(),
      carrying: false,
      target: { ...landmark },
      type: "survey",
    };
    const entry = game.quests[0]!;
    expect(entry.galaxy).toBe(1);
    expect(entry.jobType).toBe("survey");
    expect(entry.line.text).toContain(CONTENT.labels[landmark.name]);
    expect(entry.line.description).toContain(CONTENT.labels[landmark.name]);
    expect(game.state.selectedGalaxy).toBe(3);
  });

  it("exposes only known labels and no hidden endpoint identity or coordinates", () => {
    const game = model();
    game.state.tasks[1] = delivery();
    const entry = game.quests[0]!;
    expect(entry.locations).toEqual([]);
    expect(entry.line.source).toBeNull();
    expect(entry.line.destination).toBeNull();
    expect(JSON.stringify(entry)).not.toContain("hidden-source");
    expect(JSON.stringify(entry)).not.toContain("hidden-target");
    expect(JSON.stringify(entry)).not.toContain("12345");
    game.state.progress[1].stations.push("station:hidden-source");
    expect(game.quests[0]!.locations).toEqual([
      { id: "station:hidden-source", label: expect.any(String), symbol: "station" },
    ]);
  });

  it("identifies the actual aboard quest rather than another galaxy's task, with live priority", () => {
    const game = model();
    game.state.selectedGalaxy = 1;
    game.state.flight = createFlight(CONTENT, 1, 123, { known: [] });
    const progress = game.state.progress[1];
    Object.assign(progress, { introduced: true, questItem: "food", stage: 1 });
    game.state.tasks[2] = delivery();
    expect(game.aboardQuestId).toBe("story:1:1");
    game.state.tasks[1] = delivery();
    expect(game.aboardQuestId).toBe("job:1:shared-id");
    delete game.state.tasks[1];
    progress.questItem = null;
    expect(game.aboardQuestId).toBeNull();
    progress.resolved = true;
    expect(game.quests.some(({ id }) => id.startsWith("story:1:"))).toBe(false);
  });
});
