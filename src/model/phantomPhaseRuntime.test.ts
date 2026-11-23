import { afterEach, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT, GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP, PHANTOM_TUNING } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { outlinesContact } from "./convex.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { ACTIVE_CHUNK_RADIUS, worldActivateFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import * as pendingPlans from "./phantomRequiredPlans.ts";
import { restoreSave } from "./save.ts";
import { shipTuning } from "./upgrades.ts";
import { periodicWorldGrid } from "./worldCells.ts";
import { worldDelta, worldDistance, worldPoint } from "./worldContacts.ts";

const originallyBuilt = BUILT.has(6);
afterEach(() => {
  vi.restoreAllMocks();
  if (!originallyBuilt) {
    (BUILT as Set<GalaxyNumber>).delete(6);
  }
});

function launched(withAlly = false) {
  (BUILT as Set<GalaxyNumber>).add(6);
  const model = new GameModel(CONTENT);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  if (withAlly) {
    model.state.progress[1].activityCompleted = true;
  }
  model.state.progress[6].opened = true;
  model.startGalaxy(6);
  return model;
}

function disablePrimary(model: GameModel, ids: readonly string[]): void {
  const flight = model.state.flight!;
  for (const id of ids) {
    const represented = stationPopulationObjects(flight).find((object) => object.id === id)!;
    worldActivateFlightRegion(flightWorldContext(flight), CONTENT, represented, flight);
    const actor = flight.objects.find((object) => object.id === id)!;
    const definition = enemyEquipmentDefinition(6, actor.enemy!);
    const weapons = definition.hardpoints.filter(({ kind }) => kind === "weapon");
    if (weapons.length) {
      for (const part of weapons) {
        actor.enemy = damageEnemy(
          definition,
          { amount: part.hp, hardpointId: part.id },
          actor.enemy!,
        );
      }
    } else {
      actor.enemy = damageEnemy(
        definition,
        { amount: definition.hp, hardpointId: null },
        actor.enemy!,
      );
      actor.hp = actor.enemy.hp;
    }
  }
}

function freeSettlements(model: GameModel): void {
  const flight = model.state.flight!;
  for (const id of PHANTOM_DESTINATIONS) {
    disablePrimary(model, flight.phantom!.blockades[id]!);
    const site = stationPopulationObjects(flight).find((object) => object.id === id)!;
    flight.player = { x: site.x, y: site.y };
    flight.velocity = { x: 0, y: 0 };
    model.step(0.001, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    model.step(0.001, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    model.interact();
    expect(model.state.dialogue, id).not.toBeNull();
    model.choose("continue");
  }
  expect(model.state.progress[6].phantom!.flagshipKnown).toBe(true);
  expect(flight.phantom!.phase).toBe("approach");
}

function fixedBlockers(model: GameModel) {
  const flight = model.state.flight!;
  const pending = pendingPlans.readPendingPhantomEncounter(flight);
  if (pending?.kind !== "flagship") {
    return [];
  }
  const world = flightWorldContext(flight);
  return stationPopulationObjects(flight).filter((actor) => {
    if (!actor.enemy?.disabled || actor.hp <= 0) {
      return false;
    }
    const obstacle = enemyPhysicalBody(ROUTE_POSITION[flight.galaxy], actor.enemy);
    return (
      obstacle &&
      pending.actors.some((incoming) => {
        const body = enemyPhysicalBody(ROUTE_POSITION[flight.galaxy], incoming.enemy!);
        return (
          body && outlinesContact(body, incoming, obstacle, worldPoint(world, incoming, actor))
        );
      })
    );
  });
}

it("prepares one full next batch before optional generation and retains it unchanged on reads and Continue", () => {
  const model = launched();
  const flight = model.state.flight!;
  const pending = pendingPlans.readPendingPhantomEncounter(flight)!;
  expect(pending).toMatchObject({ kind: "wave", wave: 1 });
  expect(flight.phantom).toMatchObject({ enemyIds: [], phase: "blockades", wave: 0 });
  const active = new Set(stationPopulationObjects(flight).map(({ id }) => id));
  expect(pending.actors.every(({ id }) => !active.has(id))).toBe(true);
  const before = structuredClone(model.state);
  void model.map;
  void model.quests;
  void model.contextQuestDetails;
  expect(pendingPlans.readPendingPhantomEncounter(flight)).toBe(pending);
  expect(model.state).toEqual(before);
  const resumed = relaunch(CONTENT, model.save());
  expect(resumed.state.flight).toEqual(flight);
});

it("saves the actual departing ally heading and restores older departures without it", () => {
  const model = launched(true);
  const flight = model.state.flight!;
  freeSettlements(model);
  flight.player = { ...flight.phantom!.waypoint };
  const input = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
  model.step(0.001, input);
  const state = flight.phantom!;
  const ally = state.allies.find(({ id }) => id === "clover")!;
  ally.facing = { x: 0.6, y: -0.8 };
  ally.velocity = { x: 0, y: 0 };
  disablePrimary(model, state.enemyIds);
  model.step(0.000001, input);
  const current = state.departures?.find(({ id }) => id === ally.id);
  if (!current) {
    throw new Error("Clover did not depart at the wave boundary");
  }
  expect(current.facing).toEqual({ x: 0.6, y: -0.8 });
  expect(restoreSave(model.save())?.flight?.phantom?.departures).toEqual(state.departures);
  delete current.facing;
  expect(restoreSave(model.save())?.flight?.phantom?.departures).toEqual(state.departures);
});

it("transfers actual phases and clears fixed-waypoint blockers only through canonical salvage and paging", () => {
  const stored = vi.spyOn(pendingPlans, "storePendingPhantomEncounter");
  const model = launched();
  const flight = model.state.flight!;
  freeSettlements(model);
  flight.player = { ...flight.phantom!.waypoint };
  model.markerTargetDisplayed(PHANTOM_FLAGSHIP);
  expect(flight.markerActors?.knowledge[PHANTOM_FLAGSHIP]).toBeUndefined();
  const completed: number[] = [];
  const salvaged = new Set<string>();
  for (let phase = 0; phase <= PHANTOM_TUNING.waves; phase++) {
    const beforeWave = flight.phantom!.wave;
    const beforePhase: string = flight.phantom!.phase;
    let transferred = false;
    const seconds = 0.1;
    const physics = shipTuning(ECONOMY, CONTENT, flight.levels).physics;
    const world = flightWorldContext(flight);
    const approach = Math.max(
      0,
      ...fixedBlockers(model).map((actor) => worldDistance(world, flight.player, actor)),
    );
    const departure =
      (ACTIVE_CHUNK_RADIUS + 1) * periodicWorldGrid(world, CONTENT.tuning.chunkSize).pitch;
    const frameLimit = Math.ceil(
      ((approach + departure) / physics.maxSpeed +
        physics.accelerationSeconds * 2 +
        physics.brakingSeconds) /
        seconds,
    );
    for (let frame = 0; frame < frameLimit; frame++) {
      // Isolate phase geometry while canonical AI moves surviving support fighters.
      for (const actor of stationPopulationObjects(flight)) {
        if (!actor.enemy) {
          continue;
        }
        actor.enemy.primaryCooldown = 999;
        for (const part of actor.enemy.hardpoints) {
          part.cooldown = 999;
        }
      }
      const blockers = fixedBlockers(model);
      const target = blockers.find((actor) => !actor.enemy!.salvaged);
      let movement = { x: 1, y: 0 };
      if (target) {
        const delta = worldDelta(world, flight.player, target);
        const distance = Math.hypot(delta.x, delta.y);
        movement = distance ? { x: delta.x / distance, y: delta.y / distance } : { x: 0, y: 0 };
      }
      if (target && model.contextAction === "salvage") {
        const candidates = stationPopulationObjects(flight).filter(
          (actor) => actor.enemy?.disabled && !actor.enemy.salvaged,
        );
        model.interact();
        for (const actor of candidates) {
          if (actor.enemy!.salvaged) {
            salvaged.add(actor.id);
          }
        }
        if (model.state.dialogue) {
          model.choose("continue");
        }
      }
      model.step(seconds, { aim: { x: 0, y: 0 }, move: movement, use: false });
      if (flight.phantom!.wave !== beforeWave || flight.phantom!.phase !== beforePhase) {
        transferred = true;
        break;
      }
    }
    expect(
      transferred,
      `phase ${phase}: mode=${model.state.mode}, shield=${flight.shield}, blockers=${fixedBlockers(
        model,
      )
        .map(({ id }) => id)
        .join(",")}`,
    ).toBe(true);
    const batch = stored.mock.results
      .flatMap((result) => (result.type === "return" ? [result.value] : []))
      .findLast((batch) =>
        flight.phantom!.phase === "flagship"
          ? batch.kind === "flagship"
          : batch.kind === "wave" && batch.wave === flight.phantom!.wave,
      )!;
    expect(batch).toBeDefined();
    const represented = stationPopulationObjects(flight);
    for (const actor of batch.actors) {
      expect(represented.find(({ id }) => id === actor.id)).toBe(actor);
    }
    expect(relaunch(CONTENT, model.save()).state.flight).toEqual(flight);
    if (flight.phantom!.phase === "flagship") {
      break;
    }
    completed.push(flight.phantom!.wave);
    disablePrimary(model, flight.phantom!.enemyIds);
  }
  expect(completed).toEqual([1, 2, 3]);
  expect(flight.phantom!.phase).toBe("flagship");
  expect(pendingPlans.readPendingPhantomEncounter(flight)).toBeNull();
  for (const id of salvaged) {
    const actor = stationPopulationObjects(flight).find((actor) => actor.id === id);
    expect(actor?.enemy?.salvaged === true || flight.world.notables[id] === null).toBe(true);
  }
});
