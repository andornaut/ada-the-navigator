import { GALAXY_SIDE } from "../data/world.ts";
import type { FlightState, Vec } from "./types.ts";
import type { WorldContext } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

/** Explicit metadata selects periodic geometry; absence always means a legacy chart. */
export interface FlightTopology {
  readonly kind: "torus";
  readonly side: number;
  readonly version: 1;
}

export const CURRENT_FLIGHT_TOPOLOGY = Object.freeze<FlightTopology>({
  kind: "torus",
  side: GALAXY_SIDE,
  version: 1,
});

function hasOwnDataProperty(value: object, key: keyof FlightTopology): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && Object.hasOwn(descriptor, "value");
}

export function validFlightTopology(value: unknown): value is FlightTopology {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const topology = value as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(topology);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(topology).length === 3 &&
    hasOwnDataProperty(topology, "kind") &&
    hasOwnDataProperty(topology, "side") &&
    hasOwnDataProperty(topology, "version") &&
    topology.kind === "torus" &&
    topology.side === GALAXY_SIDE &&
    topology.version === 1
  );
}

const legacy: WorldContext = Object.freeze({});
const current: WorldContext = Object.freeze({ worldSide: CURRENT_FLIGHT_TOPOLOGY.side });
const contexts = new WeakMap<FlightTopology, WorldContext>();

/** No seed, coordinate or galaxy inference changes an existing flight's chart. */
export function flightWorldContext(flight: Pick<FlightState, "topology">): WorldContext {
  const topology = flight.topology;
  if (topology === undefined) {
    return legacy;
  }
  if (topology === CURRENT_FLIGHT_TOPOLOGY) {
    return current;
  }
  // Restored and caller-supplied records can change despite the readonly type.
  if (!validFlightTopology(topology)) {
    throw new RangeError("Unsupported flight topology");
  }
  let context = contexts.get(topology);
  if (!context) {
    context = Object.freeze({ worldSide: topology.side });
    contexts.set(topology, context);
  }
  return context;
}

/** Continue preserves the stored value; legacy flights keep their exact existing identity. */
export function flightEncounterSeed(flight: Pick<FlightState, "seed" | "encounterSeed">): number {
  return flight.encounterSeed ?? flight.seed;
}

/** Canonicalize a mutable position only when this flight uses the periodic chart. */
export function canonicalPosition(flight: Pick<FlightState, "topology">, point: Vec): void {
  if (flight.topology) {
    Object.assign(point, wrapPoint(flight.topology.side, point));
  }
}
