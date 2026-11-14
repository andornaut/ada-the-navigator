import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import type { EnemyWeapon } from "../data/types.ts";
import { createFlight, stepFlight } from "./flight.ts";

it("spawns every player weapon, charged lance and ring burst in bounded seeded worlds", () => {
  const witnessed = new Map<EnemyWeapon, string[]>();
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
        for (const weapon of weapons) {
          witnessed.set(weapon, [
            ...(witnessed.get(weapon) ?? []),
            `${galaxy}:${seed}:${object.id}`,
          ]);
        }
      }
    }
  }
  expect([...witnessed.keys()].sort()).toEqual(
    expect.arrayContaining([
      "chargedLance",
      "heavyMissile",
      "laser",
      "multiLaser",
      "phaser",
      "rapidMissile",
      "ringBurst",
      "scattershot",
    ]),
  );
});
