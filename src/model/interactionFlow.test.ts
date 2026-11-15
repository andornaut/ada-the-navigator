import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import type { GameContent } from "../data/types.ts";
import { visitCartwheelHubFixture } from "../testing/cartwheelFixture.ts";
import { relaunch } from "../testing/launch.ts";
import { createEnemy } from "./enemyAi.ts";
import { activateRequiredRoute, ensureDestination } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import type { FlightState } from "./types.ts";

/** Test support: admit the saved required encounter, then disable its actual noncombat-fixture guard. */
function disableStoryGuard(content: GameContent, flight: FlightState, id: string): void {
  const encounter = activateRequiredRoute(content, id, flight);
  if (encounter.status === "resolved") {
    return;
  }
  if (encounter.status !== "created" && encounter.status !== "existing") {
    throw new Error(`Expected the saved required guard for ${id}, got ${encounter.status}`);
  }
  const guard = encounter.guard;
  if (guard.routeId !== id || guard.enemy?.archetype !== "frigate") {
    throw new Error(`Expected the actual required frigate for ${id}`);
  }
  guard.enemy.disabled = true;
}

function offer() {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 2, 3];
  model.startGalaxy(1);
  Object.assign(model.state.progress[1], {
    holodisk: true,
    introduced: true,
    known: ["growers"],
    questComplete: true,
    resolved: true,
    stage: 4,
  });
  const flight = model.state.flight!;
  flight.objects = [];
  const place = ensureDestination(CONTENT, "growers", flight);
  flight.player = { x: place.x, y: place.y };
  model.state.progress[1].stations = [
    stationsNear(ECONOMY, 1, 40000, place).find(
      (site) => Math.hypot(site.x - place.x, site.y - place.y) >= 3000,
    )!.id,
  ];
  disableStoryGuard(CONTENT, flight, "growers");
  model.interact();
  expect(model.state.dialogue).not.toBeNull();
  expect(model.state.dialogue?.choices.map(({ id }) => id)).toEqual(["take", "skip"]);
  return model;
}

describe("Use card suspension", () => {
  it("Close and repeated Use preserve the exact pending question without choosing or repeating its outcome", () => {
    const model = offer();
    const panel = model.state.dialogue;
    const before = structuredClone(model.state.economy);
    expect(model.state.dialogue).not.toBeNull();
    model.closeInteraction();
    model.closeInteraction();
    expect(model.state.dialogue).toBeNull();
    expect(model.contextAction).toBe("use");
    expect(model.state.tasks[1]).toBeUndefined();
    model.interact();
    expect(model.state.dialogue).toBe(panel);
    expect(model.state.economy).toEqual(before);
    expect(model.state.dialogue).not.toBeNull();
    model.choose("unknown");
    expect(model.state.dialogue).toBe(panel);
    expect(model.state.dialogue).not.toBeNull();
    model.choose("take");
    expect(model.state.tasks[1]).toMatchObject({ kind: "activity", place: "growers" });
  });

  it("saves a suspended question and reopens it after Continue without inferring an answer", () => {
    const model = offer();
    const panel = structuredClone(model.state.dialogue);
    expect(model.state.dialogue).not.toBeNull();
    model.closeInteraction();
    const save = model.save();
    expect(restoreSave(save)).not.toBeNull();
    const loaded = relaunch(CONTENT, save);
    expect(loaded.state.tasks[1]).toBeUndefined();
    loaded.interact();
    expect(loaded.state.dialogue).toEqual(panel);
    expect(loaded.state.dialogue).not.toBeNull();
    loaded.choose("skip");
    expect(loaded.state.tasks[1]).toBeUndefined();
  });

  it("refuses a disabled decision and reopens before a competing departure", () => {
    const model = offer();
    const panel = model.state.dialogue!;
    panel.choices[0]!.refused = true;
    expect(model.state.dialogue).not.toBeNull();
    model.choose("take");
    expect(model.state.tasks[1]).toBeUndefined();
    expect(model.state.dialogue).not.toBeNull();
    model.closeInteraction();
    expect(model.openGalaxyMap()).toBe(false);
    expect(model.state.dialogue).toBe(panel);
    expect(model.galaxyMapOpen).toBe(false);
  });

  it("Deposit opens Astra's card and Close/reopen never credits the same ore twice", () => {
    const model = new GameModel(CONTENT);
    model.state.unlocked = [1, 2, 3];
    model.startGalaxy(2);
    visitCartwheelHubFixture(CONTENT, model);
    model.choose("continue");
    const flight = model.state.flight!;
    flight.objects = [];
    const hub = ensureDestination(CONTENT, "hub", flight);
    flight.player = { x: hub.x, y: hub.y };
    flight.cargo = 5;
    model.interact();
    expect(model.state.dialogue).toMatchObject({ context: "deposit", title: "Astra" });
    const deposited = model.state.progress[2].deposited;
    const balance = model.state.economy.stardust;
    expect(model.state.dialogue).not.toBeNull();
    model.closeInteraction();
    model.interact();
    expect(model.state.progress[2].deposited).toBe(deposited);
    expect(model.state.economy.stardust).toBe(balance);
    expect(flight.cargo).toBe(0);
    expect(model.state.dialogue).not.toBeNull();
    model.choose("continue");
    expect(model.state.dialogue).toBeNull();
  });
});

describe("mechanical outcome retention", () => {
  it("salvages a heavy once while Close/reopen only restores Astra's card", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    const flight = model.state.flight!;
    flight.player = { x: 0, y: 0 };
    const definition = enemyDefinition(1, "frigate");
    const point = { x: 100, y: 0 };
    const enemy = createEnemy(
      definition,
      { archetype: "frigate", id: "salvage-fixture", packId: null, phase: 0 },
      point,
    );
    enemy.disabled = true;
    flight.objects = [
      {
        ...point,
        enemy,
        hp: definition.hp,
        id: "salvage-fixture",
        kind: "enemy",
        radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
      },
    ];
    model.interact();
    expect(model.state.dialogue).toMatchObject({ context: "salvage", title: "Astra" });
    expect(enemy.salvaged).toBe(true);
    const drops = structuredClone(flight.objects);
    const nextId = flight.nextId;
    expect(model.state.dialogue).not.toBeNull();
    model.closeInteraction();
    model.interact();
    expect(flight.objects).toEqual(drops);
    expect(flight.nextId).toBe(nextId);
    expect(model.state.dialogue).not.toBeNull();
    model.choose("continue");
    model.interact();
    expect(flight.objects).toEqual(drops);
  });

  it("retains a closed pending choice through an emergency return, save and new flight", () => {
    const model = offer();
    const question = structuredClone(model.state.dialogue);
    expect(model.state.dialogue).not.toBeNull();
    model.closeInteraction();
    const flight = model.state.flight!;
    flight.objects = [];
    flight.shield = 1;
    flight.shots.push({
      ...flight.player,
      damage: 1,
      enemy: true,
      hitIds: [],
      id: `hit:${flight.nextId++}`,
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    });
    model.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    expect(model.state.mode).toBe("home");
    const loaded = relaunch(CONTENT, model.save());
    loaded.startGalaxy(1);
    expect(loaded.state.dialogue).toEqual(question);
    expect(loaded.state.tasks[1]).toBeUndefined();
    expect(loaded.state.dialogue).not.toBeNull();
    loaded.choose("skip");
    expect(loaded.state.tasks[1]).toBeUndefined();
  });
});
