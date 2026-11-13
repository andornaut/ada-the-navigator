import {
  ECONOMY,
  type EconomyCatalog,
  type UpgradeWeapon,
  worldAmmoPack,
} from "../data/economy.ts";
import type { Weapon } from "../data/types.ts";
import type { AmmoCounts, FlightState } from "./types.ts";

export interface WeaponChoice {
  id: Weapon;
  /** The weapon's upgrade level, 1 to 3. */
  level: number;
  selected: boolean;
  /** Shots left; null for Laser, which is unlimited. An empty weapon refuses selection. */
  ammo: number | null;
}
/**
 * The upgrade weapons in display order after Laser (gameplay/rules.md), for the HUD, the shop,
 * ammunition and the Ship card; the drop pool and the cheat grant use the same list.
 */
export const UPGRADE_WEAPONS = [
  "multiLaser",
  "rapidMissile",
  "heavyMissile",
  "scattershot",
  "phaser",
] as const;

/** No ammunition for any upgrade weapon. */
export function noAmmo(): AmmoCounts {
  return { heavyMissile: 0, multiLaser: 0, phaser: 0, rapidMissile: 0, scattershot: 0 };
}

/** Copies a loadout with every finite weapon bounded by the canonical capacity. */
export function clampAmmo(catalog: Pick<EconomyCatalog, "ammo">, ammo: AmmoCounts): AmmoCounts {
  const capped = { ...ammo };
  for (const weapon of UPGRADE_WEAPONS) {
    capped[weapon] = Math.min(catalog.ammo.capacity, capped[weapon]);
  }
  return capped;
}

/** Applies an acquisition and reports only shots actually added, never a negative feedback gain. */
function addAmmo(
  catalog: Pick<EconomyCatalog, "ammo">,
  weapon: UpgradeWeapon,
  amount: number,
  ammo: AmmoCounts,
): number {
  const before = ammo[weapon];
  ammo[weapon] = Math.min(catalog.ammo.capacity, before + amount);
  return Math.max(0, ammo[weapon] - before);
}

/** Adds full packs for shop purchases and weapon grants; returns the immediate ammo delta. */
export function addPacks(
  catalog: Pick<EconomyCatalog, "ammo">,
  weapon: UpgradeWeapon,
  packs: number,
  ammo: AmmoCounts,
): number {
  return addAmmo(catalog, weapon, packs * catalog.ammo.pack[weapon], ammo);
}

/** Adds one world ammo item, returning its immediate grant delta even while Ada fires. */
export function addWorldAmmo(
  catalog: Pick<EconomyCatalog, "ammo">,
  weapon: UpgradeWeapon,
  ammo: AmmoCounts,
): number {
  return addAmmo(catalog, weapon, worldAmmoPack(catalog, weapon), ammo);
}

/** The ammunition a new weapon includes, for each weapon in owned and none for the rest. */
export function grantedAmmo(owned: readonly UpgradeWeapon[]): AmmoCounts {
  const ammo = noAmmo();
  for (const weapon of owned) {
    addPacks(ECONOMY, weapon, ECONOMY.ammo.grantPacks, ammo);
  }
  return ammo;
}

/** Shots left for weapon, or null for Laser. */
export function shotsLeft(weapon: Weapon, flight: Pick<FlightState, "ammo">): number | null {
  return weapon === "laser" ? null : flight.ammo[weapon];
}

/**
 * Spends one shot of the equipped weapon. When that empties it, Ada switches to Laser at once,
 * ignoring the switch wait, and this returns true.
 */
export function spendShot(flight: FlightState): boolean {
  if (flight.weapon === "laser") {
    return false;
  }
  const left = Math.max(0, flight.ammo[flight.weapon] - 1);
  flight.ammo[flight.weapon] = left;
  if (left > 0) {
    return false;
  }
  flight.weapon = "laser";
  return true;
}

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
  if (flight.weapon !== "laser" && !owned.includes(flight.weapon)) {
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
  for (const id of ["laser", ...UPGRADE_WEAPONS] as const) {
    if (id === "laser" || flight.weapon === id || flight.ownedWeapons?.includes(id)) {
      choices.push({
        ammo: shotsLeft(id, flight),
        id,
        level: flight.levels.weapons[id] ?? 1,
        selected: flight.weapon === id,
      });
    }
  }
  return choices;
}

/**
 * Switches to an owned weapon at any time, including in combat. Refused, changing nothing,
 * for an empty weapon or while the wait after the last switch runs; choosing the equipped
 * weapon always succeeds.
 */
export function selectFlightWeapon(weapon: Weapon, flight: FlightState): boolean {
  if (!ownedWeapons(flight).some((choice) => choice.id === weapon)) {
    return false;
  }
  if (weapon === flight.weapon) {
    return true;
  }
  if (switchWaiting(flight) || shotsLeft(weapon, flight) === 0) {
    return false;
  }
  ensureOwnedWeapons(flight);
  switchTo(weapon, flight);
  return true;
}

/**
 * Adds a found weapon to the roster with its included packs and equips it unless the switch
 * wait runs. A weapon Ada already owns gives one pack instead; this then returns false.
 */
export function collectWeapon(weapon: UpgradeWeapon, flight: FlightState): boolean {
  const owned = ensureOwnedWeapons(flight);
  // Finding a run-only granted weapon makes it really owned.
  if (flight.grantedWeapons?.includes(weapon)) {
    flight.grantedWeapons = flight.grantedWeapons.filter((entry) => entry !== weapon);
    addPacks(ECONOMY, weapon, ECONOMY.ammo.grantPacks, flight.ammo);
    return true;
  }
  if (owned.includes(weapon)) {
    addPacks(ECONOMY, weapon, ECONOMY.ammo.duplicatePacks, flight.ammo);
    return false;
  }
  owned.push(weapon);
  addPacks(ECONOMY, weapon, ECONOMY.ammo.grantPacks, flight.ammo);
  if (!switchWaiting(flight)) {
    switchTo(weapon, flight);
  }
  return true;
}
