import { ECONOMY } from "../../data/economy.ts";
import type { GalaxyNumber, GameContent } from "../../data/types.ts";
import type { EconomyState, FlightState } from "../types.ts";
import { noLevels, shipTuning } from "../upgrades.ts";
import { markVisited } from "../visited.ts";
import { clampAmmo, grantedAmmo, shotsLeft } from "../weapons.ts";

export type Loadout = Pick<
  EconomyState,
  | "ammo"
  | "cargo"
  | "levels"
  | "ownedWeapons"
  | "weapon"
  | "shieldRechargeCredit"
  | "shieldOreSpent"
>;

export function createUnpopulatedFlight(
  content: GameContent,
  galaxy: GalaxyNumber,
  seed: number,
  loadout: Loadout = {
    ammo: grantedAmmo([]),
    levels: noLevels(),
    ownedWeapons: [],
    weapon: "laser",
  },
  encounterSeed?: number,
): FlightState {
  const levels = structuredClone(loadout.levels);
  const flight: FlightState = {
    ...(encounterSeed === undefined ? {} : { encounterSeed }),
    ammo: clampAmmo(ECONOMY, loadout.ammo),
    cargo: loadout.cargo ?? 0,
    ...(loadout.shieldRechargeCredit === undefined
      ? {}
      : { shieldRechargeCredit: loadout.shieldRechargeCredit }),
    ...(loadout.shieldOreSpent === undefined ? {} : { shieldOreSpent: loadout.shieldOreSpent }),
    chunks: [],
    dangerFor: 0,
    facing: { x: 0, y: -1 },
    fireCooldown: 0,
    freshChunk: "0,0",
    freshDistance: 0,
    galaxy,
    levels,
    mines: [],
    nextId: 0,
    objects: [],
    ownedWeapons: [...loadout.ownedWeapons],
    player: { x: 0, y: 0 },
    seed,
    shield: shipTuning(ECONOMY, content, levels).shieldMax,
    shots: [],
    sinceDamage: content.tuning.shieldRechargeDelay,
    time: 0,
    velocity: { x: 0, y: 0 },
    visited: {},
    // An empty saved selection starts the flight on Laser.
    weapon: shotsLeft(loadout.weapon, loadout) === 0 ? "laser" : loadout.weapon,
    weaponSwitchFor: 0,
    world: { notables: {}, version: 1 },
  };
  markVisited(flight.visited, "0,0");
  return flight;
}

/**
 * The flight time each flight's arrival grace ends. It is never saved, so a flight resumed with
 * Continue has none.
 */
const arrivalGraceEnds = new WeakMap<FlightState, number>();

/** Starts Ada's arrival grace at a launch, quantum jump arrival, Travel arrival or undocking. */
export function beginArrivalGrace(content: GameContent, flight: FlightState): void {
  arrivalGraceEnds.set(flight, flight.time + content.tuning.flight.arrivalGrace);
}

/** Whether Ada's arrival grace still runs; it counts flight time, so pauses do not use it up. */
export function arrivalGraceActive(flight: FlightState): boolean {
  const end = arrivalGraceEnds.get(flight);
  return end !== undefined && flight.time < end;
}
