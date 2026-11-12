import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { createEdgeMarkerTracker, gameAreaPoint, inGameArea } from "./edge-markers.ts";
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
  SectorProgress,
  SpaceObject,
} from "./types.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const progress: SectorProgress = {
  charted: [],
  deposited: 0,
  destroyedEnemies: 0,
  discoveries: 0,
  donated: {},
  explored: [],
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

/** A sector one flight with Ada at the quest destination and its guard `away` units east. */
function guarded(away: number): { flight: FlightState; guard: SpaceObject } {
  const flight = createFlight(PROTOTYPE, 1, 173, progress);
  flight.objects = [];
  const destination = ensureDestination(PROTOTYPE, "quest", flight);
  const guard = ensureRouteEncounter(PROTOTYPE, "quest", flight)!;
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
    expect(stepFlight(PROTOTYPE, 0.05, idle, flight)).toContainEqual(cue);
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
      events = [...events, ...stepFlight(PROTOTYPE, 0.05, idle, flight)];
      expect(flight.shots.some((shot) => shot.enemy)).toBe(false);
      seconds += 0.05;
    }
    expect(flight.summonedGuards).toBeUndefined();
    expect(onScreen(flight, guard)).toBe(true);
    expect(guard.enemy!.engaged).toBe(true);
    // Leaving and coming back in the same flight does not cue it again.
    const destination = flight.objects.find((object) => object.id === "quest")!;
    flight.player = { x: destination.x - 2000, y: destination.y };
    stepFlight(PROTOTYPE, 0.05, idle, flight);
    flight.player = { x: destination.x, y: destination.y };
    events = [...events, ...stepFlight(PROTOTYPE, 0.05, idle, flight)];
    expect(events).not.toContainEqual(cue);
    expect(flight.guardCues).toEqual(["quest"]);
  });

  it("does not cue outside Talk range, for an open route, or once the guard is disabled", () => {
    const outside = guarded(1200);
    const quest = outside.flight.objects.find((object) => object.id === "quest")!;
    outside.flight.player = { x: quest.x - PROTOTYPE.tuning.talkRange - 1, y: quest.y };
    expect(stepFlight(PROTOTYPE, 0.05, idle, outside.flight)).not.toContainEqual(cue);
    const disabled = guarded(1200);
    disabled.guard.enemy!.disabled = true;
    expect(routeBlocked("quest", disabled.flight)).toBe(false);
    expect(stepFlight(PROTOTYPE, 0.05, idle, disabled.flight)).not.toContainEqual(cue);
    expect(disabled.flight.summonedGuards).toBeUndefined();
  });

  it("loads a dormant retained guard and keeps it loaded while it flies in", () => {
    const { flight, guard } = guarded((ACTIVE_CHUNK_RADIUS + 3) * PROTOTYPE.tuning.chunkSize);
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.objects).not.toContain(guard);
    expect(flight.world.notables[guard.id]).toBe(guard);
    expect(routeBlocked("quest", flight)).toBe(true);
    expect(stepFlight(PROTOTYPE, 0.05, idle, flight)).toContainEqual(cue);
    expect(flight.objects).toContain(guard);
    expect(flight.summonedGuards).toEqual([guard.id]);
    const start = guard.x;
    for (let step = 0; step < 100; step++) {
      stepFlight(PROTOTYPE, 0.05, idle, flight);
    }
    // Still loaded, five seconds closer.
    expect(flight.objects).toContain(guard);
    expect(guard.x).toBeLessThan(start - 100);
  });
});
