import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { enemyStardust } from "./drops.ts";
import { ROUTE_OPPORTUNITY_SECONDS } from "./explorationPacing.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { proceduralPoisNear } from "./proceduralPois.ts";
import { restoreSave } from "./save.ts";
import { periodicWorldGrid, worldCellAt, worldCellKey } from "./worldCells.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const pilot = { ...idle, move: { x: 1, y: 0 }, throttle: 0.25 };

function fixture(kind: "resources" | "salvage") {
  const world = { worldSide: GALAXY_SIDE };
  const galaxy = kind === "resources" ? 1 : 5;
  const seed = kind === "resources" ? 13 : 12;
  const model = new GameModel(CONTENT);
  const progress = model.state.progress[galaxy];
  progress.geography = { seed, sitePolicy: "seeded", version: 1 };
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 5];
  model.startGalaxy(galaxy);
  const flight = model.state.flight!;
  expect(flight.topology?.side).toBe(GALAXY_SIDE);
  const beacon = progress.requiredSites?.darkBeacon;
  const center = beacon ? { x: beacon.x / 2, y: beacon.y / 2 } : { x: 0, y: 0 };
  const candidate = proceduralPoisNear(
    { ...world, opportunityEligibility: { jobTemplates: [] } },
    galaxy,
    seed,
    TARGET_MARKER_RANGE,
    center,
  ).find((site) => site.opportunity.kind === kind);
  if (!candidate) {
    throw new Error(`No ${kind} candidate for seed ${seed}`);
  }
  flight.player = { x: candidate.x - CONTENT.tuning.talkRange * 2, y: candidate.y };
  const grid = periodicWorldGrid(flightWorldContext(flight), CONTENT.tuning.chunkSize);
  flight.freshChunk = null;
  flight.exploration = {
    pacing: { freshSeconds: ROUTE_OPPORTUNITY_SECONDS - 0.001, nextOpportunity: 0 },
    renewals: {},
    version: 1,
  };
  // The fixture supplies a real near-threshold saved ledger. Content admission comes from step.
  model.step(0.01, idle);
  expect(progress.explorationSites).toBeUndefined();
  expect(flight.exploration.pacing?.freshSeconds).toBe(ROUTE_OPPORTUNITY_SECONDS - 0.001);
  model.step(0.01, pilot);
  expect(flight.exploration.pacing?.freshSeconds).toBe(ROUTE_OPPORTUNITY_SECONDS - 0.001);
  flight.freshChunk = worldCellKey(grid, worldCellAt(grid, flight.player));
  model.step(0.01, pilot);
  expect(progress.explorationSites?.[candidate.id]).toBe(false);
  return { candidate, flight, model, progress };
}

it("admits an optional Scan from fresh piloting and retains its exact map identity without survey credit", () => {
  const { candidate, flight, model, progress } = fixture("resources");
  expect(flight.exploration?.pacing).toEqual({ freshSeconds: 0, nextOpportunity: 1 });
  expect(model.map!.places.some(({ id }) => id === candidate.id)).toBe(false);
  expect(model.jobScenery.landmarks.find(({ id }) => id === candidate.id)).toMatchObject({
    charted: false,
    x: candidate.x,
    y: candidate.y,
  });
  const counter = model.map!.mapped;
  const jobs = structuredClone(model.state.jobs);
  const tasks = structuredClone(model.state.tasks);
  const before = { charted: [...progress.charted], discoveries: progress.discoveries };
  flight.player = { x: candidate.x, y: candidate.y };
  expect(model.contextAction).toBe("scan");
  model.interact();
  expect(model.drainScanOutcomes()).toMatchObject([{ completions: [], targetId: candidate.id }]);
  model.interact();
  expect(model.drainScanOutcomes()).toEqual([]);
  expect(progress.explorationSites?.[candidate.id]).toBe(true);
  expect(progress).toMatchObject(before);
  expect(model.map!.mapped).toBe(counter);
  expect(model.state.jobs).toEqual(jobs);
  expect(model.state.tasks).toEqual(tasks);
  expect(model.map!.places.find(({ id }) => id === candidate.id)).toMatchObject({
    travel: false,
    x: candidate.x,
    y: candidate.y,
  });
  const saved = model.saveDocument();
  expect(restoreSave(saved)?.progress[1].explorationSites).toEqual(progress.explorationSites);
  const resumed = new GameModel(CONTENT, model.save());
  resumed.continueGame();
  expect(resumed.state.flight?.exploration).toEqual(flight.exploration);
  expect(resumed.map!.places.find(({ id }) => id === candidate.id)).toEqual(
    model.map!.places.find(({ id }) => id === candidate.id),
  );
});

it("materializes the actual disabled frigate and salvages once through contextual Use after Continue", () => {
  const { candidate, flight, model } = fixture("salvage");
  const id = `${candidate.id}:salvage`;
  const wreck = stationPopulationObjects(flight).find((object) => object.id === id)!;
  expect(wreck.enemy).toMatchObject({ archetype: "frigate", disabled: true });
  const resumed = new GameModel(CONTENT, model.save());
  resumed.continueGame();
  const restored = resumed.state.flight!;
  expect(stationPopulationObjects(restored).find((object) => object.id === id)).toEqual(wreck);
  restored.player = { x: wreck.x - CONTENT.tuning.talkRange / 2, y: wreck.y };
  resumed.step(0.001, idle);
  expect(resumed.contextAction).toBe("salvage");
  const existing = new Set(restored.objects.map(({ id }) => id));
  resumed.interact();
  expect(restored.objects.find((object) => object.id === id)?.enemy?.salvaged).toBe(true);
  const stardust = () =>
    restored.objects.filter(
      ({ id, kind, role }) => kind === "pickup" && role === "stardust" && !existing.has(id),
    );
  const drops = stardust();
  expect(drops.reduce((total, pickup) => total + (pickup.amount ?? 0), 0)).toBe(
    Math.floor(enemyStardust({ id, seed: restored.seed }, "frigate") / 2),
  );
  resumed.choose("continue");
  expect(resumed.contextAction).not.toBe("salvage");
  resumed.interact();
  expect(stardust()).toEqual(drops);
});
