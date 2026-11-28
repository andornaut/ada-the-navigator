import type { GameContent } from "../../data/types.ts";
import { worldFlowAt } from "../currents.ts";
import { carriesStardust } from "../drops.ts";
import { pickupOutline } from "../pickupBody.ts";
import type { FlightEvent, FlightState, SpaceObject, Vec } from "../types.ts";
import type { ShipTuning } from "../upgrades.ts";
import { canonicalPosition, flightWorldContext, worldDelta } from "../world/index.ts";
import { pickupTouched } from "./adaContactQueries.ts";

type TractorTuning = Pick<ShipTuning, "tractorRadius" | "tractorSpeed">;

/**
 * A pickup's motion over `dt`, alike for every kind (gameplay/rules.md): a current drifts it
 * until it leaves the current, and the tractor beam draws it toward Ada at its pull speed while
 * its centre lies within the pull radius of hers.
 */
export function carryPickup(
  ship: TractorTuning,
  dt: number,
  flight: FlightState,
  pickup: Vec,
): void {
  const drift = worldFlowAt(flightWorldContext(flight), flight.galaxy, pickup);
  pickup.x += drift.x * dt;
  pickup.y += drift.y * dt;
  canonicalPosition(flight, pickup);
  const delta = worldDelta(flightWorldContext(flight), pickup, flight.player);
  const gap = Math.hypot(delta.x, delta.y);
  if (gap > ship.tractorRadius || gap === 0) {
    return;
  }
  const step = Math.min(gap, ship.tractorSpeed * dt);
  pickup.x += (delta.x / gap) * step;
  pickup.y += (delta.y / gap) * step;
  canonicalPosition(flight, pickup);
}

export function stepPickup(
  content: GameContent,
  ship: TractorTuning,
  dt: number,
  flight: FlightState,
  events: FlightEvent[],
  object: SpaceObject,
): void {
  carryPickup(ship, dt, flight, object);
  if (!pickupTouched(content, flight, object, object.radius, pickupOutline(object))) {
    return;
  }
  // Collected at contact; the zip into the ship is the view's.
  events.push({ id: object.id, type: "collected", x: object.x, y: object.y });
  if (object.role === "cargo") {
    flight.cargo += object.amount ?? 1;
    object.hp = 0;
  } else if (carriesStardust(object)) {
    events.push({ amount: object.amount ?? 0, type: "stardust" });
    object.hp = 0;
  } else if (object.upgrade) {
    // The game chooses the gift from what Ada can use as she collects it.
    events.push({ id: object.id, type: "upgradeCollected" });
    object.hp = 0;
  } else if (object.ammoPack) {
    events.push({ id: object.id, type: "ammoCollected" });
    object.hp = 0;
  }
}
