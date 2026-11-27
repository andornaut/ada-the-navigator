import type { EconomyCatalog, UpgradeTrack } from "../data/economy.ts";
import { EQUIPMENT_DESCRIPTIONS } from "../data/equipmentDetails.ts";
import { weaponDetailLines } from "../data/weaponDetails.ts";
import { ammoGlyphPath } from "../data/weaponGlyphs.ts";
import {
  fill,
  itemAbout,
  itemName,
  packCount,
  type ShopItem,
  type ShopRow,
  shopRowState,
  weaponName,
} from "../model/shop.ts";
import type { ItemDetail } from "../ui/itemDetailContent.ts";
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
    // An ammunition row uses the mask for its ammunition kind.
    case "ammo":
      return { kind: "mask", path: ammoGlyphPath(item.weapon) };
    case "track":
      return { key: TRACK_ICONS[item.track], kind: "stateVector" };
    case "holodisk":
      return { key: "icon-holodisk", kind: "vector" };
    default:
      return {
        kind: "swatch",
        path: catalog.paints[item.scheme] ? (paintSwatch?.(item.scheme) ?? "") : "",
      };
  }
}

/** A purchase describes the offered configuration, independent of the installed one. */
export function shopItemDetail(
  catalog: EconomyCatalog,
  labels: Readonly<Record<string, string>>,
  row: ShopRow,
): ItemDetail {
  const { item, level } = row;
  const offered = level && row.price !== null ? level.current + 1 : undefined;
  if (item.kind === "weapon" || item.kind === "weaponUpgrade") {
    return {
      name: weaponName(labels, item.weapon),
      ...(offered === undefined ? {} : { level: offered }),
      description:
        item.kind === "weaponUpgrade" && item.weapon === "multiLaser" && offered !== undefined
          ? ["One more bolt."]
          : weaponDetailLines(item.weapon, offered ?? level?.current ?? 1),
    };
  }
  return {
    name:
      item.kind === "track" && item.track === "engine"
        ? (labels.engine ?? itemName(catalog, labels, item))
        : itemName(catalog, labels, item),
    ...(offered === undefined ? {} : { level: offered }),
    description:
      item.kind === "track" ? EQUIPMENT_DESCRIPTIONS[item.track] : itemAbout(catalog, labels, item),
  };
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
