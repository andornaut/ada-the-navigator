import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT, GALAXY_NUMBERS } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { readStory, relaunch } from "../testing/launch.ts";
import { nearestSettlerStation } from "./andromedaPlaces.ts";
import { interactionCopy } from "./conversations.ts";
import { ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

// Exercise the staged runtime through its real model without promoting the production roster.
const built = BUILT as Set<GalaxyNumber>;
beforeAll(() => built.add(5));
afterAll(() => built.delete(5));

function launch(): GameModel {
  const model = new GameModel(CONTENT);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  for (const progress of Object.values(model.state.progress)) {
    progress.opened = true;
  }
  model.startGalaxy(5);
  return model;
}
function visit(model: GameModel, id: string): void {
  const flight = model.state.flight!;
  const target = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
  expect(target, id).toBeDefined();
  Object.assign(flight.player, { x: target!.x, y: target!.y });
  flight.velocity = { x: 0, y: 0 };
  model.step(0.001, idle);
}
function continuePanel(model: GameModel, context: string): void {
  expect(model.state.dialogue?.context).toBe(context);
  expect(model.state.dialogue?.choices.map(({ id }) => id)).toEqual(["continue"]);
  model.choose("continue");
}
function arrival(model: GameModel): void {
  const flight = model.state.flight!;
  const station = nearestSettlerStation(ECONOMY, flight.player);
  ensureStation(CONTENT, station.id, flight);
  visit(model, station.id);
  if (!model.state.dialogue) {
    model.interact();
  }
  continuePanel(model, "andromeda:arrival");
  expect(model.state.docked).toBeNull();
}

describe("mounted Andromeda chapter", () => {
  it.each([false, true])("uses the approved Pip introduction after inspection=%s", (inspected) => {
    const model = launch();
    arrival(model);
    if (inspected) {
      visit(model, "darkBeacon");
      continuePanel(model, "andromeda:dent");
    }
    visit(model, "pip");
    model.interact();
    const panel = model.state.dialogue!;
    const copy = interactionCopy({ galaxy: 5, progress: model.state.progress[5] }, panel);
    expect(copy.party).toBe("Pip");
    expect(copy.lines[0]?.text).toBe(
      inspected
        ? "Pip, did you see the dent in the beacon?"
        : "Pip, do you know what happened to the beacon?",
    );
    expect(copy.topics).toHaveLength(2);
    expect(model.state.progress[5].stage).toBe(inspected ? 2 : 1);
    model.closeInteraction();
    const saved = model.save();
    expect(restoreSave(saved)).not.toBeNull();
    const loaded = relaunch(CONTENT, saved);
    expect(loaded.state.progress[5].stage).toBe(inspected ? 2 : 1);
    loaded.interact();
    expect(loaded.state.dialogue).toEqual(panel);
    continuePanel(loaded, "andromeda:confession");
    expect(loaded.state.progress[5].stage).toBe(3);
    expect(loaded.state.progress[5].andromeda?.station).toMatch(/^station:/u);
    expect(loaded.state.docked).toBeNull();
  });

  it("commits parts, repair and the disk once through real Use and Continue across reload", () => {
    let model = launch();
    arrival(model);
    visit(model, "pip");
    model.interact();
    continuePanel(model, "andromeda:confession");
    const station = model.state.progress[5].andromeda!.station!;
    visit(model, station);
    expect(model.contextAction).toBe("talk");
    model.interact();
    continuePanel(model, "andromeda:ownsUp");
    const settlement = model.state.progress[5].andromeda!.settlement!;
    expect(settlement).toMatch(/^settlement:/u);
    expect(settlement).not.toBe(station);
    visit(model, settlement);
    expect(model.contextAction).toBe("deliver");
    model.interact();
    expect(model.state.progress[5]).toMatchObject({ questItem: null, stage: 4 });
    const partsPanel = model.state.dialogue;
    model.closeInteraction();
    const saved = model.save();
    expect(restoreSave(saved)).not.toBeNull();
    model = relaunch(CONTENT, saved);
    expect(model.state.progress[5].andromeda).toEqual({ settlement, station });
    model.interact();
    expect(model.state.dialogue).toEqual(partsPanel);
    continuePanel(model, "andromeda:parts");
    expect(model.state.progress[5]).toMatchObject({ questItem: "beaconParts", stage: 5 });
    const carrying = model.save();
    expect(restoreSave(carrying)).not.toBeNull();
    model = relaunch(CONTENT, carrying);
    expect(model.ship.aboard).toEqual({ kind: "carrying", name: "Beacon parts" });
    visit(model, "darkBeacon");
    expect(model.contextAction).toBe("deliver");
    model.interact();
    continuePanel(model, "andromeda:repaired");
    expect(model.state.progress[5]).toMatchObject({
      questComplete: true,
      questItem: null,
      stage: 6,
    });
    visit(model, "pip");
    model.interact();
    continuePanel(model, "andromeda:holodisk");
    expect(model.state.progress[5].holodisk).toBe(true);
    expect(restoreSave(model.save())).not.toBeNull();
    expect(model.state.dialogue?.context).toBe("holodiskMoment");
    readStory(model);
    expect(model.state.dialogue).toBeNull();
    model.returnHome();
    readStory(model);
    expect(model.state.progress[5].resolved).toBe(true);
    const completed = structuredClone(model.state.progress[5]);
    model.startGalaxy(5);
    visit(model, "pip");
    model.interact();
    expect(model.state.progress[5]).toEqual(completed);
  });

  it("rejects invented settlement targets and a carried chapter item in another galaxy", () => {
    const model = launch();
    const saved = JSON.parse(model.save()) as { progress: Record<number, Record<string, unknown>> };
    saved.progress[5]!.andromeda = { settlement: "settlement:invented" };
    expect(restoreSave(saved)).toBeNull();
    delete saved.progress[5]!.andromeda;
    saved.progress[1]!.questItem = "beaconParts";
    expect(restoreSave(saved)).toBeNull();
  });
});
