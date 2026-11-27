import { COURIER } from "../data/activities.ts";
import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { ECONOMY } from "../data/economy.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { flightStationContext, worldStationById } from "./stations.ts";
import type { FlightState, GalaxyProgress, Vec } from "./types.ts";
import { worldDelta, worldPoint } from "./worldContacts.ts";

interface Lane {
  readonly beacon: Vec;
  readonly stationId: string;
  readonly leg: Vec | null;
}

const lanes = new WeakMap<FlightState, Lane>();

/** Sample the repaired lane using its retained chapter sites and the saved flight clock. */
export function andromedaLaneCourier(
  context: {
    readonly baseSpeed: number;
    readonly progress: Pick<GalaxyProgress, "andromeda" | "questComplete" | "requiredSites">;
  },
  flight: FlightState,
): (Vec & { readonly heading: Vec }) | null {
  const { baseSpeed, progress } = context;
  const beacon = progress.requiredSites?.[ANDROMEDA_PLACES.beacon];
  const stationId = progress.andromeda?.station;
  if (flight.galaxy !== 5 || !progress.questComplete || !beacon || !stationId) {
    return null;
  }
  const world = flightWorldContext(flight);
  let lane = lanes.get(flight);
  if (lane?.beacon !== beacon || lane.stationId !== stationId) {
    const station = worldStationById(flightStationContext(flight), ECONOMY, 5, stationId);
    lane = { beacon, leg: station && worldDelta(world, beacon, station), stationId };
    lanes.set(flight, lane);
  }
  const leg = lane.leg;
  const distance = leg && Math.hypot(leg.x, leg.y);
  if (!leg || !distance) {
    return null;
  }
  const travel = ((flight.time * baseSpeed * COURIER.speedFraction) / distance) % 2;
  const heading = travel < 1 ? leg : { x: -leg.x, y: -leg.y };
  const along = travel < 1 ? travel : 2 - travel;
  return {
    ...worldPoint(world, flight.player, {
      x: beacon.x + leg.x * along,
      y: beacon.y + leg.y * along,
    }),
    heading,
  };
}
