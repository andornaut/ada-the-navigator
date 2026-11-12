import type { Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { SHIP_NOSE } from "../../model/nose.ts";
import { NO_INSETS } from "./playView.ts";
import {
  pathStamps,
  restingTangent,
  ROUTE_ARC,
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
  it("places the panel, capture, text, Earth and Jump as Art's table at 720x360, with no close X", () => {
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
    expect(Object.keys(plain)).not.toContain("close");
  });

  it("keeps every rect in the available rect, the end labels 15 and 12 above the panel", () => {
    // Markers 1 and 6 sit lowest on the arc, so their label pills end lowest, at 161.
    const labelBottoms = ROUTE_MAP.centres.map(
      ({ y }) => y + ROUTE_MAP.label.top + ROUTE_MAP.label.height,
    );
    expect(labelBottoms[0]).toBeCloseTo(161, 9);
    expect(labelBottoms[5]).toBeCloseTo(161, 9);
    expect(Math.max(...labelBottoms)).toBeCloseTo(161, 9);
    for (const [insets, gap] of [
      [NO_INSETS, 15],
      [PHONE, 12],
    ] as const) {
      const rects = routeMapRects(insets, BASE);
      for (const rect of [rects.panel, rects.earth, rects.jump, ...rects.markers]) {
        expect(inside(rects.available, rect)).toBe(true);
      }
      expect(rects.panel.y - Math.max(...labelBottoms)).toBeCloseTo(gap, 9);
      expect(gap).toBeGreaterThanOrEqual(SPACING.gap);
    }
  });

  it("keeps marker press areas apart from each other", () => {
    for (const insets of [NO_INSETS, PHONE]) {
      const { markers } = routeMapRects(insets, BASE);
      const overlap = (a: Rect, b: Rect) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      for (const [index, marker] of markers.entries()) {
        for (const other of markers.slice(index + 1)) {
          expect(overlap(marker, other)).toBe(false);
        }
      }
    }
  });
});

describe("route arc", () => {
  it("draws the circle through markers 1 and 6 whose top is (360, 46)", () => {
    expect(ROUTE_ARC.radius).toBeCloseTo(496.53, 2);
    expect(ROUTE_ARC.centre.x).toBe(360);
    expect(ROUTE_ARC.centre.y).toBeCloseTo(542.53, 2);
    expect(ROUTE_ARC.centre.y - ROUTE_ARC.radius).toBeCloseTo(46, 9);
    expect((-ROUTE_ARC.first * 180) / Math.PI).toBeCloseTo(32.12, 2);
    expect((ROUTE_ARC.step * 180) / Math.PI).toBeCloseTo(12.85, 2);
  });

  it("puts the six markers left to right along it at equal angles, as Art's table", () => {
    const art = [
      [96, 122],
      [196.12, 73.82],
      [304.45, 49.12],
      [415.55, 49.12],
      [523.88, 73.82],
      [624, 122],
    ];
    for (const [index, { x, y }] of ROUTE_MAP.centres.entries()) {
      expect(x).toBeCloseTo(art[index]![0]!, 2);
      expect(y).toBeCloseTo(art[index]![1]!, 2);
      expect(Math.hypot(x - ROUTE_ARC.centre.x, y - ROUTE_ARC.centre.y)).toBeCloseTo(
        ROUTE_ARC.radius,
        9,
      );
    }
    const lefts = ROUTE_MAP.centres.map(({ x }) => x);
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
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

  it("follows the arc, each leg 111.34 long, longer than its 111.1 chord", () => {
    expect(routeDistance(1)).toBe(0);
    expect(routeDistance(2)).toBeCloseTo(111.34, 2);
    expect(routeDistance(5) - routeDistance(2)).toBeCloseTo(334.02, 2);
    expect(routeDistance(6)).toBeCloseTo(ROUTE_ARC.radius * ROUTE_ARC.step * 5, 3);
    const [first, second] = ROUTE_MAP.centres;
    expect(Math.hypot(second!.x - first!.x, second!.y - first!.y)).toBeCloseTo(111.1, 1);
  });
});

describe("route moves", () => {
  it("moves the ship at 360 px/s, clamped to 0.3 to 0.9 s: one leg in 0.309 s", () => {
    expect([50, 111.34, 530].map(selectionSeconds)).toEqual([0.3, 111.34 / 360, 0.9]);
    expect(selectionSeconds(routeDistance(2))).toBeCloseTo(0.309, 3);
  });

  it("flies an unlock's trip at clamp(length / 180, 0.8, 2.0) s by its whole arc length", () => {
    const legs = (count: number) => routeDistance((1 + count) as 2 | 3 | 4 | 5 | 6);
    // One leg flies the 0.8 s floor; two legs, 222.68 px, fly 1.237 s, not two floors.
    expect(unlockFlightSeconds(legs(1))).toBe(0.8);
    expect(unlockFlightSeconds(legs(2))).toBeCloseTo(1.237, 3);
    expect(unlockFlightSeconds(359)).toBeLessThan(2);
    expect([360, legs(4), legs(5)].map(unlockFlightSeconds)).toEqual([2, 2, 2]);
  });

  it("arrives 400 ms after the flight starts its departure: Sunflower to Whirlpool at 1200 ms", () => {
    expect(unlockSeconds(1, 2)).toBeCloseTo(1.2, 9);
    // Whirlpool to Cartwheel, three legs of 334.02: 1856 ms of flight, arrival at 2256 ms.
    expect(unlockFlightSeconds(routeDistance(5) - routeDistance(2))).toBeCloseTo(1.856, 3);
    expect(unlockSeconds(2, 5)).toBeCloseTo(2.256, 3);
    expect(unlockSeconds(1, 6)).toBe(2.4);
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
    const positions = [1, 2, 3, 4, 5, 6] as const;
    // The arc runs right throughout, rising to its top between galaxies 3 and 4, then falling.
    expect(positions.map((position) => restingTangent(position).x > 0)).toEqual(
      positions.map(() => true),
    );
    expect(positions.map((position) => Math.sign(restingTangent(position).y))).toEqual([
      -1, -1, -1, 1, 1, 1,
    ]);
    // Galaxy 6 faces along the circle's tangent at its own centre, the incoming leg's end.
    const end = restingTangent(6);
    const angle = ROUTE_ARC.first + 5 * ROUTE_ARC.step;
    expect(Math.atan2(end.y, end.x)).toBeCloseTo(angle, 2);
    expect(positions.map((position) => routeHeading(restingTangent(position)))).toEqual([
      24, 25, 27, 29, 31, 0,
    ]);
  });
});
