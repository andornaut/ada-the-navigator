import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { playOpening } from "../testing/launch.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { createEnemy } from "./enemyAi.ts";
import { flightEncounterSeed, flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval } from "./geography.ts";
import { markerKnowledgeStore } from "./markerBindings.ts";
import { markerActorTracked } from "./markerKnowledge.ts";
import { restoreSave } from "./save.ts";
import {
  resolveTargetObject,
  TargetMarkerRegistry,
  type TargetResolution,
} from "./targetMarkers.ts";
import type { SpaceObject } from "./types.ts";

function fixture() {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  playOpening(model);
  const flight = model.state.flight!;
  flight.objects = [];
  flight.world.notables = {};
  flight.combat = { initialPackSizes: {}, routeEncounters: [] };
  model.state.dialogue = null;
  model.state.docked = null;
  const progress = model.state.progress[1];
  const store = markerKnowledgeStore(progress, flight, (id) => id === "growers");
  return { flight, model, progress, store };
}
function enemy(): SpaceObject {
  const definition = enemyDefinition(1, "fighter", "tracked", 2);
  const state = createEnemy(
    definition,
    { archetype: "fighter", id: "tracked", packId: "tracked-pack", phase: 0.75, weaponLevel: 2 },
    { x: 20000, y: 20000 },
  );
  state.age = 12;
  state.primaryCooldown = 0.37;
  return {
    enemy: state,
    hp: definition.hp,
    id: "tracked",
    kind: "enemy",
    persistent: false,
    radius: 10,
    x: 20000,
    y: 20000,
  };
}

describe("canonical marker save bindings", () => {
  it("queries optional ledgers without inserting fields, then writes canonical separate scopes", () => {
    const { flight, model, progress, store } = fixture();
    const before = model.saveDocument();
    expect(store.ids()).toEqual([]);
    expect(store.get("missing")).toBeUndefined();
    store.remove("missing");
    expect(Object.hasOwn(flight, "markerActors")).toBe(false);
    expect(Object.hasOwn(progress, "markerKnowledge")).toBe(false);
    expect(model.saveDocument()).toEqual(before);
    store.set("tracked", "sensed");
    store.set("growers", "identified");
    expect(flight.markerActors).toEqual({
      encounterSeed: flightEncounterSeed(flight),
      knowledge: { tracked: "sensed" },
    });
    expect(progress.markerKnowledge).toEqual({ growers: "identified" });
    expect(markerActorTracked(flight, "tracked")).toBe(true);
    expect(progress.known).toEqual(before.progress[1].known);
    expect(progress.charted).toEqual(before.progress[1].charted);
  });
  it("retains sensed and identified knowledge through actual save and Continue", () => {
    const { flight, model, progress, store } = fixture();
    const object = enemy();
    flight.objects = [object];
    flight.combat!.initialPackSizes["tracked-pack"] = 1;
    const achievements = structuredClone(model.state.achievements),
      before = structuredClone(progress);
    store.set("tracked", "sensed");
    store.set("growers", "identified");
    const saved = model.saveDocument();
    expect(restoreSave(saved)).not.toBeNull();
    const continued = new GameModel(CONTENT, saved);
    continued.continueGame();
    expect(continued.state.flight!.markerActors).toEqual(flight.markerActors);
    expect(continued.state.flight!.objects.find(({ id }) => id === object.id)).toEqual(object);
    expect(continued.state.progress[1]).toEqual({
      ...before,
      markerKnowledge: { growers: "identified" },
    });
    expect(continued.state.achievements).toEqual(achievements);
    expect(continued.state.flight!.time).toBe(flight.time);
  });
  it("writes a death tombstone before immediately clearing its knowledge", () => {
    const { flight, progress, store } = fixture();
    const object = enemy();
    flight.objects = [object];
    flight.combat!.initialPackSizes["tracked-pack"] = 1;
    store.set(object.id, "identified");
    store.set("growers", "sensed");
    object.hp = 0;
    expect(markerActorTracked(flight, object.id)).toBe(true);
    worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, object, flight);
    expect(Object.hasOwn(flight.world.notables, object.id)).toBe(true);
    expect(flight.world.notables[object.id]).toBeNull();
    const registry = new TargetMarkerRegistry();
    registry.forget({ store }, object.id);
    expect(markerActorTracked(flight, object.id)).toBe(false);
    expect(progress.markerKnowledge).toEqual({ growers: "sensed" });
  });
  it("keeps unresolved authority after loss of runtime materialization without last-point persistence", () => {
    const { flight, store } = fixture();
    store.set("unknown", "sensed");
    const registry = new TargetMarkerRegistry();
    expect(
      registry.evaluate(
        {
          area: GAME_AREA,
          player: flight.player,
          resolve: (): TargetResolution => ({ state: "unresolved" }),
          store,
        },
        [],
      ),
    ).toEqual([]);
    expect(store.get("unknown")).toBe("sensed");
    expect(resolveTargetObject(flight, "unknown")).toEqual({ state: "unresolved" });
  });
});
