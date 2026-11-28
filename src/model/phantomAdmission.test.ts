import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS } from "../data/phantom.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { clearPhantomTraffic } from "../testing/phantomTraffic.ts";
import { damageEnemy } from "./ai/index.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { createFlight, inDanger, routeBlocked, spawnChapterEnemy, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { phantomBlockadeAdmits } from "./phantom/index.ts";
import { newProgress } from "./progress.ts";
import type { FlightInput, FlightState, SpaceObject } from "./types.ts";
import {
  flightWorldContext,
  periodicWorldGrid,
  worldCellKey,
  worldCellsNear,
} from "./world/index.ts";

const siteId = PHANTOM_DESTINATIONS[0];
const cue = { id: siteId, type: "guardCue" };
const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function blockade() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  model.state.progress[6].opened = true;
  model.startGalaxy(6);
  const flight = model.state.flight!;
  const world = flightWorldContext(flight);
  const site = stationPopulationObjects(flight).find(({ id }) => id === siteId)!;
  const at = (offset: number) => ({ x: site.x + offset, y: site.y });
  const place = (offset: number, velocity = 0) => {
    flight.player = at(offset);
    flight.velocity = { x: velocity, y: 0 };
    worldSyncFlightRegion(world, CONTENT, flight);
    clearPhantomTraffic(flight);
    const grid = periodicWorldGrid(world, CONTENT.tuning.chunkSize);
    flight.chunks = [
      ...new Set([
        ...flight.chunks,
        ...Array.from(worldCellsNear(grid, grid.pitch * 2, flight.player), (cell) =>
          worldCellKey(grid, cell),
        ),
      ]),
    ];
  };
  const members = () => {
    const actors = stationPopulationObjects(flight);
    const ids = flight.phantom!.blockades[siteId]!;
    const leader = actors.find(
      ({ enemy, id }) => ids.includes(id) && enemy?.archetype === "frigate",
    )!;
    return {
      fighters: actors.filter(({ id }) => id !== leader.id && ids.includes(id)),
      leader,
      reserve: [leader, ...actors.filter(({ enemy }) => enemy?.escortOf === leader.id)],
    };
  };
  return { flight, members, model, phase: () => flight.phantom!.blockadePhases?.[siteId], place };
}

function setEngaged(flight: FlightState, actors: readonly SpaceObject[]): void {
  for (const actor of actors) {
    actor.enemy!.engaged = true;
    actor.enemy!.lastSeen = { ...flight.player };
  }
}

it("withholds real blockade actors from combat, danger and their route cue while retaining patrol", () => {
  const f = blockade();
  f.place(80);
  const { fighters, reserve } = f.members();
  const actors = [...fighters, ...reserve];
  expect(fighters.length).toBeGreaterThan(1);
  expect(reserve.length).toBeGreaterThan(1);
  const initial = actors.map(({ x, y }) => ({ x, y }));
  setEngaged(f.flight, actors);
  f.flight.summonedGuards = actors.map(({ id }) => id);
  expect(inDanger(CONTENT, 720, f.flight)).toBe(true);
  const legacy = structuredClone(f.flight);
  expect(stepFlight(CONTENT, 0.03, idle, legacy)).toContainEqual(cue);

  const events = stepFlight(
    CONTENT,
    0.03,
    { ...idle, admitEnemy: phantomBlockadeAdmits },
    f.flight,
  );
  expect(events).not.toContainEqual(cue);
  expect(f.flight.guardCues ?? []).not.toContain(siteId);
  expect(f.flight.summonedGuards ?? []).toEqual([]);
  expect(actors.every(({ enemy }) => !enemy?.engaged && enemy?.lastSeen === null)).toBe(true);
  expect(f.flight.shots.some(({ enemy }) => enemy)).toBe(false);
  expect(inDanger(CONTENT, 720, f.flight)).toBe(false);
  expect(actors.map(({ x, y }) => ({ x, y }))).not.toEqual(initial);
  expect(routeBlocked(siteId, f.flight)).toBe(true);
});

it("applies a player hit to a withheld ship without waking its combat or danger", () => {
  const f = blockade();
  f.place(80);
  const { fighters } = f.members();
  const target = fighters.find((actor) => Math.abs(actor.x - f.flight.player.x) < 480)!;
  const before = target.hp;
  f.flight.shots.push({
    damage: 1,
    enemy: false,
    hitIds: [],
    id: "shot:reserved-target",
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
    x: target.x,
    y: target.y,
  });
  const idleWithPolicy = { ...idle, admitEnemy: phantomBlockadeAdmits };
  stepFlight(CONTENT, 0.01, idleWithPolicy, f.flight);
  expect(target.hp).toBe(before - 1);
  expect(target.enemy?.engaged).toBe(false);
  expect(f.flight.dangerFor).toBe(0);
  expect(inDanger(CONTENT, 720, f.flight)).toBe(false);
});

it("uses the phase policy through GameModel, preserving the fight opening, cue and Continue", () => {
  const f = blockade();
  f.place(1_001, -90);
  f.model.step(0.05, { ...idle, move: { x: -1, y: 0 } });
  expect(f.phase()?.phase).toBe("warning");
  f.place(80);
  const { fighters, leader, reserve } = f.members();
  setEngaged(f.flight, [...fighters, ...reserve]);
  f.model.step(0.03, idle);
  expect(f.model.flightEvents).not.toContainEqual(cue);
  expect(reserve.every(({ enemy }) => !enemy?.engaged)).toBe(true);
  expect(inDanger(CONTENT, 720, f.flight)).toBe(false);
  const saved = f.model.save();
  expect(restoreSave(saved)?.flight?.phantom?.blockadePhases?.[siteId]).toEqual(f.phase());
  expect(relaunch(CONTENT, saved).state.flight?.phantom?.blockadePhases?.[siteId]).toEqual(
    f.phase(),
  );

  f.model.step(2.5, idle);
  expect(f.phase()?.phase).toBe("fighters");
  f.model.step(0.03, idle);
  expect(f.model.flightEvents).toContainEqual(cue);
  expect(f.flight.summonedGuards?.some((id) => fighters.some((fighter) => fighter.id === id))).toBe(
    true,
  );
  expect(reserve.every(({ enemy }) => !enemy?.engaged)).toBe(true);

  for (const fighter of fighters) {
    const definition = enemyEquipmentDefinition(6, fighter.enemy!);
    fighter.enemy = damageEnemy(
      definition,
      { amount: definition.hp, hardpointId: null },
      fighter.enemy!,
    );
    fighter.hp = fighter.enemy.hp;
  }
  f.model.step(0.03, idle);
  expect(f.phase()?.phase).toBe("recovery");
  expect(f.model.state.progress[6].phantom!.broken).not.toContain(siteId);
  f.place(520);
  f.model.step(4, idle);
  expect(f.phase()?.phase).toBe("recovery");
  expect(inDanger(CONTENT, 720, f.flight)).toBe(false);
  f.place(501, -90);
  f.model.step(0.05, { ...idle, move: { x: -1, y: 0 } });
  expect(f.phase()?.phase).toBe("frigate");
  expect(phantomBlockadeAdmits(f.flight, leader)).toBe(true);
  expect(f.model.state.progress[6].phantom!.broken).not.toContain(siteId);
});

it("preserves the canonical ordinary flight with the Phantom policy installed", () => {
  const ordinary = createFlight(CONTENT, 1, 1234, newProgress());
  ordinary.time = 5;
  const fighter = spawnChapterEnemy(CONTENT, "fighter", "ordinary", { x: 180, y: 0 }, ordinary)!;
  const withPolicy = structuredClone(ordinary);
  const events = stepFlight(CONTENT, 0.2, idle, ordinary);
  expect(
    stepFlight(CONTENT, 0.2, { ...idle, admitEnemy: phantomBlockadeAdmits }, withPolicy),
  ).toEqual(events);
  expect(fighter.enemy?.engaged).toBe(true);
  expect(withPolicy).toEqual(ordinary);
});
