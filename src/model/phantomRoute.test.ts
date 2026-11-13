import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { BUILT, GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_FLAGSHIP, PHANTOM_TUNING } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { readStory, relaunch } from "../testing/launch.ts";
import { worldParts } from "./convex.ts";
import { enemyIntegrity, hardpointOffset } from "./enemyAi.ts";
import { enemyPartOutline } from "./enemyBody.ts";
import { ensureDestination, ensureStation } from "./flight.ts";
import { GameModel, newGameState } from "./game.ts";
import { activateFlightRegion } from "./geography.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import type { SpaceObject, Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function travel(model: GameModel, point: Vec): void {
  const flight = model.state.flight!;
  flight.player = { x: point.x, y: point.y };
  activateFlightRegion(CONTENT, flight.player, flight);
  model.step(0.000001, idle);
}

function represented(model: GameModel, id: string): SpaceObject | null | undefined {
  const flight = model.state.flight!;
  return flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
}

/** Deterministic impact fixtures exercise collision and damage, without measuring combat balance. */
function defeat(model: GameModel, id: string): void {
  for (let impact = 0; impact < 32; impact++) {
    const object = represented(model, id);
    if (!object || object.hp <= 0 || object.enemy?.disabled) {
      return;
    }
    travel(model, { x: object.x + 600, y: object.y });
    const target = represented(model, id)!;
    const enemy = target.enemy!;
    const before = enemyIntegrity(enemy);
    const definition = enemyDefinition(6, enemy.archetype, id);
    const part = definition.hardpoints.find((part) =>
      enemy.hardpoints.some((state) => state.id === part.id && state.hp > 0),
    );
    const outline = part && enemyPartOutline(ROUTE_POSITION[6], enemy, part.id);
    const polygon = outline && worldParts(outline)[0];
    const offset = polygon
      ? polygon.reduce(
          (sum, point) => ({
            x: sum.x + point.x / polygon.length,
            y: sum.y + point.y / polygon.length,
          }),
          { x: 0, y: 0 },
        )
      : part
        ? hardpointOffset(definition, CONTENT.tuning.flight.shipRadius * 2, enemy.facing, part)
        : { x: 0, y: 0 };
    const flight = model.state.flight!;
    flight.shots.push({
      damage: before,
      enemy: false,
      hitIds: [...flight.objects, ...flight.mines]
        .filter((entry) => entry.id !== id)
        .map((entry) => entry.id),
      id: `route-impact:${id}:${impact}`,
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
      x: target.x + offset.x,
      y: target.y + offset.y,
    });
    model.step(0.000001, idle);
    const after = represented(model, id);
    expect(
      !after || after.hp <= 0 || enemyIntegrity(after.enemy!) < before,
      `projectile must damage ${id}`,
    ).toBe(true);
  }
  throw new Error(`Impact fixture did not resolve ${id}`);
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
      let model = new GameModel(CONTENT, JSON.stringify(initial));
      model.continueGame();
      readStory(model);
      expect(model.state.progress[6].opened).toBe(true);
      model.startGalaxy(6);
      expect(model.state.flight?.phantom?.phase).toBe("blockades");
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
      travel(model, model.state.flight!.phantom!.waypoint);
      for (let wave = 1; wave <= PHANTOM_TUNING.waves; wave++) {
        expect(model.state.flight!.phantom!.wave).toBe(wave);
        expect(model.state.flight!.phantom!.phase).toBe("waves");
        for (const id of [...model.state.flight!.phantom!.enemyIds]) {
          defeat(model, id);
        }
      }
      expect(model.state.flight!.phantom!.phase).toBe("flagship");
      for (const id of [...model.state.flight!.phantom!.enemyIds]) {
        defeat(model, id);
      }
      const flagship = represented(model, PHANTOM_FLAGSHIP)!;
      expect(flagship.enemy!.disabled).toBe(true);
      travel(model, {
        x: flagship.x + flagship.radius + CONTENT.tuning.flight.shipRadius + 1,
        y: flagship.y,
      });
      model.interact();
      expect(model.state.dialogue?.context).toBe("phantom.flagshipSalvage");
      model.choose("continue");
      expect(model.state.progress[6].holodisk).toBe(true);
      const memory = readStory(model);
      expect(memory.find((page) => page.id === "holodisk:memory")?.text).toBe(
        CONTENT.premise.holodisk.memories[5],
      );
      expect(model.state.dialogue?.context).toBe("phantom.aftermath");
      expect(model.state.progress[6].phantom!.aftermathComplete).toBeUndefined();
      model.choose("continue");
      expect(model.state.progress[6].phantom!.aftermathComplete).toBe(true);
      model = reload(model);
      const site = stationsNear(ECONOMY, 6, 100000, model.state.flight!.player)[0]!;
      expect(site).toBeDefined();
      const station = ensureStation(CONTENT, site.id, model.state.flight!)!;
      travel(model, station);
      model.interact();
      expect(model.state.docked).toBe(site.id);
      expect(model.stationGreeting).toMatchObject({ count: 3, index: 0, keeper: "general" });
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
