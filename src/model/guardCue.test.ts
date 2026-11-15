import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { createEdgeMarkerTracker, gameAreaPoint, inGameArea } from "./edgeMarkers.ts";
import {
  createFlight,
  ensureDestination,
  ensureDestinationAt,
  ensureRouteEncounter,
  ensureStation,
  routeBlocked,
  stepFlight,
  syncFlightRegion,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import { stationsNear } from "./stations.ts";
import type {
  FlightEvent,
  FlightInput,
  FlightState,
  GalaxyProgress,
  SpaceObject,
} from "./types.ts";
import { worldDistance, worldPoint } from "./worldContacts.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const progress: GalaxyProgress = {
  charted: [],
  deposited: 0,
  destroyedEnemies: 0,
  discoveries: 0,
  donated: {},
  explored: [],
  greetings: {},
  holodisk: false,
  introduced: false,
  known: [],
  opened: false,
  questComplete: false,
  questItem: null,
  resolved: false,
  revealed: [],
  stage: 0,
  stations: [],
};
const cue = { id: "quest", type: "guardCue" } as const;

function moveGuard(flight: FlightState, guard: SpaceObject, at: { x: number; y: number }): void {
  const delta = { x: at.x - guard.x, y: at.y - guard.y };
  for (const member of flight.objects.filter(
    (object) => object.id === guard.id || object.enemy?.escortOf === guard.id,
  )) {
    member.x += delta.x;
    member.y += delta.y;
    member.enemy!.home = { x: member.x, y: member.y };
    member.enemy!.position = { x: member.x, y: member.y };
  }
}

/** A galaxy one flight with Ada at the quest destination and its guard `away` units east. */
function guarded(away: number): { flight: FlightState; guard: SpaceObject } {
  const flight = createFlight(CONTENT, 1, 173, progress);
  flight.objects = [];
  const destination = ensureDestination(CONTENT, "quest", flight);
  const guard = ensureRouteEncounter(CONTENT, "quest", flight)!;
  const at = { x: destination.x + away, y: destination.y };
  moveGuard(flight, guard, at);
  guard.enemy!.home = { ...at };
  guard.enemy!.position = { ...at };
  flight.player = { x: destination.x, y: destination.y };
  return { flight, guard };
}
const onScreen = (flight: FlightState, object: SpaceObject) =>
  inGameArea(
    gameAreaPoint(flight.player, worldPoint(flightWorldContext(flight), flight.player, object)),
  );

describe("a blocking guard's cue", () => {
  it("cues once per flight when Ada reaches the destination, summoning and marking the guard", () => {
    const { flight, guard } = guarded(1200);
    expect(onScreen(flight, guard)).toBe(false);
    expect(stepFlight(CONTENT, 0.05, idle, flight)).toContainEqual(cue);
    expect(flight.guardCues).toEqual(["quest"]);
    expect(flight.summonedGuards).toEqual(expect.arrayContaining([guard.id]));
    // Its guard marker shows though Ada has never seen it.
    expect(
      createEdgeMarkerTracker()
        .update(flight, new Set())
        .filter((marker) => marker.id === guard.id),
    ).toEqual([{ bar: 1, id: guard.id, kind: "guard", x: guard.x, y: guard.y }]);
    // It flies in until it is on screen, firing nothing on the way, then fights as usual.
    let seconds = 0;
    let events: FlightEvent[] = [];
    while (flight.summonedGuards && seconds < 60) {
      events = [...events, ...stepFlight(CONTENT, 0.05, idle, flight)];
      expect(flight.shots.some((shot) => shot.enemy)).toBe(false);
      seconds += 0.05;
    }
    expect(flight.summonedGuards).toBeUndefined();
    expect(onScreen(flight, guard)).toBe(true);
    expect(guard.enemy!.engaged).toBe(true);
    // Leaving and coming back in the same flight does not cue it again.
    const destination = flight.objects.find((object) => object.id === "quest")!;
    flight.player = { x: destination.x - 2000, y: destination.y };
    stepFlight(CONTENT, 0.05, idle, flight);
    flight.player = { x: destination.x, y: destination.y };
    events = [...events, ...stepFlight(CONTENT, 0.05, idle, flight)];
    expect(events).not.toContainEqual(cue);
    expect(flight.guardCues).toEqual(["quest"]);
  });

  it("hands a distant summoned guard into combat without returning to its dormant anchor", () => {
    const { flight, guard } = guarded(enemyCatalog.frigate.pursuit.homeRadius + 600);
    syncFlightRegion(CONTENT, flight);
    expect(flight.world.notables[guard.id]).toBe(guard);
    expect(stepFlight(CONTENT, 0.05, idle, flight)).toContainEqual(cue);
    let steps = 0;
    while (flight.summonedGuards && steps++ < 1000) {
      stepFlight(CONTENT, 0.05, idle, flight);
    }
    expect(flight.summonedGuards).toBeUndefined();
    expect(onScreen(flight, guard)).toBe(true);
    // Leave the destination's safe area toward the arriving guard, without firing.
    const destination = flight.objects.find((object) => object.id === "quest")!;
    flight.player = { x: destination.x + CONTENT.tuning.safeRadius + 10, y: destination.y };
    stepFlight(CONTENT, 0.05, idle, flight);
    expect(guard.enemy!.returning).toBe(false);
    expect(guard.enemy!.engaged).toBe(true);
    for (let step = 0; step < 40; step++) {
      stepFlight(CONTENT, 0.05, idle, flight);
      expect(guard.enemy!.returning).toBe(false);
      expect(onScreen(flight, guard)).toBe(true);
    }
    expect(routeBlocked("quest", flight)).toBe(true);
    expect(flight.objects.filter((object) => object.id === guard.id)).toEqual([guard]);
    // Safety still breaks sight and ends the ordinary finite pursuit after the handoff.
    flight.player = { x: destination.x, y: destination.y };
    for (let step = 0; !guard.enemy!.returning && step < 160; step++) {
      stepFlight(CONTENT, 0.05, idle, flight);
    }
    expect(guard.enemy!.returning).toBe(true);
    expect(routeBlocked("quest", flight)).toBe(true);
  });

  it("summons across the world seam using the same nearby image for movement and its marker", () => {
    const { flight, guard } = guarded(1200);
    flight.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
    const destination = flight.objects.find((object) => object.id === "quest")!;
    Object.assign(destination, { x: GALAXY_SIDE / 2 - 200, y: 0 });
    flight.player = { x: destination.x, y: destination.y };
    moveGuard(flight, guard, { x: -GALAXY_SIDE / 2 + 1000, y: 0 });
    Object.assign(guard.enemy!, {
      home: { x: guard.x, y: guard.y },
      position: { x: guard.x, y: guard.y },
    });
    const context = flightWorldContext(flight);
    const tracker = createEdgeMarkerTracker({ worldSide: () => flight.topology?.side });
    expect(stepFlight(CONTENT, 0.05, idle, flight)).toContainEqual(cue);
    const marker = tracker.update(flight, new Set()).find(({ id }) => id === guard.id)!;
    expect(marker).toMatchObject({ id: guard.id, kind: "guard" });
    expect(marker.x - flight.player.x).toBeCloseTo(1200, 0);
    const initial = worldDistance(context, flight.player, guard);
    for (let step = 0; flight.summonedGuards && step < 500; step++) {
      stepFlight(CONTENT, 0.05, idle, flight);
      expect(flight.objects.filter(({ id }) => id === guard.id)).toHaveLength(1);
    }
    expect(worldDistance(context, flight.player, guard)).toBeLessThan(initial / 2);
    expect(flight.summonedGuards ?? []).not.toContain(guard.id);
    expect(onScreen(flight, guard)).toBe(true);
    expect(tracker.update(flight, new Set()).some(({ id }) => id === guard.id)).toBe(false);
    expect(routeBlocked("quest", flight)).toBe(true);
  });

  it("brings a summoned guard around a station without crossing its protected area", () => {
    const flight = createFlight(CONTENT, 1, 173, progress);
    flight.objects = [];
    const site = stationsNear(ECONOMY, 1, 20000, { x: 0, y: 0 })[0]!;
    const station = ensureStation(CONTENT, site.id, flight)!;
    const destination = ensureDestinationAt(
      CONTENT,
      "quest",
      { x: site.x - 1000, y: site.y },
      flight,
    );
    const guard = ensureRouteEncounter(CONTENT, "quest", flight)!;
    moveGuard(flight, guard, { x: site.x + 800, y: site.y });
    Object.assign(guard.enemy!, {
      home: { x: guard.x, y: guard.y },
      position: { x: guard.x, y: guard.y },
    });
    flight.player = { x: destination.x, y: destination.y };
    expect(stepFlight(CONTENT, 0.05, idle, flight)).toContainEqual(cue);
    const shield = flight.shield;
    for (let step = 0; flight.summonedGuards && step < 1200; step++) {
      stepFlight(CONTENT, 0.05, idle, flight);
      expect(worldDistance(flightWorldContext(flight), station, guard)).toBeGreaterThanOrEqual(
        ECONOMY.station.safeRadius + guard.radius,
      );
      expect(flight.shots.some((shot) => shot.enemy)).toBe(false);
    }
    expect(flight.summonedGuards).toBeUndefined();
    expect(onScreen(flight, guard)).toBe(true);
    expect(flight.shield).toBeGreaterThanOrEqual(shield);
    expect(routeBlocked("quest", flight)).toBe(true);
  });

  it("holds a summoned guard's fire until it is inside the current play view", () => {
    // East of Ada beyond the 720x360 base view but inside a view twice as wide.
    const narrow = guarded(600);
    stepFlight(CONTENT, 0.05, idle, narrow.flight);
    stepFlight(CONTENT, 0.05, idle, narrow.flight);
    expect(onScreen(narrow.flight, narrow.guard)).toBe(false);
    expect(narrow.flight.summonedGuards).toContain(narrow.guard.id);
    const wide = guarded(600);
    const wider: FlightInput = { ...idle, viewportWidth: 1440 };
    stepFlight(CONTENT, 0.05, wider, wide.flight);
    expect(wide.flight.summonedGuards).toContain(wide.guard.id);
    stepFlight(CONTENT, 0.05, wider, wide.flight);
    expect(wide.flight.summonedGuards ?? []).not.toContain(wide.guard.id);
  });

  it("does not cue outside Talk range, for an open route, or once the guard is disabled", () => {
    const outside = guarded(1200);
    const quest = outside.flight.objects.find((object) => object.id === "quest")!;
    outside.flight.player = { x: quest.x - CONTENT.tuning.talkRange - 1, y: quest.y };
    expect(stepFlight(CONTENT, 0.05, idle, outside.flight)).not.toContainEqual(cue);
    const disabled = guarded(1200);
    disabled.guard.enemy!.disabled = true;
    expect(routeBlocked("quest", disabled.flight)).toBe(false);
    expect(stepFlight(CONTENT, 0.05, idle, disabled.flight)).not.toContainEqual(cue);
    expect(disabled.flight.summonedGuards).toBeUndefined();
  });

  it("loads a dormant retained guard and keeps it loaded while it flies in", () => {
    const { flight, guard } = guarded((ACTIVE_CHUNK_RADIUS + 3) * CONTENT.tuning.chunkSize);
    syncFlightRegion(CONTENT, flight);
    expect(flight.objects).not.toContain(guard);
    expect(flight.world.notables[guard.id]).toBe(guard);
    expect(routeBlocked("quest", flight)).toBe(true);
    expect(stepFlight(CONTENT, 0.05, idle, flight)).toContainEqual(cue);
    expect(flight.objects).toContain(guard);
    expect(flight.summonedGuards).toEqual(expect.arrayContaining([guard.id]));
    const start = guard.x;
    for (let step = 0; step < 100; step++) {
      stepFlight(CONTENT, 0.05, idle, flight);
    }
    // Still loaded, five seconds closer.
    expect(flight.objects).toContain(guard);
    expect(guard.x).toBeLessThan(start - 100);
  });
});
