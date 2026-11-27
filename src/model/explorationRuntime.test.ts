import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import { questReward } from "../data/questRewards.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { stationJobsRows, type StationRow } from "../ui/station.ts";
import { dropRandom, enemyStardust } from "./drops.ts";
import { createEnemy } from "./enemyAi.ts";
import { ROUTE_OPPORTUNITY_SECONDS } from "./explorationPacing.ts";
import { ensureStation } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { jobHostiles, rerollBoards } from "./jobs.ts";
import { proceduralPoisNear } from "./proceduralPois.ts";
import { scanOutcomeLines } from "./scanOutcomeSpeech.ts";
import { flightStationContext, worldStationsNear } from "./stations.ts";
import { stationSpecialty } from "./stationServices.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
import { periodicWorldGrid, worldCellAt, worldCellKey } from "./worldCells.ts";
import { worldDistance } from "./worldContacts.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const pilot = { ...idle, move: { x: 1, y: 0 }, throttle: 0.25 };

function fixture(kind: "resources" | "salvage") {
  const admitted = approach(kind, kind === "resources" ? 13 : 12)!;
  expect(admitted).toBeDefined();
  expect(admitted.progress.explorationSites?.[admitted.candidate.id]).toEqual({
    kind,
    scanned: false,
  });
  return admitted;
}

/**
 * Pilots fresh flight toward the nearest site of a kind in a seeded galaxy, or returns undefined
 * when none lies near the galaxy's dark beacon route.
 */
function approach(kind: "resources" | "salvage", seed: number) {
  const world = { worldSide: GALAXY_SIDE };
  const galaxy = kind === "resources" ? 1 : 5;
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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
    return undefined;
  }
  const approach = { x: candidate.x - CONTENT.tuning.talkRange * 2, y: candidate.y };
  const length = Math.hypot(center.x - approach.x, center.y - approach.y);
  const inward = Math.min(1, (CONTENT.tuning.chunkSize * 1.6) / length);
  flight.player = {
    x: approach.x + (center.x - approach.x) * inward,
    y: approach.y + (center.y - approach.y) * inward,
  };
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
  expect(progress.explorationSites).toBeUndefined();
  flight.player = approach;
  flight.freshChunk = worldCellKey(grid, worldCellAt(grid, flight.player));
  model.step(0.01, pilot);
  return { candidate, flight, model, progress };
}

it("admits an optional Scan from fresh piloting and retains its exact map identity without survey credit", () => {
  const { candidate, flight, model, progress } = fixture("resources");
  expect(flight.exploration?.pacing).toEqual({ freshSeconds: 0, nextOpportunity: 1 });
  expect(model.map!.places.some(({ id }) => id === candidate.id)).toBe(false);
  model.state.economy.stardust = 50;
  const departure = { ...flight.player };
  expect(model.canTeleport(candidate.id)).toBe(false);
  expect(model.teleport(candidate.id)).toBe(false);
  expect(flight.player).toEqual(departure);
  expect(model.state.economy.stardust).toBe(50);
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
  expect(progress.explorationSites?.[candidate.id]).toEqual({ kind: "resources", scanned: true });
  expect(progress).toMatchObject(before);
  expect(model.map!.mapped).toBe(counter);
  expect(model.state.jobs).toEqual(jobs);
  expect(model.state.tasks).toEqual(tasks);
  expect(model.map!.places.find(({ id }) => id === candidate.id)).toMatchObject({
    travel: true,
    x: candidate.x,
    y: candidate.y,
  });
  const saved = model.saveDocument();
  expect(restoreSave(saved)?.progress[1].explorationSites).toEqual(progress.explorationSites);
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
  resumed.continueGame();
  expect(resumed.state.flight?.exploration).toEqual(flight.exploration);
  expect(resumed.map!.places.find(({ id }) => id === candidate.id)).toEqual(
    model.map!.places.find(({ id }) => id === candidate.id),
  );
  flight.player = departure;
  flight.dangerFor = 1;
  expect(model.canTeleport(candidate.id)).toBe(false);
  expect(model.teleport(candidate.id)).toBe(false);
  expect(flight.player).toEqual(departure);
  expect(model.state.economy.stardust).toBe(50);
  flight.dangerFor = 0;
  expect(model.canTeleport(candidate.id)).toBe(true);
  expect(model.teleport(candidate.id)).toBe(true);
  expect(flight.player).toEqual({ x: candidate.x, y: candidate.y });
  expect(model.state.economy.stardust).toBe(0);
  expect(progress).toMatchObject(before);
});

it("points a scan to a known live patrol and retires its cue when it leaves", () => {
  const { candidate, flight, model } = fixture("resources");
  const id = "scan-known-patrol";
  const at = { x: candidate.x + 900, y: candidate.y };
  const definition = enemyDefinition(1, "fighter", id);
  const patrol: SpaceObject = {
    ...at,
    enemy: createEnemy(definition, { archetype: "fighter", id, packId: "pack:scan", phase: 0 }, at),
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: 12,
  };
  flight.objects.push(patrol);
  flight.player = { x: candidate.x, y: candidate.y };
  model.markerTargetDisplayed(id);
  expect(model.contextAction).toBe("scan");
  model.interact();
  const [outcome] = model.drainScanOutcomes();
  expect(outcome?.actionLead).toEqual({ kind: "patrol", targetId: id });
  expect(scanOutcomeLines(outcome!).at(-1)?.text).toBe(
    "Drones are patrolling nearby. Give them room.",
  );
  const markers = () => model.targetMarkers({ height: 360, width: 720, x: 0, y: 0 });
  expect(markers().find((entry) => entry.id === id)).toHaveProperty("onScreen");
  patrol.x += 12000;
  expect(markers().some((entry) => entry.id === id)).toBe(false);
  patrol.x = at.x;
  expect(markers().find((entry) => entry.id === id)).not.toHaveProperty("onScreen");
});

it("admits salvage sites among Andromeda's planned enemy groups", () => {
  // Enemy groups keep out of each salvage wreck's local neighbourhood, so every site that
  // seeds 12 to 63 place near the dark beacon route admits.
  const seeds = Array.from({ length: 52 }, (_, index) => 12 + index);
  const approached = seeds.flatMap((seed) => {
    const site = approach("salvage", seed);
    return site ? [site] : [];
  });
  const admitted = approached.filter(({ candidate, progress }) =>
    Boolean(progress.explorationSites?.[candidate.id]),
  );
  expect(approached.length).toBeGreaterThan(3);
  expect(admitted).toHaveLength(approached.length);
}, 60_000);

it("materializes the actual disabled frigate and salvages once through contextual Use after Continue", () => {
  const { candidate, flight, model } = fixture("salvage");
  const id = `${candidate.id}:salvage`;
  const wreck = stationPopulationObjects(flight).find((object) => object.id === id)!;
  expect(wreck.enemy).toMatchObject({ archetype: "frigate", disabled: true });
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
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

function pilotAt(model: GameModel, flight: FlightState, point: Vec) {
  const grid = periodicWorldGrid(flightWorldContext(flight), CONTENT.tuning.chunkSize);
  flight.player = { ...point };
  flight.freshChunk = worldCellKey(grid, worldCellAt(grid, point));
  model.step(0.01, pilot);
}

it("credits fresh far travel at half rate and saves the earned region until a new far cell", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.progress[1].geography = { seed: 13, sitePolicy: "seeded", version: 1 };
  model.startGalaxy(1);
  const flight = model.state.flight!;
  const origin = { x: 0, y: 0 };
  const far = { x: 25_000, y: 31_800 };
  pilotAt(model, flight, origin);
  const nearSeconds = flight.exploration!.pacing!.freshSeconds;
  expect(nearSeconds).toBeGreaterThan(0);
  pilotAt(model, flight, far);
  expect(flight.exploration!.pacing!.freshSeconds).toBeCloseTo(nearSeconds + nearSeconds / 2, 8);

  const exploration = flight.exploration!;
  exploration.pacing = { freshSeconds: 74.999, nextOpportunity: 0 };
  pilotAt(model, flight, far);
  const pending = exploration.pacing.pending;
  expect(pending?.region).toBe("far");
  expect(model.state.progress[1].explorationSites).toBeUndefined();
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
  resumed.continueGame();
  const restored = resumed.state.flight!;
  expect(restored.exploration?.pacing?.pending).toEqual(pending);
  pilotAt(resumed, restored, far);
  pilotAt(resumed, restored, origin);
  expect(restored.exploration?.pacing?.pending).toEqual(pending);
  expect(resumed.state.progress[1].explorationSites).toBeUndefined();
});

it("posts an admitted near-route hunt on Scan, then accepts and pays through the issuer's board", () => {
  const world = { worldSide: GALAXY_SIDE };
  for (let seed = 1; seed <= 128; seed++) {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    const progress = model.state.progress[1];
    progress.geography = { seed, sitePolicy: "seeded", version: 1 };
    model.startGalaxy(1);
    const flight = model.state.flight!;
    const stations = worldStationsNear(flightStationContext(flight), ECONOMY, 1, 20_000, {
      x: 0,
      y: 0,
    })
      .filter(({ id }) => stationSpecialty(1, id) === "jobs")
      .slice(0, 2);
    if (stations.length !== 2) {
      continue;
    }
    const site = proceduralPoisNear(
      { ...world, opportunityEligibility: { jobTemplates: ["rescue", "hunt"] } },
      1,
      seed,
      TARGET_MARKER_RANGE,
      { x: 0, y: 0 },
    ).find(
      (candidate) =>
        candidate.opportunity.kind === "job" &&
        dropRandom(seed, `exploration-lead-kind:${candidate.id}`)() >= 0.5,
    );
    if (!site) {
      continue;
    }
    progress.stations.push(...stations.map(({ id }) => id));
    flight.exploration = {
      pacing: {
        freshSeconds: ROUTE_OPPORTUNITY_SECONDS,
        nextOpportunity: 0,
        pending: { cell: "0,0", region: "near" },
      },
      renewals: {},
      version: 1,
    };
    pilotAt(model, flight, { x: site.x - 250, y: site.y });
    const entry = progress.explorationSites?.[site.id];
    if (typeof entry !== "object" || entry.kind !== "hunt") {
      continue;
    }
    const issuer = stations.sort(
      (a, b) =>
        worldDistance(world, a, site) - worldDistance(world, b, site) || a.id.localeCompare(b.id),
    )[0]!;
    const id = `lead:${site.id}`;
    expect(model.state.jobs.boards[1]).toBeUndefined();
    flight.player = { x: site.x, y: site.y };
    expect(model.contextAction).toBe("scan");
    model.interact();
    expect(model.acceptJob(id)).toBe("missing");
    expect(model.state.tasks[1]).toBeUndefined();
    expect(progress.charted).toEqual([]);
    expect(progress.explorationSites?.[site.id]).toEqual({ kind: "hunt", scanned: true });
    const [outcome] = model.drainScanOutcomes();
    expect(outcome).toMatchObject({ completions: [], targetId: site.id });
    expect(scanOutcomeLines(outcome!).at(-1)?.text).toBe(
      `A job is waiting at ${outcome!.leadStation}. Look for its marker on the map.`,
    );
    const [offer] = model.state.jobs.boards[1]![issuer.id]!;
    expect(offer).toMatchObject({ id, station: issuer.id, type: "hunt" });
    const issuerMarker = (game: GameModel) =>
      game.map!.places.find((place) => place.id === issuer.id);
    expect(issuerMarker(model)).toMatchObject({ pendingJobLead: true, travel: true });
    expect(model.map!.places.filter((place) => place.pendingJobLead).map(({ id }) => id)).toEqual([
      issuer.id,
    ]);
    expect(worldDistance(world, issuer, offer!.target)).toBeGreaterThanOrEqual(JOB_TUNING.hunt.min);
    expect(worldDistance(world, issuer, offer!.target)).toBeLessThanOrEqual(JOB_TUNING.hunt.max);
    expect(restoreSave(model.save())?.jobs.boards[1]![issuer.id]).toEqual([offer]);
    const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
    resumed.continueGame();
    expect(issuerMarker(resumed)).toMatchObject({ pendingJobLead: true });
    rerollBoards(1, model.state);
    expect(model.state.jobs.boards[1]![issuer.id]).toEqual([offer]);

    progress.resolved = true;
    ensureStation(CONTENT, issuer.id, flight);
    flight.player = { x: issuer.x, y: issuer.y };
    flight.dangerFor = 0;
    model.interact();
    expect(model.state.docked).toBe(issuer.id);
    expect(outcome!.leadStation).toBe(model.dockedStationName);
    const jobs = model.jobBoard();
    const ordinary = jobs.filter((row) => row.id !== id);
    expect(ordinary).toHaveLength(3);
    const projects = model.projects!;
    expect(projects).toHaveLength(3);
    expect(projects.every(({ funded }) => !funded)).toBe(true);
    const projectRows = projects.map((project): StationRow => ({
      glyph: { key: project.icon, kind: "stateVector" },
      group: "items",
      key: `project:${project.id}`,
      level: "",
      name: project.name,
      price: project.remaining,
      project: true,
      state: "unaffordable",
    }));
    const displayed = () =>
      stationJobsRows(
        model.jobBoard().map((job) => ({ ...job, rewardText: String(job.reward) })),
        model.stationServices,
        projectRows,
      );
    expect(displayed()).toMatchObject([{ id, state: "offer" }]);
    expect(model.acceptJob(displayed()[0]!.id)).toBe("accepted");
    expect(displayed()[0]).toMatchObject({ id, state: "held" });
    expect(model.acceptJob(ordinary[0]!.id)).toBe("busy");
    model.undock();
    expect(issuerMarker(model)?.pendingJobLead).toBeUndefined();
    const balance = model.state.economy.stardust;
    flight.player = { ...offer!.spot! };
    flight.velocity = { x: 0, y: 0 };
    model.step(0.001, idle);
    expect(model.state.tasks[1]).toBeUndefined();
    expect(model.state.economy.stardust).toBe(balance + questReward(offer!.reward));
    expect(model.state.jobs.boards[1]![issuer.id]!.map(({ id }) => id)).toEqual(
      ordinary.map(({ id }) => id),
    );
    model.step(0.001, idle);
    expect(model.state.economy.stardust).toBe(balance + questReward(offer!.reward));
    return;
  }
  throw new Error("No near-route hunt fixture admitted");
});

it("admits and posts the seed-125 hunt when every seeded centre is blocked", () => {
  const seed = 125;
  const world = { worldSide: GALAXY_SIDE };
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  const progress = model.state.progress[1];
  progress.geography = { seed, sitePolicy: "seeded", version: 1 };
  model.startGalaxy(1);
  const flight = model.state.flight!;
  const stations = worldStationsNear(flightStationContext(flight), ECONOMY, 1, 20_000, {
    x: 0,
    y: 0,
  })
    .filter(({ id }) => stationSpecialty(1, id) === "jobs")
    .slice(0, 2);
  const site = proceduralPoisNear(
    { ...world, opportunityEligibility: { jobTemplates: ["rescue", "hunt"] } },
    1,
    seed,
    TARGET_MARKER_RANGE,
    { x: 0, y: 0 },
  ).find(({ id }) => id === "poi:1:0,-1:0")!;
  const [issuer, other] = stations.sort(
    (a, b) => worldDistance(world, a, site) - worldDistance(world, b, site),
  );
  expect(issuer?.id).toBe("station:-1,-2");
  expect(other).toBeDefined();
  progress.stations.push(issuer!.id, other!.id);
  const id = `lead:${site.id}`;
  const next = dropRandom(seed, id);
  const { max, min } = JOB_TUNING.hunt;
  const centres = Array.from({ length: 24 }, () => {
    const reach = min + next() * (max - min);
    const angle = next() * Math.PI * 2;
    return { x: issuer!.x + Math.cos(angle) * reach, y: issuer!.y + Math.sin(angle) * reach };
  });
  const blockers = centres.map((point, index): SpaceObject => {
    const blockerId = `hunt-clearance:${index}`;
    const archetype = (["frigate", "capital", "platform"] as const)[index % 3]!;
    const definition = enemyDefinition(1, archetype, blockerId);
    return {
      ...point,
      enemy: createEnemy(definition, { archetype, id: blockerId, packId: null, phase: 0 }, point),
      hp: definition.hp,
      id: blockerId,
      kind: "enemy",
      radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
    };
  });
  const score = (point: Vec) =>
    Math.min(
      ...jobHostiles({
        objects: stationPopulationObjects(flight),
      }).map((heavy) => worldDistance(world, heavy, point)),
    );
  flight.objects.push(...blockers);
  flight.exploration = {
    pacing: {
      freshSeconds: ROUTE_OPPORTUNITY_SECONDS,
      nextOpportunity: 0,
      pending: { cell: "0,0", region: "near" },
    },
    renewals: {},
    version: 1,
  };
  expect(centres.every((point) => score(point) < JOB_TUNING.hostileClearance)).toBe(true);
  pilotAt(model, flight, { x: site.x - 250, y: site.y });
  expect(progress.explorationSites?.[site.id]).toEqual({ kind: "hunt", scanned: false });
  expect(flight.exploration.pacing?.nextOpportunity).toBe(1);
  expect(model.state.jobs.boards[1]).toBeUndefined();

  // The live population has changed since admission. A later candidate now has the best clearance.
  const moved = stationPopulationObjects(flight).find(({ id }) => id === blockers[17]!.id)!;
  moved.x += 750;
  moved.enemy!.position = { x: moved.x, y: moved.y };
  const scores = centres.map(score);
  expect(scores.every((clearance) => clearance < JOB_TUNING.hostileClearance)).toBe(true);
  expect(scores.indexOf(Math.max(...scores))).toBe(17);
  const balance = model.state.economy.stardust;
  flight.player = { x: site.x, y: site.y };
  expect(model.contextAction).toBe("scan");
  model.interact();
  expect(progress.explorationSites?.[site.id]).toEqual({ kind: "hunt", scanned: true });
  const [receipt] = model.drainScanOutcomes();
  expect(receipt).toMatchObject({ completions: [], targetId: site.id });
  expect(scanOutcomeLines(receipt!).at(-1)?.text).toBe(
    `A job is waiting at ${receipt!.leadStation}. Look for its marker on the map.`,
  );
  const posted = [{ id, station: issuer!.id, target: { id: "", ...centres[17]! }, type: "hunt" }];
  expect(model.state.jobs.boards[1]?.[issuer!.id]).toMatchObject(posted);
  expect(model.state.jobs.boards[1]?.[other!.id]).toBeUndefined();
  expect(model.state.tasks[1]).toBeUndefined();
  model.interact();
  expect(model.drainScanOutcomes()).toEqual([]);
  expect(model.state.jobs.boards[1]?.[issuer!.id]).toMatchObject(posted);
  expect(model.state.economy.stardust).toBe(balance);
});

function admittedFarRescue() {
  const world = { worldSide: GALAXY_SIDE };
  const far = { x: 25_000, y: 31_800 };
  for (let seed = 1; seed <= 20; seed++) {
    const site = proceduralPoisNear(
      { ...world, opportunityEligibility: { jobTemplates: ["rescue"], region: "far" } },
      1,
      seed,
      12_000,
      far,
    ).find(({ opportunity }) => opportunity.kind === "job");
    if (!site) {
      continue;
    }
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    const progress = model.state.progress[1];
    progress.geography = { seed, sitePolicy: "seeded", version: 1 };
    model.startGalaxy(1);
    const flight = model.state.flight!;
    const [closer, issuer] = worldStationsNear(
      flightStationContext(flight),
      ECONOMY,
      1,
      60_000,
      far,
    )
      .filter(({ id }) => stationSpecialty(1, id) === "jobs")
      .sort((a, b) => worldDistance(world, site, a) - worldDistance(world, site, b));
    if (!issuer || !closer) {
      continue;
    }
    progress.stations = [issuer.id];
    const approach = { x: site.x - 250, y: site.y };
    flight.exploration = {
      pacing: { freshSeconds: 74.999, nextOpportunity: 0 },
      renewals: {},
      version: 1,
    };
    pilotAt(model, flight, { x: approach.x - CONTENT.tuning.chunkSize, y: approach.y });
    expect(flight.exploration.pacing?.pending?.region).toBe("far");
    const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
    resumed.continueGame();
    const restored = resumed.state.flight!;
    pilotAt(resumed, restored, approach);
    const restoredProgress = resumed.state.progress[1];
    const entry = restoredProgress.explorationSites?.[site.id];
    if (typeof entry !== "object" || entry.kind !== "rescue") {
      continue;
    }
    return { closer, issuer, restored, resumed, site, world };
  }
  throw new Error("No far rescue fixture admitted");
}

it("admits a far rescue after Continue and places its craft at the scanned lead", () => {
  const { issuer, restored, resumed, site } = admittedFarRescue();
  expect(restored.exploration?.pacing).toEqual({ freshSeconds: 0, nextOpportunity: 1 });
  restored.player = { x: site.x, y: site.y };
  expect(resumed.contextAction).toBe("scan");
  resumed.interact();
  const [offer] = resumed.state.jobs.boards[1]![issuer.id]!;
  const id = `lead:${site.id}`;
  expect(offer).toMatchObject({ id, target: { id: "", x: site.x, y: site.y }, type: "rescue" });
  expect(resumed.state.tasks[1]).toBeUndefined();

  ensureStation(CONTENT, issuer.id, restored);
  restored.player = { x: issuer.x, y: issuer.y };
  restored.dangerFor = 0;
  resumed.interact();
  expect(resumed.state.docked).toBe(issuer.id);
  expect(resumed.acceptJob(id)).toBe("accepted");
  resumed.undock();
  restored.player = { x: site.x, y: site.y };
  expect(resumed.contextAction).toBe("tow");
  resumed.interact();
  expect(restored.tow).toEqual({ x: site.x, y: site.y });
});

it("posts a saved rescue at its admitted site after a heavy enters clearance range", () => {
  const { closer, issuer, restored, resumed, site, world } = admittedFarRescue();
  const id = `lead:${site.id}`;
  const hold = { x: site.x + 1_600, y: site.y };
  expect(
    jobHostiles({ objects: stationPopulationObjects(restored) }).every(
      (heavy) => worldDistance(world, site, heavy) >= JOB_TUNING.hostileClearance,
    ),
  ).toBe(true);
  const definition = enemyDefinition(1, "frigate", "late-frigate");
  const frigate: SpaceObject = {
    ...hold,
    enemy: createEnemy(
      definition,
      { archetype: "frigate", id: "late-frigate", packId: null, phase: 0 },
      hold,
    ),
    hp: definition.hp,
    id: "late-frigate",
    kind: "enemy",
    radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
  };
  restored.objects.push(frigate);
  const returned = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, resumed.save());
  returned.continueGame();
  const flight = returned.state.flight!;
  const heavy = flight.objects.find((object) => object.id === frigate.id)!;
  expect(heavy).toBeDefined();
  expect(worldDistance(world, site, heavy)).toBeGreaterThan(JOB_TUNING.hostileClearance);
  const arrived = { x: site.x + 750, y: site.y };
  Object.assign(heavy, arrived);
  heavy.enemy!.position = arrived;
  expect(worldDistance(world, site, heavy)).toBeLessThan(JOB_TUNING.hostileClearance);
  expect(worldDistance(world, site, closer)).toBeLessThan(worldDistance(world, site, issuer));
  const progress = returned.state.progress[1];
  progress.stations.push(closer.id);
  flight.player = { x: site.x, y: site.y };

  expect(returned.contextAction).toBe("scan");
  returned.interact();
  const [outcome] = returned.drainScanOutcomes();
  expect(outcome).toMatchObject({ completions: [], targetId: site.id });
  expect(progress.explorationSites?.[site.id]).toEqual({ kind: "rescue", scanned: true });
  expect(returned.state.jobs.boards[1]?.[issuer.id]).toBeUndefined();
  expect(returned.state.jobs.boards[1]?.[closer.id]).toMatchObject([
    { id, station: closer.id, target: { id: "", x: site.x, y: site.y }, type: "rescue" },
  ]);
  expect(returned.state.tasks[1]).toBeUndefined();
  returned.interact();
  expect(returned.drainScanOutcomes()).toEqual([]);
});
