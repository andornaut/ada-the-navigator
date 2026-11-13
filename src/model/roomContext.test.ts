import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";

function boarding(galaxy: 4 | 6, announce: boolean): GameModel {
  const model = new GameModel(CONTENT);
  Object.assign(model.state, {
    announceGalaxy: announce,
    prologueSeen: true,
    selectedGalaxy: galaxy,
    started: true,
    unlocked: [...GALAXY_NUMBERS],
  });
  for (const progress of Object.values(model.state.progress)) {
    progress.opened = true;
  }
  model.state.progress[galaxy].opened = false;
  model.continueGame();
  const bound = model.storyView!.run.pages.length;
  for (let index = 0; !model.roomPage && index < bound; index++) {
    if (model.storyView!.page.choices?.length) {
      model.storyChoose(0);
    } else {
      model.storyNext();
    }
  }
  expect(model.roomPage).toBe(true);
  model.storyNext();
  expect(model.storyView?.page.id).toBe("boarding:0");
  return model;
}

describe("Same-visit room and boarding context", () => {
  it.each([false, true])(
    "persists recorder narration and exact boarding state (announce %s)",
    (announce) => {
      const model = boarding(4, announce);
      expect(model.storyView?.page.background).toBe("adaRoomRecorder");
      expect(model.storyView?.page.speaker).toBeUndefined();
      const page = model.storyView?.page;
      const before = model.saveDocument();
      expect(before.pendingStory?.cursor.current.scene.background).toBe("adaRoomRecorder");
      model.backToTitle();
      expect(model.saveDocument()).toEqual(before);
      const loaded = new GameModel(CONTENT, model.save());
      loaded.continueGame();
      expect(loaded.storyView?.page).toEqual(page);
      expect(loaded.saveDocument()).toEqual(before);
    },
  );

  it.each([false, true])(
    "persists invitation narration and exact boarding state (announce %s)",
    (announce) => {
      const model = boarding(6, announce);
      const page = model.storyView?.page;
      expect(page?.background).toBe("adaRoomInvitations");
      const before = model.saveDocument();
      expect(before.pendingStory?.cursor.current.scene.background).toBe("adaRoomInvitations");
      const loaded = new GameModel(CONTENT, model.save());
      loaded.continueGame();
      expect(loaded.storyView?.page).toEqual(page);
      expect(loaded.saveDocument()).toEqual(before);
    },
  );

  it.each(["adaRoomRecorderDad", "grandmaGarden", "adaRoomInvented"])(
    "rejects %s as a persisted room context",
    (background) => {
      const model = boarding(4, false);
      const saved = model.saveDocument();
      Object.assign(saved.pendingStory!.cursor.current.scene, { background });
      expect(restoreSave(saved)).toBeNull();
    },
  );
});
