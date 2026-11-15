import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { markerKnowledgeStore } from "./markerBindings.ts";
import type { SpaceObject } from "./types.ts";

function fixture() {
  const model = new GameModel(CONTENT);
  const flight = createFlight(CONTENT, 1, 7, { known: [] });
  flight.player = { x: 0, y: 0 };
  const cache: SpaceObject = {
    amount: 3,
    hp: 1,
    id: "cache:a",
    kind: "pickup",
    radius: 5,
    role: "discovery",
    x: 2000,
    y: 0,
  };
  flight.objects = [cache];
  Object.assign(model.state, { flight, mode: "space", prologueSeen: true, started: true });
  const progress = model.state.progress[1];
  const store = markerKnowledgeStore(progress, flight, (id) => id === "workshop");
  return { cache, flight, model, progress, store };
}
function boss(id: string, archetype: "capital" | "fighter"): SpaceObject {
  const definition = enemyDefinition(1, archetype, id);
  return {
    enemy: createEnemy(definition, { archetype, id, packId: null, phase: 0 }, { x: 8000, y: 0 }),
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: 10,
    routeId: "workshop",
    x: 8000,
    y: 0,
  };
}

describe("production unified marker facade", () => {
  it("identifies the retained facade target only after actual display", () => {
    const { cache, model, store } = fixture();
    store.set(cache.id, "sensed");
    expect(model.pennyMarkers(GAME_AREA)).toEqual(model.targetMarkers(GAME_AREA));
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([{ id: cache.id, identified: false }]);
    cache.x = 100;
    expect(model.targetMarkers(GAME_AREA, new Set([cache.id]))).toEqual([]);
    expect(store.get(cache.id)).toBe("sensed");
    model.markerTargetDisplayed(cache.id, new Set([cache.id]));
    cache.x = 2000;
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: cache.id, identified: true, item: "stardust" },
    ]);
    expect(model.state.progress[1].charted).toEqual([]);
    expect(model.state.progress[1].known).toEqual([]);
  });
  it("uses inclusive5000, hides outside it and restores the same target without narration or1400 cutoff", () => {
    const { cache, model, store } = fixture();
    store.set(cache.id, "sensed");
    cache.x = TARGET_MARKER_RANGE;
    expect(model.targetMarkers(GAME_AREA).map(({ id }) => id)).toEqual([cache.id]);
    cache.x++;
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    expect(store.get(cache.id)).toBe("sensed");
    cache.x = 1450;
    model.state.notice = "Another notice";
    expect(model.targetMarkers(GAME_AREA).map(({ id }) => id)).toEqual([cache.id]);
    expect(JOB_TUNING.hunt.penny).toBe(TARGET_MARKER_RANGE);
  });
  it("does not replace an existing marker with a nearer target and represents both sensed IDs", () => {
    const { cache, flight, model, store } = fixture();
    store.set(cache.id, "sensed");
    const other = { ...cache, id: "cache:near", x: 1000 };
    flight.objects.push(other);
    expect(model.targetMarkers(GAME_AREA).map(({ id }) => id)).toEqual([cache.id]);
    store.set(other.id, "sensed");
    expect(model.targetMarkers(GAME_AREA).map(({ id }) => id)).toEqual([cache.id, other.id]);
  });
  it("hides on screen without identifying and never treats absence as explicit removal", () => {
    const { cache, flight, model, store } = fixture();
    store.set(cache.id, "sensed");
    cache.x = 100;
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    expect(store.get(cache.id)).toBe("sensed");
    flight.objects = [];
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    expect(store.get(cache.id)).toBe("sensed");
    cache.x = 2000;
    flight.world.notables[cache.id] = cache;
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([{ id: cache.id, identified: false }]);
    flight.world.notables[cache.id] = null;
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    expect(store.get(cache.id)).toBeUndefined();
  });
  it("does not reveal a hidden destination because an accepted quest references it", () => {
    const { flight, model, progress } = fixture();
    progress.introduced = true;
    progress.stage = 1;
    flight.objects = [{ hp: 1, id: "workshop", kind: "destination", radius: 10, x: 2000, y: 0 }];
    const before = structuredClone(progress);
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    expect(progress).toEqual(before);
    model.markerTargetDisplayed("workshop");
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: "workshop", identified: true, symbol: "workshop" },
    ]);
    expect(progress.known).toEqual(before.known);
    expect(progress.charted).toEqual(before.charted);
    expect(progress.stage).toBe(before.stage);
  });
  it("merges known quest targets and ordinary knowledge without duplicate target identities", () => {
    const { flight, model, progress } = fixture();
    progress.introduced = true;
    progress.stage = 1;
    progress.known.push("workshop");
    flight.objects = [{ hp: 1, id: "workshop", kind: "destination", radius: 10, x: 2000, y: 0 }];
    expect(model.targetMarkers(GAME_AREA).filter(({ id }) => id === "workshop")).toHaveLength(1);
  });
  it("limits the distant exception to the actual triggered boss, ending it with the trigger", () => {
    const { flight, model } = fixture();
    flight.objects = [boss("boss", "capital"), boss("escort", "fighter")];
    flight.summonedGuards = ["boss", "escort"];
    expect(model.targetMarkers(GAME_AREA).map(({ id }) => id)).toEqual(["boss"]);
    delete flight.summonedGuards;
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    flight.objects[0]!.x = 4000;
    expect(model.targetMarkers(GAME_AREA).map(({ id }) => id)).toEqual(["boss"]);
  });
});
