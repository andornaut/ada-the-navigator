import { describe, expect, it } from "vitest";

import { ControlState } from "../input/state.ts";
import { centredAt, stickRestCentres, stickViews } from "./sticks.ts";
import { TOUCH_CHROME_FRAME, TOUCH_KNOB_FRAME } from "./touch-chrome.ts";

const layout = {
  height: 360,
  visibility: { aim: true, move: true },
  visible: true,
  width: 720,
};
const knobCentre = (point: { x: number; y: number }) => ({
  x: point.x + (TOUCH_KNOB_FRAME - 1) / 2,
  y: point.y + (TOUCH_KNOB_FRAME - 1) / 2,
});

describe("joystick placement", () => {
  it("rests both same-sized rings where Chibi's move hint rests, mirrored across the view", () => {
    expect(stickRestCentres(layout)).toEqual({ aim: { x: 598, y: 303 }, move: { x: 121, y: 303 } });
    const views = stickViews(layout, new ControlState());
    expect(views.move?.ring).toEqual(centredAt({ x: 121, y: 303 }, TOUCH_CHROME_FRAME));
    expect(views.aim?.ring).toEqual(centredAt({ x: 598, y: 303 }, TOUCH_CHROME_FRAME));
    expect(views.move?.ringPose).toBe("rest");
    expect(views.move?.knobPose).toBe("rest");
    expect(knobCentre(views.move!.knob)).toEqual({ x: 121, y: 303 });
  });

  it("follows the centred view across and the canvas bottom down in a wider, taller canvas", () => {
    expect(stickRestCentres({ height: 400, width: 900 })).toEqual({
      aim: { x: 688, y: 343 },
      move: { x: 211, y: 343 },
    });
  });

  it("omits a side hidden by its setting and both while controls do not show", () => {
    const hidden = stickViews(
      { ...layout, visibility: { aim: true, move: false } },
      new ControlState(),
    );
    expect(hidden.move).toBeUndefined();
    expect(hidden.aim).toBeDefined();
    expect(stickViews({ ...layout, visible: false }, new ControlState())).toEqual({});
  });
});

describe("left stick CSS travel display", () => {
  it.each([0.1, 0.5, 1])("draws the sampled %s throttle with the same CSS geometry", (strength) => {
    const state = new ControlState();
    state.setMoveScale({ x: 0.5, y: 0.5 });
    state.down("move", 1, { x: 100, y: 100 });
    state.move(1, { x: 100 + (2.4 + strength * 17.6) / 0.5, y: 100 });
    const view = stickViews(layout, state).move!;
    expect(view.ring).toEqual(centredAt({ x: 100, y: 100 }, TOUCH_CHROME_FRAME));
    expect(knobCentre(view.knob)).toEqual({ x: 100 + Math.round(strength * 40), y: 100 });
    expect(view.ringPose).toBe("held-right");
    expect(view.knobPose).toBe("held");
    expect(Math.hypot(state.sample().move.x, state.sample().move.y)).toBeCloseTo(strength, 12);
    state.release(1);
    expect(stickViews(layout, state).move?.knobPose).toBe("rest");
    expect(state.sample().move).toEqual({ x: 0, y: 0 });
  });

  it("lights the left chevron while the stick pushes left and neither inside the dead zone", () => {
    const state = new ControlState();
    state.down("move", 1, { x: 100, y: 100 });
    state.move(1, { x: 90, y: 100 });
    expect(stickViews(layout, state).move?.ringPose).toBe("held-left");
    state.move(1, { x: 101, y: 100 });
    expect(stickViews(layout, state).move?.ringPose).toBe("rest");
    expect(stickViews(layout, state).move?.knobPose).toBe("held");
  });

  it("keeps the displayed diagonal on the finger ray", () => {
    const state = new ControlState();
    state.down("move", 1, { x: 100, y: 100 });
    state.move(1, { x: 110, y: 110 });
    const knob = knobCentre(stickViews(layout, state).move!.knob);
    expect(knob.x - 100).toBe(knob.y - 100);
    const move = state.sample().move;
    expect(move.x).toBeCloseTo(move.y, 12);
  });
});

describe("right stick display", () => {
  it("keeps the aim ring the move ring's size with twelve-pixel knob travel", () => {
    const state = new ControlState();
    state.down("aim", 2, { x: 500, y: 100 });
    state.move(2, { x: 537, y: 100 });
    const view = stickViews(layout, state).aim!;
    expect(view.ring).toEqual(centredAt({ x: 500, y: 100 }, TOUCH_CHROME_FRAME));
    expect(knobCentre(view.knob)).toEqual({ x: 512, y: 100 });
    expect(view.ringPose).toBe("rest");
    expect(view.knobPose).toBe("held");
    expect(state.sample().aim).toEqual({ x: 1, y: 0 });
  });
});
