import type { Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { SHIP_NOSE } from "../../model/nose.ts";
import { NO_INSETS } from "./playView.ts";
import {
  pathStamps,
  restingTangent,
  ROUTE_LEGS,
  ROUTE_MAP,
  routeDistance,
  routeHeading,
  routeMapRects,
  selectionSeconds,
  unlockFlightSeconds,
  unlockSeconds,
} from "./routeMap.ts";
import { SPACING } from "./tokens.ts";

const BASE = { height: 360, width: 720 };
const PHONE = { bottom: 19, left: 43, right: 43, top: 0 };
const box = ({ height, width, x, y }: Rect) => [x, y, width, height];
const inside = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width + 1e-9 &&
  inner.y + inner.height <= outer.y + outer.height + 1e-9;

describe("route map layout", () => {
  it("places the panel, capture, text, Earth, Jump and close X as Art's table at 720x360", () => {
    const plain = routeMapRects(NO_INSETS, BASE);
    const phone = routeMapRects(PHONE, BASE);
    expect([plain, phone].map((rects) => box(rects.available))).toEqual([
      [16, 16, 688, 328],
      [43, 16, 634, 325],
    ]);
    expect([plain, phone].map((rects) => box(rects.panel))).toEqual([
      [53, 176, 614, 112],
      [53, 173, 614, 112],
    ]);
    expect([plain, phone].map((rects) => box(rects.capture))).toEqual([
      [61, 184, 182, 92],
      [61, 181, 182, 92],
    ]);
    expect([plain, phone].map(({ text }) => [text.x, text.y, text.width])).toEqual([
      [255, 184, 404],
      [255, 181, 404],
    ]);
    expect([plain, phone].map(({ earth, jump }) => [box(earth), box(jump)])).toEqual([
      [
        [160, 296, 192, 48],
        [368, 296, 192, 48],
      ],
      [
        [160, 293, 192, 48],
        [368, 293, 192, 48],
      ],
    ]);
    expect([plain, phone].map(({ close }) => [box(close.target), box(close.face)])).toEqual([
      [
        [672, 0, 48, 48],
        [684, 12, 24, 24],
      ],
      [
        [641, 0, 48, 48],
        [653, 12, 24, 24],
      ],
    ]);
  });

  it("puts the close face on the HUD rect's corner at 844x390 with phone insets", () => {
    const view = { height: 360, width: (844 * 360) / 390 };
    expect(routeMapRects(PHONE, view).close.face.x).toBeCloseTo(712.08, 2);
  });

  it("keeps every rect in the available rect, the row 2 labels a gap above the panel", () => {
    for (const insets of [NO_INSETS, PHONE]) {
      const rects = routeMapRects(insets, BASE);
      for (const rect of [rects.panel, rects.earth, rects.jump, ...rects.markers]) {
        expect(inside(rects.available, rect)).toBe(true);
      }
      const labelBottom = ROUTE_MAP.centres[3]!.y + ROUTE_MAP.label.top + ROUTE_MAP.label.height;
      expect(rects.panel.y - labelBottom).toBeGreaterThanOrEqual(SPACING.gap);
    }
  });

  it("keeps marker press areas apart from each other and from the close target", () => {
    for (const insets of [NO_INSETS, PHONE]) {
      const { close, markers } = routeMapRects(insets, BASE);
      const overlap = (a: Rect, b: Rect) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      for (const [index, marker] of markers.entries()) {
        expect(overlap(marker, close.target)).toBe(false);
        for (const other of markers.slice(index + 1)) {
          expect(overlap(marker, other)).toBe(false);
        }
      }
    }
  });
});

describe("route legs", () => {
  it("stops each leg 15 from both centres and dashes a locked one 6 on and 4 off", () => {
    const leg = ROUTE_LEGS[0]!;
    const open = pathStamps(0.5, ROUTE_MAP.path.open, ROUTE_MAP.path.trim, leg);
    const locked = pathStamps(0.5, ROUTE_MAP.path.locked, ROUTE_MAP.path.trim, leg);
    const centre = (stamp: Rect) => ({
      x: stamp.x + stamp.width / 2,
      y: stamp.y + stamp.height / 2,
    });
    for (const stamp of open) {
      for (const end of [leg.from, leg.to]) {
        const { x, y } = centre(stamp);
        expect(Math.hypot(x - end.x, y - end.y)).toBeGreaterThan(ROUTE_MAP.path.trim - 1);
      }
    }
    expect(open.every(({ width }) => width === 4)).toBe(true);
    expect(locked.every(({ width }) => width === 2)).toBe(true);
    expect(locked.every(({ distance }) => distance % 10 <= 6)).toBe(true);
    expect(locked.length).toBeLessThan(open.length);
  });

  it("bends the legs alternately, so the row legs are a little longer than their chords", () => {
    expect(routeDistance(2)).toBeCloseTo(229, 0);
    expect(routeDistance(5) - routeDistance(2)).toBeCloseTo(530, -1);
  });
});

describe("route moves", () => {
  it("moves the ship at 360 px/s, clamped to 0.3 to 0.9 s", () => {
    expect([50, 229, 530].map(selectionSeconds)).toEqual([0.3, 229 / 360, 0.9]);
  });

  it("arrives from Sunflower at Whirlpool at 1672 ms: 400 ms, then 229 px at 180 px/s", () => {
    expect(unlockSeconds(1, 2)).toBeCloseTo(1.672, 2);
  });

  it("flies one unlock opening several galaxies in at most 2.4 s in all, Whirlpool to Cartwheel", () => {
    // Three legs at 180 px/s would take 2.94 s of flight; the legs speed up to fit.
    expect((routeDistance(5) - routeDistance(2)) / 180).toBeGreaterThan(2);
    expect(unlockSeconds(2, 5)).toBe(2.4);
    expect(unlockFlightSeconds(10)).toBe(0.8);
  });
});

describe("route ship", () => {
  it("draws the heading whose nose angle is nearest the direction", () => {
    for (const [heading, { x, y }] of SHIP_NOSE.noses.entries()) {
      const half = SHIP_NOSE.frame / 2;
      expect(routeHeading({ x: x - half, y: y - half })).toBe(heading);
    }
  });

  it("rests facing the outgoing leg, and at galaxy 6 the incoming leg's end", () => {
    // Row 1 runs right; row 2 runs left on screen.
    expect(restingTangent(1).x).toBeGreaterThan(0);
    expect(restingTangent(5).x).toBeLessThan(0);
    expect(restingTangent(6).x).toBeLessThan(0);
    // Galaxy 3's leg runs down to galaxy 4.
    expect(restingTangent(3).y).toBeGreaterThan(0);
  });
});
