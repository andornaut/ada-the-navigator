import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight, ensureDestinationAt, spawnChapterEnemy } from "./flight.ts";
import { GameModel } from "./game.ts";
import { markerKnowledgeStore } from "./markerBindings.ts";
import type { SpaceObject } from "./types.ts";

function fixture() {
  const model = new GameModel(CONTENT, supportEntropy);
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
function boss(id: string, archetype: "capital" | "fighter" | "frigate" | "platform"): SpaceObject {
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
  it.each([false, true])(
    "binds the actual destination cue to only its stable direct guard (already identified=%s)",
    (identified) => {
      const { flight, model, store } = fixture();
      flight.objects = [];
      ensureDestinationAt(CONTENT, "quest", { x: 0, y: 0 }, flight);
      const guard = spawnChapterEnemy(CONTENT, "frigate", "cued-guard", { x: 2000, y: 0 }, flight, {
        routeId: "quest",
      })!;
      const escort = spawnChapterEnemy(
        CONTENT,
        "fighter",
        "uncued-escort",
        { x: 2100, y: 0 },
        flight,
        { escortOf: guard.id },
      )!;
      if (identified) {
        store.set(guard.id, "identified");
      }
      model.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
      expect(model.flightEvents).toContainEqual({ id: "quest", type: "guardCue" });
      expect(flight.guardCues).toContain("quest");
      delete flight.summonedGuards;
      expect(store.get(guard.id)).toBe(identified ? "identified" : "sensed");
      expect(store.get(escort.id)).toBeUndefined();
      expect(model.targetMarkers(GAME_AREA).find(({ id }) => id === guard.id)).toMatchObject({
        identified,
      });
      guard.x = 5001;
      guard.y = 0;
      expect(model.targetMarkers(GAME_AREA).some(({ id }) => id === guard.id)).toBe(false);
      guard.x = 5000;
      expect(model.targetMarkers(GAME_AREA).some(({ id }) => id === guard.id)).toBe(true);
    },
  );

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
  it("colours an independently sensed quest target without disclosing it", () => {
    const { flight, model, progress, store } = fixture();
    Object.assign(progress, { introduced: true, questItem: "food", stage: 1 });
    const workshop = {
      hp: 1,
      id: "workshop",
      kind: "destination",
      radius: 10,
      x: 2000,
      y: 0,
    } as const;
    flight.objects = [workshop];
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    expect(model.map?.places.map(({ id }) => id)).not.toContain("workshop");
    store.set(workshop.id, "sensed");
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: "workshop", identified: false, taskCategory: "story", x: 2000, y: 0 },
    ]);
    expect(store.get(workshop.id)).toBe("sensed");
    expect(model.map?.places.map(({ id }) => id)).not.toContain("workshop");
    progress.resolved = true;
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: "workshop", identified: false, taskCategory: "generic" },
    ]);
    expect(model.map?.places.map(({ id }) => id)).not.toContain("workshop");
    expect(store.get(workshop.id)).toBe("sensed");
    progress.resolved = false;
    progress.known.push(workshop.id);
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      {
        id: "workshop",
        identified: true,
        symbol: "workshop",
        taskCategory: "story",
        x: 2000,
        y: 0,
      },
    ]);
    expect(model.map?.places).toMatchObject([{ id: "workshop", taskCategory: "story" }]);
  });

  it("keeps one target and does not promote project catalogue or donation facts into a marker", () => {
    const { flight, model, progress } = fixture();
    Object.assign(progress, { introduced: true, questItem: "food", stage: 1 });
    progress.known.push("workshop");
    const workshop = {
      hp: 1,
      id: "workshop",
      kind: "destination",
      radius: 10,
      x: 2000,
      y: 0,
    } as const;
    flight.objects = [workshop];
    model.state.tasks[1] = {
      carrying: true,
      id: "carried-job",
      item: "seeds",
      kind: "job",
      reward: 17,
      station: "issuer",
      target: workshop,
      type: "delivery",
    };
    const check = (taskCategory: "story" | "job" | "generic") => {
      const edge = model.targetMarkers(GAME_AREA).filter(({ id }) => id === "workshop");
      const map = model.map!.places.filter(({ id }) => id === "workshop");
      expect(edge).toMatchObject([
        { identified: true, symbol: "workshop", taskCategory, x: 2000, y: 0 },
      ]);
      expect(map).toMatchObject([{ symbol: "workshop", taskCategory, x: 2000, y: 0 }]);
    };
    check("story");
    progress.resolved = true;
    check("job");
    delete model.state.tasks[1];
    check("generic");
    progress.donated.workshopCrane = 1;
    check("generic");
    flight.player.x = 2000 - TARGET_MARKER_RANGE - 1;
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    flight.player.x++;
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: "workshop", taskCategory: "generic" },
    ]);
    progress.donated.workshopCrane = 265;
    expect(model.targetMarkers(GAME_AREA)[0]).toMatchObject({ taskCategory: "generic" });
    expect(model.map!.places[0]).toMatchObject({ taskCategory: "generic" });
    expect(model.map!.places.map(({ id }) => id)).toEqual(["workshop"]);
  });

  it("does not disclose summoned ordinary quest or station guards outside range", () => {
    const { flight, model } = fixture();
    flight.objects = [boss("quest-frigate", "frigate"), boss("quest-platform", "platform")];
    flight.summonedGuards = flight.objects.map(({ id }) => id);
    flight.guardCues = ["workshop"];
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    expect(flight.markerActors).toBeUndefined();
  });
  it("limits distant disclosure to the active canonical flagship encounter and terminates it", () => {
    const { model } = fixture();
    const flight = createFlight(CONTENT, 6, 7, { known: [] });
    flight.player = { x: 0, y: 0 };
    model.state.flight = flight;
    const flagship = boss(PHANTOM_FLAGSHIP, "capital");
    flight.objects = [flagship, boss("escort", "fighter")];
    flight.phantom = {
      allies: [],
      allyTurn: 0,
      blockades: {},
      chatter: [],
      disabledCued: false,
      enemyIds: [PHANTOM_FLAGSHIP, "escort"],
      phase: "flagship",
      resolvedIds: [],
      wave: 3,
      waypoint: { x: 8000, y: 0 },
    };
    expect(model.targetMarkers(GAME_AREA).map(({ id }) => id)).toEqual([PHANTOM_FLAGSHIP]);
    flight.phantom.phase = "salvaged";
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    flagship.x = 4000;
    expect(model.targetMarkers(GAME_AREA).map(({ id }) => id)).toEqual([PHANTOM_FLAGSHIP]);
    flagship.x = 8000;
    flight.phantom.phase = "flagship";
    flagship.enemy!.disabled = true;
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
  });
});
