import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { playOpening } from "../testing/launch.ts";
import { stepFlight } from "./flight.ts";
import { flightEncounterSeed } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval, worldSyncFlightRegion } from "./geography.ts";
import { markerObjectTracked } from "./markerKnowledge.ts";
import { restoreSave } from "./save.ts";
import type { SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function fixture() {
  const game = new GameModel(CONTENT);
  game.startGalaxy(1);
  playOpening(game);
  const flight = game.state.flight!;
  const pickup: SpaceObject = {
    amount: 3,
    hp: 1,
    id: "cache:tracked",
    kind: "pickup",
    radius: 5,
    role: "discovery",
    x: 20000,
    y: 20000,
  };
  flight.objects = [pickup];
  flight.world.notables = {};
  flight.markerActors = {
    encounterSeed: flightEncounterSeed(flight),
    knowledge: { [pickup.id]: "sensed" },
  };
  return { flight, game, pickup };
}

it("retains a sensed discovery pickup through unload and Continue, then claims it exactly once", () => {
  const { flight, game, pickup } = fixture();
  const known = [...game.state.progress[1].known];
  const before = structuredClone(pickup);
  worldSyncFlightRegion({}, CONTENT, flight);
  expect(flight.objects).toEqual([]);
  expect(flight.world.notables[pickup.id]).toEqual(before);
  const document = game.saveDocument();
  expect(restoreSave(document)).toEqual(document);
  const resumed = new GameModel(CONTENT, document);
  resumed.continueGame();
  const continued = resumed.state.flight!;
  expect(continued).toEqual(flight);
  continued.player = { x: pickup.x, y: pickup.y };
  worldSyncFlightRegion({}, CONTENT, continued);
  expect(continued.objects).toEqual([before]);
  expect(continued.world.notables).toEqual({});
  const events = stepFlight(CONTENT, 1 / 60, idle, continued);
  expect(
    events.filter((event) => event.type === "collected" && event.id === pickup.id),
  ).toHaveLength(1);
  expect(events.filter((event) => event.type === "stardust")).toContainEqual({
    amount: 3,
    type: "stardust",
  });
  expect(continued.world.notables[pickup.id]).toBeNull();
  expect(continued.objects.some((object) => object.id === pickup.id)).toBe(false);
  expect(
    stepFlight(CONTENT, 1 / 60, idle, continued).filter(
      (event) => event.type === "collected" && event.id === pickup.id,
    ),
  ).toEqual([]);
  const claimed = resumed.saveDocument();
  expect(restoreSave(claimed)).toEqual(claimed);
  expect(resumed.state.progress[1].known).toEqual(known);
});

it("retains explicit discovery removal after HP zero without requiring knowledge to remain", () => {
  const { flight, game, pickup } = fixture();
  pickup.hp = 0;
  expect(markerObjectTracked(flight, pickup)).toBe(true);
  worldRecordObjectRemoval({}, CONTENT, pickup, flight);
  delete flight.markerActors!.knowledge[pickup.id];
  flight.objects = [];
  expect(flight.world.notables[pickup.id]).toBeNull();
  expect(restoreSave(game.saveDocument())).toEqual(game.saveDocument());
});

it("rejects untracked, wrong-epoch and malformed discovery pickup saves", () => {
  const { flight, game, pickup } = fixture();
  worldSyncFlightRegion({}, CONTENT, flight);
  const base = game.saveDocument();
  for (const mutate of [
    (saved: typeof base) => {
      saved.flight!.markerActors!.knowledge = {};
    },
    (saved: typeof base) => {
      saved.flight!.markerActors!.encounterSeed += 1;
    },
    (saved: typeof base) => {
      saved.flight!.world.notables[pickup.id]!.amount = 1.5;
    },
    (saved: typeof base) => {
      saved.flight!.objects.push(saved.flight!.world.notables[pickup.id]!);
    },
  ]) {
    const saved = structuredClone(base);
    mutate(saved);
    expect(restoreSave(saved)).toBeNull();
  }
});

it("does not extend tracked-object retention to unrelated pickups or protected object kinds", () => {
  const { flight, game, pickup } = fixture();
  for (const delta of [
    { role: "cargo" },
    { role: "stardust" },
    { amount: undefined },
    { upgrade: true },
    { ammoPack: true },
    { kind: "rock" },
    { kind: "station" },
    { kind: "destination" },
    { kind: "enemy" },
  ] as const) {
    const object = { ...pickup, ...delta } as SpaceObject;
    expect(markerObjectTracked(flight, object)).toBe(false);
    const saved = structuredClone(game.saveDocument());
    saved.flight!.objects = [];
    saved.flight!.world.notables = { [object.id]: object };
    expect(restoreSave(saved)).toBeNull();
  }
  flight.objects = [{ ...pickup, role: "cargo" }];
  worldSyncFlightRegion({}, CONTENT, flight);
  expect(flight.objects).toEqual([]);
  expect(flight.world.notables).toEqual({});
});
