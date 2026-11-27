import { clamp } from "@andornaut/game-kit/runtime/numbers";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { EDGE_MARKERS } from "../../data/edgeMarkers.ts";
import { edgePoint, gameAreaPoint } from "../../model/edgeMarkers.ts";
import type { TargetMarker } from "../../model/targetMarkers.ts";
import type { Vec } from "../../model/types.ts";
/** Optional presentation fields on the same registry marker. */
export interface PresentedTargetMarker extends TargetMarker {
  readonly onScreen?: boolean;
  readonly trackedLabel?: string;
}

export interface TargetMarkerPlacement<T extends TargetMarker = TargetMarker> {
  /** The preferred centre before tracked-only HUD clearance. */
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
/** Translate occupied HUD ink to the range of marker centres it rules out. */
function blockedCentres(size: TargetMarkerExtent, gap: number, blocked: readonly Rect[]): Rect[] {
  const offset = size.offset ?? { x: 0, y: 0 };
  return blocked.map((box) => ({
    height: box.height + size.height + 2 * gap,
    width: box.width + size.width + 2 * gap,
    x: box.x - offset.x - size.width / 2 - gap,
    y: box.y - offset.y - size.height / 2 - gap,
  }));
}

function rayInterval(start: number, delta: number, low: number, high: number): [number, number] {
  if (delta === 0) {
    return start > low && start < high ? [-Infinity, Infinity] : [Infinity, -Infinity];
  }
  const a = (low - start) / delta;
  const b = (high - start) / delta;
  return [Math.min(a, b), Math.max(a, b)];
}

/** Keep the tracked glyph on the bearing when the ink at its edge anchor meets the HUD. */
function clearEdge(anchor: Vec, centre: Vec, blocked: readonly Rect[]): Vec {
  const delta = { x: centre.x - anchor.x, y: centre.y - anchor.y };
  const spans = blocked.map((box) => {
    const [nearX, farX] = rayInterval(anchor.x, delta.x, box.x, box.x + box.width);
    const [nearY, farY] = rayInterval(anchor.y, delta.y, box.y, box.y + box.height);
    return { end: Math.min(farX, farY), start: Math.max(nearX, nearY) };
  });
  spans.sort((a, b) => a.start - b.start);
  let at = 0;
  for (const { end, start } of spans) {
    if (start < at && end > at) {
      at = end;
    }
  }
  return at <= 1 ? { x: anchor.x + delta.x * at, y: anchor.y + delta.y * at } : anchor;
}

/** Prefer directly above the target, using the nearest clear position at or above that height. */
function clearAbove(anchor: Vec, rect: Rect, blocked: readonly Rect[]): Vec {
  const clear = (point: Vec) =>
    !blocked.some(
      (box) =>
        point.x > box.x &&
        point.x < box.x + box.width &&
        point.y > box.y &&
        point.y < box.y + box.height,
    );
  if (clear(anchor)) {
    return anchor;
  }
  const xs = [anchor.x, ...blocked.flatMap((box) => [box.x, box.x + box.width])];
  const ys = [anchor.y, ...blocked.map((box) => box.y)];
  let best = anchor;
  let distance = Infinity;
  for (const x of xs) {
    for (const y of ys) {
      const next = (x - anchor.x) ** 2 + (y - anchor.y) ** 2;
      if (
        next < distance &&
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= anchor.y &&
        clear({ x, y })
      ) {
        best = { x, y };
        distance = next;
      }
    }
  }
  return best;
}

/** Ordinary marker overlap remains diagnostic. Tracked ink also clears the known HUD. */
export function layoutTargetMarkers<T extends PresentedTargetMarker>(
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
      const tracked = target.identified && Boolean(target.trackedLabel);
      const inWorld = target.identified && target.onScreen === true;
      const anchor = inWorld
        ? {
            x: clamp(rect.x, rect.x + rect.width, destination.x),
            y: clamp(
              rect.y,
              rect.y + rect.height,
              destination.y - context.gap - size.height / 2 - offset.y,
            ),
          }
        : edgePoint(rect, 0, centre, destination);
      const blocked = tracked || inWorld ? blockedCentres(size, context.gap, context.blocked) : [];
      const at = !blocked.length
        ? anchor
        : inWorld
          ? clearAbove(anchor, rect, blocked)
          : clearEdge(anchor, centre, blocked);
      const box = bounds(size, at);
      const crowded = [...context.blocked, ...placed].some((other) => overlaps(box, other));
      placed.push(box);
      return { anchor, at, crowded, target };
    });
}
