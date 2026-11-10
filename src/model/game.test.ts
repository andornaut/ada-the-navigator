import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import { ensureDestination } from "./flight.ts";
import { GameModel } from "./game.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launch(model: GameModel, sector: SectorId = 1) {
  model.startSector(sector);
  if (model.state.dialogue?.context === "opening") {
    model.choose("0");
  }
}
function arrive(model: GameModel, id: string) {
  const f = model.state.flight!;
  ensureDestination(PROTOTYPE, id, f);
  const target = f.objects.find((o) => o.id === id)!;
  f.player = { x: target.x, y: target.y };
  if (!model.state.progress[f.sector].known.includes(id)) {
    model.state.progress[f.sector].known.push(id);
  }
  model.state.dialogue = null;
  f.dangerFor = 0;
}
function talk(model: GameModel, id: string) {
  arrive(model, id);
  model.interact();
  model.choose("continue");
}
function finishHome(model: GameModel) {
  model.returnHome();
  model.choose("1");
  model.choose("continue");
}
function introduce(model: GameModel, id: string) {
  arrive(model, id);
  model.step(0.01, idle);
  model.choose("continue");
}

describe("prototype story and persistence", () => {
  it("preserves exact interrupted flight but regenerates after leaving, without repeating introductions", () => {
    const model = new GameModel(PROTOTYPE);
    launch(model);
    introduce(model, "growers");
    model.state.flight!.cargo = 3;
    model.state.flight!.shield = 43;
    model.state.flight!.weapon = "rapid";
    model.state.flight!.ammo = 7;
    model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    expect(model.state.flight!.shots.length).toBeGreaterThan(0);
    const saved = model.save();
    const resumed = new GameModel(PROTOTYPE, saved);
    expect(resumed.state).toEqual(model.state);
    resumed.step(0.05, idle);
    model.step(0.05, idle);
    expect(resumed.state).toEqual(model.state);
    const seed = resumed.state.flight!.seed;
    resumed.returnHome();
    launch(resumed);
    expect(resumed.state.flight!.seed).not.toBe(seed);
    expect(resumed.state.flight!.cargo).toBe(0);
    expect(resumed.state.flight!.weapon).toBe("basic");
    expect(resumed.state.progress[1].introduced).toBe(true);
    expect(resumed.state.progress[1].questItem).toBeNull();
    expect(resumed.state.dialogue).toBeNull();
    talk(resumed, "growers");
    expect(resumed.state.progress[1].questItem).toBe("food");
  });
  it("completes the delivery chain at the workshop and converges both Toronto responses", () => {
    for (const choice of ["0", "1"]) {
      const model = new GameModel(PROTOTYPE);
      model.startSector(1);
      model.choose(choice);
      introduce(model, "growers");
      talk(model, "workshop");
      expect(model.state.progress[1].questItem).toBe("toolkit");
      talk(model, "salvagers");
      expect(model.state.progress[1].questItem).toBe("parts");
      expect(model.state.progress[1].questComplete).toBe(false);
      talk(model, "workshop");
      expect(model.state.progress[1].questComplete).toBe(true);
      finishHome(model);
      expect(model.state.unlocked).toEqual([1, 2]);
      expect(new GameModel(PROTOTYPE, model.save()).state).toEqual(model.state);
    }
  });
  it("counts partial deposits and requires miner, visitors and a joint approach", () => {
    const model = new GameModel(PROTOTYPE);
    model.state.unlocked.push(2);
    launch(model, 2);
    introduce(model, "hub");
    for (let i = 0; i < 6; i++) {
      model.state.flight!.cargo = 4;
      talk(model, "hub");
    }
    expect(model.state.progress[2].deposited).toBe(24);
    expect(model.state.progress[2].questComplete).toBe(false);
    talk(model, "miner");
    talk(model, "visitors");
    model.state.flight!.cargo = 12;
    talk(model, "hub");
    expect(model.state.progress[2].questComplete).toBe(true);
    finishHome(model);
    expect(model.state.unlocked).toEqual([1, 2, 3]);
    expect(new GameModel(PROTOTYPE, model.save()).state).toEqual(model.state);
  });
  it("pauses flight during dialogue and does not advance exploration while standing still", () => {
    const model = new GameModel(PROTOTYPE);
    launch(model);
    const distance = model.state.flight!.freshDistance;
    for (let i = 0; i < 100; i++) {
      model.step(0.01, idle);
    }
    expect(model.state.flight!.freshDistance).toBe(distance);
    introduce(model, "growers");
    talk(model, "growers");
    model.interact();
    const snapshot = model.save();
    model.step(10, { ...idle, move: { x: 1, y: 0 } });
    expect(model.save()).toBe(snapshot);
  });
  it("blocks voluntary home travel in danger, retaining the exact flight", () => {
    const model = new GameModel(PROTOTYPE);
    launch(model);
    model.state.flight!.dangerFor = 3;
    const flight = model.state.flight;
    model.returnHome();
    expect(model.state.mode).toBe("space");
    expect(model.state.flight).toBe(flight);
    expect(model.state.notice).toBe(PROTOTYPE.labels.travelUnavailable);
  });
});

it("finishes all three chapters in order and resumes each terminal state", () => {
  const model = new GameModel(PROTOTYPE);
  launch(model);
  introduce(model, "growers");
  talk(model, "workshop");
  talk(model, "salvagers");
  talk(model, "workshop");
  finishHome(model);
  expect(model.state.unlocked).toEqual([1, 2]);
  expect(new GameModel(PROTOTYPE, model.save()).state).toEqual(model.state);
  launch(model, 2);
  introduce(model, "hub");
  model.state.flight!.cargo = PROTOTYPE.tuning.miningMilestones[1];
  talk(model, "hub");
  talk(model, "miner");
  talk(model, "visitors");
  model.state.flight!.cargo =
    PROTOTYPE.tuning.miningMilestones[2] - model.state.progress[2].deposited;
  talk(model, "hub");
  finishHome(model);
  expect(model.state.unlocked).toEqual([1, 2, 3]);
  expect(new GameModel(PROTOTYPE, model.save()).state).toEqual(model.state);
  launch(model, 3);
  introduce(model, "whale");
  const f = model.state.flight!;
  expect(f.objects.filter((o) => o.kind === "debris")).toHaveLength(
    PROTOTYPE.tuning.whaleDebris.count,
  );
  // Exercise the actual projectile/event path at each obstruction, without ambient enemies.
  f.objects = f.objects.filter((o) => o.kind === "destination" || o.kind === "debris");
  for (const debris of [...f.objects.filter((o) => o.kind === "debris")]) {
    f.player = { x: debris.x - 100, y: debris.y };
    f.velocity = { x: 0, y: 0 };
    for (let i = 0; i < 400 && f.objects.some((o) => o.id === debris.id); i++) {
      model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    }
    expect(f.objects.some((o) => o.id === debris.id)).toBe(false);
  }
  expect(model.state.progress[3].stage).toBe(2);
  model.returnHome();
  launch(model, 3);
  expect(model.state.flight!.objects.some((o) => o.kind === "debris")).toBe(false);
  talk(model, "whale");
  talk(model, "family");
  talk(model, "whale");
  expect(model.state.progress[3].questComplete).toBe(true);
  expect(model.state.mode).toBe("space");
  expect(new GameModel(PROTOTYPE, model.save()).state).toEqual(model.state);
  finishHome(model);
  expect(model.state.unlocked).toEqual([1, 2, 3]);
  expect(model.state.progress[3].resolved).toBe(true);
  expect(new GameModel(PROTOTYPE, model.save()).state).toEqual(model.state);
});

it("places whale debris offscreen and preserves pre-introduction clearing", () => {
  const model = new GameModel(PROTOTYPE);
  model.state.unlocked.push(2, 3);
  launch(model, 3);
  const f = model.state.flight!;
  f.freshDistance = PROTOTYPE.tuning.introFreshDistance;
  model.step(0.01, idle);
  const whale = f.objects.find((o) => o.id === "whale")!;
  expect(Math.hypot(whale.x - f.player.x, whale.y - f.player.y)).toBeGreaterThan(
    PROTOTYPE.tuning.chunkSize,
  );
  expect(model.state.dialogue).toBeNull();
  expect(model.state.progress[3].introduced).toBe(false);
  const debris = f.objects.filter((o) => o.kind === "debris");
  expect(debris).toHaveLength(PROTOTYPE.tuning.whaleDebris.count);
  f.objects = f.objects.filter((o) => o.kind === "destination" || o.kind === "debris");
  for (const obstruction of debris) {
    f.player = { x: obstruction.x - 300, y: obstruction.y };
    f.velocity = { x: 0, y: 0 };
    for (let i = 0; i < 400 && f.objects.some((o) => o.id === obstruction.id); i++) {
      model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    }
    expect(f.objects.some((o) => o.id === obstruction.id)).toBe(false);
  }
  expect(model.state.progress[3].introduced).toBe(false);
  expect(model.state.progress[3].stage).toBe(2);
  const restored = new GameModel(PROTOTYPE, model.save());
  expect(restored.state).toEqual(model.state);
  arrive(restored, "whale");
  restored.step(0.01, idle);
  expect(restored.state.dialogue?.text).toBe(PROTOTYPE.chapters[3].dialogue.freed?.text);
  expect(restored.state.progress[3].stage).toBe(3);
  expect(restored.state.flight!.objects.some((o) => o.kind === "debris")).toBe(false);
  restored.choose("continue");
  talk(restored, "family");
  talk(restored, "whale");
  expect(restored.state.progress[3].questComplete).toBe(true);
});

it("keeps remaining whale debris aligned when an unknown encounter is placed ahead again", () => {
  const model = new GameModel(PROTOTYPE);
  model.state.unlocked.push(2, 3);
  launch(model, 3);
  const f = model.state.flight!;
  f.freshDistance = PROTOTYPE.tuning.introFreshDistance;
  model.step(0.01, idle);
  const whale = f.objects.find((o) => o.id === "whale")!;
  const debris = f.objects.filter((o) => o.kind === "debris");
  const offsets = debris.map((o) => ({ x: o.x - whale.x, y: o.y - whale.y }));
  f.player = { x: whale.x + PROTOTYPE.tuning.chunkSize * 4, y: whale.y };
  f.velocity = { x: PROTOTYPE.tuning.maxSpeed, y: 0 };
  const chunkSize = PROTOTYPE.tuning.chunkSize;
  f.freshChunk = `${Math.floor(f.player.x / chunkSize)},${Math.floor(f.player.y / chunkSize)}`;
  model.step(0.01, { ...idle, move: { x: 1, y: 0 } });
  const relocated = f.objects.find((o) => o.id === "whale")!;
  expect(relocated.x).not.toBe(whale.x);
  debris.forEach((o, i) => {
    expect(o.x - relocated.x).toBeCloseTo(offsets[i]!.x);
    expect(o.y - relocated.y).toBeCloseTo(offsets[i]!.y);
    expect(f.objects).toContain(o);
  });
});

it("discovers the required encounter after reversing away from its first location", () => {
  const content = structuredClone(PROTOTYPE);
  content.tuning.introFreshDistance = 8;
  content.tuning.flight.objectsPerChunk = 0;
  const model = new GameModel(content);
  launch(model);
  const flight = model.state.flight!;
  for (let i = 0; i < 100 && !flight.objects.some((o) => o.id === "growers"); i++) {
    model.step(0.1, { ...idle, move: { x: 1, y: 0 } });
  }
  const pending = flight.objects.find((o) => o.id === "growers");
  expect(pending).toBeDefined();
  const originalX = pending!.x;
  expect(originalX - flight.player.x).toBeGreaterThan(content.tuning.chunkSize);
  expect(model.state.progress[1].known).toEqual([]);
  expect(model.state.dialogue).toBeNull();
  for (let i = 0; i < 300 && !model.state.dialogue; i++) {
    model.step(0.1, { ...idle, move: { x: -1, y: 0 } });
  }
  const discovered = flight.objects.find((o) => o.id === "growers")!;
  expect(discovered.x).toBeLessThan(originalX);
  expect(model.state.progress[1].known).toEqual(["growers"]);
  expect(model.state.progress[1].discoveries).toBe(1);
  expect(model.state.progress[1].introduced).toBe(true);
  expect(model.state.dialogue?.text).toBe(content.chapters[1].dialogue.grower?.text);
  expect(model.state.dialogue?.context).toBe("grower");
});
