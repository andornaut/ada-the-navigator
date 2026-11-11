import art from "../../public/art/ship-nose.json" with { type: "json" };
import type { Vec } from "./types.ts";

/** Art draws Ada's ship in 32 heading frames (art/ship.md); enemy craft keep 16. */
export const SHIP_HEADINGS = 32;

/**
 * Art's ship-nose.json, version 1 (art/ship.md): the hull top's forward tip in frame px for
 * each heading, projected like the frames, and the display px per frame px.
 */
export interface ShipNose {
  readonly displayScale: number;
  readonly frame: number;
  readonly noses: readonly Vec[];
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A version 1 nose file with a point inside the frame for each of the 32 headings. */
export function readShipNose(value: unknown): ShipNose | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const { displayScale, frame, noses, version } = value as Record<string, unknown>;
  if (
    version !== 1 ||
    !finite(frame) ||
    !(frame > 0) ||
    !finite(displayScale) ||
    !(displayScale > 0) ||
    !Array.isArray(noses) ||
    noses.length !== SHIP_HEADINGS
  ) {
    return undefined;
  }
  const points: Vec[] = [];
  for (const point of noses as unknown[]) {
    if (!Array.isArray(point) || point.length !== 2) {
      return undefined;
    }
    const [x, y] = point as unknown[];
    if (!finite(x) || !finite(y) || x < 0 || y < 0 || x > frame || y > frame) {
      return undefined;
    }
    points.push({ x, y });
  }
  return { displayScale, frame, noses: points };
}

const shipped = readShipNose(art);
if (!shipped) {
  throw new Error("public/art/ship-nose.json must be version 1 with 32 noses inside the frame");
}
export const SHIP_NOSE: ShipNose = shipped;

/** The heading frame a facing draws: `round(atan2(y, x) / (PI / 16))` modulo 32. */
export function shipHeading(facing: Vec): number {
  const index = Math.round(Math.atan2(facing.y, facing.x) / ((2 * Math.PI) / SHIP_HEADINGS));
  return ((index % SHIP_HEADINGS) + SHIP_HEADINGS) % SHIP_HEADINGS;
}

/** The nose's screen offset from the ship's centre (the frame's pivot) in logical px. */
export function noseScreenOffset(heading: number): Vec {
  const { displayScale, frame, noses } = SHIP_NOSE;
  const point = noses[heading]!;
  const pivot = frame / 2;
  return { x: (point.x - pivot) * displayScale, y: (point.y - pivot) * displayScale };
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
