import type { GameObjects } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { ControlState } from "../input/state.ts";
import { drawSticks } from "./sticks.ts";

function drawing() {
  return {
    clear: vi.fn(),
    fillCircle: vi.fn(),
    fillEllipse: vi.fn(),
    fillStyle: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    strokeEllipse: vi.fn(),
  };
}
const view = {
  height: 360,
  showIdle: false,
  visibility: { aim: true, move: true },
  visible: true,
  width: 720,
};

describe("left stick CSS travel display", () => {
  it.each([0.1, 0.5, 1])("draws the sampled %s throttle with the same CSS geometry", (strength) => {
    const state = new ControlState();
    state.setMoveScale({ x: 2, y: 0.5 });
    state.down("move", 1, { x: 100, y: 100 });
    state.move(1, { x: 100 + (2.4 + strength * 17.6) / 2, y: 100 });
    const graphics = drawing();
    drawSticks(graphics as unknown as GameObjects.Graphics, view, state);
    expect(graphics.strokeEllipse).toHaveBeenCalledWith(100, 100, 20, 80);
    const [x, y, width, height] = graphics.fillEllipse.mock.calls[0]!;
    expect(x).toBeCloseTo(100 + strength * 10, 12);
    expect(y).toBe(100);
    expect(width).toBe(5);
    expect(height).toBe(20);
    expect(Math.hypot(state.sample().move.x, state.sample().move.y)).toBeCloseTo(strength, 12);
    state.release(1);
    drawSticks(graphics as unknown as GameObjects.Graphics, view, state);
    expect(graphics.fillEllipse).toHaveBeenCalledTimes(1);
    expect(state.sample().move).toEqual({ x: 0, y: 0 });
  });

  it("keeps the displayed diagonal on the finger ray without reusing the game heading as CSS", () => {
    const state = new ControlState();
    state.setMoveScale({ x: 2, y: 1 });
    state.down("move", 1, { x: 100, y: 100 });
    state.move(1, { x: 105, y: 105 });
    const graphics = drawing();
    drawSticks(graphics as unknown as GameObjects.Graphics, view, state);
    const [x, y] = graphics.fillEllipse.mock.calls[0]!;
    const visible = { x: (x - 100) * 2, y: y - 100 };
    expect(visible.x * 5 - visible.y * 10).toBeCloseTo(0, 10);
    const move = state.sample().move;
    expect(move.x).toBeCloseTo(move.y, 12);
    expect(Math.hypot(visible.x, visible.y)).toBeCloseTo(Math.hypot(move.x, move.y) * 20, 10);
  });

  it("preserves the right aim ring and twelve-pixel thumb travel", () => {
    const state = new ControlState();
    state.setMoveScale({ x: 2, y: 0.5 });
    state.down("aim", 2, { x: 500, y: 100 });
    state.move(2, { x: 537, y: 100 });
    const graphics = drawing();
    drawSticks(graphics as unknown as GameObjects.Graphics, view, state);
    expect(graphics.strokeCircle).toHaveBeenCalledWith(500, 100, 37);
    expect(graphics.fillCircle).toHaveBeenCalledWith(512, 100, 5);
    expect(graphics.fillEllipse).not.toHaveBeenCalled();
    expect(state.sample().aim).toEqual({ x: 1, y: 0 });
  });
});
