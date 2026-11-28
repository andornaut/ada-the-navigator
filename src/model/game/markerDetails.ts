import { landmarkLabel,type LandmarkSite } from "../landmarks.ts";
import type { MarkerDetails, PennyMarker } from "../pennyMarkers.ts";
import type { QuestEntry } from "../questDetails.ts";
import { questsForObject } from "../questObjectLinks.ts";
import type { FlightState, OptionalTask } from "../types.ts";
import { flightWorldContext, worldDistance } from "../world/index.ts";

interface MarkerDetailContext {
  readonly label: (key: string) => string;
  readonly quests: () => readonly QuestEntry[];
  readonly scannableSites: () => readonly LandmarkSite[];
  readonly task: () => Readonly<OptionalTask> | undefined;
  readonly trackedQuestId: () => string | null;
}

/** Project the details for a marker whose display identity has already been checked. */
export function projectMarkerDetails(
  context: MarkerDetailContext,
  flight: Pick<FlightState, "galaxy" | "player" | "topology">,
  projection: {
    readonly known: readonly string[];
    readonly storyTargets: readonly string[];
    readonly waypointId: string | undefined;
  },
  marker: PennyMarker,
): MarkerDetails {
  const { known, storyTargets, waypointId } = projection;
  const { category, id, identified, item, symbol } = marker;
  const distance = worldDistance(flightWorldContext(flight), flight.player, marker);
  if (!identified) {
    return { kind: "point", point: { category, distance, identified, symbol } };
  }
  const task = context.task();
  const entries = context.quests();
  const quests =
    id === waypointId
      ? entries.filter((entry) => entry.id === context.trackedQuestId())
      : questsForObject(
          {
            galaxy: flight.galaxy,
            knownIds: known,
            quests: entries,
            storyTargets,
            ...(task ? { task } : {}),
          },
          id,
        );
  if (quests.length) {
    return { details: { quests, targetId: id }, kind: "quest" };
  }
  const site =
    category === "discovery" ? context.scannableSites().find((site) => site.id === id) : undefined;
  const label = site
    ? landmarkLabel(context.label, site)
    : context.label(item ?? id) ||
      (symbol === "holodisk" ? context.label("mapHolodiskWaypoint") : "") ||
      (category === "station" ? context.label("station") : "") ||
      (id.startsWith("settlement:") ? context.label("settlement") : "");
  return {
    kind: "point",
    point: { category, distance, identified, symbol, ...(label ? { label } : {}) },
  };
}
