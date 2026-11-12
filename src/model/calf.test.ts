import { describe, expect, it } from "vitest";

import { CALF } from "../data/activities.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { placedCalf, stepCalf } from "./calf.ts";
import type { GuidedCalf } from "./types.ts";

const ship = {
  accelerationSeconds: PROTOTYPE.tuning.physics.accelerationSeconds,
  maxSpeed: PROTOTYPE.tuning.physics.maxSpeed,
};
// Sunflower has no currents, so these steps have no drift.
const step = (calf: GuidedCalf, player: { x: number; y: number }, seconds = 1 / 60) =>
  stepCalf(1, ship, seconds, player, calf);

describe("the guided calf", () => {
  it("follows from 160, keeps following to 340 and waits beyond", () => {
    const calf = placedCalf({ x: 0, y: 0 }, { x: 0, y: 0 });
    step(calf, { x: CALF.follow + 10, y: 0 });
    expect(calf.following).toBe(false);
    step(calf, { x: CALF.follow, y: 0 });
    expect(calf.following).toBe(true);
    step(calf, { x: calf.x + CALF.release, y: 0 });
    expect(calf.following).toBe(true);
    step(calf, { x: calf.x + CALF.release + 1, y: 0 });
    expect(calf.following).toBe(false);
  });

  it("moves at most 0.8 of Ada's base top speed and stops 120 short of her", () => {
    // A following calf 300 off, inside the 340 it keeps following to.
    const calf = { ...placedCalf({ x: 0, y: 0 }, { x: 0, y: 0 }), following: true };
    const player = { x: 300, y: 0 };
    let fastest = 0;
    for (let frame = 0; frame < 60 * 20; frame++) {
      step(calf, player);
      fastest = Math.max(fastest, Math.hypot(calf.velocity.x, calf.velocity.y));
    }
    expect(fastest).toBeLessThanOrEqual(
      CALF.speedFraction * PROTOTYPE.tuning.physics.maxSpeed + 1e-9,
    );
    expect(player.x - calf.x).toBeGreaterThanOrEqual(CALF.stop - 1);
    expect(player.x - calf.x).toBeLessThanOrEqual(CALF.stop + 1);
  });

  it("slows to rest while it waits", () => {
    const calf: GuidedCalf = { following: false, velocity: { x: 100, y: 0 }, x: 0, y: 0 };
    for (let frame = 0; frame < 60 * 5; frame++) {
      step(calf, { x: 5000, y: 0 });
    }
    expect(Math.hypot(calf.velocity.x, calf.velocity.y)).toBe(0);
  });
});
