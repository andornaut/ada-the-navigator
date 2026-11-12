import { ROUTE_POSITION } from "../data/galaxies.ts";
import type { PrototypeContent, SectorId } from "../data/types.ts";
import { GameModel } from "./game.ts";
import type { StoryPage } from "./storybook.ts";

/**
 * Test support: a launch from a save, which opens on the start screen, then Continue when the
 * save was made mid-flight, so the flight resumes as it was saved.
 */
export function relaunch(content: PrototypeContent, saved: unknown): GameModel {
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
export function boardAndJump(model: GameModel, galaxy: SectorId, choice = 0): StoryPage[] {
  const pages = readStory(model, choice);
  const position = ROUTE_POSITION[galaxy];
  model.pageGalaxy(position - (model.selectedPosition ?? position));
  model.jump();
  return pages;
}

// Test support: GameModel draws each launch's world seed from crypto.getRandomValues. The test
// setup (src/test-setup.ts) routes it through pinnedRandomValues, so every flight's world is the
// same on every run; seedLaunches restarts the sequence at a given seed.
let launchSeed = 1;

/** Test support: the next launch seed, then a fixed sequence after it. */
export function seedLaunches(seed: number): void {
  launchSeed = seed >>> 0;
}

/** Test support: fills array with the pinned launch seed sequence, one 32-bit value per step. */
export function pinnedRandomValues<T extends ArrayBufferView | null>(array: T): T {
  if (!array) {
    return array;
  }
  const view = new DataView(array.buffer, array.byteOffset, array.byteLength);
  for (let offset = 0; offset < view.byteLength; offset += 4) {
    const value = launchSeed;
    launchSeed = (Math.imul(launchSeed, 1664525) + 1013904223) >>> 0;
    if (offset + 4 <= view.byteLength) {
      view.setUint32(offset, value, true);
    } else {
      for (let byte = offset; byte < view.byteLength; byte++) {
        view.setUint8(byte, (value >>> (8 * (byte - offset))) & 0xff);
      }
    }
  }
  return array;
}
