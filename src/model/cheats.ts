import type { GameState } from "./types.ts";
import { ensureOwnedWeapons, UPGRADE_WEAPONS } from "./weapons.ts";

/**
 * Run-only: adds every upgrade weapon to the current flight's loadout without
 * selecting one. Weapons Ada did not own are marked granted, so they stay out of saved
 * ownership, levels and Stardust and end with the flight.
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
    }
  }
  flight.ownedWeapons = owned;
  if (granted.length) {
    flight.grantedWeapons = granted;
  }
  return true;
}
