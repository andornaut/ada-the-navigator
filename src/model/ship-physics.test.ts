import { describe, expect, it } from "vitest";

import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { SHIP_PHYSICS } from "../data/ship-physics.ts";
import {
  direction,
  hullOffset,
  speedFraction,
  stepShipMotion,
  turnToward,
} from "./ship-physics.ts";

const angle = (v: { x: number; y: number }) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

describe("ship physics data", () => {
  it("defines Gameplay's provisional values for every ship", () => {
    expect(
      Object.fromEntries(
        Object.entries(SHIP_PHYSICS).map(([ship, value]) => [
          ship,
          [
            value.speedRatio,
            value.accelerationSeconds,
            value.brakingSeconds,
            value.turnSeconds,
            value.aimTurnSeconds,
          ],
        ]),
      ),
    ).toEqual({
      ada: [1, 0.3, 0.45, 0.18, 0.07],
      capital: [0.2, 2.5, 3, 2, 0.5],
      fighter: [0.8, 0.4, 0.5, 0.3, 0.15],
      frigate: [0.4, 1.5, 2, 1.2, 0.4],
      interceptor: [1.1, 0.9, 1.2, 0.6, 0.12],
      oversizedCapital: [0.12, 3.5, 4, 3, 0.6],
      retaliator: [0.45, 1.2, 1.5, 0.9, 0.35],
      swarm: [0.9, 0.2, 0.25, 0.12, 0.1],
    });
  });

  it("applies each ship's own physics entry to Ada and every archetype", () => {
    expect(PROTOTYPE.tuning.physics).toBe(SHIP_PHYSICS.ada);
    for (const [archetype, definition] of Object.entries(enemyCatalog)) {
      expect(definition.physics).toBe(SHIP_PHYSICS[archetype as keyof typeof enemyCatalog]);
    }
  });
});

describe("shared movement model", () => {
  const physics = SHIP_PHYSICS.fighter;
  const east = { x: 1, y: 0 };
  const north = { x: 0, y: -1 };

  it("starts directly on the request from rest and accelerates with accelerationSeconds", () => {
    const next = stepShipMotion(
      physics,
      0.1,
      { direction: north, speed: 160 },
      { heading: null, velocity: { x: 0, y: 0 } },
    );
    expect(next.heading).toEqual(north);
    expect(next.velocity.x).toBe(0);
    expect(next.velocity.y).toBeCloseTo(-160 * (1 - Math.exp(-0.1 / physics.accelerationSeconds)));
  });

  it("turns a moving heading with turnSeconds along the shorter arc", () => {
    const next = stepShipMotion(
      physics,
      0.1,
      { direction: north, speed: 160 },
      { heading: east, velocity: { x: 160, y: 0 } },
    );
    expect(-angle(next.heading!)).toBeCloseTo(90 * (1 - Math.exp(-0.1 / physics.turnSeconds)), 9);
  });

  it("brakes with brakingSeconds, clears the heading and settles at rest", () => {
    const next = stepShipMotion(
      physics,
      0.2,
      { direction: { x: 0, y: 0 }, speed: 160 },
      { heading: east, velocity: { x: 100, y: 0 } },
    );
    expect(next.heading).toBeNull();
    expect(next.velocity.x).toBeCloseTo(100 * Math.exp(-0.2 / physics.brakingSeconds), 9);
    const stopped = stepShipMotion(
      physics,
      0.2,
      { direction: { x: 0, y: 0 }, speed: 160 },
      { heading: null, velocity: { x: 0.005, y: 0 } },
    );
    expect(stopped.velocity).toEqual({ x: 0, y: 0 });
  });

  it("never stores negative zero, which JSON saves cannot represent", () => {
    expect(Object.is(direction({ x: -0, y: -2 }).x, 0)).toBe(true);
    const turned = turnToward(1, 0.001, { x: -0, y: -1 }, { x: 1, y: 0 });
    expect(Object.is(turned.x, 0)).toBe(true);
  });

  it("reports speed as a clamped fraction of a ship's maximum speed", () => {
    expect(speedFraction(160, { x: 48, y: 64 })).toBeCloseTo(0.5, 12);
    expect(speedFraction(160, { x: 0, y: 400 })).toBe(1);
    expect(speedFraction(0, { x: 1, y: 0 })).toBe(0);
  });
});

describe("hull frame", () => {
  it("keeps offsets unchanged facing up and rotates them exactly at 90 degrees", () => {
    const offset = { x: -4, y: -2 };
    expect(hullOffset({ x: 0, y: -1 }, offset)).toEqual({ x: -4, y: -2 });
    // Facing east: forward (-y local) maps to +x world and starboard (+x local) to +y world.
    const east = hullOffset({ x: 1, y: 0 }, offset);
    expect(east.x).toBeCloseTo(2, 12);
    expect(east.y).toBeCloseTo(-4, 12);
    const south = hullOffset({ x: 0, y: 1 }, offset);
    expect(south.x).toBeCloseTo(4, 12);
    expect(south.y).toBeCloseTo(2, 12);
  });
});
