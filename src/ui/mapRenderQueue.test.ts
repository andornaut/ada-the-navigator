import { describe, expect, it } from "vitest";

import { createMapPresentationRevision, createMapRenderQueue } from "./mapRenderQueue.ts";

function clock() {
  const callbacks: (() => void)[] = [];
  const cancelled: number[] = [];
  return {
    callbacks,
    cancelAnimationFrame: (id: number) => cancelled.push(id),
    cancelled,
    requestAnimationFrame(callback: () => void): number {
      callbacks.push(callback);
      return callbacks.length - 1;
    },
  };
}

describe("map render queue", () => {
  it("draws once for a burst, using the latest view after every input transformation", () => {
    const frames = clock();
    let view = 1;
    const draws: number[] = [];
    const queue = createMapRenderQueue(frames, () => draws.push(view));
    for (const factor of [1.5, 1.5, 1 / 1.5, 1.5]) {
      view *= factor;
      queue.schedule();
    }
    expect(frames.callbacks).toHaveLength(1);
    expect(draws).toEqual([]);
    frames.callbacks[0]!();
    expect(draws).toEqual([view]);
    queue.schedule();
    frames.callbacks[1]!();
    expect(draws).toEqual([view, view]);
  });

  it("cancels even frame zero and prevents a stale callback after synchronous drawing", () => {
    const frames = clock();
    const draws: string[] = [];
    const queue = createMapRenderQueue(frames, () => draws.push("queued"));
    queue.schedule();
    queue.cancel();
    draws.push("synchronous");
    frames.callbacks[0]!();
    expect(frames.cancelled).toEqual([0]);
    expect(draws).toEqual(["synchronous"]);
  });

  it("reopens after cancellation without losing the final redraw or admitting an old callback", () => {
    const frames = clock();
    const draws: number[] = [];
    let state = 1;
    const queue = createMapRenderQueue(frames, () => draws.push(state));
    queue.schedule();
    queue.cancel();
    state = 2;
    queue.schedule();
    frames.callbacks[0]!();
    expect(draws).toEqual([]);
    frames.callbacks[1]!();
    expect(draws).toEqual([2]);
  });

  it("never draws after disposal, including callbacks already handed to the frame clock", () => {
    const frames = clock();
    let draws = 0;
    const queue = createMapRenderQueue(frames, () => draws++);
    queue.schedule();
    queue.dispose();
    frames.callbacks[0]!();
    queue.schedule();
    expect(draws).toBe(0);
    expect(frames.callbacks).toHaveLength(1);
  });

  it("allows another request during drawing instead of dropping the final redraw", () => {
    const frames = clock();
    let draws = 0;
    const queue = createMapRenderQueue(frames, () => {
      draws++;
      if (draws === 1) {
        queue.schedule();
      }
    });
    queue.schedule();
    frames.callbacks[0]!();
    expect(frames.callbacks).toHaveLength(2);
    frames.callbacks[1]!();
    expect(draws).toBe(2);
  });
});

describe("map presentation revision", () => {
  const state = () => ({
    carrying: false,
    field: { background: "#d8c994", fog: "#c2b37f", name: "Sunflower" },
    inDanger: false,
    job: null,
    map: {
      explored: [{ x: 1, y: 2 }],
      facing: { x: 1, y: 0 },
      landmarks: { charted: 1, total: 12 },
      mapped: 10,
      places: [{ id: "station", label: "Station", x: 30, y: 40 }],
      player: { x: 0, y: 0 },
      quests: [{ target: "station", text: "Explore" }],
      searchArea: null,
    },
    towing: false,
  });

  it("skips identical content with new object identities", () => {
    const revision = createMapPresentationRevision();
    expect(revision.changed({}, state())).toBe(true);
    for (let i = 0; i < 100; i++) {
      expect(revision.changed({}, state())).toBe(false);
    }
  });

  it("compares captured content when the same objects mutate in place", () => {
    const revision = createMapPresentationRevision();
    const value = state();
    revision.changed({}, value);
    value.map.explored[0]!.x++;
    expect(revision.changed({}, value)).toBe(true);
    value.map.places[0]!.label = "Changed station";
    expect(revision.changed({}, value)).toBe(true);
    value.map.places.length = 0;
    expect(revision.changed({}, value)).toBe(true);
    expect(revision.changed({}, value)).toBe(false);
  });

  it.each(["carrying", "field", "inDanger", "job", "map", "towing"])(
    "invalidates on the full presentation field %s",
    (key) => {
      const revision = createMapPresentationRevision();
      const value = state();
      revision.changed({}, value);
      expect(revision.changed({}, { ...value, [key]: "changed" })).toBe(true);
    },
  );

  it.each([
    "explored",
    "facing",
    "landmarks",
    "mapped",
    "places",
    "player",
    "quests",
    "searchArea",
  ])("invalidates on current map field %s", (key) => {
    const revision = createMapPresentationRevision();
    const value = state();
    revision.changed({}, value);
    expect(revision.changed({}, { ...value, map: { ...value.map, [key]: "changed" } })).toBe(true);
  });

  it.each(["dimensions", "DPR", "theme", "fonts"])("invalidates on external %s", (kind) => {
    const revision = createMapPresentationRevision();
    const context = { kind, value: 1 };
    revision.changed(context, state());
    context.value++;
    expect(revision.changed(context, state())).toBe(true);
  });

  it("forgets the captured revision on close, reopen and explicit invalidation", () => {
    const revision = createMapPresentationRevision();
    revision.changed({}, state());
    revision.clear();
    expect(revision.changed({}, state())).toBe(true);
  });
});
