import { describe, expect, it } from "vitest";

import { ACTIVITIES } from "../data/activities.ts";
import { CONTENT } from "../data/content.ts";
import { questReward } from "../data/questRewards.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { visitCartwheelHubFixture } from "../testing/cartwheelFixture.ts";
import { playOpening, relaunch, supportEntropy } from "../testing/launch.ts";
import { ensureDestination } from "./flight.ts";
import { GameModel } from "./game.ts";
import { HUB_STATION } from "./stations/index.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

/** Cartwheel's flight with Ada at rest beside the introduced hub, no enemies about. */
function atHub(resolved = false): GameModel {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 2] });
  const progress = model.state.progress[2];
  if (resolved) {
    Object.assign(progress, { introduced: true, questComplete: true, resolved: true, stage: 5 });
  }
  model.startGalaxy(2);
  playOpening(model);
  model.state.dialogue = null;
  const f = model.state.flight!;
  const hub = resolved
    ? ensureDestination(CONTENT, HUB_STATION, f)
    : visitCartwheelHubFixture(CONTENT, model);
  model.state.dialogue = null;
  Object.assign(progress, { introduced: true, stage: Math.max(1, progress.stage) });
  progress.known = [...new Set([...progress.known, HUB_STATION])];
  progress.stations = [...new Set([...progress.stations, HUB_STATION])];
  f.objects = f.objects.filter((object) => !object.enemy);
  f.player = { x: hub.x + 100, y: hub.y };
  f.velocity = { x: 0, y: 0 };
  f.dangerFor = 0;
  delete f.storyScene;
  return model;
}

describe("the mining hub as a station", () => {
  it("joins the galaxy's discovered stations once discovered, listed once", () => {
    const model = atHub();
    const progress = model.state.progress[2];
    progress.stations = [];
    model.step(0.05, idle);
    expect(progress.stations).toEqual([HUB_STATION]);
    expect(model.destinations().filter(({ id }) => id === HUB_STATION)).toHaveLength(1);
    expect(restoreSave(model.save())?.progress[2].stations).toEqual([HUB_STATION]);
  });

  it("offers Deposit while Ada carries ore, then Dock, with no Talk", () => {
    const model = atHub();
    const f = model.state.flight!;
    expect(model.contextAction).toBe("dock");
    f.cargo = 3;
    expect(model.contextAction).toBe("deposit");
    model.interact();
    expect(f.cargo).toBe(0);
    expect(model.state.progress[2].deposited).toBe(3);
    // The deposit card pauses flight until its explicit Continue, without docking.
    expect(model.state.dialogue).toMatchObject({ context: "deposit", title: "Astra" });
    expect(model.state.docked).toBeNull();
    expect(model.contextAction).toBeUndefined();
    const time = f.time;
    model.step(0.1, idle);
    model.interact();
    expect(f.time).toBe(time);
    expect(model.state.progress[2].deposited).toBe(3);
    model.choose("continue");
    expect(model.state.dialogue).toBeNull();
    expect(model.contextAction).toBe("dock");
    model.interact();
    expect(model.state.docked).toBe(HUB_STATION);
    expect(model.dockGreeting()?.displayName).toBe("Quartz");
    expect(model.dockGreeting()).toEqual(model.stationGreeting);
    expect(model.state.flight!.velocity).toEqual({ x: 0, y: 0 });
  });

  it("waits for the blocked scene before offering Dock and plays Ada's reaction in flight", () => {
    const model = atHub();
    const f = model.state.flight!;
    const [first] = CONTENT.tuning.miningMilestones;
    f.cargo = first;
    model.interact();
    // The first milestone starts the blocked scene: Dock waits for the manoeuvre.
    expect(f.storyScene).toMatchObject({ id: "blocked", lineDue: true });
    expect(model.contextAction).toBeUndefined();
    model.interact();
    expect(model.state.docked).toBeNull();
    const { duration } = CARTWHEEL_STORY_SHIPS.scenes.blocked;
    expect(model.state.dialogue).toMatchObject({ context: "deposit", title: "Astra" });
    const pausedAt = f.time;
    model.step(duration + 0.1, idle);
    expect(f.time).toBe(pausedAt);
    expect(f.storyScene?.lineDue).toBe(true);
    model.choose("continue");
    expect(model.contextAction).toBeUndefined();
    for (let time = 0; time <= duration + 0.1; time += 0.1) {
      model.step(0.1, idle);
    }
    expect(f.storyScene?.lineDue).toBe(true);
    const resumed = relaunch(CONTENT, model.save());
    const resumedFlight = resumed.state.flight!;
    expect(resumedFlight.storyScene?.lineDue).toBe(true);
    const afterScene = resumedFlight.time;
    resumed.step(0.1, idle);
    expect(resumedFlight.time).toBeGreaterThan(afterScene);
    expect(resumed.state.dialogue).toBeNull();
    expect(resumed.conversation).toMatchObject({
      speaker: "ada",
      text: CONTENT.chapters[2]!.dialogue.firstDeposit?.text,
    });
    expect(resumedFlight.storyScene?.lineDue).toBe(false);
    expect(resumed.conversation?.text).toBe(CONTENT.chapters[2]!.dialogue.firstDeposit?.text);
    expect(resumed.state.progress[2].deposited).toBe(first);
    expect(resumed.contextAction).toBe("dock");
    resumed.interact();
    expect(resumed.state.docked).toBe(HUB_STATION);
  });

  it("delivers a job's item bound for the hub before Dock", () => {
    const model = atHub();
    const f = model.state.flight!;
    const hub = f.objects.find((object) => object.id === HUB_STATION)!;
    model.state.tasks[2] = {
      carrying: true,
      id: "job:delivery",
      item: "parts",
      kind: "job",
      reward: 15,
      station: "station:-3,-2",
      target: { id: HUB_STATION, x: hub.x, y: hub.y },
      type: "delivery",
    };
    expect(model.contextAction).toBe("deliver");
    const balance = model.state.economy.stardust;
    model.interact();
    expect(model.state.tasks[2]).toBeUndefined();
    expect(model.state.dialogue).toMatchObject({ context: "deliver" });
    expect(model.state.economy.stardust).toBe(balance + questReward(15));
    expect(model.contextAction).toBeUndefined();
    model.interact();
    model.choose("continue");
    expect(model.state.economy.stardust).toBe(balance + questReward(15));
    expect(model.contextAction).toBe("dock");
  });

  it("heads its board with the mining contract once the chapter is resolved", () => {
    const unresolved = atHub();
    unresolved.interact();
    expect(unresolved.jobBoard().some((row) => row.kind === "activity")).toBe(false);
    expect(unresolved.projects).toBeNull();
    const model = atHub(true);
    model.interact();
    expect(model.state.docked).toBe(HUB_STATION);
    const board = model.jobBoard();
    expect(board[0]).toEqual({
      detail: "Deposit 30 ore at the hub.",
      id: "miningContract",
      kind: "activity",
      reward: questReward(ACTIVITIES[2]!.reward!),
      state: "offer",
      title: "Mining contract",
      type: "activity",
    });
    // The rest of the board is the Cartwheel pool, with no delivery to the hub itself.
    const jobs = board.filter((row) => row.kind === "job");
    expect(jobs).toHaveLength(3);
    const offers = model.state.jobs.boards[2]![HUB_STATION]!;
    expect(
      offers
        .filter((offer) => offer.type === "delivery")
        .every(({ target }) => target.id !== HUB_STATION),
    ).toBe(true);
    expect(model.acceptJob("miningContract")).toBe("accepted");
    expect(model.jobBoard()[0]).toMatchObject({ id: "miningContract", state: "held" });
    // Cartwheel's two projects show at the hub once the chapter is resolved.
    expect(model.projects?.map(({ id }) => id).sort()).toEqual(["dockingBay", "hubRepairs"]);
  });

  it("refuses the contract while the galaxy's task slot is taken", () => {
    const model = atHub(true);
    model.interact();
    const job = model.jobBoard().find((row) => row.kind === "job")!;
    expect(model.acceptJob(job.id)).toBe("accepted");
    expect(model.jobBoard()[0]).toMatchObject({ id: "miningContract", state: "busy" });
    expect(model.acceptJob("miningContract")).toBe("busy");
  });

  it("saves and restores while docked at the hub with its board", () => {
    const model = atHub(true);
    model.interact();
    model.jobBoard();
    const restored = restoreSave(model.save());
    expect(restored?.docked).toBe(HUB_STATION);
    expect(restored?.jobs.boards[2]?.[HUB_STATION]).toHaveLength(3);
  });
});
