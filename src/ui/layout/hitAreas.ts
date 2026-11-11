import { clamp } from "@andornaut/game-kit/numbers";
import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";

// Press areas (art/layout.md "Controls and targets"), as in Chibi's src/ui/layout/hitAreas.ts:
// a drawn control's press area reaches past it on every side by marginShare of its shorter side,
// never less than leastMargin or more than mostMargin, and is at least minTarget on each axis,
// grown evenly about its centre where it would be smaller. Logical px.
export const HIT_RULE = {
  leastMargin: 6,
  marginShare: 0.25,
  minTarget: 48,
  mostMargin: 16,
} as const;

// How far a drawn control's press area reaches past it on every side.
export function hitMargin(art: Rect): number {
  const { leastMargin, marginShare, mostMargin } = HIT_RULE;
  return clamp(leastMargin, mostMargin, marginShare * Math.min(art.width, art.height));
}

// A drawn control's press area: art grown by hitMargin on every side, then to minTarget on each
// axis where it is still smaller, about its centre.
export function hitAround(art: Rect): Rect {
  const margin = hitMargin(art);
  const grow = (start: number, size: number) => {
    const grown = size + 2 * margin;
    const side = Math.max(grown, HIT_RULE.minTarget);
    return { size: side, start: start - margin - (side - grown) / 2 };
  };
  const x = grow(art.x, art.width);
  const y = grow(art.y, art.height);
  return { height: y.size, width: x.size, x: x.start, y: y.start };
}

// A control on screen: what it is, where it is drawn, and its press area.
export interface PressArea<K> {
  readonly art: Rect;
  readonly hit: Rect;
  readonly key: K;
}

function distanceToCentre(art: Rect, point: Point): number {
  return Math.hypot(point.x - (art.x + art.width / 2), point.y - (art.y + art.height / 2));
}

// The control a press at point lands on: of those whose press area takes it in, the one whose
// drawn centre is nearest, so where two areas overlap the nearer control wins.
export function pressedArea<K>(areas: readonly PressArea<K>[], point: Point): K | undefined {
  let best: PressArea<K> | undefined;
  for (const area of areas) {
    if (
      containsPoint(area.hit, point.x, point.y) &&
      (best === undefined || distanceToCentre(area.art, point) < distanceToCentre(best.art, point))
    ) {
      best = area;
    }
  }
  return best?.key;
}
