import { describe, expect, it } from "vitest";

import { chartPoints, chartProjection, MAP_CARD, pickedPlace } from "./mapCard.ts";

const { chart, chartInset } = MAP_CARD;

describe("map chart", () => {
  it("projects the world as the flight does: x - y across, half x + y down", () => {
    expect(chartProjection({ x: 100, y: 0 })).toEqual({ x: 100, y: 50 });
    expect(chartProjection({ x: 0, y: 100 })).toEqual({ x: -100, y: 50 });
  });

  it("fits every point inside the chart less its inset, centred", () => {
    const points = chartPoints([
      { x: 0, y: 0 },
      { x: 20000, y: -5000 },
      { x: -8000, y: 12000 },
    ]);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(chartInset - 1e-9);
      expect(point.x).toBeLessThanOrEqual(chart.width - chartInset + 1e-9);
      expect(point.y).toBeGreaterThanOrEqual(chartInset - 1e-9);
      expect(point.y).toBeLessThanOrEqual(chart.height - chartInset + 1e-9);
    }
    const xs = points.map(({ x }) => x);
    const ys = points.map(({ y }) => y);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(chart.width / 2, 9);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(chart.height / 2, 9);
    // The tighter axis reaches the inset: one scale fills the room it can.
    const filled =
      Math.abs(Math.max(...xs) - Math.min(...xs) - (chart.width - 2 * chartInset)) < 1e-6 ||
      Math.abs(Math.max(...ys) - Math.min(...ys) - (chart.height - 2 * chartInset)) < 1e-6;
    expect(filled).toBe(true);
  });

  it("puts a lone point at the centre and keeps close points at the galaxy's scale", () => {
    expect(chartPoints([{ x: 300, y: 700 }])).toEqual([
      { x: chart.width / 2, y: chart.height / 2 },
    ]);
    const [a, b] = chartPoints([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(Math.hypot(b!.x - a!.x, b!.y - a!.y)).toBeLessThan(2);
    expect(chartPoints([])).toEqual([]);
  });

  it("picks the marker nearest a press within half the target, so close places stay reachable", () => {
    const markers = [
      { x: 100, y: 80 },
      { x: 110, y: 80 },
      { x: 200, y: 40 },
    ];
    // Overlapping press areas: each face's own centre picks it.
    expect(pickedPlace(markers, { x: 100, y: 80 })).toBe(0);
    expect(pickedPlace(markers, { x: 110, y: 80 })).toBe(1);
    expect(pickedPlace(markers, { x: 104, y: 81 })).toBe(0);
    expect(pickedPlace(markers, { x: 200, y: 40 + MAP_CARD.marker.target / 2 })).toBe(2);
    expect(pickedPlace(markers, { x: 200, y: 41 + MAP_CARD.marker.target / 2 })).toBeNull();
    expect(pickedPlace([], { x: 0, y: 0 })).toBeNull();
  });

  it("keeps each place's press area at the minimum target around a smaller face", () => {
    expect(MAP_CARD.marker.target).toBe(48);
    expect(MAP_CARD.marker.place).toBeLessThan(MAP_CARD.marker.target);
  });
});
