import type { GameModel } from "./game.ts";
import type { StoryPage } from "./storybook.ts";

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
export function boardAndJump(model: GameModel, galaxy: number, choice = 0): StoryPage[] {
  const pages = readStory(model, choice);
  const selected = model.selectedGalaxy ?? galaxy;
  model.pageGalaxy(galaxy - selected);
  model.jump();
  return pages;
}
