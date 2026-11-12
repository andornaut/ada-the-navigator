import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { sectorEncounters } from "../data/enemy-catalog.ts";
import { byPosition, SECTORS } from "../data/galaxies.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { galaxyCard } from "../data/storybook.ts";
import type { SectorId } from "../data/types.ts";
import { currentInCell } from "./currents.ts";
import { createFlight, stepFlight } from "./flight.ts";
import { GameModel, newProgress } from "./game.ts";
import { landmarkSites } from "./landmarks.ts";
import { oreFieldInCell } from "./ore-fields.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import { readStory } from "./test-launch.ts";
import type { SpaceObject } from "./types.ts";

const PLACEHOLDERS = [4, 5, 6] as const satisfies readonly SectorId[];
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

// Every object a flight loads across a wide spread of its galaxy.
function flown(sector: SectorId): SpaceObject[] {
  const flight = createFlight(PROTOTYPE, sector, 7, { known: [] });
  const seen = new Map<string, SpaceObject>();
  for (let x = -12000; x <= 12000; x += 4000) {
    for (let y = -12000; y <= 12000; y += 4000) {
      flight.player = { x, y };
      stepFlight(PROTOTYPE, 0.001, idle, flight);
      for (const object of flight.objects) {
        seen.set(object.id, object);
      }
    }
  }
  return [...seen.values()];
}

// Reads story pages, the second choice on choice pages, until the unlocked galaxies change.
function readToUnlock(model: GameModel): void {
  const before = model.state.unlocked.length;
  for (let turn = 0; turn < 60 && model.state.unlocked.length === before; turn++) {
    const page = model.storyView?.page;
    if (!page) {
      return;
    }
    if (page.choices) {
      model.storyChoose(Math.min(1, page.choices.length - 1));
    } else {
      model.storyNext();
    }
  }
}

// A galaxy's quest done and its holodisk in, flown, so returning home plays its resolution.
function questDone(galaxy: SectorId, unlocked: SectorId[]): GameModel {
  const model = new GameModel(PROTOTYPE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked });
  for (const id of SECTORS) {
    model.state.progress[id].opened = true;
  }
  model.startSector(galaxy);
  Object.assign(model.state.progress[galaxy], {
    holodisk: true,
    introduced: true,
    questComplete: true,
    stage: galaxy === 1 ? 4 : 5,
  });
  return model;
}

describe("placeholder galaxies", () => {
  it.each(PLACEHOLDERS)("galaxy %i flies with generic enemies and rocks only", (sector) => {
    const objects = flown(sector);
    const kinds = new Set(objects.map(({ kind }) => kind));
    expect(kinds.has("enemy")).toBe(true);
    expect(kinds.has("rock")).toBe(true);
    // No stations, story destinations or current debris; resource rocks are generic chunk rocks
    // in every galaxy, and ore fields are checked below.
    for (const kind of ["station", "destination"] as const) {
      expect(kinds.has(kind), kind).toBe(false);
    }
    expect(objects.some((object) => object.river)).toBe(false);
    // Enemies come from the tuning table it reads, the built galaxy before it on the route.
    const roster = new Set(byPosition(sectorEncounters, sector).map(({ archetype }) => archetype));
    for (const object of objects.filter(({ kind }) => kind === "enemy")) {
      expect(roster.has(object.enemy!.archetype), object.enemy!.archetype).toBe(true);
    }
    expect(stationsNear(ECONOMY, sector, 40000, { x: 0, y: 0 })).toEqual([]);
    expect(landmarkSites(sector)).toEqual([]);
    for (let x = -4; x <= 4; x++) {
      for (let y = -4; y <= 4; y++) {
        expect(currentInCell(sector, { x, y })).toBeNull();
        expect(oreFieldInCell(sector, { x, y })).toBeNull();
      }
    }
  });

  it.each(PLACEHOLDERS)("galaxy %i has no story, holodisk or objective", (sector) => {
    const model = new GameModel(PROTOTYPE);
    Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...SECTORS] });
    model.startSector(sector);
    expect(model.state.flight?.sector).toBe(sector);
    expect(model.objective).toBe("");
    for (let step = 0; step < 200; step++) {
      model.step(0.05, { ...idle, move: { x: 1, y: 0 } });
    }
    expect(model.state.progress[sector]).toMatchObject({ holodisk: false, known: [], stage: 0 });
    expect(model.state.flight!.objects.some(({ kind }) => kind === "destination")).toBe(false);
  });
});

describe("unlocking along the route", () => {
  it("unlocks Whirlpool after Sunflower", () => {
    const model = questDone(1, [1]);
    model.returnHome();
    readStory(model, 1);
    expect(model.state.unlocked).toEqual([1, 3]);
    expect(model.selectedGalaxy).toBe(3);
    expect(model.selectedPosition).toBe(2);
  });

  it("unlocks the placeholders after Whirlpool with Cartwheel, and opens on Cartwheel", () => {
    const model = questDone(3, [1, 3]);
    model.returnHome();
    readStory(model, 1);
    expect(model.state.unlocked).toEqual([1, 3, 4, 5, 2]);
    // Cartwheel's story is built, so Astra announced it at boarding.
    expect(model.selectedGalaxy).toBe(2);
    expect(model.selectedPosition).toBe(5);
    // Paging back reaches each placeholder, and Jump flies to one.
    model.pageGalaxy(-1);
    expect(model.selectedGalaxy).toBe(5);
    expect(model.jump()).toBe(true);
    expect(model.state.flight?.sector).toBe(5);
  });

  it("announces a new galaxy only when one with a built story unlocks", () => {
    // Whirlpool unlocks Cartwheel with the placeholders, so Astra will announce it.
    const whirlpool = questDone(3, [1, 3]);
    whirlpool.returnHome();
    readToUnlock(whirlpool);
    expect(whirlpool.state.unlocked).toEqual([1, 3, 4, 5, 2]);
    expect(whirlpool.state.announceGalaxy).toBe(true);
    // Cartwheel unlocks Black Eye alone, a placeholder, so no announcement.
    const cartwheel = questDone(2, [1, 3, 4, 5, 2]);
    cartwheel.returnHome();
    readToUnlock(cartwheel);
    expect(cartwheel.state.unlocked).toEqual([1, 3, 4, 5, 2, 6]);
    expect(cartwheel.state.announceGalaxy).toBe(false);
    readStory(cartwheel, 1);
    expect(cartwheel.selectedGalaxy).toBe(6);
    expect(cartwheel.selectedPosition).toBe(6);
  });
});

describe("saves from before the placeholder galaxies", () => {
  // A three-galaxy save: progress for galaxies 1 to 3 only, Sunflower complete and Cartwheel
  // unlocked under the old order.
  function legacySave(): Record<string, unknown> {
    const model = new GameModel(PROTOTYPE);
    Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 2] });
    Object.assign(model.state.progress[1], {
      charted: [],
      deposited: 12,
      holodisk: true,
      introduced: true,
      known: ["growers", "workshop", "salvagers"],
      opened: true,
      questComplete: true,
      resolved: true,
      stage: 4,
    });
    Object.assign(model.state.progress[2], { introduced: true, known: ["hub"], stage: 2 });
    model.state.economy.stardust = 345;
    const saved = JSON.parse(model.save()) as Record<string, unknown>;
    const progress = saved.progress as Record<string, unknown>;
    for (const id of PLACEHOLDERS) {
      delete progress[id];
    }
    return saved;
  }

  it("loads with every galaxy's progress intact, the placeholders new", () => {
    const saved = legacySave();
    const restored = restoreSave(JSON.stringify(saved));
    expect(restored).not.toBeNull();
    const progress = saved.progress as Record<string, unknown>;
    for (const id of [1, 2, 3] as const) {
      expect(restored!.progress[id]).toEqual(progress[id]);
    }
    for (const id of PLACEHOLDERS) {
      expect(restored!.progress[id]).toEqual(newProgress());
    }
    expect(restored!.economy.stardust).toBe(345);
    expect(restored!.selectedSector).toBe(1);
  });

  it("keeps every stored unlock and adds the route's: Whirlpool after Sunflower", () => {
    const restored = restoreSave(JSON.stringify(legacySave()))!;
    expect(restored.unlocked).toEqual([1, 2, 3]);
    const model = new GameModel(PROTOTYPE, JSON.stringify(legacySave()));
    expect(galaxyCard(3).name).toBe("Whirlpool");
    expect(model.isUnlocked(3)).toBe(true);
    expect(model.isUnlocked(2)).toBe(true);
    expect(model.isUnlocked(4)).toBe(false);
  });
});
