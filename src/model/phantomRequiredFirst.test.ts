import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { createUnpopulatedFlight, populateRequiredChapterFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { initPhantom } from "./phantom.ts";
import { phantomRequiredActors } from "./phantomRequiredOccupants.ts";

it("constructs only the authored initial Phantom blockades before optional chunks", () => {
  const model = new GameModel(CONTENT);
  const progress = model.state.progress[6];
  const flight = createUnpopulatedFlight(CONTENT, 6, 173, model.state.economy, 301);
  let ids: string[] = [];
  populateRequiredChapterFlight(CONTENT, progress, flight, () => {
    expect(flight.chunks).toEqual([]);
    initPhantom({ content: CONTENT, flight, progress });
    expect(flight.chunks).toEqual([]);
    expect(flight.phantom!.wave).toBe(0);
    expect(flight.phantom!.enemyIds).toEqual([]);
    expect(Object.keys(flight.phantom!.blockades)).toEqual([...PHANTOM_DESTINATIONS]);
    ids = phantomRequiredActors(flight).map(({ id }) => id);
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
  ).toEqual(ids.sort());
});

it("keeps disabled initial members in required population and respects explicit removal", () => {
  const model = new GameModel(CONTENT);
  const progress = model.state.progress[6];
  const flight = createUnpopulatedFlight(CONTENT, 6, 173, model.state.economy, 301);
  initPhantom({ content: CONTENT, flight, progress });
  const actor = phantomRequiredActors(flight)[0]!;
  actor.enemy!.disabled = true;
  expect(phantomRequiredActors(flight).some(({ id }) => id === actor.id)).toBe(true);
  actor.hp = actor.enemy!.hp = 0;
  expect(phantomRequiredActors(flight).some(({ id }) => id === actor.id)).toBe(false);
});
