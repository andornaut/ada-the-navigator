import { describe, expect, it } from "vitest";

import { COURIER } from "../data/activities.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { questReward } from "../data/questRewards.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { courierScoutTarget } from "./courierRun.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { ensureDestination } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { retainedSettlementsNear } from "./legacySettlements.ts";
import type { HeldActivity, Vec } from "./types.ts";
import { worldDelta, worldDistance } from "./worldContacts.ts";

function atHub() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 2];
  Object.assign(model.state.progress[2], {
    holodisk: true,
    introduced: true,
    known: ["hub"],
    questComplete: true,
    resolved: true,
    stage: 5,
  });
  model.startGalaxy(2);
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

function atPip(): GameModel {
  const model = new GameModel(CONTENT, () => 173, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 5];
  Object.assign(model.state.progress[5], {
    holodisk: true,
    introduced: true,
    known: ["pip"],
    questComplete: true,
    resolved: true,
    stage: 6,
  });
  model.startGalaxy(5);
  const flight = model.state.flight!;
  const pip = flight.objects.find(({ id }) => id === "pip")!;
  flight.player = { x: pip.x, y: pip.y };
  return model;
}

function expectCourierUnavailable(model: GameModel): void {
  expect(model.state.dialogue).toEqual({
    choices: [{ id: "continue", label: "Continue" }],
    context: "courierUnavailable",
    text: "I don't have a route ready yet. Check back later.",
    title: "Pip",
  });
}

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function flyAt(model: GameModel, point: Vec): void {
  const flight = model.state.flight!;
  flight.player = { x: point.x, y: point.y };
  flight.velocity = { x: 0, y: 0 };
  model.step(0.01, idle);
}
function acceptCourier(model: GameModel, approach: "escort" | "scout"): HeldActivity {
  expect(model.useTarget).toEqual({ action: "talk", id: "pip" });
  model.interact();
  expect(model.state.dialogue).toMatchObject({
    choices: [
      { id: "scout", label: "Scout ahead" },
      { id: "escort", label: "Stay with Pip" },
      { id: "skip", label: "Not now" },
    ],
    context: "activity:courier",
    text: "Drones patrol the way to the outpost. How should we get past them?",
  });
  model.choose(approach);
  expect(model.state.dialogue).toBeNull();
  const held = model.state.tasks[5] as HeldActivity;
  expect(held).toMatchObject({ courier: { approach, patrolSpawned: false }, id: "courierRun" });
  return held;
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

  it("gives Pip an honest Talk response without offering or starting a courier run", () => {
    const model = atPip();
    const flight = model.state.flight!;
    const world = flightWorldContext(flight);
    const [min, max] = COURIER.distance;
    const candidates = retainedSettlementsNear(world, ECONOMY, max, flight.player).filter(
      (target) => worldDistance(world, flight.player, target) >= min,
    );
    expect(candidates.length).toBeGreaterThan(0);
    for (const target of candidates) {
      const delta = worldDelta(world, flight.player, target);
      flight.objects.push({
        hp: 1,
        id: `fixture:${target.id}`,
        kind: "destination",
        radius: 30,
        x: flight.player.x + delta.x / 2,
        y: flight.player.y + delta.y / 2,
      });
    }
    const before = structuredClone(model.state.progress[5]);
    const balance = model.state.economy.stardust;
    expect(model.contextAction).toBe("talk");
    model.interact();
    expectCourierUnavailable(model);
    model.choose("take");
    expectCourierUnavailable(model);
    expect(model.state.tasks[5]).toBeUndefined();
    expect(model.state.progress[5]).toEqual(before);
    expect(model.state.economy.stardust).toBe(balance);
    model.choose("continue");
    expect(model.state.dialogue).toBeNull();
  });

  it.each([false, true])(
    "replaces stale active or suspended courier offers on Continue (%s)",
    (suspended) => {
      const model = atPip();
      model.state.dialogue = {
        choices: [
          { id: "take", label: "Accept" },
          { id: "skip", label: "Not now" },
        ],
        context: "activity:pip",
        text: CONTENT.labels.activityPip!,
        title: "Pip",
      };
      if (suspended) {
        model.closeInteraction();
      }
      const saved = model.save();
      expect(restoreSave(saved)).not.toBeNull();
      const loaded = relaunch(CONTENT, saved);
      if (suspended) {
        expect(loaded.state.dialogue).toBeNull();
        loaded.interact();
      }
      expectCourierUnavailable(loaded);
      expect(loaded.state.tasks[5]).toBeUndefined();
    },
  );

  it("offers the same real route and pay for either choice and declining takes no slot", () => {
    const scout = atPip();
    scout.interact();
    scout.choose("skip");
    expect(scout.state.dialogue).toBeNull();
    expect(scout.state.tasks[5]).toBeUndefined();
    const scouting = acceptCourier(scout, "scout");
    const escorting = acceptCourier(atPip(), "escort");
    expect(scouting.target).toEqual(escorting.target);
    expect(scouting.reward).toBe(escorting.reward);
    const distance = worldDistance(
      flightWorldContext(scout.state.flight!),
      scouting.start!,
      scouting.target!,
    );
    expect(distance).toBeGreaterThanOrEqual(COURIER.distance[0]);
    expect(distance).toBeLessThanOrEqual(COURIER.distance[1]);
  });

  it.each([false, true])("Pip waits for a scouting return with patrol reached=%s", (reached) => {
    const model = atPip();
    const task = acceptCourier(model, "scout");
    const flight = model.state.flight!;
    const start = task.start!;
    const world = flightWorldContext(flight);
    const point = courierScoutTarget(world, task)!;
    const { id, x, y } = point;
    expect(model.targetMarkers(GAME_AREA)).toContainEqual(
      expect.objectContaining({ id, trackedLabel: "Patrol area", x, y }),
    );
    flyAt(model, start);
    expect(task.courier!.position).toEqual(start);
    expect(task.courier!.scout).toBe("depart");
    flyAt(model, { x: start.x + COURIER.follow + 30, y: start.y });
    expect(task.courier!.scout).toBe("patrol");
    if (reached) {
      flyAt(model, point);
      expect(task.courier!.scout).toBe("return");
      expect(model.conversation?.text).toBe(
        "That's the patrol. Head back to Pip and he'll follow you.",
      );
      expect(model.targetMarkers(GAME_AREA)).toContainEqual(
        expect.objectContaining({ trackedLabel: "Pip" }),
      );
    }
    expect(task.courier!.position).toEqual(start);
    const saved = model.save();
    expect(restoreSave(saved)).not.toBeNull();
    const loaded = relaunch(CONTENT, saved);
    expect(loaded.state.tasks[5]).toEqual(task);
    flyAt(loaded, start);
    const resumed = loaded.state.tasks[5] as HeldActivity;
    expect(resumed.courier).toMatchObject({ approach: "scout", patrolSpawned: true });
    expect(resumed.courier!.scout).toBeUndefined();
    expect(resumed.courier!.position).not.toEqual(start);
  });

  it("follows at base speed, keeps one patrol through Continue and completes without a fight", () => {
    const model = atPip();
    const run = acceptCourier(model, "escort");
    const start = run.start!;
    const flight = model.state.flight!;
    const world = flightWorldContext(flight);
    flyAt(model, start);
    const moving = { ...run.courier!.position };
    expect(worldDistance(world, moving, start)).toBeCloseTo(
      CONTENT.tuning.physics.maxSpeed * COURIER.speedFraction * 0.01,
    );
    flyAt(model, { x: start.x + COURIER.follow + 30, y: start.y });
    expect(run.courier!.position).toEqual(moving);

    const patrol = () =>
      [...flight.objects, ...Object.values(flight.world.notables)].filter(
        (object) => object?.enemy?.packId === "courier:patrol",
      );
    expect(patrol()).toHaveLength(3);
    model.backToTitle();
    model.continueGame();
    expect(model.state.tasks[5]).toEqual(run);
    expect(patrol()).toHaveLength(3);

    const reward = model.state.economy.stardust + questReward(run.reward);
    const target = run.target!;
    const delta = worldDelta(world, start, target);
    const fraction = 0.5 / Math.hypot(delta.x, delta.y);
    const beforeArrival = { x: target.x - delta.x * fraction, y: target.y - delta.y * fraction };
    run.courier!.position = beforeArrival;
    flyAt(model, beforeArrival);
    expect(model.state.tasks[5]).toBeUndefined();
    expect(model.state.progress[5].activityCompleted).toBe(true);
    expect(model.state.economy.stardust).toBe(reward);
    expect(patrol()).toHaveLength(0);
    expect(restoreSave(model.save())).not.toBeNull();
  });

  it("resets Scout ahead on flight end and leaves the choice available after a drop", () => {
    const model = atPip();
    const task = acceptCourier(model, "scout");
    flyAt(model, { x: task.start!.x + COURIER.follow + 30, y: task.start!.y });
    expect(task.courier!.scout).toBe("patrol");
    model.returnHome();
    expect(task.courier).toEqual({
      approach: "scout",
      patrolSpawned: false,
      position: task.start,
      scout: "depart",
    });
    model.startGalaxy(5);
    flyAt(model, task.start!);
    expect(model.state.flight!.objects.find(({ id }) => id === "pip")).toMatchObject(task.start!);
    expect(model.dropJob()).toBe(true);
    expect(model.state.progress[5].activityCompleted).toBeUndefined();
    acceptCourier(model, "escort");
  });

  it("keeps a courier's exact run on Continue and resets it only when its flight ends", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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
