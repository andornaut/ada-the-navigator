import { describe, expect, it } from "vitest";

import { CONVERSATION_TUNING, lineDuration } from "../data/conversations.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { BUMP_DAMAGE, createFlight, inDanger, stepFlight } from "./flight.ts";
import type { FlightState } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

/** A flight alone with one large rock 60 units ahead of Ada, flying into it. */
function intoRock(): FlightState {
  const flight = createFlight(PROTOTYPE, 1, 7, { known: [] });
  const shape = [...ASTEROID_SHAPES.values()].find(({ size }) => size === "large")!;
  flight.objects = [
    {
      asteroid: shape.id,
      hp: 10,
      id: "rock",
      kind: "rock",
      radius: shape.radius,
      x: flight.player.x + 60,
      y: flight.player.y,
    },
  ];
  flight.shots = [];
  flight.velocity = { x: 200, y: 0 };
  return flight;
}

describe("reviewed rules", () => {
  it("deals 1 damage per scenery bump, at most once per 0.5 s, as a hit", () => {
    expect(BUMP_DAMAGE).toEqual({ amount: 1, seconds: 0.5 });
    const flight = intoRock();
    const shield = flight.shield;
    const push = { ...idle, move: { x: 1, y: 0 } };
    for (let step = 0; step < 30 && flight.shield === shield; step++) {
      stepFlight(PROTOTYPE, 1 / 30, push, flight);
    }
    expect(flight.shield).toBe(shield - 1);
    expect(flight.sinceDamage).toBeLessThan(0.5);
    // Pressed against the rock for 0.4 s more: no second hit inside the half second.
    const at = flight.lastBump!;
    while (flight.time < at + 0.4) {
      stepFlight(PROTOTYPE, 1 / 30, push, flight);
    }
    expect(flight.shield).toBe(shield - 1);
  });

  it("shows each line for 5 s plus 50 ms per character", () => {
    expect(CONVERSATION_TUNING.lineSeconds).toBe(5);
    expect(lineDuration("")).toBe(5);
    expect(lineDuration("x".repeat(40))).toBeCloseTo(7, 9);
  });

  it("places Cartwheel's story milestones at 10, 20 and 30 ore", () => {
    expect(PROTOTYPE.tuning.miningMilestones).toEqual([10, 20, 30]);
  });

  it("puts Ada in danger only in battle or with an enemy shot in the battle square", () => {
    const flight = createFlight(PROTOTYPE, 1, 7, { known: [] });
    flight.objects = [];
    flight.shots = [];
    expect(inDanger(PROTOTYPE, 720, flight)).toBe(false);
    // The battle square reaches 424 along each axis on the 720-wide view.
    const shot = (dx: number, dy: number) => ({
      damage: 1,
      enemy: true,
      hitIds: [],
      id: `shot:${dx}:${dy}`,
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
      x: flight.player.x + dx,
      y: flight.player.y + dy,
    });
    flight.shots = [shot(424, -424)];
    expect(inDanger(PROTOTYPE, 720, flight)).toBe(true);
    flight.shots = [shot(425, 0), { ...shot(0, 10), enemy: false }];
    expect(inDanger(PROTOTYPE, 720, flight)).toBe(false);
    // Danger has no release time: it ends the step the last shot leaves the square.
    flight.shots = [shot(0, 300)];
    stepFlight(PROTOTYPE, 0.05, idle, flight);
    expect(flight.dangerFor).toBeGreaterThan(0);
    flight.shots = [];
    stepFlight(PROTOTYPE, 0.05, idle, flight);
    expect(flight.dangerFor).toBe(0);
  });
});
