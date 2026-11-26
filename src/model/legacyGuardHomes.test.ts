import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import { createEnemy } from "./enemyAi.ts";
import { GameModel } from "./game.ts";
import { type LegacyGuardHomePorts, legacyGuardHomeUpdates } from "./legacyGuardHomes.ts";
import type { SpaceObject } from "./types.ts";

function fixture() {
  const game = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  game.startGalaxy(1);
  playOpening(game);
  const saved = structuredClone(game.saveDocument());
  const flight = saved.flight!;
  const site: SpaceObject = { hp: 1, id: "site", kind: "destination", radius: 20, x: 8000, y: 100 };
  const definition = enemyDefinition(1, "frigate", "guard", 2);
  const guard: SpaceObject = {
    enemy: createEnemy(
      definition,
      { archetype: "frigate", id: "guard", packId: null, phase: 0.75, weaponLevel: 2 },
      { x: 20, y: 30 },
    ),
    hp: definition.hp,
    id: "guard",
    kind: "enemy",
    radius: 30,
    routeId: "site",
    x: 20,
    y: 30,
  };
  guard.enemy!.age = 12;
  guard.enemy!.primaryCooldown = 0.37;
  flight.objects = [guard];
  flight.world.notables = {};
  const home = { x: 8300, y: 100 };
  const ports: LegacyGuardHomePorts = {
    recoveryHome: () => home,
    resolveSite: () => site,
    validHome: (_context, _site, _guard, candidate) =>
      candidate.x === home.x && candidate.y === home.y,
  };
  return { flight, guard, home, ports, saved, site };
}

it("plans active and retained legacy home repairs without mutating actors, clocks, levels or tombstones", () => {
  const { flight, guard, home, ports } = fixture();
  const retained = structuredClone(guard);
  retained.id = "retained";
  retained.enemy!.id = retained.id;
  flight.world.notables = { removed: null, retained };
  const before = structuredClone(flight);
  expect(legacyGuardHomeUpdates(ports, flight)).toEqual([
    { guardId: "guard", home },
    { guardId: "retained", home },
  ]);
  expect(flight).toEqual(before);
  guard.enemy!.home = { ...home };
  retained.enemy!.home = { ...home };
  expect(legacyGuardHomeUpdates(ports, flight)).toEqual([]);
  const expected = structuredClone(before);
  expected.objects[0]!.enemy!.home = { ...home };
  expected.world.notables.retained!.enemy!.home = { ...home };
  expect(flight).toEqual(expected);
});

it("preserves valid homes and skips removed, unresolved, mismatched and hostile anchors", () => {
  const { flight, guard, ports, site } = fixture();
  for (const authority of [
    null,
    undefined,
    { ...site, id: "other" },
    { ...site, kind: "enemy" as const },
    { ...site, hp: 0 },
  ]) {
    const recovery = vi.fn(ports.recoveryHome);
    expect(
      legacyGuardHomeUpdates(
        { ...ports, recoveryHome: recovery, resolveSite: () => authority },
        flight,
      ),
    ).toEqual([]);
    expect(recovery).not.toHaveBeenCalled();
  }
  const recovery = vi.fn(ports.recoveryHome);
  expect(
    legacyGuardHomeUpdates({ ...ports, recoveryHome: recovery, validHome: () => true }, flight),
  ).toEqual([]);
  expect(recovery).not.toHaveBeenCalled();
  const resolve = vi.fn(ports.resolveSite);
  legacyGuardHomeUpdates({ ...ports, resolveSite: resolve }, flight);
  expect(resolve).toHaveBeenCalledWith(
    { objects: flight.objects, world: flight.world },
    guard.routeId,
  );
});

it("never repairs defeated, disabled, salvaged, nonquest or nonfrigate actors or replays tombstones", () => {
  const { flight, guard, ports } = fixture();
  for (const mutate of [
    (actor: SpaceObject) => {
      actor.hp = 0;
    },
    (actor: SpaceObject) => {
      actor.enemy!.hp = 0;
    },
    (actor: SpaceObject) => {
      actor.enemy!.disabled = true;
    },
    (actor: SpaceObject) => {
      actor.enemy!.salvaged = true;
    },
    (actor: SpaceObject) => {
      delete actor.routeId;
    },
    (actor: SpaceObject) => {
      actor.enemy!.archetype = "fighter";
    },
  ]) {
    const actor = structuredClone(guard);
    mutate(actor);
    flight.objects = [actor];
    expect(legacyGuardHomeUpdates(ports, flight)).toEqual([]);
  }
  flight.objects = [];
  flight.world.notables = { guard: null };
  expect(legacyGuardHomeUpdates(ports, flight)).toEqual([]);
});

it("does not use Ada, a last-seen point or an unvalidated replacement as a home", () => {
  const { flight, guard, home, ports } = fixture();
  const expected = legacyGuardHomeUpdates(ports, flight);
  flight.player = { x: -100000, y: 80000 };
  guard.enemy!.lastSeen = { ...flight.player };
  expect(legacyGuardHomeUpdates(ports, flight)).toEqual(expected);
  expect(legacyGuardHomeUpdates({ ...ports, recoveryHome: () => null }, flight)).toEqual([]);
  expect(
    legacyGuardHomeUpdates({ ...ports, recoveryHome: () => ({ x: NaN, y: home.y }) }, flight),
  ).toEqual([]);
  expect(legacyGuardHomeUpdates({ ...ports, validHome: () => false }, flight)).toEqual([]);
  const validHome = vi.fn(ports.validHome);
  flight.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
  expect(legacyGuardHomeUpdates({ ...ports, validHome }, flight)).toEqual(expected);
  expect(validHome).toHaveBeenCalledWith(
    { worldSide: GALAXY_SIDE },
    expect.anything(),
    guard,
    guard.enemy!.home,
  );
});
