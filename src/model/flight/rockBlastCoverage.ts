import { scenerySilhouette } from "../asteroids.ts";
import { inside, toScreen } from "../convex.ts";
import { flightWorldContext } from "../flightTopology.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { segmentDistance, worldDelta } from "../worldContacts.ts";

/** Circle-to-frame coverage, including exact edge contact after projection and wrapping. */
export function blastCoversRock(
  frameOf: (flight: FlightState, object: SpaceObject) => number,
  flight: FlightState,
  radius: number,
  at: Vec,
  object: SpaceObject,
): boolean {
  const offset = toScreen(worldDelta(flightWorldContext(flight), object, at));
  const drawn = scenerySilhouette(object);
  // Nearest-image subtraction and projection can round a tangent just outside the edge.
  const reach = radius + 1e-9;
  if (Math.hypot(offset.x, offset.y) > (drawn?.reach ?? object.radius) + reach) {
    return false;
  }
  if (!drawn) {
    return coversFallbackRock(offset, object.radius, reach);
  }
  const frame = drawn.frames[frameOf(flight, object)] ?? drawn.frames[0]!;
  return frame.some(
    (part) =>
      inside(part, offset) ||
      part.some(
        (corner, index) =>
          segmentDistance(offset, corner, part[(index + 1) % part.length]!) <= reach,
      ),
  );
}

/** The nearest point on the legacy fallback drawing, an ellipse 70% as tall as it is wide. */
function coversFallbackRock(offset: Vec, widthRadius: number, blastRadius: number): boolean {
  const heightRadius = widthRadius * 0.7;
  if (widthRadius === 0 || Math.hypot(offset.x / widthRadius, offset.y / heightRadius) <= 1) {
    return true;
  }
  const a = widthRadius ** 2;
  const b = heightRadius ** 2;
  let low = 0;
  let high = widthRadius * Math.hypot(offset.x, offset.y);
  // Solve for the normal from the nearest point on the ellipse to the circle centre.
  for (let step = 0; step < 40; step++) {
    const t = (low + high) / 2;
    if (Math.hypot((widthRadius * offset.x) / (a + t), (heightRadius * offset.y) / (b + t)) > 1) {
      low = t;
    } else {
      high = t;
    }
  }
  return Math.hypot((offset.x * high) / (a + high), (offset.y * high) / (b + high)) <= blastRadius;
}
