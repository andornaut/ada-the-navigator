import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { openRewoundCampaign, rewindCampaign } from "./campaignRewind.ts";
import { GameModel } from "./game.ts";
import { landmarkSites } from "./landmarks.ts";
import { inspectAdaSave } from "./saveIntegrity.ts";

it("rewinds the campaign while keeping persisted equipment, ore, geography and earned credits", () => {
  const model = new GameModel(CONTENT, supportEntropy);
  model.startGalaxy(1);
  const save = model.saveDocument();
  save.unlocked = [1, 2, 3, 4, 5, 6];
  save.prologueSeen = true;
  save.economy.stardust = 314;
  save.flight!.cargo = 67;
  save.achievements.jobs = 3;
  save.achievements.projects = ["greenhouseRing"];
  save.achievements.unlocked = ["goodCause", "newNavigator", "helpingHand"];
  const progress = save.progress[1];
  Object.assign(progress, {
    charted: [landmarkSites(1)[0]!.id],
    deposited: 9,
    destroyedEnemies: 11,
    discoveries: 6,
    donated: { greenhouseRing: 300 },
    explored: ["0,0"],
    holodisk: true,
    introduced: true,
    known: ["growers", "holodisk"],
    opened: true,
    questComplete: true,
    questItem: "food",
    resolved: true,
    revealed: ["greenhouseRing"],
    stage: 4,
  });
  save.jobs.made = 8;
  save.seenConversations = ["lesson:scan", "meeting:1:growers"];

  const rewind = rewindCampaign(save);
  expect(rewind).toMatchObject({
    achievements: save.achievements,
    dialogue: null,
    docked: null,
    economy: { ...save.economy, cargo: 67 },
    flight: null,
    jobs: { boards: {}, made: 0 },
    mode: "home",
    prologueSeen: true,
    seenConversations: ["lesson:scan"],
    selectedGalaxy: 1,
    tasks: {},
    unlocked: [1],
  });
  expect(rewind.progress[1]).toMatchObject({
    charted: progress.charted,
    deposited: 0,
    destroyedEnemies: 11,
    discoveries: 6,
    donated: {},
    explored: ["0,0"],
    geography: progress.geography,
    holodisk: false,
    introduced: false,
    known: ["growers"],
    opened: false,
    questComplete: false,
    questItem: null,
    resolved: false,
    revealed: [],
    stage: 0,
  });
  expect(rewind.achievements).not.toBe(save.achievements);
  const next = openRewoundCampaign(CONTENT, supportEntropy, save);
  expect(next.state.achievements.unlocked).toEqual(save.achievements.unlocked);
  expect(inspectAdaSave(next.save()).status).toBe("valid");
  expect(save.flight!.cargo).toBe(67);
  expect(save.progress[1].holodisk).toBe(true);
});

it("persists the new Sunflower Earth opening and reloads it through Continue", () => {
  const old = new GameModel(CONTENT, supportEntropy);
  old.startGalaxy(1);
  const source = old.saveDocument();
  source.prologueSeen = true;
  const next = openRewoundCampaign(CONTENT, supportEntropy, source);
  expect(next.screen).toBe("story");
  expect(next.state.flight).toBeNull();
  expect(next.state.prologueSeen).toBe(true);
  expect(next.storyView?.page).toBeDefined();
  const checks = inspectAdaSave(next.save());
  expect(checks.status).toBe("valid");
  const resumed = new GameModel(CONTENT, supportEntropy, next.save());
  expect(resumed.canContinue).toBe(true);
  resumed.continueGame();
  expect(resumed.storyView?.page).toEqual(next.storyView?.page);
  resumed.storyNext();
  next.storyNext();
  expect(resumed.storyView?.page).toEqual(next.storyView?.page);
  expect(resumed.state.unlocked).toEqual([1]);
});
