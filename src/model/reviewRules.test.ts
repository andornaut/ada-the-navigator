import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { lineDuration, noticeDuration } from "../data/conversations.ts";
import { playOpening, seedLaunches } from "../testing/launch.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { BUMP_DAMAGE, createFlight, inDanger, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import type { FlightState } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

/** A flight alone with one large rock 60 units ahead of Ada, flying into it. */
function intoRock(): FlightState {
  const flight = createFlight(CONTENT, 1, 7, { known: [] });
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
      stepFlight(CONTENT, 1 / 30, push, flight);
    }
    expect(flight.shield).toBe(shield - 1);
    expect(flight.sinceDamage).toBeLessThan(0.5);
    // Pressed against the rock for 0.4 s more: no second hit inside the half second.
    const at = flight.lastBump!;
    while (flight.time < at + 0.4) {
      stepFlight(CONTENT, 1 / 30, push, flight);
    }
    expect(flight.shield).toBe(shield - 1);
  });

  it("deals bump damage from generated play rocks of every kind, 1 a bump, at most every 0.5 s", () => {
    // Stable IDs select actual generated small, large, resource and moving debris fixtures.
    const kinds = new Set<string>();
    for (const [seed, id, expectedKind] of [
      [173, "chunk:0,0:0", "rock:small"],
      [174, "chunk:0,0:feature", "rock:large"],
      [176, "chunk:0,-1:0", "resource:medium"],
      [182, "ballistic:0,0:0", "drifting"],
    ] as const) {
      seedLaunches(seed);
      const model = new GameModel(CONTENT);
      model.startGalaxy(1);
      playOpening(model);
      const flight = model.state.flight!;
      model.step(1 / 60, idle);
      expect(flight.seed).toBe(seed);
      const target = flight.objects.find((object) => object.id === id)!;
      expect(target).toBeDefined();
      expect(target.hp).toBeGreaterThan(0);
      const size = target.asteroid ? ASTEROID_SHAPES.get(target.asteroid)?.size : undefined;
      const kind = target.velocity ? "drifting" : `${target.kind}:${size}`;
      expect(kind).toBe(expectedKind);
      if (expectedKind === "drifting") {
        expect(Math.hypot(target.velocity!.x, target.velocity!.y)).toBeGreaterThan(0);
      }
      kinds.add(kind);
      const drops: number[] = [];
      for (let frame = 0; frame < 600 && model.state.mode === "space"; frame++) {
        const dx = target.x - flight.player.x;
        const dy = target.y - flight.player.y;
        const d = Math.hypot(dx, dy) || 1;
        const before = flight.shield;
        model.step(1 / 60, { ...idle, move: { x: dx / d, y: dy / d } });
        if (flight.shield < before && flight.lastBump === flight.time) {
          expect(before - flight.shield).toBe(BUMP_DAMAGE.amount);
          drops.push(flight.time);
        }
      }
      expect(drops.length).toBeGreaterThan(0);
      for (let index = 1; index < drops.length; index++) {
        expect(drops[index]! - drops[index - 1]!).toBeGreaterThanOrEqual(
          BUMP_DAMAGE.seconds - 1e-9,
        );
      }
    }
    expect(kinds).toEqual(new Set(["drifting", "resource:medium", "rock:large", "rock:small"]));
  });

  it("uses a shorter base time for ordinary speech while preserving notice time", () => {
    expect(lineDuration("")).toBe(3);
    expect(lineDuration("x".repeat(40))).toBeCloseTo(4.2, 9);
    expect(noticeDuration("")).toBe(5);
    expect(noticeDuration("x".repeat(40))).toBeCloseTo(7, 9);
  });

  it("places Cartwheel's story milestones at 10, 20 and 30 ore", () => {
    expect(CONTENT.tuning.miningMilestones).toEqual([10, 20, 30]);
  });

  it("puts Ada in danger only in battle or with an enemy shot in the battle square", () => {
    const flight = createFlight(CONTENT, 1, 7, { known: [] });
    flight.objects = [];
    flight.shots = [];
    expect(inDanger(CONTENT, 720, flight)).toBe(false);
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
    expect(inDanger(CONTENT, 720, flight)).toBe(true);
    flight.shots = [shot(425, 0), { ...shot(0, 10), enemy: false }];
    expect(inDanger(CONTENT, 720, flight)).toBe(false);
    // Danger has no release time: it ends the step the last shot leaves the square.
    flight.shots = [shot(0, 300)];
    stepFlight(CONTENT, 0.05, idle, flight);
    expect(flight.dangerFor).toBeGreaterThan(0);
    flight.shots = [];
    stepFlight(CONTENT, 0.05, idle, flight);
    expect(flight.dangerFor).toBe(0);
  });
});
