import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { readStory, supportEntropy } from "../testing/launch.ts";
import { ensureDestination } from "./flight.ts";
import { GameModel, newGameState } from "./game.ts";
import { activateFlightRegion } from "./geography.ts";

it("steps a Phantom objective approach with the existing tiny travel delta", () => {
  const initial = newGameState();
  initial.started = initial.prologueSeen = true;
  initial.unlocked = [...GALAXY_NUMBERS];
  for (const id of GALAXY_NUMBERS.filter((id) => id !== 6)) {
    Object.assign(initial.progress[id], {
      holodisk: true,
      introduced: true,
      opened: true,
      questComplete: true,
      resolved: true,
    });
  }
  const model = new GameModel(CONTENT, supportEntropy, initial);
  model.continueGame();
  readStory(model);
  model.startGalaxy(6);
  const flight = model.state.flight!;
  const target = ensureDestination(CONTENT, PHANTOM_DESTINATIONS[0]!, flight);
  flight.player = { x: target.x, y: target.y };
  activateFlightRegion(CONTENT, flight.player, flight);
  const before = flight.time;
  const guards = [...flight.phantom!.blockades[PHANTOM_DESTINATIONS[0]!]!];
  expect(guards.length).toBeGreaterThan(0);
  model.step(0.000001, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
  expect(flight.time - before).toBeCloseTo(0.000001, 10);
  expect(flight.phantom!.blockades[PHANTOM_DESTINATIONS[0]!]).toEqual(guards);
});
