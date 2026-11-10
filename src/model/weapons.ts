import type { Weapon } from "../data/types.ts";
import type { FlightState } from "./types.ts";

export interface WeaponChoice {
  id: Weapon;
  ammo: null;
  selected: boolean;
}
const upgrades = ["rapid", "spread", "pierce"] as const;

/** Legacy flights establish ownership from their selected upgrade without relying on ammunition. */
export function ensureOwnedWeapons(flight: FlightState) {
  const owned = (flight.ownedWeapons ??= []);
  if (flight.weapon !== "basic" && !owned.includes(flight.weapon)) {
    owned.push(flight.weapon);
  }
  return owned;
}

export function ownedWeapons(flight: FlightState): WeaponChoice[] {
  const choices: WeaponChoice[] = [
    { ammo: null, id: "basic", selected: flight.weapon === "basic" },
  ];
  for (const id of upgrades) {
    if (flight.weapon === id || flight.ownedWeapons?.includes(id)) {
      choices.push({ ammo: null, id, selected: flight.weapon === id });
    }
  }
  return choices;
}

export function selectFlightWeapon(weapon: Weapon, flight: FlightState): boolean {
  if (!ownedWeapons(flight).some((choice) => choice.id === weapon)) {
    return false;
  }
  ensureOwnedWeapons(flight);
  flight.weapon = weapon;
  flight.ammo = 0;
  return true;
}

export function collectWeapon(weapon: Exclude<Weapon, "basic">, flight: FlightState): void {
  const owned = ensureOwnedWeapons(flight);
  if (!owned.includes(weapon)) {
    owned.push(weapon);
  }
  flight.weapon = weapon;
  flight.ammo = 0;
}

export function loseSelectedWeapon(flight: FlightState): boolean {
  if (flight.weapon === "basic") {
    return false;
  }
  const selected = flight.weapon;
  const owned = ensureOwnedWeapons(flight);
  flight.ownedWeapons = owned.filter((weapon) => weapon !== selected);
  flight.weapon = "basic";
  flight.ammo = 0;
  return true;
}
