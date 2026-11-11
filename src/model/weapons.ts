import type { UpgradeWeapon } from "../data/economy.ts";
import type { Weapon } from "../data/types.ts";
import type { FlightState } from "./types.ts";

export interface WeaponChoice {
  id: Weapon;
  selected: boolean;
  /** Changing to this weapon is refused while weapon changes are locked. */
  locked: boolean;
}
export const UPGRADE_WEAPONS = ["missiles", "tripleLaser", "scattershot"] as const;

/** Weapon changes lock during combat (the danger state) and while the post-combat timer runs. */
export function weaponsLocked(flight: Pick<FlightState, "dangerFor" | "weaponLockFor">): boolean {
  return flight.dangerFor > 0 || flight.weaponLockFor > 0;
}

/** Selection participates in the owned upgrade roster. */
export function ensureOwnedWeapons(flight: FlightState) {
  const owned = (flight.ownedWeapons ??= []);
  if (flight.weapon !== "basic" && !owned.includes(flight.weapon)) {
    owned.push(flight.weapon);
  }
  return owned;
}

export function ownedWeapons(flight: FlightState): WeaponChoice[] {
  const locked = weaponsLocked(flight);
  const choices: WeaponChoice[] = [];
  for (const id of ["basic", ...UPGRADE_WEAPONS] as const) {
    if (id === "basic" || flight.weapon === id || flight.ownedWeapons?.includes(id)) {
      const selected = flight.weapon === id;
      choices.push({ id, locked: locked && !selected, selected });
    }
  }
  return choices;
}

export function selectFlightWeapon(weapon: Weapon, flight: FlightState): boolean {
  if (!ownedWeapons(flight).some((choice) => choice.id === weapon)) {
    return false;
  }
  if (weapon !== flight.weapon && weaponsLocked(flight)) {
    return false;
  }
  ensureOwnedWeapons(flight);
  flight.weapon = weapon;
  return true;
}

/**
 * Adds a found weapon to the roster and equips it outside the weapon lock. Returns
 * false, changing nothing, when Ada already owns it.
 */
export function collectWeapon(weapon: UpgradeWeapon, flight: FlightState): boolean {
  const owned = ensureOwnedWeapons(flight);
  if (owned.includes(weapon)) {
    return false;
  }
  owned.push(weapon);
  if (!weaponsLocked(flight)) {
    flight.weapon = weapon;
  }
  return true;
}

/**
 * The quantum warp loses the equipped upgrade weapon and its upgrade levels; Basic is
 * never lost. Returns the lost weapon, or null.
 */
export function loseEquippedWeapon(flight: FlightState): UpgradeWeapon | null {
  if (flight.weapon === "basic") {
    return null;
  }
  const lost = flight.weapon;
  flight.ownedWeapons = ensureOwnedWeapons(flight).filter((weapon) => weapon !== lost);
  flight.levels.weapons[lost] = 0;
  flight.weapon = "basic";
  return lost;
}
