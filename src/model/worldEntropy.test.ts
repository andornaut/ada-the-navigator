import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { GameModel, newGameState } from "./game.ts";
import { restoreSave } from "./save.ts";

it("constructs and restores an unvisited home save without drawing geography or launch entropy", () => {
  const random = vi.spyOn(crypto, "getRandomValues");
  random.mockClear();
  try {
    const state = newGameState();
    const game = new GameModel(CONTENT, supportEntropy);
    expect(newGameState()).toEqual(state);
    expect(restoreSave(game.save())).toEqual(game.state);
    expect(
      Object.values(state.progress).every((progress) => progress.geography === undefined),
    ).toBe(true);
    expect(random).not.toHaveBeenCalled();
  } finally {
    random.mockRestore();
  }
});

it("draws separate geography and enemy identities only on first entry and retains geography on reentry", () => {
  const game = new GameModel(CONTENT, supportEntropy);
  const random = vi.spyOn(crypto, "getRandomValues");
  random.mockClear();
  try {
    game.startGalaxy(1);
    const first = game.state.flight!;
    expect(random).toHaveBeenCalledTimes(2);
    expect(first.seed).toBe(game.state.progress[1].geography!.seed);
    expect(game.state.progress[1].geography!.sitePolicy).toBe("seeded");
    expect(first.encounterSeed).not.toBe(first.seed);
    game.returnHome();
    game.startGalaxy(1);
    expect(random).toHaveBeenCalledTimes(3);
    expect(game.state.flight!.seed).toBe(first.seed);
    expect(game.state.flight!.encounterSeed).not.toBe(first.encounterSeed);
  } finally {
    random.mockRestore();
  }
});

it("rejects active geography seed mismatches instead of substituting a seed on Continue", () => {
  const game = new GameModel(CONTENT, supportEntropy);
  game.startGalaxy(1);
  const saved = game.saveDocument();
  const flight = structuredClone(saved.flight);
  expect(restoreSave(saved)!.flight).toEqual(flight);
  saved.progress[1].geography!.seed = saved.flight!.seed + 1;
  expect(restoreSave(saved)).toBeNull();
  Object.assign(saved.progress[1].geography!, { seed: null, sitePolicy: "legacy-fixed" });
  expect(restoreSave(saved)).toBeNull();
  expect(saved.flight).toEqual(flight);
});
