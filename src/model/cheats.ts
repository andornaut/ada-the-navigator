import { ECONOMY } from "../data/economy.ts";
import type { GameState } from "./types.ts";
import { addPacks, ensureOwnedWeapons, UPGRADE_WEAPONS } from "./weapons.ts";

/**
 * Run-only: adds every upgrade weapon to the current flight's loadout without
 * selecting one. Weapons Ada did not own are marked granted, with a new weapon's packs for the
 * flight, so they stay out of saved ownership, levels, ammunition and Stardust and end with it.
 */
export function grantAllWeapons(state: GameState): boolean {
  if (state.mode !== "space" || state.dialogue || !state.flight) {
    return false;
  }
  const flight = state.flight;
  const owned = [...ensureOwnedWeapons(flight)];
  const granted = [...(flight.grantedWeapons ?? [])];
  for (const weapon of UPGRADE_WEAPONS) {
    if (!owned.includes(weapon)) {
      owned.push(weapon);
      granted.push(weapon);
      flight.ammo[weapon] = 0;
      addPacks(ECONOMY, weapon, ECONOMY.ammo.grantPacks, flight.ammo);
    }
  }
  flight.ownedWeapons = owned;
  if (granted.length) {
    flight.grantedWeapons = granted;
  }
  return true;
}
