import { describe, expect, it } from "vitest";

import { ControlState, MOVE_STICK_GEOMETRY, stickVector } from "./state.ts";

const zero = { x: 0, y: 0 };

describe("independent twin stick ownership", () => {
  it("keeps each side and its owner when fingers cross, cancel or attempt to replace a thumb", () => {
    const controls = new ControlState();
    controls.down("move", 1, { x: 100, y: 100 });
    controls.down("aim", 2, { x: 600, y: 100 });
    controls.down("move", 3, zero);
    controls.move(3, { x: 800, y: 800 });
    expect(controls.sample().move).toEqual(zero);
    controls.move(1, { x: 700, y: 100 });
    controls.move(2, { x: 20, y: 100 });
    expect(controls.sample()).toEqual({ aim: { x: -1, y: 0 }, move: { x: 1, y: 0 }, use: false });
    controls.release(1);
    expect(controls.sample()).toEqual({ aim: { x: -1, y: 0 }, move: zero, use: false });
    controls.release(2);
    expect(controls.sample().aim).toEqual(zero);
  });

  it("keeps centred aim neutral and normalizes diagonals without coupling movement to aim", () => {
    const controls = new ControlState();
    controls.down("aim", 1, { x: 500, y: 100 });
    controls.move(1, { x: 502, y: 102 });
    controls.keyDown("KeyW");
    controls.keyDown("KeyD");
    controls.setEnabled(true);
    const sample = controls.sample();
    expect(sample.aim).toEqual(zero);
    expect(Math.hypot(sample.move.x, sample.move.y)).toBeCloseTo(1);
    controls.keyDown("ArrowLeft");
    expect(controls.sample().aim).toEqual({ x: -1, y: 0 });
    controls.keyDown("ArrowRight");
    expect(controls.sample().aim).toEqual(zero);
  });

  it("consumes contextual use once and rejects unavailable or repeated presses", () => {
    const controls = new ControlState();
    controls.keyDown("Space");
    expect(controls.sample().use).toBe(false);
    controls.keyUp("Space");
    controls.setUseAvailable(true);
    controls.keyDown("Space");
    expect(controls.sample().use).toBe(true);
    expect(controls.sample().use).toBe(false);
    controls.keyDown("Space", true);
    expect(controls.sample().use).toBe(false);
    controls.keyUp("Space");
    controls.keyDown("Space");
    expect(controls.sample().use).toBe(true);
    controls.requestUse();
    controls.setUseAvailable(false);
    expect(controls.sample().use).toBe(false);
  });

  it("clears input across a modal and requires fresh presses after closing", () => {
    const controls = new ControlState();
    controls.setUseAvailable(true);
    controls.keyDown("KeyW");
    controls.requestUse();
    controls.down("aim", 1, zero);
    controls.move(1, { x: 100, y: 0 });
    controls.openModal();
    controls.keyDown("ArrowRight");
    controls.down("move", 2, zero);
    expect(controls.sample()).toEqual({ aim: zero, move: zero, use: false });
    controls.closeModal();
    controls.move(1, { x: 200, y: 0 });
    controls.keyDown("KeyW", true);
    expect(controls.sample()).toEqual({ aim: zero, move: zero, use: false });
    controls.keyUp("KeyW");
    controls.keyDown("KeyW");
    expect(controls.sample().move).toEqual({ x: 0, y: -1 });
  });

  it("clears pending use and held input on blur/reset and disable without resurrecting them", () => {
    const controls = new ControlState();
    controls.setUseAvailable(true);
    controls.keyDown("KeyD");
    controls.requestUse();
    controls.reset();
    expect(controls.sample()).toEqual({ aim: zero, move: zero, use: false });
    controls.down("aim", 1, zero);
    controls.move(1, { x: 100, y: 100 });
    controls.setEnabled(false);
    controls.keyDown("KeyW");
    controls.requestUse();
    controls.setEnabled(true);
    controls.move(1, { x: 200, y: 200 });
    expect(controls.sample()).toEqual({ aim: zero, move: zero, use: false });
  });

  it("applies radial dead zone and bounded proportional deflection", () => {
    const geometry = { deadZone: 5, reach: 25 };
    expect(stickVector(geometry, { x: 3, y: 4 })).toEqual(zero);
    expect(stickVector(geometry, { x: 15, y: 0 })).toEqual({ x: 0.5, y: 0 });
    const diagonal = stickVector(geometry, { x: 100, y: 100 });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(() => new ControlState({ deadZone: 25, reach: 25 })).toThrow(/geometry/);
  });
});

describe("left stick analog throttle", () => {
  it.each([0, 0.1, 0.5, 1, 2])("maps radial travel to bounded strength %s", (strength) => {
    const controls = new ControlState();
    const geometry = MOVE_STICK_GEOMETRY;
    const travel = strength === 0 ? geometry.deadZone : geometry.deadZone + strength * 17.6;
    controls.down("move", 1, { x: 100, y: 80 });
    controls.move(1, { x: 100 + travel, y: 80 });
    expect(controls.sample().move.x).toBeCloseTo(Math.min(1, strength), 12);
    expect(controls.sample().move.y).toBe(0);
    controls.release(1);
    expect(controls.sample().move).toEqual(zero);
  });

  it.each([0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 3])(
    "retains half throttle in direction %s without normalizing it to full speed",
    (angle) => {
      const controls = new ControlState();
      controls.down("move", 1, zero);
      controls.move(1, { x: Math.cos(angle) * 11.2, y: Math.sin(angle) * 11.2 });
      const move = controls.sample().move;
      expect(Math.hypot(move.x, move.y)).toBeCloseTo(0.5, 12);
      expect(move.x).toBeCloseTo(Math.cos(angle) * 0.5, 12);
      expect(move.y).toBeCloseTo(Math.sin(angle) * 0.5, 12);
    },
  );

  it("keeps the left dead zone radial and independent of aim and keyboard", () => {
    const controls = new ControlState();
    controls.down("move", 1, zero);
    controls.down("aim", 2, { x: 500, y: 0 });
    controls.move(1, { x: 1.44, y: 1.92 });
    controls.move(2, { x: 505, y: 0 });
    expect(controls.sample()).toEqual({ aim: zero, move: zero, use: false });
    controls.move(1, { x: 11.2, y: 0 });
    controls.move(2, { x: 521.5, y: 0 });
    const sample = controls.sample();
    expect(sample.aim).toEqual({ x: 0.5, y: 0 });
    expect(sample.move.x).toBeCloseTo(0.5, 12);
    expect(sample.move.y).toBe(0);
    controls.release(1);
    expect(controls.sample().aim).toEqual({ x: 0.5, y: 0 });
    controls.keyDown("KeyW");
    controls.keyDown("KeyD");
    expect(Math.hypot(controls.sample().move.x, controls.sample().move.y)).toBeCloseTo(1);
  });
});
