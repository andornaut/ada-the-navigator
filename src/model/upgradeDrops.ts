import type { EconomyCatalog, UpgradeTrack, UpgradeWeapon } from "../data/economy.ts";
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
 * The gift an upgrade drop gives (gameplay/economy.md "Earning Stardust"): a category by its
 * weight (Weapons, Shield, Engine tuning, Tractor beam and Paint), then an item within it.
 * Weapons gives one weapon's next step by the weapon's weight: the weapon itself if Ada does not
 * own it, else its next level. A category or weapon with nothing left leaves the pool and the
 * rest keep their relative weights; with nothing left, one pack for a random owned weapon other
 * than Laser.
 */
export function chooseUpgrade(
  catalog: EconomyCatalog,
  economy: EconomyState,
  next: () => number,
): UpgradeGift {
  const { categories, weapons } = catalog.upgradeDropWeights;
  const owned = (weapon: Weapon) => weapon === "laser" || economy.ownedWeapons.includes(weapon);
  const maxLevel = catalog.weaponUpgradePrices.length + 1;
  const steps = (["laser", ...UPGRADE_WEAPONS] as const).filter(
    (weapon) => !owned(weapon) || economy.levels.weapons[weapon] < maxLevel,
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
  return { kind: "ammo", weapon: pick(next, UPGRADE_WEAPONS.filter(owned)) };
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
