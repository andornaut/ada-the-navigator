import type { Weapon } from "../data/types.ts";
import type { Aboard } from "./types.ts";

// Item gains (gameplay/rules.md "Item notices"): what Ada gains in flight other than Stardust and
// ore, read by comparing what she holds from one frame to the next.

/** What Ada holds that a gain changes. */
export interface GainSnapshot {
  readonly aboard: Aboard | null;
  /** Holodisks recovered across the galaxies. */
  readonly holodisks: number;
  /** Owned weapons in the HUD order, each with its shots left (null: unlimited). */
  readonly weapons: readonly { readonly ammo: number | null; readonly id: Weapon }[];
}

export type ItemGain =
  | { readonly kind: "aboard"; readonly aboard: Aboard }
  | { readonly kind: "ammo"; readonly weapon: Weapon }
  | { readonly kind: "holodisk" }
  | { readonly kind: "weapon"; readonly weapon: Weapon };

/**
 * The gains from one snapshot to the next, in a fixed order: holodisks, new weapons, ammunition,
 * then what Ada newly carries or tows. Weapons and ammunition count only as drops, so a station's
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
    const before = new Map(previous.weapons.map((weapon) => [weapon.id, weapon.ammo]));
    for (const weapon of next.weapons) {
      if (!before.has(weapon.id)) {
        gains.push({ kind: "weapon", weapon: weapon.id });
      }
    }
    for (const weapon of next.weapons) {
      const was = before.get(weapon.id);
      if (was !== undefined && was !== null && weapon.ammo !== null && weapon.ammo > was) {
        gains.push({ kind: "ammo", weapon: weapon.id });
      }
    }
  }
  const { aboard } = next;
  if (aboard && (previous.aboard?.kind !== aboard.kind || previous.aboard.name !== aboard.name)) {
    gains.push({ aboard, kind: "aboard" });
  }
  return gains;
}
