import type { GameState } from "./types.ts";
import { UPGRADE_WEAPONS } from "./weapons.ts";

/** Grant flight ownership without selecting a weapon or changing other saved state. */
export function grantAllWeapons(state: GameState): boolean {
  if (state.mode !== "space" || state.dialogue || !state.flight) {
    return false;
  }
  const owned = [...(state.flight.ownedWeapons ?? [])];
  for (const weapon of UPGRADE_WEAPONS) {
    if (!owned.includes(weapon)) {
      owned.push(weapon);
    }
  }
  state.flight.ownedWeapons = owned;
  return true;
}
