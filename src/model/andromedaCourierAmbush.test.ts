import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { chooseAndromeda, useAndromeda } from "./andromeda.ts";
import {
  admitCourierAmbush,
  advanceCourierAmbush,
  courierAmbushActor,
  courierAmbushLeg,
  courierAmbushMarkers,
  type CourierAmbushState,
  planCourierAmbush,
  releasedCourierPairs,
  stepCourierAmbush,
  validCourierAmbushAttempt,
} from "./andromedaCourierAmbush.ts";
import { nearestSettlerStation } from "./andromedaPlaces.ts";
import { createUnpopulatedFlight, questGuardPlacementContext } from "./flight.ts";
import { newProgress } from "./progress.ts";
import type { SpaceObject } from "./types.ts";

const leg = { settlement: { x: 2_000, y: 0 }, station: { x: 0, y: 0 } };

it("offers one complete formation, with both pairs and the exact clear lane", () => {
  const plan = planCourierAmbush({ memberSpacing: 110 }, leg)!;
  expect(plan).toEqual({
    escape: { from: { x: 475, y: 0 }, halfWidth: 100, to: { x: 1_450, y: 0 } },
    forward: { x: 1, y: 0 },
    pairs: [
      {
        centre: { x: 1_060, y: 260 },
        members: [
          { x: 1_005, y: 260 },
          { x: 1_115, y: 260 },
        ],
      },
      {
        centre: { x: 1_060, y: -260 },
        members: [
          { x: 1_005, y: -260 },
          { x: 1_115, y: -260 },
        ],
      },
    ],
    warning: { x: 475, y: 0 },
  });
  expect(planCourierAmbush({ memberSpacing: 140 }, leg)?.pairs).toEqual([
    {
      centre: { x: 1_060, y: 260 },
      members: [
        { x: 990, y: 260 },
        { x: 1_130, y: 260 },
      ],
    },
    {
      centre: { x: 1_060, y: -260 },
      members: [
        { x: 990, y: -260 },
        { x: 1_130, y: -260 },
      ],
    },
  ]);
});

it("warns on the inbound crossing in range, then releases at 3 and 4.2 and stops at 15", () => {
  const plan = planCourierAmbush({ memberSpacing: 110 }, leg)!;
  const armed: CourierAmbushState = { phase: "armed" };
  const step = (state: CourierAmbushState, seconds: number, from = 474, to = 476, y = 0) =>
    stepCourierAmbush({ player: { x: to, y }, previous: { x: from, y }, seconds }, plan, state);
  expect(step(armed, 1, 476, 474)).toBe(armed);
  expect(step(armed, 1, 474, 476, 181)).toBe(armed);
  const warned = step(armed, 1, 474, 476, 180);
  expect(warned).toEqual({ elapsed: 0, phase: "warned" });
  expect(releasedCourierPairs(step(warned, 2.99))).toBe(0);
  expect(releasedCourierPairs(step(warned, 3))).toBe(1);
  expect(releasedCourierPairs(step(warned, 4.19))).toBe(1);
  expect(releasedCourierPairs(step(warned, 4.2))).toBe(2);
  const retained = structuredClone(step(warned, 10));
  expect(releasedCourierPairs(step(retained, 4.99))).toBe(2);
  const timedOut = step(retained, 5);
  expect(timedOut).toEqual({ phase: "ended" });
  expect(releasedCourierPairs(timedOut)).toBe(0);
  expect(step(timedOut, 1)).toBe(timedOut);
});

it("uses the shortest wrapped leg and ends pursuit at the exit without a combat condition", () => {
  const world = { worldSide: 10_000 };
  const plan = planCourierAmbush(
    { ...world, memberSpacing: 110 },
    { settlement: { x: -4_000, y: 0 }, station: { x: 4_000, y: 0 } },
  )!;
  expect(plan.forward).toEqual({ x: 1, y: 0 });
  expect(plan.escape).toEqual({
    from: { x: 4_475, y: 0 },
    halfWidth: 100,
    to: { x: -4_550, y: 0 },
  });
  const warned = stepCourierAmbush(
    { ...world, player: { x: 4_480, y: 0 }, previous: { x: 4_470, y: 0 }, seconds: 1 },
    plan,
    { phase: "armed" },
  );
  const ended = stepCourierAmbush(
    { ...world, player: { x: -4_540, y: 0 }, previous: { x: -4_560, y: 0 }, seconds: 1 },
    plan,
    warned,
  );
  expect(ended).toEqual({ phase: "ended" });
});

const retainedLeg = {
  settlement: { id: "settlement:accepted", x: 5_000, y: 0 },
  station: { id: "station:accepted", x: 3_000, y: 0 },
};

function controlledFlight() {
  const flight = createUnpopulatedFlight(CONTENT, 5, 1234);
  const plannedClear = vi.fn(() => true);
  const context = { ...questGuardPlacementContext(CONTENT, flight), plannedClear, stage: 4 };
  return { context, flight, plannedClear };
}

it("reads only the sites bound by Pip's actual owns-up choice and leaves delivery available", () => {
  const { flight } = controlledFlight();
  const station = nearestSettlerStation(ECONOMY, flight.player);
  const progress = newProgress();
  const context = { content: CONTENT, flight, progress };
  progress.stage = 3;
  progress.andromeda = { station: station.id };
  expect(courierAmbushLeg(flight, progress)).toBeUndefined();
  const ownsUp = useAndromeda(context, station.id)?.dialogue;
  expect(ownsUp?.context).toBe("andromeda:ownsUp");
  chooseAndromeda(context, ownsUp!, "continue");
  const actual = courierAmbushLeg(flight, progress);
  expect(actual?.station.id).toBe(progress.andromeda.station);
  expect(actual?.settlement.id).toBe(progress.andromeda.settlement);
  expect(actual?.settlement.id).not.toBe(actual?.station.id);
  const parts = useAndromeda(context, actual!.settlement.id)?.dialogue;
  expect(parts?.context).toBe("andromeda:parts");
  chooseAndromeda(context, parts!, "continue");
  expect(progress).toMatchObject({ questItem: "beaconParts", stage: 5 });
  expect(courierAmbushLeg(flight, progress)).toBeUndefined();
});

function blocker(id: string, x: number, y: number): SpaceObject {
  return { hp: 1, id, kind: "rock", radius: 20, x, y };
}

it.each([
  { name: "one pair's footprint", setup: [blocker("pair-collision", 4_005, -260)] },
  { name: "the corridor after the pairs", setup: [blocker("lane-collision", 4_360, 90)] },
  {
    name: "the single shared population budget",
    setup: [
      { ...blocker("budget1", 4_000, 700), kind: "enemy" as const },
      { ...blocker("budget2", 4_000, -700), kind: "enemy" as const },
    ],
  },
])("skips the entire leg when $name cannot fit and never spends a second attempt", ({ setup }) => {
  const { context, flight, plannedClear } = controlledFlight();
  flight.objects.push(...setup);
  const snapshot = structuredClone(flight);
  const rejected = admitCourierAmbush(context, retainedLeg, undefined);
  expect(rejected).toMatchObject({ actors: [], attempt: { state: { phase: "skipped" } } });
  expect(plannedClear).not.toHaveBeenCalled();
  expect(flight).toEqual(snapshot);
  flight.objects = [];
  const stored = JSON.parse(JSON.stringify(rejected!.attempt));
  expect(validCourierAmbushAttempt(stored)).toBe(true);
  expect(admitCourierAmbush(context, retainedLeg, stored)).toBeNull();
  expect(courierAmbushMarkers(stored)).toBeNull();
});

it("requires distant geometry to be checked before publishing a single detached four-fighter batch", () => {
  const { context, flight, plannedClear } = controlledFlight();
  expect(admitCourierAmbush({ ...context, stage: 3 }, retainedLeg, undefined)).toBeNull();
  expect(admitCourierAmbush(context, undefined, undefined)).toBeNull();
  const launchLeg = {
    settlement: { ...leg.settlement, id: retainedLeg.settlement.id },
    station: { ...leg.station, id: retainedLeg.station.id },
  };
  expect(admitCourierAmbush(context, launchLeg, undefined)?.actors).toHaveLength(0);
  expect(plannedClear).not.toHaveBeenCalled();
  const reserved = vi.fn(() => false);
  expect(
    admitCourierAmbush({ ...context, plannedClear: reserved }, retainedLeg, undefined)?.actors,
  ).toHaveLength(0);
  expect(reserved).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      escape: { from: { x: 3_475, y: 0 }, halfWidth: 100, to: { x: 4_450, y: 0 } },
      pairs: expect.arrayContaining([
        expect.objectContaining({ centre: { x: 4_060, y: 260 } }),
        expect.objectContaining({ centre: { x: 4_060, y: -260 } }),
      ]),
    }),
  );

  const allocation = admitCourierAmbush(context, retainedLeg, undefined)!;
  expect(plannedClear).toHaveBeenCalledOnce();
  expect(allocation.actors).toHaveLength(4);
  expect(flight.objects).toHaveLength(0);
  expect(Object.keys(flight.world.notables)).toHaveLength(0);
  expect(new Set(allocation.actors.map(({ id }) => id)).size).toBe(4);
  expect(new Set(allocation.actors.map(({ enemy }) => enemy?.packId)).size).toBe(2);
  for (const actor of allocation.actors) {
    expect(actor).toMatchObject({
      enemy: { archetype: "fighter", engaged: false },
      persistent: true,
    });
    expect(actor.routeId).toBeUndefined();
    expect(courierAmbushActor(allocation.attempt, actor.id)).toBe("held");
  }
  const missing = allocation.actors[0]!;
  flight.world.notables[missing.id] = null;
  expect(admitCourierAmbush(context, retainedLeg, undefined)?.actors).toHaveLength(0);
});

it("restores warning, release and exit against the same actor IDs without respawning casualties", () => {
  const { context, flight } = controlledFlight();
  const allocation = admitCourierAmbush(context, retainedLeg, undefined)!;
  const ids = allocation.actors.map(({ id }) => id);
  const cross = { player: { x: 3_476, y: 0 }, previous: { x: 3_474, y: 0 }, seconds: 1 };
  const warning = advanceCourierAmbush(cross, 4, allocation.attempt);
  expect(warning.warning).toBe(true);
  expect(courierAmbushMarkers(warning.attempt)).toEqual({
    approaches: [
      { x: 4_060, y: 260 },
      { x: 4_060, y: -260 },
    ],
    escape: { from: { x: 3_475, y: 0 }, halfWidth: 100, to: { x: 4_450, y: 0 } },
    forward: { x: 1, y: 0 },
    warning: { x: 3_475, y: 0 },
  });
  const resumed = JSON.parse(JSON.stringify(warning.attempt));
  expect(validCourierAmbushAttempt(resumed)).toBe(true);
  expect(
    validCourierAmbushAttempt({ ...resumed, state: { elapsed: Infinity, phase: "warned" } }),
  ).toBe(false);
  expect(validCourierAmbushAttempt({ ...resumed, plan: { escape: {} } })).toBe(false);
  flight.world.notables[ids[0]!] = null;
  expect(admitCourierAmbush(context, retainedLeg, resumed)).toBeNull();
  const first = advanceCourierAmbush({ ...cross, seconds: 3 }, 4, resumed);
  expect(first.warning).toBe(false);
  const status = (attempt: typeof resumed) => ids.map((id) => courierAmbushActor(attempt, id));
  expect(status(first.attempt)).toEqual(["released", "released", "held", "held"]);
  const second = advanceCourierAmbush({ ...cross, seconds: 1.2 }, 4, first.attempt);
  expect(status(second.attempt)).toEqual(["released", "released", "released", "released"]);
  const end = advanceCourierAmbush(
    { player: { x: 4_451, y: 0 }, previous: { x: 4_449, y: 0 }, seconds: 0.1 },
    4,
    second.attempt,
  );
  expect(status(end.attempt)).toEqual(["ended", "ended", "ended", "ended"]);
  expect(courierAmbushMarkers(end.attempt)).toBeNull();
  expect(advanceCourierAmbush(cross, 4, end.attempt).warning).toBe(false);
  expect(advanceCourierAmbush(cross, 5, resumed).attempt).toEqual(end.attempt);
  expect(courierAmbushActor(end.attempt, "ambient:fighter")).toBeUndefined();
});
