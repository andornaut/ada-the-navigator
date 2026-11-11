import type { MapSymbol } from "../model/map.ts";

/**
 * Each story destination's Map kind, its symbol (art/map.md "Symbols", gameplay/player-copy.md
 * "Map place panel"): galaxy one's outposts their own, Cartwheel's mining hub the station chip
 * because it docks and sells the holodisk, the holodisk waypoint its own, and every other story
 * place the story-place chip.
 */
export const DESTINATION_MAP_KINDS: Readonly<Record<string, MapSymbol>> = {
  family: "destination",
  growers: "growers",
  holodisk: "holodisk",
  hub: "station",
  miner: "destination",
  salvagers: "salvagers",
  visitors: "destination",
  whale: "destination",
  workshop: "workshop",
};
