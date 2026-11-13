import { describe, expect, it } from "vitest";

import { DesktopControlState } from "./desktop.ts";
import { MOVE_STICK_GEOMETRY } from "./state.ts";

const frame = { facing: { x: 0, y: -1 }, ship: { x: 310, y: 170 } };
const neutral = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: -0 }, turn: 0 };

function fresh() {
  return new DesktopControlState(() => true);
}

describe("desktop flight controls", () => {
  it("measures mouse throttle from the current projected ship, using the canonical stick curve", () => {
    const state = fresh();
    const { deadZone, reach } = MOVE_STICK_GEOMETRY;
    state.down(0, 1, { x: frame.ship.x + deadZone, y: frame.ship.y });
    expect(state.sample(frame).move).toEqual({ x: 0, y: 0 });
    state.move(1, { x: frame.ship.x + (deadZone + reach) / 2, y: frame.ship.y });
    expect(state.sample(frame).move.x).toBeCloseTo(0.5);
    expect(state.sample(frame).move.y).toBe(0);
    expect(
      state.sample({
        ...frame,
        ship: { x: frame.ship.x + (deadZone + reach) / 2, y: frame.ship.y },
      }).move,
    ).toEqual({ x: 0, y: 0 });
    state.move(1, { x: frame.ship.x + reach * 3, y: frame.ship.y });
    expect(state.sample(frame).move).toEqual({ x: 1, y: 0 });
    expect(state.sample(frame).fire).toBe(false);
    state.up(0, 1);
    expect(state.sample(frame).move).toEqual(neutral.move);
  });

  it("thrusts along the actual facing, with Shift limiting keyboard thrust to twenty percent only", () => {
    const state = fresh();
    state.keyDown("KeyW");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -1 });
    state.keyDown("ShiftLeft");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -0.2 });
    expect(state.sample({ ...frame, facing: { x: 1, y: 0 } }).move).toEqual({ x: 0.2, y: 0 });
    state.down(0, 1, { x: frame.ship.x + MOVE_STICK_GEOMETRY.reach, y: frame.ship.y });
    expect(state.sample(frame).move).toEqual({ x: 1, y: 0 });
    state.up(0, 1);
    expect(state.sample(frame).move).toEqual({ x: 0, y: -0.2 });
  });

  it("maps A/D and Left/Right to turning, keeps S/Down unbound and never fires from steering", () => {
    const state = fresh();
    state.keyDown("KeyA");
    expect(state.sample(frame)).toEqual({ ...neutral, turn: -1 });
    state.keyDown("ArrowRight");
    expect(state.sample(frame).turn).toBe(0);
    state.keyUp("KeyA");
    expect(state.sample(frame).turn).toBe(1);
    state.keyUp("ArrowRight");
    state.keyDown("KeyS");
    state.keyDown("ArrowDown");
    expect(state.sample(frame)).toEqual(neutral);
    state.keyDown("ArrowUp");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -1 });
  });

  it("fires from either Space or RMB and releases each held mouse button independently", () => {
    const state = fresh();
    state.down(0, 1, { x: frame.ship.x + MOVE_STICK_GEOMETRY.reach, y: frame.ship.y });
    state.down(2, 1, { x: frame.ship.x + MOVE_STICK_GEOMETRY.reach, y: frame.ship.y });
    expect(state.sample(frame)).toMatchObject({
      aim: { x: 1, y: 0 },
      fire: true,
      move: { x: 1, y: 0 },
    });
    state.up(0, 1);
    expect(state.sample(frame)).toMatchObject({ fire: true, move: neutral.move });
    state.keyDown("Space");
    state.up(2, 1);
    expect(state.sample(frame).fire).toBe(true);
    state.keyUp("Space");
    expect(state.sample(frame).fire).toBe(false);
  });

  it("rejects blocked input and requires fresh presses after modal, blur or mode reset", () => {
    let accepts = true;
    const state = new DesktopControlState(() => accepts);
    state.keyDown("KeyW");
    state.down(2, 1, { x: 500, y: 100 });
    accepts = false;
    state.reset();
    state.keyDown("Space");
    state.down(0, 2, { x: 500, y: 100 });
    expect(state.sample(frame)).toEqual({
      aim: { x: 0, y: 0 },
      fire: false,
      move: { x: 0, y: 0 },
      turn: 0,
    });
    accepts = true;
    state.move(1, { x: 700, y: 100 });
    state.keyDown("KeyW", true);
    expect(state.sample(frame)).toEqual(neutral);
    state.keyUp("KeyW");
    state.keyDown("KeyW");
    expect(state.sample(frame).move).toEqual({ x: 0, y: -1 });
  });
});
