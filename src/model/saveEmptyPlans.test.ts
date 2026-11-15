import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ensureDestination, ensureRouteEncounter } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";

it("rejects obsolete nonempty route journals while preserving valid active saves", () => {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  const flight = model.state.flight!;
  ensureDestination(CONTENT, "growers", flight);
  const guard = ensureRouteEncounter(CONTENT, "growers", flight)!;
  expect(guard).not.toBeNull();
  expect(guard.enemy!.hp).toBeGreaterThan(0);
  expect(flight.combat!.routeEncounters).toContain("growers");
  expect(flight.combat!.routeEncounters).not.toContain("workshop");
  const saved = model.saveDocument();
  expect(restoreSave(saved)).toEqual(saved);
  saved.flight!.combat!.emptyRoutePlans = [];
  expect(restoreSave(saved)).toEqual(saved);
  expect(restoreSave(JSON.stringify(saved))).toEqual(saved);

  const invalid = structuredClone(saved);
  invalid.flight!.combat!.emptyRoutePlans = ["workshop"];
  expect(restoreSave(invalid)).toBeNull();
  const reset = new GameModel(CONTENT, invalid);
  expect(reset.state.flight).toBeNull();
  expect(reset.state.mode).toBe("home");

  for (const journal of [
    ["growers"],
    ["workshop", "workshop"],
    ["unknown"],
    [3],
    "growers",
    null,
  ]) {
    const malformed = JSON.parse(JSON.stringify(saved));
    malformed.flight.combat.emptyRoutePlans = journal;
    expect(restoreSave(malformed)).toBeNull();
  }
  delete saved.flight!.combat!.emptyRoutePlans;
  expect(restoreSave(saved)).toEqual(saved);
});
