import { HIT_RULE } from "./hitAreas.ts";
import { SPACING } from "./tokens.ts";

// The pause menu's Map card, in logical px. Groups, a gap apart: the "{percent}% mapped" line,
// the chart, then the chosen place's name and its Travel here action. The chart draws the galaxy
// in the flight's own projection, fitted to the chart less its inset, with Ada and each place a
// marker at its position.
// CLEANUP (added 2026-11-11): Tech's provisional map from the shared card tokens until Art
// designs the map card; Art's layout replaces these values and the marker faces.
export const MAP_CARD = {
  chart: { height: 160, width: 288 },
  chartInset: 16,
  gap: SPACING.gap,
  // Drawn marker faces; each place's press area is the minimum target around its face.
  marker: { ada: 10, place: 12, ring: 2, target: HIT_RULE.minTarget },
  // How much world a chart shows at least, so a lone place or two close ones keep the galaxy's
  // scale rather than filling the chart.
  minimumSpan: 2000,
} as const;

export interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

// The flight's projection of a world position (src/game/scene.ts project): x - y across, half
// x + y down, so the map faces the way Ada flies.
export function chartProjection(world: ChartPoint): ChartPoint {
  return { x: world.x - world.y, y: (world.x + world.y) / 2 };
}

// Each world position's place on the chart, in logical px from its top-left: every projected
// point fitted inside the chart less its inset at one scale, centred, never showing less than
// minimumSpan of world across.
export function chartPoints(points: readonly ChartPoint[]): ChartPoint[] {
  const { chart, chartInset, minimumSpan } = MAP_CARD;
  const projected = points.map(chartProjection);
  if (projected.length === 0) {
    return [];
  }
  const xs = projected.map(({ x }) => x);
  const ys = projected.map(({ y }) => y);
  const span = {
    x: Math.max(Math.max(...xs) - Math.min(...xs), minimumSpan),
    y: Math.max(Math.max(...ys) - Math.min(...ys), minimumSpan / 2),
  };
  const room = { x: chart.width - 2 * chartInset, y: chart.height - 2 * chartInset };
  const scale = Math.min(room.x / span.x, room.y / span.y);
  const centre = {
    x: (Math.max(...xs) + Math.min(...xs)) / 2,
    y: (Math.max(...ys) + Math.min(...ys)) / 2,
  };
  return projected.map(({ x, y }) => ({
    x: chart.width / 2 + (x - centre.x) * scale,
    y: chart.height / 2 + (y - centre.y) * scale,
  }));
}

// The place a press on the chart picks: the one whose marker centre is nearest the press, within
// half the minimum target, so close places' overlapping press areas never hide one another.
export function pickedPlace(markers: readonly ChartPoint[], press: ChartPoint): number | null {
  let best: number | null = null;
  let bestDistance = MAP_CARD.marker.target / 2;
  markers.forEach((marker, index) => {
    const distance = Math.hypot(marker.x - press.x, marker.y - press.y);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}
