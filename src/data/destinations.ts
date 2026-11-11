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
}

/**
 * Each story destination's data: galaxy one's outposts take their own Map kind, Cartwheel's
 * mining hub the station chip because it docks and sells the holodisk, the holodisk waypoint
 * its own, and every other story place the story-place chip.
 */
export const DESTINATIONS: Readonly<Record<string, DestinationData>> = {
  family: { drawn: true, mapKind: "destination" },
  growers: { drawn: true, mapKind: "growers" },
  holodisk: { drawn: true, mapKind: "holodisk" },
  hub: { drawn: true, mapKind: "station" },
  miner: { drawn: false, mapKind: "destination" },
  salvagers: { drawn: true, mapKind: "salvagers" },
  visitors: { drawn: false, mapKind: "destination" },
  whale: { drawn: true, mapKind: "destination" },
  workshop: { drawn: true, mapKind: "workshop" },
};

/** Whether a destination draws in flight; any destination without data draws. */
export function destinationDrawn(id: string): boolean {
  return DESTINATIONS[id]?.drawn ?? true;
}
