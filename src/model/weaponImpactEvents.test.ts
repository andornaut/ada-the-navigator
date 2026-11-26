import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import { activeWeaponImpacts, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import type { Shot } from "./types.ts";

const idle = { aim: { x: 1, y: 0 }, fire: false, move: { x: 0, y: 0 }, use: false };
function fixture() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  playOpening(model);
  const flight = model.state.flight!;
  flight.player = { x: 0, y: 0 };
  flight.velocity = { x: 0, y: 0 };
  flight.objects = [];
  flight.shots = [];
  flight.mines = [];
  flight.fireCooldown = 100;
  return flight;
}

describe("weapon contact provenance", () => {
  it("captures Scatter before its last ammo switches Ada to Laser", () => {
    const flight = fixture();
    flight.weapon = "scattershot";
    flight.ownedWeapons = ["scattershot"];
    flight.ammo.scattershot = 1;
    flight.fireCooldown = 0;
    stepFlight(CONTENT, 0.01, { ...idle, fire: true }, flight);
    expect(flight.weapon).toBe("laser");
    expect(flight.shots).toHaveLength(7);
    expect(flight.pendingPellets).toHaveLength(4);
    expect(flight.shots.every((shot) => shot.effectFamily === "pellet")).toBe(true);
  });

  it("retains consumed contact position, incoming direction and original family", () => {
    const flight = fixture();
    flight.objects = [{ hp: 100, id: "rock", kind: "rock", radius: 40, x: 200, y: 0 }];
    const shot: Shot = {
      damage: 1,
      effectFamily: "pellet",
      enemy: false,
      hitIds: [],
      id: "shot",
      life: 1,
      piercing: false,
      projectile: "dot",
      velocity: { x: 10000, y: 0 },
      x: 50,
      y: 0,
    };
    flight.shots = [shot];
    flight.weapon = "heavyMissile";
    stepFlight(CONTENT, 0.02, idle, flight);
    expect(flight.shots).toHaveLength(0);
    expect(activeWeaponImpacts(flight)).toHaveLength(1);
    const impact = activeWeaponImpacts(flight)[0]!;
    expect(impact).toMatchObject({
      direction: shot.velocity,
      family: "pellet",
      id: "shot:rock",
      targetId: "rock",
    });
    expect(impact.x).toBeCloseTo(160, 4);
    expect(flight.objects[0]!.hp).toBe(99);
    stepFlight(CONTENT, 0.02, idle, flight);
    expect(activeWeaponImpacts(flight)[0]!.id).toBe(impact.id);
    expect(activeWeaponImpacts(flight)[0]!.age).toBeGreaterThan(impact.age);
  });

  it("copies actual missile radius and preserves stable presentation identity", () => {
    const flight = fixture();
    flight.shots = [
      {
        blast: 47,
        damage: 1,
        enemy: false,
        hitIds: [],
        id: "missile",
        life: 0.01,
        piercing: false,
        projectile: "missile",
        velocity: { x: 10, y: 0 },
        x: 100,
        y: 0,
      },
    ];
    stepFlight(CONTENT, 0.02, idle, flight);
    const first = activeWeaponImpacts(flight)[0]!;
    expect(first).toMatchObject({ blastRadius: 47, family: "missile" });
    stepFlight(CONTENT, 0.01, idle, flight);
    expect(activeWeaponImpacts(flight)[0]!.id).toBe(first.id);
  });
});
