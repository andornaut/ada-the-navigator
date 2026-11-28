import type { GameContent } from "../../data/types.ts";
import { outlinesContact, type Parts } from "../convex.ts";
import { shipBody, shipTouches, shipTouchesScreenCircle } from "../shipBody.ts";
import type { FlightState, Vec } from "../types.ts";
import { flightWorldContext, worldPoint } from "../world/index.ts";

export function touchesAda(flight: FlightState, point: Vec, radius: number): boolean {
  return shipTouches(
    flight.facing,
    flight.player,
    worldPoint(flightWorldContext(flight), flight.player, point),
    radius,
  );
}

/** Whether a blast circle of screen radius `radius` at `point` overlaps Ada as drawn. */
export function blastCoversAda(flight: FlightState, point: Vec, radius: number): boolean {
  return shipTouchesScreenCircle(
    flight.facing,
    flight.player,
    worldPoint(flightWorldContext(flight), flight.player, point),
    radius,
  );
}

/**
 * Whether Ada's drawn ship reaches a pickup at `center`, by the one pickup rule: within the
 * pickup margin, in world units on the world plane, between the ship's drawn body and the
 * pickup's drawn `outline`, or its circle of `radius`.
 */
export function pickupTouched(
  content: GameContent,
  flight: FlightState,
  center: Vec,
  radius: number,
  outline: Parts | null = null,
): boolean {
  const margin = content.tuning.flight.pickupMargin;
  return outline
    ? outlinesContact(
        outline,
        worldPoint(flightWorldContext(flight), flight.player, center),
        shipBody(flight.facing),
        flight.player,
        margin,
      ) !== null
    : touchesAda(flight, center, radius + margin);
}
