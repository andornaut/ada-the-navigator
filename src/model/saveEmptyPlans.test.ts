import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { playOpening } from "../testing/launch.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";

it("retains an explicit empty route plan and rejects invalid or admitted outcomes", () => {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  playOpening(model);
  const document = model.saveDocument();
  const flight = document.flight!;
  const original = flight.combat ?? { initialPackSizes: {}, routeEncounters: [] };
  flight.combat = { ...original, routeEncounters: [] };
  const saved = JSON.parse(JSON.stringify(document));
  saved.flight.combat.emptyRoutePlans = ["growers"];
  expect(restoreSave(saved)).toEqual(saved);
  expect(restoreSave(JSON.stringify(saved))).toEqual(saved);
  for (const empty of [["growers", "growers"], ["unknown"], [3], "growers", null]) {
    const invalid = structuredClone(saved);
    invalid.flight.combat.emptyRoutePlans = empty;
    expect(restoreSave(invalid)).toBeNull();
  }
  saved.flight.combat.routeEncounters = ["growers"];
  expect(restoreSave(saved)).toBeNull();
  delete saved.flight.combat.emptyRoutePlans;
  expect(restoreSave(saved)).not.toBeNull();
});
