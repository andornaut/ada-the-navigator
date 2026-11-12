import type { CastKey } from "../data/cast.ts";
import type { EconomyCatalog } from "../data/economy.ts";
import { type KeeperGreetings, KEEPERS } from "../data/keepers.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { HUB_STATION, stationById, stationsNear } from "./stations.ts";

// Which keeper greets at a station (gameplay/rules.md "Species and greeters"): a station's rank by
// distance from its galaxy's origin picks one of the galaxy's three keepers in turn, so the nearest
// three stations have different keepers. Cartwheel's mining hub is always Quartz's, and its other
// stations take Slate and Garnet in turn. Ranks come from the station generator alone, never from
// saved state.

/** What the station card's keeper block shows: the keeper and the docking's line on show. */
export interface StationGreeting {
  /** How many lines this docking shows: three the first time, then one. */
  readonly count: number;
  /** The line on show, from 0. */
  readonly index: number;
  readonly keeper: CastKey;
  readonly line: string;
}

export interface StationKeeper {
  readonly greetings: KeeperGreetings;
  readonly key: CastKey;
}

/**
 * A generated station's rank in its galaxy: how many of the galaxy's stations sit nearer the
 * origin, ties broken by id. Null for an id no station of the galaxy has.
 */
export function stationRank(
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): number | null {
  const site = stationById(catalog, galaxy, id);
  if (!site) {
    return null;
  }
  const reach = Math.hypot(site.x, site.y);
  return stationsNear(catalog, galaxy, reach, { x: 0, y: 0 }).filter((other) => {
    const near = Math.hypot(other.x, other.y);
    return near < reach || (near === reach && other.id < site.id);
  }).length;
}

/** The keeper of a docked station, or null where its galaxy has none (Phantom). */
export function stationKeeper(
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): StationKeeper | null {
  const keepers = KEEPERS[galaxy];
  if (!keepers) {
    return null;
  }
  const { greetings, keepers: keys } = keepers;
  if (galaxy === 2 && id === HUB_STATION) {
    return { greetings: keepers.hub ?? greetings, key: keys[0] };
  }
  const rank = stationRank(catalog, galaxy, id);
  if (rank === null) {
    return null;
  }
  // Cartwheel's other stations take its second and third keepers in turn.
  const key = galaxy === 2 ? keys[1 + (rank % 2)]! : keys[rank % keys.length]!;
  return { greetings, key };
}

/**
 * The lines one docking shows: the full greeting the first time, then one later line in turn,
 * the station's own count of later dockings picking it.
 */
export function greetingLines(greetings: KeeperGreetings, docked: number): readonly string[] {
  return docked === 0 ? greetings.first : [greetings.later[(docked - 1) % greetings.later.length]!];
}
