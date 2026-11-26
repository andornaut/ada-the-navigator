import { CHEAT_IDS, type CheatId } from "../data/cheatCopy.ts";
import { ECONOMY } from "../data/economy.ts";
import type { Weapon } from "../data/types.ts";
import { shopRow } from "./shop.ts";
import type { EconomyState, GameState } from "./types.ts";
import { UPGRADE_WEAPONS } from "./weapons.ts";

// CLEANUP (added 2026-11-26): Remove when GameModel, the scene and their tests import
// the cheat IDs and type from data/cheatCopy.ts.
export { CHEAT_IDS, type CheatId };

/** What Add 1,000 ore and Add 1,000 Stardust add on every press. */
export const CHEAT_AMOUNT = 1000;

const TRACKS = ["shield", "engine", "tractor"] as const;

function trackMax(economy: EconomyState, track: (typeof TRACKS)[number]): number {
  return shopRow(ECONOMY, economy, { kind: "track", track }).level!.max;
}

function weaponMax(economy: EconomyState, weapon: Weapon): number {
  return shopRow(ECONOMY, economy, { kind: "weaponUpgrade", weapon }).level!.max;
}

function leveledWeapons(economy: EconomyState): Weapon[] {
  return ["laser", ...economy.ownedWeapons];
}

/**
 * Whether an economy cheat has anything left to grant; the amount grants always do. Galaxies
 * are the model's (GameModel.cheatAvailable). The economy must hold the current loadout.
 */
export function economyCheatAvailable(
  id: Exclude<CheatId, "unlockAllGalaxies">,
  economy: EconomyState,
): boolean {
  if (id === "unlockAllWeapons") {
    return UPGRADE_WEAPONS.some(
      (weapon) =>
        !economy.ownedWeapons.includes(weapon) || economy.ammo[weapon] < ECONOMY.ammo.capacity,
    );
  }
  if (id === "unlockAllEquipment") {
    return (
      TRACKS.some((track) => economy.levels[track] < trackMax(economy, track)) ||
      ECONOMY.paintOrder.some((paint) => !economy.paints.includes(paint))
    );
  }
  if (id === "maxWeaponLevels") {
    return leveledWeapons(economy).some(
      (weapon) => economy.levels.weapons[weapon] < weaponMax(economy, weapon),
    );
  }
  return true;
}

/**
 * Applies an economy cheat to the economy, or to the flight's hold for ore in flight. It changes
 * no achievement record and marks nothing cleared.
 */
export function applyEconomyCheat(
  id: Exclude<CheatId, "unlockAllGalaxies">,
  state: GameState,
): void {
  const economy = state.economy;
  switch (id) {
    case "unlockAllWeapons":
      for (const weapon of UPGRADE_WEAPONS) {
        if (!economy.ownedWeapons.includes(weapon)) {
          economy.ownedWeapons.push(weapon);
        }
        economy.ammo[weapon] = ECONOMY.ammo.capacity;
      }
      return;
    case "unlockAllEquipment":
      for (const track of TRACKS) {
        economy.levels[track] = Math.max(economy.levels[track], trackMax(economy, track));
      }
      for (const paint of ECONOMY.paintOrder) {
        if (!economy.paints.includes(paint)) {
          economy.paints.push(paint);
        }
      }
      return;
    case "maxWeaponLevels":
      for (const weapon of leveledWeapons(economy)) {
        economy.levels.weapons[weapon] = Math.max(
          economy.levels.weapons[weapon],
          weaponMax(economy, weapon),
        );
      }
      return;
    case "addOre":
      // Ore aboard in flight, or kept aboard for the next flight between flights.
      if (state.mode === "space" && state.flight) {
        state.flight.cargo += CHEAT_AMOUNT;
      } else {
        economy.cargo = (economy.cargo ?? 0) + CHEAT_AMOUNT;
      }
      return;
    case "addStardust":
      economy.stardust += CHEAT_AMOUNT;
  }
}
