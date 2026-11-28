import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import {
  ENEMY_ONLY_DAMAGE,
  enemyDefinition,
  heavyLoadout,
  LANCE_TELL,
} from "../data/enemyCatalog.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { SCREEN } from "../data/screen.ts";
import { createEnemy } from "./ai/index.ts";
import { activeEnemyBeams, createFlight, stepFlight } from "./flight.ts";
import type { SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: 0 }, use: false };

/** Use a valid seeded loadout, without injecting a weapon or changing its canonical profile. */
function fixture() {
  for (const archetype of ["capital", "frigate"] as const) {
    for (let index = 0; index < 128; index++) {
      const id = `lance-proof:${index}`;
      const loadout = heavyLoadout(archetype, ROUTE_POSITION[2], id)!;
      const mount = [...loadout].find(([, weapon]) => weapon === "chargedLance")?.[0];
      if (!mount) {
        continue;
      }
      const definition = enemyDefinition(2, archetype, id);
      const position = { x: 200, y: 0 };
      const enemy = createEnemy(definition, { archetype, id, packId: null, phase: 0 }, position);
      for (const part of enemy.hardpoints) {
        part.cooldown = part.id === mount ? 0 : 999;
      }
      const target: SpaceObject = {
        ...position,
        enemy,
        hp: definition.hp,
        id,
        kind: "enemy",
        radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
      };
      const flight = createFlight(CONTENT, 2, 173, { known: [] });
      flight.objects = [target];
      flight.player = { x: 0, y: 0 };
      stepFlight(CONTENT, 1 / 60, idle, flight);
      const tell = activeEnemyBeams(flight).find((beam) => beam.kind === "lance");
      expect(tell).toBeDefined();
      if (!tell) {
        throw new Error("Valid lance loadout did not start its tell");
      }
      return { flight, mount, target, tell };
    }
  }
  throw new Error("No valid charged-lance loadout in bounded fixture search");
}
const tellSeconds = LANCE_TELL.trackSeconds + LANCE_TELL.lockSeconds;

describe("charged lance six-damage contract", () => {
  it("tracks for 0.7 seconds and locks for 0.3 before firing", () => {
    expect(LANCE_TELL).toEqual({ lockSeconds: 0.3, trackSeconds: 0.7 });
    const { flight, tell } = fixture();
    flight.player = { x: 0, y: 60 };
    stepFlight(CONTENT, 0.3, idle, flight);
    const toward = { x: flight.player.x - tell.muzzle.x, y: flight.player.y - tell.muzzle.y };
    const length = Math.hypot(toward.x, toward.y);
    expect(tell.direction.x).toBeCloseTo(toward.x / length, 6);
    expect(tell.direction.y).toBeCloseTo(toward.y / length, 6);
    stepFlight(CONTENT, 0.45, idle, flight);
    const locked = { ...tell.direction };
    flight.player = { x: 0, y: 120 };
    stepFlight(CONTENT, 0.1, idle, flight);
    expect(tell.direction).toEqual(locked);
    expect(tell.fired).toBe(false);
  });

  it("starts Cartwheel's next warning two seconds after the first warning starts", () => {
    const { flight, mount, target, tell } = fixture();
    const remaining = target.enemy!.hardpoints.find((part) => part.id === mount)!.cooldown;
    expect(remaining + 1 / 60).toBeCloseTo(2, 9);
    stepFlight(CONTENT, remaining - 0.01, idle, flight);
    expect(tell.fired).toBe(true);
    expect(activeEnemyBeams(flight).filter((beam) => beam.kind === "lance")).toEqual([]);
    stepFlight(CONTENT, 0.02, idle, flight);
    expect(activeEnemyBeams(flight).find((beam) => beam.kind === "lance")?.fired).toBe(false);
  });

  it("deals canonical six damage once, rather than once per displayed frame", () => {
    expect(ENEMY_ONLY_DAMAGE.chargedLance).toBe(6);
    const { flight, tell } = fixture();
    const before = flight.shield;
    stepFlight(CONTENT, tellSeconds + 0.05, idle, flight);
    expect(tell.fired).toBe(true);
    expect(flight.shield).toBeCloseTo(
      before - ENEMY_ONLY_DAMAGE.chargedLance * CONTENT.tuning.flight.playerShotDamage,
    );
    const after = flight.shield;
    for (let frame = 0; frame < 12; frame++) {
      stepFlight(CONTENT, 1 / 60, idle, flight);
    }
    expect(flight.shield).toBe(after);
  });

  it("misses Ada after she leaves the locked line and keeps its existing game-area range", () => {
    const { flight, tell } = fixture();
    stepFlight(CONTENT, 0.8, idle, flight);
    flight.player = { x: 0, y: -150 };
    const before = flight.shield;
    stepFlight(CONTENT, 0.25, idle, flight);
    expect(tell).toMatchObject({ fired: true, stopped: false });
    expect(flight.shield).toBe(before);
    const along = { x: tell.end.x - tell.muzzle.x, y: tell.end.y - tell.muzzle.y };
    expect(Math.hypot(along.x - along.y, (along.x + along.y) / 2)).toBeCloseTo(SCREEN.width, 6);
  });

  it("stops at an obstacle before Ada without applying damage through it", () => {
    const { flight, tell } = fixture();
    stepFlight(CONTENT, 0.8, idle, flight);
    const gap = Math.hypot(flight.player.x - tell.muzzle.x, flight.player.y - tell.muzzle.y);
    flight.objects.push({
      hp: 100,
      id: "lance-block",
      kind: "rock",
      radius: 15,
      x: tell.muzzle.x + (tell.direction.x * gap) / 2,
      y: tell.muzzle.y + (tell.direction.y * gap) / 2,
    });
    const before = flight.shield;
    stepFlight(CONTENT, 0.25, idle, flight);
    expect(tell).toMatchObject({ fired: true, stopped: true });
    expect(flight.shield).toBe(before);
    expect(Math.hypot(tell.end.x - tell.muzzle.x, tell.end.y - tell.muzzle.y)).toBeLessThan(gap);
  });

  it("continues a pending tell with legacy mount damage and disabled state", () => {
    const { flight, mount, target, tell } = fixture();
    target.enemy!.hardpoints.find((part) => part.id === mount)!.hp = 0;
    target.enemy!.disabled = true;
    const before = flight.shield;
    stepFlight(CONTENT, tellSeconds + 0.1, idle, flight);
    expect(tell.fired).toBe(true);
    expect(flight.shield).toBe(
      before - ENEMY_ONLY_DAMAGE.chargedLance * CONTENT.tuning.flight.playerShotDamage,
    );
  });

  it.each(["defeated", "salvaged", "removed"] as const)(
    "cancels before firing when its %s becomes unavailable",
    (reason) => {
      const { flight, target } = fixture();
      if (reason === "defeated") {
        target.hp = target.enemy!.hp = 0;
      }
      if (reason === "salvaged") {
        target.enemy!.salvaged = true;
      }
      if (reason === "removed") {
        flight.objects = [];
      }
      const before = flight.shield;
      stepFlight(CONTENT, 1 / 60, idle, flight);
      expect(activeEnemyBeams(flight)).toEqual([]);
      stepFlight(CONTENT, tellSeconds + 0.1, idle, flight);
      expect(flight.shield).toBe(before);
    },
  );
});
