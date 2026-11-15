import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { encounterTable } from "../data/enemyCatalog.ts";
import { NEEDLE } from "../data/needle.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { planNeedleExit } from "./needleExitPlan.ts";
import { initNeedle, needleCourses } from "./needleRuntime.ts";

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
  const model = new GameModel(CONTENT);
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
