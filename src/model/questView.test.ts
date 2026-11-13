import { describe, expect, it } from "vitest";

import { ACTIVITIES } from "../data/activities.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { JOB_REWARDS, JOB_TYPES } from "../data/jobs.ts";
import { localMap, type MapContext, NO_LANDMARKS } from "./map.ts";
import { taskQuestDetails } from "./questView.ts";
import type { HeldJob } from "./types.ts";

const context = {
  galaxy: 1 as const,
  jobDescription: (task: HeldJob) => `approved ${task.type} detail`,
  label: (key: string) => CONTENT.labels[key] ?? "",
};

describe("accepted task quest details", () => {
  for (const type of JOB_TYPES) {
    it(`keeps the saved ${type} payout and the issuing station`, () => {
      const reward = JOB_REWARDS[1]![type === "delivery" ? "deliveryLong" : type]!;
      const task: HeldJob = {
        id: "held",
        item: "cargo",
        kind: "job",
        reward,
        station: "issuer",
        target: { id: "unmapped", x: 1500, y: 3000 },
        type,
      };
      const before = JSON.stringify(task);
      expect(taskQuestDetails(context, task)).toEqual({
        description: `approved ${type} detail`,
        reward: `${reward} Stardust`,
        source: "issuer",
      });
      expect(JSON.stringify(task)).toBe(before);
      expect(taskQuestDetails(context, { ...task, reward: reward * 3 }).reward).toBe(
        `${reward * 3} Stardust`,
      );
    });
  }

  for (const [galaxy, definition] of Object.entries(ACTIVITIES)) {
    it(`uses the canonical ${definition.name} goal and saved reward`, () => {
      const reward = definition.reward ?? JOB_REWARDS[1]!.deliveryShort!;
      const result = taskQuestDetails(
        { ...context, galaxy: Number(galaxy) as 1 | 2 | 3 },
        {
          id: definition.id,
          kind: "activity",
          place: Object.keys(definition.places)[0]!,
          reward,
        },
      );
      expect(result.description).toBe(context.label(definition.goal));
      expect(result.reward).toBe(`${reward} Stardust`);
    });
  }
});

it("passes approved story detail and carried-state progress without inventing currency or places", () => {
  const context = {
    catalog: ECONOMY,
    chunkSize: CONTENT.tuning.chunkSize,
    destinations: [],
    explored: [],
    flight: { facing: { x: 1, y: 0 }, galaxy: 1, objects: [], player: { x: 0, y: 0 } },
    holodisk: null,
    job: null,
    label: (id: string) => id,
    landmarks: NO_LANDMARKS,
    objective: null,
    progress: { known: [], stations: [] },
    quests: {
      job: null,
      story: "existing objective",
      storyComplete: false,
      storyDetails: {
        description: "approved detail",
        nextStep: "Collect cargo",
        progress: "0 / 1",
        source: "unknown-source",
      },
    },
  } satisfies MapContext;
  const result = localMap(context);
  expect(result.quests).toEqual([
    {
      description: "approved detail",
      kind: "story",
      nextStep: "Collect cargo",
      progress: "0 / 1",
      source: "unknown-source",
      target: null,
      text: "existing objective",
    },
  ]);
  expect(result.places).toEqual([]);
  expect(result.quests[0]).not.toHaveProperty("reward");
});
