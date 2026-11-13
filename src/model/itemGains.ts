import type { UpgradeTrack } from "../data/economy.ts";
import type { Weapon } from "../data/types.ts";
import type { Aboard, ShipState } from "./types.ts";

// Item gains (gameplay/rules.md "Item notices"): what Ada gains in flight other than Stardust and
// ore. Ammo comes from applied pickup feedback; other gains compare held snapshots.

/** What Ada holds that a gain changes. */
export interface GainSnapshot {
  readonly aboard: Aboard | null;
  /** Holodisks recovered across the galaxies. */
  readonly holodisks: number;
  /** The Shield, Engine and Tractor beam levels. */
  readonly levels: Readonly<Record<UpgradeTrack, number>>;
  /** Owned paint schemes. */
  readonly paints: readonly string[];
  /** Owned weapons in the HUD order, each with its level and shots left (null: unlimited). */
  readonly weapons: readonly {
    readonly ammo: number | null;
    readonly id: Weapon;
    readonly level: number;
  }[];
}

export type ItemGain =
  | { readonly kind: "aboard"; readonly aboard: Aboard }
  | { readonly added: number; readonly kind: "ammo"; readonly weapon: Weapon }
  | { readonly kind: "holodisk" }
  | { readonly kind: "level"; readonly level: number; readonly track: UpgradeTrack }
  | { readonly kind: "paint"; readonly scheme: string }
  | { readonly kind: "weapon"; readonly weapon: Weapon }
  | { readonly kind: "weaponLevel"; readonly level: number; readonly weapon: Weapon };

/** What Ada holds now: her ship's state and the paint schemes she owns. */
export function gainSnapshot(paints: readonly string[], ship: ShipState): GainSnapshot {
  return {
    aboard: ship.aboard,
    holodisks: ship.holodisks,
    levels: { engine: ship.engine, shield: ship.shield, tractor: ship.tractor },
    paints: [...paints],
    weapons: ship.weapons.map(({ ammo, id, level }) => ({ ammo, id, level })),
  };
}

const TRACKS: readonly UpgradeTrack[] = ["shield", "engine", "tractor"];

/**
 * The gains from one snapshot to the next, in a fixed order: holodisks, new weapons, weapon
 * levels, Shield, Engine and Tractor beam levels, paint schemes, then what Ada newly
 * carries or tows. Weapons, levels and paint count only as drops, so a station's
 * purchases (docked) gain nothing.
 */
export function itemGains(
  docked: boolean,
  previous: GainSnapshot,
  next: GainSnapshot,
): readonly ItemGain[] {
  const gains: ItemGain[] = [];
  for (let count = previous.holodisks; count < next.holodisks; count++) {
    gains.push({ kind: "holodisk" });
  }
  if (!docked) {
    const before = new Map(previous.weapons.map((weapon) => [weapon.id, weapon]));
    for (const weapon of next.weapons) {
      if (!before.has(weapon.id)) {
        gains.push({ kind: "weapon", weapon: weapon.id });
      }
    }
    for (const weapon of next.weapons) {
      const was = before.get(weapon.id);
      if (was && weapon.level > was.level) {
        gains.push({ kind: "weaponLevel", level: weapon.level, weapon: weapon.id });
      }
    }
    for (const track of TRACKS) {
      if (next.levels[track] > previous.levels[track]) {
        gains.push({ kind: "level", level: next.levels[track], track });
      }
    }
    for (const scheme of next.paints) {
      if (!previous.paints.includes(scheme)) {
        gains.push({ kind: "paint", scheme });
      }
    }
  }
  const { aboard } = next;
  if (aboard && (previous.aboard?.kind !== aboard.kind || previous.aboard.name !== aboard.name)) {
    gains.push({ aboard, kind: "aboard" });
  }
  return gains;
}
