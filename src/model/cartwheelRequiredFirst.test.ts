import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { cartwheelRequiredSites } from "./cartwheelRequiredSites.ts";
import {
  activateRequiredCartwheelRoute,
  createUnpopulatedFlight,
  planRequiredCartwheelRoute,
  populateRequiredChapterFlight,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { readRequiredRolePlan } from "./requiredRolePlans.ts";
import { worldDistance } from "./worldContacts.ts";

it("reserves the hub capital and held buoy geometry before optional chunks without exposing future actors", () => {
  const model = new GameModel(CONTENT);
  const progress = model.state.progress[2];
  const flight = createUnpopulatedFlight(CONTENT, 2, 173, model.state.economy, 301);
  populateRequiredChapterFlight(CONTENT, progress, flight, () => {
    planRequiredCartwheelRoute(CONTENT, progress, flight);
    expect(flight.chunks).toEqual([]);
    expect(flight.objects).toEqual([]);
    expect(Object.keys(flight.requiredPlans!)).toEqual(["hub"]);
    expect(readRequiredRolePlan(flight, "hub")).toMatchObject({
      actors: [{ enemy: { archetype: "capital" }, id: "route:hub", routeId: "hub" }],
      role: "cartwheel-capital",
    });
  });
  const plan = readRequiredRolePlan(flight, "hub")!;
  const sites = [
    plan.site,
    ...cartwheelRequiredSites(flightWorldContext(flight), plan.site, ["miner", "visitors"]),
  ];
  const rocks = stationPopulationObjects(flight).filter(({ kind }) => kind === "rock");
  for (const site of sites) {
    for (const rock of rocks) {
      expect(worldDistance(flightWorldContext(flight), site, rock)).toBeGreaterThan(
        CONTENT.tuning.exclusionRadius + rock.radius,
      );
    }
  }
  expect(progress.known).toEqual([]);
});

it("keeps actual Cartwheel launch reads hidden and Continue exact, then transfers the same capital once", () => {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 3, 4, 5, 2];
  model.state.prologueSeen = true;
  model.state.progress[2].opened = true;
  model.startGalaxy(2);
  const flight = model.state.flight!;
  expect(readRequiredRolePlan(flight, "hub")).not.toBeNull();
  const before = structuredClone(model.state);
  expect(model.map!.places.some(({ id }) => ["hub", "miner", "visitors"].includes(id))).toBe(false);
  void model.quests;
  void model.contextQuestDetails;
  expect(model.state).toEqual(before);
  const resumed = new GameModel(CONTENT, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(flight);
  const plan = readRequiredRolePlan(flight, "hub")!;
  const actor = plan.actors[0]!;
  expect(activateRequiredCartwheelRoute(CONTENT, model.state.progress[2], flight, "hub")).toBe(
    true,
  );
  expect(stationPopulationObjects(flight).find(({ id }) => id === actor.id)).toBe(actor);
  expect(activateRequiredCartwheelRoute(CONTENT, model.state.progress[2], flight, "hub")).toBe(
    true,
  );
  expect(stationPopulationObjects(flight).filter(({ id }) => id === actor.id)).toHaveLength(1);
  expect(flight.combat!.routeEncounters.filter((id) => id === "hub")).toHaveLength(1);
  expect(flight.requiredPlans?.hub).toBeUndefined();
});

it("activates the reserved hub through the actual intro-distance caller without revealing its buoy regulars", () => {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 3, 4, 5, 2];
  model.state.prologueSeen = true;
  model.state.progress[2].opened = true;
  model.startGalaxy(2);
  const flight = model.state.flight!;
  const plan = readRequiredRolePlan(flight, "hub")!;
  expect(plan).not.toBeNull();
  flight.freshDistance = CONTENT.tuning.introFreshDistance;
  model.step(0.001, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
  expect(readRequiredRolePlan(flight, "hub")).toBeNull();
  expect(stationPopulationObjects(flight).some(({ id }) => id === "route:hub")).toBe(true);
  expect(flight.objects.some(({ id }) => id === "miner" || id === "visitors")).toBe(false);
  expect(model.state.progress[2].known).toEqual([]);
  const resumed = new GameModel(CONTENT, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(flight);
});
