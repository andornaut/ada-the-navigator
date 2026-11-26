import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  dartStep,
  dartStyle,
  laneCount,
  laneOffset,
  laneSpeed,
  markRadius,
  readStreakSpec,
  rowOffset,
  type StreakMark,
  streakMarks,
} from "../art/currentStreaks.ts";
import { CURRENTS } from "../data/galaxyFeatures.ts";
import { currentInCell, flowFraction } from "../model/currents.ts";

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

// Every pair of marks whose discs, centred between their back corners and the tip's frame
// centre and reaching their farthest point, meet.
function overlapping(marks: readonly StreakMark[]): string[] {
  const discs = marks.map(({ points }) => {
    const [back, tip, other] = points;
    const reach = Math.hypot(back.x - other.x, back.y - other.y) / 2;
    const mid = { x: (back.x + other.x) / 2, y: (back.y + other.y) / 2 };
    // The frame centre sits back * reach ahead of the back corners' midpoint, toward the tip.
    const toward = Math.hypot(tip.x - mid.x, tip.y - mid.y);
    const ahead = (spec.dart.back * reach) / toward;
    return {
      centre: { x: mid.x + (tip.x - mid.x) * ahead, y: mid.y + (tip.y - mid.y) * ahead },
      radius: markRadius(spec, reach),
    };
  });
  const pairs: string[] = [];
  discs.forEach((a, i) => {
    for (let j = i + 1; j < discs.length; j++) {
      const b = discs[j]!;
      const apart = Math.hypot(a.centre.x - b.centre.x, a.centre.y - b.centre.y);
      if (apart < a.radius + b.radius - 1e-6) {
        pairs.push(`${i} ${j} ${apart.toFixed(2)}`);
      }
    }
  });
  return pairs;
}

describe("current streaks", () => {
  it("reads Art's colour, minimum flow and reduced-motion time", () => {
    expect(spec.color).toBe("#296362");
    expect(spec.minFlow).toBe(0.06);
    expect(spec.reducedMotion.time).toBe(0);
    expect(readStreakSpec({ version: 1 })).toBeUndefined();
  });

  it("runs max(3, round(w / 56)) even lanes, rows every 72 with odd lanes half a row on", () => {
    expect([100, 300, 400, 500].map((w) => laneCount(spec, w))).toEqual([3, 5, 7, 9]);
    // Lane j sits at -w/2 + (j + 0.5) w/n.
    const n = laneCount(spec, 400);
    for (let lane = 0; lane < n; lane++) {
      expect(laneOffset(spec, 400, lane)).toBeCloseTo(-200 + ((lane + 0.5) * 400) / n, 9);
    }
    expect([0, 1, 2, 3].map((lane) => rowOffset(spec, lane))).toEqual([0, 36, 0, 36]);
  });

  it("scrolls each lane at 105 (1 - (2d / w)^2) and sizes darts in three flow steps", () => {
    expect(laneSpeed(CURRENTS.peakFlow, 400, 0)).toBe(105);
    expect(laneSpeed(CURRENTS.peakFlow, 400, 100)).toBeCloseTo(78.75, 9);
    expect(laneSpeed(CURRENTS.peakFlow, 400, 200)).toBe(0);
    expect([0.07, 0.339, 0.34, 0.669, 0.67, 1].map((f) => dartStep(spec, f))).toEqual([
      0.3, 0.3, 0.65, 0.65, 1, 1,
    ]);
    const styles = [0.1, 0.5, 0.9].map((f) => dartStyle(spec, f));
    expect(styles.map(({ reach }) => reach)).toEqual([
      expect.closeTo(8.1, 12),
      expect.closeTo(10.55, 12),
      13,
    ]);
    expect(styles.map(({ alpha }) => alpha)).toEqual([
      expect.closeTo(0.45, 12),
      expect.closeTo(0.625, 12),
      expect.closeTo(0.8, 12),
    ]);
  });

  it("draws filled downstream darts only where the flow is above 0.06, within the path", () => {
    const marks = streakMarks(spec, current, CURRENTS.peakFlow, flow, 0, false);
    expect(marks.length).toBeGreaterThan(0);
    for (const { alpha, points } of marks) {
      const [back, tip, other, notch] = points;
      expect(tip.x).toBeGreaterThan(back.x);
      expect(back.x).toBeCloseTo(other.x, 9);
      // The notch sits on the axis, 0.05 a behind the centre: between the back corners and tip.
      const reach = Math.abs(back.y - other.y) / 2;
      expect(notch.y).toBeCloseTo((back.y + other.y) / 2, 9);
      expect(tip.x - notch.x).toBeCloseTo(0.65 * reach, 9);
      expect([0.45, 0.625, 0.8].some((step) => Math.abs(alpha - step) < 1e-12)).toBe(true);
      expect(tip.x).toBeGreaterThanOrEqual(0);
      expect(tip.x).toBeLessThanOrEqual(1200 + 13);
    }
    // Arcs at the very ends have no flow, so no mark sits within 600 * 0.06 of either end.
    const arcs = marks.map(({ points }) => (points[1].x + points[0].x) / 2);
    expect(Math.min(...arcs)).toBeGreaterThan(600 * 0.06 - 13);
    expect(Math.max(...arcs)).toBeLessThan(1200 - 600 * 0.06 + 13);
  });

  it("keeps each dart's shape and turns its heading smoothly across a bend", () => {
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
    const { reach } = dartStyle(spec, 1);
    const arm = reach * Math.hypot(spec.dart.tip + spec.dart.back, 1);
    const marks = streakMarks(spec, bend, CURRENTS.peakFlow, () => 1, 0, false);
    // Some darts straddle the corner: their straight-current points fall on both legs.
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
      // The tip points downstream, between the legs' +x and +y, turning across the corner.
      const mid = { x: (back.x + other.x) / 2, y: (back.y + other.y) / 2 };
      const heading = {
        x: (tip.x - mid.x) / ((spec.dart.tip + spec.dart.back) * reach),
        y: (tip.y - mid.y) / ((spec.dart.tip + spec.dart.back) * reach),
      };
      expect(Math.hypot(heading.x, heading.y)).toBeCloseTo(1, 9);
      expect(Math.min(heading.x, heading.y), JSON.stringify(heading)).toBeGreaterThan(-1e-9);
    }
    // Some darts at the corner head between the two legs.
    const turning = marks.filter(({ points }) => {
      const [back, tip, other] = points;
      const mid = { x: (back.x + other.x) / 2, y: (back.y + other.y) / 2 };
      return tip.x - mid.x > 1 && tip.y - mid.y > 1;
    });
    expect(turning.length).toBeGreaterThan(0);
    expect(overlapping(marks)).toEqual([]);
  });

  it("never overlaps two marks on a seeded current's bends, at any time", () => {
    let checked = 0;
    for (let x = -4; x <= 4; x++) {
      for (let y = -4; y <= 4; y++) {
        const seeded = currentInCell(3, { x, y });
        if (!seeded) {
          continue;
        }
        const along = (arc: number, offset: number) => flowFraction(seeded, arc, offset);
        for (const [seconds, reduced] of [
          [0, true],
          [0.4, false],
          [1.3, false],
          [2.9, false],
        ] as const) {
          const marks = streakMarks(spec, seeded, CURRENTS.peakFlow, along, seconds, reduced);
          expect(overlapping(marks), `${seeded.id} at ${seconds}`).toEqual([]);
          checked += marks.length;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("follows a gentle bend with every lane's marks, culling none", () => {
    // A quarter turn of radius 1000 in 24 segments: wider than any lane's offset.
    const points = Array.from({ length: 25 }, (_, index) => {
      const angle = (index / 24) * (Math.PI / 2);
      return { x: 1000 * Math.sin(angle), y: 1000 - 1000 * Math.cos(angle) };
    });
    const stations = points.map((_, index) => (index * 1000 * Math.PI) / 48);
    const arc = { length: stations.at(-1)!, points, stations, width: 400 };
    const straight = {
      ...current,
      length: arc.length,
      points: [points[0]!, { x: arc.length, y: 0 }],
      stations: [0, arc.length],
    };
    const count = (shape: typeof arc) =>
      streakMarks(spec, shape, CURRENTS.peakFlow, () => 1, 0, false).length;
    expect(count(arc)).toBe(count(straight));
  });

  it("moves marks with their lane's flow and holds the t = 0 frame under reduced motion", () => {
    const at = (seconds: number, reduced: boolean) =>
      streakMarks(spec, current, CURRENTS.peakFlow, flow, seconds, reduced).map(
        ({ points }) => points[1],
      );
    expect(at(2.5, true)).toEqual(at(0, false));
    expect(at(2.5, false)).not.toEqual(at(0, false));
    // After a full row spacing at the centre lane's speed the pattern repeats.
    const centre = laneSpeed(CURRENTS.peakFlow, 400, laneOffset(spec, 400, 3));
    const later = streakMarks(spec, current, CURRENTS.peakFlow, flow, 72 / centre, false);
    const now = streakMarks(spec, current, CURRENTS.peakFlow, flow, 0, false);
    const lane = (marks: typeof now) =>
      marks
        .filter(({ points }) => Math.abs(points[1].y - laneOffset(spec, 400, 3)) < 1e-6)
        .map(({ points }) => Math.round(points[1].x * 1e6) / 1e6);
    expect(lane(later)).toEqual(lane(now));
  });
});
