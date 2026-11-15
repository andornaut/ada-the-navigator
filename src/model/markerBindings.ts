import { flightEncounterSeed } from "./flightTopology.ts";
import { markerActorTracked, validMarkerActors } from "./markerKnowledge.ts";
import { scopedTargetKnowledge } from "./targetKnowledgeStore.ts";
import type { TargetKnowledgeStore } from "./targetMarkers.ts";
import type { FlightState, GalaxyProgress } from "./types.ts";

const scopes = new WeakMap<FlightState, WeakMap<GalaxyProgress, object>>();

/** Bind the actual optional save fields, creating a ledger only when knowledge changes. */
export function markerKnowledgeStore(
  progress: GalaxyProgress,
  flight: FlightState,
  geographic: (id: string) => boolean,
): TargetKnowledgeStore {
  let byProgress = scopes.get(flight);
  if (!byProgress) {
    byProgress = new WeakMap();
    scopes.set(flight, byProgress);
  }
  let scope = byProgress.get(progress);
  if (!scope) {
    scope = {};
    byProgress.set(progress, scope);
  }
  const actors: TargetKnowledgeStore = {
    get: (id) => (markerActorTracked(flight, id) ? flight.markerActors?.knowledge[id] : undefined),
    ids: () =>
      validMarkerActors(flight, flight.markerActors)
        ? Object.keys(flight.markerActors.knowledge)
        : [],
    remove: (id) => {
      if (markerActorTracked(flight, id)) {
        delete flight.markerActors!.knowledge[id];
      }
    },
    scope,
    set: (id, knowledge) => {
      if (!validMarkerActors(flight, flight.markerActors)) {
        flight.markerActors = { encounterSeed: flightEncounterSeed(flight), knowledge: {} };
      }
      flight.markerActors.knowledge[id] = knowledge;
    },
  };
  const sites: TargetKnowledgeStore = {
    get: (id) =>
      progress.markerKnowledge && Object.hasOwn(progress.markerKnowledge, id)
        ? progress.markerKnowledge[id]
        : undefined,
    ids: () => Object.keys(progress.markerKnowledge ?? {}),
    remove: (id) => {
      if (progress.markerKnowledge) {
        delete progress.markerKnowledge[id];
      }
    },
    scope,
    set: (id, knowledge) => {
      (progress.markerKnowledge ??= {})[id] = knowledge;
    },
  };
  return scopedTargetKnowledge({ actors, geographic, scope, sites });
}
