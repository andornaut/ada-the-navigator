import { ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import { GameModel } from "../model/game.ts";
import type { StoryPage } from "../model/storybook.ts";

/**
 * Test support: a launch from a save, which opens on the start screen, then Continue when the
 * save was made mid-flight, so the flight resumes as it was saved.
 */
export function relaunch(content: GameContent, saved: unknown): GameModel {
  const model = new GameModel(content, saved);
  let value = saved;
  if (typeof saved === "string") {
    try {
      value = JSON.parse(saved) as unknown;
    } catch {
      value = null;
    }
  }
  if ((value as { mode?: unknown } | null)?.mode === "space") {
    model.continueGame();
  }
  return model;
}

/**
 * Test support: launching a galaxy now starts its flight at once, since openings play at home.
 * Kept for callers that once answered the opening; it does nothing in flight.
 */
export function playOpening(model: GameModel): void {
  if (model.state.mode !== "space") {
    readStory(model);
  }
}

/**
 * Test support: reads storybook pages until the story gives way to galaxy selection or the
 * start screen, taking choice `choice` on each choice page, and returns the pages read.
 */
export function readStory(model: GameModel, choice = 0): StoryPage[] {
  const pages: StoryPage[] = [];
  for (let turn = 0; turn < 60 && model.screen === "story"; turn++) {
    const page = model.storyView!.page;
    pages.push(page);
    if (page.choices) {
      model.storyChoose(Math.min(choice, page.choices.length - 1));
    } else {
      model.storyNext();
    }
  }
  return pages;
}

/** Test support: a home visit read to galaxy selection, then Jump to `galaxy`. */
export function boardAndJump(model: GameModel, galaxy: GalaxyNumber, choice = 0): StoryPage[] {
  const pages = readStory(model, choice);
  const position = ROUTE_POSITION[galaxy];
  model.viewGalaxy(position);
  model.jump();
  return pages;
}

export { pinnedRandomValues, seedLaunches } from "./launchSeeds.ts";
