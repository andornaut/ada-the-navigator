import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { GameModel } from "../model/game.ts";
import { restoreSave } from "../model/save.ts";
import type { FlightInput } from "../model/types.ts";
import { relaunch } from "../testing/launch.ts";
import { storyPageView } from "../ui/storybook.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function depleted() {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.state.progress[1].opened = true;
  model.state.economy.stardust = 17;
  model.startGalaxy(1);
  const flight = model.state.flight!;
  flight.objects = [];
  flight.cargo = 5;
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
  model.step(0.01, idle);
  expect(model.storyView?.page.id).toBe("jumpHome");
  return model;
}
function morning(model: GameModel): void {
  model.storyNext();
  model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds);
  expect(model.storyView?.page.id).toBe("morning");
}

describe("depletion story navigation", () => {
  it("Previous from morning returns to a navigable page, and Next never replays the interlude", () => {
    const model = depleted();
    morning(model);
    for (let count = 0; count < 3; count++) {
      model.storyPrevious();
      const view = model.storyView!;
      expect(view.page.id).toBe("jumpHome");
      expect(storyPageView(view.page, view.choices, view.canGoBack, view.canSkip)).toMatchObject({
        next: true,
      });
      expect(view.page.sleep).not.toBe(true);
      model.storyNext();
      expect(model.storyView?.page.id).toBe("morning");
    }
  });

  it.each(["jumpHome", "morning", "room"])(
    "Skip from %s crosses internal scenes to the galaxy map once",
    (start) => {
      const model = depleted();
      if (start !== "jumpHome") {
        morning(model);
      }
      if (start === "room") {
        model.storyNext();
      }
      const economy = structuredClone(model.state.economy);
      expect(model.storyView?.canSkip).toBe(true);
      model.storySkip();
      expect(model.screen).toBe("selector");
      expect(model.state.economy).toEqual(economy);
      expect(model.state.economy.cargo).toBe(3);
      model.storySkip();
      expect(model.state.economy).toEqual(economy);
      expect(model.state.economy.stardust).toBe(17);
    },
  );

  it("retains the depletion continuation and outcomes through save and Continue", () => {
    const model = depleted();
    morning(model);
    const save = model.save();
    expect(restoreSave(save)).not.toBeNull();
    const loaded = relaunch(CONTENT, save);
    loaded.continueGame();
    loaded.storySkip();
    expect(loaded.screen).toBe("selector");
    expect(loaded.state.economy.cargo).toBe(3);
    expect(loaded.state.economy.stardust).toBe(17);
  });

  it("shows Skip wherever Next shows and stops at a meaningful choice without selecting it", () => {
    const model = depleted();
    model.state.progress[1].questComplete = true;
    model.state.progress[1].holodisk = true;
    model.storySkip();
    expect(model.storyView?.choices.length).toBeGreaterThan(0);
    const before = structuredClone(model.state);
    model.storySkip();
    expect(model.state).toEqual(before);
    expect(model.state.progress[1].resolved).toBe(false);
    model.storyChoose(0);
    model.storySkip();
    expect(model.state.progress[1].resolved).toBe(true);
    expect(new Set(model.state.achievements.unlocked).size).toBe(
      model.state.achievements.unlocked.length,
    );
  });
});
