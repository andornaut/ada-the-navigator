import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import { isNeedleCourseStart, NEEDLE } from "../data/needle.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight, ensureDestinationAt, spawnChapterEnemy } from "./flight.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { markerKnowledgeStore } from "./markerBindings.ts";
import { needleCourses } from "./needle.ts";
import type { SpaceObject } from "./types.ts";
import { wrapPoint } from "./worldGeometry.ts";

function fixture() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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
  it.each([
    ["practice", "needlePractice", "Practice channel", 0],
    ["eye", "needleEye", "The Eye", NEEDLE.practiceGates],
  ] as const)(
    "tracks the %s flag and then each automatic ring through the live registry",
    (course, id, label, practiceLit) => {
      const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
      Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [1, 4] });
      const progress = model.state.progress[4];
      progress.opened = true;
      model.startGalaxy(4);
      const flight = model.state.flight!;
      const { gates, path } = needleCourses(flight)![course];
      const [flag] = path;
      const [first, second] = gates;
      const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
      const markers = () =>
        model.targetMarkers(GAME_AREA).filter(({ id }) => isNeedleCourseStart(id));
      const indicator = () => model.indicatorTargets.filter(({ id }) => isNeedleCourseStart(id));
      const current = () =>
        model.targetMarkers(GAME_AREA).filter(({ trackedLabel }) => trackedLabel !== undefined);
      progress.introduced = true;
      expect(markers()).toEqual([]);
      Object.assign(progress.needle!, {
        approach: "independent",
        briefed: true,
        met: true,
        practiceLit,
        practiceThanked: course === "eye",
      });
      // A player half a galaxy away on the opposite canonical side sees the nearest image.
      const side = flight.topology!.side;
      const direction = Math.sign(flag!.x) || 1;
      flight.player = { x: -direction * (side / 2 - 1), y: flag!.y };
      expect(markers()).toMatchObject([
        {
          id,
          onScreen: false,
          symbol: "destination",
          trackedLabel: label,
          x: flag!.x - direction * side,
          y: flag!.y,
        },
      ]);
      expect(indicator()).toEqual([]);
      const [flagMarker] = markers();
      expect(model.markerDetails(flagMarker!)).toMatchObject({
        details: { quests: [{ id: model.trackedQuestId }], targetId: id },
        kind: "quest",
      });
      expect(progress.markerKnowledge?.[id]).toBeUndefined();
      const entry = { ...flag!, id, kind: "objective" };
      flight.player = { x: flag!.x + 500, y: flag!.y };
      expect(indicator()).toEqual([entry]);

      flight.player = { ...flag! };
      model.step(0.001, idle);
      expect(progress.known).toContain(id);
      expect(
        flight.objects.find((object) => object.id === id) ?? flight.world.notables[id],
      ).toMatchObject(flag!);
      expect(first!.point).not.toEqual(flag);
      expect(indicator()).toEqual([{ ...first!.point, id, kind: "objective" }]);
      expect(markers()).toMatchObject([{ ...first!.point, id, trackedLabel: "Ring 1" }]);
      expect(model.markerDetails(flagMarker!)).toBeNull();
      const [ringMarker] = markers();
      expect(model.markerDetails(ringMarker!)).toMatchObject({
        details: { quests: [{ id: model.trackedQuestId }], targetId: id },
        kind: "quest",
      });

      flight.player = {
        x: first!.point.x - first!.tangent.x * 0.1,
        y: first!.point.y - first!.tangent.y * 0.1,
      };
      flight.velocity = { x: first!.tangent.x * 20, y: first!.tangent.y * 20 };
      model.step(0.05, {
        ...idle,
        move: { x: first!.tangent.x * 0.25, y: first!.tangent.y * 0.25 },
      });
      expect(indicator()).toEqual([{ ...second!.point, id, kind: "objective" }]);
      expect(markers()).toMatchObject([{ ...second!.point, id, trackedLabel: "Ring 2" }]);
      flight.player = { ...second!.point };
      expect(markers()).toMatchObject([
        { ...second!.point, id, onScreen: true, trackedLabel: "Ring 2" },
      ]);

      const target = wrapPoint(side, { x: flight.player.x + 6000, y: flight.player.y });
      model.state.tasks[4] = {
        id: "needle-hunt",
        item: "a ring",
        kind: "job",
        reward: 17,
        spot: { x: target.x, y: target.y + 100 },
        station: "station:issuer",
        target: { ...target, id: "" },
        type: "hunt",
      };
      expect(model.trackQuest("job:4:needle-hunt")).toBe(true);
      expect(indicator()).toEqual([]);
      expect(markers()).toEqual([]);
      const [huntMarker] = current();
      expect(huntMarker).toMatchObject({
        id: "job:needle-hunt:search",
        trackedLabel: "Search area",
      });
      expect(model.markerDetails(huntMarker!)).toMatchObject({
        details: { quests: [{ id: "job:4:needle-hunt" }], targetId: "job:needle-hunt:search" },
        kind: "quest",
      });
      expect(model.dropJob()).toBe(true);
      expect(model.markerDetails(huntMarker!)).toBeNull();
      expect(current()).toMatchObject([{ ...second!.point, id, trackedLabel: "Ring 2" }]);
    },
  );

  it("tracks only the current known story step and keeps an ordinary marker at the same ID", () => {
    const { flight, model, progress } = fixture();
    flight.topology = CURRENT_FLIGHT_TOPOLOGY;
    Object.assign(progress, { introduced: true, questItem: "food", stage: 1 });
    const workshop = ensureDestinationAt(
      CONTENT,
      "workshop",
      { x: -GALAXY_SIDE / 2 + 5000, y: 0 },
      flight,
    );
    const growers = ensureDestinationAt(CONTENT, "growers", { x: 90000, y: 0 }, flight);
    flight.player = { x: GALAXY_SIDE / 2 - 100, y: 0 };
    progress.known.push(growers.id);
    expect(model.trackedQuestId).toBe("story:1:1");
    expect(model.targetMarkers(GAME_AREA)).toEqual([]);
    progress.known.push(workshop.id);
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      {
        id: workshop.id,
        onScreen: false,
        symbol: "workshop",
        trackedLabel: "Workshop",
        x: workshop.x + GALAXY_SIDE,
      },
    ]);
    const [workshopMarker] = model.targetMarkers(GAME_AREA);
    expect(model.markerDetails(workshopMarker!)).toMatchObject({
      details: { quests: [{ id: "story:1:1" }], targetId: workshop.id },
      kind: "quest",
    });
    flight.player = { x: workshop.x, y: workshop.y };
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: workshop.id, onScreen: true, trackedLabel: "Workshop" },
    ]);
    progress.questItem = null;
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: growers.id, onScreen: false, trackedLabel: "Grower" },
    ]);
  });

  it("updates a tracked delivery from its known destination to its issuer and falls back on drop", () => {
    const { flight, model, progress } = fixture();
    Object.assign(progress, { introduced: true, questItem: "food", stage: 1 });
    const workshop = ensureDestinationAt(CONTENT, "workshop", { x: 8000, y: 0 }, flight);
    const growers = ensureDestinationAt(CONTENT, "growers", { x: 7100, y: 0 }, flight);
    const salvagers = ensureDestinationAt(CONTENT, "salvagers", { x: 8500, y: 0 }, flight);
    progress.known.push(workshop.id, growers.id, salvagers.id);
    model.state.tasks[1] = {
      carrying: true,
      id: "delivery",
      item: "seeds",
      kind: "job",
      reward: 17,
      station: growers.id,
      target: salvagers,
      type: "delivery",
    };
    expect(model.trackQuest("job:1:delivery")).toBe(true);
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: salvagers.id, symbol: "salvagers", trackedLabel: "Salvager" },
    ]);
    model.state.tasks[1].carrying = false;
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: growers.id, symbol: "growers", trackedLabel: "Grower" },
    ]);
    expect(model.dropJob()).toBe(true);
    expect(model.trackedQuestId).toBe("story:1:1");
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: workshop.id, symbol: "workshop", trackedLabel: "Workshop" },
    ]);
  });

  it("guides to a tracked hunt's disclosed area and never to its hidden pickup", () => {
    const { flight, model, progress, store } = fixture();
    flight.objects = [];
    model.state.tasks[1] = {
      id: "hunt",
      item: "a ring",
      kind: "job",
      reward: 17,
      spot: { x: 8700, y: 0 },
      station: "station:unknown",
      target: { id: "", x: 8200, y: 0 },
      type: "hunt",
    };
    const before = structuredClone(progress);
    expect(model.trackQuest("job:1:hunt")).toBe(true);
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      {
        id: "job:hunt:search",
        jobType: "hunt",
        onScreen: false,
        symbol: "job",
        taskCategory: "job",
        trackedLabel: "Search area",
        x: 8200,
      },
    ]);
    expect(store.get("job:hunt")).toBeUndefined();
    expect(store.get("job:hunt:search")).toBeUndefined();
    expect(progress).toEqual(before);
    flight.player = { x: 8200, y: 0 };
    expect(model.targetMarkers(GAME_AREA)).toMatchObject([
      { id: "job:hunt:search", onScreen: true, x: 8200 },
    ]);
  });
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
  it("resolves only marker projections from the current visible flight without changing discovery", () => {
    const { cache, flight, model, progress, store } = fixture();
    store.set(cache.id, "sensed");
    const [sensed] = model.targetMarkers(GAME_AREA);
    const before = structuredClone(model.state);
    expect(model.markerDetails(sensed!)).toEqual({
      kind: "point",
      point: { category: "discovery", identified: false, symbol: sensed!.symbol },
    });
    expect(model.state).toEqual(before);
    expect(model.markerDetails({ ...sensed!, identified: true })).toBeNull();

    cache.x = 100;
    expect(model.markerDetails(sensed!)).toBeNull();
    cache.x = TARGET_MARKER_RANGE + 1;
    expect(model.markerDetails(sensed!)).toBeNull();
    cache.x = 2000;
    model.markerTargetDisplayed(cache.id, new Set([cache.id]));
    expect(model.markerDetails(sensed!)).toBeNull();
    const [identified] = model.targetMarkers(GAME_AREA);
    expect(model.markerDetails(identified!)).toEqual({
      kind: "point",
      point: { category: "discovery", identified: true, label: "Stardust", symbol: sensed!.symbol },
    });
    expect(progress.known).toEqual([]);
    expect(progress.charted).toEqual([]);

    cache.hp = 0;
    expect(model.markerDetails(identified!)).toBeNull();
    expect(store.get(cache.id)).toBe("identified");
    cache.hp = 1;
    model.state.flight = structuredClone(flight);
    expect(model.markerDetails(identified!)).toBeNull();
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
