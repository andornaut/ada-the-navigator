import type { Vec } from "./types.ts";

/**
 * Art's ship nose (art/ship.md): the hull's forward vertex, plan (-100, 0) at scale 0.32, sits
 * `forward` ship units ahead of the pivot, at the 4-unit hull's mid-thickness `z`. Each of the 16
 * heading frames draws its 96-unit frame `display` px across, with the ship's own projection
 * `screen = ((x - y) sqrt 3 / 2, (x + y) / 2 - z)`.
 */
export const SHIP_NOSE = { display: 42, forward: 32, frame: 96, headings: 16, z: 2 } as const;

/** The heading frame a facing draws: `round(atan2(y, x) / (PI / 8))` modulo 16. */
export function shipHeading(facing: Vec): number {
  const { headings } = SHIP_NOSE;
  const index = Math.round(Math.atan2(facing.y, facing.x) / ((2 * Math.PI) / headings));
  return ((index % headings) + headings) % headings;
}

/** The nose's screen offset from the ship's centre in a heading frame, in logical px. */
export function noseScreenOffset(heading: number): Vec {
  const { display, forward, frame, headings, z } = SHIP_NOSE;
  const angle = (heading * 2 * Math.PI) / headings;
  const x = forward * Math.cos(angle);
  const y = forward * Math.sin(angle);
  const scale = display / frame;
  return { x: ((x - y) * Math.sqrt(3) * scale) / 2, y: ((x + y) / 2 - z) * scale };
}

/**
 * The world offset whose projection `P(x, y) = (x - y, (x + y) / 2)` lands on the drawn nose of
 * the heading frame the facing selects.
 */
export function noseOffset(facing: Vec): Vec {
  const screen = noseScreenOffset(shipHeading(facing));
  return { x: screen.y + screen.x / 2, y: screen.y - screen.x / 2 };
}

/** Where Ada's shots and beams leave: her ship's nose for its heading. */
export function nosePoint(facing: Vec, player: Vec): Vec {
  const offset = noseOffset(facing);
  return { x: player.x + offset.x, y: player.y + offset.y };
}
