import type { EconomyCatalog, UpgradeTrack } from "../data/economy.ts";
import { ammoShopSheet } from "../data/weaponGlyphs.ts";
import {
  fill,
  itemName,
  packCount,
  type ShopItem,
  type ShopRow,
  shopRowState,
} from "../model/shop.ts";
import { type ItemGlyph, type StationRow, weaponItemGlyph } from "../ui/station.ts";

// Maps the model's shop rows to the station view's rows (art/shop.md, art/shop-icons.md).

const TRACK_ICONS: Readonly<Record<UpgradeTrack, string>> = {
  engine: "icon-shop-engine-tuning",
  shield: "icon-shop-shield",
  tractor: "icon-shop-tractor-beam",
};

export function itemGlyph(
  catalog: EconomyCatalog,
  item: ShopItem,
  paintSwatch?: (scheme: string) => string | undefined,
): ItemGlyph {
  switch (item.kind) {
    case "weapon":
      return weaponItemGlyph(item.weapon);
    case "weaponUpgrade":
      return { kind: "upgrade", weapon: item.weapon };
    // The ammunition kind's sheet alone, never the weapon's sheet.
    case "ammo":
      return { key: ammoShopSheet(item.weapon), kind: "sprite" };
    case "track":
      return { key: TRACK_ICONS[item.track], kind: "equipment" };
    case "holodisk":
      return { key: "icon-holodisk", kind: "sprite" };
    default:
      return {
        kind: "swatch",
        path: catalog.paints[item.scheme] ? (paintSwatch?.(item.scheme) ?? "") : "",
      };
  }
}

export function stationRow(
  catalog: EconomyCatalog,
  labels: Readonly<Record<string, string>>,
  stardust: number,
  row: ShopRow,
  requirementText?: (weapon: NonNullable<ShopRow["requiresWeapon"]>) => string,
  paintSwatch?: (scheme: string) => string | undefined,
): StationRow {
  return {
    glyph: itemGlyph(catalog, row.item, paintSwatch),
    group: row.item.kind === "paint" ? "paint" : row.item.kind === "ammo" ? "ammo" : "items",
    key: JSON.stringify(row.item),
    // An ammunition row's pack size takes the level line's place.
    level: row.level
      ? fill(labels.level ?? "", { level: row.level.current, max: row.level.max })
      : row.item.kind === "ammo"
        ? packCount(catalog, labels, row.item.weapon)
        : row.item.kind === "holodisk"
          ? (labels.holodiskAbout ?? "")
          : "",
    name: itemName(catalog, labels, row.item),
    price: row.price,
    ...(row.requiresWeapon === undefined
      ? {}
      : {
          requiresWeapon: row.requiresWeapon,
          ...(requirementText ? { reason: requirementText(row.requiresWeapon) } : {}),
        }),
    state: shopRowState(stardust, row),
  };
}
