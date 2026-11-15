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
  void model.targetMarkers(GAME_AREA);
  void model.quests;
  void model.contextQuestDetails;
  expect(model.state).toEqual(before);
  const resumed = new GameModel(CONTENT, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(flight);
  expect(resumed.state.progress[4].known).toEqual(known);
});
