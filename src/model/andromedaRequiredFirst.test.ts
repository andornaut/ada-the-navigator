import { expect, it, vi } from "vitest";

import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { nearestSettlement, nearestSettlerStation } from "./andromedaPlaces.ts";
import { chapterRuntime } from "./chapters.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import type { SpaceObject } from "./types.ts";

function prepared() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked = [1, 3, 4, 5];
  model.state.prologueSeen = true;
  model.state.progress[5].opened = true;
  return model;
}

it("runs actual G5 launch initialization before optional chunks without selecting future story targets", () => {
  const model = prepared();
  const progress = model.state.progress[5];
  const runtime = chapterRuntime(5)!;
  const original = runtime.init!;
  const observations: { after: number; before: number; ids: string[]; optional: string[] }[] = [];
  const init = vi.spyOn(runtime, "init").mockImplementation((context) => {
    const before = context.flight.chunks.length;
    original(context);
    observations.push({
      after: context.flight.chunks.length,
      before,
      ids: context.flight.objects.map(({ id }) => id),
      optional: context.flight.objects
        .filter((object) => ["rock", "debris", "enemy"].includes(object.kind))
        .map(({ id }) => id),
    });
  });
  try {
    model.startGalaxy(5);
    const flight = model.state.flight!;
    expect(flight.galaxy).toBe(5);
    expect(observations[0]).toMatchObject({ after: 0, before: 0, optional: [] });
    expect(observations[0]!.ids).toEqual(
      expect.arrayContaining([ANDROMEDA_PLACES.beacon, ANDROMEDA_PLACES.pip]),
    );
    expect(flight.chunks.length).toBeGreaterThan(0);
    expect(observations.length).toBeGreaterThanOrEqual(2);
    expect(observations[1]!.before).toBeGreaterThan(0);
    expect(progress.andromeda).toBeUndefined();
    expect(progress.stage).toBe(0);
    expect(progress.known).toEqual([]);
    expect(progress.stations).toEqual([]);
    for (const id of [ANDROMEDA_PLACES.beacon, ANDROMEDA_PLACES.pip]) {
      expect(stationPopulationObjects(flight).filter((object) => object.id === id)).toHaveLength(1);
    }
  } finally {
    init.mockRestore();
  }
});

it("prepares remembered targets before population and retains their identities on repeated init", () => {
  const model = prepared();
  const progress = model.state.progress[5];
  const station = nearestSettlerStation(ECONOMY, { x: 5000, y: 5000 });
  const settlement = nearestSettlement(ECONOMY, station);
  progress.andromeda = { settlement: settlement.id, station: station.id };
  progress.stage = 4;
  progress.introduced = true;
  const targets = structuredClone(progress.andromeda);
  const runtime = chapterRuntime(5)!;
  const original = runtime.init!;
  let first: readonly SpaceObject[] | undefined;
  const init = vi.spyOn(runtime, "init").mockImplementation((context) => {
    const initial = first === undefined;
    if (initial) {
      expect(context.flight.chunks).toEqual([]);
    }
    original(context);
    if (initial) {
      expect(context.flight.chunks).toEqual([]);
      first = structuredClone(stationPopulationObjects(context.flight));
    }
  });
  try {
    model.startGalaxy(5);
    const flight = model.state.flight!;
    // Seeded stations may page out normally; the existing initializer resolves the same IDs.
    original({ content: CONTENT, flight, progress });
    const population = stationPopulationObjects(flight);
    for (const target of [station, settlement]) {
      expect(first!.filter(({ id }) => id === target.id)).toHaveLength(1);
      expect(first!.find(({ id }) => id === target.id)).toMatchObject({ x: target.x, y: target.y });
      expect(population.filter(({ id }) => id === target.id)).toHaveLength(1);
      expect(population.find(({ id }) => id === target.id)).toMatchObject({
        x: target.x,
        y: target.y,
      });
    }
    expect(population.find(({ id }) => id === settlement.id)?.role).toBe(
      ANDROMEDA_PLACES.settlement,
    );
    expect(progress.andromeda).toEqual(targets);
    expect(progress.stage).toBe(4);
    expect(progress.known).toEqual([]);
    expect(progress.stations).toEqual([]);
    const before = structuredClone(
      population.filter(({ id }) => id === station.id || id === settlement.id),
    );
    original({ content: CONTENT, flight, progress });
    expect(
      stationPopulationObjects(flight).filter(
        ({ id }) => id === station.id || id === settlement.id,
      ),
    ).toEqual(before);
  } finally {
    init.mockRestore();
  }
});
