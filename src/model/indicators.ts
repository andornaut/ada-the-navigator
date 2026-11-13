import { ANDROMEDA_PLACES } from "../data/andromeda.ts";
import { ECONOMY } from "../data/economy.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { stationIndicatorTarget } from "./stations.ts";
import type { FlightState, GalaxyProgress } from "./types.ts";

// Direction indicators (gameplay/rules.md "Space encounters and feedback"): rare arrows that
// mark only the current objective's destination, where a carried quest item goes, the holodisk
// waypoint, the held station job's target (gameplay/quests.md) and an undiscovered station within
// 3000 world units while off screen. Optional discoveries get none; Penny senses those
// instead. Seen enemies, heavies and stations get edge markers (edgeMarkers.ts) instead, which
// give way to an indicator on the same object. Each kind is one source below, so a kind gains its
// rule without touching the others.

/** Earlier kinds win when two mark the same place. */
export const INDICATOR_KINDS = ["holodisk", "objective", "questItem", "job", "station"] as const;
export type IndicatorKind = (typeof INDICATOR_KINDS)[number];

export interface IndicatorTarget {
  readonly id: string;
  readonly kind: IndicatorKind;
  readonly x: number;
  readonly y: number;
}

export interface IndicatorContext {
  readonly flight: Pick<FlightState, "objects" | "player">;
  /** The galaxy's holodisk waypoint shows until the holodisk is recovered. */
  readonly holodiskWaypoint: boolean;
  /** Where the held station job sends Ada now, if anywhere. */
  readonly job: IndicatorTarget | null;
  /** The current objective's destination, if it has one. */
  readonly objective: string | null;
  /** A chapter target may be known by its briefing before ordinary destination discovery. */
  readonly objectivePoint?: { readonly id: string; readonly x: number; readonly y: number };
  readonly progress: Pick<GalaxyProgress, "known" | "stations">;
  /** Where the carried quest item goes, if Ada carries one. */
  readonly questItem: string | null;
  readonly galaxy: GalaxyNumber;
}

export type IndicatorSource = (context: IndicatorContext) => readonly IndicatorTarget[];

/** A mapped destination in the flight, marked as kind. */
function mappedDestination(
  context: IndicatorContext,
  id: string | null,
  kind: IndicatorKind,
): IndicatorTarget[] {
  const object = context.flight.objects.find(
    (entry) => entry.kind === "destination" && entry.id === id,
  );
  return object && context.progress.known.includes(object.id)
    ? [{ id: object.id, kind, x: object.x, y: object.y }]
    : [];
}

export const INDICATOR_SOURCES: Readonly<Record<IndicatorKind, IndicatorSource>> = {
  holodisk: ({ flight, holodiskWaypoint }) =>
    flight.objects
      .filter((object) => holodiskWaypoint && object.id === "holodisk")
      .map(({ id, x, y }) => ({ id, kind: "holodisk", x, y })),
  job: ({ job }) => (job ? [job] : []),
  objective: (context) =>
    context.objectivePoint
      ? [{ ...context.objectivePoint, kind: "objective" }]
      : mappedDestination(context, context.objective, "objective"),
  questItem: (context) => mappedDestination(context, context.questItem, "questItem"),
  // The nearest undiscovered station within the economy's indicator range (stations.ts).
  station: ({ flight, galaxy, progress }) => {
    const site = stationIndicatorTarget(ECONOMY, galaxy, progress.stations, flight.player);
    return site ? [{ id: site.id, kind: "station", x: site.x, y: site.y }] : [];
  },
};

/** The places to mark, one per place, in INDICATOR_KINDS order. */
export function indicatorTargets(
  sources: Readonly<Record<IndicatorKind, IndicatorSource>>,
  context: IndicatorContext,
): IndicatorTarget[] {
  const marked = new Set<string>();
  return INDICATOR_KINDS.flatMap((kind) => sources[kind](context)).filter((target) => {
    if (
      marked.has(target.id) ||
      Math.hypot(target.x - context.flight.player.x, target.y - context.flight.player.y) >
        ECONOMY.station.indicatorRange
    ) {
      return false;
    }
    marked.add(target.id);
    return true;
  });
}

const QUEST_ITEM_DESTINATIONS: Readonly<Record<string, string>> = {
  beaconParts: ANDROMEDA_PLACES.beacon,
  food: "workshop",
  parts: "workshop",
  toolkit: "salvagers",
};

/** Where the carried quest item goes. */
export function questItemDestination(progress: Pick<GalaxyProgress, "questItem">): string | null {
  return progress.questItem === null ? null : (QUEST_ITEM_DESTINATIONS[progress.questItem] ?? null);
}

/**
 * The destination the current objective sends Ada to: the galaxy's first outpost until she is
 * introduced, then each stage's place; none once only the holodisk (its own kind) or the return
 * home remains. minerReady says the hub's deposits have called the miner.
 */
export function objectiveDestination(
  galaxy: GalaxyNumber,
  progress: Pick<
    GalaxyProgress,
    "holodisk" | "introduced" | "questComplete" | "questItem" | "stage"
  >,
  minerReady: boolean,
): string | null {
  if (progress.questComplete) {
    // Any outpost hands over galaxy one's holodisk; the hub sells galaxy two's.
    return progress.holodisk
      ? null
      : (({ 1: "workshop", 2: "hub" } as Partial<Record<GalaxyNumber, string>>)[galaxy] ?? null);
  }
  // A placeholder galaxy has no story destinations.
  if (!progress.introduced) {
    return (
      ({ 1: "growers", 2: "hub", 3: "whale" } as Partial<Record<GalaxyNumber, string>>)[galaxy] ??
      null
    );
  }
  const { questItem, stage } = progress;
  const stages: Partial<Record<GalaxyNumber, readonly (string | null)[]>> = {
    1: [
      "growers",
      questItem === "food" ? "workshop" : "growers",
      questItem === "toolkit" ? "salvagers" : "workshop",
      questItem === "parts" ? "workshop" : "salvagers",
    ],
    2: ["hub", "hub", minerReady ? "miner" : "hub", "visitors", "hub"],
    3: ["whale", "whale", "whale", "family", "whale"],
  };
  return stages[galaxy]?.[stage] ?? null;
}
