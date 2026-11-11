import { ECONOMY, type UpgradeWeapon } from "../data/economy.ts";
import type { Weapon } from "../data/types.ts";
import type { FlightState } from "./types.ts";

export interface WeaponChoice {
  id: Weapon;
  selected: boolean;
}
/** Shop order, cheapest first; the drop pool and the cheat grant use the same list. */
export const UPGRADE_WEAPONS = [
  "rapidMissile",
  "multiLaser",
  "heavyMissile",
  "scattershot",
  "phaser",
] as const;

/** Whether a recent switch makes the next one wait (economy.weaponSwitchSeconds). */
export function switchWaiting(flight: Pick<FlightState, "weaponSwitchFor">): boolean {
  return flight.weaponSwitchFor > 0;
}

/** Equips weapon, which starts the wait before the next switch. */
function switchTo(weapon: Weapon, flight: FlightState): void {
  flight.weapon = weapon;
  flight.weaponSwitchFor = ECONOMY.weaponSwitchSeconds;
}

/** Selection participates in the owned upgrade roster. */
export function ensureOwnedWeapons(flight: FlightState) {
  const owned = (flight.ownedWeapons ??= []);
  if (flight.weapon !== "basic" && !owned.includes(flight.weapon)) {
    owned.push(flight.weapon);
  }
  return owned;
}

/** Ada's real weapon ownership: the flight's roster without run-only granted weapons. */
export function ownedForSave(flight: FlightState): UpgradeWeapon[] {
  const granted = flight.grantedWeapons ?? [];
  return ensureOwnedWeapons(flight).filter((weapon) => !granted.includes(weapon));
}

export function ownedWeapons(flight: FlightState): WeaponChoice[] {
  const choices: WeaponChoice[] = [];
  for (const id of ["basic", ...UPGRADE_WEAPONS] as const) {
    if (id === "basic" || flight.weapon === id || flight.ownedWeapons?.includes(id)) {
      choices.push({ id, selected: flight.weapon === id });
    }
  }
  return choices;
}

/**
 * Switches to an owned weapon at any time, including in combat. Refused, changing nothing,
 * while the wait after the last switch runs; choosing the equipped weapon always succeeds.
 */
export function selectFlightWeapon(weapon: Weapon, flight: FlightState): boolean {
  if (!ownedWeapons(flight).some((choice) => choice.id === weapon)) {
    return false;
  }
  if (weapon === flight.weapon) {
    return true;
  }
  if (switchWaiting(flight)) {
    return false;
  }
  ensureOwnedWeapons(flight);
  switchTo(weapon, flight);
  return true;
}

/**
 * Adds a found weapon to the roster and equips it unless the switch wait runs. Returns
 * false, changing nothing, when Ada already owns it.
 */
export function collectWeapon(weapon: UpgradeWeapon, flight: FlightState): boolean {
  const owned = ensureOwnedWeapons(flight);
  // Finding a run-only granted weapon makes it really owned.
  if (flight.grantedWeapons?.includes(weapon)) {
    flight.grantedWeapons = flight.grantedWeapons.filter((entry) => entry !== weapon);
    return true;
  }
  if (owned.includes(weapon)) {
    return false;
  }
  owned.push(weapon);
  if (!switchWaiting(flight)) {
    switchTo(weapon, flight);
  }
  return true;
}
