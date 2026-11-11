import type { EconomyCatalog, UpgradeTrack } from "../data/economy.ts";
import { fill, itemName, type ShopItem, type ShopRow, shopRowState } from "../model/shop.ts";
import { type ItemGlyph, type StationRow, weaponItemGlyph } from "../ui/station.ts";

// Maps the model's shop rows to the station view's rows (art/shop.md, art/shop-icons.md).

const TRACK_ICONS: Readonly<Record<UpgradeTrack, string>> = {
  engine: "icon-shop-engine-tuning",
  shield: "icon-shop-shield",
  shieldRecharge: "icon-shop-shield-recharge",
  tractor: "icon-shop-tractor-beam",
};

/** A paint scheme's swatch: the scheme's idle frame 12, Classic's from the unpainted set. */
export function paintSwatchPath(scheme: string, defaultPaint: string): string {
  return scheme === defaultPaint ? "/art/ship-12.svg" : `/art/paint/${scheme}/ship-12.svg`;
}

export function itemGlyph(catalog: EconomyCatalog, item: ShopItem): ItemGlyph {
  switch (item.kind) {
    case "weapon":
      return weaponItemGlyph(item.weapon);
    case "weaponUpgrade":
      return { kind: "upgrade", weapon: item.weapon };
    case "track":
      return { key: TRACK_ICONS[item.track], kind: "sprite" };
    default:
      return { kind: "swatch", path: paintSwatchPath(item.scheme, catalog.defaultPaint) };
  }
}

export function stationRow(
  catalog: EconomyCatalog,
  labels: Readonly<Record<string, string>>,
  stardust: number,
  row: ShopRow,
): StationRow {
  return {
    glyph: itemGlyph(catalog, row.item),
    group: row.item.kind === "paint" ? "paint" : "items",
    key: JSON.stringify(row.item),
    level: row.level
      ? fill(labels.level ?? "", { level: row.level.current, max: row.level.max })
      : "",
    name: itemName(catalog, labels, row.item),
    price: row.price,
    state: shopRowState(stardust, row),
  };
}
