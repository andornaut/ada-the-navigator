import { GALAXY_SIDE } from "../data/world.ts";
import type { FlightState } from "./types.ts";
import type { WorldContext } from "./worldContacts.ts";

/** Explicit metadata selects periodic geometry; absence always means a legacy chart. */
export interface FlightTopology {
  readonly kind: "torus";
  readonly side: number;
  readonly version: 1;
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
    ["kind", "side", "version"].every(
      (key) =>
        Object.hasOwn(topology, key) && "value" in Object.getOwnPropertyDescriptor(topology, key)!,
    ) &&
    topology.kind === "torus" &&
    topology.side === GALAXY_SIDE &&
    topology.version === 1
  );
}

const legacy: WorldContext = Object.freeze({});
const contexts = new WeakMap<FlightTopology, WorldContext>();

/** No seed, coordinate or galaxy inference changes an existing flight's chart. */
export function flightWorldContext(flight: Pick<FlightState, "topology">): WorldContext {
  const topology = flight.topology;
  if (topology === undefined) {
    return legacy;
  }
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
