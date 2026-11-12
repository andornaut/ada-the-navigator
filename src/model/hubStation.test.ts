import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import { playOpening } from "../testing/launch.ts";
import { ensureDestination } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { HUB_STATION } from "./stations.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

/** Cartwheel's flight with Ada at rest beside the introduced hub, no enemies about. */
function atHub(resolved = false): GameModel {
  const model = new GameModel(CONTENT);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 2] });
  model.startGalaxy(2);
  playOpening(model);
  model.state.dialogue = null;
  const progress = model.state.progress[2];
  Object.assign(progress, { introduced: true, stage: Math.max(1, progress.stage) });
  if (resolved) {
    Object.assign(progress, { questComplete: true, resolved: true, stage: 5 });
  }
  const f = model.state.flight!;
  const hub = ensureDestination(CONTENT, HUB_STATION, f);
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
    // Depositing below a milestone plays no line and keeps the hub undocked.
    expect(model.state.dialogue).toBeNull();
    expect(model.state.docked).toBeNull();
    expect(model.contextAction).toBe("dock");
    model.interact();
    expect(model.state.docked).toBe(HUB_STATION);
    expect(model.state.flight!.velocity).toEqual({ x: 0, y: 0 });
  });

  it("waits to offer Dock until a story scene near the hub and its line have ended", () => {
    const model = atHub();
    const f = model.state.flight!;
    const [first] = CONTENT.tuning.miningMilestones;
    f.cargo = first;
    model.interact();
    // The first milestone starts the blocked scene: no Use until it and its line are done.
    expect(f.storyScene).toMatchObject({ id: "blocked", lineDue: true });
    expect(model.contextAction).toBeUndefined();
    model.interact();
    expect(model.state.docked).toBeNull();
    const { duration } = CARTWHEEL_STORY_SHIPS.scenes.blocked;
    for (let time = 0; time <= duration + 0.1; time += 0.1) {
      model.step(0.1, idle);
    }
    expect(f.storyScene?.lineDue).toBe(false);
    expect(model.state.dialogue).not.toBeNull();
    model.state.dialogue = null;
    expect(model.contextAction).toBe("dock");
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
    model.interact();
    expect(model.state.tasks[2]).toBeUndefined();
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
      reward: 60,
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
