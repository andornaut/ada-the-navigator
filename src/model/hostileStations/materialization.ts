import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { enemyActorAvailable } from "../../data/enemyActors.ts";
import type { GameContent } from "../../data/types.ts";
import { spawnPlannedHostileStation, syncFlightRegion } from "../flight.ts";
import { readPendingPhantomEncounter } from "../phantomRequiredPlans.ts";
import type { FlightState, GalaxyProgress } from "../types.ts";
import { flightWorldContext, periodicWorldGrid, worldCellOrigin } from "../world/index.ts";
import {
  hostileStationEncounterIds,
  registerHostileStationEncounter,
  rememberHostileStationSite,
} from "./persistence.ts";
import { scheduleHostileStations } from "./schedule.ts";

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

/** Queries only the canonical generated cells after their required/protected content exists. */
export function materializeGeneratedHostileStations(
  content: GameContent,
  progress: GalaxyProgress,
  flight: FlightState,
): void {
  if (
    !enemyActorAvailable(flight.galaxy, "hostileStation") ||
    progress.geography?.seed !== flight.seed
  ) {
    return;
  }
  const phantom = flight.phantom;
  if (
    flight.galaxy === 6 &&
    (!phantom ||
      (phantom.phase !== "flagship" &&
        phantom.phase !== "salvaged" &&
        !readPendingPhantomEncounter(flight)))
  ) {
    return;
  }
  const grid = periodicWorldGrid(flightWorldContext(flight), content.tuning.chunkSize);
  const before = flight.objects.length;
  for (const key of [...flight.chunks]) {
    const [x, y] = key.split(",").map(Number);
    const point = worldCellOrigin(grid, { x: x!, y: y! });
    materializeHostileStationRegion(content, progress, flight, {
      ...point,
      height: grid.pitch,
      width: grid.pitch,
    });
  }
  if (flight.objects.length !== before) {
    syncFlightRegion(content, flight);
  }
}
