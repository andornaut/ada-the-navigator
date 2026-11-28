import { expect, it } from "vitest";

import { WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import {
  createUnpopulatedFlight,
  ensureDestination,
  ensureDestinationAt,
  ensureRouteEncounter,
  populateRequiredChapterFlight,
} from "./flight/index.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval, worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { storeRequiredRolePlan } from "./requiredRolePlans.ts";
import { flightWorldContext } from "./world/index.ts";

function launch(reunited: boolean) {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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
  expect(leader.enemy!.archetype).toBe("capital");
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
  const casualty = actors.find(
    (actor) => actor.enemy?.packId === WHIRLPOOL_CAPITAL_BOSS.swarmPack,
  )!;
  worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, casualty, flight);
  flight.objects = flight.objects.filter(({ id }) => id !== casualty.id);
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(flight);
  expect(stationPopulationObjects(resumed.state.flight!).some(({ id }) => id === casualty.id)).toBe(
    false,
  );
});

it.each(["pending", "active", "dormant", "defeated", "unplanned"] as const)(
  "starts Sounder from a legacy %s disk encounter without releasing the disk",
  (legacy) => {
    const model = launch(false);
    const before = model.state.flight!;
    const progress = model.state.progress[3];
    const savedSite = structuredClone(progress.requiredSites!.holodisk!);
    const flight = createUnpopulatedFlight(CONTENT, 3, before.seed, model.state.economy, 301);
    flight.topology = before.topology!;
    Object.assign(progress, {
      introduced: true,
      known: ["whale", "family"],
      questComplete: true,
      stage: 5,
    });
    populateRequiredChapterFlight(CONTENT, progress, flight, () => {
      for (const id of progress.known) {
        ensureDestinationAt(CONTENT, id, progress.requiredSites![id]!, flight);
      }
      if (legacy === "unplanned") {
        delete progress.requiredSites!.holodisk;
        return;
      }
      const site = ensureDestinationAt(CONTENT, "holodisk", savedSite, flight);
      const leader = ensureRouteEncounter(CONTENT, site.id, flight)!;
      expect(leader.enemy?.archetype).toBe(HOLODISKS.guard.leader);
      if (legacy === "defeated") {
        worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, leader, flight);
        flight.objects = flight.objects.filter((object) => object !== leader);
      }
      if (legacy === "pending") {
        const actors = [
          leader,
          ...flight.objects.filter(
            (object) =>
              object.enemy?.escortOf === leader.id ||
              object.enemy?.packId === "route:holodisk:pack",
          ),
        ];
        flight.objects = flight.objects.filter(
          (object) => object !== site && !actors.includes(object),
        );
        delete flight.combat;
        storeRequiredRolePlan(progress, flight, { actors, role: "whirlpool-holodisk", site });
      }
      if (legacy === "active") {
        flight.player = { x: leader.x + 300, y: leader.y };
      }
    });
    model.state.flight = flight;
    if (legacy === "dormant") {
      expect(flight.world.notables["route:holodisk"]?.enemy?.archetype).toBe(
        HOLODISKS.guard.leader,
      );
    }
    expect(restoreSave(model.save())).not.toBeNull();
    const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
    resumed.continueGame();
    const active = resumed.state.flight!;
    const replacement = stationPopulationObjects(active).find(
      (actor) => actor.routeId === "holodisk",
    );
    expect(replacement).toMatchObject({
      enemy: { archetype: "capital" },
      id: WHIRLPOOL_CAPITAL_BOSS.id,
    });
    expect(resumed.state.progress[3].sounder).toEqual({ phase: "active" });
    const live = stationPopulationObjects(active);
    expect(live.filter((actor) => actor.enemy?.escortOf === replacement!.id)).toHaveLength(2);
    expect(
      live.filter((actor) => actor.enemy?.packId === WHIRLPOOL_CAPITAL_BOSS.swarmPack),
    ).toHaveLength(4);
    expect(live.some((actor) => actor.id === "route:holodisk" || actor.id === "holodisk")).toBe(
      false,
    );
    const diskSite = resumed.state.progress[3].requiredSites!.holodisk!;
    if (legacy !== "unplanned") {
      expect(diskSite).toEqual(savedSite);
    }
    expect(resumed.map?.places.find((place) => place.id === "holodisk")).toMatchObject(diskSite);
    active.player = { ...diskSite };
    worldSyncFlightRegion(flightWorldContext(active), CONTENT, active);
    resumed.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    expect(resumed.state.progress[3].holodisk).toBe(false);
    expect(resumed.state.progress[3].sounder).toEqual({ phase: "active" });
  },
);
