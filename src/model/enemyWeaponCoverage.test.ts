import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import type { EnemyWeapon } from "../data/types.ts";
import { createFlight, spawnPlannedHostileStation, stepFlight } from "./flight.ts";

it("materializes the signature roster and both exclusive capital profiles through admitted production actors", () => {
  const witnessed = new Map<EnemyWeapon, string[]>();
  const capitalProfiles = new Set<EnemyWeapon>();
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
        const definition = enemyDefinition(galaxy, enemy.archetype, object.id);
        const weapons = definition.hardpoints.length
          ? definition.hardpoints.flatMap((part) =>
              part.kind === "weapon" &&
              enemy.hardpoints.some((state) => state.id === part.id && state.hp > 0)
                ? [part.fire.weapon]
                : [],
            )
          : [definition.fire.weapon];
        if (enemy.archetype === "capital") {
          expect(new Set(weapons)).toEqual(
            new Set(["scattershot", weapons.includes("mineLayer") ? "mineLayer" : "chargedLance"]),
          );
          capitalProfiles.add(weapons.includes("mineLayer") ? "mineLayer" : "chargedLance");
        }
        for (const weapon of weapons) {
          witnessed.set(weapon, [
            ...(witnessed.get(weapon) ?? []),
            `${galaxy}:${seed}:${object.id}`,
          ]);
        }
      }
    }
  }
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
  const definition = enemyDefinition(5, "hostileStation", station.station.id);
  for (const part of definition.hardpoints) {
    if (
      part.kind === "weapon" &&
      station.station.enemy!.hardpoints.some((state) => state.id === part.id && state.hp > 0)
    ) {
      witnessed.set(part.fire.weapon, [station.station.id]);
    }
  }
  expect(capitalProfiles).toEqual(new Set(["chargedLance", "mineLayer"]));
  expect([...witnessed.keys()].sort()).toEqual(
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
