import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { questReward } from "../data/questRewards.ts";
import { completeActivity, validActivity } from "./activities.ts";
import { GameModel } from "./game.ts";
import { type BoardContext, completeJob, stationBoard } from "./jobs.ts";
import { landmarkSites } from "./landmarks.ts";
import { taskQuestDetails } from "./questView.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import type { HeldJob } from "./types.ts";

const context: BoardContext = {
  galaxy: 1,
  hostiles: [],
  outposts: [],
  progress: { charted: [], stations: [] },
};
const view = {
  galaxy: 1 as const,
  jobDescription: () => "Survey",
  label: (key: string) => CONTENT.labels[key]!,
};

describe("saved quest reward boundaries", () => {
  it("keeps saved offered rewards in base units before accepting and paying", () => {
    const game = new GameModel(CONTENT);
    const station = stationsNear(ECONOMY, 1, 20000, { x: 0, y: 0 })[0]!;
    const offered = stationBoard(context, game.state, station);
    expect(offered).toHaveLength(3);
    const restored = restoreSave(game.save())!;
    expect(restored).not.toBeNull();
    expect(restored.jobs).toEqual(game.state.jobs);
    expect(restored.tasks[1]).toBeUndefined();
    expect(restored.economy).toEqual(game.state.economy);
  });

  it("retains legacy supply base and pays its displayed reward once", () => {
    const game = new GameModel(CONTENT);
    const station = stationsNear(ECONOMY, 1, 20000, { x: 0, y: 0 })[0]!;
    game.state.tasks[1] = {
      carrying: true,
      id: "supplyRun",
      kind: "activity",
      place: "growers",
      reward: 45,
      target: station,
    };
    const restored = restoreSave(game.save())!;
    expect(restored).not.toBeNull();
    expect(restored.tasks[1]?.reward).toBe(45);
    expect(taskQuestDetails(view, restored.tasks[1]!).reward).toBe("150 Stardust");
    expect(completeActivity(1, restored)).toBe(150);
    expect(completeActivity(1, restored)).toBe(0);
  });

  it.each([30, 73, 100])(
    "preserves saved base %i and pays its displayed amount only once",
    (base) => {
      const game = new GameModel(CONTENT);
      const task: HeldJob = {
        id: "legacy-survey",
        item: "landmark",
        kind: "job",
        reward: base,
        station: stationsNear(ECONOMY, 1, 20000, { x: 0, y: 0 })[0]!.id,
        target: landmarkSites(1)[0]!,
        type: "survey",
      };
      game.state.tasks[1] = task;
      const balance = game.state.economy.stardust;
      const restored = restoreSave(game.save())!;
      expect(restored).not.toBeNull();
      expect(restored.tasks[1]?.reward).toBe(base);
      expect(restored.economy.stardust).toBe(balance);
      const expected = questReward(base);
      expect(taskQuestDetails(view, restored.tasks[1]!).reward).toBe(`${expected} Stardust`);
      expect(completeJob(context, null, restored)).toBe(expected);
      expect(completeJob(context, null, restored)).toBe(0);
      expect(restored.economy.stardust).toBe(balance);
    },
  );

  it.each([
    [2, "miningContract", "hub", 180],
    [3, "guideCalf", "family", 105],
    [4, "threadNeedle", "elderLoom", 150],
    [5, "courierRun", "pip", 165],
  ] as const)(
    "keeps galaxy %i's accepted activity base valid through save and completion",
    (galaxy, id, place, base) => {
      const game = new GameModel(CONTENT);
      game.state.tasks[galaxy] = {
        id,
        kind: "activity",
        place,
        reward: base,
        ...(id === "miningContract" ? { deposited: 0 } : {}),
        ...(id === "threadNeedle" ? { lit: 0 } : {}),
        ...(id === "guideCalf" || id === "courierRun" ? { start: { x: 100, y: 100 } } : {}),
        ...(id === "courierRun"
          ? {
              courier: { patrolSpawned: false, position: { x: 100, y: 100 } },
              target: { id: "pip", x: 1000, y: 0 },
            }
          : {}),
      };
      const restored = restoreSave(game.save())!;
      expect(restored).not.toBeNull();
      expect(validActivity(galaxy, { ...restored.tasks[galaxy] })).toBe(true);
      expect(restored.tasks[galaxy]?.reward).toBe(base);
      expect(taskQuestDetails({ ...view, galaxy }, restored.tasks[galaxy]!).reward).toBe(
        `${questReward(base)} Stardust`,
      );
      expect(completeActivity(galaxy, restored)).toBe(questReward(base));
      expect(completeActivity(galaxy, restored)).toBe(0);
    },
  );
});
