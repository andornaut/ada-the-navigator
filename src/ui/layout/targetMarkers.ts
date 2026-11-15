import type { Rect } from "@andornaut/game-kit/rect";

import { edgePoint, gameAreaPoint } from "../../model/edgeMarkers.ts";
import type { TargetMarker } from "../../model/targetMarkers.ts";
import type { Vec } from "../../model/types.ts";

export interface TargetMarkerPlacement {
  /** The actual direction is retained when collision layout displaces the badge. */
  readonly anchor: Vec;
  readonly at: Vec;
  readonly crowded: boolean;
  readonly target: TargetMarker;
}
export interface TargetMarkerLayout {
  readonly area: Rect;
  /** Actual HUD and dialogue footprints, in the same logical coordinates as area. */
  readonly blocked: readonly Rect[];
  readonly gap: number;
  readonly player: Vec;
  readonly size: number;
}
const bounds = (size: number, at: Vec): Rect => ({
  height: size,
  width: size,
  x: at.x - size / 2,
  y: at.y - size / 2,
});
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
function perimeter(rect: Rect, at: number): Vec {
  const length = 2 * (rect.width + rect.height);
  let position = ((at % length) + length) % length;
  if (position <= rect.width) {
    return { x: rect.x + position, y: rect.y };
  }
  position -= rect.width;
  if (position <= rect.height) {
    return { x: rect.x + rect.width, y: rect.y + position };
  }
  position -= rect.height;
  if (position <= rect.width) {
    return { x: rect.x + rect.width - position, y: rect.y + rect.height };
  }
  return { x: rect.x, y: rect.y + rect.height - (position - rect.width) };
}
function perimeterOffset(rect: Rect, point: Vec): number {
  const edges = [
    { distance: Math.abs(point.y - rect.y), offset: point.x - rect.x },
    { distance: Math.abs(point.x - rect.x - rect.width), offset: rect.width + point.y - rect.y },
    {
      distance: Math.abs(point.y - rect.y - rect.height),
      offset: rect.width + rect.height + rect.x + rect.width - point.x,
    },
    {
      distance: Math.abs(point.x - rect.x),
      offset: 2 * rect.width + rect.height + rect.y + rect.height - point.y,
    },
  ];
  return edges.sort((a, b) => a.distance - b.distance)[0]!.offset;
}

/** One placement per stable target, avoiding actual UI footprints rather than full-width bands. */
export function layoutTargetMarkers(
  context: TargetMarkerLayout,
  markers: readonly TargetMarker[],
): TargetMarkerPlacement[] {
  const { area, gap, size } = context;
  if (size <= 0 || gap < 0) {
    throw new RangeError("Invalid target marker dimensions");
  }
  const placed: Rect[] = [];
  const centre = gameAreaPoint(context.player, context.player);
  return [...markers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((target) => {
      const destination = gameAreaPoint(context.player, target);
      const anchor = edgePoint(area, size / 2, centre, destination);
      const candidates: Vec[] = [anchor];
      for (
        let inset = size / 2;
        2 * inset < Math.min(area.width, area.height);
        inset += size + gap
      ) {
        const rect = {
          height: area.height - 2 * inset,
          width: area.width - 2 * inset,
          x: area.x + inset,
          y: area.y + inset,
        };
        const initial = edgePoint(area, inset, centre, destination);
        const offset = perimeterOffset(rect, initial);
        const steps = Math.ceil((2 * (rect.width + rect.height)) / (size + gap));
        for (let step = 0; step <= steps; step++) {
          for (const sign of [1, -1]) {
            candidates.push(perimeter(rect, offset + sign * step * (size + gap)));
          }
        }
      }
      const clear = (at: Vec) => {
        const box = bounds(size, at);
        return (
          box.x >= area.x &&
          box.y >= area.y &&
          box.x + box.width <= area.x + area.width &&
          box.y + box.height <= area.y + area.height &&
          !context.blocked.some((block) => overlaps(box, block)) &&
          !placed.some((other) =>
            overlaps(
              {
                height: box.height + gap,
                width: box.width + gap,
                x: box.x - gap / 2,
                y: box.y - gap / 2,
              },
              other,
            ),
          )
        );
      };
      const at = candidates.find(clear);
      // Even a physically saturated viewport retains every target and its original direction.
      const placement = at ?? anchor;
      placed.push(bounds(size, placement));
      return { anchor, at: placement, crowded: at === undefined, target };
    });
}
