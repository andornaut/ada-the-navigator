import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { createUnpopulatedFlight, populateRequiredChapterFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { initPhantom } from "./phantom/index.ts";
import { readPendingPhantomEncounter } from "./phantom/pending/index.ts";
import { phantomRequiredActors } from "./phantom/reservations/index.ts";

it("activates initial Phantom blockades and reserves the next hidden wave before optional chunks", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  const progress = model.state.progress[6];
  const flight = createUnpopulatedFlight(CONTENT, 6, 173, model.state.economy, 301);
  let ids: string[] = [];
  let reserved: string[] = [];
  populateRequiredChapterFlight(CONTENT, progress, flight, () => {
    expect(flight.chunks).toEqual([]);
    initPhantom({ content: CONTENT, flight, progress });
    expect(flight.chunks).toEqual([]);
    expect(flight.phantom!.wave).toBe(0);
    expect(flight.phantom!.enemyIds).toEqual([]);
    expect(Object.keys(flight.phantom!.blockades)).toEqual([...PHANTOM_DESTINATIONS]);
    const pending = readPendingPhantomEncounter(flight)!;
    expect(pending).toMatchObject({ kind: "wave", wave: 1 });
    reserved = pending.actors.map(({ id }) => id);
    expect(reserved.length).toBeGreaterThan(0);
    const active = new Set(stationPopulationObjects(flight).map(({ id }) => id));
    expect(reserved.every((id) => !active.has(id))).toBe(true);
    ids = phantomRequiredActors(flight)
      .filter(({ id }) => active.has(id))
      .map(({ id }) => id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.some((id) => id.startsWith("phantom:wave:"))).toBe(false);
    expect(progress.known).toEqual([]);
  });
  const represented = new Set(stationPopulationObjects(flight).map(({ id }) => id));
  expect(ids.every((id) => represented.has(id))).toBe(true);
  expect(
    phantomRequiredActors(flight)
      .map(({ id }) => id)
      .sort(),
  ).toEqual([...ids, ...reserved].sort());
  expect(reserved.every((id) => !represented.has(id))).toBe(true);
});

it("keeps disabled initial members in required population and respects explicit removal", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  const progress = model.state.progress[6];
  const flight = createUnpopulatedFlight(CONTENT, 6, 173, model.state.economy, 301);
  initPhantom({ content: CONTENT, flight, progress });
  const actor = phantomRequiredActors(flight)[0]!;
  actor.enemy!.disabled = true;
  expect(phantomRequiredActors(flight).some(({ id }) => id === actor.id)).toBe(true);
  actor.hp = actor.enemy!.hp = 0;
  expect(phantomRequiredActors(flight).some(({ id }) => id === actor.id)).toBe(false);
});

it("reserves completed hulk geometry while represented and respects canonical paging removal", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  const progress = model.state.progress[6];
  progress.questComplete = true;
  const flight = createUnpopulatedFlight(CONTENT, 6, 173, model.state.economy, 301);
  populateRequiredChapterFlight(CONTENT, progress, flight, () => {
    initPhantom({ content: CONTENT, flight, progress });
    expect(phantomRequiredActors(flight).map(({ id }) => id)).toEqual([PHANTOM_FLAGSHIP]);
    expect(phantomRequiredActors(flight)[0]!.enemy).toMatchObject({ hp: 1, salvaged: true });
    expect(flight.phantom).toMatchObject({
      blockades: {},
      enemyIds: [],
      phase: "salvaged",
      wave: 0,
    });
  });
  expect(flight.world.notables[PHANTOM_FLAGSHIP]).toBeNull();
  expect(phantomRequiredActors(flight)).toEqual([]);
});
