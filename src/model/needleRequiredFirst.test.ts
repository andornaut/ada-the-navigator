import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { createUnpopulatedFlight, populateRequiredChapterFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { needleCourses } from "./needle.ts";
import { planNeedleExit } from "./needleExitPlan.ts";
import { initNeedle } from "./needleRuntime.ts";

it("initializes authored G4 sites and swarm before any optional chunks without changing known sites", () => {
  const model = new GameModel(CONTENT);
  const progress = model.state.progress[4];
  const flight = createUnpopulatedFlight(CONTENT, 4, 173, model.state.economy, 301);
  let ids: string[] = [];
  populateRequiredChapterFlight(CONTENT, progress, flight, () => {
    expect(flight.chunks).toEqual([]);
    initNeedle({ content: CONTENT, flight, progress });
    expect(flight.chunks).toEqual([]);
    expect(
      flight.objects.every(
        (object) => object.kind === "destination" || object.enemy?.packId === "needle:exit",
      ),
    ).toBe(true);
    const layout = needleCourses(flight)!;
    ids = planNeedleExit(flight.seed, layout.eye.pack).map(({ id }) => id);
    expect(
      stationPopulationObjects(flight)
        .filter((object) => object.enemy?.packId === "needle:exit")
        .map(({ id }) => id),
    ).toEqual(ids);
    expect(progress.known).toEqual([]);
  });
  expect(flight.chunks.length).toBeGreaterThan(0);
  expect(
    stationPopulationObjects(flight)
      .filter((object) => object.enemy?.packId === "needle:exit")
      .map(({ id }) => id),
  ).toEqual(ids);
  expect(progress.known).toEqual([]);
});

it("keeps actual G4 launch knowledge queries read-only and retains exact chapter actors on Continue", () => {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 3, 4];
  model.state.prologueSeen = true;
  model.state.progress[4].opened = true;
  model.startGalaxy(4);
  const flight = model.state.flight!;
  const before = structuredClone(model.state);
  const known = model.state.progress[4].known;
  expect(known).toEqual([]);
  expect(
    model.map!.places.filter(({ id }) => ["needlePractice", "needleEye", "holodisk"].includes(id)),
  ).toEqual([]);
  expect(
    model
      .targetMarkers(GAME_AREA)
      .filter(({ id }) => ["needlePractice", "needleEye", "holodisk"].includes(id)),
  ).toEqual([]);
  void model.quests;
  void model.contextQuestDetails;
  expect(model.state).toEqual(before);
  const resumed = new GameModel(CONTENT, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(flight);
  expect(resumed.state.progress[4].known).toEqual(known);
});

it("excludes a real seeded optional footprint at an authored swarm's current hull across population", () => {
  const model = new GameModel(CONTENT);
  const progress = model.state.progress[4];
  const baseline = createUnpopulatedFlight(CONTENT, 4, 173, model.state.economy, 301);
  populateRequiredChapterFlight(CONTENT, progress, baseline, () => {
    initNeedle({ content: CONTENT, flight: baseline, progress });
  });
  const candidate = baseline.objects.find((object) => object.kind === "rock" && !object.orbit)!;
  expect(candidate).toBeDefined();
  const flight = createUnpopulatedFlight(CONTENT, 4, 173, model.state.economy, 301);
  let actorId = "";
  populateRequiredChapterFlight(CONTENT, progress, flight, () => {
    initNeedle({ content: CONTENT, flight, progress });
    const actor = stationPopulationObjects(flight).find(
      (object) => object.enemy?.packId === "needle:exit",
    )!;
    actorId = actor.id;
    actor.x = candidate.x;
    actor.y = candidate.y;
  });
  const actor = stationPopulationObjects(flight).find(({ id }) => id === actorId)!;
  expect(actor).toBeDefined();
  // The planned rock there takes another place or drops; no rock touches the hull.
  expect(
    stationPopulationObjects(flight).some(
      (object) =>
        object.kind === "rock" &&
        Math.hypot(object.x - actor.x, object.y - actor.y) < object.radius + actor.radius,
    ),
  ).toBe(false);
});

it("does not recreate the authored exit encounter on a completed-holodisk fresh entry", () => {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 3, 4];
  model.state.prologueSeen = true;
  model.state.progress[4].opened = true;
  model.state.progress[4].holodisk = true;
  model.startGalaxy(4);
  expect(
    stationPopulationObjects(model.state.flight!).some(
      (actor) => actor.enemy?.packId === "needle:exit",
    ),
  ).toBe(false);
});
