import type { MapSymbol } from "../model/map.ts";

export interface DestinationData {
  /**
   * The Map kind, its symbol (art/map.md "Symbols", gameplay/player-copy.md "Map place panel").
   */
  readonly mapKind: MapSymbol;
  /**
   * Whether the destination draws in flight. Cartwheel's miner and visitors do not: their buoy
   * and moored craft stand for them.
   */
  readonly drawn: boolean;
  /**
   * Its name inside a sentence, with its article, as objectives and job titles use it
   * (gameplay/quests.md "Repeatable activities"), or null for a place no sentence names.
   */
  readonly sentence: string | null;
}

/**
 * Each story destination's data: galaxy one's outposts take their own Map kind, Cartwheel's
 * mining hub the station chip because it docks and sells the holodisk, the holodisk waypoint
 * its own, and every other story place the story-place chip.
 */
export const DESTINATIONS: Readonly<Record<string, DestinationData>> = {
  family: { drawn: true, mapKind: "destination", sentence: "the whale family" },
  growers: { drawn: true, mapKind: "growers", sentence: "the growers' outpost" },
  holodisk: { drawn: true, mapKind: "holodisk", sentence: null },
  hub: { drawn: true, mapKind: "station", sentence: "the mining hub" },
  miner: { drawn: false, mapKind: "destination", sentence: null },
  salvagers: { drawn: true, mapKind: "salvagers", sentence: "the salvagers' yard" },
  visitors: { drawn: false, mapKind: "destination", sentence: null },
  whale: { drawn: true, mapKind: "destination", sentence: "the whale" },
  workshop: { drawn: true, mapKind: "workshop", sentence: "the workshop" },
};

/** Every station's name inside a sentence; the Map names it Station. */
export const STATION_SENTENCE = "the station";

const DELIVERY_KINDS: readonly MapSymbol[] = ["growers", "salvagers", "station", "workshop"];

/**
 * Whether a story destination takes deliveries (gameplay/quests.md "Job types"): the outposts,
 * and the mining hub as a station-kind place. Other story places never do.
 */
export function deliveryDestination(id: string): boolean {
  const kind = DESTINATIONS[id]?.mapKind;
  return kind !== undefined && DELIVERY_KINDS.includes(kind);
}

/** Whether a destination draws in flight; any destination without data draws. */
export function destinationDrawn(id: string): boolean {
  return DESTINATIONS[id]?.drawn ?? true;
}
