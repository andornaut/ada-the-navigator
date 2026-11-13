import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { createEdgeMarkerTracker, gameAreaPoint, inGameArea } from "./edgeMarkers.ts";
import {
  createFlight,
  ensureDestination,
  ensureRouteEncounter,
  routeBlocked,
  stepFlight,
  syncFlightRegion,
} from "./flight.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import type {
  FlightEvent,
  FlightInput,
  FlightState,
  GalaxyProgress,
  SpaceObject,
} from "./types.ts";

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

/** A galaxy one flight with Ada at the quest destination and its guard `away` units east. */
function guarded(away: number): { flight: FlightState; guard: SpaceObject } {
  const flight = createFlight(CONTENT, 1, 173, progress);
  flight.objects = [];
  const destination = ensureDestination(CONTENT, "quest", flight);
  const guard = ensureRouteEncounter(CONTENT, "quest", flight)!;
  const at = { x: destination.x + away, y: destination.y };
  Object.assign(guard, at);
  guard.enemy!.home = { ...at };
  guard.enemy!.position = { ...at };
  flight.player = { x: destination.x, y: destination.y };
  return { flight, guard };
}
const onScreen = (flight: FlightState, object: SpaceObject) =>
  inGameArea(gameAreaPoint(flight.player, object));

describe("a blocking guard's cue", () => {
  it("cues once per flight when Ada reaches the destination, summoning and marking the guard", () => {
    const { flight, guard } = guarded(1200);
    expect(onScreen(flight, guard)).toBe(false);
    expect(stepFlight(CONTENT, 0.05, idle, flight)).toContainEqual(cue);
    expect(flight.guardCues).toEqual(["quest"]);
    expect(flight.summonedGuards).toEqual([guard.id]);
    // Its guard marker shows though Ada has never seen it.
    expect(createEdgeMarkerTracker().update(flight, new Set())).toEqual([
      { bar: 1, id: guard.id, kind: "guard", x: guard.x, y: guard.y },
    ]);
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

  it("holds a summoned guard's fire until it is inside the current play view", () => {
    // East of Ada beyond the 720x360 base view but inside a view twice as wide.
    const narrow = guarded(600);
    stepFlight(CONTENT, 0.05, idle, narrow.flight);
    stepFlight(CONTENT, 0.05, idle, narrow.flight);
    expect(onScreen(narrow.flight, narrow.guard)).toBe(false);
    expect(narrow.flight.summonedGuards).toEqual([narrow.guard.id]);
    const wide = guarded(600);
    const wider: FlightInput = { ...idle, viewportWidth: 1440 };
    stepFlight(CONTENT, 0.05, wider, wide.flight);
    expect(wide.flight.summonedGuards).toEqual([wide.guard.id]);
    stepFlight(CONTENT, 0.05, wider, wide.flight);
    expect(wide.flight.summonedGuards).toBeUndefined();
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
    expect(flight.summonedGuards).toEqual([guard.id]);
    const start = guard.x;
    for (let step = 0; step < 100; step++) {
      stepFlight(CONTENT, 0.05, idle, flight);
    }
    // Still loaded, five seconds closer.
    expect(flight.objects).toContain(guard);
    expect(guard.x).toBeLessThan(start - 100);
  });
});
