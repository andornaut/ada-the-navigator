import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { EDGE_MARKERS } from "../../data/edgeMarkers.ts";
import { edgePoint, gameAreaPoint } from "../../model/edgeMarkers.ts";
import type { TargetMarker } from "../../model/targetMarkers.ts";
import type { Vec } from "../../model/types.ts";
export interface TargetMarkerPlacement<T extends TargetMarker = TargetMarker> {
  /** The displayed centre is the ship-to-target ray intersection, including under the HUD. */
  readonly anchor: Vec;
  readonly at: Vec;
  readonly crowded: boolean;
  readonly target: T;
}
export interface TargetMarkerExtent {
  readonly height: number;
  readonly width: number;
  readonly offset?: Vec;
}
export interface TargetMarkerLayout<T extends TargetMarker = TargetMarker> {
  readonly area: Rect;
  /** Actual HUD and dialogue footprints, in the same logical coordinates as area. */
  readonly blocked: readonly Rect[];
  /** Rendered visible bounds, including an emitted outline, in current logical units. */
  readonly extent: (target: T) => TargetMarkerExtent;
  readonly gap: number;
  readonly player: Vec;
  /**
   * The device pixel grid: area px v lie on a device pixel edge where origin + v * scale is whole
   * on that axis, in the frame's axes (frameDeviceOrigin); scale is device px per area px.
   */
  readonly raster?: {
    readonly origin: Vec;
    readonly scale: number;
  };
}
// Device px within which an edge counts as on the grid already, against float error.
const EPSILON = 1e-6;
const bounds = (size: TargetMarkerExtent, at: Vec): Rect => ({
  height: size.height,
  width: size.width,
  x: at.x + (size.offset?.x ?? 0) - size.width / 2,
  y: at.y + (size.offset?.y ?? 0) - size.height / 2,
});
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
/** Overlap is diagnostic only: it never changes a target's displayed bearing. */
export function layoutTargetMarkers<T extends TargetMarker>(
  context: TargetMarkerLayout<T>,
  markers: readonly T[],
): TargetMarkerPlacement<T>[] {
  const { area } = context;
  const placed: Rect[] = [];
  // Move each edge of the marker rect inward to the nearest device pixel edge, then intersect the
  // ray; never round its axes separately. EPSILON keeps an edge already on the grid in place.
  const snap = (axis: "x" | "y", value: number, high: boolean): number => {
    const raster = context.raster;
    if (!raster) {
      return value;
    }
    const device = raster.origin[axis] + value * raster.scale;
    const aligned = high ? Math.floor(device + EPSILON) : Math.ceil(device - EPSILON);
    return (aligned - raster.origin[axis]) / raster.scale;
  };
  const left = snap("x", area.x + EDGE_MARKERS.gap, false);
  const top = snap("y", area.y + EDGE_MARKERS.gap, false);
  const right = snap("x", area.x + area.width - EDGE_MARKERS.gap, true);
  const bottom = snap("y", area.y + area.height - EDGE_MARKERS.gap, true);
  const centre = gameAreaPoint(context.player, context.player);
  return [...markers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((target) => {
      const size = context.extent(target);
      if (!(size.width > 0 && size.height > 0) || !Number.isFinite(size.width + size.height)) {
        throw new RangeError("Invalid visible target marker extent");
      }
      const offset = size.offset ?? { x: 0, y: 0 };
      const rect = {
        height: Math.max(0, bottom - top - size.height),
        width: Math.max(0, right - left - size.width),
        x: left + size.width / 2 - offset.x,
        y: top + size.height / 2 - offset.y,
      };
      const destination = gameAreaPoint(context.player, target);
      const anchor = edgePoint(rect, 0, centre, destination);
      const box = bounds(size, anchor);
      const crowded = [...context.blocked, ...placed].some((other) => overlaps(box, other));
      placed.push(box);
      return { anchor, at: anchor, crowded, target };
    });
}
