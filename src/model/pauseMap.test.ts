import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GameModel } from "./game.ts";

function room() {
  const model = new GameModel(CONTENT);
  model.state.started = true;
  model.state.prologueSeen = true;
  model.state.progress[1].opened = true;
  model.continueGame();
  expect(model.roomPage).toBe(true);
  return model;
}

describe("Pause Map permission", () => {
  it("opens the existing galaxy selection from the idle room and closes to the exact page", () => {
    const model = room();
    const before = model.storyView;
    expect(model.pauseMapAvailable).toBe(true);
    expect(model.openGalaxyMap()).toBe(true);
    expect(model.screen).toBe("selector");
    expect(model.state.flight).toBeNull();
    model.closeGalaxyMap();
    expect(model.storyView).toEqual(before);
    expect(model.roomPage).toBe(true);
    expect(model.pauseMapAvailable).toBe(true);
  });

  it("stays hidden before prologue completion and throughout boarding", () => {
    const model = room();
    model.state.prologueSeen = false;
    expect(model.pauseMapAvailable).toBe(false);
    expect(model.openGalaxyMap()).toBe(false);
    model.state.prologueSeen = true;
    model.storyNext();
    const page = model.storyView;
    expect(model.pauseMapAvailable).toBe(false);
    expect(model.openGalaxyMap()).toBe(false);
    expect(model.storyView).toEqual(page);
  });

  it("does not expose the flight map through dialogue, suspension, docking or depleted shields", () => {
    const model = room();
    model.startGalaxy(1);
    expect(model.pauseMapAvailable).toBe(true);
    model.state.dialogue = {
      choices: [
        { id: "take", label: "Take" },
        { id: "leave", label: "Leave" },
      ],
      context: "choice",
      text: "",
      title: "",
    };
    expect(model.pauseMapAvailable).toBe(false);
    model.closeInteraction();
    expect(model.pauseMapAvailable).toBe(false);
    model.interact();
    expect(model.state.dialogue?.context).toBe("choice");
    const other = room();
    other.startGalaxy(1);
    other.state.docked = "station:0,0";
    expect(other.pauseMapAvailable).toBe(false);
    other.state.docked = null;
    other.state.flight!.shield = 0;
    expect(other.pauseMapAvailable).toBe(false);
  });
});
