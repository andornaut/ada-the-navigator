import { describe, expect, it } from "vitest";

import { ControlState, MOVE_STICK_GEOMETRY } from "../input/state.ts";
import { NO_INSETS } from "./layout/playView.ts";
import { centredAt, MARKER_THRESHOLD, STICK_DEPTHS, stickViews } from "./sticks.ts";
import {
  KNOB_OUTER_RADIUS,
  MARKER_INK_WIDTH,
  MOVE_KNOB_REACH,
  MOVE_MARKERS,
  SPEED_LINE_CAP,
  SPEED_LINE_CAPSULE,
  speedLineLayers,
  speedLinePlacement,
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
// Move travel for a deflection: past the dead zone, a share of the remaining reach.
const travel = (strength: number) =>
  MOVE_STICK_GEOMETRY.deadZone +
  strength * (MOVE_STICK_GEOMETRY.reach - MOVE_STICK_GEOMETRY.deadZone);
const knobCentre = (point: { x: number; y: number }) => ({
  x: point.x + (TOUCH_KNOB_FRAME - 1) / 2,
  y: point.y + (TOUCH_KNOB_FRAME - 1) / 2,
});

describe("joystick placement", () => {
  it("rests both same-sized rings on the safe edges, mirrored across the view", () => {
    const views = stickViews(layout, new ControlState());
    expect(views.move?.ring).toEqual(centredAt({ x: 60, y: 299 }, TOUCH_CHROME_FRAME));
    expect(views.aim?.ring).toEqual(centredAt({ x: 659, y: 299 }, TOUCH_CHROME_FRAME));
    expect(views.move?.ringPose).toBe("rest");
    expect(views.move?.knobPose).toBe("rest");
    expect(knobCentre(views.move!.knob)).toEqual({ x: 60, y: 299 });
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
      state.down("move", 1, { x: 100, y: 100 });
      state.move(1, { x: 100 + travel(strength), y: 100 });
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
      state.move(1, { x: 200 + 80 * Math.cos(radians), y: 200 - 80 * Math.sin(radians) });
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
      state.move(1, { x: 100 + travel(strength), y: 100 });
      return knobCentre(stickViews(layout, state).move!.knob).x - 100;
    };
    expect(MOVE_KNOB_REACH).toBe(11);
    expect(at(1)).toBe(MOVE_KNOB_REACH);
    expect(at(0.5)).toBe(Math.round(MOVE_KNOB_REACH / 2));
  });
});

describe("speed line", () => {
  it("is absent at rest and present once the thumb leaves the origin", () => {
    const state = new ControlState();
    expect(stickViews(layout, state).move?.line).toBeUndefined();
    expect(stickViews(layout, state).aim?.line).toBeUndefined();
    state.down("move", 1, { x: 100, y: 100 });
    expect(stickViews(layout, state).move?.line).toBeUndefined();
    state.move(1, { x: 101, y: 100 });
    expect(stickViews(layout, state).move?.line).toEqual({
      from: { x: 100, y: 100 },
      to: { x: 101, y: 100 },
    });
  });

  it.each([0.5, 1, 3])(
    "runs from the move origin to the thumb at %s of full reach, unclamped",
    (share) => {
      const state = new ControlState();
      state.down("move", 1, { x: 100, y: 100 });
      const thumb = { x: 100 + share * MOVE_STICK_GEOMETRY.reach, y: 100 };
      state.move(1, thumb);
      const view = stickViews(layout, state).move!;
      expect(view.line).toEqual({ from: { x: 100, y: 100 }, to: thumb });
      // The drawn knob stays inside the ring while the line follows the thumb past it.
      expect(knobCentre(view.knob).x - 100).toBeLessThanOrEqual(MOVE_KNOB_REACH);
      expect(speedLinePlacement(view.line!).length).toBe(share * MOVE_STICK_GEOMETRY.reach);
    },
  );

  it("runs from the aim origin to the thumb, past the ring's edge", () => {
    const state = new ControlState();
    state.down("aim", 2, { x: 500, y: 100 });
    state.move(2, { x: 400, y: 160 });
    const view = stickViews(layout, state).aim!;
    expect(view.line).toEqual({ from: { x: 500, y: 100 }, to: { x: 400, y: 160 } });
    const placement = speedLinePlacement(view.line!);
    expect(placement.length).toBeGreaterThan(TOUCH_CHROME_FRAME / 2);
    expect(placement.angle).toBeCloseTo(Math.atan2(60, -100), 12);
    expect(knobCentre(view.knob)).not.toEqual({ x: 400, y: 160 });
  });

  it("lies over the ring and under the knob", () => {
    expect(STICK_DEPTHS.ring).toBeLessThan(STICK_DEPTHS.line);
    expect(STICK_DEPTHS.line).toBeLessThan(STICK_DEPTHS.knob);
  });

  it("draws a cream core with an ink fringe on each side and round caps", () => {
    const layers = speedLineLayers(TOUCH_CHROME_COLOURS);
    const cream = [234, 212, 170, 255];
    const ink = [24, 20, 37, 255];
    const mid = { x: SPEED_LINE_CAPSULE.width / 2, y: SPEED_LINE_CAP };
    expect(touchChromePixel(layers, mid)).toEqual(cream);
    expect(touchChromePixel(layers, { x: mid.x, y: mid.y + 1.5 })).toEqual(ink);
    expect(touchChromePixel(layers, { x: mid.x, y: mid.y - 1.5 })).toEqual(ink);
    // The capsule's corners lie outside the round caps.
    expect(touchChromePixel(layers, { x: 0.25, y: 0.25 })[3]).toBe(0);
    expect(SPEED_LINE_CAPSULE).toEqual({ height: 4, width: 6 });
  });
});
