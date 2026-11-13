import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { readStory } from "../testing/launch.ts";
import { GameModel } from "./game.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

/** Sunflower's flight carrying the food, a delivery item, ore and a tow line. */
function loaded(): GameModel {
  const model = new GameModel(CONTENT);
  Object.assign(model.state, { prologueSeen: true, started: true });
  model.state.progress[1].opened = true;
  model.startGalaxy(1);
  readStory(model);
  model.state.dialogue = null;
  const flight = model.state.flight!;
  flight.objects = flight.objects.filter((object) => !object.enemy);
  flight.dangerFor = 0;
  flight.cargo = 3;
  flight.tow = { x: flight.player.x + 50, y: flight.player.y };
  model.state.progress[1].questItem = "food";
  model.state.tasks[1] = {
    carrying: true,
    id: "job:9",
    item: "seeds",
    kind: "job",
    reward: 15,
    station: "station:0,0",
    target: { id: "workshop", x: 0, y: 0 },
    type: "delivery",
  };
  return model;
}

describe("what each event keeps (rules.md)", () => {
  it("keeps the flight on Back to title, and Continue resumes it exactly", () => {
    const model = loaded();
    const flight = model.state.flight!;
    const player = { ...flight.player };
    model.backToTitle();
    expect(model.state.mode).toBe("home");
    // The save keeps the flight, its ore, tow and carried items.
    const saved = JSON.parse(model.save()) as { flight: typeof flight; mode: string };
    expect(saved.mode).toBe("space");
    expect(saved.flight).toMatchObject({ cargo: 3, player, tow: flight.tow });
    model.continueGame();
    expect(model.state.mode).toBe("space");
    expect(model.state.flight).toBe(flight);
    expect(model.state.flight!.cargo).toBe(3);
    expect(model.state.flight!.tow).toEqual(flight.tow);
    expect(model.state.tasks[1]).toMatchObject({ carrying: true });
    expect(model.state.progress[1].questItem).toBe("food");
  });

  it("keeps the held job's item, the story's item and all ore on Earth, losing the tow", () => {
    const model = loaded();
    model.returnHome();
    expect(model.state.flight).toBeNull();
    expect(model.state.tasks[1]).toMatchObject({ carrying: true });
    expect(model.state.progress[1].questItem).toBe("food");
    // The ore waits with its galaxy through a save.
    expect(JSON.parse(model.save())).toMatchObject({ progress: { 1: { cargo: 3 } } });
    readStory(model);
    model.startGalaxy(1);
    // The next flight starts with the ore and no tow, the items still aboard.
    expect(model.state.flight!.cargo).toBe(3);
    expect(model.state.progress[1].cargo).toBeUndefined();
    expect(model.state.flight!.tow).toBeUndefined();
    expect(model.state.progress[1].questItem).toBe("food");
    expect(model.state.tasks[1]).toMatchObject({ carrying: true });
  });

  /** An enemy shot depletes the shield where Ada is, as jump.test.ts does. */
  const deplete = (model: GameModel) => {
    const flight = model.state.flight!;
    flight.objects = [];
    delete flight.tow;
    flight.shield = 1;
    flight.shots.push({
      ...flight.player,
      damage: 1,
      enemy: true,
      hitIds: [],
      id: "hit",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    });
    model.step(0.01, idle);
  };

  it("keeps all ore jumping to another galaxy by choice, aboard that galaxy's next flight", () => {
    const model = loaded();
    model.state.unlocked.push(3);
    expect(model.openGalaxyMap()).toBe(true);
    model.stepGalaxy(1);
    expect(model.jump()).toBe(true);
    expect(model.state.flight!.galaxy).not.toBe(1);
    expect(model.state.flight!.cargo).toBe(0);
    expect(model.state.progress[1].cargo).toBe(3);
  });

  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [11, 6],
  ])("keeps ceil(n / 2) of %i ore on a shield-failure jump: %i", (carried, kept) => {
    const model = loaded();
    model.state.flight!.cargo = carried;
    const stardust = model.state.economy.stardust;
    deplete(model);
    expect(model.state.progress[1].cargo).toBe(kept);
    expect(model.state.economy.stardust).toBe(stardust);
    const page = model.storyView?.page;
    expect(page?.id).toBe("jumpHome");
    // The page names lost ore only when some was lost.
    expect(page?.text.includes(CONTENT.labels.jumpHomeOreLost ?? "")).toBe(kept < carried);
    readStory(model);
    model.startGalaxy(1);
    expect(model.state.flight!.cargo).toBe(kept);
  });

  it("says on the jump-home page when ore was lost, and keeps the job's item", () => {
    const model = loaded();
    deplete(model);
    const page = model.storyView?.page;
    expect(page?.id).toBe("jumpHome");
    expect(page?.text).toContain(CONTENT.labels.jumpHomeOreLost);
    expect(CONTENT.labels.jumpHomeOreLost).toBe(
      'Astra: "We\'re safe, and that matters most. We lost half the ore we were carrying."',
    );
    expect(model.state.tasks[1]).toMatchObject({ carrying: true });
    // Without ore aboard the page keeps its one line.
    const empty = loaded();
    empty.state.flight!.cargo = 0;
    deplete(empty);
    expect(empty.storyView?.page.text).toBe(CONTENT.labels.jumpHome);
  });
});
