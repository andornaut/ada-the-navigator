import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { readStory, supportEntropy } from "../testing/launch.ts";
import { GameModel } from "./game.ts";

function boarded() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.started = true;
  model.state.prologueSeen = true;
  model.state.progress[1].opened = true;
  model.continueGame();
  expect(model.roomPage).toBe(true);
  const pages = readStory(model);
  expect(pages.map(({ id }) => id)).toEqual(["room", "boarding:0", "boarding:1"]);
  expect(model.screen).toBe("selector");
  return model;
}

it("generic map close restores its boarding origin without entering space", () => {
  const model = boarded();
  const before = structuredClone(model.state);
  model.closeGalaxyMap();
  expect(model.storyView?.page.id).toBe("boarding:1");
  expect(model.roomPage).toBe(false);
  expect(model.state).toEqual(before);
});

it("the explicit Earth destination returns to the room and boards only after picking up the rock", () => {
  const model = boarded();
  const before = structuredClone(model.state);
  model.leaveCockpit();
  expect(model.galaxyMapOpen).toBe(false);
  expect(model.roomPage).toBe(true);
  expect(model.storyView?.page.id).toBe("room");
  expect(model.state).toEqual(before);
  model.storyNext();
  expect(model.storyView?.page.id).toBe("boarding:0");
  expect(model.state.flight).toBeNull();
  expect(model.state.progress).toEqual(before.progress);
});
