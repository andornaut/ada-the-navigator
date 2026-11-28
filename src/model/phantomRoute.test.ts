import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { BUILT, GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP, PHANTOM_TUNING } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { readStory, relaunch, supportEntropy } from "../testing/launch.ts";
import { clearPhantomTraffic } from "../testing/phantomTraffic.ts";
import { outlineContact, worldParts } from "./convex.ts";
import { enemyHull } from "./enemyBody.ts";
import { ensureDestination, ensureStation, stepFlight } from "./flight.ts";
import { GameModel, newGameState } from "./game.ts";
import { activateFlightRegion } from "./geography.ts";
import { flightStationContext, worldStationsNear } from "./stations/index.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function placePlayer(model: GameModel, point: Vec): void {
  const flight = model.state.flight!;
  flight.player = { x: point.x, y: point.y };
  activateFlightRegion(CONTENT, flight.player, flight);
}

function travel(model: GameModel, point: Vec): void {
  placePlayer(model, point);
  model.step(0.000001, idle);
}

function represented(model: GameModel, id: string): SpaceObject | null | undefined {
  const flight = model.state.flight!;
  return flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
}

/** Hit a point inside a drawn hull part through the actual projectile step. */
function queueHullHit(flight: FlightState, target: SpaceObject, damage: number): void {
  const { id } = target;
  const hull = enemyHull(target.enemy!, ROUTE_POSITION[6])!;
  const polygon = worldParts(hull)[0]!;
  const point = polygon.reduce(
    (sum, vertex) => ({
      x: sum.x + vertex.x / polygon.length,
      y: sum.y + vertex.y / polygon.length,
    }),
    { x: target.x, y: target.y },
  );
  expect(outlineContact(hull, target, point, 0)).not.toBeNull();
  flight.shots.push({
    damage,
    enemy: false,
    hitIds: [...flight.objects, ...flight.mines]
      .filter((entry) => entry.id !== id)
      .map((entry) => entry.id),
    id: `route-impact:${id}`,
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
    ...point,
  });
}

function hitEnemy(model: GameModel, target: SpaceObject, damage: number): void {
  queueHullHit(model.state.flight!, target, damage);
  model.step(0.000001, idle);
}

/** Deterministic impact fixtures exercise collision and damage, without measuring combat balance. */
function defeat(model: GameModel, id: string): void {
  const initial = represented(model, id);
  if (!initial || initial.hp <= 0 || initial.enemy?.disabled) {
    return;
  }
  placePlayer(model, { x: initial.x + 600, y: initial.y });
  const flight = model.state.flight!;
  // The synthetic shot excludes other targets by ID. Each impact keeps the chapter actors and
  // landmarks without simulating the surrounding traffic and debris, including what the first
  // impact's step generates. Travel and reload still use their normal world paths.
  clearPhantomTraffic(flight);
  expect(represented(model, id), `fixture must retain ${id}`).toBeDefined();
  const target = represented(model, id)!;
  hitEnemy(model, target, target.hp);
  expect(represented(model, id)?.hp ?? 0).toBe(0);
}

function reload(model: GameModel): GameModel {
  const saved = model.save();
  expect(restoreSave(saved), "route checkpoint must pass strict restoration").not.toBeNull();
  return relaunch(CONTENT, saved);
}

describe("Phantom full route under test-only chapter admission, not production readiness", () => {
  it("earns the final disk, completes the aftermath, meets the Admiral and resolves Earth across reload", () => {
    const roster = [...BUILT];
    const built = BUILT as Set<GalaxyNumber>;
    built.add(6);
    try {
      // Initial precondition only: these five chapters are not exercised by this test.
      const initial = newGameState();
      initial.started = initial.prologueSeen = true;
      initial.unlocked = [...GALAXY_NUMBERS];
      for (const id of GALAXY_NUMBERS.filter((id) => id !== 6)) {
        Object.assign(initial.progress[id], {
          holodisk: true,
          introduced: true,
          opened: true,
          questComplete: true,
          resolved: true,
        });
      }
      expect(restoreSave(JSON.stringify(initial))).not.toBeNull();
      let model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, JSON.stringify(initial));
      model.continueGame();
      readStory(model);
      expect(model.state.progress[6].opened).toBe(true);
      model.startGalaxy(6);
      expect(model.state.flight?.phantom?.phase).toBe("blockades");
      expect(model.canTeleport(PHANTOM_FLAGSHIP)).toBe(false);
      for (const id of PHANTOM_DESTINATIONS) {
        const guards = [...model.state.flight!.phantom!.blockades[id]!];
        for (const guard of guards) {
          defeat(model, guard);
        }
        expect(model.state.progress[6].phantom!.broken).toContain(id);
        const destination = ensureDestination(CONTENT, id, model.state.flight!);
        travel(model, destination);
        model.interact();
        expect(model.state.dialogue?.context).toBe(`phantom.${id}`);
        model.choose("continue");
        expect(model.state.progress[6].phantom!.freed).toContain(id);
        model = reload(model);
      }
      const flagshipMarker = model.map!.places.find(({ id }) => id === PHANTOM_FLAGSHIP)!;
      expect(flagshipMarker.travel).toBe(true);
      model.state.flight!.dangerFor = 0;
      model.state.economy.stardust = 50;
      expect(model.teleport(PHANTOM_FLAGSHIP)).toBe(true);
      expect(model.state.flight!.player).toEqual({ x: flagshipMarker.x, y: flagshipMarker.y });
      expect(model.state.economy.stardust).toBe(0);
      expect(model.state.progress[6].holodisk).toBe(false);
      expect(model.state.dialogue).toBeNull();
      model.step(0.000001, idle);
      for (let wave = 1; wave <= PHANTOM_TUNING.waves; wave++) {
        expect(model.state.flight!.phantom!.wave).toBe(wave);
        expect(model.state.flight!.phantom!.phase).toBe("waves");
        for (const id of [...model.state.flight!.phantom!.enemyIds]) {
          defeat(model, id);
        }
      }
      expect(model.state.flight!.phantom!.phase).toBe("flagship");
      const flagship = represented(model, PHANTOM_FLAGSHIP)!;
      const definition = enemyDefinition(6, "capital", PHANTOM_FLAGSHIP);
      expect(flagship.hp).toBe(definition.hp);
      travel(model, { x: flagship.x + 300, y: flagship.y });
      clearPhantomTraffic(model.state.flight!);
      const mounts = flagship.enemy!.hardpoints.map(({ hp }) => hp);
      hitEnemy(model, flagship, 1);
      expect(flagship.hp).toBe(definition.hp - 1);
      expect(flagship.enemy!.hardpoints.map(({ hp }) => hp)).toEqual(mounts);
      const before = model.state.economy.stardust;
      // Save immediately after physics latches surrender, before the model can consume its event.
      const pending = reload(model);
      const pendingFlight = pending.state.flight!;
      const pendingFlagship = represented(pending, PHANTOM_FLAGSHIP)!;
      queueHullHit(pendingFlight, pendingFlagship, definition.hp * 2);
      const events = stepFlight(CONTENT, 0.000001, idle, pendingFlight);
      expect(events).toContainEqual({ id: PHANTOM_FLAGSHIP, type: "enemySurrendered" });
      expect(pending.state.progress[6].holodisk).toBe(false);
      expect(pending.state.economy.stardust).toBe(before);
      const restoredLatch = reload(pending);
      expect(restoredLatch.flightEvents).toEqual([]);
      expect(restoredLatch.state.progress[6]).toMatchObject({
        holodisk: true,
        questComplete: true,
      });
      expect(restoredLatch.state.economy.stardust).toBe(before + 50);
      expect(restoredLatch.state.dialogue).toBeNull();
      expect(reload(restoredLatch).state.economy.stardust).toBe(before + 50);

      hitEnemy(model, flagship, definition.hp * 2);
      expect(model.flightEvents.filter(({ type }) => type === "enemySurrendered")).toEqual([
        { id: PHANTOM_FLAGSHIP, type: "enemySurrendered" },
      ]);
      expect(flagship.enemy).toMatchObject({ hp: 16, surrendered: true });
      const surrenderHud = {
        captain: "Admiral Archie",
        hull: 16,
        id: PHANTOM_FLAGSHIP,
        maxHull: 320,
        surrendered: true,
      };
      expect(model.bossHud()).toMatchObject(surrenderHud);
      expect(model.state.economy.stardust).toBe(before + 50);
      expect(model.state.progress[6]).toMatchObject({ holodisk: true, questComplete: true });
      expect(model.state.dialogue).toBeNull();
      expect(model.screen).toBe("space");

      const hear = (speaker: string, text: string) => {
        for (let beat = 0; beat < 12 && model.conversation?.text !== text; beat++) {
          model.dismissConversation();
          model.step(0.000001, idle);
        }
        expect(model.conversation).toMatchObject({ speaker, text });
      };
      hear("ada", "Archie, stand down. This is over.");
      expect(model.state.dialogue).toBeNull();
      expect(model.state.flight?.phantom?.chatter).toContain("flagshipSurrender");
      model = reload(model);
      const resumed = represented(model, PHANTOM_FLAGSHIP)!;
      expect(resumed.enemy).toMatchObject({ hp: 16, surrendered: true });
      expect(model.bossHud()).toMatchObject(surrenderHud);
      expect(model.state.economy.stardust).toBe(before + 50);
      hitEnemy(model, resumed, definition.hp * 2);
      expect(resumed.hp).toBe(16);
      expect(model.flightEvents.some(({ type }) => type === "enemySurrendered")).toBe(false);
      hear("archie", "All right. Take the disk.");
      expect(model.state.dialogue).toBeNull();
      const memoryStart =
        "I remember everything now. He wanted copies of me that would never say no.";
      const memoryEnding = "I don't have to run anymore.";
      expect(`${memoryStart} ${memoryEnding}`).toBe(CONTENT.premise.holodisk.memories[5]);
      hear("astra", memoryStart);
      expect(model.state.dialogue).toBeNull();
      model = reload(model);
      hear("astra", memoryEnding);
      expect(model.state.dialogue).toBeNull();
      model.dismissConversation();
      model.step(0.000001, idle);
      expect(model.state.dialogue?.context).toBe("phantom.aftermath");
      expect(model.state.progress[6].phantom!.aftermathComplete).toBeUndefined();
      model.choose("continue");
      expect(model.state.progress[6].phantom!.aftermathComplete).toBe(true);
      expect(model.bossHud()).toBeNull();
      model = reload(model);
      expect(model.state.economy.stardust).toBe(before + 50);
      expect(model.state.dialogue).toBeNull();
      const site = worldStationsNear(
        flightStationContext(model.state.flight!),
        ECONOMY,
        6,
        100000,
        model.state.flight!.player,
      )[0]!;
      expect(site).toBeDefined();
      const station = ensureStation(CONTENT, site.id, model.state.flight!)!;
      travel(model, station);
      model.interact();
      expect(model.state.docked).toBe(site.id);
      expect(model.stationGreeting).toMatchObject({ count: 3, index: 0, keeper: "archie" });
      model.advanceGreeting();
      model.advanceGreeting();
      expect(model.stationGreeting?.index).toBe(2);
      model.undock();
      model.returnHome();
      const party = readStory(model);
      expect(party.some((page) => page.text.includes("I'd like to keep flying with you."))).toBe(
        true,
      );
      expect(model.state.progress[6].resolved).toBe(true);
      const final = restoreSave(model.save());
      expect(final?.progress[6]).toEqual(model.state.progress[6]);
    } finally {
      built.clear();
      for (const id of roster) {
        built.add(id);
      }
      expect([...BUILT]).toEqual(roster);
    }
  });
});
