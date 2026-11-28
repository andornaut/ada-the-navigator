import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { encounterTable } from "../data/enemyCatalog.ts";
import { NEEDLE } from "../data/needle.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { createUnpopulatedFlight } from "./flight/index.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { planNeedleExit } from "./needle/routePlan.ts";
import {
  initNeedle,
  NEEDLE_CADENCE,
  needleCadenceSite,
  needleCadenceTransmission,
  needleCourses,
} from "./needle/runtime.ts";

it("keeps authored swarm identities and ring geometry invariant under an anchor translation", () => {
  const center = { x: 4000, y: -2000 };
  const before = { ...center };
  const plan = planNeedleExit(173, center);
  const bounds = encounterTable(4).find((entry) => entry.archetype === "swarm")!.groupSize;
  expect(plan.length).toBeGreaterThanOrEqual(bounds[0]);
  expect(plan.length).toBeLessThanOrEqual(bounds[1]);
  expect(plan.every((actor) => actor.archetype === "swarm" && actor.packId === "needle:exit")).toBe(
    true,
  );
  expect(new Set(plan.map(({ id }) => id)).size).toBe(plan.length);
  expect(plan[0]!.point).toEqual({ x: center.x + NEEDLE.exitPackRadius, y: center.y });
  for (const [index, actor] of plan.entries()) {
    expect(actor.id).toBe(`needle:exit:${index}`);
    expect(actor.home).toEqual(center);
    expect(Math.hypot(actor.point.x - center.x, actor.point.y - center.y)).toBeCloseTo(
      NEEDLE.exitPackRadius,
    );
  }
  const shifted = planNeedleExit(173, { x: center.x + 800, y: center.y - 300 });
  expect(shifted.map(({ id }) => id)).toEqual(plan.map(({ id }) => id));
  shifted.forEach((actor, index) => {
    expect(actor.point.x - plan[index]!.point.x).toBeCloseTo(800);
    expect(actor.point.y - plan[index]!.point.y).toBeCloseTo(-300);
  });
  expect(center).toEqual(before);
});

it("materializes the existing G4 swarm role once without adding a route leader or rerolling on init", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked = [1, 3, 4];
  model.state.prologueSeen = true;
  model.state.progress[4].opened = true;
  model.startGalaxy(4);
  const flight = model.state.flight!;
  const layout = needleCourses(flight)!;
  const planned = planNeedleExit(flight.seed, layout.eye.pack);
  const actors = stationPopulationObjects(flight).filter(
    (actor) => actor.enemy?.packId === "needle:exit",
  );
  expect(actors.map(({ id }) => id)).toEqual(planned.map(({ id }) => id));
  actors.forEach((actor, index) => {
    expect(actor).toMatchObject({ ...planned[index]!.point, persistent: true });
    expect(actor.routeId).toBeUndefined();
    expect(actor.enemy).toMatchObject({
      archetype: "swarm",
      escortOf: null,
      home: layout.eye.pack,
    });
  });
  const snapshot = structuredClone(actors);
  initNeedle({ content: CONTENT, flight, progress: model.state.progress[4] });
  expect(
    stationPopulationObjects(flight).filter((actor) => actor.enemy?.packId === "needle:exit"),
  ).toEqual(snapshot);
  expect(flight.needle!.exitPackPlaced).toBe(true);
});

it("admits the detour only after the last Eye gate and retries the other side when blocked", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  const progress = model.state.progress[4];
  const flight = createUnpopulatedFlight(CONTENT, 4, 173, model.state.economy, 173);
  const context = { content: CONTENT, flight, progress };
  initNeedle(context);
  const probes: { x: number; y: number }[] = [];
  const placement = {
    canPlace: (site: { x: number; y: number }) => probes.push(site) === 2,
    hullReach: 92,
    perception: 1540,
    pursuitRadius: 1000,
  };
  Object.assign(progress.needle!, {
    approach: "independent",
    briefed: true,
    eyeLit: NEEDLE.eyeGates - 1,
    met: true,
    practiceLit: NEEDLE.practiceGates,
  });
  expect(needleCadenceSite(context, placement)).toBeNull();
  expect(probes).toHaveLength(0);
  progress.needle!.eyeLit++;
  const before = structuredClone(context.progress);
  const disk = needleCourses(flight)!.eye.holodisk;
  expect(needleCadenceSite(context, placement)).toEqual(probes[1]);
  expect(probes).toHaveLength(2);
  expect(probes[0]!.y).toBeGreaterThan(disk.y);
  expect(probes[1]!.y).toBeLessThan(disk.y);
  expect(context.progress).toEqual(before);
  expect(needleCadenceSite(context, { ...placement, canPlace: () => false })).toBeNull();
  progress.holodisk = true;
  const admitted = needleCadenceSite(context, { ...placement, canPlace: () => true });
  expect(admitted).toEqual(probes[0]);
  progress.capitalBoss = { phase: "active", site: admitted! };
  expect(needleCadenceSite(context, { ...placement, canPlace: () => true })).toBeNull();
});

it("projects one transmission from either saved outcome and names Archie only after reveal", () => {
  const site = { x: 0, y: 0 };
  expect(needleCadenceTransmission(undefined, false)).toBeNull();
  expect(needleCadenceTransmission({ phase: "active", site }, true)).toBeNull();
  for (const outcome of ["defeated", "salvaged"] as const) {
    const boss = { cacheClaimed: false, outcome, phase: "resolved", site } as const;
    const id = `${NEEDLE_CADENCE.id}:transmission`;
    expect(needleCadenceTransmission(boss, false)).toEqual({
      id,
      text: "Orders from fleet command: Hold the exits. Recover every disk.",
    });
    expect(needleCadenceTransmission(boss, true)).toEqual({
      id,
      text: "Admiral Archie's orders: Hold the exits. Recover every disk.",
    });
  }
});
