import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { relaunch } from "../testing/launch.ts";
import { ensureDestination } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";

function atHub() {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 2];
  model.startGalaxy(2);
  Object.assign(model.state.progress[2], {
    holodisk: true,
    introduced: true,
    known: ["hub"],
    questComplete: true,
    resolved: true,
    stage: 5,
  });
  const flight = model.state.flight!;
  flight.objects = [];
  const hub = ensureDestination(CONTENT, "hub", flight);
  flight.player = { x: hub.x, y: hub.y };
  flight.velocity = { x: 0, y: 0 };
  model.state.dialogue = null;
  model.interact();
  expect(model.acceptJob("miningContract")).toBe("accepted");
  model.undock();
  return model;
}

describe("activity completion eligibility and run lifecycle", () => {
  it("records the galaxy's actual activity completion once and preserves it after dropping a later run", () => {
    const model = atHub();
    expect(model.state.progress[2].activityCompleted).toBeUndefined();
    model.state.flight!.cargo = 30;
    model.interact();
    expect(model.state.progress[2].activityCompleted).toBe(true);
    expect(model.state.progress[1].activityCompleted).toBeUndefined();
    const paid = model.state.economy.stardust;
    const count = model.state.achievements.activities;
    model.interact();
    expect(model.state.economy.stardust).toBe(paid);
    expect(model.state.achievements.activities).toBe(count);
    model.choose("continue");
    model.interact();
    expect(model.acceptJob("miningContract")).toBe("accepted");
    expect(model.dropJob()).toBe(true);
    expect(model.state.progress[2].activityCompleted).toBe(true);
    expect(restoreSave(model.save())!.progress[2].activityCompleted).toBe(true);
  });

  it("does not infer eligibility from acceptance, Drop or legacy aggregate counts", () => {
    const model = atHub();
    model.state.achievements.activities = 10;
    expect(model.dropJob()).toBe(true);
    const saved = JSON.parse(model.save()) as {
      progress: Record<number, { activityCompleted?: unknown }>;
    };
    expect(restoreSave(saved)!.progress[2].activityCompleted).toBeUndefined();
    saved.progress[2]!.activityCompleted = "true";
    expect(restoreSave(saved)).toBeNull();
  });

  it("keeps a courier's exact run on Continue and resets it only when its flight ends", () => {
    const model = new GameModel(CONTENT);
    model.state.prologueSeen = true;
    model.state.unlocked = [1, 5];
    model.startGalaxy(5);
    model.state.tasks[5] = {
      courier: { patrolSpawned: true, position: { x: 100, y: 0 } },
      id: "courierRun",
      kind: "activity",
      place: "pip",
      reward: 165,
      start: { x: 0, y: 0 },
      target: { id: "settlement:0,0", x: 6000, y: 0 },
    };
    model.backToTitle();
    model.continueGame();
    expect(model.state.tasks[5]).toMatchObject({
      courier: { patrolSpawned: true, position: { x: 100, y: 0 } },
    });
    const loaded = relaunch(CONTENT, model.save());
    expect(loaded.state.tasks[5]).toEqual(model.state.tasks[5]);
    loaded.resetActivity(5);
    expect(loaded.state.tasks[5]).toMatchObject({
      courier: { patrolSpawned: false, position: { x: 0, y: 0 } },
    });
    expect(loaded.state.progress[5].activityCompleted).toBeUndefined();
  });
});
