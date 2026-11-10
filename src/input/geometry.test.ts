import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import { describe, expect, it } from "vitest";

import { movementCssScale } from "./geometry.ts";
import { ControlState } from "./state.ts";

const size = { height: 360, width: 720 };

describe("CSS movement travel", () => {
  it.each([0, 90, -90] as const)(
    "preserves radial throttle through anisotropic scaling at frame turn %s",
    (turn) => {
      const box = { height: 120, width: 1440, x: 30, y: 20 };
      const scale = movementCssScale(turn, size, box);
      for (const travel of [2, 4.16, 11.2, 20, 50]) {
        const controls = new ControlState();
        controls.setMoveScale(scale);
        const origin = { x: 100, y: 50 };
        const down = pageToGame(turn, box, size, origin);
        controls.down("move", 1, down);
        controls.move(1, pageToGame(turn, box, size, { x: origin.x + travel, y: origin.y }));
        const move = controls.sample().move;
        expect(Math.hypot(move.x, move.y)).toBeCloseTo(
          Math.min(1, Math.max(0, (travel - 2.4) / 17.6)),
          12,
        );
        if (turn === 0) {
          expect(move.y).toBe(0);
          expect(move.x).toBeGreaterThanOrEqual(0);
        } else {
          expect(move.x).toBe(0);
          if (travel > 2.4) {
            expect(Math.sign(move.y)).toBe(turn === 90 ? -1 : 1);
          }
        }
        controls.release(1);
        expect(controls.sample().move).toEqual({ x: 0, y: 0 });
      }
    },
  );

  it.each([
    { x: 0, y: 1 },
    { x: Infinity, y: 1 },
    { x: 1, y: -1 },
  ])("rejects an invalid movement metric %j", (scale) => {
    expect(() => new ControlState().setMoveScale(scale)).toThrow(/scale/);
  });
});
