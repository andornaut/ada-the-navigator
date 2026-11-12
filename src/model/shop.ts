import {
  type EconomyCatalog,
  unlockedWeapons,
  type UpgradeTrack,
  type UpgradeWeapon,
} from "../data/economy.ts";
import type { RoutePosition } from "../data/galaxies.ts";
import type { Weapon } from "../data/types.ts";
import type { EconomyState } from "./types.ts";
import { addPacks, UPGRADE_WEAPONS } from "./weapons.ts";

export type ShopItem =
  | { kind: "weapon"; weapon: UpgradeWeapon }
  | { kind: "weaponUpgrade"; weapon: Weapon }
  /** One pack of an owned upgrade weapon's ammunition. */
  | { kind: "ammo"; weapon: UpgradeWeapon }
  | { kind: "track"; track: UpgradeTrack }
  | { kind: "paint"; scheme: string }
  /** The galaxy's holodisk in the mining hub's shop (gameplay/economy.md). */
  | { kind: "holodisk" };
export type ShopTab = "weapons" | "ship";
export const SHOP_TABS: readonly ShopTab[] = ["weapons", "ship"];
export const SHIP_TRACKS: readonly UpgradeTrack[] = ["shield", "engine", "tractor"];

export interface ShopRow {
  item: ShopItem;
  /** Owned weapons and paints, and fully upgraded tracks, are no longer for sale. */
  owned: boolean;
  /** The paint scheme on Ada's ship; it shows In use instead of Owned. */
  inUse: boolean;
  /** The next purchase's price, or null when not for sale. */
  price: number | null;
  /** Current level (from 1) and level count for leveled items; null otherwise. */
  level: { current: number; max: number } | null;
}

export type PurchaseRequest =
  | { kind: "confirm"; price: number; left: number }
  | { kind: "refused"; reason: "cantAfford" | "notForSale" };
export type PurchaseResult =
  { kind: "bought"; price: number } | { kind: "refused"; reason: "cantAfford" | "notForSale" };

function prices(catalog: EconomyCatalog, item: ShopItem): readonly number[] | null {
  switch (item.kind) {
    case "weaponUpgrade":
      return catalog.weaponUpgradePrices;
    case "track":
      return catalog.trackPrices[item.track];
    default:
      return null;
  }
}

/** The current level, from 1 (the base) to the level count. */
function level(economy: EconomyState, item: ShopItem): number {
  switch (item.kind) {
    case "weaponUpgrade":
      return economy.levels.weapons[item.weapon];
    case "track":
      return economy.levels[item.track];
    default:
      return 1;
  }
}

function weaponOwned(economy: EconomyState, weapon: Weapon): boolean {
  return weapon === "laser" || economy.ownedWeapons.includes(weapon);
}

export function shopRow(catalog: EconomyCatalog, economy: EconomyState, item: ShopItem): ShopRow {
  const table = prices(catalog, item);
  if (table) {
    // Level 1 is the base; the table prices levels 2 and up.
    const current = level(economy, item);
    const max = table.length + 1;
    const maxed = current >= max;
    const forSale = item.kind !== "weaponUpgrade" || weaponOwned(economy, item.weapon);
    return {
      inUse: false,
      item,
      level: { current, max },
      owned: maxed,
      price: maxed || !forSale ? null : table[current - 1]!,
    };
  }
  if (item.kind === "weapon") {
    const owned = economy.ownedWeapons.includes(item.weapon);
    return {
      inUse: false,
      item,
      level: null,
      owned,
      price: owned ? null : catalog.weaponPrices[item.weapon],
    };
  }
  if (item.kind === "ammo") {
    // Packs never sell out; only an owned weapon's ammunition is for sale.
    const owned = economy.ownedWeapons.includes(item.weapon);
    return {
      inUse: false,
      item,
      level: null,
      owned: false,
      price: owned ? catalog.ammo.packPrice : null,
    };
  }
  if (item.kind === "paint") {
    const scheme = catalog.paints[item.scheme];
    const owned = economy.paints.includes(item.scheme) || item.scheme === catalog.defaultPaint;
    return {
      inUse: economy.paint === item.scheme,
      item,
      level: null,
      owned,
      price: owned || !scheme ? null : scheme.price,
    };
  }
  return { inUse: false, item, level: null, owned: false, price: null };
}

export type ShopRowState = "forSale" | "unaffordable" | "selectable" | "owned" | "inUse";

/**
 * How a row answers a tap: an owned paint scheme not in use is applied at once, an
 * item for sale opens the confirm, and one Ada cannot afford refuses.
 */
export function shopRowState(stardust: number, row: ShopRow): ShopRowState {
  if (row.inUse) {
    return "inUse";
  }
  if (row.owned) {
    return row.item.kind === "paint" ? "selectable" : "owned";
  }
  if (row.price === null) {
    return "owned";
  }
  return row.price <= stardust ? "forSale" : "unaffordable";
}

/**
 * Whether the galaxy at route `position` sells an item (gameplay/economy.md "Weapon unlocks"): a
 * weapon, its levels or its ammunition once the route unlocks it there, Laser's levels
 * everywhere, and the Ship tab's items in every shop.
 */
export function onSale(position: RoutePosition, item: ShopItem): boolean {
  if (item.kind !== "ammo" && item.kind !== "weapon" && item.kind !== "weaponUpgrade") {
    return true;
  }
  return item.weapon === "laser" || unlockedWeapons(position).includes(item.weapon);
}

/**
 * A tab's rows in the galaxy at route `position`. Weapons lists an ammunition row for each owned
 * upgrade weapon the galaxy has unlocked, then the upgrade weapons unlocked there, then an
 * upgrade row for Laser and each owned weapon unlocked there. Ship lists the upgrade tracks, then
 * the paint schemes.
 */
export function shopRows(
  catalog: EconomyCatalog,
  economy: EconomyState,
  position: RoutePosition,
  tab: ShopTab,
): ShopRow[] {
  const items: ShopItem[] =
    tab === "weapons"
      ? [
          ...UPGRADE_WEAPONS.filter((weapon) => weaponOwned(economy, weapon))
            .map((weapon): ShopItem => ({ kind: "ammo", weapon }))
            .filter((item) => onSale(position, item)),
          ...UPGRADE_WEAPONS.map((weapon): ShopItem => ({ kind: "weapon", weapon })).filter(
            (item) => onSale(position, item),
          ),
          ...(["laser", ...UPGRADE_WEAPONS] as const)
            .filter((weapon) => weaponOwned(economy, weapon))
            .map((weapon): ShopItem => ({ kind: "weaponUpgrade", weapon }))
            .filter((item) => onSale(position, item)),
        ]
      : [
          ...SHIP_TRACKS.map((track): ShopItem => ({ kind: "track", track })),
          ...catalog.paintOrder.map((scheme): ShopItem => ({ kind: "paint", scheme })),
        ];
  return items.map((item) => shopRow(catalog, economy, item));
}

/** A confirm with the balance left after, or a refusal; a refusal never opens a confirm. */
export function requestPurchase(
  catalog: EconomyCatalog,
  economy: EconomyState,
  item: ShopItem,
): PurchaseRequest {
  const { price } = shopRow(catalog, economy, item);
  if (price === null) {
    return { kind: "refused", reason: "notForSale" };
  }
  if (price > economy.stardust) {
    return { kind: "refused", reason: "cantAfford" };
  }
  return { kind: "confirm", left: economy.stardust - price, price };
}

/** Buys from the economy as it is now, so a change since the confirm opened refuses it. */
export function buy(
  catalog: EconomyCatalog,
  item: ShopItem,
  economy: EconomyState,
): PurchaseResult {
  const request = requestPurchase(catalog, economy, item);
  if (request.kind === "refused") {
    return request;
  }
  economy.stardust -= request.price;
  switch (item.kind) {
    case "weapon":
      economy.ownedWeapons.push(item.weapon);
      // A new weapon includes its packs, on top of any ammunition kept from before.
      addPacks(catalog, item.weapon, catalog.ammo.grantPacks, economy.ammo);
      break;
    case "ammo":
      addPacks(catalog, item.weapon, 1, economy.ammo);
      break;
    case "weaponUpgrade":
      economy.levels.weapons[item.weapon]++;
      break;
    case "track":
      economy.levels[item.track]++;
      break;
    case "paint":
      economy.paints.push(item.scheme);
      economy.paint = item.scheme;
      break;
  }
  return { kind: "bought", price: request.price };
}

/** Applies an owned paint scheme; refuses one Ada does not own. */
export function selectPaint(
  catalog: EconomyCatalog,
  scheme: string,
  economy: EconomyState,
): boolean {
  if (scheme !== catalog.defaultPaint && !economy.paints.includes(scheme)) {
    return false;
  }
  economy.paint = scheme;
  return true;
}

/** Fills `{name}` placeholders in a player string. */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

const WEAPON_LABELS: Readonly<Record<Weapon, string>> = {
  heavyMissile: "weaponHeavyMissile",
  laser: "weaponLaser",
  multiLaser: "weaponMultiLaser",
  phaser: "weaponPhaser",
  rapidMissile: "weaponRapidMissile",
  scattershot: "weaponScattershot",
};
const TRACK_LABELS: Readonly<Record<UpgradeTrack, string>> = {
  engine: "engineTuning",
  shield: "shield",
  tractor: "tractorBeam",
};

const ABOUT_LABELS: Readonly<Record<UpgradeWeapon, string>> = {
  heavyMissile: "aboutHeavyMissile",
  multiLaser: "aboutMultiLaser",
  phaser: "aboutPhaser",
  rapidMissile: "aboutRapidMissile",
  scattershot: "aboutScattershot",
};

export function weaponName(labels: Readonly<Record<string, string>>, weapon: Weapon): string {
  return labels[WEAPON_LABELS[weapon]] ?? "";
}

/** An ammunition pack's size line, such as "×200". */
export function packCount(
  catalog: EconomyCatalog,
  labels: Readonly<Record<string, string>>,
  weapon: UpgradeWeapon,
): string {
  return fill(labels.ammoPackCount ?? "", { count: catalog.ammo.pack[weapon] });
}

/**
 * The buy confirm's one line under the glyph: a weapon's description or an ammunition pack's
 * size; other items have none.
 */
export function itemAbout(
  catalog: EconomyCatalog,
  labels: Readonly<Record<string, string>>,
  item: ShopItem,
): string {
  switch (item.kind) {
    case "weapon":
      return labels[ABOUT_LABELS[item.weapon]] ?? "";
    case "ammo":
      return packCount(catalog, labels, item.weapon);
    case "holodisk":
      return labels.holodiskAbout ?? "";
    default:
      return "";
  }
}

/** The player-facing name used by rows and the confirm title. */
export function itemName(
  catalog: EconomyCatalog,
  labels: Readonly<Record<string, string>>,
  item: ShopItem,
): string {
  switch (item.kind) {
    case "weapon":
      return weaponName(labels, item.weapon);
    case "weaponUpgrade":
      return fill(labels.weaponUpgrade ?? "", { weapon: weaponName(labels, item.weapon) });
    case "ammo":
      return fill(labels.ammoPack ?? "", { weapon: weaponName(labels, item.weapon) });
    case "track":
      return labels[TRACK_LABELS[item.track]] ?? "";
    case "holodisk":
      return labels.holodisk ?? "";
    default:
      return labels[catalog.paints[item.scheme]?.label ?? "shipPaint"] ?? "";
  }
}
