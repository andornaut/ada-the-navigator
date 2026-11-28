import { ECONOMY } from "../../data/economy.ts";
import { GALAXY_ID } from "../../data/galaxies.ts";
import { STATION_KEEPER_COPY } from "../../data/stationCopy.ts";
import type { GalaxyNumber } from "../../data/types.ts";
import {
  greetingLines,
  type KeeperKey,
  type StationGreeting,
  stationKeeperPersonalName,
  worldStationKeeper,
} from "../keepers.ts";
import { stationDisplayName } from "../stationIdentity.ts";
import { flightStationContext, HUB_STATION } from "../stations.ts";
import { stationSpecialty } from "../stationServices.ts";
import type { GameState } from "../types.ts";

export interface StationGreetingVisit {
  index: number;
  readonly keeper: KeeperKey;
  readonly displayName: string;
  readonly lines: readonly string[];
}

type KeeperContext = Readonly<Pick<GameState, "flight" | "progress">>;
type DockedContext = Readonly<Pick<GameState, "docked" | "flight">>;

function keeperAt(state: KeeperContext, galaxy: GalaxyNumber, id: string) {
  const { flight } = state;
  const progress = state.progress[galaxy];
  return worldStationKeeper(
    {
      ...(flight && flight.galaxy === galaxy ? flightStationContext(flight) : {}),
      phantomComplete:
        progress.phantom?.aftermathComplete === true && progress.questComplete && progress.holodisk,
    },
    ECONOMY,
    galaxy,
    id,
  );
}

export function keeperStationName(galaxy: GalaxyNumber, id: string): string {
  const name = GALAXY_ID[galaxy];
  return stationDisplayName(name[0]!.toUpperCase() + name.slice(1), id);
}

export function resolveStationGreeting(
  state: KeeperContext,
  galaxy: GalaxyNumber,
  id: string,
  docked: number,
): StationGreetingVisit | null {
  const keeper = keeperAt(state, galaxy, id);
  if (!keeper) {
    return null;
  }
  const specialty = stationSpecialty(galaxy, id);
  const station = keeperStationName(galaxy, id);
  const name = stationKeeperPersonalName(galaxy, id);
  const displayName = id === HUB_STATION ? name : `${name} of ${station}`;
  const lines =
    id === HUB_STATION
      ? greetingLines(keeper.greetings, docked)
      : docked === 0
        ? [
            STATION_KEEPER_COPY.intro,
            STATION_KEEPER_COPY.flavor[galaxy],
            STATION_KEEPER_COPY.services[specialty ?? "exchange"],
          ]
        : [STATION_KEEPER_COPY.returning[(docked - 1) % STATION_KEEPER_COPY.returning.length]!];
  return { displayName, index: 0, keeper: keeper.key, lines };
}

export function projectStationGreeting(
  docked: GameState["docked"],
  greeting: Readonly<StationGreetingVisit> | null,
): StationGreeting | null {
  return docked && greeting
    ? {
        count: greeting.lines.length,
        displayName: greeting.displayName,
        index: greeting.index,
        keeper: greeting.keeper,
        line: greeting.lines[greeting.index]!,
      }
    : null;
}

export function compactStationGreeting(
  state: DockedContext,
  greeting: StationGreeting | null,
): StationGreeting | null {
  const { docked, flight } = state;
  return greeting && docked && flight
    ? { ...greeting, displayName: stationKeeperPersonalName(flight.galaxy, docked) }
    : greeting;
}

export function projectStationWelcome(
  visit: Readonly<StationGreetingVisit> | null,
  greeting: StationGreeting,
): StationGreeting | null {
  return visit ? { ...greeting, line: visit.lines.join(" ") } : null;
}
