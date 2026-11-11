import { describe, expect, it } from "vitest";

import { ControlState } from "../input/state.ts";
import { NO_INSETS } from "./layout/playView.ts";
import { centredAt, MARKER_THRESHOLD, STICK_DEPTHS, stickViews } from "./sticks.ts";
import {
  KNOB_OUTER_RADIUS,
  MARKER_INK_WIDTH,
  MOVE_KNOB_REACH,
  MOVE_MARKERS,
  SPEED_LINE_FRAME,
  speedLineLayers,
  TOUCH_CHROME_COLOURS,
  TOUCH_CHROME_FRAME,
  TOUCH_KNOB_FRAME,
  touchChromePixel,
} from "./touch-chrome.ts";

const layout = {
  height: 360,
  insets: NO_INSETS,
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
    const views = stickViews(layout, new ControlState());
    expect(views.move?.ring).toEqual(centredAt({ x: 121, y: 303 }, TOUCH_CHROME_FRAME));
    expect(views.aim?.ring).toEqual(centredAt({ x: 598, y: 303 }, TOUCH_CHROME_FRAME));
    expect(views.move?.ringPose).toBe("rest");
    expect(views.move?.knobPose).toBe("rest");
    expect(knobCentre(views.move!.knob)).toEqual({ x: 121, y: 303 });
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

describe("left stick deflection display", () => {
  it.each([0.1, 0.5, 1])(
    "draws the sampled %s throttle in proportion inside the markers",
    (strength) => {
      const state = new ControlState();
      state.setMoveScale({ x: 0.5, y: 0.5 });
      state.down("move", 1, { x: 100, y: 100 });
      state.move(1, { x: 100 + (2.4 + strength * 17.6) / 0.5, y: 100 });
      const view = stickViews(layout, state).move!;
      expect(view.ring).toEqual(centredAt({ x: 100, y: 100 }, TOUCH_CHROME_FRAME));
      expect(knobCentre(view.knob)).toEqual({
        x: 100 + Math.round(strength * MOVE_KNOB_REACH),
        y: 100,
      });
      expect(view.ringPose).toBe("held-right");
      expect(view.knobPose).toBe("held");
      expect(Math.hypot(state.sample().move.x, state.sample().move.y)).toBeCloseTo(strength, 12);
      state.release(1);
      expect(stickViews(layout, state).move?.knobPose).toBe("rest");
      expect(state.sample().move).toEqual({ x: 0, y: 0 });
    },
  );

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

describe("move ring markers", () => {
  const poseAt = (degrees: number) => {
    const state = new ControlState();
    state.down("move", 1, { x: 100, y: 100 });
    const radians = (degrees * Math.PI) / 180;
    state.move(1, { x: 100 + 15 * Math.cos(radians), y: 100 - 15 * Math.sin(radians) });
    return stickViews(layout, state).move?.ringPose;
  };

  it("lights neither marker for a pure vertical push", () => {
    expect(poseAt(90)).toBe("rest");
    expect(poseAt(-90)).toBe("rest");
  });

  it.each([
    [67, "held-right"],
    [68, "rest"],
    [-67, "held-right"],
    [-68, "rest"],
    [113, "held-left"],
    [112, "rest"],
    [-113, "held-left"],
    [-112, "rest"],
  ])("at %s degrees from the right shows %s", (degrees, pose) => {
    expect(poseAt(degrees)).toBe(pose);
  });

  it("puts the boundary at sin(22.5 degrees) of the unit direction", () => {
    expect(MARKER_THRESHOLD).toBeCloseTo(0.3827, 4);
  });
});

describe("move knob travel", () => {
  // Distance from a point to a polyline, in frame pixels.
  const toPath = (point: { x: number; y: number }, path: readonly { x: number; y: number }[]) =>
    Math.min(
      ...path.slice(1).map((to, index) => {
        const from = path[index]!;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const along = ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy);
        const t = Math.min(1, Math.max(0, along));
        return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy);
      }),
    );

  it.each([0, 15, 30, 45, 90, 135, 150, 165, 180, 225, 270, 315])(
    "keeps the knob's outer edge inside the markers at full deflection toward %s degrees",
    (degrees) => {
      const state = new ControlState();
      state.down("move", 1, { x: 200, y: 200 });
      const radians = (degrees * Math.PI) / 180;
      state.move(1, { x: 200 + 40 * Math.cos(radians), y: 200 - 40 * Math.sin(radians) });
      const view = stickViews(layout, state).move!;
      const knob = knobCentre(view.knob);
      // The knob's centre pixel within the ring's frame, at that pixel's centre.
      const inFrame = { x: knob.x - view.ring.x + 0.5, y: knob.y - view.ring.y + 0.5 };
      for (const marker of MOVE_MARKERS) {
        expect(toPath(inFrame, marker) - MARKER_INK_WIDTH / 2).toBeGreaterThanOrEqual(
          KNOB_OUTER_RADIUS,
        );
      }
    },
  );

  it("draws partial deflection in proportion and full deflection at the derived reach", () => {
    const at = (strength: number) => {
      const state = new ControlState();
      state.down("move", 1, { x: 100, y: 100 });
      state.move(1, { x: 100 + 2.4 + strength * 17.6, y: 100 });
      return knobCentre(stickViews(layout, state).move!.knob).x - 100;
    };
    expect(MOVE_KNOB_REACH).toBe(11);
    expect(at(1)).toBe(MOVE_KNOB_REACH);
    expect(at(0.5)).toBe(Math.round(MOVE_KNOB_REACH / 2));
  });
});

describe("speed line", () => {
  // Where the line ends, in the view: its frame's centre pixel plus the offset.
  const lineEnd = (line: { at: { x: number; y: number }; offset: { x: number; y: number } }) => ({
    x: line.at.x + (SPEED_LINE_FRAME - 1) / 2 + line.offset.x,
    y: line.at.y + (SPEED_LINE_FRAME - 1) / 2 + line.offset.y,
  });

  it("is absent at rest and inside the dead zone", () => {
    const state = new ControlState();
    expect(stickViews(layout, state).move?.line).toBeUndefined();
    expect(stickViews(layout, state).aim?.line).toBeUndefined();
    state.down("move", 1, { x: 100, y: 100 });
    state.move(1, { x: 101, y: 100 });
    expect(stickViews(layout, state).move?.line).toBeUndefined();
    expect(speedLineLayers(TOUCH_CHROME_COLOURS, { x: 0, y: 0 })).toEqual([]);
  });

  it.each([0.25, 0.5, 1])("ends at the move knob's centre at %s deflection", (strength) => {
    const state = new ControlState();
    state.down("move", 1, { x: 100, y: 100 });
    state.move(1, { x: 100 + 2.4 + strength * 17.6, y: 100 });
    const view = stickViews(layout, state).move!;
    expect(lineEnd(view.line!)).toEqual(knobCentre(view.knob));
    expect(view.line!.at).toEqual(centredAt({ x: 100, y: 100 }, SPEED_LINE_FRAME));
  });

  it("ends at the aim knob's centre", () => {
    const state = new ControlState();
    state.down("aim", 2, { x: 500, y: 100 });
    state.move(2, { x: 490, y: 92 });
    const view = stickViews(layout, state).aim!;
    expect(lineEnd(view.line!)).toEqual(knobCentre(view.knob));
  });

  it("lies over the ring and under the knob", () => {
    expect(STICK_DEPTHS.ring).toBeLessThan(STICK_DEPTHS.line);
    expect(STICK_DEPTHS.line).toBeLessThan(STICK_DEPTHS.knob);
  });

  it("draws a cream core with an ink fringe on each side, fitting its frame", () => {
    const centre = SPEED_LINE_FRAME / 2;
    const layers = speedLineLayers(TOUCH_CHROME_COLOURS, { x: 12, y: 0 });
    const cream = [234, 212, 170, 255];
    const ink = [24, 20, 37, 255];
    expect(touchChromePixel(layers, { x: centre + 6, y: centre })).toEqual(cream);
    expect(touchChromePixel(layers, { x: centre + 6, y: centre + 1.5 })).toEqual(ink);
    expect(touchChromePixel(layers, { x: centre + 6, y: centre - 1.5 })).toEqual(ink);
    expect(touchChromePixel(layers, { x: centre + 6, y: centre + 2.5 })[3]).toBe(0);
    expect(centre + 12 + 2).toBeLessThanOrEqual(SPEED_LINE_FRAME);
  });
});
