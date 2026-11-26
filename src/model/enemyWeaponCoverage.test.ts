import { expect, it } from "vitest";

import { ANDROMEDA_REDACT, CARTWHEEL_CLAIM } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import type { EnemyWeapon, GalaxyNumber } from "../data/types.ts";
import { visitCartwheelHubFixture } from "../testing/cartwheelFixture.ts";
import { capitalBossActor } from "./capitalBossEncounter.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import {
  admitRedactEncounter,
  createFlight,
  createUnpopulatedFlight,
  placeCartwheelClaim,
  spawnPlannedHostileStation,
  stepFlight,
} from "./flight.ts";
import { GameModel } from "./game.ts";
import type { SpaceObject } from "./types.ts";

it("materializes the signature roster and both exclusive capital profiles through admitted production actors", () => {
  const witnessed = new Set<EnemyWeapon>();
  const observe = (galaxy: GalaxyNumber, object: SpaceObject) => {
    const enemy = object.enemy!;
    const definition = enemyEquipmentDefinition(galaxy, enemy);
    const weapons = definition.hardpoints.length
      ? definition.hardpoints.flatMap((part) =>
          part.kind === "weapon" &&
          enemy.hardpoints.some((state) => state.id === part.id && state.hp > 0)
            ? [part.fire.weapon]
            : [],
        )
      : [definition.fire.weapon];
    for (const weapon of weapons) {
      witnessed.add(weapon);
    }
    return new Set(weapons);
  };
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
  // These are possible seeded encounters, not a guarantee that each run meets every weapon.
  for (const galaxy of [4, 2, 6] as const) {
    for (let seed = 0; seed < 8; seed++) {
      const flight = createFlight(CONTENT, galaxy, seed, { known: [] });
      flight.player = [
        { x: 30000, y: 0 },
        { x: 0, y: 30000 },
        { x: -30000, y: 0 },
        { x: 0, y: -30000 },
      ][seed % 4]!;
      stepFlight(CONTENT, 0.001, idle, flight);
      for (const object of flight.objects) {
        const enemy = object.enemy;
        // Required narrative ships do not establish ambient roster admission.
        if (!enemy || !enemy.packId?.startsWith("pack:") || object.hp <= 0) {
          continue;
        }
        observe(galaxy, object);
      }
    }
  }

  // Materialize the two authored hulls through their production placement functions.
  const andromeda = createUnpopulatedFlight(CONTENT, 5, 173);
  admitRedactEncounter(CONTENT, andromeda, { x: 1000, y: 0 }, { x: 2000, y: 0 });
  const redact = capitalBossActor(andromeda, ANDROMEDA_REDACT.id);
  expect(redact?.enemy?.archetype).toBe("capital");
  expect(observe(5, redact!)).toEqual(new Set(["laser", "scattershot", "chargedLance"]));

  const seeds = [173, 301];
  const cartwheelModel = new GameModel(CONTENT, undefined, () => seeds.shift() ?? 503);
  cartwheelModel.state.prologueSeen = true;
  cartwheelModel.state.unlocked.push(2);
  cartwheelModel.state.progress[2].opened = true;
  cartwheelModel.startGalaxy(2);
  const hub = visitCartwheelHubFixture(CONTENT, cartwheelModel);
  const cartwheel = cartwheelModel.state.flight!;
  expect(placeCartwheelClaim(CONTENT, cartwheel, hub)).not.toBeNull();
  const claim = capitalBossActor(cartwheel, CARTWHEEL_CLAIM.id);
  expect(claim?.enemy?.archetype).toBe("capital");
  expect(observe(2, claim!)).toEqual(new Set(["laser", "scattershot", "mineLayer"]));

  // An explicit accepted plan proves station capability, not a default site distribution.
  const stationFlight = createFlight(CONTENT, 5, 173, { known: [] });
  stationFlight.objects = [];
  stationFlight.world = { notables: {}, version: 1 };
  stationFlight.player = { x: 6000, y: 1200 };
  const station = spawnPlannedHostileStation(CONTENT, stationFlight, {
    defenders: [
      { id: "coverage:defender:0", point: { x: 5650, y: 300 } },
      { id: "coverage:defender:1", point: { x: 6350, y: 300 } },
    ],
    id: "coverage:station",
    point: { x: 6000, y: 0 },
  });
  expect(station.status).toBe("created");
  if (station.status !== "created") {
    throw Error("station coverage admission failed");
  }
  observe(5, station.station);
  expect([...witnessed].sort()).toEqual(
    expect.arrayContaining([
      "chargedLance",
      "heavyMissile",
      "laser",
      "multiLaser",
      "mineLayer",
      "phaser",
      "rapidMissile",
      "ringBurst",
      "scattershot",
    ]),
  );
});
