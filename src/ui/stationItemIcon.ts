import type { Weapon } from "../data/types.ts";
import { weaponShopSheet } from "../data/weaponGlyphs.ts";
import { STATION_SPRITES } from "./layout/stationStyle.ts";

const SPRITES = STATION_SPRITES;

export type ItemGlyph =
  | { readonly kind: "sprite"; readonly key: string }
  | { readonly kind: "upgrade"; readonly weapon: Weapon }
  | { readonly kind: "swatch"; readonly path: string };

/** A weapon's shop glyph: its two-frame shop sheet. */
export function weaponItemGlyph(weapon: Weapon): ItemGlyph {
  return { key: weaponShopSheet(weapon), kind: "sprite" };
}

export function createStationItemIcon(glyph: ItemGlyph): HTMLElement {
  if (glyph.kind === "swatch") {
    const image = document.createElement("img");
    image.className = "ada-glyph-swatch";
    image.src = glyph.path;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    return image;
  }
  const node = document.createElement("span");
  node.setAttribute("aria-hidden", "true");
  if (glyph.kind === "upgrade") {
    node.className = "ada-glyph-upgrade";
    const badge = document.createElement("span");
    badge.className = "ada-glyph-badge";
    node.append(createStationItemIcon(weaponItemGlyph(glyph.weapon)), badge);
    return node;
  }
  node.className = "ada-glyph ada-glyph-sprite";
  node.style.setProperty("--sheet", `url('${SPRITES}${glyph.key}.png')`);
  return node;
}

/** Rows and detail headers share the canonical item glyph, including upgrade markers. */
export function setStationItemTitle(glyph: ItemGlyph, title: string, header: HTMLElement): void {
  header.classList.add("ada-detail-header");
  const name = header.ownerDocument.createElement("span");
  name.textContent = title;
  const icon = createStationItemIcon(glyph);
  icon.style.flex = "none";
  header.replaceChildren(icon, name);
}
