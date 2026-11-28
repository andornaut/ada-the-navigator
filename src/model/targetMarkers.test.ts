import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { ensureDestination } from "./flight/index.ts";
import { GameModel } from "./game.ts";
import {
  resolveTargetObject,
  type TargetContribution,
  type TargetKnowledgeRecord,
  TargetMarkerRegistry,
  type TargetResolution,
} from "./targetMarkers.ts";

function fixture() {
  const registry = new TargetMarkerRegistry();
  const knowledge: TargetKnowledgeRecord = {};
  const states = new Map<string, TargetResolution>();
  const context = {
    area: GAME_AREA,
    knowledge,
    player: { x: 0, y: 0 },
    resolve: (id: string): TargetResolution => states.get(id) ?? { state: "unresolved" },
  };
  const put = (id: string, x = 2000, identified = false) =>
    states.set(id, { identified, point: { x, y: 0 }, state: "present", symbol: "station" });
  const run = (...contributions: TargetContribution[]) => registry.evaluate(context, contributions);
  return { context, knowledge, put, registry, run, states };
}

describe("unified authoritative target registry", () => {
  it("merges same-target contributors and changes its real glyph on the same entry after identification", () => {
    const f = fixture();
    f.put("station");
    expect(
      f.run({ id: "station", source: "sensed" }, { id: "station", source: "quest" }),
    ).toMatchObject([{ id: "station", identified: false }]);
    const entry = f.registry.entries()[0];
    f.put("station", 2000, true);
    expect(f.run({ id: "station", source: "ordinary" })).toEqual([
      { id: "station", identified: true, symbol: "station", x: 2000, y: 0 },
    ]);
    expect(f.registry.entries()[0]).toBe(entry);
    expect([...entry!.contributors]).toEqual(["ordinary"]);
  });
  it("has one inclusive5000 policy; range exit hides without forgetting and reentry restores", () => {
    const f = fixture();
    f.put("a", TARGET_MARKER_RANGE);
    expect(f.run({ id: "a", source: "sensed" })).toHaveLength(1);
    const entry = f.registry.entries()[0];
    f.put("a", TARGET_MARKER_RANGE + 1);
    expect(f.run()).toEqual([]);
    expect(f.knowledge).toEqual({ a: "sensed" });
    f.put("a", 1450);
    expect(f.run()[0]?.id).toBe("a");
    expect(f.registry.entries()[0]).toBe(entry);
    f.put("a", 1400);
    expect(f.run()).toHaveLength(1);
  });
  it("retains multiple targets without narration, nearest replacement or a runtime object array", () => {
    const f = fixture();
    f.put("a", 4000);
    f.put("b", 3000);
    f.run({ id: "a", source: "sensed" }, { id: "b", source: "sensed" });
    expect(f.run().map(({ id }) => id)).toEqual(["a", "b"]);
    f.states.set("a", { state: "unresolved" });
    expect(f.run().map(({ id }) => id)).toEqual(["b"]);
    expect(f.knowledge.a).toBe("sensed");
    f.put("a", 4000);
    expect(f.run()).toHaveLength(2);
    f.states.set("a", { state: "removed" });
    expect(f.run()).toHaveLength(1);
    expect(f.knowledge.a).toBeUndefined();
  });
  it("roundtrips knowledge while resolving current authoritative positions, never saved coordinates", () => {
    const f = fixture();
    f.put("a");
    f.put("b", 3000, true);
    f.run({ id: "a", source: "sensed" }, { id: "b", source: "ordinary" });
    const knowledge: TargetKnowledgeRecord = JSON.parse(JSON.stringify(f.knowledge));
    const restored = new TargetMarkerRegistry();
    f.put("a", 4100);
    expect(restored.evaluate({ ...f.context, knowledge }, [])).toMatchObject([
      { id: "a", identified: false, x: 4100 },
      { id: "b", identified: true },
    ]);
    expect(Object.keys(knowledge)).toEqual(["a", "b"]);
  });
  it("resets transient entries when the owner changes the knowledge scope", () => {
    const f = fixture();
    f.put("old-actor", 2000, true);
    f.run({ id: "old-actor", source: "ordinary" });
    expect(f.registry.evaluate({ ...f.context, knowledge: {} }, [])).toEqual([]);
    expect(f.registry.entries()).toEqual([]);
    expect(f.knowledge["old-actor"]).toBe("identified");
  });

  it("does not admit hidden quest references; only explicit disclosures or sensing admit unknowns", () => {
    const f = fixture();
    f.put("hidden");
    expect(f.run({ id: "hidden", source: "quest" })).toEqual([]);
    expect(f.knowledge).toEqual({});
    expect(
      f.run({ id: "hidden", source: "sensed" }, { id: "hidden", source: "quest" }),
    ).toMatchObject([{ identified: false }]);
    f.put("authored");
    expect(
      f
        .run({ disclosed: true, id: "authored", source: "quest" })
        .find(({ id }) => id === "authored")?.identified,
    ).toBe(true);
  });
  it("hides on-screen without identifying through projection and restores beyond the view", () => {
    const f = fixture();
    f.put("a", 100);
    expect(f.run({ id: "a", source: "sensed" })).toEqual([]);
    expect(f.knowledge.a).toBe("sensed");
    f.put("a", 1000);
    expect(f.run()[0]?.identified).toBe(false);
  });
  it("pins a known scan lead without making it the tracked quest", () => {
    const f = fixture();
    f.put("patrol", 100, true);
    expect(f.run({ id: "patrol", source: "scan" })).toMatchObject([
      { id: "patrol", identified: true, onScreen: true },
    ]);
    expect(f.run({ id: "patrol", source: "scan" })[0]).not.toHaveProperty("trackedLabel");
    expect(f.run()).toEqual([]);
  });
  it("adds a known tracked target to the same entry across the wrapped edge and on screen", () => {
    const f = fixture();
    const tracked = { id: "station", label: "Station" };
    const context = { ...f.context, tracked, worldSide: 20000 };
    f.context.player.x = 9700;
    f.put("station", -4500, true);
    f.put("ordinary", -4400, true);
    const contributions = [
      { id: "station", source: "ordinary" },
      { id: "station", source: "quest" },
      { id: "ordinary", source: "ordinary" },
    ] as const;
    expect(f.registry.evaluate(context, contributions)).toEqual([
      {
        id: "station",
        identified: true,
        onScreen: false,
        symbol: "station",
        trackedLabel: "Station",
        x: 15500,
        y: 0,
      },
    ]);
    const entry = f.registry.entries().find(({ id }) => id === "station");
    f.put("station", -9990, true);
    f.context.player.x = 9900;
    expect(f.registry.evaluate(context, contributions)).toMatchObject([
      { id: "station", onScreen: true, x: 10010 },
    ]);
    expect(f.registry.entries().find(({ id }) => id === "station")).toBe(entry);
    expect(f.registry.evaluate({ ...f.context, worldSide: 20000 }, contributions)).toEqual([]);
  });
  it("keeps a disclosed tracked waypoint transient and never promotes a sensed item", () => {
    const f = fixture();
    f.put("hidden-item", 8000);
    f.put("area", 8500);
    f.run({ id: "hidden-item", source: "sensed" });
    expect(
      f.registry.evaluate({ ...f.context, tracked: { id: "hidden-item", label: "Lost item" } }, []),
    ).toEqual([]);
    expect(
      f.registry.evaluate(
        { ...f.context, tracked: { id: "area", label: "Search area", revealed: true } },
        [],
      ),
    ).toMatchObject([{ id: "area", identified: true, trackedLabel: "Search area", x: 8500 }]);
    expect(f.knowledge).toEqual({ "hidden-item": "sensed" });
    expect(f.run()).toEqual([]);
    expect(f.registry.entries().map(({ id }) => id)).toEqual(["hidden-item"]);
  });
  it("uses shortest wrapped distance and a distant encounter marker while its contribution is active", () => {
    const f = fixture();
    f.context.player.x = 4900;
    f.put("seam", -100);
    expect(
      f.registry.evaluate({ ...f.context, worldSide: 10000 }, [{ id: "seam", source: "sensed" }]),
    ).toMatchObject([{ x: -100 }]);
    f.context.player.x = 0;
    f.put("boss", 8000);
    expect(
      f
        .run({ disclosed: true, distant: true, id: "boss", source: "encounter" })
        .some(({ id }) => id === "boss"),
    ).toBe(true);
    expect(f.run({ id: "boss", source: "quest" }).some(({ id }) => id === "boss")).toBe(false);
    expect(f.knowledge.boss).toBe("identified");
    f.states.set("boss", { state: "removed" });
    f.run();
    expect(f.knowledge.boss).toBeUndefined();
  });
});

describe("production world object resolver", () => {
  it("prefers loaded state, preserves actual retained identity and distinguishes tombstones from absence", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.prologueSeen = true;
    model.startGalaxy(1);
    const flight = model.state.flight!;
    const object = ensureDestination(CONTENT, "growers", flight);
    flight.world.notables[object.id] = null;
    expect(resolveTargetObject(flight, object.id)).toEqual({ object, state: "present" });
    flight.objects = flight.objects.filter(({ id }) => id !== object.id);
    flight.world.notables[object.id] = object;
    const result = resolveTargetObject(flight, object.id);
    expect(result.state).toBe("present");
    if (result.state === "present") {
      expect(result.object).toBe(object);
    }
    delete flight.world.notables[object.id];
    expect(resolveTargetObject(flight, object.id)).toEqual({ state: "unresolved" });
    flight.world.notables[object.id] = null;
    expect(resolveTargetObject(flight, object.id)).toEqual({ state: "removed" });
    flight.objects.push({ ...object, hp: 0 });
    expect(resolveTargetObject(flight, object.id)).toEqual({ state: "removed" });
  });
});
