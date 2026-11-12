import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { readStory } from "../testing/launch.ts";
import { GameModel } from "./game.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

/** Sunflower's flight carrying the food, a delivery item, ore and a tow line. */
function loaded(): GameModel {
  const model = new GameModel(PROTOTYPE);
  Object.assign(model.state, { prologueSeen: true, started: true });
  model.state.progress[1].opened = true;
  model.startSector(1);
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

  it("keeps the held job's item and the story's item on Earth, losing ore and the tow", () => {
    const model = loaded();
    model.returnHome();
    expect(model.state.flight).toBeNull();
    expect(model.state.tasks[1]).toMatchObject({ carrying: true });
    expect(model.state.progress[1].questItem).toBe("food");
    readStory(model);
    model.startSector(1);
    // The next flight starts with no ore and no tow, the items still aboard.
    expect(model.state.flight!.cargo).toBe(0);
    expect(model.state.flight!.tow).toBeUndefined();
    expect(model.state.progress[1].questItem).toBe("food");
    expect(model.state.tasks[1]).toMatchObject({ carrying: true });
  });

  /** An enemy shot depletes the shield where Ada is, as jump.test.ts does. */
  const deplete = (model: GameModel) => {
    const flight = model.state.flight!;
    flight.objects = [];
    delete flight.tow;
    flight.shield = PROTOTYPE.tuning.enemyDamage;
    flight.shots.push({
      ...flight.player,
      enemy: true,
      hitIds: [],
      id: "hit",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    });
    model.step(0.01, idle);
  };

  it("says on the jump-home page when ore was lost, and keeps the job's item", () => {
    const model = loaded();
    deplete(model);
    const page = model.storyView?.page;
    expect(page?.id).toBe("jumpHome");
    expect(page?.text).toContain(PROTOTYPE.labels.jumpHomeOreLost);
    expect(model.state.tasks[1]).toMatchObject({ carrying: true });
    // Without ore aboard the page keeps its one line.
    const empty = loaded();
    empty.state.flight!.cargo = 0;
    deplete(empty);
    expect(empty.storyView?.page.text).toBe(PROTOTYPE.labels.jumpHome);
  });
});
