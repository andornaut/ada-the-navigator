import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS, PENNY_FIND_RANGE } from "../data/achievements.ts";
import { ECONOMY } from "../data/economy.ts";
import { PROJECTS } from "../data/projects.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { boardAndJump, playOpening, readStory } from "../testing/launch.ts";
import {
  ACHIEVEMENT_TOTALS,
  achievementProgress,
  type AchievementTotals,
  newAchievements,
  reachSensed,
  recordAchievement,
  recordSensed,
  unlockAchievements,
} from "./achievements.ts";
import { GameModel, newGameState } from "./game.ts";
import { landmarkSites } from "./landmarks.ts";
import { restoreSave } from "./save.ts";
import type { FlightInput } from "./types.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

/** quests.md's tables, each as its data rows of trimmed cells. */
function tables(text: string): string[][][] {
  const found: string[][][] = [];
  let table: string[][] | undefined;
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) {
      table = undefined;
      continue;
    }
    if (!table) {
      table = [];
      found.push(table);
    }
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (!cells.every((cell) => /^:?-+:?$/.test(cell))) {
      table.push(cells);
    }
  }
  return found.map((rows) => rows.slice(1));
}
const quests = readFileSync(new URL("../../gameplay/quests.md", import.meta.url), "utf8");
// The Achievements section's tables: the list, the counts and the strings.
const [table, counts, keys] = tables(quests.slice(quests.indexOf("## Achievements")));
// Steady Hands and Truth Teller wait for the Needle and Andromeda chapters.
const UNBUILT = ["Steady Hands", "Truth Teller"];
const list = table!.filter(([name]) => !UNBUILT.includes(name!));
const id = (name: string) => ACHIEVEMENTS.find((achievement) => achievement.name === name)!.id;
const unlocked = (model: GameModel) => model.state.achievements.unlocked;
const view = (model: GameModel, name: string) =>
  model.achievements.find((entry) => entry.name === name)!;
/** A model in galaxy one's first flight, the prologue read. */
function launched(): GameModel {
  const model = new GameModel(PROTOTYPE);
  model.start();
  boardAndJump(model, 1);
  expect(model.state.mode).toBe("space");
  return model;
}
/** Steps until a notice shows or a second passes, returning it. */
function nextNotice(model: GameModel): string {
  for (let step = 0; step < 60 && !model.state.notice; step++) {
    model.step(1 / 60, idle);
  }
  return model.state.notice;
}

describe("Gameplay's achievements", () => {
  it("lists the 14 built achievements with their conditions in table order", () => {
    expect(ACHIEVEMENTS.map(({ condition, name }) => [name, condition])).toEqual(list);
    expect(ACHIEVEMENTS).toHaveLength(14);
    expect(table).toHaveLength(16);
  });

  it("counts exactly the achievements the counts table names", () => {
    expect(ACHIEVEMENTS.filter(({ counted }) => counted).map(({ name }) => name)).toEqual(
      counts!.map(([name]) => name),
    );
  });

  it("uses Gameplay's strings for the card, notice and count", () => {
    for (const [key, text] of keys!) {
      expect(PROTOTYPE.labels[key!.replaceAll("`", "")]).toBe(text);
    }
  });
});

describe("story achievements", () => {
  it("unlocks New Navigator as the prologue ends and announces it in flight", () => {
    const model = launched();
    expect(unlocked(model)).toEqual([id("New Navigator")]);
    expect(nextNotice(model)).toBe("Achievement: New Navigator");
  });

  it("unlocks The Garden Begins when the Sunflower chapter completes", () => {
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    playOpening(model);
    Object.assign(model.state.progress[1], {
      discoveries: 3,
      holodisk: true,
      introduced: true,
      known: ["growers", "workshop", "salvagers"],
      opened: true,
      questComplete: true,
      questItem: null,
      resolved: false,
      stage: 4,
    });
    model.returnHome();
    expect(unlocked(model)).not.toContain(id("The Garden Begins"));
    readStory(model);
    expect(model.state.progress[1].resolved).toBe(true);
    expect(unlocked(model)).toContain(id("The Garden Begins"));
    expect(unlocked(model)).not.toContain(id("Room for Everyone"));
  });
});

describe("Penny finds", () => {
  it("counts a sensed point once Ada comes within 160, once per point", () => {
    const state = newAchievements();
    recordSensed(state, ["penny:1:cache", "penny:2:hub"]);
    const points = [{ id: "cache", x: PENNY_FIND_RANGE + 1, y: 0 }];
    reachSensed(PENNY_FIND_RANGE, 1, points, { x: 0, y: 0 }, state);
    expect(state.found).toEqual([]);
    reachSensed(PENNY_FIND_RANGE, 1, points, { x: 1, y: 0 }, state);
    expect(state.found).toEqual(["penny:1:cache"]);
    expect(state.finds).toBe(1);
    // Another galaxy's point waits for its own flight; a found point is not sensed again.
    expect(state.sensed).toEqual(["penny:2:hub"]);
    recordSensed(state, ["penny:1:cache"]);
    expect(state.sensed).toEqual(["penny:2:hub"]);
    reachSensed(PENNY_FIND_RANGE, 1, points, { x: 1, y: 0 }, state);
    expect(state.finds).toBe(1);
  });

  it("unlocks Good Nose at the tenth find", () => {
    const state = newAchievements();
    state.finds = 9;
    const game = newGameState();
    expect(unlockAchievements(ACHIEVEMENTS, ACHIEVEMENT_TOTALS, state, game)).toEqual([]);
    state.finds = 10;
    expect(unlockAchievements(ACHIEVEMENTS, ACHIEVEMENT_TOTALS, state, game)).toEqual([
      ACHIEVEMENTS.find(({ name }) => name === "Good Nose"),
    ]);
  });

  it("counts a sensed cache that Ada collects in the same step", () => {
    const model = launched();
    const flight = model.state.flight!;
    flight.objects.push({
      amount: ECONOMY.discoveryStardust,
      hp: 1,
      id: "sensed-cache",
      kind: "pickup",
      radius: PROTOTYPE.tuning.flight.pickupRadius,
      role: "discovery",
      x: flight.player.x + 5,
      y: flight.player.y,
    });
    model.state.achievements.sensed.push("penny:1:sensed-cache");
    model.step(1 / 60, idle);
    expect(flight.objects.some(({ id: object }) => object === "sensed-cache")).toBe(false);
    expect(model.state.achievements.found).toEqual(["penny:1:sensed-cache"]);
    expect(view(model, "Good Nose").progress).toEqual({ have: 1, need: 10 });
  });
});

describe("collections and helping", () => {
  it("counts paints owned with Classic and unlocks Full Palette once every paint is owned", () => {
    const model = new GameModel(PROTOTYPE);
    expect(view(model, "Full Palette").progress).toEqual({
      have: 1,
      need: Object.keys(ECONOMY.paints).length,
    });
    model.state.economy.paints = Object.keys(ECONOMY.paints);
    model.recordAchievement({ kind: "jobCompleted" });
    expect(unlocked(model)).toContain(id("Full Palette"));
    expect(view(model, "Full Palette").progress).toBeUndefined();
  });

  it("unlocks Helping Hand at the first job and Good Neighbor at 25 jobs or activities", () => {
    const model = new GameModel(PROTOTYPE);
    expect(view(model, "Good Neighbor").progress).toEqual({ have: 0, need: 25 });
    model.recordAchievement({ kind: "jobCompleted" });
    expect(unlocked(model)).toEqual([id("Helping Hand")]);
    for (let n = 0; n < 23; n++) {
      model.recordAchievement({ kind: "activityCompleted" });
    }
    expect(view(model, "Good Neighbor").progress).toEqual({ have: 24, need: 25 });
    model.recordAchievement({ kind: "activityCompleted" });
    expect(unlocked(model)).toContain(id("Good Neighbor"));
  });

  it("unlocks Blockade Breaker when Black Eye's blockade breaks", () => {
    const model = new GameModel(PROTOTYPE);
    model.recordAchievement({ kind: "blockadeBroken" });
    expect(unlocked(model)).toEqual([id("Blockade Breaker")]);
  });

  it("counts landmarks and projects toward the game's own totals", () => {
    expect(ACHIEVEMENT_TOTALS).toEqual({
      allies: 0,
      // Placeholders have no landmarks.
      landmarks: { 1: 12, 2: 12, 3: 12, 4: 0, 5: 0, 6: 0 },
      paints: Object.keys(ECONOMY.paints).length,
      projects: Object.values(PROJECTS).flat().length,
    });
    const model = new GameModel(PROTOTYPE);
    for (const site of landmarkSites(2).slice(0, 3)) {
      model.recordAchievement({ galaxy: 2, id: site.id, kind: "landmarkCharted" });
    }
    model.recordAchievement({ id: PROJECTS[1]![0]!.id, kind: "projectFunded" });
    expect(view(model, "Cartographer").progress).toEqual({ have: 3, need: 12 });
    expect(view(model, "Community Builder").progress).toEqual({
      have: 1,
      need: ACHIEVEMENT_TOTALS.projects,
    });
    expect(unlocked(model)).toEqual([id("Good Cause")]);
    for (const site of landmarkSites(2).slice(3)) {
      model.recordAchievement({ galaxy: 2, id: site.id, kind: "landmarkCharted" });
    }
    expect(unlocked(model)).toContain(id("Cartographer"));
  });

  it("keeps the allies and four-galaxy achievements locked and uncounted until they exist", () => {
    const model = new GameModel(PROTOTYPE);
    model.recordAchievement({ id: "growers", kind: "allyMade" });
    for (const sector of [1, 2, 3] as const) {
      for (const site of landmarkSites(sector)) {
        model.recordAchievement({ galaxy: sector, id: site.id, kind: "landmarkCharted" });
      }
    }
    for (const name of ["Astra's Atlas", "Friends Everywhere"]) {
      expect(view(model, name)).toMatchObject({ unlocked: false });
      expect(view(model, name).progress).toBeUndefined();
    }
  });

  it("counts charting, allies and projects toward the totals their systems supply", () => {
    const totals: AchievementTotals = {
      ...ACHIEVEMENT_TOTALS,
      allies: 2,
      landmarks: { 1: 2, 2: 2, 3: 2, 4: 1, 5: 1, 6: 1 },
      projects: 3,
    };
    const state = newAchievements();
    const game = newGameState();
    const goal = (name: string) => ACHIEVEMENTS.find((entry) => entry.name === name)!.goal;
    recordAchievement(state, { galaxy: 1, id: "a", kind: "landmarkCharted" });
    recordAchievement(state, { galaxy: 2, id: "a", kind: "landmarkCharted" });
    recordAchievement(state, { galaxy: 2, id: "a", kind: "landmarkCharted" });
    recordAchievement(state, { galaxy: 2, id: "b", kind: "landmarkCharted" });
    // The galaxy with the most charted counts: two of galaxy two's two, which completes it.
    expect(achievementProgress(totals, goal("Cartographer"), state)).toEqual({ have: 2, need: 2 });
    expect(achievementProgress(totals, goal("Astra's Atlas"), state)).toEqual({ have: 3, need: 9 });
    recordAchievement(state, { id: "growers", kind: "allyMade" });
    recordAchievement(state, { id: "garden", kind: "projectFunded" });
    const names = (list: readonly { readonly name: string }[]) => list.map(({ name }) => name);
    expect(names(unlockAchievements(ACHIEVEMENTS, totals, state, game))).toEqual([
      "Cartographer",
      "Good Cause",
    ]);
    recordAchievement(state, { id: "miners", kind: "allyMade" });
    recordAchievement(state, { id: "school", kind: "projectFunded" });
    recordAchievement(state, { id: "school", kind: "projectFunded" });
    recordAchievement(state, { id: "dock", kind: "projectFunded" });
    expect(names(unlockAchievements(ACHIEVEMENTS, totals, state, game))).toEqual([
      "Friends Everywhere",
      "Community Builder",
    ]);
  });
});

describe("notices and persistence", () => {
  it("announces achievements unlocked together one at a time", () => {
    const model = launched();
    expect(nextNotice(model)).toBe("Achievement: New Navigator");
    model.dismissNotice();
    model.recordAchievement({ kind: "blockadeBroken" });
    model.recordAchievement({ kind: "jobCompleted" });
    expect(nextNotice(model)).toBe("Achievement: Blockade Breaker");
    model.dismissNotice();
    expect(nextNotice(model)).toBe("Achievement: Helping Hand");
  });

  it("keeps achievements, counts and paints ever owned on Restart, starting a new world's finds", () => {
    const model = new GameModel(PROTOTYPE);
    model.state.started = true;
    model.recordAchievement({ kind: "jobCompleted" });
    model.recordAchievement({ galaxy: 1, id: "nebula", kind: "landmarkCharted" });
    const point = [{ id: "a", x: 0, y: 0 }];
    recordSensed(model.state.achievements, ["penny:1:a"]);
    reachSensed(PENNY_FIND_RANGE, 1, point, { x: 0, y: 0 }, model.state.achievements);
    model.state.achievements.sensed.push("penny:1:b");
    model.state.economy.paints.push("iris");
    model.recordAchievement({ kind: "activityCompleted" });
    model.restart();
    expect(model.state.started).toBe(false);
    expect(model.state.economy.paints).toEqual([ECONOMY.defaultPaint]);
    expect(model.state.achievements).toMatchObject({
      activities: 1,
      charted: { 1: ["nebula"] },
      finds: 1,
      found: [],
      jobs: 1,
      paints: [ECONOMY.defaultPaint, "iris"],
      sensed: [],
      unlocked: [id("Helping Hand")],
    });
    expect(view(model, "Full Palette").progress?.have).toBe(2);
    // The same point in the new world is a new find.
    recordSensed(model.state.achievements, ["penny:1:a"]);
    reachSensed(PENNY_FIND_RANGE, 1, point, { x: 0, y: 0 }, model.state.achievements);
    expect(model.state.achievements.finds).toBe(2);
  });

  it("saves and restores achievements, rejecting a malformed record", () => {
    const model = new GameModel(PROTOTYPE);
    model.recordAchievement({ kind: "jobCompleted" });
    const saved = JSON.parse(model.save());
    expect(restoreSave(saved)?.achievements).toEqual(model.state.achievements);
    expect(restoreSave({ ...saved, achievements: { ...saved.achievements, jobs: -1 } })).toBeNull();
    expect(restoreSave({ ...saved, achievements: { unlocked: "x" } })).toBeNull();
  });

  it("unlocks what a save from before achievements reached, without a notice", () => {
    const flying = launched();
    const saved = JSON.parse(flying.save());
    delete saved.achievements;
    const model = new GameModel(PROTOTYPE, saved);
    expect(unlocked(model)).toEqual([id("New Navigator")]);
    model.step(1 / 60, idle);
    expect(model.state.notice).not.toContain("Achievement");
  });
});
