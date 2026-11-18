import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { FrameTurn } from "@andornaut/game-kit/runtime/view/pagePoint";
import { FRAME_TURN_ATTRIBUTE } from "@andornaut/game-kit/runtime/web/view/frameTurn";

// The page frame's axes under its turn (game-kit frameTurn). getBoundingClientRect measures on the
// page, which a turn swaps: turned by 90, the frame's x runs down the page and its y from right to
// left; turned by -90, its x runs up the page and its y from left to right (game-kit pagePoint).

/** A box on the page, in client CSS px: a DOMRect's position and size. */
export interface PageBox {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/**
 * The turn the page frame shows now, from the attribute game-kit's watchFrameTurn keeps on root;
 * unturned without a root.
 */
export function readFrameTurn(root: Pick<Element, "getAttribute"> | undefined): FrameTurn {
  const turn = root?.getAttribute(FRAME_TURN_ATTRIBUTE);
  return turn === "90" ? 90 : turn === "-90" ? -90 : 0;
}

/** box, measured on the page, in host's frame CSS px from host's top-left corner. */
export function frameRect(turn: FrameTurn, host: PageBox, box: PageBox): Rect {
  if (turn === 90) {
    return {
      height: box.width,
      width: box.height,
      x: box.top - host.top,
      y: host.left + host.width - (box.left + box.width),
    };
  }
  if (turn === -90) {
    return {
      height: box.width,
      width: box.height,
      x: host.top + host.height - (box.top + box.height),
      y: box.left - host.left,
    };
  }
  return { height: box.height, width: box.width, x: box.left - host.left, y: box.top - host.top };
}

/**
 * The device pixel grid along host's frame axes: a frame offset v CSS px from host's top-left
 * corner lies on a device pixel edge where origin + v * devicePixelRatio is whole, on each axis.
 * An axis the turn runs against the page's counts from the opposite page edge, negated, which
 * keeps the grid and its direction.
 */
export function frameDeviceOrigin(turn: FrameTurn, host: PageBox, devicePixelRatio: number): Point {
  const along = (edge: number) => edge * devicePixelRatio;
  if (turn === 90) {
    return { x: along(host.top), y: -along(host.left + host.width) };
  }
  if (turn === -90) {
    return { x: -along(host.top + host.height), y: along(host.left) };
  }
  return { x: along(host.left), y: along(host.top) };
}
