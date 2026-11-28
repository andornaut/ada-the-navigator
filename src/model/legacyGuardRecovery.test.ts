import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { questGuardPlacementContext, spawnChapterEnemy, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import {
  ACTIVE_CHUNK_RADIUS,
  worldRecordObjectRemoval,
  worldRetainedPackMembers,
  worldSyncFlightRegion,
} from "./geography.ts";
import { recoverLegacyQuestGuards } from "./legacyGuardRecovery.ts";
import { questGuardHomePorts } from "./questGuardPlacement.ts";
import type { SpaceObject } from "./types.ts";
import { flightWorldContext, worldDistance } from "./world/index.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function fixture(retained = false) {
  const game = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  game.startGalaxy(1);
  playOpening(game);
  const flight = game.state.flight!;
  // The remote formation is a legacy snapshot with no required-first planning records.
  delete flight.requiredPlans;
  delete game.state.progress[1].requiredSites;
  const site: SpaceObject = {
    hp: 1,
    id: "growers",
    kind: "destination",
    radius: 30,
    x: 10000,
    y: 10000,
  };
  flight.objects = [site];
  flight.world = { notables: {}, version: 1 };
  flight.combat = { initialPackSizes: {}, routeEncounters: [site.id] };
  flight.player = { x: site.x, y: site.y };
  const size = CONTENT.tuning.chunkSize;
  const cx = Math.floor(site.x / size),
    cy = Math.floor(site.y / size);
  flight.chunks = [];
  for (let x = cx - ACTIVE_CHUNK_RADIUS; x <= cx + ACTIVE_CHUNK_RADIUS; x++) {
    for (let y = cy - ACTIVE_CHUNK_RADIUS; y <= cy + ACTIVE_CHUNK_RADIUS; y++) {
      flight.chunks.push(`${x},${y}`);
    }
  }
  const point = { x: site.x + (ACTIVE_CHUNK_RADIUS + 2) * size, y: site.y };
  const guard = spawnChapterEnemy(CONTENT, "frigate", "route:growers", point, flight, {
    home: point,
    packId: "route:growers",
    routeId: site.id,
  })!;
  const followers = flight.objects.filter((actor) => actor.enemy?.escortOf === guard.id);
  guard.enemy!.age = 8;
  guard.enemy!.primaryCooldown = 0.37;
  guard.enemy!.hardpoints[0]!.cooldown = 0.61;
  guard.enemy!.hardpoints[0]!.burst = 1;
  const casualty = followers[0]!;
  casualty.hp = 0;
  casualty.enemy!.hp = 0;
  worldRecordObjectRemoval({}, CONTENT, casualty, flight);
  flight.objects = flight.objects.filter((actor) => actor !== casualty);
  const survivor = followers[1]!;
  if (retained) {
    flight.world.notables[guard.id] = guard;
    flight.world.notables[survivor.id] = survivor;
    flight.objects = [site];
  }
  return { casualty, flight, game, guard, site, survivor };
}

it.each([false, true])(
  "continues a remote legacy formation retained=%s without teleporting, resetting combat or restoring casualties",
  (retained) => {
    const { casualty, flight, game, guard, site, survivor } = fixture(retained);
    const before = structuredClone([guard, survivor]);
    const ledger = structuredClone(flight.combat);
    const saved = structuredClone(game.saveDocument());
    expect(restoreSave(saved)).toEqual(saved);
    const random = vi.spyOn(crypto, "getRandomValues");
    random.mockClear();
    try {
      const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, saved);
      resumed.continueGame();
      const continued = resumed.state.flight!;
      const leader = continued.objects.find((actor) => actor.id === guard.id)!;
      const follower = continued.objects.find((actor) => actor.id === survivor.id)!;
      expect(leader).toBeDefined();
      expect(follower).toEqual(before[1]);
      const ports = questGuardHomePorts(questGuardPlacementContext(CONTENT, continued));
      expect(ports.validHome(flightWorldContext(continued), site, leader, leader.enemy!.home)).toBe(
        true,
      );
      const expected = structuredClone(before[0]!);
      expected.enemy!.home = { ...leader.enemy!.home };
      expect(leader).toEqual(expected);
      expect(continued.combat).toEqual(ledger);
      expect(continued.world.notables[casualty.id]).toBeNull();
      expect(continued.world.notables[guard.id]).toBeUndefined();
      expect(continued.world.notables[survivor.id]).toBeUndefined();
      expect(worldRetainedPackMembers({}, CONTENT, continued)).toEqual({});
      worldSyncFlightRegion({}, CONTENT, continued);
      worldSyncFlightRegion({}, CONTENT, continued);
      expect(continued.objects.filter((actor) => actor.id === guard.id)).toHaveLength(1);
      expect(continued.objects.filter((actor) => actor.id === survivor.id)).toHaveLength(1);
      expect(
        recoverLegacyQuestGuards(questGuardPlacementContext(CONTENT, continued)).repairedIds,
      ).toEqual([]);
      expect(continued.summonedGuards).toBeUndefined();
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  },
);

it("allows a recovered remote guard to move physically toward its canonical home through real frame steps", () => {
  const { casualty, game, guard, site, survivor } = fixture(true);
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, game.saveDocument());
  resumed.continueGame();
  const flight = resumed.state.flight!;
  const leader = flight.objects.find((actor) => actor.id === guard.id)!;
  const start = worldDistance({}, leader, leader.enemy!.home);
  let closest = start;
  const maxSpeed = enemyEquipmentDefinition(flight.galaxy, leader.enemy!).physics.maxSpeed;
  for (let frame = 0; frame < 240; frame++) {
    const previous = { x: leader.x, y: leader.y };
    stepFlight(CONTENT, 1 / 60, idle, flight);
    const current = flight.objects.find((actor) => actor.id === guard.id);
    expect(current).toBeDefined();
    expect(worldDistance({}, previous, current!)).toBeLessThanOrEqual(maxSpeed / 60 + 1e-6);
    closest = Math.min(closest, worldDistance({}, current!, current!.enemy!.home));
  }
  expect(closest).toBeLessThan(start - 1);
  expect(flight.objects.some((actor) => actor.id === survivor.id)).toBe(true);
  expect(flight.objects.some((actor) => actor.id === casualty.id)).toBe(false);
  expect(flight.world.notables[casualty.id]).toBeNull();
  expect(flight.combat!.initialPackSizes[survivor.enemy!.packId!]).toBe(2);
  expect(flight.player).toEqual({ x: site.x, y: site.y });
});

it("reconstructs recovery activity after another Continue and uses ordinary paging outside the site region", () => {
  const { casualty, game, guard, site, survivor } = fixture(true);
  const first = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, game.saveDocument());
  first.continueGame();
  const before = structuredClone(first.state.flight);
  const second = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, first.saveDocument());
  second.continueGame();
  const flight = second.state.flight!;
  expect(flight).toEqual(before);
  flight.player = { x: site.x + 50 * CONTENT.tuning.chunkSize, y: site.y };
  worldSyncFlightRegion({}, CONTENT, flight);
  expect(flight.world.notables[guard.id]).toBeDefined();
  expect(flight.world.notables[survivor.id]).toBeDefined();
  expect(flight.world.notables[casualty.id]).toBeNull();
  flight.player = { x: site.x, y: site.y };
  worldSyncFlightRegion({}, CONTENT, flight);
  expect(flight.objects.filter((actor) => actor.id === guard.id)).toHaveLength(1);
  expect(flight.objects.filter((actor) => actor.id === survivor.id)).toHaveLength(1);
  expect(flight.world.notables[casualty.id]).toBeNull();
});

it("does not register unresolved or removed sites or restore a removed leader", () => {
  const { flight, guard, site } = fixture(true);
  flight.objects = [];
  delete flight.world.notables[site.id];
  const before = structuredClone(flight);
  expect(recoverLegacyQuestGuards(questGuardPlacementContext(CONTENT, flight)).activeIds.size).toBe(
    0,
  );
  expect(flight).toEqual(before);
  flight.world.notables[site.id] = null;
  expect(recoverLegacyQuestGuards(questGuardPlacementContext(CONTENT, flight)).activeIds.size).toBe(
    0,
  );
  flight.world.notables[guard.id] = null;
  expect(recoverLegacyQuestGuards(questGuardPlacementContext(CONTENT, flight)).activeIds.size).toBe(
    0,
  );
  expect(flight.world.notables[guard.id]).toBeNull();
});
