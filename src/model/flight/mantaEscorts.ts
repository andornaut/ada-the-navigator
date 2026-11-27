import { escortTuning } from "../../data/enemyCatalog.ts";
import { spacingRadius } from "../../data/enemySpacing.ts";
import { ROUTE_POSITION } from "../../data/galaxies.ts";
import { worldFlowAt } from "../currents.ts";
import { mantaEscortCourse, type MantaEscortIndex, type MantaEscortState } from "../earlyEncounterPatterns.ts";
import { flightWorldContext } from "../flightTopology.ts";
import { direction } from "../shipPhysics.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { worldDelta } from "../worldContacts.ts";
import { sceneryBlocksFlightSegment, type SceneryResolution } from "./sceneryResolution.ts";

/** Use existing escort berth and hull distances for the two opposite crossing paths. */
export function planMantaEscorts(
  scenery: SceneryResolution,
  launch: Vec,
  flight: FlightState,
  leader: SpaceObject,
): MantaEscortState | undefined {
  const world = flightWorldContext(flight);
  const home = leader.enemy!.home;
  const toward = worldDelta(world, home, launch);
  const forward = Math.hypot(toward.x, toward.y) > 0 ? direction(toward) : { x: 1, y: 0 };
  const gap = spacingRadius(ROUTE_POSITION[flight.galaxy], leader.enemy!) + escortTuning.stationGap;
  const clear = (from: Vec, to: Vec) =>
    !sceneryBlocksFlightSegment(scenery, world, flight, { clearance: 0, from, to });
  const course = (escort: MantaEscortIndex) => {
    const side = escort === 0 ? 1 : -1;
    const point = (offset: Vec) => ({ x: home.x + offset.x, y: home.y + offset.y });
    // Keep the two escorts on opposite sides and move a blocked pass outwards past the terrain.
    for (const offset of [0, escortTuning.stationGap / 2, escortTuning.stationGap]) {
      const distance = gap + offset;
      const station = { x: -forward.y * distance * side, y: forward.x * distance * side };
      for (const span of [escortTuning.stationGap, escortTuning.stationGap / 2]) {
        const entry = {
          x: station.x - forward.x * span * side,
          y: station.y - forward.y * span * side,
        };
        const exit = {
          x: station.x + forward.x * span * side,
          y: station.y + forward.y * span * side,
        };
        if (
          clear(point(entry), point(exit)) &&
          clear(point(station), point(entry)) &&
          clear(point(exit), point(station))
        ) {
          return mantaEscortCourse(
            {
              current: worldFlowAt(world, flight.galaxy, point(station)),
              reverseIsClear: true,
            },
            { entry, exit, station },
          );
        }
      }
    }
    return undefined;
  };
  const first = course(0);
  const second = course(1);
  return first && second ? { courses: [first, second], elapsed: 0 } : undefined;
}
