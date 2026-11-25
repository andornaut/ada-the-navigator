import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ENEMY_AVOIDANCE } from "../data/enemyNavigation.ts";
import { TARGET_MARKER_RANGE } from "../data/targetMarkers.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { protectAda } from "../testing/arrivalGrace.ts";
import { markerModel } from "../testing/markerModel.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import {
  createFlight,
  questFrigateHome,
  questGuardPlacementContext,
  routeBlocked,
  spawnQuestFrigateAt,
  stepFlight,
  syncFlightRegion,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import { newProgress } from "./progress.ts";
import { questGuardAnchor, questGuardHomePorts } from "./questGuardPlacement.ts";
import type { FlightInput, FlightState, SpaceObject } from "./types.ts";
import { worldCellKey, worldCellsNear, worldGrid } from "./worldCells.ts";
import { worldDistance, worldPoint } from "./worldContacts.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const cue = { id: "quest", type: "guardCue" } as const;

function emptyMotionCells(flight: FlightState): void {
  const grid = worldGrid(flightWorldContext(flight), CONTENT.tuning.chunkSize);
  const cells = [flight.player, ...flight.objects].flatMap((point) =>
    Array.from(worldCellsNear(grid, CONTENT.tuning.chunkSize * ACTIVE_CHUNK_RADIUS, point)),
  );
  flight.chunks = [
    ...new Set([...flight.chunks, ...cells.map((cell) => worldCellKey(grid, cell))]),
  ];
}

/** Explicitly admit the required leader at a geometry-valid site, independent of ambient draws. */
function guarded(wrapped = false) {
  const flight = createFlight(CONTENT, 2, 173, newProgress());
  flight.objects = [];
  flight.world = { notables: {}, version: 1 };
  const site: SpaceObject = {
    hp: 1,
    id: "quest",
    kind: "destination",
    radius: 30,
    x: wrapped ? GALAXY_SIDE / 2 - 20 : 10000,
    y: 10000,
  };
  flight.objects.push(site);
  flight.player = { x: site.x, y: site.y };
  const home = questFrigateHome(CONTENT, flight, "route:quest", site.id);
  expect(home).not.toBeNull();
  const guard = spawnQuestFrigateAt(CONTENT, flight, "route:quest", site.id, home!)!;
  expect(guard).not.toBeNull();
  const followers = flight.objects.filter((object) => object.enemy?.escortOf === guard.id);
  // Ada stays protected, so the guard keeps its patrol rather than engaging her.
  protectAda(flight);
  emptyMotionCells(flight);
  return { flight, followers, guard, site };
}

function patrol(flight: FlightState, guard: SpaceObject, steps: number): void {
  const context = flightWorldContext(flight);
  const home = { ...guard.enemy!.home };
  for (let step = 0; step < steps; step++) {
    stepFlight(CONTENT, 1 / 30, idle, flight);
    expect(flight.objects.filter(({ id }) => id === guard.id)).toHaveLength(1);
    expect(flight.summonedGuards ?? []).not.toContain(guard.id);
    expect(guard.enemy!.home).toEqual(home);
    const anchor = questGuardAnchor(questGuardPlacementContext(CONTENT, flight), guard)!;
    expect(worldDistance(context, anchor.center, guard)).toBeGreaterThanOrEqual(
      anchor.clearanceRadius,
    );
    expect(flight.shots.some((shot) => shot.enemy)).toBe(false);
  }
}

describe("a blocking guard's cue", () => {
  it("cues once at its site without remotely summoning or rebasing the required frigate", () => {
    const { flight, followers, guard, site } = guarded();
    const before = { ...guard.enemy!.home };
    expect(routeBlocked(site.id, flight)).toBe(true);
    const tracker = markerModel(flight);
    tracker.step(1 / 30, idle);
    expect(tracker.flightEvents).toContainEqual(cue);
    expect(flight.guardCues).toEqual([site.id]);
    expect(flight.summonedGuards).toBeUndefined();
    expect(guard.enemy!.home).toEqual(before);
    expect(followers.every((member) => !(flight.summonedGuards ?? []).includes(member.id))).toBe(
      true,
    );
    expect(flight.markerActors?.knowledge[guard.id]).toBe("sensed");
    expect(stepFlight(CONTENT, 1 / 30, idle, flight)).not.toContainEqual(cue);
    expect(flight.guardCues).toEqual([site.id]);
  });

  it("patrols the associated site without changing home when Ada moves away and returns", () => {
    const { flight, guard, site } = guarded();
    const start = { x: guard.x, y: guard.y };
    const shield = flight.shield;
    patrol(flight, guard, 180);
    expect(worldDistance(flightWorldContext(flight), start, guard)).toBeGreaterThan(20);
    flight.player = { x: site.x - CONTENT.tuning.exclusionRadius / 2, y: site.y };
    patrol(flight, guard, 60);
    flight.player = { x: site.x, y: site.y };
    patrol(flight, guard, 60);
    expect(flight.shield).toBeGreaterThanOrEqual(shield);
    expect(routeBlocked(site.id, flight)).toBe(true);
  });

  it("uses the shortest wrapped site image consistently for patrol and its disclosed marker", () => {
    const { flight, guard, site } = guarded(true);
    const context = flightWorldContext(flight);
    const before = { x: guard.x, y: guard.y };
    const tracker = markerModel(flight);
    tracker.step(1 / 30, idle);
    expect(tracker.flightEvents).toContainEqual(cue);
    flight.player = { x: site.x - 2000, y: site.y };
    const marker = tracker.targetMarkers(GAME_AREA).find(({ id }) => id === guard.id)!;
    const point = worldPoint(context, flight.player, guard);
    expect(marker).toMatchObject({ id: guard.id, symbol: "guard" });
    expect(marker.x).toBeCloseTo(point.x, 0);
    expect(marker.y).toBeCloseTo(point.y, 0);
    expect(worldDistance(context, flight.player, marker)).toBeLessThan(TARGET_MARKER_RANGE);
    flight.player = { x: site.x, y: site.y };
    patrol(flight, guard, 180);
    expect(worldDistance(context, before, guard)).toBeGreaterThan(20);
    expect(routeBlocked("quest", flight)).toBe(true);
  });

  it("keeps the patrol outside the site's actual protected hull clearance", () => {
    const { flight, guard, site } = guarded();
    const shield = flight.shield;
    const anchor = questGuardAnchor(questGuardPlacementContext(CONTENT, flight), guard)!;
    const homeRadius = worldDistance(flightWorldContext(flight), site, guard.enemy!.home);
    expect(homeRadius).toBeGreaterThan(anchor.clearanceRadius);
    patrol(flight, guard, 360);
    expect(flight.shield).toBeGreaterThanOrEqual(shield);
    expect(routeBlocked(site.id, flight)).toBe(true);
    expect(worldDistance(flightWorldContext(flight), site, guard)).toBeLessThan(
      homeRadius + ENEMY_AVOIDANCE.clearance * 2,
    );
  });

  it("does not turn a wider play view into a remote frigate summon", () => {
    const { flight, guard } = guarded();
    const home = { ...guard.enemy!.home };
    const wider: FlightInput = { ...idle, viewportWidth: 1440 };
    expect(stepFlight(CONTENT, 1 / 30, wider, flight)).toContainEqual(cue);
    expect(flight.summonedGuards).toBeUndefined();
    expect(guard.enemy!.home).toEqual(home);
    expect(routeBlocked("quest", flight)).toBe(true);
  });

  it("does not cue outside Talk range or once the required guard is disabled", () => {
    const { flight, guard, site } = guarded();
    flight.player = { x: site.x - CONTENT.tuning.talkRange - 1, y: site.y };
    expect(stepFlight(CONTENT, 1 / 30, idle, flight)).not.toContainEqual(cue);
    guard.enemy!.disabled = true;
    expect(routeBlocked(site.id, flight)).toBe(false);
    flight.player = { x: site.x, y: site.y };
    expect(stepFlight(CONTENT, 1 / 30, idle, flight)).not.toContainEqual(cue);
    expect(flight.summonedGuards).toBeUndefined();
  });

  it("retains a dormant site guard and reactivates the same leader and surviving followers locally", () => {
    const { flight, followers, guard, site } = guarded();
    const home = { ...guard.enemy!.home };
    const lost = followers[0]!;
    flight.objects = flight.objects.filter((object) => object !== lost);
    flight.world.notables[lost.id] = null;
    flight.player = { x: site.x - CONTENT.tuning.chunkSize * (ACTIVE_CHUNK_RADIUS + 3), y: site.y };
    emptyMotionCells(flight);
    syncFlightRegion(CONTENT, flight);
    expect(flight.objects).not.toContain(guard);
    expect(flight.world.notables[guard.id]).toBe(guard);
    expect(routeBlocked(site.id, flight)).toBe(true);
    flight.player = { x: site.x, y: site.y };
    expect(stepFlight(CONTENT, 1 / 30, idle, flight)).toContainEqual(cue);
    expect(flight.objects).toContain(guard);
    expect(flight.objects.some((object) => object.id === lost.id)).toBe(false);
    expect(guard.enemy!.home).toEqual(home);
    expect(
      questGuardHomePorts(questGuardPlacementContext(CONTENT, flight)).validHome(
        flightWorldContext(flight),
        site,
        guard,
        home,
      ),
    ).toBe(true);
    patrol(flight, guard, 60);
  });
});
