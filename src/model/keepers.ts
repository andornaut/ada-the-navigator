import type { CastKey } from "../data/cast.ts";
import type { EconomyCatalog } from "../data/economy.ts";
import { type KeeperGreetings, KEEPERS, PHANTOM_KEEPER_GREETINGS } from "../data/keepers.ts";
import { KEEPER_NAME_PARTS } from "../data/stationCopy.ts";
import type { GalaxyNumber } from "../data/types.ts";
import {
  HUB_STATION,
  type StationPlacementContext,
  worldLegacyStationsNear,
  worldStationById,
  worldStationsNear,
} from "./stations.ts";

// Which keeper greets at a station (gameplay/rules.md "Species and greeters"): a station's rank by
// distance from its galaxy's origin picks one of the galaxy's three keepers in turn, so the nearest
// three stations have different keepers. Cartwheel's mining hub is always Quartz's, and its other
// stations take Slate and Garnet in turn. Ranks come from the station generator alone, never from
// saved state.

export type KeeperKey = CastKey | "archie";

/** The model supplies completion only after the approved Phantom aftermath is complete. */
export interface StationKeeperContext extends StationPlacementContext {
  readonly phantomComplete?: boolean;
}

/** What the station card's keeper block shows: the keeper and the docking's line on show. */
export interface StationGreeting {
  readonly displayName: string;
  /** How many lines this docking shows: three the first time, then one. */
  readonly count: number;
  /** The line on show, from 0. */
  readonly index: number;
  readonly keeper: KeeperKey;
  readonly line: string;
}

export interface StationKeeper {
  readonly greetings: KeeperGreetings;
  readonly key: KeeperKey;
}

/**
 * A generated station's rank in its galaxy: how many of the galaxy's stations sit nearer the
 * origin, ties broken by id. Null for an id no station of the galaxy has.
 */
function worldStationRank(
  context: StationPlacementContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): number | null {
  const site = worldStationById(context, catalog, galaxy, id);
  if (!site) {
    return null;
  }
  const reach = Math.hypot(site.x, site.y);
  const stationsNear =
    context.worldSide === undefined ? worldLegacyStationsNear : worldStationsNear;
  return stationsNear(context, catalog, galaxy, reach, { x: 0, y: 0 }).filter((other) => {
    const near = Math.hypot(other.x, other.y);
    return near < reach || (near === reach && other.id < site.id);
  }).length;
}

export function stationRank(
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): number | null {
  return worldStationRank({}, catalog, galaxy, id);
}

/** The authored hub label or the personal name selected from the station's stable seed. */
export function stationKeeperPersonalName(galaxy: GalaxyNumber, id: string): string {
  if (id === HUB_STATION) {
    return "Quartz";
  }
  const [given, family] = KEEPER_NAME_PARTS[galaxy];
  const nameSeed = Array.from(id).reduce<number>(
    (seed, character) => (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0,
    galaxy,
  );
  const givenName = given[nameSeed % given.length];
  const familyName = family[Math.floor(nameSeed / given.length) % family.length];
  return `${givenName} ${familyName}`;
}

/** A keeper at a real station, with Phantom gated by explicit completed-aftermath context. */
export function worldStationKeeper(
  context: StationKeeperContext,
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): StationKeeper | null {
  if (galaxy === 6) {
    return context.phantomComplete === true &&
      worldStationById(context, catalog, galaxy, id) !== null
      ? { greetings: PHANTOM_KEEPER_GREETINGS, key: "archie" }
      : null;
  }
  const keepers = KEEPERS[galaxy];
  if (!keepers) {
    return null;
  }
  const { greetings, keepers: keys } = keepers;
  if (galaxy === 2 && id === HUB_STATION) {
    return { greetings: keepers.hub ?? greetings, key: keys[0] };
  }
  const rank = worldStationRank(context, catalog, galaxy, id);
  if (rank === null) {
    return null;
  }
  // Cartwheel's other stations take its second and third keepers in turn.
  const key = galaxy === 2 ? keys[1 + (rank % 2)]! : keys[rank % keys.length]!;
  return { greetings, key };
}

/** Legacy callers keep Phantom's generic welcome until they pass an explicit context. */
export function stationKeeper(
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  id: string,
): StationKeeper | null {
  return worldStationKeeper({}, catalog, galaxy, id);
}

/**
 * The lines one docking shows: the full greeting the first time, then one later line in turn,
 * the station's own count of later dockings picking it.
 */
export function greetingLines(greetings: KeeperGreetings, docked: number): readonly string[] {
  return docked === 0 ? greetings.first : [greetings.later[(docked - 1) % greetings.later.length]!];
}
