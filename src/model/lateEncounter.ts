import type { EncounterCue } from "../data/conversations.ts";
import type { EconomyCatalog } from "../data/economy.ts";
import { settlementsNear } from "./andromedaPlaces.ts";
import { onScreen } from "./conversations.ts";
import { stationsNear } from "./stations.ts";
import type { FlightState } from "./types.ts";

/** Only the visible teacher, a mounted station or a verified settlement identifies its people. */
export function lateEncounterCue(
  context: {
    readonly catalog: EconomyCatalog;
    readonly viewport: { width: number; height: number };
  },
  flight: FlightState,
): EncounterCue | null {
  const range = context.catalog.station.safeRadius;
  if (flight.galaxy === 4) {
    const loom = flight.objects.find(
      (object) => object.kind === "destination" && object.id === "elderLoom",
    );
    return loom &&
      onScreen(context.viewport, flight.player, loom) &&
      Math.hypot(loom.x - flight.player.x, loom.y - flight.player.y) <= range
      ? "stationNear"
      : null;
  }
  if (flight.galaxy !== 5) {
    return null;
  }
  const station = stationsNear(context.catalog, 5, range, flight.player).some((site) =>
    flight.objects.some((object) => object.kind === "station" && object.id === site.id),
  );
  const settlement = settlementsNear(context.catalog, range, flight.player).length > 0;
  return station || settlement ? "stationNear" : null;
}
