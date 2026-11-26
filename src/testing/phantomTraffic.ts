import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import type { FlightState } from "../model/types.ts";

/**
 * Test support: clears a Phantom flight's loaded objects down to the chapter's landmarks,
 * pickups and actors (blockade guards, wave and resolved ships, the pending batch, the flagship
 * and their escorts), so later steps do not simulate the generated rocks, ambient traffic and
 * debris around them.
 */
export function clearPhantomTraffic(flight: FlightState): void {
  const phantom = flight.phantom!;
  const required = new Set([
    PHANTOM_FLAGSHIP,
    ...phantom.enemyIds,
    ...phantom.resolvedIds,
    ...Object.values(phantom.blockades).flat(),
    ...(phantom.pendingEncounter?.actors ?? []).map(({ id }) => id),
  ]);
  flight.objects = flight.objects.filter(
    (object) =>
      object.kind === "destination" ||
      object.kind === "station" ||
      object.kind === "pickup" ||
      required.has(object.id) ||
      required.has(object.enemy?.escortOf ?? ""),
  );
}
