import { describe, expect, it } from "vitest";

import { AmmoFeedbackQueue } from "./ammoFeedback.ts";

describe("grant-time ammo feedback", () => {
  it("coalesces actual added amounts per weapon independently", () => {
    const queue = new AmmoFeedbackQueue();
    queue.push("phaser", 7);
    queue.push("rapidMissile", 3);
    queue.push("phaser", 2);
    expect([...queue.advance(0, true)]).toEqual([
      ["phaser", { added: 9, opacity: 1 }],
      ["rapidMissile", { added: 3, opacity: 1 }],
    ]);
  });

  it("shows a partial grant exactly and ignores zero/capped/invalid outcomes and unlimited Laser", () => {
    const queue = new AmmoFeedbackQueue();
    for (const amount of [0, -1, NaN, Infinity, 0.5]) {
      queue.push("phaser", amount);
    }
    queue.push("laser", 10);
    expect(queue.advance(0, true).size).toBe(0);
    queue.push("heavyMissile", 1);
    expect(queue.advance(0, true).get("heavyMissile")?.added).toBe(1);
  });

  it.each([
    [false, 600, 300],
    [true, 750, 150],
  ])("pauses under a cover and expires at 900 ms with reduced motion %s", (reduced, hold, fade) => {
    const queue = new AmmoFeedbackQueue();
    queue.push("phaser", 4);
    expect(queue.advance(hold, true, reduced).get("phaser")?.opacity).toBe(1);
    expect(queue.advance(fade / 2, true, reduced).get("phaser")?.opacity).toBe(0.5);
    expect(queue.advance(10000, false, reduced).get("phaser")?.opacity).toBe(0.5);
    expect(queue.advance(fade / 2, true, reduced).size).toBe(0);
    queue.push("phaser", 2);
    expect(queue.advance(0, true, reduced).get("phaser")?.added).toBe(2);
    queue.clear();
    expect(queue.advance(0, true, reduced).size).toBe(0);
  });
});
