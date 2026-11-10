import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import type { Weapon } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { projectileOpacity } from "./player-projectiles.ts";
import { restoreSave } from "./save.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launched(weapon: Weapon) {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  model.choose("0");
  const flight = model.state.flight!;
  flight.objects = [];
  flight.shots = [];
  flight.ownedWeapons = ["missiles", "tripleLaser", "scattershot"];
  flight.weapon = weapon;
  return { flight, model };
}

describe("integrated weapon projectiles", () => {
  it("uses missile damage and cooldown without applying splash to a nearby rock", () => {
    const { flight } = launched("missiles");
    flight.objects = [
      { hp: 10, id: "direct", kind: "rock", radius: 4, x: 30, y: 0 },
      { hp: 10, id: "nearby", kind: "rock", radius: 4, x: 30, y: 15 },
    ];
    stepFlight(PROTOTYPE, 0.1, { ...idle, aim: { x: 1, y: 0 }, viewportWidth: 720 }, flight);
    expect(flight.objects.find((object) => object.id === "direct")?.hp).toBe(6);
    expect(flight.objects.find((object) => object.id === "nearby")?.hp).toBe(10);
    expect(flight.fireCooldown).toBeGreaterThan(WEAPON_CATALOG.missiles.intervalSeconds - 0.11);
    expect(flight.shots).toHaveLength(0);
  });

  it("passes fractional scatter damage through the canonical collision path", () => {
    const { flight } = launched("scattershot");
    stepFlight(PROTOTYPE, 0.001, { ...idle, aim: { x: 1, y: 0 }, viewportWidth: 720 }, flight);
    const center = flight.shots.find((shot) => Math.abs(shot.velocity.y) < 0.000001)!;
    expect(center.projectile).toBe("dot");
    flight.shots = [center];
    flight.fireCooldown = 100;
    flight.objects = [{ hp: 3, id: "target", kind: "rock", radius: 4, x: 30, y: 0 }];
    stepFlight(PROTOTYPE, 0.1, idle, flight);
    expect(flight.objects[0]!.hp).toBeCloseTo(2.65);
    expect(flight.shots).toHaveLength(0);
  });

  it("stops each scatter pellet at its captured projected range even when expiry occurs inside a simulation step", () => {
    const { flight } = launched("scattershot");
    stepFlight(PROTOTYPE, 0.001, { ...idle, aim: { x: 1, y: 1 }, viewportWidth: 960 }, flight);
    const pellets = [...flight.shots];
    expect(pellets).toHaveLength(7);
    flight.fireCooldown = 100;
    stepFlight(PROTOTYPE, 2, idle, flight);
    expect(flight.shots).toHaveLength(0);
    for (const shot of pellets) {
      expect(Math.hypot(shot.x - shot.y, (shot.x + shot.y) / 2)).toBeCloseTo(480);
      expect(shot.life).toBe(0);
      expect(projectileOpacity(shot.fade!, shot.life)).toBe(0);
    }
  });

  it("restores active fading shots exactly and preserves their future after the viewport changes", () => {
    const { flight, model } = launched("scattershot");
    stepFlight(PROTOTYPE, 0.1, { ...idle, aim: { x: 0, y: -1 }, viewportWidth: 840 }, flight);
    const saved = model.save();
    const restored = new GameModel(PROTOTYPE, saved);
    expect(restored.state).toEqual(model.state);
    flight.fireCooldown = 100;
    restored.state.flight!.fireCooldown = 100;
    stepFlight(PROTOTYPE, 0.1, { ...idle, viewportWidth: 1200 }, flight);
    stepFlight(PROTOTYPE, 0.1, { ...idle, viewportWidth: 1200 }, restored.state.flight!);
    expect(restored.state).toEqual(model.state);
    expect(flight.shots.every((shot) => shot.fade?.projectedRange === 420)).toBe(true);
    for (const change of [{ initialLife: 0 }, { projectedRange: -1 }, { fadeStartFraction: 1 }]) {
      const invalid = JSON.parse(saved);
      Object.assign(invalid.flight.shots[0].fade, change);
      expect(restoreSave(invalid)).toBeNull();
    }
    const missingDamage = JSON.parse(saved);
    delete missingDamage.flight.shots[0].damage;
    expect(restoreSave(missingDamage)).toBeNull();
    const oldRoster = JSON.parse(saved);
    oldRoster.flight.weapon = "rapid";
    expect(restoreSave(oldRoster)).toBeNull();
  });
});
