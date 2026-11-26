import type { GalaxyNumber } from "../data/types.ts";
import type { ShopItem, ShopRow } from "./shop.ts";
import type { StationStockCategory } from "./stationServices.ts";

export const STATION_RESTOCK_SECONDS = 300;

export type StationOffer = Exclude<ShopItem, { kind: "holodisk" }>;
export type StationStockSlot = `${StationStockCategory}:${number}`;

export interface StationStockEntry {
  item: StationOffer;
  purchased?: {
    availableAfter: number;
    level: ShopRow["level"];
  };
}

export interface StationRestockState {
  flightSeconds: number;
  stations: Record<string, Partial<Record<StationStockSlot, StationStockEntry>>>;
}

export interface StationRestockVisit {
  state: StationRestockState;
  galaxy: GalaxyNumber;
  stationId: string;
}

export function newStationRestock(): StationRestockState {
  return { flightSeconds: 0, stations: {} };
}

/** Call only for elapsed active flight simulation, in seconds. */
export function advanceStationRestock(state: StationRestockState, seconds: number): void {
  if (Number.isFinite(seconds) && seconds > 0) {
    state.flightSeconds += seconds;
  }
}

function stationKey(visit: StationRestockVisit): string {
  return JSON.stringify([visit.galaxy, visit.stationId]);
}

export function readStationStockEntry(
  visit: StationRestockVisit,
  slot: StationStockSlot,
): StationStockEntry | undefined {
  return visit.state.stations[stationKey(visit)]?.[slot];
}

export function setStationStockEntry(
  visit: StationRestockVisit,
  slot: StationStockSlot,
  entry: StationStockEntry,
): void {
  (visit.state.stations[stationKey(visit)] ??= {})[slot] = entry;
}
