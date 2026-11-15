import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import {
  createUnpopulatedFlight,
  ensureDestination,
  ensureRouteEncounter,
  populateRequiredChapterFlight,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations.ts";

function launch(reunited: boolean) {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 3];
  model.state.prologueSeen = true;
  model.state.progress[3].opened = true;
  if (reunited) {
    Object.assign(model.state.progress[3], {
      discoveries: 2,
      introduced: true,
      known: ["whale", "family"],
      markerKnowledge: { family: "identified", whale: "identified" },
      questComplete: true,
      stage: 5,
    });
  }
  model.startGalaxy(3);
  return model;
}

it("does not activate distance-gated whale, family or holodisk on an unfinished fresh launch", () => {
  const model = launch(false);
  expect(model.state.progress[3].known).toEqual([]);
  expect(model.state.flight!.freshDistance).toBe(0);
  expect(
    stationPopulationObjects(model.state.flight!).some(
      (object) =>
        ["whale", "family", "holodisk"].includes(object.id) || object.routeId !== undefined,
    ),
  ).toBe(false);
  expect(model.map!.places.some(({ id }) => ["whale", "family", "holodisk"].includes(id))).toBe(
    false,
  );
});

it("materializes the authored eligible holodisk frigate, swarm and support before optional chunks", () => {
  const model = new GameModel(CONTENT);
  const flight = createUnpopulatedFlight(CONTENT, 3, 173, model.state.economy, 301);
  populateRequiredChapterFlight(CONTENT, model.state.progress[3], flight, () => {
    ensureDestination(CONTENT, "holodisk", flight);
    const leader = ensureRouteEncounter(CONTENT, "holodisk", flight)!;
    expect(flight.chunks).toEqual([]);
    expect(leader.enemy!.archetype).toBe(HOLODISKS.guard.leader);
    const actors = stationPopulationObjects(flight);
    expect(actors.filter((actor) => actor.enemy?.packId === "route:holodisk:pack")).toHaveLength(
      HOLODISKS.guard.packSize,
    );
    expect(actors.filter((actor) => actor.enemy?.escortOf === leader.id)).toHaveLength(2);
  });
  expect(flight.chunks.length).toBeGreaterThan(0);
});

it("preserves eligible reentry roles, knowledge and strict Continue including a swarm casualty", () => {
  const model = launch(true);
  const flight = model.state.flight!;
  const actors = stationPopulationObjects(flight);
  const leader = actors.find((actor) => actor.routeId === "holodisk")!;
  expect(leader.enemy!.archetype).toBe(HOLODISKS.guard.leader);
  expect(actors.some((actor) => actor.routeId === "whale" || actor.routeId === "family")).toBe(
    false,
  );
  expect(model.state.progress[3].known).toEqual(["whale", "family"]);
  const beforeQueries = structuredClone(model.state);
  void model.map;
  void model.targetMarkers(GAME_AREA);
  void model.quests;
  void model.contextQuestDetails;
  expect(model.state).toEqual(beforeQueries);
  const casualty = actors.find((actor) => actor.enemy?.packId === "route:holodisk:pack")!;
  worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, casualty, flight);
  flight.objects = flight.objects.filter(({ id }) => id !== casualty.id);
  const resumed = new GameModel(CONTENT, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(flight);
  expect(stationPopulationObjects(resumed.state.flight!).some(({ id }) => id === casualty.id)).toBe(
    false,
  );
});
