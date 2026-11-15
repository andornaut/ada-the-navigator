import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { GameContent } from "../data/types.ts";
import { spawnPlannedHostileStation } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import {
  hostileStationEncounterIds,
  registerHostileStationEncounter,
  rememberHostileStationSite,
} from "./hostileStationPersistence.ts";
import { scheduleHostileStations } from "./hostileStationSchedule.ts";
import type { FlightState, GalaxyProgress } from "./types.ts";

/** The caller represents all required occupants before admitting optional station encounters. */
export function materializeHostileStationRegion(
  content: GameContent,
  progress: GalaxyProgress,
  flight: FlightState,
  region: Readonly<Rect>,
): void {
  scheduleHostileStations(
    {
      ...flightWorldContext(flight),
      galaxy: flight.galaxy,
      geographySeed: flight.seed,
      hasEncounter: (id) => Object.hasOwn(flight.hostileStations ?? {}, id),
      identities: hostileStationEncounterIds,
      materialize: (plan) => spawnPlannedHostileStation(content, flight, plan),
      register: (id) => {
        registerHostileStationEncounter(progress, flight, id);
      },
      remember: (site) => {
        const known = rememberHostileStationSite(progress, flight.galaxy, {
          id: site.id,
          point: { x: site.x, y: site.y },
        });
        return { id: site.id, x: known.point.x, y: known.point.y };
      },
    },
    region,
  );
}
