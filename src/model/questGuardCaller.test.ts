import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ENEMY_AVOIDANCE } from "../data/enemyNavigation.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import * as enemyAi from "./enemyAi.ts";
import {
  createFlight,
  questGuardPlacementContext,
  spawnChapterEnemy,
  stepFlight,
} from "./flight.ts";
import { CURRENT_FLIGHT_TOPOLOGY, flightWorldContext } from "./flightTopology.ts";
import * as placement from "./questGuardPlacement.ts";
import type { SpaceObject } from "./types.ts";
import { worldDistance, worldPoint } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function fixture(wrapped: boolean) {
  const flight = createFlight(CONTENT, 1, 173, { known: [] });
  if (wrapped) {
    flight.topology = CURRENT_FLIGHT_TOPOLOGY;
  }
  flight.objects = [];
  flight.world = { notables: {}, version: 1 };
  const site: SpaceObject = {
    hp: 1,
    id: "caller-site",
    kind: "station",
    radius: 30,
    x: wrapped ? GALAXY_SIDE / 2 - 20 : 10000,
    y: 10000,
  };
  flight.objects.push(site);
  flight.player = { x: site.x, y: site.y };
  stepFlight(CONTENT, 0.000001, idle, flight);
  const guard = spawnChapterEnemy(
    CONTENT,
    "frigate",
    "caller-guard",
    { x: site.x + 8000, y: site.y },
    flight,
    { routeId: site.id },
  )!;
  const followers = flight.objects.filter((actor) => actor.enemy?.escortOf === guard.id);
  for (const follower of followers) {
    flight.world.notables[follower.id] = null;
  }
  flight.objects = flight.objects.filter((actor) => !followers.includes(actor));
  const context = questGuardPlacementContext(CONTENT, flight);
  const ports = placement.questGuardHomePorts(context);
  const selected = ports.recoveryHome(flightWorldContext(flight), site, guard);
  expect(selected).not.toBeNull();
  const home = wrapped ? wrapPoint(GALAXY_SIDE, selected!) : selected!;
  // Fixture input is already placed/recovered; navigation must only read it.
  Object.assign(guard, home);
  guard.enemy!.home = { ...home };
  guard.enemy!.position = { ...home };
  expect(ports.validHome(flightWorldContext(flight), site, guard, home)).toBe(true);
  return { context, flight, guard, home, site };
}

it.each([false, true])(
  "forwards a canonical mid-band home without duplicate berth or selection (wrapped=%s)",
  (wrapped) => {
    const { context, flight, guard, home, site } = fixture(wrapped);
    const expected = placement.questGuardAnchor(context, guard)!;
    const world = flightWorldContext(flight);
    expect(worldDistance(world, site, home)).toBeLessThan(
      expected.clearanceRadius + ENEMY_AVOIDANCE.clearance,
    );
    const center = worldPoint(world, guard, expected.center);
    const before = { ...guard.enemy!.home };
    const select = vi.fn((): never => {
      throw new Error("navigation must not select a home");
    });
    const originalPorts = placement.questGuardHomePorts;
    const ports = vi.spyOn(placement, "questGuardHomePorts").mockImplementation((input) => ({
      ...originalPorts(input),
      recoveryHome: select,
    }));
    const steps = vi.spyOn(enemyAi, "stepEnemy");
    try {
      stepFlight(CONTENT, 0.000001, idle, flight);
      const call = steps.mock.calls.find(([, , state]) => state.id === guard.id)!;
      expect(call).toBeDefined();
      expect(call[1].stationGuardAnchor).toEqual({
        center,
        clearanceRadius: expected.clearanceRadius,
      });
      expect(guard.enemy!.home).toEqual(before);
      expect(select).not.toHaveBeenCalled();
    } finally {
      steps.mockRestore();
      ports.mockRestore();
    }
  },
);

it("declines a remote home without selecting, applying or changing it", () => {
  const { flight, guard, site } = fixture(false);
  guard.enemy!.home = { x: site.x + 8000, y: site.y };
  const context = questGuardPlacementContext(CONTENT, flight);
  expect(
    placement
      .questGuardHomePorts(context)
      .validHome(flightWorldContext(flight), site, guard, guard.enemy!.home),
  ).toBe(false);
  expect(worldDistance(flightWorldContext(flight), site, guard.enemy!.home)).toBeGreaterThan(
    placement.questGuardAnchor(context, guard)!.clearanceRadius + ENEMY_AVOIDANCE.clearance,
  );
  const before = { ...guard.enemy!.home };
  const select = vi.fn((): never => {
    throw new Error("navigation must not recover a home");
  });
  const originalPorts = placement.questGuardHomePorts;
  const ports = vi.spyOn(placement, "questGuardHomePorts").mockImplementation((input) => ({
    ...originalPorts(input),
    recoveryHome: select,
  }));
  const steps = vi.spyOn(enemyAi, "stepEnemy");
  try {
    stepFlight(CONTENT, 0.000001, idle, flight);
    const call = steps.mock.calls.find(([, , state]) => state.id === guard.id)!;
    expect(call).toBeDefined();
    expect(call[1].stationGuardAnchor).toBeUndefined();
    expect(guard.enemy!.home).toEqual(before);
    expect(select).not.toHaveBeenCalled();
  } finally {
    steps.mockRestore();
    ports.mockRestore();
  }
});
