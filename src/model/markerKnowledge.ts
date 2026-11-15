import { flightEncounterSeed } from "./flightTopology.ts";
import type { TargetKnowledgeRecord } from "./targetMarkers.ts";
import type { FlightState } from "./types.ts";

export function validTargetKnowledge(value: unknown): value is TargetKnowledgeRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([id, knowledge]) =>
        id.length > 0 &&
        !["__proto__", "prototype", "constructor"].includes(id) &&
        (knowledge === "sensed" || knowledge === "identified"),
    )
  );
}

export function validMarkerActors(
  context: Pick<FlightState, "seed" | "encounterSeed">,
  value: unknown,
): value is NonNullable<FlightState["markerActors"]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actors = value as Record<string, unknown>;
  return (
    Object.keys(actors).length === 2 &&
    Number.isSafeInteger(actors.encounterSeed) &&
    (actors.encounterSeed as number) >= 0 &&
    actors.encounterSeed === flightEncounterSeed(context) &&
    validTargetKnowledge(actors.knowledge)
  );
}

/** Membership never infers removal from an unloaded actor's absence. */
export function markerActorTracked(
  flight: Pick<FlightState, "seed" | "encounterSeed" | "markerActors">,
  id: string,
): boolean {
  const actors = flight.markerActors;
  return (
    actors !== undefined &&
    actors.encounterSeed === flightEncounterSeed(flight) &&
    Object.hasOwn(actors.knowledge, id) &&
    (actors.knowledge[id] === "sensed" || actors.knowledge[id] === "identified")
  );
}
