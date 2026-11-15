import { HOSTILE_STATION_COPY } from "../data/hostileStationCopy.ts";
import {
  identifiedHostileStationSites,
  resolveHostileStationEncounter,
} from "./hostileStationPersistence.ts";
import type { KnownHostileStationMapPlace } from "./map.ts";
import type { FlightState, GalaxyProgress } from "./types.ts";

/** Geographic identification survives encounters; current body status never comes from geography. */
export function hostileStationMapPlaces(
  flight: FlightState,
  progress: GalaxyProgress,
): readonly KnownHostileStationMapPlace[] {
  return identifiedHostileStationSites(progress).map<KnownHostileStationMapPlace>(
    ({ id, point }) => {
      const current = resolveHostileStationEncounter(flight, id);
      return {
        hostileStationStatus:
          current.state === "present"
            ? current.body.enemy!.disabled
              ? "disabled"
              : "present"
            : current.state,
        id,
        job: false,
        kind: "hostileStation",
        label: HOSTILE_STATION_COPY.label,
        objective: false,
        symbol: "hostileStation",
        travel: false,
        x: point.x,
        y: point.y,
      };
    },
  );
}
