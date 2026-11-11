import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CURRENTS } from "../data/galaxy-features.ts";
import { flowFraction } from "../model/currents.ts";
import {
  chevronStyle,
  laneCount,
  laneOffset,
  laneSpeed,
  readStreakSpec,
  rowOffset,
  streakMarks,
} from "./current-streaks.ts";

const spec = readStreakSpec(
  JSON.parse(
    readFileSync(new URL("../../public/art/whirlpool/currents.json", import.meta.url), "utf8"),
  ),
)!;
// A straight current along world +x, 1200 long and 400 wide.
const current = {
  length: 1200,
  points: [
    { x: 0, y: 0 },
    { x: 1200, y: 0 },
  ],
  stations: [0, 1200],
  width: 400,
};
const flow = (arc: number, offset: number) => flowFraction(current, arc, offset);

describe("current streaks", () => {
  it("reads Art's colour, minimum flow and reduced-motion time", () => {
    expect(spec.color).toBe("#296362");
    expect(spec.minFlow).toBe(0.06);
    expect(spec.reducedMotion.time).toBe(0);
    expect(readStreakSpec({ version: 1 })).toBeUndefined();
  });

  it("runs max(3, round(w / 46)) jittered lanes, rows every 64", () => {
    expect([100, 300, 400, 500].map((w) => laneCount(spec, w))).toEqual([3, 7, 9, 11]);
    // Lane j sits at -w/2 + (j + 0.5) w/n + 0.12 (w/n) (2 frac(0.618034 j) - 1).
    const n = laneCount(spec, 400);
    expect(laneOffset(spec, 400, 0)).toBeCloseTo(-200 + (0.5 * 400) / n - 0.12 * (400 / n), 9);
    const frac = (0.618034 * 3) % 1;
    expect(laneOffset(spec, 400, 3)).toBeCloseTo(
      -200 + (3.5 * 400) / n + 0.12 * (400 / n) * (2 * frac - 1),
      9,
    );
    expect(rowOffset(spec, 0)).toBe(0);
    expect(rowOffset(spec, 1)).toBeCloseTo(64 * (0.5 + 0.3 * 0.414214), 9);
  });

  it("scrolls each lane at 70 (1 - (2d / w)^2) and sizes chevrons by the flow", () => {
    expect(laneSpeed(CURRENTS.peakFlow, 400, 0)).toBe(70);
    expect(laneSpeed(CURRENTS.peakFlow, 400, 100)).toBeCloseTo(52.5, 9);
    expect(laneSpeed(CURRENTS.peakFlow, 400, 200)).toBe(0);
    expect(chevronStyle(spec, 0)).toEqual({ alpha: 0.3, reach: 6, width: 1.1 });
    const full = chevronStyle(spec, 1);
    expect(full.alpha).toBeCloseTo(1, 12);
    expect(full.reach).toBe(13);
    expect(full.width).toBeCloseTo(1.8, 12);
  });

  it("draws downstream chevrons only where the flow is above 0.06, within the path", () => {
    const marks = streakMarks(spec, current, CURRENTS.peakFlow, flow, 0, false);
    expect(marks.length).toBeGreaterThan(0);
    for (const { alpha, points } of marks) {
      const [back, tip, other] = points;
      expect(tip.x).toBeGreaterThan(back.x);
      expect(back.x).toBeCloseTo(other.x, 9);
      expect(alpha).toBeGreaterThan(0.3 + 0.7 * 0.06);
      expect(tip.x).toBeGreaterThanOrEqual(0);
      expect(tip.x).toBeLessThanOrEqual(1200 + 13);
    }
    // Arcs at the very ends have no flow, so no mark sits within 600 * 0.06 of either end.
    const arcs = marks.map(({ points }) => (points[1].x + points[0].x) / 2);
    expect(Math.min(...arcs)).toBeGreaterThan(600 * 0.06 - 13);
    expect(Math.max(...arcs)).toBeLessThan(1200 - 600 * 0.06 + 13);
  });

  it("keeps each chevron's shape and downstream heading across a bend", () => {
    // A right-angle bend: +x for 600, then +y for 600, at full flow everywhere.
    const bend = {
      length: 1200,
      points: [
        { x: 0, y: 0 },
        { x: 600, y: 0 },
        { x: 600, y: 600 },
      ],
      stations: [0, 600, 1200],
      width: 400,
    };
    const { reach } = chevronStyle(spec, 1);
    const arm = reach * Math.hypot(spec.chevron.tip + spec.chevron.back, 1);
    const marks = streakMarks(spec, bend, CURRENTS.peakFlow, () => 1, 0, false);
    // Some chevrons straddle the corner: their straight-current points fall on both legs.
    const straddling = marks.filter(({ points }) => {
      const centre = { x: (points[0].x + points[2].x) / 2, y: (points[0].y + points[2].y) / 2 };
      return Math.abs(centre.x - 600) < 200 + reach && Math.abs(centre.y) < 200 + reach;
    });
    expect(straddling.length).toBeGreaterThan(0);
    for (const { points } of marks) {
      const [back, tip, other] = points;
      expect(Math.hypot(tip.x - back.x, tip.y - back.y)).toBeCloseTo(arm, 9);
      expect(Math.hypot(tip.x - other.x, tip.y - other.y)).toBeCloseTo(arm, 9);
      expect(Math.hypot(back.x - other.x, back.y - other.y)).toBeCloseTo(2 * reach, 9);
      // The tip points along one leg's downstream direction, +x or +y.
      const mid = { x: (back.x + other.x) / 2, y: (back.y + other.y) / 2 };
      const heading = {
        x: (tip.x - mid.x) / ((spec.chevron.tip + spec.chevron.back) * reach),
        y: (tip.y - mid.y) / ((spec.chevron.tip + spec.chevron.back) * reach),
      };
      const downstream =
        Math.abs(heading.x - 1) < 1e-9 && Math.abs(heading.y) < 1e-9
          ? true
          : Math.abs(heading.y - 1) < 1e-9 && Math.abs(heading.x) < 1e-9;
      expect(downstream, JSON.stringify(heading)).toBe(true);
    }
  });

  it("moves marks with their lane's flow and holds the t = 0 frame under reduced motion", () => {
    const at = (seconds: number, reduced: boolean) =>
      streakMarks(spec, current, CURRENTS.peakFlow, flow, seconds, reduced).map(
        ({ points }) => points[1],
      );
    expect(at(2.5, true)).toEqual(at(0, false));
    expect(at(2.5, false)).not.toEqual(at(0, false));
    // After a full row spacing at the centre lane's speed the pattern repeats.
    const centre = laneSpeed(CURRENTS.peakFlow, 400, laneOffset(spec, 400, 4));
    const later = streakMarks(spec, current, CURRENTS.peakFlow, flow, 64 / centre, false);
    const now = streakMarks(spec, current, CURRENTS.peakFlow, flow, 0, false);
    const lane = (marks: typeof now) =>
      marks
        .filter(({ points }) => Math.abs(points[1].y - laneOffset(spec, 400, 4)) < 1e-6)
        .map(({ points }) => Math.round(points[1].x * 1e6) / 1e6);
    expect(lane(later)).toEqual(lane(now));
  });
});
