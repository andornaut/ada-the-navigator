import {
  type EconomyCatalog,
  unlockedWeapons,
  type UpgradeTrack,
  type UpgradeWeapon,
} from "../data/economy.ts";
import type { RoutePosition } from "../data/galaxies.ts";
import type { Weapon } from "../data/types.ts";
import { SHIP_TRACKS } from "./shop.ts";
import type { EconomyState } from "./types.ts";
import { addPacks, UPGRADE_WEAPONS } from "./weapons.ts";

/** What one upgrade drop gives (gameplay/economy.md "Earning Stardust"). */
export type UpgradeGift =
  | { kind: "weapon"; weapon: UpgradeWeapon }
  | { kind: "weaponLevel"; level: number; weapon: Weapon }
  | { kind: "track"; level: number; track: UpgradeTrack }
  | { kind: "paint"; scheme: string }
  | { kind: "ammo"; weapon: UpgradeWeapon };

/** One of `items` at random, by `next` in [0, 1). */
function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(next() * items.length))]!;
}

/** One of `entries` by weight, by `next` in [0, 1); every weight is positive. */
function weighted<T>(next: () => number, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let at = next() * total;
  for (const [item, weight] of entries) {
    if (at < weight) {
      return item;
    }
    at -= weight;
  }
  return entries.at(-1)![0];
}

/**
 * The gift an upgrade drop gives in the galaxy at route `position` (gameplay/economy.md "Earning
 * Stardust", "Weapon unlocks"): a category by its weight (Weapons, Shield, Engine tuning, Tractor
 * beam and Paint), then an item within it, Weapons among Laser and the galaxy's unlocked weapons.
 * Weapons gives one weapon's next step by the weapon's weight: the weapon itself if Ada does not
 * own it, else its next level. A category or weapon with nothing left leaves the pool and the
 * rest keep their relative weights; with nothing left, one pack as an ammo pack pickup gives
 * (chooseAmmoPack), for any owned weapon whatever the galaxy, or null when none is eligible.
 */
export function chooseUpgrade(
  catalog: EconomyCatalog,
  economy: EconomyState,
  position: RoutePosition,
  next: () => number,
): UpgradeGift | null {
  const { categories, weapons } = catalog.upgradeDropWeights;
  const owned = (weapon: Weapon) => weapon === "laser" || economy.ownedWeapons.includes(weapon);
  // Only Laser and the weapons the galaxy unlocks drop, at their weights among themselves.
  const unlocked = unlockedWeapons(position);
  const steps = (["laser", ...unlocked] as const).filter(
    (weapon) =>
      !owned(weapon) ||
      economy.levels.weapons[weapon] < catalog.weaponUpgradePrices[weapon].length + 1,
  );
  const tracks = SHIP_TRACKS.filter(
    (track) => economy.levels[track] < catalog.trackPrices[track].length + 1,
  );
  const paints = catalog.paintOrder.filter(
    (scheme) => scheme !== catalog.defaultPaint && !economy.paints.includes(scheme),
  );
  const pool: (readonly [() => UpgradeGift, number])[] = [
    ...(steps.length
      ? [
          [
            () => {
              const weapon = weighted(
                next,
                steps.map((entry) => [entry, weapons[entry]] as const),
              );
              return weapon !== "laser" && !owned(weapon)
                ? ({ kind: "weapon", weapon } as const)
                : ({
                    kind: "weaponLevel",
                    level: economy.levels.weapons[weapon] + 1,
                    weapon,
                  } as const);
            },
            categories.weapons,
          ] as const,
        ]
      : []),
    ...tracks.map(
      (track) =>
        [
          () => ({ kind: "track", level: economy.levels[track] + 1, track }) as const,
          categories[track],
        ] as const,
    ),
    ...(paints.length
      ? [
          [
            () => ({ kind: "paint", scheme: pick(next, paints) }) as const,
            categories.paint,
          ] as const,
        ]
      : []),
  ];
  if (pool.length) {
    return weighted(next, pool)();
  }
  const weapon = chooseAmmoPack(catalog, economy.ownedWeapons, next);
  return weapon && { kind: "ammo", weapon };
}

/**
 * The weapon an ammo pack is for, chosen as Ada collects it (gameplay/economy.md "Earning
 * Stardust"): an owned weapon other than Laser, in any galaxy, by the ammo pack weights; null
 * while she owns none.
 */
export function chooseAmmoPack(
  catalog: EconomyCatalog,
  owned: readonly Weapon[],
  next: () => number,
): UpgradeWeapon | null {
  const weapons = UPGRADE_WEAPONS.filter((weapon) => owned.includes(weapon));
  return weapons.length
    ? weighted(
        next,
        weapons.map((weapon) => [weapon, catalog.ammo.dropWeights[weapon]] as const),
      )
    : null;
}

/**
 * Gives a gift as buying it would, at no cost: a new weapon with its packs, one level, a paint
 * scheme owned but not put in use, or one pack.
 */
export function applyUpgrade(
  catalog: EconomyCatalog,
  gift: UpgradeGift,
  economy: EconomyState,
): void {
  switch (gift.kind) {
    case "weapon":
      economy.ownedWeapons.push(gift.weapon);
      addPacks(catalog, gift.weapon, catalog.ammo.grantPacks, economy.ammo);
      break;
    case "weaponLevel":
      economy.levels.weapons[gift.weapon] = gift.level;
      break;
    case "track":
      economy.levels[gift.track] = gift.level;
      break;
    case "paint":
      economy.paints.push(gift.scheme);
      break;
    case "ammo":
      addPacks(catalog, gift.weapon, 1, economy.ammo);
      break;
  }
}
